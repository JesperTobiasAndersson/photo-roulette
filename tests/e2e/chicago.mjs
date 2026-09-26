// End-to-end test for Chicago (Swedish card game): 2, 3 and 4 real "phones".
//
//   node tests/e2e/chicago.mjs                 (all scenarios: 2, 3 and 4 players)
//   PLAYERS=2 node tests/e2e/chicago.mjs       (one scenario)
//   MAX_ROUNDS=40 node tests/e2e/chicago.mjs   (cap per game, default 40)
//
// Every round is played through the UI like real players: deal -> three exchanges (a mix of
// exchanging selected cards and keeping, sometimes all phones at the same moment) -> the two
// automatic poker scorings (every phone races to score) -> CHICAGO calls -> five tricks with legal
// cards picked from what each phone shows. The database (read with each phone's own session,
// exactly what the phone may read) is used to assert the outcome: who won each poker scoring
// (independent poker evaluator below, cross-checked against src/games/chicago/logic.ts), the last
// trick's 5 points, CHICAGO +15 / -15, buy stop at 46+, game over at 52 and "play again".
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import {
  BASE,
  ROOT,
  createRoom,
  joinRoom,
  launch,
  loadEnv,
  phone,
  reporter,
  summarizePhoneIssues,
  tap,
  text,
  wait,
} from "../lib.mjs";
import * as appLogic from "../../src/games/chicago/logic.ts";

const MAX_ROUNDS = Number(process.env.MAX_ROUNDS || 40);
const SCENARIOS = (process.env.PLAYERS || "2,3,4").split(",").map(Number);
const ART = path.join(ROOT, "tests", "artifacts", "chicago");
fs.mkdirSync(ART, { recursive: true });
const env = loadEnv();
const { ok, done } = reporter("chicago");
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

// ---------------------------------------------------------------------------
// Cards & an independent poker evaluator
// ---------------------------------------------------------------------------
const RV = { 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, 10: 10, J: 11, Q: 12, K: 13, A: 14 };
const SUIT_SV = { clubs: "klöver", diamonds: "ruter", hearts: "hjärter", spades: "spader" };
const SV_SUIT = Object.fromEntries(Object.entries(SUIT_SV).map(([k, v]) => [v, k]));
const SYM = { clubs: "♣", diamonds: "♦", hearts: "♥", spades: "♠" };
const cid = (c) => `${c.rank}-${c.suit}`;
const label = (c) => `${c.rank} ${SUIT_SV[c.suit]}`;
const show = (cards) => cards.map((c) => `${c.rank}${SYM[c.suit]}`).join(" ");
const sameSet = (a, b) => a.length === b.length && a.map(cid).sort().join() === b.map(cid).sort().join();
const POINTS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 52];
const CAT_NAME = ["high_card", "pair", "two_pair", "three_of_a_kind", "straight", "flush", "full_house", "four_of_a_kind", "straight_flush", "royal_straight_flush"];

function evalHand(cards) {
  const v = cards.map((c) => RV[c.rank]).sort((a, b) => b - a);
  const flush = new Set(cards.map((c) => c.suit)).size === 1;
  const uniq = [...new Set(v)];
  let high = null;
  if (uniq.length === 5) {
    if (v[0] - v[4] === 4) high = v[0];
    else if (v.join() === "14,5,4,3,2") high = 5;
  }
  const counts = new Map();
  v.forEach((x) => counts.set(x, (counts.get(x) || 0) + 1));
  const groups = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  const c = groups.map((g) => g[1]);
  const gv = groups.map((g) => g[0]);
  let key;
  if (flush && high === 14) key = [9];
  else if (flush && high) key = [8, high];
  else if (c[0] === 4) key = [7, ...gv];
  else if (c[0] === 3 && c[1] === 2) key = [6, ...gv];
  else if (flush) key = [5, ...v];
  else if (high) key = [4, high];
  else if (c[0] === 3) key = [3, ...gv];
  else if (c[0] === 2 && c[1] === 2) key = [2, ...gv];
  else if (c[0] === 2) key = [1, ...gv];
  else key = [0, ...v];
  return { cat: key[0], name: CAT_NAME[key[0]], points: POINTS[key[0]], key };
}
const cmpKey = (a, b) => {
  for (let i = 0; i < Math.max(a.length, b.length); i++) if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) - (b[i] ?? 0);
  return 0;
};
/** {winner, points, tied, evals} for a list of {id, cards}. */
function pokerOutcome(entries) {
  const evals = entries.map((e) => ({ id: e.id, ev: evalHand(e.cards) }));
  let best = evals[0];
  for (const e of evals.slice(1)) if (cmpKey(e.ev.key, best.ev.key) > 0) best = e;
  const tied = evals.filter((e) => cmpKey(e.ev.key, best.ev.key) === 0).length > 1;
  return { winner: best.id, points: best.ev.points, tied, name: best.ev.name, evals };
}

