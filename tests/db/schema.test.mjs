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

// --- Chicago: join limit; game state is only written by the server ----------------
await as(A, async () => {
  const [r] = await q(`insert into chicago_rooms (code) values ('CHIC') returning *`);
  await q(`insert into chicago_room_players (room_id, display_name, seat_order) values ($1, 'Alice', 1)`, [r.id]);
});
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

// --- Imposter: the server deals the word; phones only read their own card ---------
{
  const users = [A, B, C, D];
  const room = await as(A, async () => {
    const [r] = await q(`insert into imposter_rooms (code, category_id) values ('IMSE', 'celebrities') returning *`);
    const [p] = await q(`insert into imposter_room_players (room_id, display_name, seat_order, auth_user_id) values ($1, 'Alice', 1, $2) returning *`, [r.id, A]);
    await q(`update imposter_rooms set host_player_id = $1 where id = $2`, [p.id, r.id]);
    return r;
  });
  for (const [i, u] of users.slice(1).entries()) await as(u, () => q(`select join_room('imposter', 'IMSE', $1)`, [`P${i}`]));
  const me = async (u) => (await as(u, () => q(`select id from imposter_room_players where room_id = $1 and auth_user_id = $2`, [room.id, u])))[0].id;
  const ids = Object.fromEntries(await Promise.all(users.map(async (u) => [u, await me(u)])));

  ok(/Only the host/.test(await as(B, () => fails(q(`select imposter_start_game($1)`, [room.id])))), "imposter: only the host can start");
  await as(A, () => q(`select imposter_start_game($1)`, [room.id]));
  const cards = {};
  for (const u of users) {
    const seen = await as(u, () => q(`select player_id, role, prompt from imposter_player_roles where room_id = $1`, [room.id]));
    ok(seen.length === 1 && seen[0].player_id === ids[u], `imposter: player ${u.slice(-1)} reads only their own card`);
    cards[u] = seen[0];
  }
  const word = Object.values(cards).find((c) => c.role === "crew").prompt;
  ok(Object.values(cards).filter((c) => c.role === "imposter").length === 1, "imposter: exactly one imposter is dealt");
  ok(Object.values(cards).every((c) => (c.role === "imposter" ? c.prompt === null : c.prompt === word)), "imposter: crew share one word, the imposter gets none");
  const imp = users.find((u) => cards[u].role === "imposter");
  ok((await as(imp, () => q(`select secret_prompt from imposter_rooms where id = $1`, [room.id])))[0].secret_prompt === null, "imposter: the word is not on the room during the game");
  ok((await as(imp, () => q(`select * from imposter_secrets`))).length === 0, "imposter: the word table is unreadable");
  ok((await as(imp, () => q(`select * from imposter_words`))).length === 0, "imposter: the word lists are unreadable");
  ok(/ONLY_SERVER/.test(await as(imp, () => fails(q(`update imposter_rooms set state = 'ended' where id = $1`, [room.id])))), "imposter: a phone can't fake 'game over' to see the cards");
  ok(/ONLY_SERVER/.test(await as(B, () => fails(q(`update imposter_room_players set status = 'eliminated' where id = $1`, [ids[B]])))), "imposter: a phone can't change who is out");
  await as(B, () => q(`update imposter_room_players set role_reveal_ready = true where id = $1`, [ids[C]]));
  ok(!(await as(A, () => q(`select role_reveal_ready from imposter_room_players where id = $1`, [ids[C]])))[0].role_reveal_ready, "imposter: a player can't change another player's row");

  await as(A, () => q(`update imposter_rooms set state = 'voting' where id = $1`, [room.id]));
  const phase = (await as(A, () => q(`select phase_number from imposter_rooms where id = $1`, [room.id])))[0].phase_number;
  ok(!!(await as(B, () => fails(q(`insert into imposter_votes (room_id, phase_number, voter_player_id, target_player_id) values ($1, $2, $3, $4)`, [room.id, phase, ids[C], ids[imp]])))), "imposter: can't vote as someone else");
  for (const u of users.filter((x) => x !== imp)) {
    await as(u, () => q(`insert into imposter_votes (room_id, phase_number, voter_player_id, target_player_id) values ($1, $2, $3, $4)`, [room.id, phase, ids[u], ids[imp]]));
  }
  ok(/Only the host/.test(await as(B, () => fails(q(`select imposter_resolve_voting($1)`, [room.id])))), "imposter: only the host resolves the vote");
  await as(A, () => q(`select imposter_resolve_voting($1)`, [room.id]));
  const end = (await as(B, () => q(`select state, winner, secret_prompt from imposter_rooms where id = $1`, [room.id])))[0];
  ok(end.state === "ended" && end.winner === "crew" && end.secret_prompt === word, `imposter: voting out the imposter ends the game and reveals the word ${JSON.stringify(end)}`);
  ok((await as(B, () => q(`select * from imposter_player_roles where room_id = $1`, [room.id]))).length === 4, "imposter: everyone's card is visible after the game");

  await as(A, () => q(`select imposter_return_to_lobby($1)`, [room.id]));
  await as(A, () => q(`select imposter_start_game($1)`, [room.id]));
  const word2 = (await as(A, () => q(`select prompt from imposter_secrets where room_id = $1`, [room.id]).catch(() => []))).length;
  const next = await q(`select prompt from imposter_secrets where room_id = $1`, [room.id]);
  ok(word2 === 0 && next[0].prompt !== word, "imposter: play again deals a new word");
}

