// MemeMatch end-to-end: 4 phones play a full 5-round game, then "play again with the same group".
//
//   node tests/e2e/memematch.mjs            (BASE defaults to http://localhost:8081)
//
// Covers: create/join via invite link, category pick, uploading 5 photos per phone (web file chooser),
// submitting + voting each round with a planned vote pattern (incl. a tie), automatic round advance,
// winner overlay, scores (UI + database), final results, voting on your own photo (UI + API),
// a late joiner after the game started, a page refresh mid-round, a re-join via the invite link
// mid-game (same seat/hand), and play-again → photos kept → a second game starts and advances.
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
import { createClient } from "@supabase/supabase-js";
import {
  BASE,
  ROOT,
  launch,
  phone,
  tap,
  waitForText,
  text,
  typeInto,
  createRoom,
  joinRoom,
  reporter,
  summarizePhoneIssues,
  loadEnv,
  wait,
} from "../lib.mjs";

const { ok, done } = reporter("memematch");
const ART = path.join(ROOT, "tests", "artifacts", "memematch");
fs.mkdirSync(ART, { recursive: true });
const IMG_DIR = path.join(ART, "upload");
fs.mkdirSync(IMG_DIR, { recursive: true });

const t0 = Date.now();
const log = (...a) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s]`, ...a);
const shot = (page, name) => page.screenshot({ path: path.join(ART, `${name}.png`) }).catch(() => {});

// ---------------------------------------------------------------------------
// Local helpers
// ---------------------------------------------------------------------------
function makeImages(prefix, n) {
  const files = [];
  for (let i = 0; i < n; i++) {
    const png = new PNG({ width: 64, height: 64 });
    const [r, g, b] = [(prefix.charCodeAt(0) * 37 + i * 50) % 256, (i * 80) % 256, (prefix.length * 60 + i * 30) % 256];
    for (let y = 0; y < 64; y++)
      for (let x = 0; x < 64; x++) {
        const k = (y * 64 + x) * 4;
        const stripe = (x + y + i * 7) % 16 < 8;
        png.data[k] = stripe ? r : 255 - r;
        png.data[k + 1] = stripe ? g : 255 - g;
        png.data[k + 2] = b;
        png.data[k + 3] = 255;
      }
    const file = path.join(IMG_DIR, `${prefix}-${i}.png`);
    fs.writeFileSync(file, PNG.sync.write(png));
    files.push(file);
  }
  return files;
}

const params = (page) => Object.fromEntries(new URL(page.url()).searchParams);
const onPath = (page, p) => new URL(page.url()).pathname === p;

async function waitFor(fn, timeout = 30000, what = "condition") {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const v = await fn();
      if (v) return v;
    } catch {}
    await wait(250);
  }
  throw new Error(`timed out waiting for ${what}`);
}

async function waitPath(page, p, timeout = 30000) {
  await waitFor(() => onPath(page, p), timeout, `${page.name} on ${p}`);
}

/** Upload photos through the web image picker (a hidden <input type=file>). */
async function uploadPhotos(page, files, label = ["Välj 5 bilder", "Pick 5 images"]) {
  const [chooser] = await Promise.all([page.waitForFileChooser({ timeout: 20000 }), tap(page, label, { contains: true })]);
  await chooser.accept(files);
}

/** Auth token of the phone's anonymous Supabase session (read from localStorage). */
async function tokenOf(page) {
  return page.evaluate(() => {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k.startsWith("sb-") && k.endsWith("-auth-token")) return JSON.parse(localStorage.getItem(k)).access_token;
    }
    return null;
  });
}

function dbAs(token) {
  const env = loadEnv();
  return createClient(env.EXPO_PUBLIC_SUPABASE_URL, env.EXPO_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

/** Tiles in the round grid: [{ owner: playerId from the image path, label, disabled }] */
async function roundTiles(page) {
  return page.evaluate(() =>
    [...document.querySelectorAll('[role="button"]')]
      .map((el) => {
        const img = el.querySelector("img");
        if (!img) return null;
        const m = /\/hand\/([0-9a-f-]{36})-/.exec(img.src || "");
        return {
          owner: m ? m[1] : null,
          label: el.getAttribute("aria-label"),
          disabled: el.getAttribute("aria-disabled") === "true",
        };
      })
      .filter((t) => t && t.owner)
  );
}

async function clickTileOf(page, ownerId) {
  return page.evaluate((ownerId) => {
    const el = [...document.querySelectorAll('[role="button"]')].find((b) => {
      const img = b.querySelector("img");
      return img && (img.src || "").includes(`/hand/${ownerId}-`);
    });
    if (!el) return false;
    el.click();
    return true;
  }, ownerId);
}

async function handTileCount(page) {
  return page.evaluate(
    () => document.querySelectorAll('[aria-label="Tryck på en bild för att spela den."], [aria-label="Tap a photo to play it."]').length
  );
}

async function submitFirstFromHand(page) {
  await waitFor(() => handTileCount(page), 20000, `${page.name} hand tiles`);
  await page.evaluate(() => {
    const el = document.querySelector('[aria-label="Tryck på en bild för att spela den."], [aria-label="Tap a photo to play it."]');
    el.click();
  });
  await waitForText(page, /Skickat in|Väntar på|Rösta på den roligaste/, 20000);
}

/** Wait until the phone is on the round screen for round number n (and return its roundId). */
async function waitRound(page, n, timeout = 40000) {
  await waitFor(
    async () => onPath(page, "/round") && new RegExp(`Runda ${n}/5`).test(await text(page)),
    timeout,
    `${page.name} on round ${n}`
  );
  return params(page).roundId;
}

// ---------------------------------------------------------------------------
// Test
// ---------------------------------------------------------------------------
const browser = await launch();
const names = ["E2E Anna", "E2E Bosse", "E2E Cilla", "E2E Dani"];
const phones = [];
const timings = [];
let exitCode = 1;

try {
  for (const n of names) phones.push(await phone(browser, n));
  const [host] = phones;

  // --- Lobby -----------------------------------------------------------------
  const code = await createRoom(host, "/picklo", "/lobby", names[0]);
  ok(/^[A-Z2-9]{4}$/.test(code || ""), `room created with code ${code}`);
  for (const p of phones.slice(1)) await joinRoom(p, "/picklo", "/lobby", code, p.name);
  await waitForText(host, /4 spelare/, 20000);
  ok(true, "host sees 4 players in the lobby");
  for (const p of phones) p.playerId = params(p).playerId;
  ok(new Set(phones.map((p) => p.playerId)).size === 4, "4 distinct player ids");
  ok(/Väntar på att värden/.test(await text(phones[1])), "guest sees 'waiting for host' in lobby");
  const roomId = params(host).roomId;
  const db = dbAs(await tokenOf(host));

  // Host picks the "18+" category, guests should see it selected (and can't change it)
  await tap(host, ["18+"]);
  await wait(1500);
  const { data: room0 } = await db.from("rooms").select("statement_category,phase").eq("id", roomId).single();
  ok(room0?.statement_category === "adult", "host's category choice is saved", JSON.stringify(room0));
  await shot(host, "01-lobby-host");

  await tap(host, ["Fortsätt till bilder", "Continue to images"]);
  for (const p of phones) await waitPath(p, "/pick-hand", 20000);
  ok(true, "everyone is sent to the photo screen");

  // --- Upload photos ---------------------------------------------------------
  const letters = ["a", "b", "c", "d", "e"];
  await Promise.all(
    phones.map(async (p, i) => {
      await uploadPhotos(p, makeImages(letters[i], 5));
      await waitForText(p, /5 \/ 5/, 60000);
    })
  );
  ok(true, "all 4 phones uploaded 5 photos");
  await shot(phones[1], "02-pick-hand-done");
  for (const p of phones) await tap(p, ["Fortsätt", "Continue"]);
  for (const p of phones) await waitPath(p, "/lobby", 20000);
  await waitForText(host, /Starta spel/, 10000);
  await tap(host, ["Starta spel", "Start game"]);

  // --- Rounds ----------------------------------------------------------------
  // Vote plan: votes[r][voter] = index of player voted for. Expected points: A3 B2 C1 D0.
  const plan = [
    [1, 0, 0, 0], // A wins
    [1, 2, 1, 1], // B wins
    [2, 2, 3, 2], // C wins
    [1, 0, 0, 1], // A/B tie → both score
    [1, 0, 0, 0], // A wins
  ];
  const expectedPoints = [0, 0, 0, 0];
  for (const round of plan) {
    const c = [0, 0, 0, 0];
    round.forEach((t) => c[t]++);
    const max = Math.max(...c);
    c.forEach((v, i) => v === max && expectedPoints[i]++);
  }
  let late = null;

  for (let r = 0; r < 5; r++) {
    const n = r + 1;
    const ids = await Promise.all(phones.map((p) => waitRound(p, n)));
    ok(new Set(ids).size === 1, `round ${n}: every phone is on the same round`);
    const roundId = ids[0];

    // Edge: a late joiner arrives after the game started (round 2).
    if (n === 2) {
      late = await phone(browser, "E2E Eddie (late)");
      await joinRoom(late, "/picklo", "/lobby", code, late.name).catch((e) => ok(false, "late joiner can join", e.message));
      late.playerId = params(late).playerId;
      ok(!!late.playerId && !phones.some((p) => p.playerId === late.playerId), "late joiner gets a new seat");
      // They shouldn't be left in the lobby with a host-only "start round" flow while a round is running.
      let where = "";
      try {
        await waitFor(async () => onPath(late, "/round") || onPath(late, "/pick-hand"), 15000, "late joiner leaves lobby");
        where = new URL(late.url()).pathname;
      } catch {
        where = new URL(late.url()).pathname + " :: " + (await text(late)).slice(0, 160).replace(/\s+/g, " ");
      }
      ok(where === "/round" || where === "/pick-hand", "late joiner is taken into the running game", where);
      await waitForText(late, /Du tittar på den här rundan/, 10000).catch(() => {});
      ok(/Du tittar på den här rundan/.test(await text(late)), "late joiner sees they are watching this match");
      await shot(late, "05-late-joiner");
    }

    // Edge: refresh mid-round before submitting (round 2, phone C).
    if (n === 2) {
      const c = phones[2];
      await c.reload({ waitUntil: "load" });
      await waitRound(c, 2);
      await waitFor(async () => (await handTileCount(c)) === 4, 15000, "hand after reload").catch(() => {});
      ok((await handTileCount(c)) === 4, "after refresh, phone C still has its hand (4 unused photos)");
      ok(params(c).playerId === phones[2].playerId, "after refresh, phone C keeps its seat");
    }

    // Edge: re-join via invite link mid-game (round 4, phone B) → same seat, back into the round.
    if (n === 4) {
      const b = phones[1];
      await joinRoom(b, "/picklo", "/lobby", code, b.name);
      ok(params(b).playerId === b.playerId, "re-joining via the invite link keeps the same seat");
      let where = "";
      try {
        await waitRound(b, 4, 15000);
        where = "/round";
      } catch {
        where = new URL(b.url()).pathname + " :: " + (await text(b)).slice(0, 160).replace(/\s+/g, " ");
      }
      ok(where === "/round", "re-joined player is taken back into the running round", where);
    }

    await Promise.all(phones.map((p) => submitFirstFromHand(p)));
    await Promise.all(phones.map((p) => waitForText(p, /Rösta på den roligaste/, 30000)));
    ok(true, `round ${n}: voting starts automatically after everyone submitted`);

    const tiles = await roundTiles(phones[0]);
    ok(tiles.length === 4 && phones.every((p) => tiles.some((t) => t.owner === p.playerId)), `round ${n}: 4 submissions, one per player`, JSON.stringify(tiles));

    if (late) {
      await waitRound(late, n, 15000).catch(() => {});
      await waitForText(late, /Rösta på den roligaste|Du tittar/, 10000).catch(() => {});
      const lt = await roundTiles(late);
      ok(lt.length === 4 && lt.every((t) => t.disabled), `round ${n}: late joiner sees the photos but can't vote`, JSON.stringify(lt.map((t) => t.disabled)));
    }

    if (n === 1) {
      // Edge: voting for your own photo (UI: tile is disabled / tap does nothing; API: rejected).
      const mine = (await roundTiles(phones[0])).find((t) => t.owner === phones[0].playerId);
      ok(mine?.disabled === true && /Din bild/.test(mine.label || ""), "own photo is marked 'Din bild' and not votable", JSON.stringify(mine));
      await clickTileOf(phones[0], phones[0].playerId);
      await wait(1200);
      const { data: sub } = await db.from("submissions").select("id").eq("round_id", roundId).eq("player_id", phones[0].playerId).single();
      const { data: v1 } = await db.from("votes").select("id").eq("round_id", roundId).eq("voter_player_id", phones[0].playerId);
      ok((v1 ?? []).length === 0, "tapping your own photo records no vote");
      const { error: selfErr } = await db.from("votes").insert({ round_id: roundId, voter_player_id: phones[0].playerId, submission_id: sub.id });
      ok(!!selfErr, "database rejects a vote for your own photo", selfErr?.message);
      await shot(phones[0], "03-voting");
    }

    // Edge: refresh during voting (round 3, phone D) → still sees own photo marked and can vote.
    if (n === 3) {
      const d = phones[3];
      await d.reload({ waitUntil: "load" });
      await waitRound(d, 3);
      await waitForText(d, /Rösta på den roligaste/, 15000);
      await waitFor(async () => (await roundTiles(d)).length === 4, 10000, "tiles after reload").catch(() => {});
      const t = await roundTiles(d);
      ok(t.find((x) => x.owner === d.playerId)?.disabled === true, "after refresh during voting, own photo is still locked", JSON.stringify(t));
    }

    // Cast votes per plan; the last voter's vote is timed.
    let lastVoteAt = 0;
    for (let v = 0; v < 4; v++) {
      const voter = phones[v];
      const target = phones[plan[r][v]];
      const clicked = await clickTileOf(voter, target.playerId);
      ok(clicked, `round ${n}: ${voter.name} votes for ${target.name}`);
      await waitFor(
        async () => /Du röstade|Rundvinnare|Vinnare/.test(await text(voter)),
        15000,
        `${voter.name} vote registered`
      ).catch(() => ok(false, `round ${n}: ${voter.name}'s vote registered`));
      lastVoteAt = Date.now();
    }

    // Winner overlay on every phone
    const overlayTimes = await Promise.all(
      phones.map(async (p) => {
        await waitForText(p, /Rundvinnare/, 20000);
        return Date.now() - lastVoteAt;
      })
    ).catch((e) => (ok(false, `round ${n}: winner overlay shown`, e.message), [NaN]));
    const topVotes = Math.max(...[0, 1, 2, 3].map((i) => plan[r].filter((x) => x === i).length));
    const ovText = await text(phones[2]);
    ok(new RegExp(`Rundvinnare[\\s\\S]*${topVotes} röst`).test(ovText), `round ${n}: overlay shows winner with ${topVotes} votes`);
    if (n === 1) await shot(phones[2], "04-winner-overlay");

    // Scores in the database after this round
    const { data: scores } = await db.from("room_scores").select("player_id,points").eq("room_id", roomId);
    const exp = [0, 0, 0, 0];
    for (const rr of plan.slice(0, n)) {
      const c = [0, 0, 0, 0];
      rr.forEach((x) => c[x]++);
      const m = Math.max(...c);
      c.forEach((vv, i) => vv === m && exp[i]++);
    }
    const got = phones.map((p) => scores?.find((s) => s.player_id === p.playerId)?.points ?? 0);
    ok(JSON.stringify(got) === JSON.stringify(exp), `round ${n}: points awarded correctly`, `got ${got} expected ${exp}`);

    // Time until the next screen (next round, or results after round 5)
    const nextAt = await Promise.all(
      phones.map(async (p) => {
        if (n < 5) await waitRound(p, n + 1, 30000);
        else await waitPath(p, "/results", 30000);
        return Date.now() - lastVoteAt;
      })
    );
    timings.push({ round: n, overlayMs: Math.max(...overlayTimes), nextMs: Math.max(...nextAt) });
    log(`round ${n}: overlay after ${Math.max(...overlayTimes)}ms, next screen after ${Math.max(...nextAt)}ms`);
  }

  // --- Results ---------------------------------------------------------------
  const winnerName = names[expectedPoints.indexOf(Math.max(...expectedPoints))];
  for (const p of phones) {
    await waitForText(p, /Slutresultat/, 15000);
    await waitFor(async () => new RegExp(`${winnerName}[\\s\\S]*${Math.max(...expectedPoints)} poäng`).test(await text(p)), 15000, "winner").catch(() => {});
    const tx = await text(p);
    ok(new RegExp(`Kvällens vinnare[\\s\\S]{0,12}${winnerName}[\\s\\S]{0,12}${Math.max(...expectedPoints)} poäng`, "i").test(tx), `${p.name}: results show ${winnerName} as winner`, tx.slice(0, 200).replace(/\s+/g, " "));
    ok(names.every((nm, i) => new RegExp(`${nm}\\s*${expectedPoints[i]}p`).test(tx) || (i > 2)), `${p.name}: podium points match the votes`);
  }
  await shot(host, "06-results-host");
  const { data: finalRoom } = await db.from("rooms").select("phase").eq("id", roomId).single();
  ok(finalRoom?.phase === "finished", "room phase is 'finished' after the last round", finalRoom?.phase);
  if (late) {
    await waitPath(late, "/results", 20000).catch(() => {});
    ok(onPath(late, "/results"), "late joiner also ends on the results screen", late.url());
  }
  ok(/Väntar på att värden startar/.test(await text(phones[1])), "guests see 'waiting for host' on results");

  // --- Play again ------------------------------------------------------------
  const everyone = late ? [...phones, late] : phones;
  await tap(host, ["Spela igen med samma gäng", "Play again with the same group"]);
  for (const p of everyone) await waitPath(p, "/pick-hand", 20000);
  ok(true, "play again: everyone lands on the photo screen");
  for (const p of phones) {
    await waitForText(p, /5 \/ 5/, 15000).catch(() => {});
    ok(/5 \/ 5/.test(await text(p)), `${p.name}: kept all 5 photos`);
  }
  await shot(phones[1], "07-play-again-pick-hand");
  if (late) {
    await uploadPhotos(late, makeImages("e", 5));
    await waitForText(late, /5 \/ 5/, 60000);
  }
  for (const p of everyone) await tap(p, ["Fortsätt", "Continue"]);
  for (const p of everyone) await waitPath(p, "/lobby", 20000);
  await waitForText(host, /Starta spel/, 10000);
  await tap(host, ["Starta spel", "Start game"]);
  const ids2 = await Promise.all(everyone.map((p) => waitRound(p, 1)));
  ok(new Set(ids2).size === 1, "second game: everyone is on round 1");
  await waitForText(phones[0], /Välj en bild \(5 kvar\)/, 10000).catch(() => {});
  const hand2 = await text(phones[0]);
  ok(/Välj en bild \(5 kvar\)/.test(hand2), "second game: full hand of 5 again", hand2.slice(-200).replace(/\s+/g, " "));
  // Edge: one player (Eddie) never plays a photo → the round must still move on when the 60 s timer ends.
  const r1Start = Date.now();
  await Promise.all(phones.map((p) => submitFirstFromHand(p)));
  const idle = late ?? null;
  await Promise.all(phones.map((p) => waitForText(p, /Rösta på den roligaste/, 90000)));
  const toVoting = Date.now() - r1Start;
  ok(toVoting > 45000, `second game: round waits for the idle player (${Math.round(toVoting / 1000)}s)`);
  log(`second game: voting started ${toVoting}ms after round start with one idle player`);
  if (idle) {
    await waitForText(idle, /Du tittar på den här rundan/, 15000).catch(() => {});
    ok(/Du tittar på den här rundan/.test(await text(idle)), "idle player is told they sit this vote out");
    ok((await roundTiles(idle)).every((t) => t.disabled), "idle player can't vote (would end the round early)");
  }
  for (let v = 0; v < phones.length; v++) await clickTileOf(phones[v], phones[(v + 1) % phones.length].playerId);
  await Promise.all(everyone.map((p) => waitRound(p, 2, 30000)));
  ok(true, "second game: round 1 finishes and round 2 starts");
  await shot(host, "08-second-game-round2");

  summarizePhoneIssues(ok, everyone);
  exitCode = done() ? 1 : 0;
} catch (e) {
  ok(false, "test crashed", e.stack || e.message);
  for (const p of phones) await shot(p, `crash-${p.name.replace(/\W+/g, "_")}`);
  exitCode = 1;
  done();
} finally {
  console.log("\nRound advance timings (after last vote):");
  for (const t of timings) console.log(`  round ${t.round}: winner overlay ${t.overlayMs}ms, next screen ${t.nextMs}ms`);
  console.log(`Total run: ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  await browser.close();
  process.exit(exitCode);
}