// Cross-check the app's evaluator with ours on fixed and random hands.
function crossCheckEvaluator() {
  const C = (s) =>
    s.split(" ").map((t) => ({ rank: t.slice(0, -1), suit: { c: "clubs", d: "diamonds", h: "hearts", s: "spades" }[t.slice(-1)] }));
  const fixed = {
    "10s Js Qs Ks As": "royal_straight_flush",
    "As 2s 3s 4s 5s": "straight_flush",
    "9h 9d 9s 9c 2h": "four_of_a_kind",
    "3h 3d 3s Kc Kh": "full_house",
    "2h 7h 9h Jh Kh": "flush",
    "Ah 2d 3s 4c 5h": "straight",
    "10h Jd Qs Kc Ah": "straight",
    "7h 7d 7s Kc 2h": "three_of_a_kind",
    "7h 7d 5s 5c 2h": "two_pair",
    "Ah Ad 5s 6c 2h": "pair",
    "Ah Kd 5s 6c 2h": "high_card",
    "Kh Ad 2s 3c 4h": "high_card",
  };
  for (const [hand, name] of Object.entries(fixed)) {
    const ours = evalHand(C(hand)).name;
    const app = appLogic.evaluatePokerHand(C(hand)).name;
    if (ours !== name || app !== name) return ok(false, `poker ranking: ${hand} should be ${name}`, `ours=${ours} app=${app}`);
  }
  const deck = appLogic.makeDeck();
  for (let i = 0; i < 4000; i++) {
    const d = appLogic.shuffleDeck(deck);
    const a = d.slice(0, 5);
    const b = d.slice(5, 10);
    const ours = Math.sign(cmpKey(evalHand(a).key, evalHand(b).key));
    const app = Math.sign(appLogic.comparePokerEvaluations(appLogic.evaluatePokerHand(a), appLogic.evaluatePokerHand(b)));
    if (ours !== app || evalHand(a).name !== appLogic.evaluatePokerHand(a).name)
      return ok(false, "poker ranking: app and independent evaluator agree on random hands", `${show(a)} vs ${show(b)}`);
  }
  return ok(true, "poker ranking in logic.ts matches an independent evaluator (12 fixed + 4000 random hands)");
}

// ---------------------------------------------------------------------------
// Phone helpers
// ---------------------------------------------------------------------------
async function sessionToken(page) {
  return page.evaluate(() => {
    for (const k of Object.keys(localStorage)) {
      if (k.startsWith("sb-") && k.endsWith("-auth-token")) {
        const v = JSON.parse(localStorage.getItem(k));
        return v?.access_token ?? v?.currentSession?.access_token ?? null;
      }
    }
    return null;
  });
}
/** A supabase client acting as this phone (same session => same RLS view). Refreshed every 10 min. */
async function phoneDb(p) {
  if (!p._db || Date.now() - p._dbAt > 10 * 60 * 1000) {
    const token = await sessionToken(p);
    if (!token) throw new Error(`${p.name}: no session token`);
    p._db = createClient(env.EXPO_PUBLIC_SUPABASE_URL, env.EXPO_PUBLIC_SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    p._dbAt = Date.now();
  }
  return p._db;
}

async function snap(G) {
  const db = await phoneDb(G.host);
  const q = async (b) => {
    const { data, error } = await b;
    if (error) throw new Error(error.message);
    return data;
  };
  const [room, players, round, hands] = await Promise.all([
    q(db.from("chicago_rooms").select("*").eq("id", G.roomId).single()),
    q(db.from("chicago_room_players").select("*").eq("room_id", G.roomId).order("seat_order")),
    q(db.from("chicago_rounds").select("*").eq("room_id", G.roomId).order("round_number", { ascending: false }).limit(1).maybeSingle()),
    q(db.from("chicago_player_hands").select("*").eq("room_id", G.roomId)),
  ]);
  let trick = null;
  let played = [];
  let allTricks = [];
  if (round) {
    allTricks = await q(db.from("chicago_tricks").select("*").eq("round_id", round.id).order("trick_number"));
    trick = allTricks.find((t) => t.trick_number === round.trick_number) ?? null;
    if (trick) played = await q(db.from("chicago_cards_played").select("*").eq("trick_id", trick.id).order("play_order"));
  }
  const score = Object.fromEntries(players.map((p) => [p.id, p.score]));
  const hand = Object.fromEntries(hands.map((h) => [h.player_id, h.cards]));
  return { room, players, round, hands, hand, trick, played, allTricks, score };
}

async function waitFor(desc, fn, timeout = 30000, every = 350) {
  const start = Date.now();
  let last;
  while (Date.now() - start < timeout) {
    try {
      last = await fn();
      if (last) return last;
    } catch (e) {
      last = e;
    }
    await wait(every);
  }
  throw new Error(`timed out (${timeout}ms) waiting for ${desc}${last instanceof Error ? ": " + last.message : ""}`);
}

/** Cards shown in "Din hand" (the big cards; the 52px-wide ones are the cards on the table). */
async function domCards(page) {
  return page.evaluate((SV_SUIT) => {
    const re = /^(10|[2-9JQKA]) (klöver|ruter|hjärter|spader)$/;
    const out = { hand: [], table: [] };
    for (const el of document.querySelectorAll("[aria-label]")) {
      const m = (el.getAttribute("aria-label") || "").match(re);
      if (!m || el.offsetParent === null) continue;
      const r = el.getBoundingClientRect();
      const card = { rank: m[1], suit: SV_SUIT[m[2]], selected: el.getAttribute("aria-selected") === "true" || parseFloat(el.style.borderWidth || "0") > 2, button: el.getAttribute("role") === "button" };
      (Math.round(r.width) === 52 && Math.round(r.height) === 72 ? out.table : out.hand).push(card);
    }
    return out;
  }, SV_SUIT);
}

async function clickCard(page, card) {
  const clicked = await page.evaluate((lab) => {
    const els = [...document.querySelectorAll("[aria-label]")].filter(
      (el) => el.getAttribute("aria-label") === lab && el.offsetParent !== null && Math.round(el.getBoundingClientRect().width) !== 52
    );
    if (!els.length) return false;
    els[els.length - 1].click();
    return true;
  }, label(card));
  if (!clicked) throw new Error(`${page.name}: card ${label(card)} not on screen`);
}

const norm = (s) => s.replace(/\s+/g, " ");
async function shot(G, name) {
  try {
    await G.host.screenshot({ path: path.join(ART, `${G.n}p-${name}.png`) });
  } catch {}
}
async function shotOf(G, p, name) {
  try {
    await p.screenshot({ path: path.join(ART, `${G.n}p-${name}-${p.name.replace(/\W+/g, "")}.png`) });
  } catch {}
}
/** Consume an expected dialog (so it isn't counted as an unexpected pop-up later). */
function takeDialog(p, re) {
  const i = p.dialogs.findIndex((d) => re.test(d));
  if (i < 0) return null;
  return p.dialogs.splice(i, 1)[0];
}

async function scoreboardMatches(G, p, s) {
  const t = norm(await text(p));
  return s.players.every((pl) => {
    const esc = pl.display_name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`${esc}[^0-9-]{0,40}${String(pl.score).replace("-", "\\-")}(?![0-9])`).test(t);
  });
}

