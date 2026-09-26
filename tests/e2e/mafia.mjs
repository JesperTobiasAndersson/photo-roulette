// End-to-end test for Mafia: real phones (browser contexts) play full games.
//
//   node tests/e2e/mafia.mjs            (both scenarios)
//   SCENARIO=a node tests/e2e/mafia.mjs (5 players only)   SCENARIO=b (8 players only)
//
// Scenario A (5 players)
//   Game 1: doctor saves the mafia's target, police finds the mafia, night result
//           auto-advances, a phone reloads mid-discussion, the town votes out the mafia -> village wins.
//   Game 2: roles re-dealt, a villager dies, discussion timer expires (host clock pushed forward),
//           dead player can't act/vote, a villager is voted out, mafia kills at night -> mafia wins.
// Scenario B (8 players, 2 mafia)
//   Game 1: kill, vote out mafia #1, doctor save, vote out mafia #2 -> village wins.
//   Game 2: play again, roles re-dealt, both phases reached.
import fs from "node:fs";
import path from "node:path";
import {
  ROOT,
  launch,
  phone,
  tap,
  tryTap,
  wait,
  waitForText,
  text,
  createRoom,
  joinRoom,
  reporter,
  summarizePhoneIssues,
} from "../lib.mjs";

const ENTRY = "/mafia";
const LOBBY = "/mafia-lobby";
const RESULTS = "/mafia-results";
const SHOTS = path.join(ROOT, "tests", "artifacts", "mafia");
fs.rmSync(SHOTS, { recursive: true, force: true });
fs.mkdirSync(SHOTS, { recursive: true });

const { ok, done } = reporter("mafia");
const ROLE_SV = { Mafia: "mafia", Doktor: "doctor", Polis: "police", Bybo: "villager" };
const CHIP_SV = { MAFIA: "mafia", DOKTOR: "doctor", POLIS: "police", BYBO: "villager" };
const PHASES = ["Lobby", "Rollutdelning", "Natt", "Nattens resultat", "Dagdiskussion", "Dagröstning", "Röstresultat", "Spelet är slut"];
const ENGLISH_LEAKS = /\b(Waiting for|Continue|Vote for|Night actions|Tap to reveal|Your role|Players|Locked in|Confirm choice|Ready to vote|Village wins|Mafia wins)\b/;
const T0 = Date.now();
const log = (...a) => console.log(`[${((Date.now() - T0) / 1000).toFixed(0)}s]`, ...a);

let shotN = 0;
async function shot(page, label) {
  try {
    await page.screenshot({ path: path.join(SHOTS, `${String(++shotN).padStart(2, "0")}-${label}.png`) });
  } catch {}
}

// ---------------------------------------------------------------------------
// Page helpers
// ---------------------------------------------------------------------------
async function phaseOf(page) {
  return page.evaluate((PHASES) => {
    const hs = [...document.querySelectorAll('[role="heading"]')].map((h) => h.textContent.trim());
    return hs.find((h) => PHASES.includes(h)) ?? null;
  }, PHASES);
}

async function waitPhase(page, phase, timeout = 30000) {
  const start = Date.now();
  let last = null;
  while (Date.now() - start < timeout) {
    last = await phaseOf(page).catch(() => null);
    if (last === phase) return true;
    await wait(300);
  }
  throw new Error(`${page.name}: expected phase "${phase}", still "${last}"`);
}

const allPhase = (pages, phase, timeout) => Promise.all(pages.map((p) => waitPhase(p, phase, timeout)));

/** Player rows you can pick (night targets, votes). */
async function radios(page) {
  return page.evaluate(() =>
    [...document.querySelectorAll('[role="radio"]')]
      .filter((el) => el.offsetParent !== null)
      .map((el) => ({ text: el.textContent.trim(), disabled: el.getAttribute("aria-disabled") === "true" }))
  );
}

async function tapRadio(page, name, timeout = 10000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const clicked = await page.evaluate((name) => {
      const el = [...document.querySelectorAll('[role="radio"]')].find((r) => {
        const labelled = [...r.querySelectorAll("div")].some((d) => {
          const t = d.textContent.trim();
          return t === name || t.startsWith(name + " (");
        });
        return r.offsetParent !== null && labelled && r.getAttribute("aria-disabled") !== "true";
      });
      if (!el) return false;
      el.click();
      return true;
    }, name);
    if (clicked) return;
    await wait(300);
  }
  throw new Error(`${page.name}: no enabled row for ${name}`);
}

