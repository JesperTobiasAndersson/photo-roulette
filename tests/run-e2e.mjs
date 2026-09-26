// Runs every end-to-end game test (tests/e2e/*.mjs), two at a time, and prints a summary.
//
//   npm run test:e2e                       all games against the local dev server (npm run web)
//   BASE=https://picklo.app npm run test:e2e
//   node tests/run-e2e.mjs imposter trivia  only some games
//   QUICK=1 npm run test:e2e               shorter Chicago (2 players) and Mafia (5 players)
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const only = process.argv.slice(2);
const files = fs
  .readdirSync(path.join(HERE, "e2e"))
  .filter((f) => f.endsWith(".mjs") && !f.startsWith("_"))
  .filter((f) => only.length === 0 || only.includes(f.replace(/\.mjs$/, "")));

const quickEnv = process.env.QUICK ? { PLAYERS: "2", SCENARIO: "a" } : {};
const PARALLEL = Number(process.env.PARALLEL || 2);

function run(file) {
  return new Promise((resolve) => {
    const started = Date.now();
    const child = spawn(process.execPath, [path.join(HERE, "e2e", file)], {
      env: { ...process.env, ...quickEnv },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let out = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (out += d));
    child.on("close", (code) => {
      const failures = out.split("\n").filter((l) => l.startsWith("FAIL"));
      const passes = out.split("\n").filter((l) => l.startsWith("PASS")).length;
      const secs = Math.round((Date.now() - started) / 1000);
      console.log(`${code === 0 ? "✔" : "✘"} ${file.padEnd(18)} ${passes} passed, ${failures.length} failed  (${secs}s)`);
      failures.slice(0, 5).forEach((f) => console.log("    " + f));
      resolve({ file, code, failures: failures.length });
    });
  });
}

const queue = [...files];
const results = [];
await Promise.all(
  Array.from({ length: Math.min(PARALLEL, queue.length) }, async () => {
    while (queue.length) results.push(await run(queue.shift()));
  })
);
const failed = results.filter((r) => r.code !== 0);
console.log(failed.length ? `\n${failed.length} of ${results.length} game tests failed` : `\nAll ${results.length} game tests passed`);
process.exit(failed.length ? 1 : 0);