// ---------------------------------------------------------------------------
// Strategies
// ---------------------------------------------------------------------------
/** Keep what makes a hand; throw the rest. */
function greedyDiscards(cards) {
  const byRank = new Map();
  cards.forEach((c) => byRank.set(c.rank, [...(byRank.get(c.rank) || []), c]));
  const multiples = [...byRank.values()].filter((g) => g.length >= 2).flat();
  const bySuit = new Map();
  cards.forEach((c) => bySuit.set(c.suit, [...(bySuit.get(c.suit) || []), c]));
  const flushDraw = [...bySuit.values()].find((g) => g.length >= 4);
  const ev = evalHand(cards);
  if (ev.cat >= 4 && ev.cat !== 7) return []; // straight or better: keep
  if (ev.cat === 7) return cards.filter((c) => byRank.get(c.rank).length === 1); // quads: swap kicker
  if (flushDraw && multiples.length <= 2) return cards.filter((c) => !flushDraw.includes(c));
  const vals = [...new Set(cards.map((c) => RV[c.rank]))].sort((a, b) => a - b);
  for (let lo = 2; lo <= 10; lo++) {
    const window = [lo, lo + 1, lo + 2, lo + 3, lo + 4];
    const have = window.filter((v) => vals.includes(v));
    if (have.length === 4 && multiples.length === 0) {
      const keep = [];
      return cards.filter((c) => {
        const v = RV[c.rank];
        if (window.includes(v) && !keep.includes(v)) {
          keep.push(v);
          return false;
        }
        return true;
      });
    }
  }
  if (multiples.length) return cards.filter((c) => !multiples.includes(c));
  // Nothing: keep the ace/king, swap the rest.
  const sorted = [...cards].sort((a, b) => RV[b.rank] - RV[a.rank]);
  return sorted.slice(1);
}

/** Legal cards given the hand and the cards already on the table (lead = first card). */
function legalCards(hand, table) {
  if (!table.length) return hand;
  const lead = table[0].suit;
  const follow = hand.filter((c) => c.suit === lead);
  return follow.length ? follow : hand;
}

function chooseCard(hand, table, style) {
  const legal = legalCards(hand, table);
  const sorted = [...legal].sort((a, b) => RV[b.rank] - RV[a.rank]);
  if (style === "high") return sorted[0];
  if (style === "low") return sorted[sorted.length - 1];
  return sorted[Math.floor(Math.random() * sorted.length)];
}

/** Would `id` win every trick leading each of its cards (each card beats every same-suit card elsewhere)? */
function guaranteedChicago(s, id) {
  const mine = s.hand[id] || [];
  const others = s.hands.filter((h) => h.player_id !== id).flatMap((h) => h.cards);
  return mine.length === 5 && mine.every((c) => !others.some((o) => o.suit === c.suit && RV[o.rank] > RV[c.rank]));
}

// ---------------------------------------------------------------------------
// Game flow
// ---------------------------------------------------------------------------
async function waitState(G, states, timeout = 45000) {
  const list = Array.isArray(states) ? states : [states];
  return waitFor(`room state ${list.join("/")}`, async () => {
    const s = await snap(G);
    return list.includes(s.room.state) ? s : null;
  }, timeout, 400);
}

async function checkPhonesAgree(G, what) {
  const s = await snap(G);
  let agree = true;
  try {
    await waitFor(`${what}: every phone shows the same scores`, async () => {
      for (const p of G.phones) if (!(await scoreboardMatches(G, p, s))) return false;
      return true;
    }, 15000, 600);
  } catch (e) {
    agree = false;
  }
  G.checks.scoreboards += 1;
  if (!agree) ok(false, `${G.n}p ${what}: every phone shows the database scores`, s.players.map((p) => `${p.display_name}=${p.score}`).join(", "));
  return s;
}

async function dealRound(G) {
  const before = await snap(G);
  const lbl = before.room.state === "lobby" ? ["Dela ut runda"] : ["Dela nästa runda"];
  await tap(G.host, lbl);
  const s = await waitState(G, "draw_phase_1", 30000);
  ok(s.round.round_number === before.room.current_round + 1, `${G.n}p round ${s.round.round_number}: dealt`, "", true);
  return s;
}

