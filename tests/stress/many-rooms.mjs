// Scenario 4 — many rooms at once.
// 30 phones each create a room (5 of each of the 6 games) at the same instant, using the app's own
// create functions. Checks: all succeed, codes unique per game, what happens on a code collision
// (forced by replaying an existing code through the app's generator), and RLS isolation: no phone
// can ever read a room / player row of a room it isn't in.
//
//   node tests/stress/many-rooms.mjs
import { reporter } from "../lib.mjs";
import { asPlayer, clients, loadApi, record, runStandalone, timed, errText } from "./_common.mjs";

export const GAMES = [
  { game: "memematch", rpc: "memematch", create: "createMemeMatchRoom", room: "rooms", players: "players", name: "name" },
  { game: "mafia", rpc: "mafia", create: "createMafiaRoom", room: "mafia_rooms", players: "mafia_room_players" },
  { game: "imposter", rpc: "imposter", create: "createImposterRoom", room: "imposter_rooms", players: "imposter_room_players" },
  { game: "chicago", rpc: "chicago", create: "createChicagoRoom", room: "chicago_rooms", players: "chicago_room_players" },
  { game: "music-quiz", rpc: "musicQuiz", create: "createMusicQuizRoom", room: "music_quiz_rooms", players: "music_quiz_players" },
  { game: "trivia", rpc: "trivia", create: "createTriviaRoom", room: "trivia_rooms", players: "trivia_players" },
];
const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Make the app's makeRoomCode() produce `code` for the next call. */
function withForcedCode(code, fn) {
  const real = Math.random;
  const queue = [...code].map((ch) => (CHARS.indexOf(ch) + 0.5) / CHARS.length);
  Math.random = () => (queue.length ? queue.shift() : real());
  return fn().finally(() => (Math.random = real));
}

export async function run() {
  const { ok, done } = reporter("many-rooms");
  const phones = await clients(30);
  const apis = Object.fromEntries(await Promise.all(GAMES.map(async (g) => [g.game, await loadApi(g.game)])));

  // --- 30 rooms at the same instant ------------------------------------------
  const t0 = performance.now();
  const results = await Promise.all(
    phones.map((c, i) => {
      const g = GAMES[i % GAMES.length];
      return asPlayer(c, async () => {
        const s = performance.now();
        try {
          const r = await apis[g.game][g.create](`STRESS Room${i}`);
          record(`create room: ${g.game} (30 at once)`, performance.now() - s);
          return { ok: true, g, c, r };
        } catch (e) {
          return { ok: false, g, c, e };
        }
      });
    })
  );
  record("30 rooms: wall time until all created", performance.now() - t0);
  const failed = results.filter((r) => !r.ok);
  ok(failed.length === 0, "all 30 simultaneous room creations succeeded", failed.map((f) => `${f.g.game}: ${errText(f.e)}`).slice(0, 3).join(" | "));
  const good = results.filter((r) => r.ok);

  // MemeMatch create returns no code; read it.
  for (const r of good) {
    if (!r.r.code) r.r.code = (await r.c.from(r.g.room).select("code").eq("id", r.r.roomId).single()).data?.code;
  }
  for (const g of GAMES) {
    const codes = good.filter((r) => r.g === g).map((r) => r.r.code);
    ok(new Set(codes).size === codes.length && codes.every((c) => /^[A-HJ-NP-Z2-9]{4}$/.test(c)), `${g.game}: room codes unique and well-formed`, codes.join(","));
  }
  const hostsOk = await Promise.all(
    good.map(async (r) => (await r.c.from(r.g.room).select("host_player_id").eq("id", r.r.roomId).single()).data?.host_player_id === r.r.playerId)
  );
  ok(hostsOk.every(Boolean), "every new room has its creator as host");

  // --- Forced code collision (what a player sees when the 4-letter code is already taken) --
  for (const g of GAMES) {
    const existing = good.find((r) => r.g === g);
    const other = good.find((r) => r.g !== g).c; // a phone that isn't in this room
    const before = (await other.from(g.room).select("id", { count: "exact", head: true })).count;
    let outcome;
    try {
      const r = await withForcedCode(existing.r.code, () => asPlayer(other, () => apis[g.game][g.create]("STRESS Collide")));
      outcome = { ok: true, code: r.code ?? "(memematch)" };
    } catch (e) {
      outcome = { ok: false, msg: errText(e) };
    }
    const after = (await other.from(g.room).select("id", { count: "exact", head: true })).count;
    ok(
      outcome.ok,
      `${g.game}: creating a room whose random code is already taken still works (retry with a new code)`,
      outcome.ok ? "" : `app surfaces: "${outcome.msg}"`
    );
    ok(after === before + (outcome.ok ? 1 : 0), `${g.game}: a failed create leaves no orphan room`);
  }

  // --- RLS isolation -----------------------------------------------------------
  let leaks = [];
  await Promise.all(
    phones.map(async (c) => {
      for (const g of GAMES) {
        const [{ data: mine }, { data: visibleRooms, error: rErr }, { data: visiblePlayers, error: pErr }] = await Promise.all([
          c.from(g.players).select("room_id").eq("auth_user_id", c.userId),
          timed("RLS: list whole room table", () => c.from(g.room).select("id,created_by").limit(1000)),
          c.from(g.players).select("room_id,auth_user_id").limit(2000),
        ]);
        if (rErr || pErr) leaks.push(`${g.room}: error ${errText(rErr || pErr)}`);
        const memberOf = new Set((mine ?? []).map((m) => m.room_id));
        for (const row of visibleRooms ?? []) if (row.created_by !== c.userId && !memberOf.has(row.id)) leaks.push(`${g.room} ${row.id}`);
        for (const row of visiblePlayers ?? []) if (row.auth_user_id !== c.userId && !memberOf.has(row.room_id)) leaks.push(`${g.players} in ${row.room_id}`);
      }
    })
  );
  ok(leaks.length === 0, "no phone can list rooms or players of rooms it isn't in (all 12 tables, 30 phones)", leaks.slice(0, 3).join(" | "));

  // Direct reads/writes of a specific foreign room by id.
  leaks = [];
  await Promise.all(
    good.map(async (target, i) => {
      const outsider = good[(i + 1) % good.length].c;
      const g = target.g;
      const [{ data: room }, { data: pl }] = await Promise.all([
        outsider.from(g.room).select("*").eq("id", target.r.roomId),
        outsider.from(g.players).select("*").eq("room_id", target.r.roomId),
      ]);
      if ((room ?? []).length) leaks.push(`read ${g.room}`);
      if ((pl ?? []).length) leaks.push(`read ${g.players}`);
      const { data: upd } = await outsider.from(g.room).update({ host_player_id: null }).eq("id", target.r.roomId).select("id");
      if ((upd ?? []).length) leaks.push(`UPDATED ${g.room}`);
    })
  );
  ok(leaks.length === 0, "an outsider can't read or update a specific foreign room by id", leaks.slice(0, 3).join(" | "));

  // A code only works for its own game.
  const mafiaRoom = good.find((r) => r.g.game === "mafia");
  const { error: wrongGame } = await phones[29].rpc("join_room", { p_game: "imposter", p_code: mafiaRoom.r.code, p_name: "STRESS Wrong" });
  ok(/ROOM_NOT_FOUND/.test(wrongGame?.message ?? "") || !wrongGame, "a Mafia code used for Imposter doesn't join the Mafia room", errText(wrongGame));

  return done();
}

runStandalone(import.meta.url, run);
