create extension if not exists pgcrypto;

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

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
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

drop policy if exists "mafia rooms open access" on public.mafia_rooms;
create policy "mafia rooms open access"
on public.mafia_rooms
for all
using (true)
with check (true);

drop policy if exists "mafia room players open access" on public.mafia_room_players;
create policy "mafia room players open access"
on public.mafia_room_players
for all
using (true)
with check (true);

drop policy if exists "mafia roles open access" on public.mafia_player_roles;
create policy "mafia roles open access"
on public.mafia_player_roles
for all
using (true)
with check (true);

drop policy if exists "mafia night actions open access" on public.mafia_night_actions;
create policy "mafia night actions open access"
on public.mafia_night_actions
for all
using (true)
with check (true);

drop policy if exists "mafia police reports open access" on public.mafia_police_reports;
create policy "mafia police reports open access"
on public.mafia_police_reports
for all
using (true)
with check (true);

drop policy if exists "mafia day votes open access" on public.mafia_day_votes;
create policy "mafia day votes open access"
on public.mafia_day_votes
for all
using (true)
with check (true);

drop policy if exists "mafia events open access" on public.mafia_game_events;
create policy "mafia events open access"
on public.mafia_game_events
for all
using (true)
with check (true);