/** One exchange phase. Returns the snapshot after the phase ended. */
async function drawPhase(G, k, plan) {
  let s = await waitState(G, `draw_phase_${k}`);
  // Every phone must show exactly its own five cards from the database.
  await waitFor(`${G.n}p draw ${k}: phones show their hands`, async () => {
    for (const p of G.phones) {
      const d = await domCards(p);
      if (!sameSet(d.hand, s.hand[p.pid] || [])) return false;
    }
    return true;
  }, 20000);
  // Deck + hands never contain a card twice.
  const all = [...s.round.deck, ...s.hands.flatMap((h) => h.cards)];
  if (new Set(all.map(cid)).size !== all.length) ok(false, `${G.n}p draw ${k}: no duplicate cards in deck + hands`);

  const decisions = [];
  for (const p of G.phones) {
    const hand = s.hand[p.pid];
    const buyStop = s.score[p.pid] >= 46;
    let discards = [];
    if (!buyStop) discards = plan(p, hand, k, s);
    decisions.push({ p, hand, discards, buyStop });
  }

  const act = async ({ p, hand, discards, buyStop }) => {
    if (buyStop) {
      G.checks.buyStop += 1;
      const t = await text(p);
      ok(/Köpstopp aktivt/i.test(t) && /Köpstopp: behåll hand/.test(t), `${G.n}p ${p.name} at ${s.score[p.pid]} points sees "Köpstopp aktivt" and can only keep`);
      await clickCard(p, hand[0]).catch(() => {});
      await wait(300);
      const d = await domCards(p);
      ok(!d.hand.some((c) => c.selected) && !d.hand.some((c) => c.button), `${G.n}p ${p.name}: buy stop - cards cannot be selected`);
      await tap(p, ["Köpstopp: behåll hand"]);
      await shotOf(G, p, "buy-stop");
      return;
    }
    for (const c of discards) {
      await clickCard(p, c);
      await wait(60);
    }
    if (discards.length) {
      const want = `Byt ${discards.length} kort`;
      await waitFor(`${p.name}: button "${want}"`, async () => (await text(p)).includes(want), 5000, 200);
      const d = await domCards(p);
      const sel = d.hand.filter((c) => c.selected);
      if (!sameSet(sel, discards)) ok(false, `${G.n}p ${p.name}: selected cards are highlighted`, show(sel));
      await tap(p, [want]);
    } else {
      await tap(p, ["Behåll nuvarande hand"]);
    }
  };

  const wanted = decisions.reduce((n, d) => n + d.discards.length, 0);
  if (wanted > s.round.deck.length) {
    G.stats.reshuffles = (G.stats.reshuffles || 0) + 1;
    log(`${G.n}p draw ${k}: ${wanted} cards wanted, ${s.round.deck.length} left in the stock -> discards must be reshuffled`);
  }
  const simultaneous =(s.round.round_number + k) % 2 === 0 || G.n === 4;
  if (simultaneous) await Promise.all(decisions.map(act));
  else for (const d of decisions) {
    await act(d);
    await wait(250);
  }
  G.stats.draws[simultaneous ? "simultaneous" : "sequential"] += 1;

  s = await waitFor(`${G.n}p draw ${k} completes`, async () => {
    const x = await snap(G);
    return x.room.state !== `draw_phase_${k}` && x.round.draw_number >= k ? x : null;
  }, 45000);

  // Hands after the exchange: kept cards stay, exactly as many new cards come in.
  for (const { p, hand, discards } of decisions) {
    const after = s.room.state === "trick_phase" || s.room.state.startsWith("poker") ? s.hand[p.pid] : null;
    if (!after) continue;
    const kept = hand.filter((c) => !discards.some((d) => cid(d) === cid(c)));
    const fine = after.length === 5 && kept.every((c) => after.some((a) => cid(a) === cid(c))) && discards.every((d) => !after.some((a) => cid(a) === cid(d)));
    G.checks.exchanges += 1;
    if (!fine) ok(false, `${G.n}p draw ${k}: ${p.name} exchanged ${discards.length} and kept the rest`, `${show(hand)} -> ${show(after)}`);
    if (discards.length) G.stats.exchanged += 1;
    else G.stats.kept += 1;
  }
  return s;
}

/** After poker scoring k the room moves on to draw k+1 (or game over). Verify the point. */
async function pokerScoring(G, k, sBefore) {
  const hands = sBefore.hands.map((h) => ({ id: h.player_id, cards: h.cards }));
  const exp = pokerOutcome(hands);
  const s = await waitState(G, [`draw_phase_${k + 1}`, "game_over"], 30000);
  const award = !exp.tied && exp.points > 0 ? exp.points : 0;
  const deltas = s.players.map((p) => ({ p, d: p.score - sBefore.score[p.id] }));
  const good = deltas.every(({ p, d }) => d === (p.id === exp.winner ? award : 0));
  const winnerName = s.players.find((p) => p.id === exp.winner)?.display_name;
  ok(
    good,
    `${G.n}p round ${s.round.round_number} poker ${k}: ${exp.tied ? "tie -> no points" : `${winnerName} (${exp.name}) gets ${award}`}`,
    good ? "" : `deltas ${deltas.map(({ p, d }) => `${p.display_name}:${d}`).join(" ")} hands ${hands.map((h) => show(h.cards)).join(" | ")}`
  );
  G.stats.pokerScorings += 1;
  if (award) G.stats.pokerPoints += award;
  // Every phone shows the scoring message.
  if (s.room.state !== "game_over") {
    const re = exp.tied ? /blev lika/ : award ? new RegExp(`vinner ${k === 1 ? "första" : "andra"} poängsättningen`) : /högsta kortet/;
    for (const p of G.phones) {
      const seen = await waitFor(`${p.name}: scoring message`, async () => re.test(await text(p)), 8000, 300).catch(() => false);
      if (!seen) ok(false, `${G.n}p ${p.name} sees the poker scoring result`, String(re));
    }
  }
  return s;
}