/** Tap the secret identity card, read the role, hide it again. */
async function readRole(page) {
  const clickCard = (label) =>
    page.evaluate((label) => {
      const el = [...document.querySelectorAll('[role="button"]')].find((b) => b.getAttribute("aria-label") === label);
      if (!el) return false;
      el.click();
      return true;
    }, label);
  const start = Date.now();
  while (Date.now() - start < 15000) {
    if (await clickCard("Tryck för att visa. Dölj skärmen för de andra.")) break;
    await wait(300);
  }
  let role = null;
  let body = "";
  for (let i = 0; i < 20 && !role; i++) {
    await wait(250);
    body = await text(page);
    const m = body.match(/DIN ROLL\s*\n\s*(Mafia|Doktor|Polis|Bybo)\b/i);
    if (m) role = ROLE_SV[m[1][0].toUpperCase() + m[1].slice(1).toLowerCase()];
  }
  const report = /Du valde en maffiaspelare/.test(body) ? "mafia" : /Du valde en bybo/.test(body) ? "village" : null;
  await clickCard("Tryck för att dölja");
  return { role, report };
}

/**
 * Tap a button and wait for its effect. A button that has only just appeared can still be
 * in its loading state (ignores taps) for a moment, like a real impatient tap; tap again.
 */
async function confirmTap(page, labels, effect, tries = 4) {
  for (let i = 0; i < tries; i++) {
    await tap(page, labels, { timeout: 15000 }).catch((e) => {
      if (i === tries - 1) throw e;
    });
    try {
      await waitForText(page, effect, 8000);
      if (i > 0) console.log(`  note: ${page.name} needed ${i + 1} taps on ${labels[0]}`);
      return;
    } catch {
      if (process.env.DEBUG) console.log(`  debug ${page.name} after tap ${i + 1}:`, JSON.stringify(await footerButtons(page)), page.dialogs);
    }
  }
  throw new Error(`${page.name}: tapping ${labels[0]} had no effect`);
}

async function footerButtons(page) {
  return page.evaluate(() =>
    [...document.querySelectorAll('[role="button"]')]
      .filter((b) => b.offsetParent !== null)
      .map((b) => ({ text: b.textContent.replace(/[-]/g, "").trim(), disabled: b.getAttribute("aria-disabled") === "true" }))
  );
}

async function checkNoEnglish(page, where) {
  const t = await text(page);
  const m = t.match(ENGLISH_LEAKS);
  ok(!m, `${page.name}: no English text on Swedish phone (${where})`, m ? `found "${m[0]}"` : "");
}

// ---------------------------------------------------------------------------
// Game driver
// ---------------------------------------------------------------------------
class Table {
  constructor(pages) {
    this.pages = pages; // pages[0] = host
    this.byName = Object.fromEntries(pages.map((p) => [p.name, p]));
    this.roles = {};
    this.alive = new Set(pages.map((p) => p.name));
  }
  get host() {
    return this.pages[0];
  }
  names(role, { alive = true } = {}) {
    return Object.keys(this.roles).filter((n) => this.roles[n] === role && (!alive || this.alive.has(n)));
  }
  alivePages() {
    return this.pages.filter((p) => this.alive.has(p.name));
  }
  deadPages() {
    return this.pages.filter((p) => !this.alive.has(p.name));
  }
  winner() {
    const alive = [...this.alive];
    const m = alive.filter((n) => this.roles[n] === "mafia").length;
    if (m === 0) return "village";
    if (m >= alive.length - m) return "mafia";
    return null;
  }

