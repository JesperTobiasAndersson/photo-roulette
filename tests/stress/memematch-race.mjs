// Scenario 3 — MemeMatch race.
// 10 phones: every round all of them submit within ~100 ms and call advance_round_if_ready
// concurrently (plus the extra calls the app makes whenever a realtime event arrives), then all
// vote within ~100 ms and advance again. Then every phone tries to create the next round at once
// (as round.tsx's nextRound does). Checks per round: collecting → voting → done exactly once,
// finalize_round scores exactly once, room_scores == expected, no unexpected errors.
// After 5 rounds: memematch_play_again resets the room, and one more round is played.
//
//   node tests/stress/memematch-race.mjs
import { PNG } from "pngjs";
import { reporter } from "../lib.mjs";
import { asPlayer, clients, loadApi, record, runStandalone, timed, wait, errText } from "./_common.mjs";

const N = 10;
const ROUNDS = 5;
const IMAGES_PER_PLAYER = 6;
const jitter = (ms) => wait(Math.random() * ms);

function tinyPng(seed) {
  const png = new PNG({ width: 4, height: 4 });
  for (let i = 0; i < png.data.length; i += 4) {
    png.data[i] = (seed * 37) % 256;
    png.data[i + 1] = (seed * 91) % 256;
    png.data[i + 2] = (i * 13) % 256;
    png.data[i + 3] = 255;
  }
  return PNG.sync.write(png);
}