async function playTricks(G, s0, opts) {
  let s = s0;
  const roundNo = s.round.round_number;
  let declarer = null;
  // --- CHICAGO -------------------------------------------------------------
  const candidate = opts.declare?.(s);
  if (candidate) {
    const p = G.byId[candidate.id];
    if (candidate.rig) {
      // Give the caller the top-5 cards among all hands (each then beats every same-suit card elsewhere).
      const pool = s.hands.flatMap((h) => h.cards.map((c) => ({ c, owner: h.player_id })));
      pool.sort((a, b) => RV[b.c.rank] - RV[a.c.rank]);
      const top = pool.slice(0, 5).map((x) => x.c);
      const mineOld = s.hand[p.pid].filter((c) => !top.some((t) => cid(t) === cid(c)));
      const db = await phoneDb(p);
      for (const h of s.hands) {
        if (h.player_id === p.pid) continue;
        const cards = h.cards.map((c) => (top.some((t) => cid(t) === cid(c)) ? mineOld.shift() : c));
        await db.from("chicago_player_hands").update({ cards }).eq("player_id", h.player_id);
      }
      await db.from("chicago_player_hands").update({ cards: top }).eq("player_id", p.pid);
      s = await snap(G);
      log(`rigged ${p.name}'s hand for a CHICAGO: ${show(s.hand[p.pid])}`);
    }
    await p.evaluate(() => {
      window.__confirms = [];
      window.confirm = (m) => {
        window.__confirms.push(m);
        return true;
      };
    });
    await tap(p, ["Ropa Chicago"]);
    s = await waitFor(`${p.name}'s CHICAGO is registered`, async () => {
      const x = await snap(G);
      // declareChicago stores the call first and moves the turn marker right after.
      return x.round.chicago_declared_by === p.pid && x.room.current_turn_player_id === p.pid ? x : null;
    }, 15000);
    const confirms = await p.evaluate(() => window.__confirms);
    ok(confirms.length === 1 && /Ropa CHICAGO\?/.test(confirms[0]), `${G.n}p ${p.name} is asked to confirm the CHICAGO call (Swedish)`);
    ok(s.room.current_turn_player_id === p.pid, `${G.n}p ${p.name} called CHICAGO and leads the first trick`);
    for (const q of G.phones) {
      const seen = await waitFor(`${q.name}: chicago notice`, async () => {
        const t = await text(q);
        return /Chicago ropat/i.test(t) && !/Ropa Chicago/.test(t);
      }, 10000, 300).catch(() => false);
      if (!seen) ok(false, `${G.n}p ${q.name} sees who called CHICAGO and can no longer call`);
    }
    await shot(G, `chicago-called-r${roundNo}`);
    declarer = p.pid;
    G.stats.chicagoCalls += 1;
  }
  const scoresAtTricks = { ...s.score };
  const handsAtTricks = Object.fromEntries(s.hands.map((h) => [h.player_id, h.cards]));

  // --- five tricks ---------------------------------------------------------
  let lastWinner = null;
  let failedAt = null;
  for (let t = 1; t <= 5; t++) {
    const table = [];
    for (let i = 0; i < G.n; i++) {
      // The server writes the card first and moves the turn marker a moment later, so wait for the
      // turn to land on the expected player: the leader (caller / after dealer / last trick winner)
      // or the next player clockwise.
      let expectedTurn = null;
      s = await waitFor(`${G.n}p trick ${t} card ${i + 1}: turn moves to the right player`, async () => {
        const x = await snap(G);
        if (!(x.room.state === "trick_phase" && x.round.trick_number === t && x.played.length === i)) return null;
        expectedTurn =
          i === 0
            ? t === 1
              ? declarer ?? G.expectedLead
              : lastWinner
            : G.phones[(G.phones.findIndex((q) => q.pid === x.played[i - 1].player_id) + 1) % G.n].pid;
        return x.room.current_turn_player_id === expectedTurn ? x : null;
      }, 30000);
      const turnId = s.room.current_turn_player_id;
      const p = G.byId[turnId];
      // Mid-trick reload of a phone (once per game).
      if (!G.reloaded && t === 3 && i === 1) {
        G.reloaded = true;
        const victim = p; // the phone whose turn it is
        log(`reloading ${victim.name} mid-trick`);
        await victim.reload({ waitUntil: "load" });
        const back = await waitFor(`${victim.name} back after reload`, async () => {
          const d = await domCards(victim);
          const tx = await text(victim);
          return sameSet(d.hand, s.hand[turnId]) && d.table.length === 1 && /Din tur/i.test(tx) ? true : null;
        }, 30000).catch(() => false);
        ok(back, `${G.n}p reload mid-trick: ${victim.name} gets hand, table and turn back`);
        await shotOf(G, victim, "after-reload");
      }
      // Wait for the phone to show the right hand, the trick so far and "Din tur".
      let lastView = null;
      const view = await waitFor(`${p.name}: turn view`, async () => {
        const d = await domCards(p);
        const tx = await text(p);
        lastView = { d, yourTurn: /Din tur/i.test(tx), db: show(s.hand[turnId]), i };
        if (!/Din tur/i.test(tx)) return null;
        if (!sameSet(d.hand, s.hand[turnId])) return null;
        if (d.table.length !== i) return null;
        if (!d.hand.every((c) => c.button)) return null;
        return d;
      }, 20000).catch((e) => {
        throw new Error(e.message + ' ' + JSON.stringify(lastView));
      });
      for (const q of G.phones) {
        if (q === p) continue;
        const tx = await text(q);
        if (!new RegExp(`Väntar på ${p.name}`).test(tx) && !/Stickvinnare|Bästa hand/i.test(tx)) {
          G.stats.waitingLabelMisses += 1;
        }
      }
      const handView = view.hand.map(({ rank, suit }) => ({ rank, suit }));
      const tableView = view.table.map(({ rank, suit }) => ({ rank, suit }));
      if (tableView.length && tableView[0].suit !== s.trick.lead_suit) ok(false, `${G.n}p trick ${t}: the first card on the table is the lead suit`);

      // Once per game: try an illegal card first (not following suit when we can).
      const lead = tableView[0]?.suit;
      const illegal = lead && handView.some((c) => c.suit === lead) ? handView.find((c) => c.suit !== lead) : null;
      if (illegal && !G.illegalTried) {
        G.illegalTried = true;
        await clickCard(p, illegal);
        await tap(p, [`Spela ${illegal.rank}${SYM[illegal.suit]}`]);
        const msg = await waitFor("follow-suit rejection", async () => takeDialog(p, /följa färg/), 10000, 250).catch(() => null);
        ok(!!msg, `${G.n}p ${p.name}: playing a card off suit when you can follow is rejected ("Du måste följa färg")`, msg ?? "");
        const x = await snap(G);
        ok(x.played.length === i && sameSet(x.hand[turnId], s.hand[turnId]), `${G.n}p rejected card stays in the hand`);
      }

      const style = declarer === turnId ? "high" : p.style;
      const card = chooseCard(handView, tableView, style);
      await clickCard(p, card);
      const btn = `Spela ${card.rank}${SYM[card.suit]}`;
      await waitFor(`${p.name}: "${btn}" button`, async () => (await text(p)).includes(btn), 5000, 150);
      if (!G.doubleTapped && t === 2 && i === 0) {
        // Double tap on "Spela": must not show an error or play twice.
        G.doubleTapped = true;
        await p.evaluate((b) => {
          const els = [...document.querySelectorAll("div")].filter((el) => el.offsetParent !== null && el.textContent.trim() === b);
          const el = els[els.length - 1];
          el.click();
          el.click();
        }, btn);
      } else {
        await tap(p, [btn]);
      }
      table.push({ pid: turnId, card });
      const after = await waitFor(`${p.name}'s ${btn} is on the table`, async () => {
        const x = await snap(G);
        const mine = x.allTricks.find((tt) => tt.trick_number === t);
        if (!mine) return null;
        if (x.room.state === "trick_phase" && x.round.trick_number === t && x.played.length === i + 1) return x;
        if (x.round.trick_number > t || x.room.state !== "trick_phase") return x;
        return null;
      }, 20000);
      s = after;
      G.stats.cardsPlayed += 1;
    }
    // Trick resolved: highest card of the lead suit wins.
    const leadSuit = table[0].card.suit;
    const exp = table.filter((x) => x.card.suit === leadSuit).sort((a, b) => RV[b.card.rank] - RV[a.card.rank])[0].pid;
    s = await waitFor(`trick ${t} winner stored`, async () => {
      const x = await snap(G);
      return x.allTricks.find((y) => y.trick_number === t)?.winner_player_id ? x : null;
    }, 20000);
    const tr = s.allTricks.find((x) => x.trick_number === t);
    ok(tr?.winner_player_id === exp, `${G.n}p round ${roundNo} trick ${t}: ${G.byId[exp].name} wins with the highest ${leadSuit}`, "", true);
    if (tr?.winner_player_id !== exp) ok(false, `${G.n}p trick ${t} winner`, `${table.map((x) => `${G.byId[x.pid].name}:${x.card.rank}${SYM[x.card.suit]}`).join(" ")}`);
    lastWinner = exp;
    if (declarer && exp !== declarer) {
      failedAt = t;
      break;
    }
  }

  // --- round result --------------------------------------------------------
  s = await waitState(G, ["result", "game_over"], 30000);
  await wait(800);
  s = await snap(G);
  const delta = Object.fromEntries(s.players.map((p) => [p.id, p.score - scoresAtTricks[p.id]]));
  const expected = Object.fromEntries(s.players.map((p) => [p.id, 0]));
  let outcome;
  if (declarer && failedAt) {
    expected[declarer] = -15;
    outcome = `CHICAGO by ${G.byId[declarer].name} failed at trick ${failedAt}: -15`;
    G.stats.chicagoFailed += 1;
    ok(s.round.chicago_failed === true, `${G.n}p failed CHICAGO is recorded on the round`);
  } else {
    expected[lastWinner] += 5;
    if (declarer) {
      expected[declarer] += 15;
      G.stats.chicagoWon += 1;
    }
    const fin = pokerOutcome(Object.entries(handsAtTricks).map(([id, cards]) => ({ id, cards })));
    if (fin.points > 0 && !fin.tied) expected[fin.winner] += fin.points;
    if (fin.points > 0 && fin.tied) {
      // App awards a tie to nobody (after fix) - accept it.
    }
    outcome = `last trick ${G.byId[lastWinner].name} +5${declarer ? `, CHICAGO ${G.byId[declarer].name} +15` : ""}, final poker ${fin.tied ? "tie" : `${G.byId[fin.winner].name} ${fin.name} +${fin.points}`}`;
    ok(s.round.last_trick_winner_player_id === lastWinner || s.room.state === "game_over", `${G.n}p last trick winner stored on the round`);
    G.stats.lastTrick5 += 1;
  }
  const good = s.players.every((p) => delta[p.id] === expected[p.id]);
  ok(good, `${G.n}p round ${roundNo} result: ${outcome}`, good ? "" : `got ${s.players.map((p) => `${p.display_name}:${delta[p.id]}`).join(" ")} expected ${s.players.map((p) => `${p.display_name}:${expected[p.id]}`).join(" ")}`);
  return s;
}

