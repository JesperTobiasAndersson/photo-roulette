// Runs every stress / concurrency scenario in one process, sharing one pool of signed-in
// phones (≤ 31 anonymous sign-ins on a cold run, 0 when the cached sessions are still valid).
//
//   node tests/stress/run-all.mjs                 # all scenarios
//   node tests/stress/run-all.mjs joins abuse     # just some
import { RateLimitError, closeAll, counters, latencyTable, resetSamples } from "./_common.mjs";
import { run as joins } from "./joins.mjs";
import { run as realtime } from "./realtime-fanout.mjs";
import { run as memematch } from "./memematch-race.mjs";
import { run as manyRooms } from "./many-rooms.mjs";
import { run as chicago } from "./chicago-race.mjs";
import { run as abuse } from "./abuse.mjs";

const ALL = { joins, realtime, memematch, "many-rooms": manyRooms, chicago, abuse };
const pick = process.argv.slice(2);
const selected = pick.length ? pick : Object.keys(ALL);

const summary = [];
const started = Date.now();
for (const name of selected) {
  const fn = ALL[name];
  if (!fn) {
    console.error(`unknown scenario ${name}; choose from ${Object.keys(ALL).join(", ")}`);
    process.exit(2);
  }
  console.log(`\n=== ${name} ===`);
  const t0 = Date.now();
  let failed;
  try {
    failed = await fn();
  } catch (e) {
    console.error(e instanceof RateLimitError ? `RATE LIMIT — scenario stopped: ${e.message}` : e);
    failed = e instanceof RateLimitError ? "rate-limited" : "crashed";
  }
  console.log(`\n--- ${name} latencies (ms) ---\n${latencyTable()}`);
  resetSamples();
  summary.push({ name, failed, secs: ((Date.now() - t0) / 1000).toFixed(0) });
}

console.log("\n=== SUMMARY ===");
for (const s of summary) console.log(`${s.name.padEnd(12)} ${s.failed === 0 ? "PASS" : `FAIL (${s.failed})`}  ${s.secs}s`);
console.log(`total ${((Date.now() - started) / 1000).toFixed(0)}s; sign-ins: ${counters.signIns} new, ${counters.restored} restored from cache`);
await closeAll();
process.exit(summary.every((s) => s.failed === 0) ? 0 : 1);
