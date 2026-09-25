-- Picklo: complete database setup (all six games + security).
-- Run once on a fresh Supabase project: Dashboard → SQL Editor → paste → Run,
-- or `npx supabase db push`. Safe to re-run.
-- Requires: Authentication → Sign In / Providers → "Allow anonymous sign-ins" ON.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =============================================================================
-- MemeMatch
-- (Reconstructed from the app code: these tables were never checked into the repo.)
-- =============================================================================

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  status text not null default 'lobby',
  phase text not null default 'lobby' check (phase in ('lobby', 'picking', 'playing', 'finished')),
  host_player_id uuid null,
  statement_category text not null default 'innocent' check (statement_category in ('innocent', 'adult', 'gross')),
  expected_players integer null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  joined_at timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'rooms_host_player_id_fkey') then
    alter table public.rooms
      add constraint rooms_host_player_id_fkey
      foreign key (host_player_id) references public.players(id) on delete set null;
  end if;
end
$$;

create table if not exists public.rounds (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  round_number integer not null,
  statement text not null,
  status text not null default 'collecting' check (status in ('collecting', 'voting', 'done')),
  ends_at timestamptz null,
  scored boolean not null default false,
  created_at timestamptz not null default now(),
  constraint rounds_room_roundnumber_unique unique (room_id, round_number)
);

