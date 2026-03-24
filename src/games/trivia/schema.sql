create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

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
