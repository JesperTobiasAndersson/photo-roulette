process.removeAllListeners("warning"); // hide the TS "module type" notice
// Shared plumbing for the stress / concurrency tests (API level, no browser).
//
// - Loads the app's real src/games/*/api.ts in Node (type stripping) with
//   src/lib/supabase swapped for a shim, so every "phone" runs the exact same
//   code the app runs: asPlayer(client, () => api.createMafiaRoom("X")).
// - A pool of signed-in anonymous clients that is reused across scenarios and
//   cached on disk between runs (anonymous sign-ins are rate limited per IP).
// - Latency statistics (p50/p95) per operation.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { registerHooks } from "node:module";
import { createClient } from "@supabase/supabase-js";
import { loadEnv, ROOT, wait } from "../lib.mjs";
import { als } from "./_supabase-shim.mjs";

export { wait, ROOT };

// ---------------------------------------------------------------------------
// Load the app's api.ts files
// ---------------------------------------------------------------------------
const SHIM_URL = pathToFileURL(path.join(path.dirname(fileURLToPath(import.meta.url)), "_supabase-shim.mjs")).href;
registerHooks({
  resolve(specifier, context, next) {
    if (/(^|\/)lib\/supabase$/.test(specifier) && context.parentURL?.includes("/src/games/")) {
      return { url: SHIM_URL, shortCircuit: true };
    }
    if (specifier.startsWith(".") && context.parentURL?.endsWith(".ts") && !path.extname(specifier)) {
      const url = new URL(specifier + ".ts", context.parentURL);
      if (fs.existsSync(fileURLToPath(url))) return { url: url.href, shortCircuit: true, format: "module-typescript" };
    }
    return next(specifier, context);
  },
});

export async function loadApi(game) {
  return import(pathToFileURL(path.join(ROOT, "src", "games", game, "api.ts")).href);
}

/** Run `fn` with `client` as the app's `supabase` (like tapping a button on that phone). */
export function asPlayer(client, fn) {
  return als.run(client, fn);
}

// ---------------------------------------------------------------------------
// Client pool
// ---------------------------------------------------------------------------
const env = loadEnv();
const CACHE = path.join(os.tmpdir(), "picklo-stress-sessions.json");
const MAX_SIGNINS = Number(env.STRESS_MAX_SIGNINS || 150);
export const counters = { signIns: 0, restored: 0 };

export class RateLimitError extends Error {}

function newClient() {
  return createClient(env.EXPO_PUBLIC_SUPABASE_URL, env.EXPO_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { params: { eventsPerSecond: 100 } },
  });
}

function readCache() {
  try {
    return JSON.parse(fs.readFileSync(CACHE, "utf8"));
  } catch {
    return [];
  }
}

const pool = [];
let cacheEntries = null;

function saveCache() {
  // Keep sessions not restored this run too, so they can be reused next time.
  const data = [...pool.map((c) => c._stressSession).filter(Boolean), ...(cacheEntries ?? [])];
  try {
    fs.writeFileSync(CACHE, JSON.stringify(data));
  } catch {}
}

async function prepare(client, session) {
  client.auth.onAuthStateChange((_e, s) => {
    if (s) client._stressSession = { access_token: s.access_token, refresh_token: s.refresh_token };
  });
  client._stressSession = { access_token: session.access_token, refresh_token: session.refresh_token };
  client.userId = session.user.id;
  client.realtime.setAuth(session.access_token);
  return client;
}

async function restoreOne(entry) {
  const client = newClient();
  const { data, error } = await client.auth.setSession(entry);
  if (error || !data.session) return null;
  counters.restored++;
  return prepare(client, data.session);
}

export async function signInOne() {
  if (counters.signIns >= MAX_SIGNINS) throw new RateLimitError(`sign-in budget of ${MAX_SIGNINS} used up`);
  counters.signIns++;
  const client = newClient();
  const t0 = performance.now();
  const { data, error } = await client.auth.signInAnonymously();
  record("auth.signInAnonymously", performance.now() - t0);
  if (error) {
    if (error.status === 429 || /rate limit/i.test(error.message)) {
      throw new RateLimitError(`anonymous sign-in rate limited: status=${error.status} code=${error.code} message="${error.message}"`);
    }
    throw error;
  }
  return prepare(client, data.session);
}

/** At least `n` distinct signed-in clients (reused across scenarios; cached between runs). */
export async function clients(n) {
  if (cacheEntries === null) cacheEntries = readCache();
  while (pool.length < n && cacheEntries.length) {
    const batch = cacheEntries.splice(0, Math.min(10, n - pool.length));
    const restored = await Promise.all(batch.map((e) => restoreOne(e).catch(() => null)));
    for (const c of restored) if (c && !pool.some((p) => p.userId === c.userId)) pool.push(c);
  }
  // Sign in the rest, a few at a time.
  while (pool.length < n) {
    const k = Math.min(5, n - pool.length);
    const made = await Promise.all(Array.from({ length: k }, () => signInOne()));
    pool.push(...made);
    saveCache();
  }
  saveCache();
  return pool.slice(0, n);
}

/** Fresh clients that are guaranteed to be members of nothing (for isolation/abuse tests). */
export async function freshOutsiders(n) {
  const all = await clients(pool.length + n);
  return all.slice(all.length - n);
}

export async function closeAll() {
  saveCache();
  await Promise.all(pool.map((c) => c.removeAllChannels().catch(() => {})));
}

// ---------------------------------------------------------------------------
// Timing
// ---------------------------------------------------------------------------
const samples = new Map();
export function record(label, ms) {
  if (!samples.has(label)) samples.set(label, []);
  samples.get(label).push(ms);
}

export async function timed(label, fn) {
  const t0 = performance.now();
  try {
    return await fn();
  } finally {
    record(label, performance.now() - t0);
  }
}

/** Run a supabase-js call that returns {data, error}; records latency; returns the result. */
export async function q(label, fn) {
  return timed(label, fn);
}

export function pct(arr, p) {
  if (!arr.length) return NaN;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)];
}

export function latencyTable(filter = () => true) {
  const rows = [...samples.entries()].filter(([k]) => filter(k));
  const lines = [`${"operation".padEnd(46)} ${"n".padStart(4)} ${"p50".padStart(7)} ${"p95".padStart(7)} ${"max".padStart(7)}`];
  for (const [k, v] of rows) {
    lines.push(`${k.padEnd(46)} ${String(v.length).padStart(4)} ${pct(v, 50).toFixed(0).padStart(7)} ${pct(v, 95).toFixed(0).padStart(7)} ${Math.max(...v).toFixed(0).padStart(7)}`);
  }
  return lines.join("\n");
}

export function resetSamples() {
  samples.clear();
}

export const errText = (e) => (e ? `${e.code ?? ""} ${e.message ?? String(e)}`.trim() : "");

/** Run as main module? */
export const isMain = (metaUrl) => process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(metaUrl);

/** Standard wrapper for running one scenario file standalone. */
export async function runStandalone(metaUrl, run) {
  if (!isMain(metaUrl)) return;
  let failed = 1;
  try {
    failed = await run();
  } catch (e) {
    console.error(e instanceof RateLimitError ? `RATE LIMIT: ${e.message}` : e);
  } finally {
    console.log("\nLatencies (ms):\n" + latencyTable());
    console.log(`\nsign-ins this run: ${counters.signIns} new, ${counters.restored} restored from cache`);
    await closeAll();
  }
  process.exit(failed ? 1 : 0);
}