create table if not exists public.player_images (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  image_path text not null,
  used_in_round_id uuid null references public.rounds(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.rounds(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  image_path text not null,
  created_at timestamptz not null default now(),
  unique (round_id, player_id)
);

create table if not exists public.votes (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.rounds(id) on delete cascade,
  voter_player_id uuid not null references public.players(id) on delete cascade,
  submission_id uuid not null references public.submissions(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (round_id, voter_player_id)
);

create table if not exists public.room_scores (
  room_id uuid not null references public.rooms(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  points integer not null default 0,
  primary key (room_id, player_id)
);

-- Bring an existing (pre-2026-09) MemeMatch database up to this shape.
alter table public.rooms add column if not exists updated_at timestamptz not null default now();
alter table public.rounds add column if not exists scored boolean not null default false;
alter table public.votes add column if not exists updated_at timestamptz not null default now();

-- Older databases have no primary key on room_scores, and Realtime needs a replica
-- identity before rows can be deleted from a published table.
alter table public.room_scores replica identity full;

-- Make sure deleting a room cleans up everything under it (older databases may
-- have been created without ON DELETE rules).
do $$
declare
  fk record;
  con record;
begin
  for fk in select * from (values
    ('players', 'room_id', 'rooms', 'cascade'),
    ('rounds', 'room_id', 'rooms', 'cascade'),
    ('player_images', 'room_id', 'rooms', 'cascade'),
    ('player_images', 'player_id', 'players', 'cascade'),
    ('player_images', 'used_in_round_id', 'rounds', 'set null'),
    ('submissions', 'round_id', 'rounds', 'cascade'),
    ('submissions', 'player_id', 'players', 'cascade'),
    ('votes', 'round_id', 'rounds', 'cascade'),
    ('votes', 'voter_player_id', 'players', 'cascade'),
    ('votes', 'submission_id', 'submissions', 'cascade'),
    ('room_scores', 'room_id', 'rooms', 'cascade'),
    ('room_scores', 'player_id', 'players', 'cascade'),
    ('rooms', 'host_player_id', 'players', 'set null')
  ) as v(tbl, col, ref, action) loop
    for con in
      select c.conname from pg_constraint c
      join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
      where c.contype = 'f' and c.conrelid = format('public.%I', fk.tbl)::regclass
        and array_length(c.conkey, 1) = 1 and a.attname = fk.col
    loop
      execute format('alter table public.%I drop constraint %I', fk.tbl, con.conname);
    end loop;
    -- Older databases contain rows pointing at rooms/players/rounds that no longer
    -- exist; they can never be used again, so remove (or unlink) them first.
    if fk.action = 'cascade' then
      execute format('delete from public.%I t where t.%I is not null and not exists (select 1 from public.%I r where r.id = t.%I)',
        fk.tbl, fk.col, fk.ref, fk.col);
    else
      execute format('update public.%I t set %I = null where t.%I is not null and not exists (select 1 from public.%I r where r.id = t.%I)',
        fk.tbl, fk.col, fk.col, fk.ref, fk.col);
    end if;
    execute format('alter table public.%I add constraint %I foreign key (%I) references public.%I(id) on delete %s',
      fk.tbl, fk.tbl || '_' || fk.col || '_fkey', fk.col, fk.ref, fk.action);
  end loop;
end
$$;

-- Old clients could write duplicate score rows; keep one per player before enforcing uniqueness.
delete from public.room_scores a
using public.room_scores b
where a.ctid < b.ctid and a.room_id = b.room_id and a.player_id = b.player_id;
create unique index if not exists room_scores_room_player_uniq on public.room_scores(room_id, player_id);

create index if not exists players_room_idx on public.players(room_id);
create index if not exists rounds_room_idx on public.rounds(room_id);
create index if not exists player_images_room_player_idx on public.player_images(room_id, player_id);
create index if not exists submissions_round_idx on public.submissions(round_id);
create index if not exists votes_round_idx on public.votes(round_id);

drop trigger if exists rooms_updated_at on public.rooms;
create trigger rooms_updated_at before update on public.rooms
for each row execute function public.set_updated_at();

drop trigger if exists votes_updated_at on public.votes;
create trigger votes_updated_at before update on public.votes
for each row execute function public.set_updated_at();

-- =============================================================================
-- Mafia
-- =============================================================================
do $$
begin
  if not exists (select 1 from pg_type where typname = 'mafia_phase') then
    create type public.mafia_phase as enum (
      'lobby',
      'role_reveal',
      'night',
      'night_result',
      'day_discussion',
      'day_voting',
      'vote_result',
      'ended'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'mafia_role') then
    create type public.mafia_role as enum ('mafia', 'doctor', 'police', 'villager');
  end if;

  if not exists (select 1 from pg_type where typname = 'mafia_player_status') then
    create type public.mafia_player_status as enum ('alive', 'eliminated');
  end if;

  if not exists (select 1 from pg_type where typname = 'mafia_vote_scope') then
    create type public.mafia_vote_scope as enum ('all', 'mafia', 'player');
  end if;
end
$$;


create table if not exists public.mafia_rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  state public.mafia_phase not null default 'lobby',
  host_player_id uuid null,
  phase_number integer not null default 0,
  phase_ends_at timestamptz null,
  winner text null check (winner in ('mafia', 'village')),
  public_message text null,
  created_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.mafia_room_players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.mafia_rooms(id) on delete cascade,
  auth_user_id uuid null,
  display_name text not null,
  seat_order integer not null default 0,
  status public.mafia_player_status not null default 'alive',
  role_reveal_ready boolean not null default false,
  discussion_ready boolean not null default false,
  joined_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique nulls not distinct (room_id, auth_user_id)
);

alter table public.mafia_room_players
add column if not exists discussion_ready boolean not null default false;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'mafia_rooms_host_player_id_fkey_v2'
  ) then
    alter table public.mafia_rooms
      add constraint mafia_rooms_host_player_id_fkey_v2
      foreign key (host_player_id) references public.mafia_room_players(id) on delete set null;
  end if;
end
$$;

create table if not exists public.mafia_player_roles (
  player_id uuid primary key references public.mafia_room_players(id) on delete cascade,
  room_id uuid not null references public.mafia_rooms(id) on delete cascade,
  role public.mafia_role not null,
  is_alive boolean not null default true,
  revealed_at timestamptz null,
  created_at timestamptz not null default now()
);

create table if not exists public.mafia_night_actions (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.mafia_rooms(id) on delete cascade,
  phase_number integer not null,
  actor_player_id uuid not null references public.mafia_room_players(id) on delete cascade,
  actor_role public.mafia_role not null,
  target_player_id uuid null references public.mafia_room_players(id) on delete set null,
  fake_ready boolean not null default false,
  confirmed boolean not null default false,
  locked_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (room_id, phase_number, actor_player_id)
);

create table if not exists public.mafia_police_reports (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.mafia_rooms(id) on delete cascade,
  phase_number integer not null,
  police_player_id uuid not null references public.mafia_room_players(id) on delete cascade,
  target_player_id uuid not null references public.mafia_room_players(id) on delete cascade,
  result_alignment text not null check (result_alignment in ('mafia', 'village')),
  created_at timestamptz not null default now(),
  unique (room_id, phase_number, police_player_id)
);

create table if not exists public.mafia_day_votes (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.mafia_rooms(id) on delete cascade,
  phase_number integer not null,
  voter_player_id uuid not null references public.mafia_room_players(id) on delete cascade,
  target_player_id uuid not null references public.mafia_room_players(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (room_id, phase_number, voter_player_id)
);

create table if not exists public.mafia_game_events (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.mafia_rooms(id) on delete cascade,
  phase_number integer not null,
  phase public.mafia_phase not null,
  visible_to public.mafia_vote_scope not null default 'all',
  recipient_player_id uuid null references public.mafia_room_players(id) on delete cascade,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists mafia_room_players_room_idx on public.mafia_room_players(room_id);
create index if not exists mafia_roles_room_idx on public.mafia_player_roles(room_id);
create index if not exists mafia_night_actions_room_phase_idx on public.mafia_night_actions(room_id, phase_number);
create index if not exists mafia_day_votes_room_phase_idx on public.mafia_day_votes(room_id, phase_number);
create index if not exists mafia_events_room_phase_idx on public.mafia_game_events(room_id, phase_number);

drop trigger if exists mafia_rooms_updated_at on public.mafia_rooms;
create trigger mafia_rooms_updated_at before update on public.mafia_rooms
for each row execute function public.set_updated_at();

drop trigger if exists mafia_room_players_updated_at on public.mafia_room_players;
create trigger mafia_room_players_updated_at before update on public.mafia_room_players
for each row execute function public.set_updated_at();

drop trigger if exists mafia_night_actions_updated_at on public.mafia_night_actions;
create trigger mafia_night_actions_updated_at before update on public.mafia_night_actions
for each row execute function public.set_updated_at();

drop trigger if exists mafia_day_votes_updated_at on public.mafia_day_votes;
create trigger mafia_day_votes_updated_at before update on public.mafia_day_votes
for each row execute function public.set_updated_at();

alter table public.mafia_rooms enable row level security;
alter table public.mafia_room_players enable row level security;
alter table public.mafia_player_roles enable row level security;
alter table public.mafia_night_actions enable row level security;
alter table public.mafia_police_reports enable row level security;
alter table public.mafia_day_votes enable row level security;
alter table public.mafia_game_events enable row level security;

-- =============================================================================
-- Imposter
-- =============================================================================
do $$
begin
  if not exists (select 1 from pg_type where typname = 'imposter_phase') then
    create type public.imposter_phase as enum ('lobby', 'role_reveal', 'discussion', 'voting', 'ended');
  end if;

  if not exists (select 1 from pg_type where typname = 'imposter_role') then
    create type public.imposter_role as enum ('imposter', 'crew');
  end if;

  if not exists (select 1 from pg_type where typname = 'imposter_winner') then
    create type public.imposter_winner as enum ('imposter', 'crew');
  end if;
end
$$;

create table if not exists public.imposter_rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  state public.imposter_phase not null default 'lobby',
  host_player_id uuid null,
  category_id text null,
  secret_prompt text null,
  phase_number integer not null default 0,
  phase_ends_at timestamptz null,
  winner public.imposter_winner null,
  public_message text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.imposter_room_players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.imposter_rooms(id) on delete cascade,
  display_name text not null,
  seat_order integer not null default 0,
  status text not null default 'alive' check (status in ('alive', 'eliminated')),
  role_reveal_ready boolean not null default false,
  discussion_ready boolean not null default false,
  joined_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.imposter_room_players
add column if not exists status text not null default 'alive';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'imposter_rooms_host_player_id_fkey_v1'
  ) then
    alter table public.imposter_rooms
      add constraint imposter_rooms_host_player_id_fkey_v1
      foreign key (host_player_id) references public.imposter_room_players(id) on delete set null;
  end if;
end
$$;

create table if not exists public.imposter_player_roles (
  player_id uuid primary key references public.imposter_room_players(id) on delete cascade,
  room_id uuid not null references public.imposter_rooms(id) on delete cascade,
  role public.imposter_role not null,
  prompt text null,
  revealed_at timestamptz null,
  created_at timestamptz not null default now()
);

create table if not exists public.imposter_votes (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.imposter_rooms(id) on delete cascade,
  phase_number integer not null,
  voter_player_id uuid not null references public.imposter_room_players(id) on delete cascade,
  target_player_id uuid not null references public.imposter_room_players(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (room_id, phase_number, voter_player_id)
);

create index if not exists imposter_room_players_room_idx on public.imposter_room_players(room_id);
create index if not exists imposter_roles_room_idx on public.imposter_player_roles(room_id);
create index if not exists imposter_votes_room_phase_idx on public.imposter_votes(room_id, phase_number);

drop trigger if exists imposter_rooms_updated_at on public.imposter_rooms;
create trigger imposter_rooms_updated_at before update on public.imposter_rooms
for each row execute function public.set_updated_at();

drop trigger if exists imposter_room_players_updated_at on public.imposter_room_players;
create trigger imposter_room_players_updated_at before update on public.imposter_room_players
for each row execute function public.set_updated_at();

drop trigger if exists imposter_votes_updated_at on public.imposter_votes;
create trigger imposter_votes_updated_at before update on public.imposter_votes
for each row execute function public.set_updated_at();

alter table public.imposter_rooms enable row level security;
alter table public.imposter_room_players enable row level security;
alter table public.imposter_player_roles enable row level security;
alter table public.imposter_votes enable row level security;

-- =============================================================================
-- Chicago
-- =============================================================================
do $$
begin
  if not exists (select 1 from pg_type where typname = 'chicago_phase') then
    create type public.chicago_phase as enum (
      'lobby',
      'dealing',
      'draw_phase_1',
      'draw_phase_2',
      'draw_phase_3',
      'poker_score_1',
      'poker_score_2',
      'trick_phase',
      'result',
      'game_over'
    );
  end if;
end
$$;

create table if not exists public.chicago_rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  state public.chicago_phase not null default 'lobby',
  host_player_id uuid null,
  current_round integer not null default 0,
  dealer_player_id uuid null,
  lead_player_id uuid null,
  current_turn_player_id uuid null,
  phase_number integer not null default 0,
  phase_ends_at timestamptz null,
  winner_player_id uuid null,
  public_message text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.chicago_room_players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.chicago_rooms(id) on delete cascade,
  display_name text not null,
  seat_order integer not null default 0,
  score integer not null default 0,
  status text not null default 'active' check (status in ('active', 'eliminated')),
  draw_ready boolean not null default false,
  trick_ready boolean not null default false,
  chicago_declared boolean not null default false,
  joined_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'chicago_rooms_host_player_id_fkey_v1'
  ) then
    alter table public.chicago_rooms
      add constraint chicago_rooms_host_player_id_fkey_v1
      foreign key (host_player_id) references public.chicago_room_players(id) on delete set null;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'chicago_rooms_dealer_player_id_fkey_v1'
  ) then
    alter table public.chicago_rooms
      add constraint chicago_rooms_dealer_player_id_fkey_v1
      foreign key (dealer_player_id) references public.chicago_room_players(id) on delete set null;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'chicago_rooms_lead_player_id_fkey_v1'
  ) then
    alter table public.chicago_rooms
      add constraint chicago_rooms_lead_player_id_fkey_v1
      foreign key (lead_player_id) references public.chicago_room_players(id) on delete set null;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'chicago_rooms_current_turn_player_id_fkey_v1'
  ) then
    alter table public.chicago_rooms
      add constraint chicago_rooms_current_turn_player_id_fkey_v1
      foreign key (current_turn_player_id) references public.chicago_room_players(id) on delete set null;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'chicago_rooms_winner_player_id_fkey_v1'
  ) then
    alter table public.chicago_rooms
      add constraint chicago_rooms_winner_player_id_fkey_v1
      foreign key (winner_player_id) references public.chicago_room_players(id) on delete set null;
  end if;
