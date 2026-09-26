import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";

import path from "node:path";
import { fileURLToPath } from "node:url";
// Runs every migration against an in-memory Postgres (PGlite) with a minimal
// Supabase stand-in (auth.uid(), storage, roles, realtime publication) and checks
// security rules + RPC behaviour.   node tests/db/schema.test.mjs   (LEGACY=1 to start
// from the pre-2026-09 production schema, as the live database did)
const HERE = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = path.join(HERE, "..", "..", "supabase", "migrations");
const MIGRATION = path.join(MIGRATIONS, "20260925120000_picklo_init.sql");

const db = new PGlite();
let failures = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${msg}`);
  if (!cond) failures++;
};

// --- Minimal Supabase environment ------------------------------------------
await db.exec(`
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create schema auth;
  create table auth.users (id uuid primary key, is_anonymous boolean default true, created_at timestamptz default now(), last_sign_in_at timestamptz);
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  create schema storage;
  create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner_id text default auth.uid()::text);
  create function storage.foldername(name text) returns text[] language sql immutable as $$
    select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1]
  $$;
  alter table storage.objects enable row level security;
  create publication supabase_realtime;
  grant usage on schema auth, storage to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated, service_role;
  grant all on storage.objects to authenticated;
`);

const sql = fs.readFileSync(MIGRATION, "utf8").replace(/create extension if not exists pgcrypto;/g, "");
async function run(text) {
  try { await db.exec(text); }
  catch (e) {
    const pos = Number(e.position) || 0;
    console.log("SQL ERROR:", e.message, e.where ? "| " + e.where : "");
    if (pos) console.log(">>>", text.slice(Math.max(0, pos - 300), pos + 100));
    process.exit(1);
  }
}

if (process.env.LEGACY) {
  // Recreate the pre-2026-09 production database: old schemas, open policies, loose FKs, old data.
  for (const g of ["mafia", "imposter", "chicago", "music-quiz", "trivia"]) {
    await run(fs.readFileSync(path.join(HERE, "legacy", `${g}.sql`), "utf8").replace(/create extension if not exists pgcrypto;/g, ""));
  }
  await run(`
    create table rooms (id uuid primary key default gen_random_uuid(), code text unique, status text, created_at timestamptz default now(),
      host_player_id uuid, phase text default 'lobby', expected_players int, statement_category text default 'innocent');
    create table players (id uuid primary key default gen_random_uuid(), room_id uuid references rooms(id), name text, joined_at timestamptz default now());
    alter table rooms add constraint rooms_host_player_id_fkey foreign key (host_player_id) references players(id);
    create table rounds (id uuid primary key default gen_random_uuid(), room_id uuid references rooms(id), statement text, status text, ends_at timestamptz,
      created_at timestamptz default now(), round_number int, constraint rounds_room_roundnumber_unique unique (room_id, round_number));
    create table submissions (id uuid primary key default gen_random_uuid(), round_id uuid references rounds(id), player_id uuid references players(id), image_path text, created_at timestamptz default now());
    create table votes (id uuid primary key default gen_random_uuid(), round_id uuid references rounds(id), voter_player_id uuid references players(id), submission_id uuid references submissions(id), created_at timestamptz default now());
    create table player_images (id uuid primary key default gen_random_uuid(), room_id uuid, player_id uuid, image_path text, used_in_round_id uuid references rounds(id), created_at timestamptz default now());
    create table room_scores (room_id uuid, player_id uuid, points int, updated_at timestamptz default now());
    alter publication supabase_realtime add table room_scores;
    create function advance_round_if_ready(p_round_id uuid) returns json language sql as $f$ select null::json $f$;
    create function finalize_round(p_round_id uuid) returns json language sql as $f$ select null::json $f$;
    insert into storage.buckets (id, name, public) values ('game-images', 'game-images', true);
    create policy "Public uploads" on storage.objects for insert with check (bucket_id = 'game-images');
    create policy "open rooms" on rooms for all using (true) with check (true);
    insert into rooms (id, code, status) values ('11111111-1111-1111-1111-111111111111', 'OLD1', 'lobby');
    insert into players (id, room_id, name) values ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'Old');
    insert into room_scores values ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 1, now()),
                                   ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 1, now());
    insert into player_images (room_id, player_id, image_path) values ('00000000-0000-0000-0000-000000000000', '33333333-3333-3333-3333-333333333333', 'x.jpg');
    insert into room_scores values ('99999999-9999-9999-9999-999999999999', '22222222-2222-2222-2222-222222222222', 5, now());
    insert into mafia_rooms (code) values ('OLDM');
    insert into mafia_room_players (room_id, display_name) select id, 'Old' from mafia_rooms;
    insert into trivia_rooms (code) values ('OLDT');
    insert into trivia_players (room_id, display_name, seat_order) select id, 'Old', 1 from trivia_rooms;
  `);
  await run(`create function old_lock() returns trigger language plpgsql as $f$ begin if old.used_in_round_id is not null then raise exception 'This image is already locked to a round and cannot be changed.'; end if; return new; end $f$; create trigger lock_used_image before update on player_images for each row execute function old_lock();`);
  console.log("legacy database prepared");
}

await run(sql);
ok(true, "setup migration applies");
await run(sql);
ok(true, "setup migration is re-runnable");
// Later migrations, in order (as supabase db push applies them).
for (const f of fs.readdirSync(MIGRATIONS).filter((f) => f > "20260925120000_picklo_init.sql" && f.endsWith(".sql")).sort()) await run(fs.readFileSync(path.join(MIGRATIONS, f), "utf8"));
ok(true, "all later migrations apply");

// Supabase grants table privileges to API roles by default; RLS does the filtering.
await db.exec(`
  grant usage on schema public to anon, authenticated, service_role;
  grant all on all tables in schema public to anon, authenticated, service_role;
