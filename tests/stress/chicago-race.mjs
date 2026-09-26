// Scenario 5 — Chicago concurrent actions (5 phones, the app's own chicago/api.ts).
// - All phones press "Exchange" at the same instant in each of the 3 draw phases. The api serialises
//   draws with a lock on chicago_rooms.phase_ends_at (8 tries × 120 ms); phones that lose get an error
//   and (like a real player) tap again. We count how many first taps fail and check the cards stay
//   consistent (no duplicates, 5 cards each, nothing lost).
// - Every phone fires advanceChicagoPokerScore at once (the app auto-schedules it on every phone):
//   points must be awarded exactly once.
// - Tricks: on every turn the current player AND another player tap a card at the same time, and the
//   current player double-taps two different cards. Only one card may be played per turn.
//
//   node tests/stress/chicago-race.mjs
import path from "node:path";
import { pathToFileURL } from "node:url";
import { reporter } from "../lib.mjs";
import { ROOT, asPlayer, clients, loadApi, record, runStandalone, timed, wait, errText } from "./_common.mjs";

const N = 5;

export async function run() {
  const { ok, done } = reporter("chicago");
  const phones = await clients(N);
  const api = await loadApi("chicago");
  const logic = await import(pathToFileURL(path.join(ROOT, "src/games/chicago/logic.ts")).href);
  const host = phones[0];
  const unexpected = [];

  const created = await asPlayer(host, () => api.createChicagoRoom("STRESS CH Host"));
  const ids = [created.playerId];
  for (let i = 1; i < N; i++) ids.push((await asPlayer(phones[i], () => api.joinChicagoRoom(created.code, `STRESS CH ${i}`))).playerId);
  const roomId = created.roomId;
  const as = (i, fn) => asPlayer(phones[i], fn);

  await timed("chicago: startChicagoRound", () => as(0, () => api.startChicagoRound(roomId, ids[0])));

  const getHands = async () => (await host.from("chicago_player_hands").select("player_id,cards").eq("room_id", roomId)).data ?? [];
  const getRoom = async () => (await host.from("chicago_rooms").select("*").eq("id", roomId).single()).data;
  const getScores = async () =>
    Object.fromEntries(((await host.from("chicago_room_players").select("id,score").eq("room_id", roomId)).data ?? []).map((p) => [p.id, p.score]));

  async function checkCards(label) {
    const hands = await getHands();
    const { data: round } = await host.from("chicago_rounds").select("id,deck").eq("room_id", roomId).order("round_number", { ascending: false }).limit(1).single();
    const { data: draws } = await host.from("chicago_draw_actions").select("discarded_cards").eq("round_id", round.id);
    const all = [...hands.flatMap((h) => h.cards), ...round.deck, ...(draws ?? []).flatMap((d) => d.discarded_cards)].map(logic.cardId);
    ok(hands.length === N && hands.every((h) => h.cards.length === 5), `${label}: every hand has 5 cards`, hands.map((h) => h.cards.length).join(","));
    ok(all.length === 52 && new Set(all).size === 52, `${label}: 52 unique cards across hands, deck and discards`, `(total ${all.length}, unique ${new Set(all).size})`);
  }

  async function drawPhase(n, nextState, discards) {
    const hands = Object.fromEntries((await getHands()).map((h) => [h.player_id, h.cards]));
    const pending = new Set(ids.map((_, i) => i));
    let firstTapFailures = 0;
    let taps = 0;
    const t0 = performance.now();
    for (let attempt = 0; attempt < 6 && pending.size; attempt++) {
      const res = await Promise.all(
        [...pending].map(async (i) => {
          taps++;
          const s = performance.now();
          try {
            await as(i, () => api.submitChicagoDraw(roomId, ids[i], hands[ids[i]].slice(0, discards)));
            record("submitChicagoDraw (5 at once)", performance.now() - s);
            return { i, ok: true };
          } catch (e) {
            return { i, ok: false, e };
          }
        })
      );
      for (const r of res) {
        if (r.ok) pending.delete(r.i);
        else {
          if (attempt === 0) firstTapFailures++;
          if (!/Another draw is still being processed/.test(r.e.message)) unexpected.push(`draw ${n}: ${errText(r.e)}`);
        }
      }
      if (pending.size) await wait(400); // player notices the pop-up and taps again
    }
    record(`draw phase ${n}: until all 5 phones' draws went through`, performance.now() - t0);
    ok(pending.size === 0, `draw ${n}: all 5 draws eventually accepted`, `(${pending.size} never got through)`);
    ok(firstTapFailures === 0, `draw ${n}: nobody gets an error pop-up when everyone taps "Exchange" together`, `(${firstTapFailures} of 5 first taps failed with "Another draw is still being processed. Try again." — ${taps} taps in total)`);
    await wait(300);
    const room = await getRoom();
    ok(room.state === nextState, `draw ${n}: room moved to ${nextState}`, `(state=${room.state}, lock=${room.phase_ends_at})`);
    await checkCards(`after draw ${n}`);
  }

  async function pokerScore(n, nextState) {
    const hands = await getHands();
    const { winner, tied } = logic.getPokerWinnerWithTie(hands.map((h) => ({ playerId: h.player_id, cards: h.cards })));
    const before = await getScores();
    const res = await Promise.allSettled(ids.map((id, i) => as(i, () => timed("advanceChicagoPokerScore (5 at once)", () => api.advanceChicagoPokerScore(roomId, id)))));
    const errs = res.filter((r) => r.status === "rejected").map((r) => errText(r.reason));
    ok(errs.length === 0, `poker score ${n}: no phone gets an error`, errs.slice(0, 2).join(" | "));
    const after = await getScores();
    const expectedDelta = !tied && winner.evaluation.points > 0 ? winner.evaluation.points : 0;
    const deltas = ids.map((id) => after[id] - before[id]);
    const ok1 = ids.every((id) => after[id] - before[id] === (id === winner.playerId ? expectedDelta : 0));
    ok(ok1, `poker score ${n}: points awarded exactly once`, `(expected +${expectedDelta} to winner, deltas=${deltas.join(",")})`);
    const room = await getRoom();
    ok(room.state === nextState || room.state === "game_over", `poker score ${n}: room moved to ${nextState}`, `(state=${room.state})`);
  }

  // 5 players leave 27 cards in the deck: 2+1+1 exchanges each = 20 cards.
  await drawPhase(1, "poker_score_1", 2);
  await pokerScore(1, "draw_phase_2");
  await drawPhase(2, "poker_score_2", 1);
  await pokerScore(2, "draw_phase_3");
  await drawPhase(3, "trick_phase", 1);

  // --- Tricks -------------------------------------------------------------------
  const legal = (hand, leadSuit) => {
    const follow = leadSuit ? hand.filter((c) => c.suit === leadSuit) : [];
    return follow.length ? follow : hand;
  };
  const scoresBeforeTricks = await getScores();
  let notYourTurn = 0;
  let doubleTapBlocked = 0;
  const doubleTapErrors = new Set();
  let turnViolations = [];
  for (let turn = 0; turn < 5 * N + 2; turn++) {
    const room = await getRoom();
    if (room.state !== "trick_phase") break;
    const cur = ids.indexOf(room.current_turn_player_id);
    const other = (cur + 1 + Math.floor(Math.random() * (N - 1))) % N;
    const hands = Object.fromEntries((await getHands()).map((h) => [h.player_id, h.cards]));
    const { data: round } = await host.from("chicago_rounds").select("id,trick_number").eq("room_id", roomId).order("round_number", { ascending: false }).limit(1).single();
    const { data: trick } = await host.from("chicago_tricks").select("id,lead_suit").eq("round_id", round.id).eq("trick_number", round.trick_number).maybeSingle();
    const myLegal = legal(hands[ids[cur]], trick?.lead_suit);
    const otherLegal = legal(hands[ids[other]], trick?.lead_suit);
    const attempts = [
      { who: cur, card: myLegal[0], kind: "turn" },
      { who: other, card: otherLegal[0], kind: "out-of-turn" },
    ];
    if (myLegal[1]) attempts.push({ who: cur, card: myLegal[1], kind: "double-tap" });
    const res = await Promise.all(
      attempts.map((a) =>
        as(a.who, () => timed(`playChicagoCard (${a.kind})`, () => api.playChicagoCard(roomId, ids[a.who], a.card)))
          // {alreadyPlayed: true} = the database kept the first card; this tap played nothing.
          .then((v) => ({ ...a, ok: !(v && v.alreadyPlayed), ignored: !!(v && v.alreadyPlayed) }))
          .catch((e) => ({ ...a, ok: false, e }))
      )
    );
    const played = res.filter((r) => r.ok);
    if (played.length !== 1 || played[0].who !== cur) turnViolations.push(`turn ${turn}: ${played.map((p) => `${p.kind}`).join("+") || "nothing played"} ${res.filter((r) => !r.ok).map((r) => errText(r.e)).join(" / ")}`);
    for (const r of res.filter((x) => !x.ok && !x.ignored)) {
      if (r.kind === "out-of-turn" && /not your turn/i.test(r.e.message)) notYourTurn++;
      else if (r.kind === "double-tap" || (r.kind === "turn" && played.length)) {
        doubleTapBlocked++;
        doubleTapErrors.add(errText(r.e));
      }
      else unexpected.push(`trick ${r.kind}: ${errText(r.e)}`);
    }
    await wait(150);
  }
  ok(turnViolations.length === 0, "tricks: exactly one card (the current player's) is played per turn", turnViolations.slice(0, 3).join(" | "));
  ok(notYourTurn > 0, "tricks: out-of-turn taps are refused with 'It is not your turn'", `(${notYourTurn} refused)`);

  const room = await getRoom();
  ok(room.state === "result" || room.state === "game_over", "tricks: round finished", `(state=${room.state})`);
  const { data: round } = await host.from("chicago_rounds").select("id").eq("room_id", roomId).order("round_number", { ascending: false }).limit(1).single();
  const { data: tricks } = await host.from("chicago_tricks").select("id,trick_number,winner_player_id").eq("round_id", round.id).order("trick_number");
  const { data: cards } = await host.from("chicago_cards_played").select("trick_id,player_id,card").in("trick_id", (tricks ?? []).map((t) => t.id));
  ok((tricks ?? []).length === 5 && (cards ?? []).length === 25, "tricks: 5 tricks with 25 cards played", `(tricks=${tricks?.length}, cards=${cards?.length})`);
  ok((tricks ?? []).every((t) => (cards ?? []).filter((c) => c.trick_id === t.id).length === N), "tricks: every trick has one card from every player");
  const hands = await getHands();
  ok(hands.every((h) => h.cards.length === 0), "tricks: all hands are empty at the end", hands.map((h) => h.cards.length).join(","));

  // Scoring of the trick phase: +5 to last trick winner, + best final poker hand of played cards.
  const last = tricks?.[tricks.length - 1];
  const byPlayer = new Map();
  (cards ?? []).forEach((c) => byPlayer.set(c.player_id, [...(byPlayer.get(c.player_id) ?? []), c.card]));
  let best = null;
  for (const [pid, cs] of byPlayer) {
    const ev = logic.evaluatePokerHand(cs);
    if (!best || logic.comparePokerEvaluations(ev, best.ev) > 0) best = { pid, ev };
  }
  const expected = Object.fromEntries(ids.map((id) => [id, 0]));
  if (last?.winner_player_id) expected[last.winner_player_id] += 5;
  if (best && best.ev.points > 0) expected[best.pid] += best.ev.points;
  const after = await getScores();
  const deltas = ids.map((id) => after[id] - scoresBeforeTricks[id]);
  ok(ids.every((id, k) => deltas[k] === expected[id]), "tricks: round scoring applied exactly once", `(expected ${ids.map((id) => expected[id]).join(",")} got ${deltas.join(",")})`);

  ok(unexpected.length === 0, "no unexpected errors", unexpected.slice(0, 4).join(" | "));
  console.log(`  (info) double-tap / lost-race refusals: ${doubleTapBlocked}; messages the player sees: ${[...doubleTapErrors].join(" || ")}`);
  return done();
}

runStandalone(import.meta.url, run);
