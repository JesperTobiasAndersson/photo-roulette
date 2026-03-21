create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create table if not exists public.music_quiz_rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  state text not null default 'lobby' check (state in ('lobby', 'question', 'reveal')),
  host_player_id uuid null,
  current_round_id uuid null,
  phase_number integer not null default 0,
  public_message text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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
  category text not null check (category in ('hits', 'classics')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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

insert into public.music_quiz_library (spotify_url, category)
values
  ('https://open.spotify.com/track/07TGjTgMGUDW5qrsMrOnYA', 'hits'),
  ('https://open.spotify.com/track/32OlwWuMpZ6b0aN2RZOeMS', 'hits'),
  ('https://open.spotify.com/track/49JfoBc3DUw2EwDIo6YQmR', 'hits'),
  ('https://open.spotify.com/track/3Hwl0OPFb6d66RFoV3cMzP', 'hits'),
  ('https://open.spotify.com/track/4TJk6iQu8B8DCRLV7TwzaM', 'classics'),
  ('https://open.spotify.com/track/1TfqLAPs4K3s2rJMoCokcS', 'classics'),
  ('https://open.spotify.com/track/1XsfDGslxnCPm5RDlD874U', 'classics'),
  ('https://open.spotify.com/track/2ACLo9BX4IHonF4vDy6GoH', 'classics')
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
