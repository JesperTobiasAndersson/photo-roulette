// Trivia end to end: 3 phones play two full games (Swedish, then English after
// "play again with the same group"), plus a late joiner who must be refused.
//
//   node tests/e2e/trivia.mjs
import fs from "node:fs";
import path from "node:path";
import { ROOT, BASE, launch, phone, tap, waitForText, text, typeInto, createRoom, joinRoom, reporter, summarizePhoneIssues, wait } from "../lib.mjs";

const { TRIVIA_QUESTIONS } = await import("../../src/games/trivia/data.ts");

const R = reporter("trivia");
const ART = path.join(ROOT, "tests", "artifacts", "trivia");
fs.mkdirSync(ART, { recursive: true });
const shot = (page, name) => page.screenshot({ path: path.join(ART, `${name}.png`) }).catch(() => {});
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const NAMES = ["E2E Anna", "E2E Bosse", "E2E Cilla"];
const PER_PLAYER = 6;
const TOTAL = PER_PLAYER * NAMES.length;

/** "Name (Du)\n3 rätt\n3p" → { name: {score, correct} } */
async function readScores(page, lang) {
  const t = await text(page);
  const out = {};
  const you = lang === "sv" ? "Du" : "You";
  const right = lang === "sv" ? "rätt" : "correct";
  for (const n of NAMES) {
    const m = t.match(new RegExp(`${esc(n)}(?: \\(${you}\\))?\\n(\\d+) ${right}\\n(?:[^\\n\\d]*\\n)?(\\d+)p`));
    out[n] = m ? { score: Number(m[2]), correct: Number(m[1]) } : null;
  }
  return out;
}

async function expectScores(page, lang, expected, label, timeout = 12000) {
  const start = Date.now();
  let s;
  const match = () => NAMES.every((n) => s[n] && s[n].score === expected[n] && s[n].correct === expected[n]);
  while (Date.now() - start < timeout) {
    s = await readScores(page, lang);
    if (match()) break;
    await wait(500);
  }
  return R.ok(match(), label, JSON.stringify(s));
}

/**
 * Play one full game. `correctUpTo[i]` = player i answers their first N questions right.
 * lang: phone language (labels + expected question language).
 */
async function playGame(phones, lang, category, correctUpTo, tag) {
  const [host] = phones;
  const L =
    lang === "sv"
      ? { start: "Starta Trivia", reveal: "Visa svar", right: "Rätt", wrong: "Fel", q: "Fråga", answering: "Svarar", answerCap: "SVAR", yourTurn: "Din tur! Svara högt", final: "Slutresultat" }
      : { start: "Start Trivia", reveal: "Show answer", right: "Correct", wrong: "Wrong", q: "Question", answering: "Answering", answerCap: "ANSWER", yourTurn: "Your turn! Answer out loud", final: "Final results" };
  const catLabel = category[lang];
  const questions = TRIVIA_QUESTIONS.filter((q) => q.category === category.sv);
  const prompts = new Set(questions.map((q) => (lang === "sv" ? q.prompt : q.promptEn)));

  await tap(host, catLabel);
  await waitForText(host, new RegExp(`: ${esc(catLabel)}`));
  await tap(host, L.start);

  const expected = Object.fromEntries(NAMES.map((n) => [n, 0]));
  let promptsOk = 0;
  let answersOk = 0;
  for (let turn = 1; turn <= TOTAL; turn++) {
    const idx = (turn - 1) % NAMES.length;
    const qnum = Math.ceil(turn / NAMES.length);
    const active = NAMES[idx];
    const counter = new RegExp(`${L.q} ${turn}/${TOTAL}`);
    for (const p of phones) await waitForText(p, counter, 20000);
    // Everyone sees who answers, the per-player counter and the category in the right language.
    for (const p of phones) {
      const t = await text(p);
      const okActive = new RegExp(`${L.answering}: ${esc(active)}`).test(t) && t.includes(`${qnum}/${PER_PLAYER}`);
      if (!okActive || turn === 1) R.ok(okActive, `${tag} turn ${turn}: ${p.name} shows ${active} answering (${qnum}/${PER_PLAYER})`);
      if (turn === 1) R.ok(t.includes(catLabel.toUpperCase()), `${tag}: ${p.name} category chip in ${lang}`);
    }
    // The active phone gets the "your turn" prompt (host has its own banner).
    if (idx !== 0) {
      const t = await text(phones[idx]);
      if (!t.includes(L.yourTurn)) R.ok(false, `${tag} turn ${turn}: ${active} sees "${L.yourTurn}"`);
    }
    const ht = await text(host);
    if ([...prompts].some((pr) => ht.includes(pr))) promptsOk++;
    if (turn === 1) await shot(phones[1], `${tag}-question-guest`);

    await tap(host, L.reveal);
    for (const p of phones) await waitForText(p, new RegExp(`\\n${L.answerCap}\\n`), 15000);
    const rt = await text(phones[2]);
    const q = questions.find((x) => rt.includes(lang === "sv" ? x.prompt : x.promptEn));
    if (q && rt.includes(lang === "sv" ? q.answer : q.answerEn)) answersOk++;
    if (turn === 1) await shot(host, `${tag}-reveal-host`);

    const correct = qnum <= correctUpTo[idx];
    if (correct) expected[active] += 1;
    await tap(host, correct ? L.right : L.wrong);
    if (turn < TOTAL) {
      await waitForText(host, new RegExp(`${L.q} ${turn + 1}/${TOTAL}`), 20000);
      if (turn % 6 === 0) await expectScores(phones[turn % 3], lang, expected, `${tag} after turn ${turn}: ${phones[turn % 3].name} scores/correct`);
    }
  }
  R.ok(promptsOk === TOTAL, `${tag}: every question shown in ${lang} from category ${catLabel}`, `${promptsOk}/${TOTAL}`);
  R.ok(answersOk === TOTAL, `${tag}: every revealed answer in ${lang}`, `${answersOk}/${TOTAL}`);

  const top = Math.max(...Object.values(expected));
  const winners = NAMES.filter((n) => expected[n] === top);
  const losers = NAMES.filter((n) => expected[n] !== top);
  for (const p of phones) {
    await waitForText(p, new RegExp(L.final, "i"), 20000);
    await wait(800);
    const t = await text(p);
    const hero = t.split(new RegExp(lang === "sv" ? "POÄNGTAVLA|Poängtavla" : "SCOREBOARD|Scoreboard"))[0];
    R.ok(winners.every((n) => hero.includes(n)) && losers.every((n) => !hero.includes(n)), `${tag}: ${p.name} winner area shows exactly ${winners.join(" & ")}`);
    await expectScores(p, lang, expected, `${tag}: ${p.name} final scores + correct answers`);
  }
  await shot(host, `${tag}-final-host`);
  await shot(phones[1], `${tag}-final-guest`);
  return expected;
}