`);


const A = "00000000-0000-0000-0000-00000000000a";
const B = "00000000-0000-0000-0000-00000000000b";
const C = "00000000-0000-0000-0000-00000000000c";
const D = "00000000-0000-0000-0000-00000000000d";
await db.exec(`insert into auth.users (id) values ('${A}'), ('${B}'), ('${C}'), ('${D}')`);

async function as(user, fn) {
  await db.exec("reset role");
  if (user === "anon") {
    await db.exec(`select set_config('request.jwt.claim.sub', '', false); set role anon;`);
  } else if (user === "service") {
    await db.exec(`select set_config('request.jwt.claim.sub', '', false); set role service_role;`);
  } else {
    await db.exec(`select set_config('request.jwt.claim.sub', '${user}', false); set role authenticated;`);
  }
  try {
    return await fn();
  } finally {
    await db.exec("reset role");
  }
}
async function fails(p) {
  try {
    await p;
    return false;
  } catch (e) {
    return e.message;
  }
}
const q = async (text, params) => (await db.query(text, params)).rows;

if (process.env.LEGACY) {
  const legacyPlayers = await q("select count(*)::int n from players where auth_user_id is null");
  ok(legacyPlayers[0].n === 0, "legacy players get an (unclaimable) owner");
  const dupes = await q("select count(*)::int n from room_scores");
  ok(dupes[0].n === 1, "duplicate legacy score rows are merged, orphan scores removed");
  const orphans = await q("select count(*)::int n from player_images");
  ok(orphans[0].n === 0, "orphan legacy photo rows are removed");
  const openStorage = await q("select count(*)::int n from pg_policies where tablename = 'objects' and policyname = 'Public uploads'");
  ok(openStorage[0].n === 0, "old open storage policy is removed");
  const openRooms = await q("select count(*)::int n from pg_policies where tablename = 'rooms' and policyname = 'open rooms'");
  ok(openRooms[0].n === 0, "old open table policy is removed");
}

// --- MemeMatch: create (client-side inserts, as the app does) ----------------
const room = await as(A, async () => {
  const [r] = await q(`insert into rooms (code, status) values ('ABCD', 'lobby') returning *`);
  const [p] = await q(`insert into players (room_id, name) values ($1, 'Alice') returning *`, [r.id]);
  await q(`update rooms set host_player_id = $1 where id = $2`, [p.id, r.id]);
  return { id: r.id, host: p.id };
});
ok(!!room.id, "creator can insert a room and read it back (RETURNING)");

ok((await as(B, () => q(`select * from rooms where id = $1`, [room.id]))).length === 0, "non-member cannot see the room");
ok((await as("anon", () => q(`select * from rooms`))).length === 0, "anon key alone sees nothing");
ok(!!(await as(B, () => fails(q(`insert into players (room_id, name) values ($1, 'Mallory')`, [room.id])))), "non-creator cannot insert themselves directly");

const bob = await as(B, async () => (await q(`select join_room('memematch', 'abcd', 'Bob') as j`))[0].j);
ok(bob.room_id === room.id && !!bob.player_id, "join_room joins by code (case-insensitive)");
const bobAgain = await as(B, async () => (await q(`select join_room('memematch', 'ABCD', 'Bob 2') as j`))[0].j);
ok(bobAgain.player_id === bob.player_id, "re-joining from the same device returns the same player");
ok((await as(B, () => q(`select * from players where room_id = $1`, [room.id]))).length === 2, "member sees all players");
ok((await as(C, () => q(`select * from players where room_id = $1`, [room.id]))).length === 0, "outsider sees no players");
ok(/ROOM_NOT_FOUND/.test(await as(C, () => fails(q(`select join_room('memematch', 'ZZZZ', 'Cy')`)))), "unknown code → ROOM_NOT_FOUND");

// Round flow
const roundId = await as(A, async () => {
  await q(`update rooms set phase = 'playing', expected_players = 2 where id = $1`, [room.id]);
  const [r] = await q(`insert into rounds (room_id, statement, status, round_number) values ($1, 's1', 'collecting', 1) returning id`, [room.id]);
  return r.id;
});
ok(!!(await as(C, () => fails(q(`insert into rounds (room_id, statement, round_number) values ($1, 'x', 2)`, [room.id])))), "outsider cannot create rounds");

const subA = await as(A, async () => (await q(`insert into submissions (round_id, player_id, image_path) values ($1, $2, 'a.jpg') returning id`, [roundId, room.host]))[0].id);
ok(!!(await as(B, () => fails(q(`insert into submissions (round_id, player_id, image_path) values ($1, $2, 'fake.jpg')`, [roundId, room.host])))), "cannot submit on behalf of another player");
ok((await as(A, () => q(`select advance_round_if_ready($1) as s`, [roundId])))[0].s === "collecting", "round waits until everyone has played");
const subB = await as(B, async () => (await q(`insert into submissions (round_id, player_id, image_path) values ($1, $2, 'b.jpg') returning id`, [roundId, bob.player_id]))[0].id);
ok((await as(B, () => q(`select advance_round_if_ready($1) as s`, [roundId])))[0].s === "voting", "round moves to voting when all have played");

ok(!!(await as(A, () => fails(q(`insert into votes (round_id, voter_player_id, submission_id) values ($1, $2, $3)`, [roundId, room.host, subA])))), "cannot vote for your own photo");
ok(!!(await as(B, () => fails(q(`insert into votes (round_id, voter_player_id, submission_id) values ($1, $2, $3)`, [roundId, room.host, subB])))), "cannot vote as someone else");
await as(A, () => q(`insert into votes (round_id, voter_player_id, submission_id) values ($1, $2, $3)`, [roundId, room.host, subB]));
ok((await as(A, () => q(`select advance_round_if_ready($1) as s`, [roundId])))[0].s === "voting", "voting waits for all votes");
await as(B, () => q(`insert into votes (round_id, voter_player_id, submission_id) values ($1, $2, $3)`, [roundId, bob.player_id, subA]));
ok((await as(B, () => q(`select advance_round_if_ready($1) as s`, [roundId])))[0].s === "done", "round finishes when everyone has voted");
await as(A, () => q(`select finalize_round($1)`, [roundId])); // client calls this too; must not double count
const scores = await as(A, () => q(`select player_id, points from room_scores where room_id = $1 order by player_id`, [room.id]));
ok(scores.length === 2 && scores.every((s) => s.points === 1), "tie gives both winners one point, finalize is idempotent");
ok(!!(await as(A, () => fails(q(`update room_scores set points = 99 where room_id = $1`, [room.id]).then((r) => { if (!r) throw 0; return r; }).then(async () => {
  const [s] = await q(`select max(points) m from room_scores where room_id = $1`, [room.id]);
  if (s.m === 99) return "cheated";
  throw new Error("blocked");
})))), "players cannot edit scores directly");

// Voting rules (deadline + only players who played may vote)
{
  const r2 = await as(A, async () => (await q("insert into rounds (room_id, statement, status, round_number) values ($1, 'v', 'collecting', 7) returning id", [room.id]))[0].id);
  const sA = await as(A, async () => (await q("insert into submissions (round_id, player_id, image_path) values ($1, $2, 'a2.jpg') returning id", [r2, room.host]))[0].id);
  // Bob does not play a photo this round → may not vote
  ok(!!(await as(B, () => fails(q("insert into votes (round_id, voter_player_id, submission_id) values ($1, $2, $3)", [r2, bob.player_id, sA])))), "a player who did not play a photo cannot vote");
  await as(B, async () => q("insert into submissions (round_id, player_id, image_path) values ($1, $2, 'b2.jpg')", [r2, bob.player_id]));
  ok((await as(A, () => q("select advance_round_if_ready($1) as s", [r2])))[0].s === "voting", "round goes to voting");
  const deadline = (await q("select ends_at > now() + interval '30 seconds' as ok from rounds where id = $1", [r2]))[0].ok;
  ok(deadline, "voting gets a ~45 s deadline");
  await q("update rounds set ends_at = now() - interval '1 second' where id = $1", [r2]);
  ok((await as(A, () => q("select advance_round_if_ready($1) as s", [r2])))[0].s === "done", "voting ends when the deadline passes even if nobody voted");
}

// Hardening (stress-test findings)
ok(!!(await as(B, () => fails(q("update rooms set host_player_id = $1 where id = $2", [bob.player_id, room.id])))), "a member cannot make themselves host");
ok(!!(await as(B, () => fails(q("delete from players where id = $1", [room.host]).then(async () => { const r = await q("select count(*)::int n from players where id = $1", [room.host]); if (r[0].n === 0) return "deleted"; throw new Error("kept"); })))), "a member cannot remove another player");
{
  const longName = "x".repeat(200);
  const nameRoom = await as(D, async () => { const [r] = await q("insert into trivia_rooms (code) values ('NAME') returning id"); return r.id; });
  const j = await as(D, async () => (await q("insert into trivia_players (room_id, display_name, seat_order) values ($1, $2, 1) returning id as player_id", [nameRoom, "  " + longName + "  "]))[0]);
  const n = await as(D, async () => (await q("select char_length(display_name) as n from trivia_players where id = $1", [j.player_id]))[0].n);
  ok(n === 40, "player names are trimmed to 40 characters", String(n));
  ok(/NAME_REQUIRED/.test(await as(D, () => fails(q("select join_room('memematch', 'ABCD', null)")))), "a missing name gives NAME_REQUIRED");
  const dup = await as(A, async () => (await q("insert into mafia_rooms (code) values ('ABCD') returning code"))[0].code);
  const dup2 = await as(A, async () => (await q("insert into mafia_rooms (code) values ($1) returning code", [dup]))[0].code);
  ok(dup2 !== dup && /^[A-Z2-9]{4}$/.test(dup2), "a room-code collision gets a fresh code", dup + " -> " + dup2);
}

// Play again
ok(!!(await as(B, () => fails(q("select memematch_play_again($1)", [room.id])))), "only the host can restart MemeMatch");
await as(A, () => q("select memematch_play_again($1)", [room.id]));
const after = await as(A, async () => ({
  rounds: (await q("select count(*)::int n from rounds where room_id = $1", [room.id]))[0].n,
  scores: (await q("select count(*)::int n from room_scores where room_id = $1", [room.id]))[0].n,
  phase: (await q("select phase from rooms where id = $1", [room.id]))[0].phase,
  players: (await q("select count(*)::int n from players where room_id = $1", [room.id]))[0].n,
}));
ok(after.rounds === 0 && after.scores === 0 && after.phase === "picking" && after.players === 2, "play again keeps players, clears rounds/scores " + JSON.stringify(after));

// Storage
ok(!(await as(B, () => fails(q(`insert into storage.objects (bucket_id, name) values ('game-images', $1)`, [`${room.id}/hand/x.jpg`])))), "member can upload to their room folder");
ok(!!(await as(C, () => fails(q(`insert into storage.objects (bucket_id, name) values ('game-images', $1)`, [`${room.id}/hand/evil.jpg`])))), "outsider cannot upload into a room");
ok(!!(await as(B, () => fails(q(`insert into storage.objects (bucket_id, name) values ('game-images', 'not-a-uuid/x.jpg')`)))), "junk paths are rejected");

// --- Mafia: create + join + started-game guard -------------------------------
const mafia = await as(A, async () => {
  const [r] = await q(`insert into mafia_rooms (code, state, public_message) values ('MAFI', 'lobby', 'Waiting') returning *`);
  const [p] = await q(`insert into mafia_room_players (room_id, display_name, seat_order, status) values ($1, 'Alice', 1, 'alive') returning *`, [r.id]);
  await q(`update mafia_rooms set host_player_id = $1 where id = $2`, [p.id, r.id]);
  return r;
});
const mb = await as(B, async () => (await q(`select join_room('mafia', 'MAFI', 'Bob') as j`))[0].j);
ok(!!mb.player_id, "mafia join works");
const seat = await as(B, async () => (await q(`select seat_order from mafia_room_players where id = $1`, [mb.player_id]))[0].seat_order);
ok(seat === 2, "join_room assigns the next seat");
await as(A, () => q(`update mafia_rooms set state = 'night' where id = $1`, [mafia.id]));
ok(/GAME_ALREADY_STARTED/.test(await as(C, () => fails(q(`select join_room('mafia', 'MAFI', 'Cy')`)))), "cannot join a mafia game in progress");
ok(!!(await as(B, async () => (await q(`select join_room('mafia', 'MAFI', 'Bob')`)).length)), "…but an existing player can rejoin it");
ok((await as(C, () => q(`select * from mafia_player_roles`))).length === 0, "outsider cannot read mafia roles");

// --- Chicago: nested tables resolve membership via round / trick -------------
const chi = await as(A, async () => {
  const [r] = await q(`insert into chicago_rooms (code) values ('CHIC') returning *`);
  const [p] = await q(`insert into chicago_room_players (room_id, display_name, seat_order) values ($1, 'Alice', 1) returning *`, [r.id]);
  const [rd] = await q(`insert into chicago_rounds (room_id, round_number, dealer_player_id, active_phase) values ($1, 1, $2, 'trick_phase') returning *`, [r.id, p.id]);
  const [t] = await q(`insert into chicago_tricks (round_id, trick_number) values ($1, 1) returning *`, [rd.id]);
  await q(`insert into chicago_cards_played (trick_id, player_id, card, play_order) values ($1, $2, '{"r":14,"s":"S"}', 1)`, [t.id, p.id]);
  return { room: r, trick: t };
});
ok((await as(A, () => q(`select * from chicago_cards_played where trick_id = $1`, [chi.trick.id]))).length === 1, "chicago member reads played cards");
ok((await as(C, () => q(`select * from chicago_cards_played`))).length === 0, "outsider cannot read chicago cards");
for (let i = 0; i < 5; i++) {
  const u = `00000000-0000-0000-0000-0000000001${String(i).padStart(2, "0")}`;
  await as(u, () => q(`select join_room('chicago', 'CHIC', 'P${i}')`));
}
ok(/ROOM_FULL/.test(await as(C, () => fails(q(`select join_room('chicago', 'CHIC', 'Seventh')`)))), "chicago caps at 6 players");

// --- Trivia / Music Quiz / Imposter basics -----------------------------------
for (const [game, roomsTbl, playersTbl, code] of [
  ["trivia", "trivia_rooms", "trivia_players", "TRIV"],
  ["musicQuiz", "music_quiz_rooms", "music_quiz_players", "MUSI"],
  ["imposter", "imposter_rooms", "imposter_room_players", "IMPO"],
]) {
  await as(A, async () => {
    const [r] = await q(`insert into ${roomsTbl} (code) values ('${code}') returning *`);
    await q(`insert into ${playersTbl} (room_id, display_name, seat_order) values ($1, 'Alice', 1)`, [r.id]);
  });
  const j = await as(B, async () => (await q(`select join_room($1, $2, 'Bob') as j`, [game, code]))[0].j);
  ok(!!j.player_id, `${game} create + join work`);
  ok((await as(C, () => q(`select * from ${roomsTbl}`))).length === 0, `${game} rooms hidden from outsiders`);
}
ok((await as(B, () => q(`select count(*)::int n from music_quiz_library`)))[0].n > 0, "music library readable by players");
ok(!!(await as(B, () => fails(q(`insert into music_quiz_library (spotify_url, category) values ('x', 'hits')`)))), "music library is read-only");

// --- Housekeeping --------------------------------------------------------------
ok(!!(await as(A, () => fails(q(`select picklo_cleanup()`)))), "players cannot call cleanup");
await db.exec(`alter table rooms disable trigger rooms_updated_at; update rooms set created_at = now() - interval '2 days', updated_at = now() - interval '2 days'; alter table rooms enable trigger rooms_updated_at;`);
ok((await q("select count(*)::int n from rooms where greatest(created_at, updated_at) < now() - interval '1 day'"))[0].n >= 1, "test room is aged");
const expired = await as("service", () => q(`select * from picklo_expired_memematch_rooms()`));
const extra = process.env.LEGACY ? 1 : 0;
ok(expired.length === 1 + extra, "service role lists expired MemeMatch rooms");
const cleaned = await as("service", async () => (await q(`select picklo_cleanup() as r`))[0].r);
ok(cleaned.rooms === 1 + extra && cleaned.mafia_rooms === 0, `cleanup deletes only expired rooms ${JSON.stringify(cleaned)}`);
ok((await q(`select count(*)::int n from players where room_id = $1`, [room.id]))[0].n === 0, "room deletion cascades to players");

console.log(failures ? `\n${failures} FAILED` : "\nALL PASSED");
process.exit(failures ? 1 : 0);