  async startAndReveal(label) {
    const n = this.pages.length;
    this.alive = new Set(this.pages.map((p) => p.name));
    await tap(this.host, ["Starta spelet", "Start the game"]);
    await allPhase(this.pages, "Rollutdelning");
    // Every phone reveals privately.
    const reveals = await Promise.all(this.pages.map((p) => readRole(p)));
    this.pages.forEach((p, i) => (this.roles[p.name] = reveals[i].role));
    log("roles", JSON.stringify(this.roles));
    ok(reveals.every((r) => r.role), `${label}: every phone shows its role after tapping reveal`);
    const count = (r) => Object.values(this.roles).filter((x) => x === r).length;
    const mafia = n >= 7 ? 2 : 1;
    ok(count("mafia") === mafia && count("doctor") === 1 && count("police") === 1 && count("villager") === n - mafia - 2,
      `${label}: role split for ${n} players is ${mafia} mafia / 1 doctor / 1 police / ${n - mafia - 2} villagers`,
      JSON.stringify(this.roles));
    await shot(this.pages[1], `${label}-role-reveal`);
    await Promise.all(this.pages.map((p) => confirmTap(p, ["Jag har sett min roll", "I saw my role"], /^Redo$|Natt/m)));
    await allPhase(this.pages, "Natt");
    ok(true, `${label}: all phones confirmed their role and the night started`);
  }

  /** Mafia -> kill, doctor -> save, police -> investigate; villagers finish notes; everyone continues. */
  async night(label, { kill, save, investigate, idle = null }) {
    await allPhase(this.pages, "Natt");
    const alive = this.alivePages();
    // Dead players can't act at night.
    for (const p of this.deadPages()) {
      const rs = await radios(p);
      const btns = await footerButtons(p);
      ok(
        !this.roles[p.name] || this.roles[p.name] === "villager" || rs.every((r) => r.disabled),
        `${label}: dead ${p.name} cannot pick a night target`
      );
      ok(!btns.some((b) => /Bekräfta val|Klar med nattens anteckningar|^Fortsätt$/.test(b.text) && !b.disabled),
        `${label}: dead ${p.name} has no night action button`, JSON.stringify(btns.map((b) => b.text)));
    }
    const act = async (p) => {
      const role = this.roles[p.name];
      if (role === "villager") {
        // Villager: tag someone privately, then finish notes.
        const other = alive.find((q) => q !== p);
        await tapRadio(p, other.name);
        await tryTap(p, ["MISSTÄNKT"]);
        await confirmTap(p, ["Klar med nattens anteckningar", "Finish night notes"], /^Redo$|Nattens val är låsta/m);
        return;
      }
      const target = role === "mafia" ? kill : role === "doctor" ? save : investigate;
      await tapRadio(p, target);
      await confirmTap(p, [`Bekräfta val: ${target}`], new RegExp(`Bekräftat: ${target}|Nattens val är låsta`));
    };
    await Promise.all(alive.filter((p) => p.name !== idle).map(act));
    // Mafia coordination is visible to mafia only.
    const mafiaPage = this.byName[this.names("mafia")[0]];
    if (mafiaPage) ok(/Maffians samordning/i.test(await text(mafiaPage)), `${label}: mafia sees the coordination card`);
    const villagerPage = alive.find((p) => this.roles[p.name] !== "mafia");
    ok(!/Maffians samordning/i.test(await text(villagerPage)), `${label}: non-mafia ${villagerPage.name} does not see mafia coordination`);
    if (idle) {
      // One phone never acts. The night must not hang: once the timer runs out the host can resolve.
      await wait(1500);
      const before = await footerButtons(this.host);
      const early = before.find((b) => b.text === "Avsluta natten");
      ok(!early || early.disabled, `${label}: host can't resolve the night early while ${idle} is still choosing`);
      await skewClock(this.host, 46000);
      await waitForText(this.host, /0:00/, 5000);
      const after = (await footerButtons(this.host)).find((b) => b.text === "Avsluta natten");
      ok(after && !after.disabled, `${label}: night timer ran out -> host gets an enabled "Avsluta natten"`);
      await shot(this.host, `${label}-night-timeout`);
      await confirmTap(this.host, ["Avsluta natten"], /Nattens resultat|VINNER/);
      await skewClock(this.host, 0);
    } else {
      await Promise.all(alive.map((p) => waitForText(p, /Nattens val är låsta/, 20000)));
      await shot(alive[0], `${label}-night-locked`);
      await Promise.all(alive.map((p) => confirmTap(p, ["Fortsätt", "Continue"], /Fortsätt tryckt|Nattens resultat|Dagdiskussion|VINNER/)));
    }

    const died = kill && kill !== save ? kill : null;
    if (died) this.alive.delete(died);
    const winner = this.winner();
    if (winner) return { died, winner };

    await allPhase(this.pages, "Nattens resultat", 30000);
    const expected = died
      ? new RegExp(`${died} dog under natten\\.`)
      : new RegExp(`${kill} attackerades under natten, men doktorn räddade hen\\.`);
    const seen = await Promise.all(this.pages.map(async (p) => expected.test(await text(p))));
    ok(seen.every(Boolean), `${label}: every phone shows the night result (${died ? `${died} died` : `${kill} saved`})`,
      this.pages.filter((_, i) => !seen[i]).map((p) => p.name).join(","));
    await shot(this.pages[0], `${label}-night-result`);
    return { died, winner: null };
  }

