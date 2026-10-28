// One-phone ("pass the phone") games end to end: Imposter, Trivia, Music Quiz and Mafia
// played on a single phone with no room and no server, through to a winner and "play again".
// Checks secret cards/roles, the rules (wrong vote, tie, doctor save, police check, both
// sides winning), that a reload mid-game continues the game, and that Chicago and MemeMatch
// don't offer the mode. Music Quiz falls back to the bundled song list without a connection.
//
//   node tests/e2e/one-phone.mjs
import fs from "node:fs";
import path from "node:path";
import { ROOT, BASE, launch, phone, tap, waitForText, text, reporter, summarizePhoneIssues, wait } from "../lib.mjs";

const { IMPOSTER_CATEGORIES, imposterWordLabel } = await import("../../src/games/imposter/data.ts");
const ALL_WORDS = IMPOSTER_CATEGORIES.flatMap((c) => c.prompts);

const R = reporter("one-phone");
const ART = path.join(ROOT, "tests", "artifacts", "one-phone");
fs.mkdirSync(ART, { recursive: true });
const shot = (page, name) => page.screenshot({ path: path.join(ART, `${name}.png`) }).catch(() => {});

/** Types into the visible input (screens further back in the stack stay mounted but hidden). */
async function typeVisible(page, value) {
  const handle = await page.evaluateHandle(() => [...document.querySelectorAll("input")].find((el) => el.offsetParent !== null));
  await handle.asElement().click({ clickCount: 3 });
  await handle.asElement().type(value);
}

async function addPlayers(page, names) {
  for (const name of names) {
    await typeVisible(page, name);
    await tap(page, ["Lägg till", "Add"]);
    await wait(150);
  }
}

/** The remove buttons are icons, found by their accessibility label. One tap at a time, like a person. */
async function removePlayers(page, names) {
  for (const name of names) {
    await page.evaluate((label) => document.querySelector(`[aria-label="${label}"]`)?.click(), `Ta bort ${name}`);
    await wait(250);
  }
}

/** Opens the game's entry page and taps the one-phone button. */
async function openLocal(page, entryPath, localPath) {
  await page.goto(`${BASE}${entryPath}`, { waitUntil: "load" });
  await waitForText(page, /Bara en telefon\?|Only one phone\?/);
  await tap(page, ["Spela på en telefon", "Play on one phone"]);
  await page.waitForFunction((l) => location.pathname === l, { timeout: 20000 }, localPath);
  await wait(800);
}

const browser = await launch();
const page = await phone(browser, "phone", { language: "sv" });