async function playGame(G) {
  let s = await snap(G);
  for (let r = 0; r < G.maxRounds; r++) {
    s = await dealRound(G);
    G.expectedLead = s.room.lead_player_id;
    const dealerIdx = G.phones.findIndex((p) => p.pid === s.round.dealer_player_id);
    ok(G.phones[(dealerIdx + 1) % G.n].pid === s.room.lead_player_id, `${G.n}p round ${s.round.round_number}: player after the dealer leads`, "", true);
    if (r === 0) await shot(G, "draw1");
    let over = false;
    for (let k = 1; k <= 3; k++) {
      const plan = G.drawPlan(r, k);
      s = await drawPhase(G, k, plan);
      if (k < 3) {
        s = await pokerScoring(G, k, s);
        if (s.room.state === "game_over") {
          over = true;
          break;
        }
      }
    }
    if (!over) {
      if (r === 0) await shot(G, "tricks");
      s = await playTricks(G, s, { declare: (x) => G.declarePlan(r, x) });
      if (r === 0) await shot(G, "result");
    }
    const scores = s.players.map((p) => `${p.display_name.replace("E2E ", "")}=${p.score}`).join(" ");
    log(`${G.n}p round ${s.round.round_number} done: ${scores} (${s.room.state})`);
    s = await checkPhonesAgree(G, `after round ${s.round.round_number}`);
    if (G.afterRound) await G.afterRound(r, s);
    s = await snap(G);
    if (s.room.state === "game_over") return s;
  }
  return s;
}