const started = Date.now();
const browser = await launch();
let failed = 1;
try {
  const phones = await Promise.all(NAMES.map((n) => phone(browser, n)));
  const [host, bo, ci] = phones;
  const code = await createRoom(host, "/trivia", "/trivia-room", NAMES[0]);
  R.ok(!!code, "host created a room", code);
  await joinRoom(bo, "/trivia", "/trivia-room", code, NAMES[1]);
  await joinRoom(ci, "/trivia", "/trivia-room", code, NAMES[2]);
  for (const p of phones) {
    await waitForText(p, new RegExp(NAMES.map(esc).join("[\\s\\S]*")), 20000).catch(() => {});
    const t = await text(p);
    R.ok(NAMES.every((n) => t.includes(n)), `${p.name}: lobby lists all 3 players`);
    if (p !== host) R.ok(!/Waiting for the host/.test(t), `${p.name}: lobby text is Swedish`);
  }
  await shot(bo, "lobby-guest");

  // Late joiner, tried right after the host starts (inside playGame we can't; so start
  // the game via a wrapper: kick off the game, then attempt the join during turn 1).
  const late = await phone(browser, "E2E Sen");
  const lateJoin = (async () => {
    await waitForText(host, /Fråga 1\/18/, 60000);
    await late.goto(`${BASE}/trivia?code=${code}`, { waitUntil: "load" });
    await wait(1200);
    await typeInto(late, 0, "E2E Sen");
    await tap(late, ["Gå med", "Join room"]);
    await wait(5000);
    const onRoom = await late.evaluate(() => location.pathname.includes("trivia-room"));
    const t = await text(late);
    R.ok(!onRoom && /redan börjat|already started/i.test(t), "late joiner is refused once the game started", onRoom ? "joined!" : "");
    await shot(late, "late-joiner");
  })();

  // Game 1 (Swedish): Anna and Bosse tie on 4, Cilla 2.
  await playGame(phones, "sv", { sv: "Geografi", en: "Geography" }, [4, 4, 2], "sv");
  await lateJoin;

  // Play again → everyone in the lobby.
  await tap(host, "Spela igen med samma gäng");
  await waitForText(host, /Starta Trivia/, 20000);
  for (const p of [bo, ci]) await waitForText(p, /Väntar på värden/, 20000);
  R.ok(true, "sv: all phones back in lobby after play again");

  // Switch every phone to English and reload (rooms survive a reload).
  for (const p of phones) {
    // lib's phone() re-sets "sv" on every load; a later init script wins.
    await p.evaluateOnNewDocument(() => {
      try { localStorage.setItem("picklo_language", "en"); } catch {}
    });
    await p.reload({ waitUntil: "load" });
  }
  await waitForText(host, /Start Trivia/, 30000);
  for (const p of [bo, ci]) {
    await waitForText(p, /Waiting for the host/, 30000);
    const t = await text(p);
    R.ok(NAMES.every((n) => t.includes(n)), `${p.name}: still in the lobby with everyone after reload`);
  }

  // Game 2 (English): Cilla wins alone (5), Anna 3, Bosse 1. Scores must start from 0.
  const g2 = playGame(phones, "en", { sv: "Historia", en: "History" }, [3, 1, 5], "en");
  await waitForText(bo, /Question 1\/18/, 30000);
  await expectScores(bo, "en", Object.fromEntries(NAMES.map((n) => [n, 0])), "en: new game starts with 0 points / 0 correct");
  await g2;

  await tap(host, "Play again with the same group");
  await waitForText(host, /Start Trivia/, 20000);
  for (const p of [bo, ci]) await waitForText(p, /Waiting for the host/, 20000);
  R.ok(true, "en: all phones back in lobby after play again");

  summarizePhoneIssues(R.ok, [...phones, late]);
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
