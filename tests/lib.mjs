// Shared helpers for Picklo's end-to-end and stress tests.
//
// Browser tests drive the real app in headless Chrome, one isolated browser
// context per "phone" (separate storage = separate anonymous player).
// API tests talk to Supabase directly, the same way the app does.
//
//   BASE=http://localhost:8081 node tests/e2e/<game>.mjs    (default: local dev server)
//   BASE=https://picklo.app   node tests/e2e/<game>.mjs    (production)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";
import { createClient } from "@supabase/supabase-js";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const BASE = process.env.BASE || "http://localhost:8081";
export const CHROME =
  process.env.CHROME_PATH ||
  ["C:/Program Files/Google/Chrome/Application/chrome.exe", "/usr/bin/google-chrome", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"].find((p) =>
    fs.existsSync(p)
  );

export const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------
export function reporter(name) {
  const results = [];
  const ok = (cond, msg, extra = "") => {
    results.push({ ok: !!cond, msg });
    console.log(`${cond ? "PASS" : "FAIL"}  [${name}] ${msg}${extra ? "  " + extra : ""}`);
    return !!cond;
  };
  const done = () => {
    const failed = results.filter((r) => !r.ok).length;
    console.log(failed ? `\n[${name}] ${failed} of ${results.length} checks FAILED` : `\n[${name}] all ${results.length} checks passed`);
    return failed;
  };
  return { ok, done, results };
}

// ---------------------------------------------------------------------------
// Supabase (API-level tests)
// ---------------------------------------------------------------------------
export function loadEnv() {
  const file = path.join(ROOT, ".env");
  const env = fs.existsSync(file)
    ? Object.fromEntries(
        fs
          .readFileSync(file, "utf8")
          .split(/\r?\n/)
          .filter((l) => l.includes("=") && !l.startsWith("#"))
          .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()])
      )
    : {};
  return { ...env, ...process.env };
}

/** A signed-in anonymous "device", like one phone running the app. */
export async function apiPlayer() {
  const env = loadEnv();
  const client = createClient(env.EXPO_PUBLIC_SUPABASE_URL, env.EXPO_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.signInAnonymously();
  if (error) throw error;
  client.realtime.setAuth(data.session.access_token);
  return client;
}

export const roomCode = () => "T" + Math.random().toString(36).slice(2, 5).toUpperCase().replace(/[IO01]/g, "X");

// ---------------------------------------------------------------------------
// Browser (end-to-end tests)
// ---------------------------------------------------------------------------
export async function launch() {
  if (!CHROME) throw new Error("Chrome not found; set CHROME_PATH");
  return puppeteer.launch({ executablePath: CHROME, headless: true, protocolTimeout: 120000 });
}

/**
 * A new "phone": isolated storage (own anonymous player), 390×844 viewport,
 * dialogs auto-dismissed and recorded, Spotify hand-offs suppressed.
 */
export async function phone(browser, name, { language = "sv" } = {}) {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await page.evaluateOnNewDocument((lang) => {
    try {
      localStorage.setItem("picklo_language", lang);
    } catch {}
    window.open = () => null;
  }, language);
  page.name = name;
  page.dialogs = [];
  page.errors = [];
  page.on("dialog", (d) => {
    page.dialogs.push(d.message().replace(/\s+/g, " "));
    d.dismiss();
  });
  page.on("pageerror", (e) => page.errors.push(e.message));
  return page;
}

/** Visible text of the page. */
export const text = (page) => page.evaluate(() => document.body.innerText);
export const hasText = async (page, re) => re.test(await text(page));

/** Tap the element whose own text is exactly one of `labels` (last match wins, i.e. the innermost/footer one). */
export async function tap(page, labels, { timeout = 15000, contains = false } = {}) {
  const list = Array.isArray(labels) ? labels : [labels];
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const ok = await page.evaluate(
      (list, contains) => {
        const els = [...document.querySelectorAll("div,a,button")].filter((el) => {
          if (el.offsetParent === null) return false;
          const t = el.textContent.trim();
          return contains ? list.some((l) => t.includes(l)) && el.children.length <= 4 : list.includes(t);
        });
        const el = els[els.length - 1];
        if (!el) return false;
        el.click();
        return true;
      },
      list,
      contains
    );
    if (ok) return true;
    await wait(300);
  }
  throw new Error(`${page.name}: nothing to tap with text ${list.join(" / ")}`);
}

export async function tryTap(page, labels, opts = {}) {
  try {
    return await tap(page, labels, { timeout: 1500, ...opts });
  } catch {
    return false;
  }
}

export async function waitForText(page, re, timeout = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await hasText(page, re)) return true;
    await wait(400);
  }
  throw new Error(`${page.name}: timed out waiting for ${re}`);
}

export async function typeInto(page, index, value) {
  await page.waitForSelector("input", { timeout: 30000 });
  const input = (await page.$$("input"))[index];
  await input.click({ clickCount: 3 });
  await input.type(value);
}

/** Room code as shown in the lobby's big code badge. */
export async function readRoomCode(page) {
  return page.evaluate(() => {
    const words = document.body.innerText.match(/\b([A-HJ-NP-Z2-9]{4})\b/g) || [];
    return words.find((w) => !["KOD", "CODE", "ROOM", "HOST", "RUM"].includes(w)) || null;
  });
}

/** Create a room on `entryPath` (e.g. "/imposter") and wait for its lobby route. */
export async function createRoom(page, entryPath, lobbyPath, name) {
  await page.goto(`${BASE}${entryPath}`, { waitUntil: "load" });
  await typeInto(page, 0, name);
  await tap(page, ["Skapa rum", "Create room"]);
  await page.waitForFunction((l) => location.pathname.includes(l), { timeout: 30000 }, lobbyPath);
  await wait(2500);
  return readRoomCode(page);
}

/** Join with the invite link (code prefilled) and wait for the lobby route. */
export async function joinRoom(page, entryPath, lobbyPath, code, name) {
  await page.goto(`${BASE}${entryPath}?code=${code}`, { waitUntil: "load" });
  await wait(1200);
  await typeInto(page, 0, name);
  await tap(page, ["Gå med", "Join room"]);
  await page.waitForFunction((l) => location.pathname.includes(l), { timeout: 30000 }, lobbyPath);
  await wait(1500);
}

export function summarizePhoneIssues(ok, phones) {
  for (const p of phones) {
    const dialogs = p.dialogs.filter(Boolean);
    ok(p.errors.length === 0, `${p.name}: no JavaScript errors`, p.errors.slice(0, 3).join(" | "));
    ok(dialogs.length === 0, `${p.name}: no error pop-ups`, dialogs.slice(0, 3).join(" | "));
  }
}
