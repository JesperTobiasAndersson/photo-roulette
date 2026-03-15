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

create table if not exists public.mafia_rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  host_player_id uuid null,
  phase text not null default 'lobby' check (phase in ('lobby', 'night', 'day', 'finished')),
  day_number integer not null default 0,
  winner text null check (winner in ('mafia', 'town')),
  night_result text null,
  last_eliminated_player_id uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.mafia_players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.mafia_rooms(id) on delete cascade,
  name text not null,
  role text null check (role in ('mafia', 'detective', 'doctor', 'villager')),
  is_alive boolean not null default true,
  private_message text null,
  joined_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'mafia_rooms_host_player_id_fkey'
  ) then
    alter table public.mafia_rooms
      add constraint mafia_rooms_host_player_id_fkey
      foreign key (host_player_id) references public.mafia_players(id) on delete set null;
  end if;
end
$$;

create table if not exists public.mafia_actions (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.mafia_rooms(id) on delete cascade,
  day_number integer not null,
  phase text not null check (phase in ('night', 'day')),
  action_type text not null check (action_type in ('mafia_target', 'doctor_save', 'detective_check', 'day_vote')),
  actor_player_id uuid not null references public.mafia_players(id) on delete cascade,
  target_player_id uuid not null references public.mafia_players(id) on delete cascade,
  created_at timestamptz not null default now()
);

create unique index if not exists mafia_actions_actor_once_per_phase_idx
  on public.mafia_actions(room_id, day_number, phase, actor_player_id, action_type);

create index if not exists mafia_players_room_id_idx on public.mafia_players(room_id);
create index if not exists mafia_actions_room_day_phase_idx on public.mafia_actions(room_id, day_number, phase);

drop trigger if exists mafia_rooms_set_updated_at on public.mafia_rooms;
create trigger mafia_rooms_set_updated_at
before update on public.mafia_rooms
for each row
execute function public.set_updated_at();

alter table public.mafia_rooms enable row level security;
alter table public.mafia_players enable row level security;
alter table public.mafia_actions enable row level security;

drop policy if exists "public mafia rooms access" on public.mafia_rooms;
create policy "public mafia rooms access"
on public.mafia_rooms
for all
using (true)
with check (true);

drop policy if exists "public mafia players access" on public.mafia_players;
create policy "public mafia players access"
on public.mafia_players
for all
using (true)
with check (true);

drop policy if exists "public mafia actions access" on public.mafia_actions;
create policy "public mafia actions access"
on public.mafia_actions
for all
using (true)
with check (true);
