// Music Quiz end to end: 3 phones play three full 10-round matches (hits/title,
// classics/artist, mix/title), with "play again with the same group" in between.
//
//   node tests/e2e/music-quiz.mjs
import fs from "node:fs";
import path from "node:path";
import { ROOT, launch, phone, tap, waitForText, text, typeInto, createRoom, joinRoom, reporter, summarizePhoneIssues, wait } from "../lib.mjs";

const R = reporter("music-quiz");
const ART = path.join(ROOT, "tests", "artifacts", "music-quiz");
fs.mkdirSync(ART, { recursive: true });
const shot = (page, name) => page.screenshot({ path: path.join(ART, `${name}.png`) }).catch(() => {});
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const ROUNDS = 10;
const MATCHES = [
  { pool: "Hits", mode: "Gissa låttitel", prompt: "Vilken låt är det?" },
  { pool: "Klassiker", mode: "Gissa artist", prompt: "Vilken artist är det?" },
  { pool: "Mix", mode: "Gissa låttitel", prompt: "Vilken låt är det?" },
];

/** Host taps a scoring toggle ("+1 p") inside the answer row of `name`. */
async function awardTo(page, name, label = "+1 p") {
  const ok = await page.evaluate(
    (name, label, names) => {
      const buttons = [...document.querySelectorAll("div")].filter((el) => el.offsetParent !== null && el.textContent.trim() === label).reverse();
      for (const b of buttons) {
        let el = b.parentElement;
        while (el && !names.some((n) => el.textContent.includes(n))) el = el.parentElement;
        if (el && el.textContent.includes(name) && names.filter((n) => el.textContent.includes(n)).length === 1) {
          b.click();
          return true;
        }
      }
      return false;
    },
    name,
    label,
    NAMES
  );
  if (!ok) throw new Error(`no ${label} button for ${name}`);
}

async function typeAnswer(page, value) {
  const sel = 'input[placeholder="Ditt svar"]';
  await page.waitForSelector(sel, { visible: true, timeout: 15000 });
  await page.$eval(sel, (el) => el.focus());
  await page.keyboard.down("Control"); await page.keyboard.press("A"); await page.keyboard.up("Control");
  await page.keyboard.type(value);
}

/** "Name (Du)\n3p" style score lines → { name: score } */
async function readScores(page) {
  const t = await text(page);
  const out = {};
  for (const n of NAMES) {
    const m = t.match(new RegExp(`${esc(n)}(?: \\((?:Du|You)\\))?\\n(\\d+)p`));
    out[n] = m ? Number(m[1]) : null;
  }
  return out;
}

