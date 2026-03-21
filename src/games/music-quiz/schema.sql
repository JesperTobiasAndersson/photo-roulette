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