async function verifyGameOver(G, s) {
  const winner = [...s.players].sort((a, b) => b.score - a.score)[0];
  ok(s.room.state === "game_over", `${G.n}p game over after ${s.round.round_number} rounds`);
  ok(s.room.winner_player_id === winner.id && winner.score >= 52, `${G.n}p winner is the highest score >= 52: ${winner.display_name} (${winner.score})`);
  for (const p of G.phones) {
    const seen = await waitFor(`${p.name}: game over screen`, async () => {
      const t = norm(await text(p));
      return /Spelet är slut/i.test(t) && t.includes(`Vinnare: ${winner.display_name}`);
    }, 20000).catch(() => false);
    ok(seen, `${G.n}p ${p.name} shows "Spelet är slut" and "Vinnare: ${winner.display_name}"`);
    const t = await text(p);
    if (p === G.host) ok(t.includes("Spela igen med samma gäng"), `${G.n}p host sees "Spela igen med samma gäng"`);
    else ok(/Väntar på att värden startar/.test(t), `${G.n}p ${p.name} waits for the host to restart`);
  }
  await shot(G, "game-over");
  await shotOf(G, G.phones[G.n - 1], "game-over");

  await tap(G.host, ["Spela igen med samma gäng"]);
  const lobby = await waitState(G, "lobby", 20000);
  ok(lobby.players.every((p) => p.score === 0) && lobby.players.length === G.n, `${G.n}p play again: same ${G.n} players, all scores 0`);
  ok(!lobby.round, `${G.n}p play again: old rounds are gone`);
  for (const p of G.phones) {
    const back = await waitFor(`${p.name}: lobby`, async () => {
      const t = await text(p);
      return /Spelare/i.test(t) && (p === G.host ? t.includes("Dela ut runda") : t.includes("Väntar på att värden ska starta rundan"));
    }, 20000).catch(() => false);
    ok(back, `${G.n}p ${p.name} is back in the lobby`);
    await wait(500);
    const t = await text(p);
    ok(!/försökte byta trots köpstopp|Köpstopp aktiverat|Inga byten, bara kaos/.test(t), `${G.n}p ${p.name}: no bogus buy-stop pop-up after the reset`);
  }
  await shot(G, "lobby-again");
  // And the new game really starts from scratch.
  const s2 = await dealRound(G);
  ok(s2.round.round_number === 1 && s2.players.every((p) => p.score === 0), `${G.n}p new game starts at round 1 with 0 points`);
}