end
$$;

create table if not exists public.chicago_rounds (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.chicago_rooms(id) on delete cascade,
  round_number integer not null,
  dealer_player_id uuid not null references public.chicago_room_players(id) on delete cascade,
  active_phase public.chicago_phase not null,
  draw_number integer not null default 0,
  trick_number integer not null default 0,
  deck jsonb not null default '[]'::jsonb,
  chicago_declared_by uuid null references public.chicago_room_players(id) on delete set null,
  chicago_failed boolean not null default false,
  chicago_resolved boolean not null default false,
  last_trick_winner_player_id uuid null references public.chicago_room_players(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (room_id, round_number)
);

create table if not exists public.chicago_player_hands (
  player_id uuid primary key references public.chicago_room_players(id) on delete cascade,
  room_id uuid not null references public.chicago_rooms(id) on delete cascade,
  round_id uuid not null references public.chicago_rounds(id) on delete cascade,
  cards jsonb not null default '[]'::jsonb,
  last_poker_hand_name text null,
  last_poker_points integer not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.chicago_draw_actions (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.chicago_room_players(id) on delete cascade,
  round_id uuid not null references public.chicago_rounds(id) on delete cascade,
  draw_number integer not null,
  discarded_cards jsonb not null default '[]'::jsonb,
  completed_at timestamptz not null default now(),
  unique (player_id, round_id, draw_number)
);

create table if not exists public.chicago_tricks (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.chicago_rounds(id) on delete cascade,
  trick_number integer not null,
  lead_suit text null,
  winner_player_id uuid null references public.chicago_room_players(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (round_id, trick_number)
);

create table if not exists public.chicago_cards_played (
  id uuid primary key default gen_random_uuid(),
  trick_id uuid not null references public.chicago_tricks(id) on delete cascade,
  player_id uuid not null references public.chicago_room_players(id) on delete cascade,
  card jsonb not null,
  play_order integer not null,
  created_at timestamptz not null default now(),
  unique (trick_id, player_id)
);

create index if not exists chicago_room_players_room_idx on public.chicago_room_players(room_id);
create index if not exists chicago_rounds_room_idx on public.chicago_rounds(room_id, round_number);
create index if not exists chicago_hands_room_idx on public.chicago_player_hands(room_id, round_id);
create index if not exists chicago_draw_actions_round_idx on public.chicago_draw_actions(round_id, draw_number);
create index if not exists chicago_tricks_round_idx on public.chicago_tricks(round_id, trick_number);
create index if not exists chicago_cards_played_trick_idx on public.chicago_cards_played(trick_id);

drop trigger if exists chicago_rooms_updated_at on public.chicago_rooms;
create trigger chicago_rooms_updated_at before update on public.chicago_rooms
for each row execute function public.set_updated_at();

drop trigger if exists chicago_room_players_updated_at on public.chicago_room_players;
create trigger chicago_room_players_updated_at before update on public.chicago_room_players
for each row execute function public.set_updated_at();

drop trigger if exists chicago_player_hands_updated_at on public.chicago_player_hands;
create trigger chicago_player_hands_updated_at before update on public.chicago_player_hands
for each row execute function public.set_updated_at();

alter table public.chicago_rooms enable row level security;
alter table public.chicago_room_players enable row level security;
alter table public.chicago_rounds enable row level security;
alter table public.chicago_player_hands enable row level security;
alter table public.chicago_draw_actions enable row level security;
alter table public.chicago_tricks enable row level security;
alter table public.chicago_cards_played enable row level security;

-- =============================================================================
-- Music Quiz
-- =============================================================================
create table if not exists public.music_quiz_rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  state text not null default 'lobby' check (state in ('lobby', 'question', 'reveal', 'completed')),
  host_player_id uuid null,
  current_round_id uuid null,
  selected_pool text null check (selected_pool in ('hits', 'classics', 'mix')),
  total_rounds integer not null default 10,
  phase_number integer not null default 0,
  public_message text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.music_quiz_rooms
  add column if not exists selected_pool text null;

alter table public.music_quiz_rooms
  add column if not exists total_rounds integer not null default 10;

create table if not exists public.music_quiz_players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.music_quiz_rooms(id) on delete cascade,
  display_name text not null,
  seat_order integer not null,
  score integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.music_quiz_rounds (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.music_quiz_rooms(id) on delete cascade,
  round_number integer not null,
  prompt_type text not null check (prompt_type in ('title', 'artist')),
  spotify_url text not null,
  spotify_track_id text not null,
  song_title text not null,
  artist_name text not null,
  artist_spotify_url text null,
  cover_image_url text null,
  point_value integer not null default 1,
  state text not null default 'question' check (state in ('question', 'reveal')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.music_quiz_answers (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.music_quiz_rounds(id) on delete cascade,
  player_id uuid not null references public.music_quiz_players(id) on delete cascade,
  answer_text text not null default '',
  awarded_points integer not null default 0,
  submitted_at timestamptz null,
  updated_at timestamptz not null default now(),
  unique (round_id, player_id)
);

create table if not exists public.music_quiz_library (
  id uuid primary key default gen_random_uuid(),
  spotify_url text not null unique,
  spotify_track_id text null,
  song_title text null,
  artist_name text null,
  category text not null check (category in ('hits', 'classics')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.music_quiz_library
  add column if not exists spotify_track_id text null;

alter table public.music_quiz_library
  add column if not exists song_title text null;

alter table public.music_quiz_library
  add column if not exists artist_name text null;

alter table public.music_quiz_library
  add column if not exists artist_spotify_url text null;

alter table public.music_quiz_rounds
  add column if not exists artist_spotify_url text null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'music_quiz_rooms_host_player_id_fkey'
  ) then
    alter table public.music_quiz_rooms
      add constraint music_quiz_rooms_host_player_id_fkey
      foreign key (host_player_id) references public.music_quiz_players(id) on delete set null;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'music_quiz_rooms_current_round_id_fkey'
  ) then
    alter table public.music_quiz_rooms
      add constraint music_quiz_rooms_current_round_id_fkey
      foreign key (current_round_id) references public.music_quiz_rounds(id) on delete set null;
  end if;
end
$$;

create index if not exists music_quiz_players_room_id_idx on public.music_quiz_players(room_id);
create index if not exists music_quiz_rounds_room_id_idx on public.music_quiz_rounds(room_id);
create index if not exists music_quiz_answers_round_id_idx on public.music_quiz_answers(round_id);

drop trigger if exists music_quiz_rooms_set_updated_at on public.music_quiz_rooms;
create trigger music_quiz_rooms_set_updated_at
before update on public.music_quiz_rooms
for each row execute function public.set_updated_at();

drop trigger if exists music_quiz_players_set_updated_at on public.music_quiz_players;
create trigger music_quiz_players_set_updated_at
before update on public.music_quiz_players
for each row execute function public.set_updated_at();

drop trigger if exists music_quiz_rounds_set_updated_at on public.music_quiz_rounds;
create trigger music_quiz_rounds_set_updated_at
before update on public.music_quiz_rounds
for each row execute function public.set_updated_at();

drop trigger if exists music_quiz_answers_set_updated_at on public.music_quiz_answers;
create trigger music_quiz_answers_set_updated_at
before update on public.music_quiz_answers
for each row execute function public.set_updated_at();

drop trigger if exists music_quiz_library_set_updated_at on public.music_quiz_library;
create trigger music_quiz_library_set_updated_at
before update on public.music_quiz_library
for each row execute function public.set_updated_at();

insert into public.music_quiz_library (spotify_url, spotify_track_id, song_title, artist_name, artist_spotify_url, category)
values
  ('https://open.spotify.com/track/07TGjTgMGUDW5qrsMrOnYA', '07TGjTgMGUDW5qrsMrOnYA', 'Blinding Lights', 'The Weeknd', 'https://open.spotify.com/artist/1Xyo4u8uXC1ZmMpatF05PJ', 'hits'),
  ('https://open.spotify.com/track/32OlwWuMpZ6b0aN2RZOeMS', '32OlwWuMpZ6b0aN2RZOeMS', 'Uptown Funk (feat. Bruno Mars)', 'Mark Ronson, Bruno Mars', 'https://open.spotify.com/artist/3hv9jJF3adDNsBSIQDqcjp', 'hits'),
  ('https://open.spotify.com/track/3Hwl0OPFb6d66RFoV3cMzP', '3Hwl0OPFb6d66RFoV3cMzP', 'Rolling In The Deep', 'Adele', 'https://open.spotify.com/artist/4dpARuHxo51G3z768sgnrY', 'hits'),
  ('https://open.spotify.com/track/5avln5GEFcjd1iQDx5xjVN', '5avln5GEFcjd1iQDx5xjVN', 'Billie Jean', 'Michael Jackson', 'https://open.spotify.com/artist/3fMbdgg4jU18AjLCKBhRSm', 'hits'),
  ('https://open.spotify.com/track/2x7Sc5js1etrlZ50lH482p', '2x7Sc5js1etrlZ50lH482p', 'Mr. Brightside', 'The Killers', 'https://open.spotify.com/artist/0C0XlULifJtAgn6ZNCW2eu', 'hits'),
  ('https://open.spotify.com/track/6FyfOXMpEkiIV6cuVx5PgH', '6FyfOXMpEkiIV6cuVx5PgH', 'Smells Like Teen Spirit', 'Nirvana', 'https://open.spotify.com/artist/6olE6TJLqED3rqDCT0FyPh', 'hits'),
  ('https://open.spotify.com/track/49JfoBc3DUw2EwDIo6YQmR', '49JfoBc3DUw2EwDIo6YQmR', 'Shape of You', 'Ed Sheeran', 'https://open.spotify.com/artist/6eUKZXaKkcviH0Ku9w2n3V', 'hits'),
  ('https://open.spotify.com/track/2patgfDMwQsMBGdlwHDKOg', '2patgfDMwQsMBGdlwHDKOg', 'CAN''T STOP THE FEELING! (Original Song from DreamWorks Animation''s "TROLLS")', 'Justin Timberlake', 'https://open.spotify.com/artist/31TPClRtHm23RisEBtV3X7', 'hits'),
  ('https://open.spotify.com/track/4RPkqiTSRzdo0RPg13bE8n', '4RPkqiTSRzdo0RPg13bE8n', 'Shake It Off', 'Taylor Swift', 'https://open.spotify.com/artist/06HL4z0CvFAxyc27GXpf02', 'hits'),
  ('https://open.spotify.com/track/7uatTgUs1ygl1ScYyRYVP2', '7uatTgUs1ygl1ScYyRYVP2', 'Levitating', 'Dua Lipa', 'https://open.spotify.com/artist/6M2wZ9GZgrQXHCFfjv46we', 'hits'),
  ('https://open.spotify.com/track/4TJk6iQu8B8DCRLV7TwzaM', '4TJk6iQu8B8DCRLV7TwzaM', 'Dancing Queen', 'ABBA', 'https://open.spotify.com/artist/0LcJLqbBmaGUft1e9Mm8HV', 'classics'),
  ('https://open.spotify.com/track/1TfqLAPs4K3s2rJMoCokcS', '1TfqLAPs4K3s2rJMoCokcS', 'Sweet Dreams (Are Made of This) - 2005 Remaster', 'Eurythmics, Annie Lennox, Dave Stewart', 'https://open.spotify.com/artist/0NKDgy9j66h3DLnN8qu1bB', 'classics'),
  ('https://open.spotify.com/track/1XsfDGslxnCPm5RDlD874U', '1XsfDGslxnCPm5RDlD874U', 'Take on Me - 1985 Single Mix; 2015 Remaster', 'a-ha', 'https://open.spotify.com/artist/2jzc5TC5TVFLXQlBNiIUzE', 'classics'),
  ('https://open.spotify.com/track/2ACLo9BX4IHonF4vDy6GoH', '2ACLo9BX4IHonF4vDy6GoH', 'I Wanna Dance With Somebody (Who Loves Me)', 'Whitney Houston', 'https://open.spotify.com/artist/6XpaIBNiVzIetEPCWDvAFP', 'classics'),
  ('https://open.spotify.com/track/29MVHxUqkpG2vGhMTokBGl', '29MVHxUqkpG2vGhMTokBGl', 'I Will Survive', 'Gloria Gaynor', 'https://open.spotify.com/artist/6V6WCgi7waF55bJmylC4H5', 'classics'),
  ('https://open.spotify.com/track/3oTlkzk1OtrhH8wBAduVEi', '3oTlkzk1OtrhH8wBAduVEi', 'Smells Like Teen Spirit', 'Nirvana', 'https://open.spotify.com/artist/6olE6TJLqED3rqDCT0FyPh', 'classics'),
  ('https://open.spotify.com/track/1uTbFcWsB8Vptdf7U9qCHT', '1uTbFcWsB8Vptdf7U9qCHT', 'Livin'' On A Prayer', 'Bon Jovi', 'https://open.spotify.com/artist/58lV9VcRSjABbAbfWS6skp', 'classics'),
  ('https://open.spotify.com/track/5MvX4j51ArXH28d17vCJ0M', '5MvX4j51ArXH28d17vCJ0M', 'Wake Me Up Before You Go-Go', 'Wham!', 'https://open.spotify.com/artist/6jSC3cT0qM0pcRgrdvkp3x', 'classics'),
  ('https://open.spotify.com/track/7Cuk8jsPPoNYQWXK9XRFvG', '7Cuk8jsPPoNYQWXK9XRFvG', 'September', 'Earth, Wind & Fire', 'https://open.spotify.com/artist/4t9H3pMvAmifmk16zK5UO3', 'classics'),
  ('https://open.spotify.com/track/4EZz8Byhbjk0tOKFJlCgPB', '4EZz8Byhbjk0tOKFJlCgPB', 'Never Gonna Give You Up - 7" Mix', 'Rick Astley', 'https://open.spotify.com/search/Rick%20Astley', 'classics')
on conflict (spotify_url) do nothing;

do $$
begin
  if not exists (
    select 1
    from pg_publication_rel pr
    join pg_publication p on p.oid = pr.prpubid
    join pg_class c on c.oid = pr.prrelid
    where p.pubname = 'supabase_realtime'
      and c.relname = 'music_quiz_rooms'
  ) then
    alter publication supabase_realtime add table public.music_quiz_rooms;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_publication_rel pr
    join pg_publication p on p.oid = pr.prpubid
    join pg_class c on c.oid = pr.prrelid
    where p.pubname = 'supabase_realtime'
      and c.relname = 'music_quiz_players'
  ) then
    alter publication supabase_realtime add table public.music_quiz_players;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_publication_rel pr
    join pg_publication p on p.oid = pr.prpubid
    join pg_class c on c.oid = pr.prrelid
    where p.pubname = 'supabase_realtime'
      and c.relname = 'music_quiz_rounds'
  ) then
    alter publication supabase_realtime add table public.music_quiz_rounds;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_publication_rel pr
    join pg_publication p on p.oid = pr.prpubid
    join pg_class c on c.oid = pr.prrelid
    where p.pubname = 'supabase_realtime'
      and c.relname = 'music_quiz_answers'
  ) then
    alter publication supabase_realtime add table public.music_quiz_answers;
  end if;
end
$$;

-- =============================================================================
-- Trivia
-- =============================================================================
create table if not exists public.trivia_rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  state text not null default 'lobby' check (state in ('lobby', 'question', 'reveal', 'completed')),
  host_player_id uuid null,
  current_turn_id uuid null,
  selected_categories text[] not null default '{}',
  questions_per_player integer not null default 6,
  phase_number integer not null default 0,
  public_message text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.trivia_players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.trivia_rooms(id) on delete cascade,
  display_name text not null,
  seat_order integer not null,
  score integer not null default 0,
  correct_answers integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.trivia_turns (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.trivia_rooms(id) on delete cascade,
  player_id uuid not null references public.trivia_players(id) on delete cascade,
  turn_number integer not null,
  player_question_number integer not null,
  category text not null,
  question_text text not null,
  answer_text text not null,
  revealed_at timestamptz null,
  judged_at timestamptz null,
  awarded_points integer not null default 0,
  is_correct boolean null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (room_id, turn_number)
);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'trivia_rooms_host_player_id_fkey'
  ) then
    alter table public.trivia_rooms
      add constraint trivia_rooms_host_player_id_fkey
      foreign key (host_player_id) references public.trivia_players(id) on delete set null;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'trivia_rooms_current_turn_id_fkey'
  ) then
    alter table public.trivia_rooms
      add constraint trivia_rooms_current_turn_id_fkey
      foreign key (current_turn_id) references public.trivia_turns(id) on delete set null;
  end if;
