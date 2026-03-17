create extension if not exists pgcrypto;

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

drop policy if exists "imposter rooms open access" on public.imposter_rooms;
create policy "imposter rooms open access"
on public.imposter_rooms
for all
using (true)
with check (true);

drop policy if exists "imposter room players open access" on public.imposter_room_players;
create policy "imposter room players open access"
on public.imposter_room_players
for all
using (true)
with check (true);

drop policy if exists "imposter roles open access" on public.imposter_player_roles;
create policy "imposter roles open access"
on public.imposter_player_roles
for all
using (true)
with check (true);

drop policy if exists "imposter votes open access" on public.imposter_votes;
create policy "imposter votes open access"
on public.imposter_votes
for all
using (true)
with check (true);