try {
  // -------------------------------------------------------------------------
  // Only games that work on one phone offer it
  // -------------------------------------------------------------------------
  for (const entry of ["/chicago", "/picklo"]) {
    await page.goto(`${BASE}${entry}`, { waitUntil: "load" });
    await wait(2500);
    R.ok(!/Bara en telefon\?/.test(await text(page)), `${entry} has no one-phone option`);
  }

  // -------------------------------------------------------------------------
  // Imposter
  // -------------------------------------------------------------------------
  const IMP = ["Anna", "Bo", "Cleo", "Dani"];
  await openLocal(page, "/imposter", "/imposter-local");
  R.ok(/Starta spelet/.test(await text(page)), "imposter: setup screen in Swedish");
  await addPlayers(page, IMP);
  const setupText = await text(page);
  R.ok(IMP.every((n) => setupText.includes(n)), "imposter: players added");
  await tap(page, "Starta spelet");

  async function imposterReveal(names) {
    const cards = {};
    for (let i = 0; i < names.length; i += 1) {
      await waitForText(page, new RegExp(`Ge telefonen till[\\s\\S]*${names[i]}`, "i"));
      const before = await text(page);
      R.ok(!/DU ÄR IMPOSTERN|DITT HEMLIGA ORD/i.test(before), `imposter: nothing secret before ${names[i]} takes the phone`);
      await tap(page, `Jag är ${names[i]}`);
      await waitForText(page, /Dölj och/);
      const t = await text(page);
      if (/DU ÄR IMPOSTERN/.test(t)) cards[names[i]] = "IMPOSTER";
      else cards[names[i]] = ALL_WORDS.find((w) => t.includes(imposterWordLabel(w, "sv").toUpperCase())) ?? "?";
      if (i === 0) await shot(page, "imposter-card");
      await tap(page, i === names.length - 1 ? "Dölj och börja diskutera" : "Dölj och skicka vidare");
    }
    return cards;
  }

  let cards = await imposterReveal(IMP);
  let imposter = Object.keys(cards).find((n) => cards[n] === "IMPOSTER");
  let words = [...new Set(Object.values(cards).filter((c) => c !== "IMPOSTER"))];
  R.ok(Object.values(cards).filter((c) => c === "IMPOSTER").length === 1, "imposter: exactly one imposter", JSON.stringify(cards));
  R.ok(words.length === 1 && words[0] !== "?", "imposter: everyone else has the same word", JSON.stringify(cards));

  await waitForText(page, /Tid kvar/i);
  R.ok(/börjar/.test(await text(page)), "imposter: discussion names who starts");
  await page.reload({ waitUntil: "load" });
  await waitForText(page, /Tid kvar/i);
  R.ok(true, "imposter: reload during the discussion continues the game");

  const crew = IMP.filter((n) => n !== imposter);
  await tap(page, "Dags att rösta");
  await tap(page, crew[0]);
  await tap(page, `Rösta ut ${crew[0]}`);
  await waitForText(page, new RegExp(`${crew[0]} var inte impostern`));
  R.ok(true, "imposter: wrong player out, game continues");
  await tap(page, "Fortsätt diskutera");
  await tap(page, "Dags att rösta");
  R.ok(!(await page.evaluate((n) => [...document.querySelectorAll('[role="radio"]')].some((el) => el.textContent.includes(n)), crew[0])), "imposter: voted-out player can't be voted again");
  await tap(page, "Det blev lika – ingen åker ut");
  await waitForText(page, /Ingen röstades ut/);
  R.ok(true, "imposter: tie keeps the game going");
  await tap(page, "Fortsätt diskutera");
  await tap(page, "Dags att rösta");
  await tap(page, imposter);
  await tap(page, `Rösta ut ${imposter}`);
  await waitForText(page, /LAGET VINNER/);
  R.ok((await text(page)).includes(imposterWordLabel(words[0], "sv")), "imposter: crew wins and the word is shown");
  await shot(page, "imposter-crew-wins");

  // Second game, same players: the imposter survives until only two are left.
  await tap(page, "Spela igen – nytt ord");
  const previousWord = words[0];
  cards = await imposterReveal(IMP);
  imposter = Object.keys(cards).find((n) => cards[n] === "IMPOSTER");
  words = [...new Set(Object.values(cards).filter((c) => c !== "IMPOSTER"))];
  R.ok(words[0] !== previousWord, "imposter: play again gives a new word", `${previousWord} → ${words[0]}`);
  const crew2 = IMP.filter((n) => n !== imposter);
  await tap(page, "Dags att rösta");
  await tap(page, crew2[0]);
  await tap(page, `Rösta ut ${crew2[0]}`);
  await tap(page, "Fortsätt diskutera");
  await tap(page, "Dags att rösta");
  await tap(page, crew2[1]);
  await tap(page, `Rösta ut ${crew2[1]}`);
  await waitForText(page, /IMPOSTERN VINNER/);
  R.ok((await text(page)).includes(imposter), "imposter: imposter wins with two players left");

  // -------------------------------------------------------------------------
  // Trivia
  // -------------------------------------------------------------------------
  await openLocal(page, "/trivia", "/trivia-local");
  R.ok((await text(page)).includes("Anna"), "trivia: last group's names are remembered");
  // The remove buttons are icons, found by their accessibility label.
  await removePlayers(page, ["Bo", "Cleo", "Dani"]);
  await addPlayers(page, ["Eli"]);
  await tap(page, "3");
  await tap(page, "Starta spelet");
  const triviaTurns = [];
  for (let i = 0; i < 6; i += 1) {
    await waitForText(page, new RegExp(`Fråga ${i + 1}/6`));
    const t = await text(page);
    triviaTurns.push((t.match(/(\S+)s tur/) || [])[1]);
    R.ok(!/^Svar$/m.test(t), `trivia: answer hidden before reveal (q${i + 1})`);
    await tap(page, "Visa svaret");
    await waitForText(page, /Rätt \+1/);
    await tap(page, i % 2 === 0 ? "Rätt +1" : "Fel");
  }
  R.ok(triviaTurns.join(",") === "Anna,Eli,Anna,Eli,Anna,Eli", "trivia: turns alternate", triviaTurns.join(","));
  await waitForText(page, /Trivia klar/);
  R.ok(/Vinnare: Anna/.test(await text(page)), "trivia: Anna wins 3–0");
  await shot(page, "trivia-ended");

  // -------------------------------------------------------------------------
  // Music Quiz
  // -------------------------------------------------------------------------
  await openLocal(page, "/music-quiz", "/music-quiz-local");
  await tap(page, "Starta spelet");
  const songs = [];
  for (let round = 1; round <= 10; round += 1) {
    await waitForText(page, new RegExp(`Runda ${round}/10`), 30000);
    if (round === 3) {
      await page.reload({ waitUntil: "load" });
      await waitForText(page, /Runda 3\/10/);
      R.ok(true, "music quiz: reload mid-round continues the game");
    }
    await tap(page, "Spela låten i Spotify");
    await tap(page, "Visa svaret");
    await waitForText(page, /Vem hade rätt/);
    const t = await text(page);
    songs.push((t.match(/Låt\s*\n+([^\n]+)/i) || [])[1]);
    if (round <= 4) await tap(page, "Anna");
    await tap(page, round === 10 ? "Avsluta matchen" : "Nästa runda");
  }
  await waitForText(page, /Matchen är klar/);
  R.ok(new Set(songs).size === 10, "music quiz: 10 different songs", songs.join(" | "));
  R.ok(/Vinnare: Anna/.test(await text(page)), "music quiz: Anna wins with 4 points");
  await shot(page, "music-quiz-ended");

  // -------------------------------------------------------------------------
  // Mafia
  // -------------------------------------------------------------------------
  const ROLE_SV = { MAFFIA: "mafia", DOKTOR: "doctor", POLIS: "police", BYBO: "villager" };

  async function mafiaReveal(names) {
    const roles = {};
    for (let i = 0; i < names.length; i += 1) {
      await waitForText(page, new RegExp(`Ge telefonen till[\\s\\S]*${names[i]}`, "i"));
      await tap(page, `Jag är ${names[i]}`);
      await waitForText(page, /Din roll/i);
      const t = await text(page);
      roles[names[i]] = ROLE_SV[Object.keys(ROLE_SV).find((k) => new RegExp(`\\n${k}\\n`).test(t))];
      await tap(page, i === names.length - 1 ? "Dölj – alla har sett sin roll" : "Dölj och skicka vidare");
    }
    return roles;
  }

  /** One night; `pick(name, role)` returns the target for each living player. */
  async function mafiaNight(alive, roles, pick) {
    await tap(page, "Starta natten");
    let policeSaw = null;
    for (const name of alive) {
      await waitForText(page, new RegExp(`Ge telefonen till[\\s\\S]*${name}`, "i"));
      await tap(page, `Jag är ${name}`);
      await waitForText(page, /Välj en spelare/);
      const target = pick(name, roles[name]);
      await tap(page, target);
      await tap(page, `Bekräfta ${target}`);
      if (roles[name] === "police") {
        await waitForText(page, /maffia/);
        policeSaw = await text(page);
        await tap(page, "Dölj och skicka vidare");
      }
    }
    return policeSaw;
  }

  let MAF = ["Anna", "Bo", "Cleo", "Dani", "Eli"];
  await openLocal(page, "/mafia", "/mafia-local");
  await removePlayers(page, ["Eli"]);
  await addPlayers(page, ["Bo", "Cleo", "Dani", "Eli"]);
  await tap(page, "Starta spelet");
  let roles = await mafiaReveal(MAF);
  const who = (role) => MAF.filter((n) => roles[n] === role);
  R.ok(who("mafia").length === 1 && who("doctor").length === 1 && who("police").length === 1 && who("villager").length === 2, "mafia: 5 players get 1 mafia, doctor, police, 2 villagers", JSON.stringify(roles));
  const [mafia] = who("mafia");
  const [doctor] = who("doctor");
  const [police] = who("police");
  const [v1, v2] = who("villager");

  // Night 1: mafia attacks v1, doctor saves v1, police checks the mafia.
  let saw = await mafiaNight(MAF, roles, (name, role) =>
    role === "mafia" ? v1 : role === "doctor" ? v1 : role === "police" ? mafia : MAF.find((n) => n !== name)
  );
  R.ok(new RegExp(`${mafia} ÄR maffia`).test(saw || ""), "mafia: police sees the mafia");
  await waitForText(page, /Morgon/i);
  R.ok(new RegExp(`${v1} attackerades under natten, men doktorn räddade hen`).test(await text(page)), "mafia: doctor save announced");
  await tap(page, "Starta dagen");
  await waitForText(page, /Tid kvar/i);
  await tap(page, "Dags att rösta");
  await tap(page, v2);
  await tap(page, `Rösta ut ${v2}`);
  await waitForText(page, new RegExp(`${v2} röstades ut`));
  await tap(page, "Fortsätt till nästa natt");

  // Night 2: mafia kills the doctor, then the village votes out the mafia.
  MAF = MAF.filter((n) => n !== v2);
  await page.reload({ waitUntil: "load" });
  await waitForText(page, /Natt 2/);
  R.ok(true, "mafia: reload between phases continues the game");
  saw = await mafiaNight(MAF, roles, (name, role) =>
    role === "mafia" ? doctor : role === "doctor" ? v1 : role === "police" ? v1 : MAF.find((n) => n !== name)
  );
  R.ok(new RegExp(`${v1} är INTE maffia`).test(saw || ""), "mafia: police sees a villager is not mafia");
  await waitForText(page, new RegExp(`${doctor} dog under natten`));
  await tap(page, "Starta dagen");
  await tap(page, "Dags att rösta");
  await tap(page, mafia);
  await tap(page, `Rösta ut ${mafia}`);
  await waitForText(page, /BYN VINNER/);
  R.ok(/Allas roller/i.test(await text(page)), "mafia: village wins and every role is shown");
  await shot(page, "mafia-village-wins");

  // Mafia wins: 4 players, the mafia picks off two villagers while the doctor guards themselves.
  await tap(page, "Byt spelare");
  await removePlayers(page, ["Eli"]);
  MAF = ["Anna", "Bo", "Cleo", "Dani"];
  await tap(page, "Starta spelet");
  roles = await mafiaReveal(MAF);
  const m = MAF.find((n) => roles[n] === "mafia");
  const doc = MAF.find((n) => roles[n] === "doctor");
  const victims = MAF.filter((n) => n !== m && n !== doc);
  saw = await mafiaNight(MAF, roles, (name, role) =>
    role === "mafia" ? victims[0] : role === "doctor" ? doc : MAF.find((n) => n !== name)
  );
  await waitForText(page, new RegExp(`${victims[0]} dog under natten`));
  await tap(page, "Starta dagen");
  await tap(page, "Dags att rösta");
  await tap(page, "Det blev lika – ingen åker ut");
  await tap(page, "Fortsätt till nästa natt");
  const alive2 = MAF.filter((n) => n !== victims[0]);
  await mafiaNight(alive2, roles, (name, role) => (role === "mafia" ? victims[1] : role === "doctor" ? doc : alive2.find((n) => n !== name)));
  await waitForText(page, /MAFFIAN VINNER/);
  R.ok(true, "mafia: mafia wins when they equal the village");
  await shot(page, "mafia-mafia-wins");

  // -------------------------------------------------------------------------
  // English UI
  // -------------------------------------------------------------------------
  const en = await phone(browser, "english-phone", { language: "en" });
  await en.goto(`${BASE}/imposter`, { waitUntil: "load" });
  await waitForText(en, /Only one phone\?/);
  await tap(en, "Play on one phone");
  await waitForText(en, /One phone, passed around/);
  R.ok(!/Spelare|Starta/.test(await text(en)), "english: one-phone setup has no Swedish text");
  summarizePhoneIssues(R.ok, [page, en]);
} catch (error) {
  R.ok(false, "test ran to the end", String(error?.message ?? error));
  await shot(page, "failure");
} finally {
  await browser.close();
}

process.exit(R.done() ? 1 : 0);