end
$$;

create index if not exists trivia_players_room_id_idx on public.trivia_players(room_id);
create index if not exists trivia_turns_room_id_idx on public.trivia_turns(room_id);
create index if not exists trivia_turns_player_id_idx on public.trivia_turns(player_id);

drop trigger if exists trivia_rooms_set_updated_at on public.trivia_rooms;
create trigger trivia_rooms_set_updated_at
before update on public.trivia_rooms
for each row execute function public.set_updated_at();

drop trigger if exists trivia_players_set_updated_at on public.trivia_players;
create trigger trivia_players_set_updated_at
before update on public.trivia_players
for each row execute function public.set_updated_at();

drop trigger if exists trivia_turns_set_updated_at on public.trivia_turns;
create trigger trivia_turns_set_updated_at
before update on public.trivia_turns
for each row execute function public.set_updated_at();

do $$
begin
  if not exists (
    select 1
    from pg_publication_rel pr
    join pg_publication p on p.oid = pr.prpubid
    join pg_class c on c.oid = pr.prrelid
    where p.pubname = 'supabase_realtime'
      and c.relname = 'trivia_rooms'
  ) then
    alter publication supabase_realtime add table public.trivia_rooms;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_publication_rel pr
    join pg_publication p on p.oid = pr.prpubid
    join pg_class c on c.oid = pr.prrelid
    where p.pubname = 'supabase_realtime'
      and c.relname = 'trivia_players'
  ) then
    alter publication supabase_realtime add table public.trivia_players;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_publication_rel pr
    join pg_publication p on p.oid = pr.prpubid
    join pg_class c on c.oid = pr.prrelid
    where p.pubname = 'supabase_realtime'
      and c.relname = 'trivia_turns'
  ) then
    alter publication supabase_realtime add table public.trivia_turns;
  end if;
