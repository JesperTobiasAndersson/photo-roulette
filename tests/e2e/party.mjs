// Most Likely and Closest Wins end to end: 3 phones each (Swedish UI) play a full 5-round game
// through room codes: secret votes / guesses, automatic reveal when everyone has answered,
// the host revealing early, scoring (majority vote = 1 point and a title; closest guesses
// 3/2/1), the final results and "play again with the same group".
//
//   node tests/e2e/party.mjs
import fs from "node:fs";
import path from "node:path";
import { ROOT, createRoom, joinRoom, launch, phone, reporter, summarizePhoneIssues, tap, text, waitForText } from "../lib.mjs";

const { ESTIMATE_QUESTIONS } = await import("../../src/games/estimate/data.ts");
const BY_SV = new Map(ESTIMATE_QUESTIONS.map((q) => [q.sv, q]));

const R = reporter("party");
const ART = path.join(ROOT, "tests", "artifacts", "party");
fs.mkdirSync(ART, { recursive: true });
const shot = (page, name) => page.screenshot({ path: path.join(ART, `${name}.png`) }).catch(() => {});

/** Type into the visible input (screens further back in the stack stay mounted but hidden). */
async function typeVisible(page, value) {
  const handle = await page.evaluateHandle(() => [...document.querySelectorAll("input")].find((el) => el.offsetParent !== null));
  await handle.asElement().click({ clickCount: 3 });
  await handle.asElement().type(value);
}

async function setUp(browser, entry, names) {
  const phones = [];
  for (const name of names) phones.push(await phone(browser, name));
  const code = await createRoom(phones[0], entry, "/party-room", names[0]);
  R.ok(/^[A-Z2-9]{4}$/.test(code ?? ""), `${entry}: room created (${code})`);
  for (const p of phones.slice(1)) await joinRoom(p, entry, "/party-room", code, p.name);
  await Promise.all(phones.map((p) => waitForText(p, new RegExp(names[names.length - 1]))));
  R.ok(true, `${entry}: all ${phones.length} phones see each other in the lobby`);
  return { phones, host: phones[0], code };
}

async function startGame(G, rounds) {
  await tap(G.host, rounds);
  await tap(G.host, "Starta spelet");
  await Promise.all(G.phones.map((p) => waitForText(p, new RegExp(`Runda 1/${rounds}`))));
}

const browser = await launch();
const all = [];
try {
  // -------------------------------------------------------------------------
  // Most Likely
  // -------------------------------------------------------------------------
  {
    const names = ["E2E Ada", "E2E Bea", "E2E Cid"];
    const G = await setUp(browser, "/most-likely", names);
    all.push(...G.phones);
    const [A, B, C] = G.phones;
    await startGame(G, "5");
    await shot(A, "ml-question");
    for (let round = 1; round <= 5; round++) {
      await Promise.all(G.phones.map((p) => waitForText(p, new RegExp(`Runda ${round}/5`))));
      R.ok(/Vem är mest trolig att/i.test(await text(A)), `most likely r${round}: statement shown in Swedish`);
      if (round === 3) {
        // The host shows the result before Cid has voted.
        await tap(A, names[2]);
        await tap(A, "Skicka svar");
        await tap(A, "Visa resultatet nu");
      } else {
        // Ada and Bea vote for Cid, Cid votes for Ada: Ada and Bea score, Cid gets the title.
        for (const [p, target] of [[A, names[2]], [B, names[2]], [C, names[0]]]) {
          await tap(p, target);
          await tap(p, "Skicka svar");
          if (p !== C) await waitForText(p, /Svaret är skickat/);
        }
      }
      await Promise.all(G.phones.map((p) => waitForText(p, /Gruppen valde|Ingen röstade/i)));
      if (round === 1) {
        R.ok(/Du fick \+1/.test(await text(A)) && /Du fick \+1/.test(await text(B)) && /Inga poäng/.test(await text(C)), "most likely: voting with the majority scores");
        await shot(B, "ml-reveal");
      }
      R.ok(/Väntar på att värden/.test(await text(B)), `most likely r${round}: guests wait for the host`);
      await tap(A, round === 5 ? "Visa resultatet" : "Nästa runda");
    }
    await Promise.all(G.phones.map((p) => waitForText(p, /Spelet är slut/)));
    const end = await text(B);
    // Round 3 was revealed with only Ada's vote (for Cid), so Ada scored once more than Bea.
    R.ok(/Vinnare: E2E Ada(?!,)/.test(end), "most likely: Ada wins 5–4 (the early reveal counted only her vote)", end.slice(0, 120));
    R.ok(/Flest titlar[\s\S]*E2E Cid[\s\S]*5 titlar/i.test(end), "most likely: Cid collected all 5 titles");
    await shot(A, "ml-ended");
    await tap(A, "Spela igen med samma gäng");
    await Promise.all(G.phones.map((p) => waitForText(p, /Rumskod/i)));
    R.ok(true, "most likely: play again brings every phone back to the lobby");
  }

  // -------------------------------------------------------------------------
  // Closest Wins
  // -------------------------------------------------------------------------
  {
    const names = ["E2E Dag", "E2E Eva", "E2E Fil"];
    const G = await setUp(browser, "/closest-wins", names);
    all.push(...G.phones);
    const [A, B, C] = G.phones;
    await startGame(G, "5");
    for (let round = 1; round <= 5; round++) {
      await Promise.all(G.phones.map((p) => waitForText(p, new RegExp(`Runda ${round}/5`))));
      const shown = await text(A);
      const question = [...BY_SV.values()].find((q) => shown.includes(q.sv));
      R.ok(!!question, `closest wins r${round}: a known question is shown`, shown.slice(0, 160));
      if (!question) break;
      // Dag guesses exactly, Eva is 10 off, Fil 25 off: 3, 2 and 1 points.
      for (const [p, guess] of [[A, question.answer], [B, question.answer + 10], [C, question.answer - 25]]) {
        await typeVisible(p, String(guess).replace(".", ","));
        await tap(p, "Skicka svar");
      }
      await Promise.all(G.phones.map((p) => waitForText(p, /Rätt svar/i)));
      const reveal = await text(B);
      R.ok(/exakt rätt/.test(reveal) && /\+3/.test(reveal) && /\+2/.test(reveal) && /\+1/.test(reveal), `closest wins r${round}: 3/2/1 points for the closest guesses`);
      if (round === 1) await shot(B, "cw-reveal");
      await tap(A, round === 5 ? "Visa resultatet" : "Nästa runda");
    }
    await Promise.all(G.phones.map((p) => waitForText(p, /Spelet är slut/)));
    R.ok(/Vinnare: E2E Dag/.test(await text(C)), "closest wins: the exact guesser wins");
    await shot(C, "cw-ended");
  }

  summarizePhoneIssues(R.ok, all);
} catch (error) {
  R.ok(false, "test ran to the end", String(error?.message ?? error));
  for (const p of all) await shot(p, `failure-${p.name}`);
} finally {
  await browser.close();
}

process.exit(R.done() ? 1 : 0);