export async function run() {
  const { ok, done } = reporter("memematch");
  const phones = await clients(N);
  const api = await loadApi("memematch");
  const host = phones[0];
  const unexpected = [];
  const note = (where, error) => {
    if (error) unexpected.push(`${where}: ${errText(error)}`);
  };

  // --- Lobby ---------------------------------------------------------------
  const created = await timed("memematch: create room", () => asPlayer(host, () => api.createMemeMatchRoom("STRESS MM Host")));
  const roomId = created.roomId;
  const { data: roomRow } = await host.from("rooms").select("code").eq("id", roomId).single();
  const joined = await Promise.all(
    phones.slice(1).map((c, i) => asPlayer(c, () => timed("join_room (memematch, 9 at once)", () => api.joinMemeMatchRoom(roomRow.code, `STRESS MM ${i + 1}`))))
  );
  const playerIds = [created.playerId, ...joined.map((j) => j.playerId)];
  ok(new Set(playerIds).size === N, `${N} distinct players in the room`);

  // Host: "Start" → picking.
  note("rooms → picking", (await host.from("rooms").update({ phase: "picking", statement_category: "innocent" }).eq("id", roomId)).error);

  // Everyone uploads their hand at the same time (pick-hand.tsx: storage upload, then player_images row).
  const hands = await Promise.all(
    phones.map(async (c, p) => {
      const rows = [];
      for (let i = 0; i < IMAGES_PER_PLAYER; i++) {
        const filePath = `${roomId}/hand/${playerIds[p]}-${Date.now()}-${i}.png`;
        const { error: upErr } = await timed("storage upload (hand photo)", () =>
          c.storage.from("game-images").upload(filePath, tinyPng(p * 10 + i), { contentType: "image/png", upsert: false })
        );
        note(`upload p${p}`, upErr);
        const { data, error } = await timed("player_images insert", () =>
          c.from("player_images").insert({ room_id: roomId, player_id: playerIds[p], image_path: filePath, used_in_round_id: null }).select("id,image_path").single()
        );
        note(`player_images p${p}`, error);
        if (data) rows.push(data);
      }
      return rows;
    })
  );
  ok(hands.every((h) => h.length === IMAGES_PER_PLAYER), `every phone uploaded ${IMAGES_PER_PLAYER} photos`);

  // Observer: the host listens to round changes (like round.tsx does).
  const events = new Map(); // roundId -> [{status, scored}]
  const observer = host
    .channel(`stress-mm-${roomId}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "rounds", filter: `room_id=eq.${roomId}` }, (p) => {
      if (!p.new?.id) return;
      if (!events.has(p.new.id)) events.set(p.new.id, []);
      events.get(p.new.id).push({ type: p.eventType, status: p.new.status, scored: p.new.scored });
    });
  await new Promise((res) => observer.subscribe((s) => s === "SUBSCRIBED" && res()));
  await wait(800);

  // Host: startRound (lobby.tsx).
  async function hostStartsRound(roundNumber) {
    const { count } = await host.from("players").select("*", { count: "exact", head: true }).eq("room_id", roomId);
    note("rooms → playing", (await host.from("rooms").update({ expected_players: count, phase: "playing" }).eq("id", roomId)).error);
    const { data, error } = await host
      .from("rounds")
      .insert({ room_id: roomId, statement: `STRESS statement ${roundNumber}`, status: "collecting", ends_at: new Date(Date.now() + 60_000).toISOString(), round_number: roundNumber })
      .select("id")
      .single();
    note("rounds insert (start)", error);
    return data?.id;
  }

  const expectedScores = new Map();
  const used = phones.map(() => new Set());
  let roundId = await hostStartsRound(1);

  async function waitStatus(id, status, ms = 8000) {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      const { data } = await host.from("rounds").select("status,scored").eq("id", id).single();
      if (data?.status === status) return data;
      await wait(100);
    }
    return null;
  }

  async function playRound(roundNumber, id) {
    const advanceResults = [];
    const advance = (c, label) =>
      timed(`advance_round_if_ready (${label})`, () => c.rpc("advance_round_if_ready", { p_round_id: id })).then(({ data, error }) => {
        note(`advance ${label}`, error);
        advanceResults.push(data);
      });

    // Submit: all 10 within ~100 ms; each phone then advances, and again when "realtime" fires.
    const subs = await Promise.all(
      phones.map(async (c, p) => {
        await jitter(100);
        const img = hands[p].find((h) => !used[p].has(h.id));
        used[p].add(img.id);
        const { data: sub, error } = await timed("submissions insert", () =>
          c.from("submissions").insert({ round_id: id, player_id: playerIds[p], image_path: img.image_path }).select("id").single()
        );
        note(`submit p${p}`, error);
        const { error: lockErr } = await timed("player_images lock", () =>
          c.from("player_images").update({ used_in_round_id: id }).eq("id", img.id).eq("room_id", roomId).eq("player_id", playerIds[p]).is("used_in_round_id", null)
        );
        note(`lock p${p}`, lockErr);
        await advance(c, "after submit");
        await jitter(150);
        await advance(c, "realtime echo");
        return sub?.id;
      })
    );
    const voting = await waitStatus(id, "voting");
    ok(!!voting, `round ${roundNumber}: moved to voting`);

    // Vote: everyone votes for someone else's photo within ~100 ms, then advances twice.
    const votes = await Promise.all(
      phones.map(async (c, p) => {
        await jitter(100);
        const choices = subs.filter((s, i) => i !== p && s);
        const target = choices[Math.floor(Math.random() * choices.length)];
        const { error } = await timed("votes insert", () => c.from("votes").insert({ round_id: id, voter_player_id: playerIds[p], submission_id: target }));
        note(`vote p${p}`, error);
        await advance(c, "after vote");
        await jitter(150);
        await advance(c, "realtime echo");
        return target;
      })
    );
    const doneRow = await waitStatus(id, "done");
    ok(!!doneRow && doneRow.scored === true, `round ${roundNumber}: done and scored`);

    // Every phone also calls finalize_round directly (older app path) — must not double-score.
    await Promise.all(phones.slice(0, 4).map((c) => c.rpc("finalize_round", { p_round_id: id }).then(({ error }) => note("finalize again", error))));

    // Expected: +1 for every submission with the max vote count.
    const tally = new Map();
    votes.forEach((s) => tally.set(s, (tally.get(s) ?? 0) + 1));
    const max = Math.max(...tally.values());
    subs.forEach((s, p) => {
      if (tally.get(s) === max) expectedScores.set(playerIds[p], (expectedScores.get(playerIds[p]) ?? 0) + 1);
    });

    await wait(1200); // let realtime catch up
    const ev = events.get(id) ?? [];
    const toVoting = ev.filter((e) => e.type === "UPDATE" && e.status === "voting" && !e.scored).length;
    const scoredEv = ev.filter((e) => e.type === "UPDATE" && e.scored && e.status === "voting").length;
    const toDone = ev.filter((e) => e.type === "UPDATE" && e.status === "done").length;
    ok(toVoting === 1 && scoredEv === 1 && toDone === 1, `round ${roundNumber}: exactly one collecting→voting, one finalize and one →done`, `events=${JSON.stringify(ev.map((e) => `${e.type[0]}:${e.status}${e.scored ? "*" : ""}`))}`);
    ok(advanceResults.filter((r) => r === "voting").length >= 1, `round ${roundNumber}: advance calls reported the transitions`, `results=${[...new Set(advanceResults)].join(",")}`);

    const { data: scores, error: sErr } = await host.from("room_scores").select("player_id,points").eq("room_id", roomId);
    note("room_scores read", sErr);
    const actual = new Map((scores ?? []).map((s) => [s.player_id, s.points]));
    const mismatch = playerIds.filter((pid) => (actual.get(pid) ?? 0) !== (expectedScores.get(pid) ?? 0));
    ok(mismatch.length === 0, `round ${roundNumber}: room_scores match (awarded exactly once)`, mismatch.length ? `expected ${JSON.stringify([...expectedScores])} got ${JSON.stringify([...actual])}` : "");
  }

  for (let r = 1; r <= ROUNDS; r++) {
    await playRound(r, roundId);
    if (r === ROUNDS) break;
    // Every phone's nextRound() fires at about the same time; exactly one insert may win.
    const inserts = await Promise.all(
      phones.map(async (c) => {
        await jitter(60);
        return timed("rounds insert (next round race)", () =>
          c.from("rounds").insert({ room_id: roomId, statement: `STRESS statement ${r + 1}`, status: "collecting", ends_at: new Date(Date.now() + 60_000).toISOString(), round_number: r + 1 }).select("id").single()
        );
      })
    );
    const winners = inserts.filter((i) => !i.error);
    const dupes = inserts.filter((i) => i.error && /duplicate|unique|rounds_room_roundnumber_unique/i.test(i.error.message));
    ok(winners.length === 1 && dupes.length === N - 1, `round ${r + 1}: exactly one phone created it, the others got the handled "duplicate" error`, `(created=${winners.length}, dup=${dupes.length})`);
    inserts.filter((i) => i.error && !dupes.includes(i)).forEach((i) => note("next round insert", i.error));
    roundId = winners[0]?.data?.id;
  }

  // Vote change after the round is over (round.tsx lets you tap another photo any time).
  {
    const { data: lastVote } = await phones[1].from("votes").select("id,submission_id").eq("round_id", roundId).eq("voter_player_id", playerIds[1]).single();
    const { data: others } = await phones[1].from("submissions").select("id,player_id").eq("round_id", roundId);
    const alt = (others ?? []).find((s) => s.player_id !== playerIds[1] && s.id !== lastVote?.submission_id);
    const { data: changed, error } = await phones[1].from("votes").update({ submission_id: alt.id }).eq("id", lastVote.id).select("id");
    ok(!!error || (changed ?? []).length === 0, "a vote can't be changed after the round is done (scores are already final)", error ? "" : "update ACCEPTED on a 'done' round");
    // Put it back so later checks stay consistent.
    if (!error && (changed ?? []).length) await phones[1].from("votes").update({ submission_id: lastVote.submission_id }).eq("id", lastVote.id);
  }

  // --- Play again ------------------------------------------------------------
  const { error: againErr } = await timed("memematch_play_again", () => asPlayer(host, () => api.playMemeMatchAgain(roomId).then(() => ({})).catch((e) => ({ error: e }))));
  note("play again", againErr);
  const [{ count: roundsLeft }, { count: scoresLeft }, { data: room2 }, { data: imgs }] = await Promise.all([
    host.from("rounds").select("*", { count: "exact", head: true }).eq("room_id", roomId),
    host.from("room_scores").select("*", { count: "exact", head: true }).eq("room_id", roomId),
    host.from("rooms").select("phase,expected_players").eq("id", roomId).single(),
    host.from("player_images").select("used_in_round_id").eq("room_id", roomId),
  ]);
  ok(roundsLeft === 0 && scoresLeft === 0, "play again: rounds and scores cleared", `(rounds=${roundsLeft}, scores=${scoresLeft})`);
  ok(room2?.phase === "picking", "play again: room back to picking", `(phase=${room2?.phase})`);
  ok((imgs ?? []).length === N * IMAGES_PER_PLAYER && imgs.every((i) => i.used_in_round_id === null), "play again: everyone keeps all photos, unlocked");

  expectedScores.clear();
  used.forEach((s) => s.clear());
  roundId = await hostStartsRound(1);
  await playRound(1, roundId);

  ok(unexpected.length === 0, "no unexpected errors anywhere", unexpected.slice(0, 5).join(" | "));
  await observer.unsubscribe();
  return done();
}

runStandalone(import.meta.url, run);