const NAMES = ["E2E Anna", "E2E Bosse", "E2E Cilla"];
const started = Date.now();
const browser = await launch();
let failed = 1;
try {
  const [host, bo, ci] = await Promise.all(NAMES.map((n) => phone(browser, n)));
  const phones = [host, bo, ci];
  const guests = [bo, ci];

  const code = await createRoom(host, "/music-quiz", "/music-quiz-room", NAMES[0]);
  R.ok(!!code, "host created a room", code);
  await joinRoom(bo, "/music-quiz", "/music-quiz-room", code, NAMES[1]);
  await joinRoom(ci, "/music-quiz", "/music-quiz-room", code, NAMES[2]);
  for (const p of phones) {
    await waitForText(p, new RegExp(NAMES.map(esc).join("[\\s\\S]*")), 20000).catch(() => {});
    const t = await text(p);
    R.ok(NAMES.every((n) => t.includes(n)), `${p.name}: lobby lists all 3 players`);
  }
  await shot(host, "lobby-host");

  for (let mi = 0; mi < MATCHES.length; mi++) {
    const m = MATCHES[mi];
    const tag = `match ${mi + 1} (${m.pool}/${m.mode})`;
    await tap(host, m.pool);
    await tap(host, m.mode);
    await tap(host, "Starta runda");

    const expected = Object.fromEntries(NAMES.map((n) => [n, 0]));
    const titles = [];
    let coverOk = 0;
    for (let r = 1; r <= ROUNDS; r++) {
      const roundRe = new RegExp(`Runda ${r}/${ROUNDS}`);
      for (const p of phones) await waitForText(p, roundRe, 25000);
      for (const g of guests) {
        await waitForText(g, new RegExp(esc(m.prompt)));
        await typeAnswer(g, `gissning ${r} ${g.name.slice(4)}`);
        await tap(g, "Skicka svar");
      }
      await waitForText(host, /Svar inne\n2\/3/, 15000).then(
        () => r === 1 && R.ok(true, `${tag}: host sees 2/3 answers in`),
        () => R.ok(false, `${tag} r${r}: host sees 2/3 answers in`)
      );
      for (const g of guests) {
        if (r === 1) R.ok(/Svaret är skickat/.test(await text(g)), `${tag}: ${g.name} sees "answer sent"`);
      }
      if (mi === 0 && r === 1) await shot(bo, "question-guest");
      await tap(host, "Visa facit");

      for (const p of phones) await waitForText(p, /FACIT|Facit/, 15000);
      const t = await text(host);
      const mm = t.match(/LÅT\n(.+)\nARTIST\n(.+)\n/i);
      R.ok(!!mm, `${tag} r${r}: reveal shows song + artist`);
      if (mm) titles.push(`${mm[1]}|${mm[2]}`.toLowerCase());
      // Guests' answers are visible to the host during reveal.
      if (r === 1) R.ok(t.includes(`gissning 1 Bosse`) && t.includes(`gissning 1 Cilla`), `${tag}: host sees guests' answers`);
      // Cover image loads (naturalWidth > 0).
      const loaded = await host
        .waitForFunction(() => [...document.images].some((i) => /scdn|spotify/i.test(i.src) && i.complete && i.naturalWidth > 0), { timeout: 10000 })
        .then(() => true, () => false);
      if (loaded) coverOk++;
      if (mi === 0 && r === 1) await shot(host, "reveal-host");

      // Awards: Bosse gets odd rounds, Cilla every 3rd, host every 4th.
      const winners = [];
      if (r % 2 === 1) winners.push(NAMES[1]);
      if (r % 3 === 0) winners.push(NAMES[2]);
      if (r % 4 === 0 || (mi === 1 && r % 4 === 1)) winners.push(NAMES[0]); // match 2 ends in a 5-5 tie
      for (const w of winners) {
        await awardTo(host, w);
        expected[w] += 1;
        await host.waitForFunction(() => !document.querySelector('[aria-busy="true"]'), { timeout: 10000 }).catch(() => {});
        await wait(500);
      }
      // Toggle test once: award then retract → score unchanged.
      if (r === 2) {
        await awardTo(host, NAMES[2]);
        await wait(1200);
        await awardTo(host, NAMES[2], "0 p");
        await wait(1200);
      }
      // Scores converge on all phones.
      for (const p of phones) {
        const start = Date.now();
        let s;
        while (Date.now() - start < 20000) {
          s = await readScores(p);
          if (NAMES.every((n) => s[n] === expected[n])) break;
          await wait(500);
        }
        const took = Date.now() - start;
        if (took > 4000) console.log(`  slow: ${p.name} needed ${took}ms to show ${tag} r${r} scores`);
        if (r === ROUNDS || !NAMES.every((n) => s[n] === expected[n]))
          R.ok(NAMES.every((n) => s[n] === expected[n]), `${tag} r${r}: ${p.name} scoreboard matches`, JSON.stringify(s));
      }

      await tap(host, r < ROUNDS ? "Nästa runda" : "Avsluta match");
    }
    R.ok(new Set(titles).size === ROUNDS, `${tag}: no song repeated within the match`, titles.length !== new Set(titles).size ? titles.join(" ; ") : "");
    R.ok(coverOk === ROUNDS, `${tag}: cover image loaded every round`, `${coverOk}/${ROUNDS}`);

    // Completed: winner + final standings on every phone.
    const top = Math.max(...Object.values(expected));
    const leaders = NAMES.filter((n) => expected[n] === top);
    for (const p of phones) {
      await waitForText(p, /OCH VINNAREN ÄR|Och vinnaren är/i, 20000);
      await wait(900);
      const t = await text(p);
      const hero = t.split(/SLUTPLACERING/i)[0];
      R.ok(NAMES.every((n) => hero.includes(n) === leaders.includes(n)), `${tag}: ${p.name} shows exactly winner(s) ${leaders.join(" & ")}`);
      const s = await readScores(p);
      R.ok(NAMES.every((n) => s[n] === expected[n]), `${tag}: ${p.name} final standings`, JSON.stringify(s));
    }
    await shot(host, `final-host-${mi + 1}`);
    await shot(bo, `final-guest-${mi + 1}`);

    // Play again with the same group → everyone back in the lobby.
    await tap(host, "Spela igen med samma gäng");
    await waitForText(host, /Starta runda/, 20000);
    for (const g of guests) {
      await waitForText(g, /Väntar på värden/, 20000);
      const t = await text(g);
      R.ok(NAMES.every((n) => t.includes(n)), `${tag}: ${g.name} back in lobby with everyone`);
    }
    R.ok(true, `${tag}: all phones back in lobby after play again`);
  }

  // After the last play-again: a fresh match starts at round 1 with 0 points.
  await tap(host, "Hits");
  await tap(host, "Gissa artist");
  await tap(host, "Starta runda");
  for (const p of phones) {
    await waitForText(p, /Runda 1\/10/, 25000);
    const s = await readScores(p);
    R.ok(NAMES.every((n) => s[n] === 0), `new match: ${p.name} at round 1 with 0 points`, JSON.stringify(s));
  }

  summarizePhoneIssues(R.ok, phones);
  failed = R.done();
} catch (e) {
  console.error(e);
  R.ok(false, `crashed: ${e.message}`);
  failed = R.done() || 1;
} finally {
  console.log(`run took ${Math.round((Date.now() - started) / 1000)}s`);
  await browser.close();
}
process.exit(failed ? 1 : 0);