end
$$;

-- =============================================================================
-- Identity & access control
--
-- Every device signs in with Supabase *anonymous auth* (no account, no email).
-- Each player row is owned by the auth user that joined with it, and all game
-- data is only readable/writable by players who are members of that room.
-- The anon key on its own can no longer read or change anything.
-- =============================================================================

-- Ownership columns ----------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['rooms', 'mafia_rooms', 'imposter_rooms', 'chicago_rooms', 'music_quiz_rooms', 'trivia_rooms'] loop
    execute format('alter table public.%I add column if not exists created_by uuid', t);
    execute format('alter table public.%I alter column created_by set default auth.uid()', t);
  end loop;

  foreach t in array array['players', 'mafia_room_players', 'imposter_room_players', 'chicago_room_players', 'music_quiz_players', 'trivia_players'] loop
    execute format('alter table public.%I add column if not exists auth_user_id uuid', t);
    execute format('alter table public.%I alter column auth_user_id set default auth.uid()', t);
    -- Rows from before auth existed get a random owner nobody can sign in as;
    -- the daily cleanup deletes those old rooms.
    execute format('update public.%I set auth_user_id = gen_random_uuid() where auth_user_id is null', t);
    execute format('alter table public.%I alter column auth_user_id set not null', t);
    execute format('create unique index if not exists %I on public.%I (room_id, auth_user_id)', t || '_room_user_uniq', t);
    execute format('create index if not exists %I on public.%I (auth_user_id)', t || '_auth_user_idx', t);
  end loop;
end
$$;

