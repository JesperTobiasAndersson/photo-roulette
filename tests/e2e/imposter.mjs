// Imposter end to end: groups of 3, 4 and 6 phones play full games (Swedish UI):
// secret cards (exactly one imposter, everyone else the same word + picture),
// discussion (all ready, and the clock running out), voting (crew wins, wrong
// player out, tie), results on every phone, "play again with the same group"
// and a second game with a new word. All 10 categories are played at least once.
// Also: eliminated players can't vote, a reload mid-game keeps seat and card,
// and a late joiner is refused with a friendly message.
//
//   node tests/e2e/imposter.mjs
import fs from "node:fs";
import path from "node:path";
import { ROOT, BASE, launch, phone, tap, tryTap, waitForText, text, typeInto, createRoom, joinRoom, readRoomCode, reporter, summarizePhoneIssues, wait, loadEnv } from "../lib.mjs";

const { IMPOSTER_CATEGORIES, IMPOSTER_WORDS, imposterWordLabel } = await import("../../src/games/imposter/data.ts");

const R = reporter("imposter");
const ART = path.join(ROOT, "tests", "artifacts", "imposter");
fs.mkdirSync(ART, { recursive: true });
const shot = (page, name) => page.screenshot({ path: path.join(ART, `${name}.png`) }).catch(() => {});
const ENV = loadEnv();
const T0 = Date.now();

// Categories are handed out in order, so every one is played at least once.
let nextCategory = 0;
const takeCategory = () => IMPOSTER_CATEGORIES[nextCategory++ % IMPOSTER_CATEGORIES.length];
const playedCategories = new Set();