// ---------------------------------------------------------------------------
// Scenarios
// ---------------------------------------------------------------------------
async function setup(browser, n) {
  const names = ["E2E Anna", "E2E Bo", "E2E Cilla", "E2E Dan"].slice(0, n);
  const phones = [];
  for (const name of names) phones.push(await phone(browser, name));
  const code = await createRoom(phones[0], "/chicago", "/chicago-room", names[0]);
  ok(!!code, `${n}p room created (${code})`);
  for (const p of phones.slice(1)) await joinRoom(p, "/chicago", "/chicago-room", code, p.name);
  for (const p of phones) {
    const u = new URL(p.url());
    p.pid = u.searchParams.get("playerId");
    p.roomId = u.searchParams.get("roomId");
  }
  const G = {
    n,
    phones,
    host: phones[0],
    roomId: phones[0].roomId,
    byId: Object.fromEntries(phones.map((p) => [p.pid, p])),
    maxRounds: MAX_ROUNDS,
    stats: { draws: { simultaneous: 0, sequential: 0 }, exchanged: 0, kept: 0, pokerScorings: 0, pokerPoints: 0, cardsPlayed: 0, chicagoCalls: 0, chicagoWon: 0, chicagoFailed: 0, lastTrick5: 0, waitingLabelMisses: 0 },
    checks: { scoreboards: 0, buyStop: 0, exchanges: 0 },
  };
  const s = await waitFor(`${n} players in the lobby`, async () => {
    const x = await snap(G);
    return x.players.length === n ? x : null;
  });
  ok(s.players.map((p) => p.display_name).join() === names.join(), `${n}p all players joined in seat order`);
  for (const p of phones) {
    const seen = await waitFor(`${p.name} lobby list`, async () => {
      const t = await text(p);
      return names.every((nm) => t.includes(nm));
    }, 15000).catch(() => false);
    ok(seen, `${n}p ${p.name} sees every player in the lobby`);
  }
  await shot(G, "lobby");
  return G;
}

async function scenario(browser, n) {
  const t0 = Date.now();
  const G = await setup(browser, n);
  // Anna is the favourite (greedy exchanges, plays high); the others mix keeping and random exchanges.
  G.phones.forEach((p, i) => (p.style = i === 0 ? "high" : i % 2 ? "low" : "random"));
  let triedFail = false;
  let triedRig = false;
  G.drawPlan = (r, k) => (p, hand, kk, s) => {
    if (n === 4 && r === 0) return greedyDiscards(hand).length >= 3 ? greedyDiscards(hand) : hand.slice(0, 4); // heavy swapping: the deck runs dry
    if (p === G.host) return greedyDiscards(hand);
    const roll = (r * 7 + k * 3 + G.phones.indexOf(p)) % 4;
    if (roll === 0) return [];
    if (roll === 1) return greedyDiscards(hand).slice(0, 3);
    if (roll === 2) return hand.slice(0, 1 + ((r + k) % 3));
    return greedyDiscards(hand);
  };
  G.declarePlan = (r, s) => {
    for (const p of G.phones) if (guaranteedChicago(s, p.pid)) return { id: p.pid };
    // One doomed call per game (weak hand -> -15).
    if (!triedFail && r >= 1) {
      const weak = G.phones.slice(1).find((p) => !guaranteedChicago(s, p.pid));
      if (weak) {
        triedFail = true;
        return { id: weak.pid };
      }
    }
    // A successful call is rare with random cards: in the 3-player game rig one (reported).
    if (n === 3 && !triedRig && r >= 2 && G.stats.chicagoWon === 0) {
      triedRig = true;
      return { id: G.phones[1].pid, rig: true };
    }
    return null;
  };
  // Buy stop: if nobody lands on 46-51 naturally, set one player there (3-player game only, reported).
  G.afterRound = async (r, s) => {
    if (n !== 3 || G.forcedBuyStop || s.room.state !== "result" || G.checks.buyStop > 0 || r < 3) return;
    const target = G.phones[2];
    if (s.score[target.pid] >= 46) return;
    G.forcedBuyStop = true;
    const db = await phoneDb(target);
    await db.from("chicago_room_players").update({ score: 46 }).eq("id", target.pid);
    log(`set ${target.name}'s score to 46 to exercise buy stop`);
    const popped = await waitFor("buy-stop pop-up", async () => {
      for (const p of G.phones) if (!/Köpstopp aktiverat/i.test(await text(p))) return false;
      return true;
    }, 10000, 250).catch(() => false);
    ok(popped, `${n}p every phone shows "Köpstopp aktiverat" when ${target.name} reaches 46`);
    await shot(G, "buy-stop-popup");
  };

  try {
    const s = await playGame(G);
    if (s.room.state !== "game_over") {
      ok(false, `${n}p someone reaches 52 within ${G.maxRounds} rounds`, s.players.map((p) => `${p.display_name}=${p.score}`).join(" "));
    } else {
      await verifyGameOver(G, s);
    }
  } catch (e) {
    ok(false, `${n}p scenario finished without crashing`, e.stack?.split("\n").slice(0, 3).join(" | "));
    await shot(G, "crash");
    for (const p of G.phones) await shotOf(G, p, "crash");
  }
  summarizePhoneIssues(ok, G.phones);
  log(`${n}p stats`, JSON.stringify(G.stats), JSON.stringify(G.checks), `${Math.round((Date.now() - t0) / 1000)}s`);
  for (const p of G.phones) await p.browserContext().close().catch(() => {});
}

const main = async () => {
  log(`BASE=${BASE} scenarios=${SCENARIOS.join(",")} maxRounds=${MAX_ROUNDS}`);
  crossCheckEvaluator();
  const browser = await launch();
  try {
    for (const n of SCENARIOS) {
      try {
        await scenario(browser, n);
      } catch (e) {
        ok(false, `${n}p scenario finished without crashing`, e.stack?.split("\n").slice(0, 3).join(" | "));
      }
    }
  } finally {
    await browser.close();
  }
  process.exit(done() ? 1 : 0);
};
main();