// --- Mafia: the server deals roles and resolves nights; phones see only their own ---
{
  const users = [A, B, C, D];
  const room = await as(A, async () => {
    const [r] = await q(`insert into mafia_rooms (code) values ('MASE') returning *`);
    const [p] = await q(`insert into mafia_room_players (room_id, display_name, seat_order, auth_user_id) values ($1, 'Alice', 1, $2) returning *`, [r.id, A]);
    await q(`update mafia_rooms set host_player_id = $1 where id = $2`, [p.id, r.id]);
    return r;
  });
  for (const [i, u] of users.slice(1).entries()) await as(u, () => q(`select join_room('mafia', 'MASE', $1)`, [`P${i}`]));
  const ids = {};
  for (const u of users) ids[u] = (await as(u, () => q(`select id from mafia_room_players where room_id = $1 and auth_user_id = $2`, [room.id, u])))[0].id;

  ok(/Only the host/.test(await as(B, () => fails(q(`select mafia_start_game($1)`, [room.id])))), "mafia: only the host can start");
  await as(A, () => q(`select mafia_start_game($1)`, [room.id]));
  const role = {};
  for (const u of users) {
    const seen = await as(u, () => q(`select player_id, role from mafia_player_roles where room_id = $1`, [room.id]));
    ok(seen.length === 1 && seen[0].player_id === ids[u], `mafia: player ${u.slice(-1)} reads only their own role`);
    role[u] = seen[0].role;
  }
  ok(JSON.stringify(Object.values(role).sort()) === JSON.stringify(["doctor", "mafia", "police", "villager"]), "mafia: 4 players get mafia, doctor, police, villager");
  const by = (r) => users.find((u) => role[u] === r);
  const [maf, doc, pol, vil] = ["mafia", "doctor", "police", "villager"].map(by);

  await as(A, () => q(`update mafia_rooms set state = 'night' where id = $1`, [room.id]));
  ok(!!(await as(vil, () => fails(q(`insert into mafia_night_actions (room_id, phase_number, actor_player_id, actor_role, target_player_id, confirmed) values ($1, 0, $2, 'mafia', $3, true)`, [room.id, ids[vil], ids[doc]])))), "mafia: a villager can't post a mafia kill directly");
  await as(maf, () => q(`select mafia_submit_night_action($1, $2, true)`, [room.id, ids[vil]]));
  await as(doc, () => q(`select mafia_submit_night_action($1, $2, true)`, [room.id, ids[vil]]));
  await as(pol, () => q(`select mafia_submit_night_action($1, $2, true)`, [room.id, ids[maf]]));
  await as(vil, () => q(`select mafia_submit_night_action($1, $2, true)`, [room.id, ids[doc]]));
  for (const u of users) ok((await as(u, () => q(`select * from mafia_night_actions where room_id = $1`, [room.id]))).length === 1, `mafia: player ${u.slice(-1)} sees only their own night action`);
  ok((await as(B, () => q(`select count(*)::int n from mafia_room_players where room_id = $1 and night_action_confirmed`, [room.id])))[0].n === 4, "mafia: 'has confirmed' is public for every player");
  ok(/ONLY_SERVER/.test(await as(vil, () => fails(q(`update mafia_rooms set state = 'ended' where id = $1`, [room.id])))), "mafia: a phone can't fake 'game over' to see the roles");
  ok(/ONLY_SERVER/.test(await as(A, () => fails(q(`update mafia_room_players set status = 'eliminated' where id = $1`, [ids[vil]])))), "mafia: even the host can't change who is out directly");

  await as(A, () => q(`select mafia_resolve_night($1)`, [room.id]));
  const night = (await as(B, () => q(`select r.state, e.payload from mafia_rooms r join mafia_game_events e on e.room_id = r.id where r.id = $1`, [room.id])))[0];
  ok(night.state === "night_result" && night.payload.doctorSaved === true && night.payload.eliminatedPlayerId === null, `mafia: the doctor's save stops the kill ${JSON.stringify(night)}`);
  const reports = {};
  for (const u of users) reports[u] = await as(u, () => q(`select result_alignment from mafia_police_reports where room_id = $1`, [room.id]));
  ok(reports[pol].length === 1 && reports[pol][0].result_alignment === "mafia", "mafia: the police learns the target is mafia");
  ok(users.filter((u) => u !== pol).every((u) => reports[u].length === 0), "mafia: nobody else sees the police result");

  await as(A, () => q(`update mafia_rooms set state = 'day_voting' where id = $1`, [room.id]));
  const ph = (await as(A, () => q(`select phase_number from mafia_rooms where id = $1`, [room.id])))[0].phase_number;
  ok(!!(await as(vil, () => fails(q(`insert into mafia_day_votes (room_id, phase_number, voter_player_id, target_player_id) values ($1, $2, $3, $4)`, [room.id, ph, ids[doc], ids[vil]])))), "mafia: can't vote as someone else");
  for (const u of [doc, pol, vil]) await as(u, () => q(`insert into mafia_day_votes (room_id, phase_number, voter_player_id, target_player_id) values ($1, $2, $3, $4)`, [room.id, ph, ids[u], ids[maf]]));
  await as(A, () => q(`select mafia_resolve_day_vote($1)`, [room.id]));
  const end = (await as(B, () => q(`select state, winner from mafia_rooms where id = $1`, [room.id])))[0];
  ok(end.state === "ended" && end.winner === "village", `mafia: voting out the only mafia wins it for the village ${JSON.stringify(end)}`);
  ok((await as(vil, () => q(`select * from mafia_player_roles where room_id = $1`, [room.id]))).length === 4, "mafia: every role is visible after the game");
}