  async policeReport(label, expected) {
    const police = this.names("police")[0];
    if (!police) return;
    const { report } = await readRole(this.byName[police]);
    ok(report === expected, `${label}: police sees private report "${expected}"`, `got ${report}`);
    for (const p of this.pages.filter((q) => q.name !== police)) {
      if (/Senaste polisrapporten/.test(await text(p))) ok(false, `${label}: ${p.name} must not see the police report`);
    }
  }

  async discussionAllReady(label) {
    await allPhase(this.pages, "Dagdiskussion", 30000);
    for (const p of this.deadPages()) {
      const btns = await footerButtons(p);
      ok(!btns.some((b) => b.text.startsWith("Redo att rösta")), `${label}: dead ${p.name} has no "ready to vote" button`);
    }
    await Promise.all(this.alivePages().map((p) => confirmTap(p, ["Redo att rösta", "Ready to vote"], /Redo att rösta ✓|Dagröstning/)));
    await allPhase(this.pages, "Dagröstning", 30000);
    ok(true, `${label}: all living players ready -> voting opened`);
  }

  /** votes: voterName -> targetName for every living player. */
  async vote(label, votes) {
    await allPhase(this.pages, "Dagröstning");
    for (const p of this.deadPages()) {
      const rs = await radios(p);
      const btns = await footerButtons(p);
      ok(rs.every((r) => r.disabled) && !btns.some((b) => /^Rösta på|^Välj en spelare/.test(b.text)),
        `${label}: dead ${p.name} cannot vote`, JSON.stringify({ rs, btns: btns.map((b) => b.text) }));
    }
    for (const p of this.alivePages()) {
      const rs = await radios(p);
      ok(!rs.some((r) => r.text.startsWith(p.name)), `${label}: ${p.name} can't vote for themself`);
      ok(this.deadPages().every((d) => !rs.some((r) => r.text === d.name)), `${label}: ${p.name} can't vote for a dead player`);
    }
    await Promise.all(
      this.alivePages().map(async (p) => {
        const target = votes[p.name];
        await tapRadio(p, target);
        await confirmTap(p, [`Rösta på ${target}`], new RegExp(`Röstade på ${target}|Röstresultat|VINNER`));
      })
    );
    const counts = {};
    Object.values(votes).forEach((t) => (counts[t] = (counts[t] ?? 0) + 1));
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    const out = sorted.length && !(sorted[1] && sorted[1][1] === sorted[0][1]) ? sorted[0][0] : null;
    if (out) this.alive.delete(out);
    const winner = this.winner();
    if (winner) return { out, winner };
    await allPhase(this.pages, "Röstresultat", 30000);
    if (out) {
      const seen = await Promise.all(this.pages.map(async (p) => new RegExp(`${out} röstades ut\\.`).test(await text(p))));
      ok(seen.every(Boolean), `${label}: every phone shows ${out} was voted out`);
      const n = counts[out];
      const breakdown = new RegExp(`RÖSTERNA[\\s\\S]*${out}\\s*\\n\\s*${n} ${n === 1 ? "röst" : "röster"}`, "i");
      const t = await text(this.pages[1]);
      ok(breakdown.test(t), `${label}: vote breakdown shows ${out} with ${n} votes`, t.slice(0, 0));
    }
    await shot(this.pages[0], `${label}-vote-result`);
    return { out, winner: null };
  }

  async nextNight({ auto = false, label = "" } = {}) {
    if (auto) {
      // Nobody taps: the vote result's 10 s countdown moves the game on by itself.
      const t = Date.now();
      await allPhase(this.pages, "Natt", 25000);
      ok(true, `${label}: vote result auto-advanced to the next night after ${((Date.now() - t) / 1000).toFixed(1)}s`);
      return;
    }
    await tap(this.host, ["Fortsätt till nästa natt", "Continue to next night"]);
    await allPhase(this.pages, "Natt");
  }

