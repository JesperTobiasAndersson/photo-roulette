create extension if not exists pgcrypto;

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

drop policy if exists "chicago rooms open access" on public.chicago_rooms;
create policy "chicago rooms open access"
on public.chicago_rooms
for all
using (true)
with check (true);

drop policy if exists "chicago room players open access" on public.chicago_room_players;
create policy "chicago room players open access"
on public.chicago_room_players
for all
using (true)
with check (true);

drop policy if exists "chicago rounds open access" on public.chicago_rounds;
create policy "chicago rounds open access"
on public.chicago_rounds
for all
using (true)
with check (true);

drop policy if exists "chicago hands open access" on public.chicago_player_hands;
create policy "chicago hands open access"
on public.chicago_player_hands
for all
using (true)
with check (true);

drop policy if exists "chicago draw actions open access" on public.chicago_draw_actions;
create policy "chicago draw actions open access"
on public.chicago_draw_actions
for all
using (true)
with check (true);

drop policy if exists "chicago tricks open access" on public.chicago_tricks;
create policy "chicago tricks open access"
on public.chicago_tricks
for all
using (true)
with check (true);

drop policy if exists "chicago cards played open access" on public.chicago_cards_played;
create policy "chicago cards played open access"
on public.chicago_cards_played
for all
using (true)
with check (true);