// --- Chicago: dealing, scoring and turns run on the server; phones see only their own hand ---
{
  const { evaluatePokerHand } = await import("../../src/games/chicago/logic.ts");
  const ranks = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];
  const suits = ["clubs", "diamonds", "hearts", "spades"];
  const deck = suits.flatMap((suit) => ranks.map((rank) => ({ rank, suit })));
  const fixed = [
    [["10", "hearts"], ["J", "hearts"], ["Q", "hearts"], ["K", "hearts"], ["A", "hearts"]],
    [["A", "clubs"], ["2", "hearts"], ["3", "spades"], ["4", "clubs"], ["5", "diamonds"]],
    [["9", "clubs"], ["9", "hearts"], ["4", "spades"], ["4", "clubs"], ["K", "diamonds"]],
    [["7", "clubs"], ["7", "hearts"], ["7", "spades"], ["2", "clubs"], ["2", "diamonds"]],
  ].map((h) => h.map(([rank, suit]) => ({ rank, suit })));
  const hands = [...fixed];
  for (let i = 0; i < 2000; i++) hands.push([...deck].sort(() => Math.random() - 0.5).slice(0, 5));
  const rows = await q(`select (chicago_evaluate(h)).* from jsonb_array_elements($1::jsonb) with ordinality t(h, i) order by i`, [JSON.stringify(hands)]);
  const mismatch = hands.findIndex((h, i) => {
    const ts = evaluatePokerHand(h);
    return ts.name !== rows[i].name || ts.points !== rows[i].points || JSON.stringify(ts.tiebreak) !== JSON.stringify(rows[i].tiebreak);
  });
  ok(mismatch === -1, "chicago: database poker scoring matches the app on 2004 hands", mismatch === -1 ? "" : JSON.stringify({ hand: hands[mismatch], ts: evaluatePokerHand(hands[mismatch]), db: rows[mismatch] }));

  const room = await as(A, async () => {
    const [r] = await q(`insert into chicago_rooms (code) values ('CHSE') returning *`);
    const [p] = await q(`insert into chicago_room_players (room_id, display_name, seat_order, score, auth_user_id) values ($1, 'Alice', 1, 51, $2) returning *`, [r.id, A]);
    await q(`update chicago_rooms set host_player_id = $1 where id = $2`, [p.id, r.id]);
    return r;
  });
  await as(B, () => q(`select join_room('chicago', 'CHSE', 'Bob')`));
  const ids = {};
  for (const u of [A, B]) ids[u] = (await as(u, () => q(`select id, score from chicago_room_players where room_id = $1 and auth_user_id = $2`, [room.id, u])))[0];
  ok(ids[A].score === 0, "chicago: a new player always starts on 0 points");

  ok(/Only the host/.test(await as(B, () => fails(q(`select chicago_start_round($1)`, [room.id])))), "chicago: only the host deals");
  await as(A, () => q(`select chicago_start_round($1)`, [room.id]));
  const handOf = async (u) => (await as(u, () => q(`select player_id, cards from chicago_player_hands where room_id = $1`, [room.id])));
  const ha = await handOf(A);
  const hb = await handOf(B);
  ok(ha.length === 1 && hb.length === 1 && ha[0].player_id === ids[A].id && hb[0].player_id === ids[B].id, "chicago: each player reads only their own hand");
  ok(ha[0].cards.length === 5 && hb[0].cards.length === 5, "chicago: five cards each");
  ok((await as(B, () => q(`select * from chicago_decks`))).length === 0, "chicago: the deck is unreadable");
  ok((await as(B, () => q(`select deck from chicago_rounds where room_id = $1`, [room.id])))[0].deck.length === 0, "chicago: the round row holds no deck");
  ok(/ONLY_SERVER/.test(await as(B, () => fails(q(`update chicago_room_players set score = 51 where id = $1`, [ids[B].id])))), "chicago: a player can't set their own score");
  ok(/ONLY_SERVER/.test(await as(B, () => fails(q(`update chicago_rooms set current_turn_player_id = $1 where id = $2`, [ids[B].id, room.id])))), "chicago: a player can't take the turn");
  ok(!!(await as(B, () => fails(q(`update chicago_player_hands set cards = '[]' where player_id = $1`, [ids[B].id]).then(async () => {
    if ((await handOf(B))[0].cards.length === 5) throw new Error("unchanged");
  })))), "chicago: a player can't edit their hand");
  ok(/actually in your hand/.test(await as(B, () => fails(q(`select chicago_submit_draw($1, $2)`, [room.id, JSON.stringify([ha[0].cards[0]])])))), "chicago: can't throw a card you don't have");

  const state = async () => (await as(A, () => q(`select state, current_turn_player_id from chicago_rooms where id = $1`, [room.id])))[0];
  await as(A, () => q(`select chicago_submit_draw($1, $2)`, [room.id, JSON.stringify(ha[0].cards.slice(0, 2))]));
  ok(/already exchanged/.test(await as(A, () => fails(q(`select chicago_submit_draw($1, '[]')`, [room.id])))), "chicago: one exchange per player per draw");
  await as(B, () => q(`select chicago_submit_draw($1, '[]')`, [room.id]));
  const afterDraw = (await handOf(A))[0].cards;
  ok(afterDraw.length === 5 && !afterDraw.some((c) => ha[0].cards.slice(0, 2).some((d) => d.rank === c.rank && d.suit === c.suit)), "chicago: thrown cards are replaced from the deck");
  ok((await state()).state === "poker_score_1", "chicago: everyone exchanged → first poker scoring");
  await as(B, () => q(`select chicago_score_poker($1)`, [room.id]));
  await as(A, () => q(`select chicago_score_poker($1)`, [room.id]));
  ok((await state()).state === "draw_phase_2", "chicago: scoring moves on once (a second request does nothing)");
  for (const phase of ["poker_score_2", "draw_phase_3", "trick_phase"]) {
    const s = (await state()).state;
    if (s.startsWith("draw")) { for (const u of [A, B]) await as(u, () => q(`select chicago_submit_draw($1, '[]')`, [room.id])); }
    else await as(A, () => q(`select chicago_score_poker($1)`, [room.id]));
    ok((await state()).state === phase, `chicago: on to ${phase}`);
  }

  const byId = { [ids[A].id]: A, [ids[B].id]: B };
  let lead = null;
  for (let n = 0; n < 10; n++) {
    const s = await state();
    const u = byId[s.current_turn_player_id];
    const other = u === A ? B : A;
    if (n === 0) {
      const otherCard = JSON.stringify((await handOf(other))[0].cards[0]);
      ok(/not your turn/.test(await as(other, () => fails(q(`select chicago_play_card($1, $2)`, [room.id, otherCard])))), "chicago: can't play out of turn");
    }
    const cards = (await handOf(u))[0].cards;
    const follow = lead && cards.find((c) => c.suit === lead.suit);
    const card = follow ?? cards[0];
    await as(u, () => q(`select chicago_play_card($1, $2)`, [room.id, JSON.stringify(card)]));
    lead = n % 2 === 0 ? card : null;
  }
  const end = (await as(B, () => q(`select r.state, sum(p.score)::int total from chicago_rooms r join chicago_room_players p on p.room_id = r.id where r.id = $1 group by r.state`, [room.id])))[0];
  ok(end.state === "result" && end.total >= 5, `chicago: five tricks end the round and the last trick scores ${JSON.stringify(end)}`);
  ok((await as(B, () => q(`select count(*)::int n from chicago_cards_played c join chicago_tricks t on t.id = c.trick_id join chicago_rounds r on r.id = t.round_id where r.room_id = $1`, [room.id])))[0].n === 10, "chicago: played cards are visible to the room");
}