  async checkEnd(label, winner) {
    ok(winner === this.winner(), `${label}: expected winner is ${winner}`);
    const verdict = winner === "mafia" ? /MAFIAN VINNER/ : /BYN VINNER/;
    const verdictSeen = await Promise.all(
      this.pages.map((p) => waitForText(p, verdict, 20000).then(() => true, () => false))
    );
    ok(verdictSeen.every(Boolean), `${label}: every phone shows the ${winner} verdict`);
    await shot(this.pages[0], `${label}-verdict`);
    await Promise.all(this.pages.map((p) => p.waitForFunction((r) => location.pathname.includes(r), { timeout: 20000 }, RESULTS)));
    const headline = winner === "mafia" ? "Mafian vinner" : "Byn vinner";
    for (const p of this.pages) {
      await waitForText(p, new RegExp(headline), 15000).catch(() => {});
      const t = await text(p);
      ok(t.includes(headline), `${label}: ${p.name} results say "${headline}"`);
      // Results table: every player's role and alive state.
      let allRight = true;
      const wrong = [];
      for (const name of Object.keys(this.roles)) {
        const m = t.match(new RegExp(`${name}(?:\\s+\\(Du\\))?\\s*\\n\\s*(Överlevde|Utslagen)\\s*\\n\\s*(MAFIA|DOKTOR|POLIS|BYBO)`, "i"));
        const good = m && CHIP_SV[m[2].toUpperCase()] === this.roles[name] && (m[1] === "Överlevde") === this.alive.has(name);
        if (!good) {
          allRight = false;
          wrong.push(`${name}:${m ? m[1] + "/" + m[2] : "missing"}`);
        }
      }
      ok(allRight, `${label}: ${p.name} results list every role and survivor correctly`, wrong.join(" "));
      await checkNoEnglish(p, `${label} results`);
    }
    await shot(this.pages[1], `${label}-results`);
  }

  async playAgain(label) {
    const others = this.pages.slice(1);
    await waitForText(others[0], /Väntar på att värden startar en ny omgång/, 10000).catch(() => {});
    ok(/Väntar på att värden startar en ny omgång/.test(await text(others[0])), `${label}: non-host waits for host to restart`);
    await tap(this.host, ["Spela igen med samma gäng", "Play again with the same group"]);
    await Promise.all(this.pages.map((p) => p.waitForFunction((l) => location.pathname.includes(l), { timeout: 20000 }, LOBBY)));
    await allPhase(this.pages, "Lobby");
    const lobbyOk = await Promise.all(
      this.pages.map(async (p) => {
        const t = await text(p);
        return this.pages.every((q) => t.includes(q.name));
      })
    );
    ok(lobbyOk.every(Boolean), `${label}: every phone is back in the lobby with the whole group`);
    ok(/Starta spelet/.test(await text(this.host)), `${label}: host can start again`);
    await shot(this.host, `${label}-back-in-lobby`);
  }
}

const PAGES = [];
async function setupTable(browser, names, label) {
  const pages = [];
  for (const n of names) pages.push(await phone(browser, n));
  PAGES.push(...pages);
  const code = await createRoom(pages[0], ENTRY, LOBBY, names[0]);
  ok(/^[A-Z2-9]{4}$/.test(code || ""), `${label}: room created with code ${code}`);
  for (const p of pages.slice(1)) await joinRoom(p, ENTRY, LOBBY, code, p.name);
  await waitForText(pages[0], new RegExp(names[names.length - 1]), 20000);
  const t = await text(pages[0]);
  ok(names.every((n) => t.includes(n)), `${label}: host lobby lists all ${names.length} players`);
  await shot(pages[0], `${label}-lobby`);
  return new Table(pages);
}

/** Push the host's clock forward so running timers expire (the auto-advance lives on the host phone). */
async function skewClock(page, ms) {
  await page.evaluate((ms) => {
    if (!window.__realNow) window.__realNow = Date.now.bind(Date);
    Date.now = () => window.__realNow() + ms;
  }, ms);
}

