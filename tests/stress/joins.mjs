// Scenario 1 — join storms.
// Mafia: host + 20 phones join at the same instant (cap is 20 → exactly 19 should get in, 1 ROOM_FULL).
// Imposter: host + 12 at once (cap 12 → 11 in, 1 ROOM_FULL).
// Chicago: host + 6 at once (cap 6 → 5 in, 1 ROOM_FULL).
// Checks: unique seat_order 1..n, no duplicate players, host unchanged, re-join returns the same
// player, and a double-tapped first join (two simultaneous calls from one phone) gives one player.
//
//   node tests/stress/joins.mjs
import { reporter } from "../lib.mjs";
import { asPlayer, clients, loadApi, runStandalone, timed, errText, record } from "./_common.mjs";

const GAMES = [
  { game: "mafia", rpcGame: "mafia", cap: 20, joiners: 20, create: "createMafiaRoom", join: "joinMafiaRoom", table: "mafia_room_players", roomTable: "mafia_rooms" },
  { game: "imposter", rpcGame: "imposter", cap: 12, joiners: 12, create: "createImposterRoom", join: "joinImposterRoom", table: "imposter_room_players", roomTable: "imposter_rooms" },
  { game: "chicago", rpcGame: "chicago", cap: 6, joiners: 6, create: "createChicagoRoom", join: "joinChicagoRoom", table: "chicago_room_players", roomTable: "chicago_rooms" },
];

export async function run() {
  const { ok, done } = reporter("joins");
  const pool = await clients(21);
  const findings = [];

  for (const g of GAMES) {
    const api = await loadApi(g.game);
    const host = pool[0];
    const created = await timed(`${g.game}: create room`, () => asPlayer(host, () => api[g.create]("STRESS Host")));
    const joiners = pool.slice(1, 1 + g.joiners);

    // Everyone taps "Join" at the same instant.
    const results = await Promise.all(
      joiners.map((c, i) =>
        asPlayer(c, async () => {
          const t0 = performance.now();
          try {
            const r = await api[g.join](created.code, `STRESS P${i + 1}`);
            return { ok: true, r, ms: performance.now() - t0 };
          } catch (e) {
            return { ok: false, e, ms: performance.now() - t0 };
          }
        })
      )
    );
    results.forEach((r) => record(`join_room storm (${g.game}, ${g.joiners} at once)`, r.ms));

    const oks = results.filter((r) => r.ok);
    const fails = results.filter((r) => !r.ok);
    const fullErrors = fails.filter((r) => /ROOM_FULL/.test(r.e?.message));
    const otherErrors = fails.filter((r) => !/ROOM_FULL/.test(r.e?.message));
    ok(oks.length === g.cap - 1, `${g.game}: exactly ${g.cap - 1} of ${g.joiners} simultaneous joiners got in`, `(got ${oks.length})`);
    ok(fullErrors.length === g.joiners - (g.cap - 1), `${g.game}: the overflow joiner(s) were refused with ROOM_FULL`, `(ROOM_FULL=${fullErrors.length})`);
    ok(otherErrors.length === 0, `${g.game}: no unexpected join errors`, otherErrors.map((r) => errText(r.e)).slice(0, 3).join(" | "));

    const { data: players, error } = await host.from(g.table).select("id,seat_order,auth_user_id,display_name").eq("room_id", created.roomId);
    ok(!error, `${g.game}: host can read the player list`, errText(error));
    const seats = (players ?? []).map((p) => p.seat_order).sort((a, b) => a - b);
    const uniqueSeats = new Set(seats);
    const users = new Set((players ?? []).map((p) => p.auth_user_id));
    ok((players ?? []).length <= g.cap, `${g.game}: room holds at most ${g.cap} players`, `(has ${(players ?? []).length})`);
    ok(users.size === (players ?? []).length, `${g.game}: no duplicate player rows per phone`);
    ok(uniqueSeats.size === seats.length, `${g.game}: seat_order values are unique`, `seats=${JSON.stringify(seats)}`);
    ok(seats.every((s, i) => s === i + 1), `${g.game}: seat_order is 1..n without gaps`, `seats=${JSON.stringify(seats)}`);
    if ((players ?? []).length > g.cap || uniqueSeats.size !== seats.length) {
      findings.push(`${g.game}: ${players.length} players (cap ${g.cap}), seats ${JSON.stringify(seats)}`);
    }

    const { data: room } = await host.from(g.roomTable).select("host_player_id").eq("id", created.roomId).single();
    ok(room?.host_player_id === created.playerId, `${g.game}: host is still the creator`);

    // Re-join from the same phones (e.g. page reload) — must return the same player, not a duplicate.
    const again = await Promise.all(
      oks.slice(0, 3).map((r, i) =>
        asPlayer(joiners[results.indexOf(r)], () => timed("join_room (re-join)", () => api[g.join](created.code, `STRESS P${i + 1} again`)))
      )
    );
    ok(
      again.every((a, i) => a.playerId === oks[i].r.playerId),
      `${g.game}: re-joining from the same phone returns the same player`
    );
  }

  // Double-tap: one brand-new phone calls join_room twice at the same instant.
  {
    const api = await loadApi("imposter");
    const host = pool[0];
    const created = await asPlayer(host, () => api.createImposterRoom("STRESS Host"));
    const tappers = pool.slice(1, 6);
    const pairs = await Promise.all(
      tappers.map((c, i) =>
        asPlayer(c, () =>
          Promise.allSettled([api.joinImposterRoom(created.code, `STRESS Tap${i}`), api.joinImposterRoom(created.code, `STRESS Tap${i}`)])
        )
      )
    );
    const errors = pairs.flat().filter((p) => p.status === "rejected").map((p) => errText(p.reason));
    const samePlayer = pairs.every((p) => p[0].status === "fulfilled" && p[1].status === "fulfilled" && p[0].value.playerId === p[1].value.playerId);
    ok(errors.length === 0, "double-tapped join: neither call fails", errors.slice(0, 2).join(" | "));
    ok(samePlayer, "double-tapped join: both calls return the same player");
    const { count } = await host.from("imposter_room_players").select("*", { count: "exact", head: true }).eq("room_id", created.roomId);
    ok(count === 1 + tappers.length, "double-tapped join: exactly one player row per phone", `(rows=${count})`);
  }

  if (findings.length) console.log("\nFindings:\n  " + findings.join("\n  "));
  return done();
}

runStandalone(import.meta.url, run);
