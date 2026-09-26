// Scenario 2 — realtime fan-out.
// 15 phones in one Mafia room subscribe to their room (like the app's useMafiaRoom hook).
// The host updates the room several times; we measure how long until EVERY phone has the change.
// A second room (other host) is updated too: none of the 15 phones may ever receive its events,
// even though they also listen to the whole table without a filter (RLS must filter them out).
//
//   node tests/stress/realtime-fanout.mjs
import { reporter } from "../lib.mjs";
import { asPlayer, clients, loadApi, record, runStandalone, timed, wait, pct, errText } from "./_common.mjs";

const N = 15;
const UPDATES = 6;

function subscribe(client, name, table, filter, onEvent) {
  return new Promise((resolve) => {
    const ch = client
      .channel(`stress-${name}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table, ...(filter ? { filter } : {}) }, onEvent)
      .subscribe((status, err) => {
        if (status === "SUBSCRIBED") resolve({ ch, ok: true });
        else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") resolve({ ch, ok: false, err: `${status} ${err?.message ?? ""}` });
      });
  });
}

export async function run() {
  const { ok, done } = reporter("realtime");
  const pool = await clients(N + 1);
  const api = await loadApi("mafia");
  const members = pool.slice(0, N);
  const otherHost = pool[N];

  const roomA = await asPlayer(members[0], () => api.createMafiaRoom("STRESS RT Host"));
  for (let i = 1; i < N; i++) await asPlayer(members[i], () => api.joinMafiaRoom(roomA.code, `STRESS RT ${i}`));
  const roomB = await asPlayer(otherHost, () => api.createMafiaRoom("STRESS RT Other"));

  // Each phone: one filtered subscription (as the app does) + one unfiltered table-wide listener.
  const seen = members.map(() => new Map()); // marker -> arrival time
  const leaks = [];
  let unfilteredOwn = 0; // positive control: the table-wide listener does receive our own room
  const subs = await Promise.all(
    members.map(async (c, i) => {
      const t0 = performance.now();
      const a = await subscribe(c, `a${i}`, "mafia_rooms", `id=eq.${roomA.roomId}`, (p) => {
        const m = p.new?.public_message;
        if (m && !seen[i].has(m)) seen[i].set(m, performance.now());
      });
      const b = await subscribe(c, `all${i}`, "mafia_rooms", null, (p) => {
        const id = p.new?.id ?? p.old?.id;
        if (id && id !== roomA.roomId) leaks.push({ phone: i, id, msg: p.new?.public_message });
        else if (id) unfilteredOwn++;
      });
      const c2 = await subscribe(c, `pl${i}`, "mafia_room_players", null, (p) => {
        const rid = p.new?.room_id ?? p.old?.room_id;
        if (rid && rid !== roomA.roomId) leaks.push({ phone: i, table: "players", rid });
      });
      record("realtime subscribe (3 channels)", performance.now() - t0);
      return [a, b, c2];
    })
  );
  const subErrors = subs.flat().filter((s) => !s.ok);
  ok(subErrors.length === 0, `all ${N} phones subscribed`, subErrors.map((s) => s.err).slice(0, 2).join(" | "));
  await wait(1500);

  // Host of room A updates the room UPDATES times, 1.5 s apart.
  const perUpdateAll = [];
  let missing = 0;
  for (let u = 0; u < UPDATES; u++) {
    const marker = `STRESS rt ${u} ${Date.now()}`;
    const t0 = performance.now();
    const { error } = await timed("mafia_rooms update (host)", () =>
      members[0].from("mafia_rooms").update({ public_message: marker }).eq("id", roomA.roomId)
    );
    ok(!error, `update ${u + 1} accepted`, errText(error));
    const deadline = performance.now() + 8000;
    while (performance.now() < deadline && seen.some((s) => !s.has(marker))) await wait(20);
    const delays = seen.map((s) => (s.has(marker) ? s.get(marker) - t0 : null));
    const got = delays.filter((d) => d !== null);
    missing += N - got.length;
    got.forEach((d) => record("realtime delivery delay (per phone)", d));
    if (got.length === N) {
      const all = Math.max(...got);
      perUpdateAll.push(all);
      record("realtime: until ALL 15 phones have it", all);
    }
    // Meanwhile the other room changes too (must never reach room A's phones).
    await otherHost.from("mafia_rooms").update({ public_message: `STRESS other ${u}` }).eq("id", roomB.roomId);
    await wait(1500);
  }
  await wait(2000);

  ok(missing === 0, `every phone received every update`, `(${missing} deliveries missing of ${N * UPDATES})`);
  ok(unfilteredOwn >= N * UPDATES, "table-wide listeners work (they got our own room's updates)", `(${unfilteredOwn})`);
  ok(leaks.length === 0, "no phone received another room's events", JSON.stringify(leaks.slice(0, 3)));
  const all95 = pct(perUpdateAll, 95);
  ok(perUpdateAll.length > 0 && all95 < 2000, "fan-out to all 15 phones completes within 2 s (p95)", `(p95 ${all95?.toFixed?.(0)} ms)`);

  for (const s of subs.flat()) await s.ch.unsubscribe().catch(() => {});
  return done();
}

runStandalone(import.meta.url, run);