// ---------------------------------------------------------------------------
// Scenario A: 5 players
// ---------------------------------------------------------------------------
async function scenarioA(browser) {
  const L = "5p";
  const tbl = await setupTable(browser, ["E2E Anna", "E2E Bo", "E2E Cia", "E2E Dan", "E2E Eva"], L);

  // ---- Game 1: saved at night, police finds mafia, reload, mafia voted out -> village wins
  await tbl.startAndReveal(`${L} g1`);
  const g1Roles = { ...tbl.roles };
  const [m] = tbl.names("mafia");
  const [d] = tbl.names("doctor");
  const v = tbl.names("villager");
  let r = await tbl.night(`${L} g1 n1`, { kill: v[0], save: v[0], investigate: m });
  ok(!r.died, `${L} g1 n1: doctor save -> nobody died`);
  await tbl.policeReport(`${L} g1 n1`, "mafia");
  // Night result auto-advances to discussion after its 10 s timer (nobody taps).
  const tNR = Date.now();
  await allPhase(tbl.pages, "Dagdiskussion", 25000);
  ok(true, `${L} g1: night result auto-advanced to discussion after ${((Date.now() - tNR) / 1000).toFixed(1)}s`);
  await checkNoEnglish(tbl.pages[2], `${L} discussion`);

  // Reload a non-host phone mid-game: same seat, same role, same phase.
  const reloader = tbl.pages[3];
  await reloader.reload({ waitUntil: "load" });
  await waitPhase(reloader, "Dagdiskussion", 30000);
  const after = await readRole(reloader);
  ok(after.role === tbl.roles[reloader.name], `${L} g1: ${reloader.name} keeps role after reload`, `${after.role} vs ${tbl.roles[reloader.name]}`);
  ok(new RegExp(`${reloader.name}\\s+\\(Du\\)`).test(await text(reloader)), `${L} g1: ${reloader.name} keeps their seat after reload`);

  await tbl.discussionAllReady(`${L} g1`);
  const votes = {};
  for (const p of tbl.alivePages()) votes[p.name] = p.name === m ? v[1] : m;
  r = await tbl.vote(`${L} g1 day1`, votes);
  ok(r.out === m && r.winner === "village", `${L} g1: town voted out the mafia`);
  await tbl.checkEnd(`${L} g1`, "village");
  await tbl.playAgain(`${L} g1`);

  // ---- Game 2: re-dealt; death; discussion timer expiry; vote out villager; mafia wins at night
  await tbl.startAndReveal(`${L} g2`);
  const changed = Object.keys(tbl.roles).filter((n) => tbl.roles[n] !== g1Roles[n]).length;
  log(`game 2 roles changed for ${changed} players`);
  ok(Object.keys(tbl.roles).length === 5, `${L} g2: roles re-dealt (${changed}/5 players got a different role)`);
  if (g1Roles[tbl.host.name] === "mafia") ok(tbl.roles[tbl.host.name] !== "mafia", `${L} g2: previous-mafia host is not mafia again`);
  const [m2] = tbl.names("mafia");
  const [d2] = tbl.names("doctor");
  const [p2] = tbl.names("police");
  const v2 = tbl.names("villager");
  r = await tbl.night(`${L} g2 n1`, { kill: v2[0], save: d2, investigate: v2[1] });
  ok(r.died === v2[0], `${L} g2 n1: ${v2[0]} was killed`);
  await tbl.policeReport(`${L} g2 n1`, "village");
  // Host continues manually this time.
  await tap(tbl.host, ["Fortsätt till diskussion", "Continue to discussion"]);
  await allPhase(tbl.pages, "Dagdiskussion");
  // Dead player: can't mark ready; sees eliminated note.
  const dead = tbl.byName[v2[0]];
  ok(/Du är utslagen/.test(await text(dead)), `${L} g2: dead ${dead.name} sees the eliminated note`);
  const clockBefore = await text(tbl.pages[1]);
  ok(/TID KVAR\s*\n\s*[45]:\d\d/i.test(clockBefore), `${L} g2: discussion timer is shown`);
  // Nobody presses ready; push the host's clock past the discussion timer.
  await skewClock(tbl.host, 5 * 60 * 1000 + 3000);
  await allPhase(tbl.pages, "Dagröstning", 20000);
  ok(true, `${L} g2: discussion timer expired and voting opened automatically`);
  await skewClock(tbl.host, 0);
  const votes2 = {};
  for (const p of tbl.alivePages()) votes2[p.name] = p.name === v2[1] ? m2 : v2[1];
  r = await tbl.vote(`${L} g2 day1`, votes2);
  ok(r.out === v2[1] && !r.winner, `${L} g2: ${v2[1]} voted out, game continues`);
  await tbl.nextNight({ auto: true, label: `${L} g2` });
  r = await tbl.night(`${L} g2 n2`, { kill: p2, save: d2, investigate: m2 });
  ok(r.died === p2 && r.winner === "mafia", `${L} g2 n2: police killed -> mafia wins`);
  await tbl.checkEnd(`${L} g2`, "mafia");
  await tbl.playAgain(`${L} g2`);
  return tbl.pages;
}