// English UI text that must never show on a Swedish phone.
const ENGLISH = [/Tap to see your card/, /I saw my card/, /Ready to vote/, /Time left/, /Vote for /, /Game over/i, /Crew wins/i, /Imposter wins/i, /The imposter was/, /Secret word/, /Waiting for the host/, /Play again/, /Final table/i, /\bCREW\b/];
async function checkSwedish(page, where) {
  const t = await text(page);
  const hit = ENGLISH.find((re) => re.test(t));
  if (hit) R.ok(false, `${page.name}: no English text on Swedish phone (${where})`, String(hit));
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const params = (page) => {
  const u = new URL(page.url());
  return { roomId: u.searchParams.get("roomId"), playerId: u.searchParams.get("playerId") };
};

/** PostgREST call with this phone's own session (same rights as the app). */
async function rest(page, method, pathAndQuery, body) {
  return page.evaluate(
    async (url, key, method, pathAndQuery, body) => {
      const k = Object.keys(localStorage).find((x) => x.startsWith("sb-") && x.endsWith("-auth-token"));
      const token = k ? JSON.parse(localStorage.getItem(k)).access_token : key;
      const res = await fetch(`${url}/rest/v1/${pathAndQuery}`, {
        method,
        headers: { apikey: key, Authorization: `Bearer ${token}`, "Content-Type": "application/json", Prefer: "return=representation" },
        body: body ? JSON.stringify(body) : undefined,
      });
      return res.json();
    },
    ENV.EXPO_PUBLIC_SUPABASE_URL,
    ENV.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    method,
    pathAndQuery,
    body ?? null
  );
}
const getRoom = async (host) => (await rest(host, "GET", `imposter_rooms?id=eq.${params(host).roomId}&select=*`))[0];
const getPlayers = async (host) => rest(host, "GET", `imposter_room_players?room_id=eq.${params(host).roomId}&select=*&order=seat_order`);

async function waitForRoom(host, pred, label, timeout = 25000) {
  const start = Date.now();
  let room;
  while (Date.now() - start < timeout) {
    room = await getRoom(host);
    if (room && pred(room)) return room;
    await wait(500);
  }
  throw new Error(`timed out waiting for room: ${label} (state=${room?.state})`);
}

async function waitAll(pages, re, timeout = 25000) {
  await Promise.all(pages.map((p) => waitForText(p, re, timeout)));
}

/** Wait until the image in the card has actually loaded; returns its naturalWidth. */
async function pictureWidth(page, timeout = 15000) {
  const start = Date.now();
  let w = 0;
  while (Date.now() - start < timeout) {
    w = await page.evaluate(() =>
      Math.max(0, ...[...document.querySelectorAll("img")].filter((i) => /wikimedia|flagcdn/.test(i.src)).map((i) => (i.complete ? i.naturalWidth : 0)))
    );
    if (w > 0) return w;
    await wait(400);
  }
  return w;
}

/** Tap the vote option (radio) for `name` – the player list below also shows names. */
async function tapVoteOption(page, name) {
  const start = Date.now();
  while (Date.now() - start < 15000) {
    const ok = await page.evaluate((name) => {
      const el = [...document.querySelectorAll('[role="radio"]')].find((e) => e.offsetParent !== null && e.textContent.includes(name));
      if (!el) return false;
      el.click();
      return true;
    }, name);
    if (ok) return;
    await wait(300);
  }
  throw new Error(`${page.name}: no vote option for ${name}`);
}
const voteOptionNames = (page) =>
  page.evaluate(() => [...document.querySelectorAll('[role="radio"]')].filter((e) => e.offsetParent !== null).map((e) => e.textContent));

async function vote(page, targetName) {
  await tapVoteOption(page, targetName);
  await tap(page, `Rösta på ${targetName}`);
  await waitForText(page, new RegExp(`Du röstade på ${targetName}`), 10000);
}

/** Tap the private card and read it: { imposter, word, pictureWidth }. */
async function readCard(page) {
  if (!(await tryTap(page, "Tryck för att se ditt kort", { timeout: 8000 }))) throw new Error(`${page.name}: no card to tap`);
  await waitForText(page, /DU ÄR IMPOSTERN|DITT HEMLIGA ORD/, 8000);
  const t = await text(page);
  if (/DU ÄR IMPOSTERN/.test(t)) return { imposter: true, word: null, pictureWidth: 0, text: t };
  const m = t.match(/DITT HEMLIGA ORD\n(?:Foto: Wikipedia\n)?([^\n]+)/);
  return { imposter: false, word: m ? m[1].trim() : null, pictureWidth: await pictureWidth(page), text: t };
}

const expectedLabel = (prompt) => imposterWordLabel(prompt, "sv").toUpperCase();

// ---------------------------------------------------------------------------
// One game: category → cards → discussion/voting rounds → results
// ---------------------------------------------------------------------------
/**
 * `rounds` is a list of voting plans, each a function (ctx) => { votes: Map(voterPage → targetPage), expect }
 * where expect is "crew" | "imposter" | "continue". `discussion` per round: "ready" | "timer" | "host".
 */
async function playGame(group, tag, rounds, { previousPrompt = null, reloadDuring = false, lateJoiner = null } = {}) {
  const { phones, host } = group;
  const category = takeCategory();
  playedCategories.add(category.id);
  const catLabel = category.titleSv;

  // --- Lobby: host picks the category, everyone sees it -------------------------------------
  await waitAll(phones, /Kategori/i);
  await tap(host, catLabel);
  const room0 = await waitForRoom(host, (r) => r.category_id === category.id, "category set");
  R.ok(room0.state === "lobby", `${tag}: host picked category ${category.id}`);
  // The start button unlocks once the host's screen has synced the category.
  await host.waitForFunction(
    () => [...document.querySelectorAll('[role="button"],button')].some((b) => b.textContent.includes("Starta spelet") && b.getAttribute("aria-disabled") !== "true"),
    { timeout: 15000 }
  );
  await tap(host, "Starta spelet");
  const room1 = await waitForRoom(host, (r) => r.state === "role_reveal", "role_reveal");
  R.ok(category.prompts.includes(room1.secret_prompt), `${tag}: secret word "${room1.secret_prompt}" comes from ${category.id}`);
  if (previousPrompt) R.ok(room1.secret_prompt !== previousPrompt, `${tag}: second game deals a new word`, `${previousPrompt} -> ${room1.secret_prompt}`);

  // --- Late joiner is refused once the game has started ---------------------------------------
  if (lateJoiner) {
    await lateJoiner.goto(`${BASE}/imposter?code=${group.code}`, { waitUntil: "load" });
    await wait(1200);
    await typeInto(lateJoiner, 0, "E2E Sen");
    await tap(lateJoiner, ["Gå med", "Join room"]);
    let refused = false;
    try {
      await waitForText(lateJoiner, /Spelet har redan börjat/, 15000);
      refused = true;
    } catch {}
    R.ok(refused && !lateJoiner.url().includes("imposter-lobby"), `${tag}: late joiner refused with a friendly message`);
    await shot(lateJoiner, `${tag}-late-joiner`);
    const ps = await getPlayers(host);
    R.ok(ps.length === phones.length && !ps.some((p) => p.display_name === "E2E Sen"), `${tag}: late joiner did not get a seat`);
  }

  // --- Secret cards --------------------------------------------------------------------------
  await waitAll(phones, /Tryck för att se ditt kort/);
  const firstLabel = await text(host);
  R.ok(/Visa ditt kort först/.test(firstLabel), `${tag}: ready button asks to reveal the card first`);
  const cards = new Map();
  for (const p of phones) cards.set(p, await readCard(p));
  const imposters = phones.filter((p) => cards.get(p).imposter);
  const crew = phones.filter((p) => !cards.get(p).imposter);
  R.ok(imposters.length === 1, `${tag}: exactly one phone sees DU ÄR IMPOSTERN`, imposters.map((p) => p.name).join(","));
  const want = expectedLabel(room1.secret_prompt);
  R.ok(crew.every((p) => cards.get(p).word === want), `${tag}: all ${crew.length} crew phones see the same word "${want}"`, crew.map((p) => cards.get(p).word).join(" | "));
  R.ok(crew.every((p) => cards.get(p).pictureWidth > 0), `${tag}: word picture loads on every crew phone (${category.id})`, crew.map((p) => cards.get(p).pictureWidth).join(","));
  R.ok(!cards.get(imposters[0]).text.includes(want), `${tag}: the imposter's screen does not show the word`);
  await shot(crew[0], `${tag}-card-crew`);
  await shot(imposters[0], `${tag}-card-imposter`);
  for (const p of phones) await checkSwedish(p, `${tag} card`);
  const imposter = imposters[0];
  group.imposter = imposter;

  // --- Reload mid-game keeps seat and card ---------------------------------------------------
  if (reloadDuring) {
    const p = crew[crew.length - 1];
    const before = params(p);
    await p.reload({ waitUntil: "load" });
    await waitForText(p, /Tryck för att se ditt kort/, 20000);
    R.ok(params(p).playerId === before.playerId, `${tag}: reload keeps ${p.name}'s seat`);
    const again = await readCard(p);
    R.ok(!again.imposter && again.word === want, `${tag}: reload keeps ${p.name}'s card`, again.word);
  }

  for (const p of phones) await tap(p, "Jag har sett mitt kort");
  await waitAll(phones, /Tid kvar/i);
  R.ok(true, `${tag}: everyone saw their card → discussion`);

  // --- Discussion / voting rounds ------------------------------------------------------------
  let alive = [...phones];
  let result = null;
  for (let i = 0; i < rounds.length; i++) {
    const plan = rounds[i]({ alive, imposter, crew: alive.filter((p) => p !== imposter), host });
    const rt = `${tag} r${i + 1}`;
    await waitAll(phones, /Tid kvar/i);
    if (i === 0) await shot(host, `${tag}-discussion`);

    if (plan.discussion === "timer") {
      // Only some are ready; the clock runs out and voting opens anyway.
      await tap(alive[0], "Redo att rösta");
      await waitForText(host, new RegExp(`1/${alive.length} redo att rösta`), 10000);
      const roomNow = await getRoom(host);
      await rest(host, "PATCH", `imposter_rooms?id=eq.${roomNow.id}`, { phase_ends_at: new Date(Date.now() + 3000).toISOString() });
      const t = Date.now();
      await waitAll(phones, /röster inne/i, 20000);
      R.ok(true, `${rt}: discussion timer ran out → voting opened automatically (${((Date.now() - t) / 1000).toFixed(1)}s)`);
    } else if (plan.discussion === "host") {
      await tap(host, "Öppna röstningen nu");
      await waitAll(phones, /röster inne/i);
      R.ok(true, `${rt}: host opened voting`);
    } else {
      for (const p of alive) await tap(p, "Redo att rösta");
      await waitAll(phones, /röster inne/i);
      R.ok(true, `${rt}: all ${alive.length} alive players ready → voting`);
    }

    // Eliminated players can't vote.
    for (const out of phones.filter((p) => !alive.includes(p))) {
      const opts = await voteOptionNames(out);
      const t = await text(out);
      R.ok(opts.length === 0 && /Du är ute – titta på när de andra röstar/.test(t), `${rt}: eliminated ${out.name} can't vote`);
    }
    // Nobody can vote for themselves or for eliminated players.
    const opts = await voteOptionNames(alive[0]);
    R.ok(
      opts.length === alive.length - 1 && !opts.some((o) => o.includes(alive[0].name)),
      `${rt}: ${alive[0].name} can vote for the ${alive.length - 1} other alive players`,
      opts.join(" | ")
    );

    const phaseBefore = (await getRoom(host)).phase_number;
    const voters = [...plan.votes];
    for (const [voter, target] of voters.slice(0, -1)) await vote(voter, target.name);
    await shot(host, `${rt}-votes`);
    // The last vote resolves the round right away, so don't wait for the "you voted" label.
    const [lastVoter, lastTarget] = voters[voters.length - 1];
    await tapVoteOption(lastVoter, lastTarget.name);
    await tap(lastVoter, `Rösta på ${lastTarget.name}`);

    if (plan.expect === "continue") {
      const r = await waitForRoom(host, (x) => x.state === "discussion" && x.phase_number > phaseBefore, "back to discussion");
      const players = await getPlayers(host);
      const outNow = players.filter((p) => p.status === "eliminated").map((p) => p.display_name);
      if (plan.eliminated) {
        R.ok(outNow.includes(plan.eliminated.name), `${rt}: ${plan.eliminated.name} voted out, game continues`, r.public_message);
        alive = alive.filter((p) => p !== plan.eliminated);
        await waitForText(plan.eliminated, /Du är ute/, 10000);
        await shot(plan.eliminated, `${rt}-eliminated`);
      } else {
        R.ok(outNow.length === phones.length - alive.length && r.public_message === "Nobody was eliminated. Keep discussing.", `${rt}: tie → nobody out, discussion continues`, r.public_message);
        await waitForText(host, /Ingen röstades ut/, 10000);
      }
      await waitAll(phones, /Tid kvar/i);
      continue;
    }

    const r = await waitForRoom(host, (x) => x.state === "ended", "ended");
    R.ok(r.winner === plan.expect, `${rt}: winner is ${plan.expect}`, `${r.winner} – ${r.public_message}`);
    result = r;
    break;
  }
  if (!result) throw new Error(`${tag}: game did not end`);

  // --- Results on every phone ----------------------------------------------------------------
  await Promise.all(phones.map((p) => p.waitForFunction(() => location.pathname.includes("imposter-results"), { timeout: 30000 })));
  await waitAll(phones, /Impostern var/i);
  const winText = result.winner === "crew" ? "Laget vinner" : "Impostern vinner";
  for (const p of phones) {
    const t = await text(p);
    const good =
      t.includes(winText) &&
      new RegExp(`IMPOSTERN VAR\\n${imposter.name}|Impostern var\\n${imposter.name}`, "i").test(t) &&
      t.includes(want) &&
      t.includes(`Kategori: ${category.emoji} ${catLabel}`);
    R.ok(good, `${tag}: ${p.name} results show winner, imposter ${imposter.name}, word and category`, good ? "" : t.slice(0, 400).replace(/\n/g, " / "));
    R.ok((await pictureWidth(p)) > 0, `${tag}: ${p.name} results picture loads`);
    await checkSwedish(p, `${tag} results`);
  }
  await shot(host, `${tag}-results-host`);
  await shot(phones[1], `${tag}-results-guest`);
  R.ok(/Väntar på att värden startar en ny omgång/.test(await text(phones[1])), `${tag}: guests wait for the host on the results screen`);

  // --- Play again with the same group --------------------------------------------------------
  await tap(host, "Spela igen med samma gäng");
  await Promise.all(phones.map((p) => p.waitForFunction(() => location.pathname.includes("imposter-lobby"), { timeout: 30000 })));
  await waitForText(host, /Starta spelet/);
  await Promise.all(phones.slice(1).map((p) => waitForText(p, /Väntar på att värden startar spelet/)));
  const players = await getPlayers(host);
  R.ok(
    players.length === phones.length && players.every((p) => p.status === "alive" && !p.role_reveal_ready && !p.discussion_ready),
    `${tag}: play again → all ${phones.length} players back in the lobby, reset`
  );
  const lobbyRoom = await getRoom(host);
  R.ok(lobbyRoom.state === "lobby" && lobbyRoom.winner === null, `${tag}: room back in lobby state`);
  return result.secret_prompt;
}

// ---------------------------------------------------------------------------
// Groups
// ---------------------------------------------------------------------------
async function makeGroup(browser, size, label) {
  const names = ["E2E Anna", "E2E Bosse", "E2E Cilla", "E2E Dani", "E2E Eva", "E2E Fille"].slice(0, size).map((n) => `${n}${label}`);
  const phones = [];
  for (const n of names) phones.push(await phone(browser, n));
  const [host, ...guests] = phones;
  let code = await createRoom(host, "/imposter", "/imposter-lobby", host.name);
  for (let i = 0; !code && i < 30; i++) {
    await wait(1000);
    code = await readRoomCode(host);
  }
  R.ok(!!code, `${label}: host created room ${code}`);
  for (const g of guests) await joinRoom(g, "/imposter", "/imposter-lobby", code, g.name);
  await waitForText(host, new RegExp(guests.map((g) => g.name).join("|")));
  const ps = await getPlayers(host);
  R.ok(ps.length === size, `${label}: ${size} players in the lobby`, String(ps.length));
  await shot(host, `${label}-lobby`);
  return { phones, host, code };
}

// Vote plans ------------------------------------------------------------------------------------
/** Everyone votes the imposter (the imposter votes a crew member). */
const catchImposter = (discussion = "ready") => ({ alive, imposter, crew }) => ({
  discussion,
  expect: "crew",
  votes: new Map(alive.map((p) => [p, p === imposter ? crew[0] : imposter])),
});
/** Everyone votes crew[0] (crew[0] votes crew[1]); expect decides continue/imposter. */
const wrongPlayer = (expect, discussion = "ready") => ({ alive, imposter, crew }) => ({
  discussion,
  expect,
  eliminated: crew[0],
  votes: new Map(alive.map((p) => [p, p === crew[0] ? crew[1] : crew[0]])),
});
/** Split vote with no single leader. */
const tie = (discussion = "ready") => ({ alive, imposter, crew }) => {
  const votes = new Map();
  if (alive.length === 3) {
    // 1–1–1: everyone votes the next seat.
    alive.forEach((p, i) => votes.set(p, alive[(i + 1) % alive.length]));
  } else {
    // Two leaders, two votes each: imposter and crew[0].
    const a = imposter, b = crew[0];
    let na = 0, nb = 0;
    for (const p of alive) {
      if (p === a) { votes.set(p, b); nb++; }
      else if (p === b) { votes.set(p, a); na++; }
    }
    for (const p of alive) {
      if (votes.has(p)) continue;
      if (na < 2) { votes.set(p, a); na++; }
      else if (nb < 2) { votes.set(p, b); nb++; }
      else votes.set(p, crew[crew.length - 1] === p ? crew[1] : crew[crew.length - 1]);
    }
  }
  return { discussion, expect: "continue", eliminated: null, votes };
};

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------
const browser = await launch();
const allPhones = [];
let exitCode = 0;
try {
  // Static data check: every word has a picture and a label.
  const missing = IMPOSTER_CATEGORIES.flatMap((c) => c.prompts).filter((w) => !IMPOSTER_WORDS[w]?.image);
  R.ok(IMPOSTER_CATEGORIES.length === 10 && missing.length === 0, `data: 10 categories, every word has a picture`, missing.join(", "));

  // 3 players: tie, reload, clock runs out, wrong player out → imposter wins (2 left); late joiner.
  {
    const g = await makeGroup(browser, 3, " 3p");
    allPhones.push(...g.phones);
    const late = await phone(browser, "E2E Sen 3p");
    allPhones.push(late);
    let t = Date.now();
    const w1 = await playGame(g, "3p-g1", [tie(), wrongPlayer("imposter", "timer")], { reloadDuring: true, lateJoiner: late });
    console.log(`  (3p game 1 took ${((Date.now() - t) / 1000).toFixed(0)}s)`);
    t = Date.now();
    let w = await playGame(g, "3p-g2", [catchImposter("host")], { previousPrompt: w1 });
    console.log(`  (3p game 2 took ${((Date.now() - t) / 1000).toFixed(0)}s)`);
    // Keep playing quick games until every category has been played.
    // (4p and 6p below take 4 more categories.)
    for (let i = 0; i < 4; i++) w = await playGame(g, `3p-g${3 + i}`, [catchImposter("host")], { previousPrompt: w });
    for (const p of g.phones) await p.browserContext().close().catch(() => {});
  }

  // 4 players: wrong player out → continues, eliminated can't vote → crew wins; then tie → crew wins.
  {
    const g = await makeGroup(browser, 4, " 4p");
    allPhones.push(...g.phones);
    const w1 = await playGame(g, "4p-g1", [wrongPlayer("continue"), catchImposter()]);
    await playGame(g, "4p-g2", [tie(), catchImposter("timer")], { previousPrompt: w1 });
    for (const p of g.phones) await p.browserContext().close().catch(() => {});
  }

  // 6 players: crew wins straight away; then two wrong players out → still going → tie → crew wins.
  {
    const g = await makeGroup(browser, 6, " 6p");
    allPhones.push(...g.phones);
    const w1 = await playGame(g, "6p-g1", [catchImposter()]);
    await playGame(g, "6p-g2", [wrongPlayer("continue"), wrongPlayer("continue"), tie(), catchImposter()], { previousPrompt: w1 });
  }

  R.ok(playedCategories.size === IMPOSTER_CATEGORIES.length, `all ${IMPOSTER_CATEGORIES.length} categories played`, [...playedCategories].join(","));
} catch (e) {
  R.ok(false, `run aborted: ${e.message}`);
  for (const p of allPhones) await shot(p, `error-${p.name.replace(/\s+/g, "_")}`);
} finally {
  // The late joiner's refusal is expected to be shown inline, not as a pop-up.
  summarizePhoneIssues(R.ok, allPhones);
  await browser.close().catch(() => {});
  console.log(`\nTotal time ${((Date.now() - T0) / 1000).toFixed(0)}s`);
  exitCode = R.done() ? 1 : 0;
}
process.exit(exitCode);