-- Membership helpers (security definer so policies don't recurse) ------------
create or replace function public.memematch_is_member(p_room uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.players where room_id = p_room and auth_user_id = auth.uid());
$$;
create or replace function public.mafia_is_member(p_room uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.mafia_room_players where room_id = p_room and auth_user_id = auth.uid());
$$;
create or replace function public.imposter_is_member(p_room uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.imposter_room_players where room_id = p_room and auth_user_id = auth.uid());
$$;
create or replace function public.chicago_is_member(p_room uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.chicago_room_players where room_id = p_room and auth_user_id = auth.uid());
$$;
create or replace function public.music_quiz_is_member(p_room uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.music_quiz_players where room_id = p_room and auth_user_id = auth.uid());
$$;
create or replace function public.trivia_is_member(p_room uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.trivia_players where room_id = p_room and auth_user_id = auth.uid());
$$;

-- Resolve child rows that only reference a round/trick back to their room.
create or replace function public.memematch_round_room(p_round uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select room_id from public.rounds where id = p_round;
$$;
create or replace function public.chicago_round_room(p_round uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select room_id from public.chicago_rounds where id = p_round;
$$;
create or replace function public.chicago_trick_room(p_trick uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select r.room_id from public.chicago_tricks t join public.chicago_rounds r on r.id = t.round_id where t.id = p_trick;
$$;
create or replace function public.music_quiz_round_room(p_round uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select room_id from public.music_quiz_rounds where id = p_round;
$$;

-- Is this MemeMatch player row owned by the caller?
create or replace function public.memematch_is_my_player(p_player uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.players where id = p_player and auth_user_id = auth.uid());
$$;
create or replace function public.memematch_submission_owner(p_submission uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select player_id from public.submissions where id = p_submission;
$$;

-- Policies -------------------------------------------------------------------
do $$
declare
  pol record;
  r record;
begin
  -- Start from a clean slate: drop every existing policy on Picklo tables
  -- (including the old "open access" ones).
  for pol in
    select schemaname, tablename, policyname from pg_policies
    where schemaname = 'public' and tablename = any (array[
      'rooms', 'players', 'rounds', 'player_images', 'submissions', 'votes', 'room_scores',
      'mafia_rooms', 'mafia_room_players', 'mafia_player_roles', 'mafia_night_actions', 'mafia_police_reports', 'mafia_day_votes', 'mafia_game_events',
      'imposter_rooms', 'imposter_room_players', 'imposter_player_roles', 'imposter_votes',
      'chicago_rooms', 'chicago_room_players', 'chicago_rounds', 'chicago_player_hands', 'chicago_draw_actions', 'chicago_tricks', 'chicago_cards_played',
      'music_quiz_rooms', 'music_quiz_players', 'music_quiz_rounds', 'music_quiz_answers', 'music_quiz_library',
      'trivia_rooms', 'trivia_players', 'trivia_turns'])
  loop
    execute format('drop policy if exists %I on %I.%I', pol.policyname, pol.schemaname, pol.tablename);
  end loop;

  -- Room tables: the creator and members can read; members can update.
  for r in select * from (values
    ('rooms', 'memematch_is_member'),
    ('mafia_rooms', 'mafia_is_member'),
    ('imposter_rooms', 'imposter_is_member'),
    ('chicago_rooms', 'chicago_is_member'),
    ('music_quiz_rooms', 'music_quiz_is_member'),
    ('trivia_rooms', 'trivia_is_member')
  ) as v(tbl, fn) loop
    execute format('alter table public.%I enable row level security', r.tbl);
    execute format($p$create policy "members read room" on public.%I for select to authenticated
      using (created_by = auth.uid() or public.%I(id))$p$, r.tbl, r.fn);
    execute format($p$create policy "create own room" on public.%I for insert to authenticated
      with check (created_by = auth.uid())$p$, r.tbl);
    execute format($p$create policy "members update room" on public.%I for update to authenticated
      using (public.%I(id)) with check (public.%I(id))$p$, r.tbl, r.fn, r.fn);
  end loop;

  -- Player tables: members see each other; the room creator adds themselves
  -- directly, everyone else joins through join_room().
  for r in select * from (values
    ('players', 'rooms', 'memematch_is_member'),
    ('mafia_room_players', 'mafia_rooms', 'mafia_is_member'),
    ('imposter_room_players', 'imposter_rooms', 'imposter_is_member'),
    ('chicago_room_players', 'chicago_rooms', 'chicago_is_member'),
    ('music_quiz_players', 'music_quiz_rooms', 'music_quiz_is_member'),
    ('trivia_players', 'trivia_rooms', 'trivia_is_member')
  ) as v(tbl, room_tbl, fn) loop
    execute format('alter table public.%I enable row level security', r.tbl);
    execute format($p$create policy "members read players" on public.%I for select to authenticated
      using (auth_user_id = auth.uid() or public.%I(room_id))$p$, r.tbl, r.fn);
    execute format($p$create policy "creator adds self" on public.%I for insert to authenticated
      with check (auth_user_id = auth.uid()
        and exists (select 1 from public.%I rm where rm.id = %I.room_id and rm.created_by = auth.uid()))$p$, r.tbl, r.room_tbl, r.tbl);
    execute format($p$create policy "members update players" on public.%I for update to authenticated
      using (public.%I(room_id)) with check (public.%I(room_id))$p$, r.tbl, r.fn, r.fn);
    execute format($p$create policy "members delete players" on public.%I for delete to authenticated
      using (public.%I(room_id))$p$, r.tbl, r.fn);
  end loop;

  -- Game-state tables: full access for members of the owning room.
  for r in select * from (values
    ('rounds', 'public.memematch_is_member(room_id)'),
    ('player_images', 'public.memematch_is_member(room_id)'),
    ('submissions', 'public.memematch_is_member(public.memematch_round_room(round_id))'),
    ('votes', 'public.memematch_is_member(public.memematch_round_room(round_id))'),
    ('room_scores', 'public.memematch_is_member(room_id)'),
    ('mafia_player_roles', 'public.mafia_is_member(room_id)'),
    ('mafia_night_actions', 'public.mafia_is_member(room_id)'),
    ('mafia_police_reports', 'public.mafia_is_member(room_id)'),
    ('mafia_day_votes', 'public.mafia_is_member(room_id)'),
    ('mafia_game_events', 'public.mafia_is_member(room_id)'),
    ('imposter_player_roles', 'public.imposter_is_member(room_id)'),
    ('imposter_votes', 'public.imposter_is_member(room_id)'),
    ('chicago_rounds', 'public.chicago_is_member(room_id)'),
    ('chicago_player_hands', 'public.chicago_is_member(room_id)'),
    ('chicago_draw_actions', 'public.chicago_is_member(public.chicago_round_room(round_id))'),
    ('chicago_tricks', 'public.chicago_is_member(public.chicago_round_room(round_id))'),
    ('chicago_cards_played', 'public.chicago_is_member(public.chicago_trick_room(trick_id))'),
    ('music_quiz_rounds', 'public.music_quiz_is_member(room_id)'),
    ('music_quiz_answers', 'public.music_quiz_is_member(public.music_quiz_round_room(round_id))'),
    ('trivia_turns', 'public.trivia_is_member(room_id)')
  ) as v(tbl, cond) loop
    execute format('alter table public.%I enable row level security', r.tbl);
    execute format('create policy "members read" on public.%I for select to authenticated using (%s)', r.tbl, r.cond);
    execute format('create policy "members insert" on public.%I for insert to authenticated with check (%s)', r.tbl, r.cond);
    execute format('create policy "members update" on public.%I for update to authenticated using (%s) with check (%s)', r.tbl, r.cond, r.cond);
    execute format('create policy "members delete" on public.%I for delete to authenticated using (%s)', r.tbl, r.cond);
  end loop;

  -- MemeMatch anti-cheat: you can only play, upload and vote as yourself,
  -- and never vote for your own photo.
  drop policy "members insert" on public.submissions;
  drop policy "members update" on public.submissions;
  create policy "submit as self" on public.submissions for insert to authenticated
    with check (public.memematch_is_my_player(player_id)
      and public.memematch_is_member(public.memematch_round_room(round_id)));

  drop policy "members insert" on public.votes;
  drop policy "members update" on public.votes;
  create policy "vote as self" on public.votes for insert to authenticated
    with check (public.memematch_is_my_player(voter_player_id)
      and public.memematch_submission_owner(submission_id) <> voter_player_id
      and public.memematch_is_member(public.memematch_round_room(round_id)));
  create policy "change own vote" on public.votes for update to authenticated
    using (public.memematch_is_my_player(voter_player_id))
    with check (public.memematch_is_my_player(voter_player_id)
      and public.memematch_submission_owner(submission_id) <> voter_player_id);

  drop policy "members insert" on public.player_images;
  drop policy "members delete" on public.player_images;
  create policy "upload own images" on public.player_images for insert to authenticated
    with check (public.memematch_is_my_player(player_id) and public.memematch_is_member(room_id));
  create policy "remove own images" on public.player_images for delete to authenticated
    using (public.memematch_is_my_player(player_id));

  -- Scores are only written by finalize_round().
  drop policy "members insert" on public.room_scores;
  drop policy "members update" on public.room_scores;
  drop policy "members delete" on public.room_scores;

  -- The song library is shared, read-only reference data.
  alter table public.music_quiz_library enable row level security;
  create policy "read library" on public.music_quiz_library for select to authenticated using (true);
end
$$;

-- =============================================================================
-- RPCs
-- =============================================================================

-- Join (or re-join) a room by code. Returns the caller's player for that room.
-- Re-joining from the same device returns the existing player instead of a duplicate.
create or replace function public.join_room(p_game text, p_code text, p_name text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_code text := upper(trim(p_code));
  v_name text := left(trim(p_name), 40);
  v_room_id uuid;
  v_state text;
  v_count integer;
  v_player_id uuid;
begin
  if v_uid is null then
    raise exception 'NOT_SIGNED_IN' using errcode = '28000';
  end if;
  if v_name = '' then
    raise exception 'NAME_REQUIRED' using errcode = '22023';
  end if;

  if p_game = 'memematch' then
    select id, phase into v_room_id, v_state from public.rooms where code = v_code;
    if v_room_id is null then raise exception 'ROOM_NOT_FOUND' using errcode = 'P0002'; end if;
    select id into v_player_id from public.players where room_id = v_room_id and auth_user_id = v_uid;
    if v_player_id is null then
      if v_state = 'finished' then raise exception 'GAME_ALREADY_ENDED' using errcode = 'P0001'; end if;
      insert into public.players (room_id, name, auth_user_id) values (v_room_id, v_name, v_uid) returning id into v_player_id;
    end if;

  elsif p_game = 'mafia' then
    select id, state::text into v_room_id, v_state from public.mafia_rooms where code = v_code;
    if v_room_id is null then raise exception 'ROOM_NOT_FOUND' using errcode = 'P0002'; end if;
    select id into v_player_id from public.mafia_room_players where room_id = v_room_id and auth_user_id = v_uid;
    if v_player_id is null then
      if v_state <> 'lobby' then raise exception 'GAME_ALREADY_STARTED' using errcode = 'P0001'; end if;
      select count(*) into v_count from public.mafia_room_players where room_id = v_room_id;
      if v_count >= 20 then raise exception 'ROOM_FULL' using errcode = 'P0001'; end if;
      insert into public.mafia_room_players (room_id, display_name, seat_order, auth_user_id)
      values (v_room_id, v_name, v_count + 1, v_uid) returning id into v_player_id;
    end if;

  elsif p_game = 'imposter' then
    select id, state::text into v_room_id, v_state from public.imposter_rooms where code = v_code;
    if v_room_id is null then raise exception 'ROOM_NOT_FOUND' using errcode = 'P0002'; end if;
    select id into v_player_id from public.imposter_room_players where room_id = v_room_id and auth_user_id = v_uid;
    if v_player_id is null then
      if v_state <> 'lobby' then raise exception 'GAME_ALREADY_STARTED' using errcode = 'P0001'; end if;
      select count(*) into v_count from public.imposter_room_players where room_id = v_room_id;
      if v_count >= 12 then raise exception 'ROOM_FULL' using errcode = 'P0001'; end if;
      insert into public.imposter_room_players (room_id, display_name, seat_order, auth_user_id)
      values (v_room_id, v_name, v_count + 1, v_uid) returning id into v_player_id;
    end if;

  elsif p_game = 'chicago' then
    select id, state::text into v_room_id, v_state from public.chicago_rooms where code = v_code;
    if v_room_id is null then raise exception 'ROOM_NOT_FOUND' using errcode = 'P0002'; end if;
    select id into v_player_id from public.chicago_room_players where room_id = v_room_id and auth_user_id = v_uid;
    if v_player_id is null then
      if v_state = 'game_over' then raise exception 'GAME_ALREADY_ENDED' using errcode = 'P0001'; end if;
      select count(*) into v_count from public.chicago_room_players where room_id = v_room_id;
      if v_count >= 6 then raise exception 'ROOM_FULL' using errcode = 'P0001'; end if;
      insert into public.chicago_room_players (room_id, display_name, seat_order, auth_user_id)
      values (v_room_id, v_name, v_count + 1, v_uid) returning id into v_player_id;
    end if;

  elsif p_game = 'musicQuiz' then
    select id, state into v_room_id, v_state from public.music_quiz_rooms where code = v_code;
    if v_room_id is null then raise exception 'ROOM_NOT_FOUND' using errcode = 'P0002'; end if;
    select id into v_player_id from public.music_quiz_players where room_id = v_room_id and auth_user_id = v_uid;
    if v_player_id is null then
      select count(*) into v_count from public.music_quiz_players where room_id = v_room_id;
      if v_count >= 20 then raise exception 'ROOM_FULL' using errcode = 'P0001'; end if;
      insert into public.music_quiz_players (room_id, display_name, seat_order, auth_user_id)
      values (v_room_id, v_name, v_count + 1, v_uid) returning id into v_player_id;
    end if;

  elsif p_game = 'trivia' then
    select id, state into v_room_id, v_state from public.trivia_rooms where code = v_code;
    if v_room_id is null then raise exception 'ROOM_NOT_FOUND' using errcode = 'P0002'; end if;
    select id into v_player_id from public.trivia_players where room_id = v_room_id and auth_user_id = v_uid;
    if v_player_id is null then
      if v_state <> 'lobby' then raise exception 'GAME_ALREADY_STARTED' using errcode = 'P0001'; end if;
      select count(*) into v_count from public.trivia_players where room_id = v_room_id;
      if v_count >= 12 then raise exception 'ROOM_FULL' using errcode = 'P0001'; end if;
      insert into public.trivia_players (room_id, display_name, seat_order, auth_user_id)
      values (v_room_id, v_name, v_count + 1, v_uid) returning id into v_player_id;
    end if;

  else
    raise exception 'UNKNOWN_GAME' using errcode = '22023';
  end if;

  return jsonb_build_object('room_id', v_room_id, 'player_id', v_player_id, 'code', v_code);
end;
$$;

-- Older versions of these functions may have a different return type, which
-- `create or replace` cannot change.
drop function if exists public.advance_round_if_ready(uuid);
drop function if exists public.finalize_round(uuid);

-- MemeMatch: award a point to the round winner(s). Safe to call more than once.
create or replace function public.finalize_round(p_round_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_round public.rounds%rowtype;
  v_max integer;
begin
  select * into v_round from public.rounds where id = p_round_id for update;
  if not found then return; end if;
  if not public.memematch_is_member(v_round.room_id) then
    raise exception 'NOT_A_MEMBER' using errcode = '42501';
  end if;
  if v_round.scored then return; end if;

  select max(c) into v_max from (
    select count(*) as c from public.votes where round_id = p_round_id group by submission_id
  ) counts;

  if coalesce(v_max, 0) > 0 then
    insert into public.room_scores (room_id, player_id, points)
    select v_round.room_id, s.player_id, 1
    from public.submissions s
    where s.round_id = p_round_id
      and (select count(*) from public.votes v where v.submission_id = s.id) = v_max
    on conflict (room_id, player_id) do update set points = public.room_scores.points + 1;
  end if;

  update public.rounds set scored = true where id = p_round_id;
end;
$$;

-- MemeMatch: move a round forward once everyone has played / voted.
-- Every client calls this after each change; the row lock makes it idempotent.
create or replace function public.advance_round_if_ready(p_round_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_round public.rounds%rowtype;
  v_expected integer;
  v_players integer;
  v_subs integer;
  v_votes integer;
begin
  select * into v_round from public.rounds where id = p_round_id for update;
  if not found then return 'missing'; end if;
  if not public.memematch_is_member(v_round.room_id) then
    raise exception 'NOT_A_MEMBER' using errcode = '42501';
  end if;

  select count(*) into v_players from public.players where room_id = v_round.room_id;
  select least(coalesce(expected_players, v_players), v_players) into v_expected
  from public.rooms where id = v_round.room_id;
  select count(*) into v_subs from public.submissions where round_id = p_round_id;

  if v_round.status = 'collecting' then
    if v_subs >= greatest(v_expected, 2)
       or (v_round.ends_at is not null and now() > v_round.ends_at and v_subs >= 2) then
      update public.rounds set status = 'voting' where id = p_round_id;
      return 'voting';
    end if;
  elsif v_round.status = 'voting' then
    select count(*) into v_votes from public.votes where round_id = p_round_id;
    if v_votes >= v_subs then
      perform public.finalize_round(p_round_id);
      update public.rounds set status = 'done' where id = p_round_id;
      return 'done';
    end if;
  end if;

  return v_round.status;
end;
$$;

revoke execute on function public.join_room(text, text, text) from public, anon;
revoke execute on function public.finalize_round(uuid) from public, anon;
revoke execute on function public.advance_round_if_ready(uuid) from public, anon;
grant execute on function public.join_room(text, text, text) to authenticated;
grant execute on function public.finalize_round(uuid) to authenticated;
grant execute on function public.advance_round_if_ready(uuid) to authenticated;

-- =============================================================================
-- Realtime: every game table streams changes (RLS still applies per subscriber)
-- =============================================================================
do $$
declare
  t text;
begin
  foreach t in array array[
    'rooms', 'players', 'rounds', 'player_images', 'submissions', 'votes', 'room_scores',
    'mafia_rooms', 'mafia_room_players', 'mafia_player_roles', 'mafia_night_actions', 'mafia_police_reports', 'mafia_day_votes', 'mafia_game_events',
    'imposter_rooms', 'imposter_room_players', 'imposter_player_roles', 'imposter_votes',
    'chicago_rooms', 'chicago_room_players', 'chicago_rounds', 'chicago_player_hands', 'chicago_draw_actions', 'chicago_tricks', 'chicago_cards_played',
    'music_quiz_rooms', 'music_quiz_players', 'music_quiz_rounds', 'music_quiz_answers',
    'trivia_rooms', 'trivia_players', 'trivia_turns']
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end
$$;

-- =============================================================================
-- Storage: MemeMatch photos
-- Files live at <room_id>/hand/<file>.jpg. Anyone with the link can view them
-- (the game shows them to the room), but only room members can upload, and
-- only the uploader can delete.
-- =============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('game-images', 'game-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.memematch_can_upload(p_name text) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare
  v_room uuid;
begin
  begin
    v_room := (storage.foldername(p_name))[1]::uuid;
  exception when others then
    return false;
  end;
  return public.memematch_is_member(v_room);
end;
$$;

-- Remove any older (open) policies for this bucket before adding the strict ones.
do $$
declare
  pol record;
begin
  for pol in
    select policyname from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and (coalesce(qual, '') ilike '%game-images%' or coalesce(with_check, '') ilike '%game-images%')
  loop
    execute format('drop policy if exists %I on storage.objects', pol.policyname);
  end loop;
end
$$;

drop policy if exists "members upload game images" on storage.objects;
create policy "members upload game images" on storage.objects for insert to authenticated
  with check (bucket_id = 'game-images' and public.memematch_can_upload(name));

-- Storage needs a SELECT rule before it can delete; uploaders may "see" their own files.
drop policy if exists "uploader reads own game images" on storage.objects;
create policy "uploader reads own game images" on storage.objects for select to authenticated
  using (bucket_id = 'game-images' and owner_id = auth.uid()::text);

drop policy if exists "uploader deletes game images" on storage.objects;
create policy "uploader deletes game images" on storage.objects for delete to authenticated
  using (bucket_id = 'game-images' and owner_id = auth.uid()::text);

-- =============================================================================
-- Housekeeping (called daily by the `cleanup` Edge Function with the service key)
-- =============================================================================

-- MemeMatch rooms whose photos should be removed from storage before the rows go.
create or replace function public.picklo_expired_memematch_rooms(p_max_age interval default interval '24 hours')
returns setof uuid
language sql stable security definer set search_path = '' as $$
  select id from public.rooms where greatest(created_at, updated_at) < now() - p_max_age;
$$;

-- Deletes finished/abandoned rooms of every game (cascades to all their data)
-- and anonymous users that haven't been seen for a month.
create or replace function public.picklo_cleanup(p_max_age interval default interval '24 hours')
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_result jsonb := '{}'::jsonb;
  v_count integer;
  t text;
begin
  foreach t in array array['rooms', 'mafia_rooms', 'imposter_rooms', 'chicago_rooms', 'music_quiz_rooms', 'trivia_rooms'] loop
    execute format('delete from public.%I where greatest(created_at, updated_at) < now() - $1', t) using p_max_age;
    get diagnostics v_count = row_count;
    v_result := v_result || jsonb_build_object(t, v_count);
  end loop;

  delete from auth.users
  where is_anonymous
    and coalesce(last_sign_in_at, created_at) < now() - interval '30 days';
  get diagnostics v_count = row_count;
  v_result := v_result || jsonb_build_object('anonymous_users', v_count);

  return v_result;
end;
$$;

revoke execute on function public.picklo_expired_memematch_rooms(interval) from public, anon, authenticated;
revoke execute on function public.picklo_cleanup(interval) from public, anon, authenticated;
grant execute on function public.picklo_expired_memematch_rooms(interval) to service_role;
grant execute on function public.picklo_cleanup(interval) to service_role;