// ---------------------------------------------------------------------------
// Scenario B: 8 players
// ---------------------------------------------------------------------------
async function scenarioB(browser) {
  const L = "8p";
  const names = ["E2E Fia", "E2E Gus", "E2E Hal", "E2E Ida", "E2E Jon", "E2E Kim", "E2E Liv", "E2E Max"];
  const tbl = await setupTable(browser, names, L);
  await tbl.startAndReveal(`${L} g1`);
  const g1Roles = { ...tbl.roles };
  const [m1, m2] = tbl.names("mafia");
  const [d] = tbl.names("doctor");
  const v = tbl.names("villager");

  let r = await tbl.night(`${L} g1 n1`, { kill: v[0], save: v[1], investigate: v[2] });
  ok(r.died === v[0], `${L} g1 n1: ${v[0]} was killed (doctor protected someone else)`);
  await tbl.policeReport(`${L} g1 n1`, "village");
  await tbl.discussionAllReady(`${L} g1`);
  const votes = {};
  for (const p of tbl.alivePages()) votes[p.name] = tbl.roles[p.name] === "mafia" ? v[1] : m1;
  r = await tbl.vote(`${L} g1 day1`, votes);
  ok(r.out === m1 && !r.winner, `${L} g1: mafia #1 voted out, game continues`);
  await tbl.nextNight();
  r = await tbl.night(`${L} g1 n2`, { kill: v[1], save: v[1], investigate: m2 });
  ok(!r.died, `${L} g1 n2: doctor saved ${v[1]}`);
  await tbl.policeReport(`${L} g1 n2`, "mafia");
  await tbl.discussionAllReady(`${L} g1 d2`);
  const votes2 = {};
  for (const p of tbl.alivePages()) votes2[p.name] = p.name === m2 ? v[1] : m2;
  r = await tbl.vote(`${L} g1 day2`, votes2);
  ok(r.out === m2 && r.winner === "village", `${L} g1: mafia #2 voted out -> village wins`);
  await tbl.checkEnd(`${L} g1`, "village");
  await tbl.playAgain(`${L} g1`);

  await tbl.startAndReveal(`${L} g2`);
  const changed = Object.keys(tbl.roles).filter((n) => tbl.roles[n] !== g1Roles[n]).length;
  ok(changed > 0, `${L} g2: roles re-dealt (${changed}/8 players got a different role)`);
  const alive = tbl.pages.map((p) => p.name);
  ok((await Promise.all(tbl.pages.map((p) => text(p)))).every((t) => !/DÖD/.test(t)), `${L} g2: nobody is dead at the start of the new game`);
  // Night timeout: one villager never finishes their notes.
  const vv = tbl.names("villager");
  const [mm] = tbl.names("mafia");
  r = await tbl.night(`${L} g2 n1`, { kill: vv[0], save: vv[1], investigate: mm, idle: vv[2] });
  ok(r.died === vv[0], `${L} g2 n1: night resolved after timeout, ${vv[0]} was killed`);
  await tbl.policeReport(`${L} g2 n1`, "mafia");
  return tbl.pages;
}

// ---------------------------------------------------------------------------
const browser = await launch();
let crashed = false;
try {
  const which = (process.env.SCENARIO || "ab").toLowerCase();
  if (which.includes("a")) await scenarioA(browser);
  if (which.includes("b")) await scenarioB(browser);
} catch (e) {
  crashed = true;
  ok(false, `test crashed: ${e.message}`);
  for (const p of PAGES) await shot(p, `crash-${p.name.replace(/\W/g, "")}`);
  console.error(e);
}
summarizePhoneIssues(ok, PAGES);
log(`total ${((Date.now() - T0) / 1000).toFixed(0)}s`);
await browser.close();
process.exit(done() || crashed ? 1 : 0);