// --- Most Likely / Closest Wins: server-run rounds, answers private until the reveal ---
{
  const users = [A, B, C];
  const create = async (game) => as(A, async () => (await q(`select party_create_room($1, 'Alice') as r`, [game]))[0].r);
  const join = async (u, game, code, name) => as(u, async () => (await q(`select party_join_room($1, $2, $3) as r`, [game, code, name]))[0].r);

  // Most Likely
  const ml = await create("most_likely");
  ok(/^[A-Z2-9]{4}$/.test(ml.code), "party: a room gets a 4-character code");
  const mlB = await join(B, "most_likely", ml.code.toLowerCase(), "Bob");
  ok((await join(B, "most_likely", ml.code, "Bob again")).player_id === mlB.player_id, "party: re-joining from the same phone keeps the seat");
  ok(/ROOM_NOT_FOUND/.test(await as(C, () => fails(q(`select party_join_room('estimate', $1, 'Cy')`, [ml.code])))), "party: a code only works on its own game's page");
  ok(/At least 3 players/.test(await as(A, () => fails(q(`select party_start($1, 5)`, [ml.room_id])))), "party: Most Likely needs 3 players");
  const mlC = await join(C, "most_likely", ml.code, "Cy");
  ok(/Only the host/.test(await as(B, () => fails(q(`select party_start($1, 5)`, [ml.room_id])))), "party: only the host starts");
  await as(A, () => q(`select party_start($1, 5)`, [ml.room_id]));
  ok(/GAME_ALREADY_STARTED/.test(await as(D, () => fails(q(`select party_join_room('most_likely', $1, 'Late')`, [ml.code])))), "party: can't join a game in progress");
  const rounds = await as(B, () => q(`select * from party_rounds where room_id = $1 order by round_number`, [ml.room_id]));
  ok(rounds.length === 5 && new Set(rounds.map((r) => r.prompt_id)).size === 5, "party: five different statements are dealt");
  ok(!!(await as(B, () => fails(q(`update party_players set score = 99 where id = $1`, [mlB.player_id]).then(async () => {
    if ((await q(`select score from party_players where id = $1`, [mlB.player_id]))[0].score !== 0) return;
    throw new Error("unchanged");
  })))), "party: a player can't change their score");
  ok((await as(D, () => q(`select * from party_rounds where room_id = $1`, [ml.room_id]))).length === 0, "party: outsiders can't read the room");

  // Round 1: A and B vote for C, C votes for A.
  await as(A, () => q(`select party_answer($1, $2, null)`, [ml.room_id, mlC.player_id]));
  await as(B, () => q(`select party_answer($1, $2, null)`, [ml.room_id, mlC.player_id]));
  ok((await as(C, () => q(`select * from party_answers where round_id = $1`, [rounds[0].id]))).length === 0, "party: votes stay secret until the reveal");
  ok((await as(A, () => q(`select * from party_answers where round_id = $1`, [rounds[0].id]))).length === 1, "party: a player sees their own vote");
  ok((await as(A, () => q(`select answered_round from party_players where id = $1`, [mlB.player_id])))[0].answered_round === 1, "party: who has answered is public");
  await as(C, () => q(`select party_answer($1, $2, null)`, [ml.room_id, ml.player_id]));
  const afterVote = await as(C, () => q(`select state from party_rooms where id = $1`, [ml.room_id]));
  ok(afterVote[0].state === "reveal", "party: the last vote reveals the round automatically");
  ok((await as(C, () => q(`select * from party_answers where round_id = $1`, [rounds[0].id]))).length === 3, "party: all votes are visible after the reveal");
  const scores = Object.fromEntries((await as(A, () => q(`select id, score, titles from party_players where room_id = $1`, [ml.room_id]))).map((p) => [p.id, p]));
  ok(scores[ml.player_id].score === 1 && scores[mlB.player_id].score === 1 && scores[mlC.player_id].score === 0 && scores[mlC.player_id].titles === 1,
    `party: voting with the majority scores, the chosen player gets the title ${JSON.stringify(Object.values(scores))}`);
  ok(/Answers are closed/.test(await as(A, () => fails(q(`select party_answer($1, $2, null)`, [ml.room_id, mlB.player_id])))), "party: no answers after the reveal");
  ok(/Only the host/.test(await as(B, () => fails(q(`select party_next($1)`, [ml.room_id])))), "party: only the host moves on");
  await as(A, () => q(`select party_next($1)`, [ml.room_id]));
  ok((await as(B, () => q(`select current_round, state from party_rooms where id = $1`, [ml.room_id])))[0].current_round === 2, "party: next round");
  await as(A, () => q(`select party_reveal($1)`, [ml.room_id]));
  ok((await as(B, () => q(`select state from party_rooms where id = $1`, [ml.room_id])))[0].state === "reveal", "party: the host can reveal without waiting");
  for (let i = 0; i < 3; i++) {
    await as(A, () => q(`select party_next($1)`, [ml.room_id]));
    await as(A, () => q(`select party_reveal($1)`, [ml.room_id]));
  }
  await as(A, () => q(`select party_next($1)`, [ml.room_id]));
  ok((await as(B, () => q(`select state from party_rooms where id = $1`, [ml.room_id])))[0].state === "ended", "party: the game ends after the last round");
  await as(A, () => q(`select party_reset($1)`, [ml.room_id]));
  const reset = await as(B, () => q(`select r.state, sum(p.score)::int total, count(*)::int n from party_rooms r join party_players p on p.room_id = r.id where r.id = $1 group by r.state`, [ml.room_id]));
  ok(reset[0].state === "lobby" && reset[0].total === 0 && reset[0].n === 3, "party: play again keeps the players and clears the scores");

  // Closest Wins
  const es = await create("estimate");
  const esB = await join(B, "estimate", es.code, "Bob");
  const esC = await join(C, "estimate", es.code, "Cy");
  await as(A, () => q(`select party_start($1, 3)`, [es.room_id]));
  const [r1] = await as(A, () => q(`select * from party_rounds where room_id = $1 and round_number = 1`, [es.room_id]));
  ok(r1.answer === null, "party: the right answer is hidden during the round");
  const right = Number((await q(`select answer from party_prompts where id = $1`, [r1.prompt_id]))[0].answer);
  ok((await as(A, () => q(`select * from party_prompts`))).length === 0, "party: the question bank is unreadable");
  ok(/Enter a number/.test(await as(A, () => fails(q(`select party_answer($1, null, null)`, [es.room_id])))), "party: a guess must be a number");
  await as(A, () => q(`select party_answer($1, null, $2)`, [es.room_id, right]));
  await as(B, () => q(`select party_answer($1, null, $2)`, [es.room_id, right + 10]));
  await as(C, () => q(`select party_answer($1, null, $2)`, [es.room_id, right - 10]));
  const [r1after] = await as(B, () => q(`select * from party_rounds where id = $1`, [r1.id]));
  ok(r1after.revealed && Number(r1after.answer) === right, "party: the answer is shown after the reveal");
  const pts = Object.fromEntries((await as(B, () => q(`select player_id, points from party_answers where round_id = $1`, [r1.id]))).map((a) => [a.player_id, a.points]));
  ok(pts[es.player_id] === 3 && pts[esB.player_id] === 2 && pts[esC.player_id] === 2, `party: closest gets 3, equal distances share 2 ${JSON.stringify(pts)}`);

  // Leaving: the host role passes on.
  await as(A, () => q(`select party_leave($1)`, [es.room_id]));
  ok((await as(B, () => q(`select host_player_id from party_rooms where id = $1`, [es.room_id])))[0].host_player_id === esB.player_id, "party: when the host leaves, the next player becomes host");
}

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
