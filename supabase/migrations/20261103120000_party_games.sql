-- "Most Likely" and "Closest Wins": round-based party games sharing one set of tables.
-- Every change goes through the functions below (phones only read): the server picks the
-- prompts, keeps each answer private until the round is revealed, and does the scoring.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table if not exists public.party_rooms (
  id uuid primary key default gen_random_uuid(),
  game text not null check (game in ('most_likely', 'estimate')),
  code text not null unique,
  state text not null default 'lobby' check (state in ('lobby', 'question', 'reveal', 'ended')),
  host_player_id uuid null,
  total_rounds integer not null default 10,
  current_round integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.party_players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.party_rooms(id) on delete cascade,
  auth_user_id uuid not null,
  display_name text not null,
  seat_order integer not null,
  score integer not null default 0,
  -- Most Likely: rounds in which this player got the most votes.
  titles integer not null default 0,
  -- Last round this player answered (public, so phones can show "3/5 answered").
  answered_round integer not null default 0,
  joined_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (room_id, auth_user_id)
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'party_rooms_host_player_id_fkey') then
    alter table public.party_rooms
      add constraint party_rooms_host_player_id_fkey foreign key (host_player_id) references public.party_players(id) on delete set null;
  end if;
end
$$;

-- The prompt bank (same lists as src/games/most-likely/data.ts and src/games/estimate/data.ts).
create table if not exists public.party_prompts (
  id text primary key,
  game text not null check (game in ('most_likely', 'estimate')),
  text_sv text not null,
  text_en text not null,
  answer numeric null,
  unit_sv text not null default '',
  unit_en text not null default ''
);

create table if not exists public.party_rounds (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.party_rooms(id) on delete cascade,
  round_number integer not null,
  prompt_id text not null,
  text_sv text not null,
  text_en text not null,
  unit_sv text not null default '',
  unit_en text not null default '',
  -- Closest Wins: filled in when the round is revealed.
  answer numeric null,
  revealed boolean not null default false,
  created_at timestamptz not null default now(),
  unique (room_id, round_number)
);

create table if not exists public.party_answers (
  round_id uuid not null references public.party_rounds(id) on delete cascade,
  player_id uuid not null references public.party_players(id) on delete cascade,
  target_player_id uuid null references public.party_players(id) on delete cascade,
  number_value numeric null,
  points integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (round_id, player_id)
);

create index if not exists party_players_room_idx on public.party_players(room_id);
create index if not exists party_rounds_room_idx on public.party_rounds(room_id, round_number);

drop trigger if exists party_rooms_updated_at on public.party_rooms;
create trigger party_rooms_updated_at before update on public.party_rooms for each row execute function public.set_updated_at();
drop trigger if exists party_players_updated_at on public.party_players;
create trigger party_players_updated_at before update on public.party_players for each row execute function public.set_updated_at();
drop trigger if exists party_rooms_unique_code on public.party_rooms;
create trigger party_rooms_unique_code before insert on public.party_rooms for each row execute function public.picklo_unique_room_code();

-- ---------------------------------------------------------------------------
-- Read access: members read the room; answers stay private until the round is revealed
-- ---------------------------------------------------------------------------
create or replace function public.party_is_member(p_room uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.party_players where room_id = p_room and auth_user_id = auth.uid());
$$;

create or replace function public.party_my_player(p_room uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select id from public.party_players where room_id = p_room and auth_user_id = auth.uid();
$$;

create or replace function public.party_round_room(p_round uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select room_id from public.party_rounds where id = p_round;
$$;

create or replace function public.party_round_revealed(p_round uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select revealed from public.party_rounds where id = p_round), false);
$$;

alter table public.party_rooms enable row level security;
alter table public.party_players enable row level security;
alter table public.party_prompts enable row level security;
alter table public.party_rounds enable row level security;
alter table public.party_answers enable row level security;

drop policy if exists "members read room" on public.party_rooms;
create policy "members read room" on public.party_rooms for select to authenticated using (public.party_is_member(id));
drop policy if exists "members read players" on public.party_players;
create policy "members read players" on public.party_players for select to authenticated using (public.party_is_member(room_id));
drop policy if exists "members read rounds" on public.party_rounds;
create policy "members read rounds" on public.party_rounds for select to authenticated using (public.party_is_member(room_id));
drop policy if exists "own answer or revealed" on public.party_answers;
create policy "own answer or revealed" on public.party_answers for select to authenticated
  using (
    public.party_is_member(public.party_round_room(round_id))
    and (player_id = public.party_my_player(public.party_round_room(round_id)) or public.party_round_revealed(round_id))
  );

do $$
declare
  t text;
begin
  foreach t in array array['party_rooms', 'party_players', 'party_rounds', 'party_answers'] loop
    if not exists (
      select 1 from pg_publication_rel pr
      join pg_publication p on p.oid = pr.prpubid
      join pg_class c on c.oid = pr.prrelid
      where p.pubname = 'supabase_realtime' and c.relname = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end
$$;

-- ---------------------------------------------------------------------------
-- Rooms and players
-- ---------------------------------------------------------------------------
create or replace function public.party_create_room(p_game text, p_name text)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_name text := left(trim(coalesce(p_name, '')), 40);
  v_room public.party_rooms%rowtype;
  v_player uuid;
begin
  if v_uid is null then raise exception 'NOT_SIGNED_IN' using errcode = '28000'; end if;
  if v_name = '' then raise exception 'NAME_REQUIRED' using errcode = '22023'; end if;
  if p_game not in ('most_likely', 'estimate') then raise exception 'UNKNOWN_GAME' using errcode = '22023'; end if;

  insert into public.party_rooms (game, code)
  values (p_game, (select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + floor(random() * 32)::int, 1), '') from generate_series(1, 4)))
  returning * into v_room;
  insert into public.party_players (room_id, auth_user_id, display_name, seat_order)
  values (v_room.id, v_uid, v_name, 1) returning id into v_player;
  update public.party_rooms set host_player_id = v_player where id = v_room.id;
  return jsonb_build_object('room_id', v_room.id, 'player_id', v_player, 'code', v_room.code);
end;
$$;

create or replace function public.party_join_room(p_game text, p_code text, p_name text)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_code text := upper(trim(coalesce(p_code, '')));
  v_name text := left(trim(coalesce(p_name, '')), 40);
  v_room public.party_rooms%rowtype;
  v_player uuid;
  v_count integer;
  v_seat integer;
begin
  if v_uid is null then raise exception 'NOT_SIGNED_IN' using errcode = '28000'; end if;
  if v_name = '' then raise exception 'NAME_REQUIRED' using errcode = '22023'; end if;
  select * into v_room from public.party_rooms where code = v_code and game = p_game for update;
  if not found then raise exception 'ROOM_NOT_FOUND' using errcode = 'P0002'; end if;

  -- A phone that is already in the room gets its seat back.
  select id into v_player from public.party_players where room_id = v_room.id and auth_user_id = v_uid;
  if v_player is null then
    if v_room.state <> 'lobby' then raise exception 'GAME_ALREADY_STARTED' using errcode = 'P0001'; end if;
    select count(*), coalesce(max(seat_order), 0) + 1 into v_count, v_seat from public.party_players where room_id = v_room.id;
    if v_count >= 20 then raise exception 'ROOM_FULL' using errcode = 'P0001'; end if;
    insert into public.party_players (room_id, auth_user_id, display_name, seat_order)
    values (v_room.id, v_uid, v_name, v_seat) returning id into v_player;
  end if;
  return jsonb_build_object('room_id', v_room.id, 'player_id', v_player, 'code', v_room.code);
end;
$$;

create or replace function public.party_require_host(p_room uuid) returns public.party_rooms
language plpgsql security definer set search_path = '' as $$
declare
  v_room public.party_rooms%rowtype;
begin
  select * into v_room from public.party_rooms where id = p_room for update;
  if not found then raise exception 'ROOM_NOT_FOUND' using errcode = 'P0002'; end if;
  if not exists (select 1 from public.party_players where id = v_room.host_player_id and auth_user_id = auth.uid()) then
    raise exception 'Only the host can do that' using errcode = '42501';
  end if;
  return v_room;
end;
$$;

-- ---------------------------------------------------------------------------
-- Game flow
-- ---------------------------------------------------------------------------
create or replace function public.party_start(p_room uuid, p_rounds integer)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_room public.party_rooms%rowtype := public.party_require_host(p_room);
  v_rounds integer := greatest(3, least(coalesce(p_rounds, 10), 30));
  v_min integer := case when v_room.game = 'most_likely' then 3 else 2 end;
begin
  if v_room.state <> 'lobby' then raise exception 'The game has already started' using errcode = 'P0001'; end if;
  if (select count(*) from public.party_players where room_id = p_room) < v_min then
    raise exception 'At least % players are required', v_min using errcode = 'P0001';
  end if;

  delete from public.party_rounds where room_id = p_room;
  insert into public.party_rounds (room_id, round_number, prompt_id, text_sv, text_en, unit_sv, unit_en)
  select p_room, row_number() over (), id, text_sv, text_en, unit_sv, unit_en
    from (select * from public.party_prompts where game = v_room.game order by random() limit v_rounds) picked;
  update public.party_players set score = 0, titles = 0, answered_round = 0 where room_id = p_room;
  update public.party_rooms
     set state = 'question', current_round = 1, total_rounds = (select count(*) from public.party_rounds where room_id = p_room)
   where id = p_room;
end;
$$;

create or replace function public.party_do_reveal(p_room uuid)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_room public.party_rooms%rowtype;
  v_round public.party_rounds%rowtype;
  v_answer numeric;
  v_top integer;
begin
  select * into v_room from public.party_rooms where id = p_room;
  select * into v_round from public.party_rounds where room_id = p_room and round_number = v_room.current_round for update;
  if v_round.id is null or v_round.revealed then return; end if;

  if v_room.game = 'most_likely' then
    -- Whoever got the most votes earns the "title"; everyone who voted for them scores a point.
    select max(n) into v_top from (
      select count(*)::int n from public.party_answers where round_id = v_round.id and target_player_id is not null group by target_player_id
    ) t;
    if v_top is not null then
      with top as (
        select target_player_id from public.party_answers where round_id = v_round.id and target_player_id is not null
         group by target_player_id having count(*) = v_top
      )
      update public.party_answers a set points = 1 where a.round_id = v_round.id and a.target_player_id in (select target_player_id from top);
      update public.party_players p set titles = titles + 1
       where p.room_id = p_room and p.id in (
         select target_player_id from public.party_answers where round_id = v_round.id and target_player_id is not null
          group by target_player_id having count(*) = v_top);
    end if;
  else
    -- Closest guesses: 3, 2 and 1 points for the three closest distances (ties share).
    select answer into v_answer from public.party_prompts where id = v_round.prompt_id;
    with ranked as (
      select player_id, dense_rank() over (order by abs(number_value - v_answer)) r
        from public.party_answers where round_id = v_round.id and number_value is not null
    )
    update public.party_answers a set points = greatest(0, 4 - ranked.r)
      from ranked where a.round_id = v_round.id and a.player_id = ranked.player_id;
    update public.party_rounds set answer = v_answer where id = v_round.id;
  end if;

  update public.party_players p set score = score + a.points
    from public.party_answers a where a.round_id = v_round.id and a.player_id = p.id and a.points > 0;
  update public.party_rounds set revealed = true where id = v_round.id;
  update public.party_rooms set state = 'reveal' where id = p_room;
end;
$$;
revoke execute on function public.party_do_reveal(uuid) from public, anon, authenticated;

create or replace function public.party_answer(p_room uuid, p_target uuid, p_number numeric)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_room public.party_rooms%rowtype;
  v_me uuid := public.party_my_player(p_room);
  v_round uuid;
begin
  select * into v_room from public.party_rooms where id = p_room for update;
  if v_me is null or v_room.id is null then raise exception 'NOT_A_MEMBER' using errcode = '42501'; end if;
  if v_room.state <> 'question' then raise exception 'Answers are closed' using errcode = 'P0001'; end if;
  if v_room.game = 'most_likely' and not exists (select 1 from public.party_players where id = p_target and room_id = p_room) then
    raise exception 'Pick a player' using errcode = 'P0001';
  end if;
  if v_room.game = 'estimate' and (p_number is null or abs(p_number) > 1e15) then
    raise exception 'Enter a number' using errcode = 'P0001';
  end if;

  select id into v_round from public.party_rounds where room_id = p_room and round_number = v_room.current_round;
  insert into public.party_answers (round_id, player_id, target_player_id, number_value)
  values (v_round, v_me,
          case when v_room.game = 'most_likely' then p_target end,
          case when v_room.game = 'estimate' then p_number end)
  on conflict (round_id, player_id) do update
    set target_player_id = excluded.target_player_id, number_value = excluded.number_value, updated_at = now();
  update public.party_players set answered_round = v_room.current_round where id = v_me;

  -- Everyone has answered: show the result straight away.
  if not exists (select 1 from public.party_players where room_id = p_room and answered_round < v_room.current_round) then
    perform public.party_do_reveal(p_room);
  end if;
end;
$$;

-- The host can show the result without waiting for everyone.
create or replace function public.party_reveal(p_room uuid)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_room public.party_rooms%rowtype := public.party_require_host(p_room);
begin
  if v_room.state <> 'question' then return; end if;
  perform public.party_do_reveal(p_room);
end;
$$;

create or replace function public.party_next(p_room uuid)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_room public.party_rooms%rowtype := public.party_require_host(p_room);
begin
  if v_room.state <> 'reveal' then return; end if;
  if v_room.current_round >= v_room.total_rounds then
    update public.party_rooms set state = 'ended' where id = p_room;
  else
    update public.party_rooms set state = 'question', current_round = current_round + 1 where id = p_room;
  end if;
end;
$$;

create or replace function public.party_reset(p_room uuid)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_room public.party_rooms%rowtype := public.party_require_host(p_room);
begin
  delete from public.party_rounds where room_id = p_room;
  update public.party_players set score = 0, titles = 0, answered_round = 0 where room_id = p_room;
  update public.party_rooms set state = 'lobby', current_round = 0 where id = v_room.id;
end;
$$;

-- A player leaves the room (the host role passes to the next player).
create or replace function public.party_leave(p_room uuid)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := public.party_my_player(p_room);
begin
  if v_me is null then return; end if;
  delete from public.party_players where id = v_me;
  update public.party_rooms
     set host_player_id = (select id from public.party_players where room_id = p_room order by seat_order limit 1)
   where id = p_room and host_player_id is null;
  -- A player leaving may be the last one the round was waiting for.
  if exists (select 1 from public.party_rooms where id = p_room and state = 'question')
     and not exists (select 1 from public.party_players p join public.party_rooms r on r.id = p.room_id
                      where p.room_id = p_room and p.answered_round < r.current_round) then
    perform public.party_do_reveal(p_room);
  end if;
end;
$$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'party_create_room(text, text)', 'party_join_room(text, text, text)', 'party_start(uuid, integer)',
    'party_answer(uuid, uuid, numeric)', 'party_reveal(uuid)', 'party_next(uuid)', 'party_reset(uuid)', 'party_leave(uuid)'
  ] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end
$$;
revoke execute on function public.party_require_host(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Housekeeping: party rooms expire like the other games
-- ---------------------------------------------------------------------------
create or replace function public.picklo_cleanup(p_max_age interval default interval '24 hours')
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_result jsonb := '{}'::jsonb;
  v_count integer;
  t text;
begin
  foreach t in array array['rooms', 'mafia_rooms', 'imposter_rooms', 'chicago_rooms', 'music_quiz_rooms', 'trivia_rooms', 'party_rooms'] loop
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
revoke execute on function public.picklo_cleanup(interval) from public, anon, authenticated;
grant execute on function public.picklo_cleanup(interval) to service_role;

-- ---------------------------------------------------------------------------
-- Prompt bank
-- ---------------------------------------------------------------------------
insert into public.party_prompts (id, game, text_sv, text_en, answer, unit_sv, unit_en) values
  ('ml-001', 'most_likely', 'glömma sin egen födelsedag', 'forget their own birthday', null, '', ''),
  ('ml-002', 'most_likely', 'somna på en fest', 'fall asleep at a party', null, '', ''),
  ('ml-003', 'most_likely', 'bli känd', 'become famous', null, '', ''),
  ('ml-004', 'most_likely', 'flytta utomlands', 'move abroad', null, '', ''),
  ('ml-005', 'most_likely', 'överleva en zombieapokalyps', 'survive a zombie apocalypse', null, '', ''),
  ('ml-006', 'most_likely', 'komma försent till sitt eget bröllop', 'be late to their own wedding', null, '', ''),
  ('ml-007', 'most_likely', 'äta upp någon annans matlåda av misstag', 'eat someone else''s lunch by mistake', null, '', ''),
  ('ml-008', 'most_likely', 'skratta på fel ställe i en film', 'laugh at the wrong moment in a film', null, '', ''),
  ('ml-009', 'most_likely', 'gå vilse i sin egen stad', 'get lost in their own town', null, '', ''),
  ('ml-010', 'most_likely', 'ta hundra selfies på en dag', 'take a hundred selfies in one day', null, '', ''),
  ('ml-011', 'most_likely', 'vinna på lotto och tappa bort lotten', 'win the lottery and lose the ticket', null, '', ''),
  ('ml-012', 'most_likely', 'starta ett eget företag', 'start their own company', null, '', ''),
  ('ml-013', 'most_likely', 'bli statsminister', 'become prime minister', null, '', ''),
  ('ml-014', 'most_likely', 'adoptera fem katter', 'adopt five cats', null, '', ''),
  ('ml-015', 'most_likely', 'prata med sina växter', 'talk to their plants', null, '', ''),
  ('ml-016', 'most_likely', 'gråta till en reklamfilm', 'cry at an advert', null, '', ''),
  ('ml-017', 'most_likely', 'glömma att stänga av ljudet på mobilen på bio', 'forget to silence their phone at the cinema', null, '', ''),
  ('ml-018', 'most_likely', 'äta pizza till frukost', 'eat pizza for breakfast', null, '', ''),
  ('ml-019', 'most_likely', 'sjunga i duschen så att grannarna hör', 'sing in the shower loud enough for the neighbours to hear', null, '', ''),
  ('ml-020', 'most_likely', 'boka en resa utan att berätta för någon', 'book a trip without telling anyone', null, '', ''),
  ('ml-021', 'most_likely', 'glömma passet hemma', 'forget their passport at home', null, '', ''),
  ('ml-022', 'most_likely', 'bli kompis med alla på ett flyg', 'make friends with everyone on a plane', null, '', ''),
  ('ml-023', 'most_likely', 'ha hundra flikar öppna i webbläsaren', 'have a hundred tabs open in their browser', null, '', ''),
  ('ml-024', 'most_likely', 'skicka ett meddelande till fel person', 'send a message to the wrong person', null, '', ''),
  ('ml-025', 'most_likely', 'läsa ett meddelande och glömma att svara', 'read a message and forget to reply', null, '', ''),
  ('ml-026', 'most_likely', 'ha mobilen på en procent batteri', 'have their phone on one percent battery', null, '', ''),
  ('ml-027', 'most_likely', 'bli influencer', 'become an influencer', null, '', ''),
  ('ml-028', 'most_likely', 'vara med i en dokusåpa', 'be on a reality show', null, '', ''),
  ('ml-029', 'most_likely', 'vinna ett tävlingsprogram på tv', 'win a game show on TV', null, '', ''),
  ('ml-030', 'most_likely', 'klara sig en vecka ensam i skogen', 'survive a week alone in the woods', null, '', ''),
  ('ml-031', 'most_likely', 'plocka svamp i flera timmar', 'spend hours picking mushrooms', null, '', ''),
  ('ml-032', 'most_likely', 'utnyttja allemansrätten till max', 'make the most of the right to roam', null, '', ''),
  ('ml-033', 'most_likely', 'dansa små grodorna med full inlevelse på midsommar', 'throw themselves into the frog dance at midsummer', null, '', ''),
  ('ml-034', 'most_likely', 'baka sju sorters kakor', 'bake seven kinds of cookies', null, '', ''),
  ('ml-035', 'most_likely', 'fika tre gånger om dagen', 'have fika three times a day', null, '', ''),
  ('ml-036', 'most_likely', 'ta den sista kanelbullen', 'take the last cinnamon bun', null, '', ''),
  ('ml-037', 'most_likely', 'bada i havet i november', 'swim in the sea in November', null, '', ''),
  ('ml-038', 'most_likely', 'tappa bort nycklarna varje vecka', 'lose their keys every week', null, '', ''),
  ('ml-039', 'most_likely', 'somna framför tv:n', 'fall asleep in front of the TV', null, '', ''),
  ('ml-040', 'most_likely', 'vakna före sex frivilligt', 'wake up before six on purpose', null, '', ''),
  ('ml-041', 'most_likely', 'trycka på snooze tio gånger', 'hit snooze ten times', null, '', ''),
  ('ml-042', 'most_likely', 'plugga in allt kvällen före provet', 'cram everything the night before a test', null, '', ''),
  ('ml-043', 'most_likely', 'bli lärare', 'become a teacher', null, '', ''),
  ('ml-044', 'most_likely', 'glömma vad de skulle säga mitt i en mening', 'forget what they were saying mid-sentence', null, '', ''),
  ('ml-045', 'most_likely', 'ha en låt på hjärnan hela dagen', 'have a song stuck in their head all day', null, '', ''),
  ('ml-046', 'most_likely', 'kunna texten till varje låt på radion', 'know the lyrics to every song on the radio', null, '', ''),
  ('ml-047', 'most_likely', 'starta en podd', 'start a podcast', null, '', ''),
  ('ml-048', 'most_likely', 'skriva en bok', 'write a book', null, '', ''),
  ('ml-049', 'most_likely', 'bli en känd kock', 'become a famous chef', null, '', ''),
  ('ml-050', 'most_likely', 'äta den konstigaste maten på semestern', 'eat the weirdest food on holiday', null, '', ''),
  ('ml-051', 'most_likely', 'packa för mycket inför en helgresa', 'overpack for a weekend trip', null, '', ''),
  ('ml-052', 'most_likely', 'missa flyget', 'miss their flight', null, '', ''),
  ('ml-053', 'most_likely', 'somna på bussen och åka förbi sin hållplats', 'fall asleep on the bus and miss their stop', null, '', ''),
  ('ml-054', 'most_likely', 'prata med djur som om de vore människor', 'talk to animals as if they were people', null, '', ''),
  ('ml-055', 'most_likely', 'rädda en spindel i stället för att döda den', 'rescue a spider instead of squashing it', null, '', ''),
  ('ml-056', 'most_likely', 'titta på en skräckfilm bakom en kudde', 'watch a horror film from behind a pillow', null, '', ''),
  ('ml-057', 'most_likely', 'ha en hemlig talang', 'have a secret talent', null, '', ''),
  ('ml-058', 'most_likely', 'lära sig ett nytt språk på ett år', 'learn a new language in a year', null, '', ''),
  ('ml-059', 'most_likely', 'resa jorden runt', 'travel around the world', null, '', ''),
  ('ml-060', 'most_likely', 'bo i en husbil', 'live in a camper van', null, '', ''),
  ('ml-061', 'most_likely', 'köpa en egen ö', 'buy their own island', null, '', ''),
  ('ml-062', 'most_likely', 'bli astronaut', 'become an astronaut', null, '', ''),
  ('ml-063', 'most_likely', 'hitta en gömd skatt', 'find hidden treasure', null, '', ''),
  ('ml-064', 'most_likely', 'bli kompis med en kändis', 'become friends with a celebrity', null, '', ''),
  ('ml-065', 'most_likely', 'sätta upp en arg lapp i tvättstugan', 'put up an angry note in the shared laundry room', null, '', ''),
  ('ml-066', 'most_likely', 'äta glass mitt i vintern', 'eat ice cream in the middle of winter', null, '', ''),
  ('ml-067', 'most_likely', 'ha flest olästa mejl', 'have the most unread emails', null, '', ''),
  ('ml-068', 'most_likely', 'glömma sitt paraply överallt', 'leave their umbrella everywhere', null, '', ''),
  ('ml-069', 'most_likely', 'ringa i stället för att sms:a', 'call instead of texting', null, '', ''),
  ('ml-070', 'most_likely', 'vinna en dansbattle', 'win a dance battle', null, '', ''),
  ('ml-071', 'most_likely', 'laga en trerättersmiddag till alla', 'cook a three-course dinner for everyone', null, '', ''),
  ('ml-072', 'most_likely', 'bränna vid pastan', 'burn the pasta', null, '', ''),
  ('ml-073', 'most_likely', 'ha en perfekt sorterad garderob', 'have a perfectly organised wardrobe', null, '', ''),
  ('ml-074', 'most_likely', 'samla på konstiga saker', 'collect weird things', null, '', ''),
  ('ml-075', 'most_likely', 'vinna en frågesport', 'win a quiz night', null, '', ''),
  ('ml-076', 'most_likely', 'fuska i Monopol', 'cheat at Monopoly', null, '', ''),
  ('ml-077', 'most_likely', 'bli sur när de förlorar i ett sällskapsspel', 'sulk after losing a board game', null, '', ''),
  ('ml-078', 'most_likely', 'läsa bruksanvisningen först när något har gått sönder', 'read the manual only after something breaks', null, '', ''),
  ('ml-079', 'most_likely', 'bygga ihop en IKEA-möbel utan instruktionen', 'assemble IKEA furniture without the instructions', null, '', ''),
  ('ml-080', 'most_likely', 'ringa fel nummer och prata ändå', 'call the wrong number and chat anyway', null, '', ''),
  ('ml-081', 'most_likely', 'gå viralt med ett klipp', 'go viral with a video', null, '', ''),
  ('ml-082', 'most_likely', 'fota maten innan de äter', 'take a photo of their food before eating', null, '', ''),
  ('ml-083', 'most_likely', 'få flest följare', 'get the most followers', null, '', ''),
  ('ml-084', 'most_likely', 'spendera flest timmar på mobilen', 'spend the most hours on their phone', null, '', ''),
  ('ml-085', 'most_likely', 'glömma laddaren hemma', 'forget their charger at home', null, '', ''),
  ('ml-086', 'most_likely', 'gå runt med en sprucken mobilskärm', 'walk around with a cracked phone screen', null, '', ''),
  ('ml-087', 'most_likely', 'jobba på semestern', 'work while on holiday', null, '', ''),
  ('ml-088', 'most_likely', 'vara först på plats överallt', 'be the first to arrive everywhere', null, '', ''),
  ('ml-089', 'most_likely', 'komma försent till allt', 'be late for everything', null, '', ''),
  ('ml-090', 'most_likely', 'planera semestern ett år i förväg', 'plan their holiday a year in advance', null, '', ''),
  ('ml-091', 'most_likely', 'göra något spontant mitt i natten', 'do something spontaneous in the middle of the night', null, '', ''),
  ('ml-092', 'most_likely', 'springa ett maraton', 'run a marathon', null, '', ''),
  ('ml-093', 'most_likely', 'bli proffs inom en sport', 'become a professional athlete', null, '', ''),
  ('ml-094', 'most_likely', 'vandra i fjällen i flera veckor', 'hike in the mountains for weeks', null, '', ''),
  ('ml-095', 'most_likely', 'sova i tält mitt i vintern', 'sleep in a tent in the middle of winter', null, '', ''),
  ('ml-096', 'most_likely', 'skrika när de ser en spindel', 'scream at the sight of a spider', null, '', ''),
  ('ml-097', 'most_likely', 'tappa mobilen i toaletten', 'drop their phone in the toilet', null, '', ''),
  ('ml-098', 'most_likely', 'köpa något onödigt på rea', 'buy something useless in a sale', null, '', ''),
  ('ml-099', 'most_likely', 'handla hungrig och köpa alldeles för mycket', 'go food shopping hungry and buy way too much', null, '', ''),
  ('ml-100', 'most_likely', 'ha tusen bilder på sitt husdjur', 'have a thousand photos of their pet', null, '', ''),
  ('ml-101', 'most_likely', 'ha den bästa utklädnaden på en maskerad', 'have the best costume at a fancy dress party', null, '', ''),
  ('ml-102', 'most_likely', 'hålla ett tal som får alla att gråta', 'give a speech that makes everyone cry', null, '', ''),
  ('ml-103', 'most_likely', 'skratta så mycket att läsken kommer ut genom näsan', 'laugh so hard that soda comes out of their nose', null, '', ''),
  ('ml-104', 'most_likely', 'snubbla på helt platt mark', 'trip over absolutely nothing', null, '', ''),
  ('ml-105', 'most_likely', 'gå rakt in i en glasdörr', 'walk straight into a glass door', null, '', ''),
  ('ml-106', 'most_likely', 'vinka tillbaka till någon som vinkade åt någon annan', 'wave back at someone who was waving at someone else', null, '', ''),
  ('ml-107', 'most_likely', 'säga ''tack detsamma'' när servitören säger ''smaklig måltid''', 'say ''you too'' when the waiter says ''enjoy your meal''', null, '', ''),
  ('ml-108', 'most_likely', 'dra i en dörr där det står tryck', 'pull a door that says push', null, '', ''),
  ('ml-109', 'most_likely', 'vinna diskussioner i duschen långt efteråt', 'win arguments in the shower hours later', null, '', ''),
  ('ml-110', 'most_likely', 'äta frukost till middag', 'eat breakfast for dinner', null, '', ''),
  ('ml-111', 'most_likely', 'ha ett hemligt godisgömställe', 'have a secret stash of sweets', null, '', ''),
  ('ml-112', 'most_likely', 'äta lördagsgodis på en tisdag', 'eat Saturday sweets on a Tuesday', null, '', ''),
  ('ml-113', 'most_likely', 'bli vegetarian', 'go vegetarian', null, '', ''),
  ('ml-114', 'most_likely', 'äta surströmming frivilligt', 'eat fermented herring voluntarily', null, '', ''),
  ('ml-115', 'most_likely', 'dricka kaffe klockan nio på kvällen', 'drink coffee at nine in the evening', null, '', ''),
  ('ml-116', 'most_likely', 'prata i sömnen', 'talk in their sleep', null, '', ''),
  ('ml-117', 'most_likely', 'uppfinna något genialt', 'invent something brilliant', null, '', ''),
  ('ml-118', 'most_likely', 'bli miljonär', 'become a millionaire', null, '', ''),
  ('ml-119', 'most_likely', 'ge bort alla sina pengar', 'give all their money away', null, '', ''),
  ('ml-120', 'most_likely', 'spara varenda krona', 'save every single penny', null, '', ''),
  ('ml-121', 'most_likely', 'bli superhjälte', 'become a superhero', null, '', ''),
  ('ml-122', 'most_likely', 'bli bortförd av utomjordingar och vilja stanna', 'get abducted by aliens and want to stay', null, '', ''),
  ('ml-123', 'most_likely', 'bli kompis med en björn', 'make friends with a bear', null, '', ''),
  ('ml-124', 'most_likely', 'lyckas tämja en dinosaurie', 'manage to tame a dinosaur', null, '', ''),
  ('ml-125', 'most_likely', 'bli kung eller drottning', 'become king or queen', null, '', ''),
  ('ml-126', 'most_likely', 'resa i tiden och ställa till det', 'travel back in time and mess everything up', null, '', ''),
  ('ml-127', 'most_likely', 'vinna en Oscar', 'win an Oscar', null, '', ''),
  ('ml-128', 'most_likely', 'få en egen tv-serie', 'get their own TV series', null, '', ''),
  ('ml-129', 'most_likely', 'skriva en hitlåt', 'write a hit song', null, '', ''),
  ('ml-130', 'most_likely', 'spela luftgitarr på en fest', 'play air guitar at a party', null, '', ''),
  ('ml-131', 'most_likely', 'ta över musiken på en fest', 'take over the music at a party', null, '', ''),
  ('ml-132', 'most_likely', 'vara sist kvar på en fest', 'be the last one to leave a party', null, '', ''),
  ('ml-133', 'most_likely', 'gå från en fest utan att säga hejdå', 'leave a party without saying goodbye', null, '', ''),
  ('ml-134', 'most_likely', 'börja städa mitt under en fest', 'start tidying up in the middle of a party', null, '', ''),
  ('ml-135', 'most_likely', 'ha finast handstil', 'have the neatest handwriting', null, '', ''),
  ('ml-136', 'most_likely', 'klottra i hela anteckningsblocket', 'doodle all over their notebook', null, '', ''),
  ('ml-137', 'most_likely', 'alltid räcka upp handen först', 'always be the first to raise their hand', null, '', ''),
  ('ml-138', 'most_likely', 'glömma läxan på bussen', 'leave their homework on the bus', null, '', ''),
  ('ml-139', 'most_likely', 'hitta på den bästa ursäkten', 'come up with the best excuse', null, '', ''),
  ('ml-140', 'most_likely', 'bli chef', 'become the boss', null, '', ''),
  ('ml-141', 'most_likely', 'jobba hemifrån i pyjamas', 'work from home in their pyjamas', null, '', ''),
  ('ml-142', 'most_likely', 'skicka jobbmejl mitt i natten', 'send work emails in the middle of the night', null, '', ''),
  ('ml-143', 'most_likely', 'glömma att stänga av mikrofonen på ett videomöte', 'forget to mute themselves on a video call', null, '', ''),
  ('ml-144', 'most_likely', 'ha flest kaffekoppar på skrivbordet', 'have the most coffee cups on their desk', null, '', ''),
  ('ml-145', 'most_likely', 'ha flest växter hemma', 'have the most plants at home', null, '', ''),
  ('ml-146', 'most_likely', 'skaffa en hund på impuls', 'get a dog on a whim', null, '', ''),
  ('ml-147', 'most_likely', 'ge sitt husdjur ett människonamn', 'give their pet a human name', null, '', ''),
  ('ml-148', 'most_likely', 'klä ut sitt husdjur', 'dress up their pet', null, '', ''),
  ('ml-149', 'most_likely', 'bli veterinär', 'become a vet', null, '', ''),
  ('ml-150', 'most_likely', 'rädda någon i nöd', 'rescue someone in trouble', null, '', ''),
  ('ml-151', 'most_likely', 'tro på spöken', 'believe in ghosts', null, '', ''),
  ('ml-152', 'most_likely', 'se ett ufo', 'see a UFO', null, '', ''),
  ('ml-153', 'most_likely', 'bo i ett slott', 'live in a castle', null, '', ''),
  ('ml-154', 'most_likely', 'flytta ut på landet och skaffa höns', 'move to the countryside and keep chickens', null, '', ''),
  ('ml-155', 'most_likely', 'bygga sitt eget hus', 'build their own house', null, '', ''),
  ('ml-156', 'most_likely', 'måla om sitt rum varje år', 'repaint their room every year', null, '', ''),
  ('ml-157', 'most_likely', 'köpa en sommarstuga utan att ha sett den', 'buy a summer cottage without seeing it first', null, '', ''),
  ('ml-158', 'most_likely', 'vinna i kubb varje midsommar', 'win at kubb every midsummer', null, '', ''),
  ('ml-159', 'most_likely', 'plocka sju sorters blommor på midsommarafton', 'pick seven kinds of flowers on Midsummer''s Eve', null, '', ''),
  ('ml-160', 'most_likely', 'ha den största julgranen', 'have the biggest Christmas tree', null, '', ''),
  ('ml-161', 'most_likely', 'börja julpynta i oktober', 'start decorating for Christmas in October', null, '', ''),
  ('ml-162', 'most_likely', 'öppna julklapparna i smyg före jul', 'secretly open their presents before Christmas', null, '', ''),
  ('ml-163', 'most_likely', 'glömma någons namn direkt efter att ha hört det', 'forget someone''s name right after hearing it', null, '', ''),
  ('ml-164', 'most_likely', 'hälsa på en främling i tron att det är någon annan', 'greet a stranger thinking they''re someone else', null, '', ''),
  ('ml-165', 'most_likely', 'prata i telefon i flera timmar', 'talk on the phone for hours', null, '', ''),
  ('ml-166', 'most_likely', 'skicka röstmeddelanden som är fem minuter långa', 'send five-minute voice messages', null, '', ''),
  ('ml-167', 'most_likely', 'svara med bara emojis', 'reply with nothing but emojis', null, '', ''),
  ('ml-168', 'most_likely', 'ha en spellista för varje humör', 'have a playlist for every mood', null, '', ''),
  ('ml-169', 'most_likely', 'lära sig en hel dans från TikTok', 'learn a whole dance from TikTok', null, '', ''),
  ('ml-170', 'most_likely', 'spela tv-spel hela natten', 'play video games all night', null, '', ''),
  ('ml-171', 'most_likely', 'slå alla i schack', 'beat everyone at chess', null, '', ''),
  ('ml-172', 'most_likely', 'lösa en Rubiks kub', 'solve a Rubik''s cube', null, '', ''),
  ('ml-173', 'most_likely', 'lista ut slutet på en film först', 'be the first to guess how a film ends', null, '', ''),
  ('ml-174', 'most_likely', 'spoila slutet på en serie', 'spoil the ending of a series', null, '', ''),
  ('ml-175', 'most_likely', 'kolla på en hel säsong på en dag', 'binge-watch a whole season in one day', null, '', ''),
  ('ml-176', 'most_likely', 'se samma film hundra gånger', 'watch the same film a hundred times', null, '', ''),
  ('ml-177', 'most_likely', 'hoppa från det högsta tornet i simhallen', 'jump off the highest diving board', null, '', ''),
  ('ml-178', 'most_likely', 'åka bungyjump', 'go bungee jumping', null, '', ''),
  ('ml-179', 'most_likely', 'hoppa fallskärm', 'go skydiving', null, '', ''),
  ('ml-180', 'most_likely', 'klara sig bäst på en öde ö', 'survive the longest on a desert island', null, '', ''),
  ('est-001', 'estimate', 'Hur många ben har en vuxen människa i kroppen?', 'How many bones are there in an adult human body?', 206, 'ben', 'bones'),
  ('est-002', 'estimate', 'Hur många hjärtan har en bläckfisk (åttaarmad)?', 'How many hearts does an octopus have?', 3, 'hjärtan', 'hearts'),
  ('est-003', 'estimate', 'Hur många tänder har en vuxen människa, visdomständerna inräknade?', 'How many teeth does an adult human have, including wisdom teeth?', 32, 'tänder', 'teeth'),
  ('est-004', 'estimate', 'Hur många mjölktänder har ett barn?', 'How many baby teeth does a child have?', 20, 'tänder', 'teeth'),
  ('est-005', 'estimate', 'Hur många tänder har en vuxen hund?', 'How many teeth does an adult dog have?', 42, 'tänder', 'teeth'),
  ('est-006', 'estimate', 'Hur många tänder har en vuxen katt?', 'How many teeth does an adult cat have?', 30, 'tänder', 'teeth'),
  ('est-007', 'estimate', 'Hur många tår har en katt normalt sammanlagt på alla fyra tassarna?', 'How many toes does a cat normally have in total on all four paws?', 18, 'tår', 'toes'),
  ('est-008', 'estimate', 'Hur många halskotor har en giraff?', 'How many neck vertebrae does a giraffe have?', 7, 'halskotor', 'vertebrae'),
  ('est-009', 'estimate', 'Hur många kromosomer finns i en vanlig mänsklig kroppscell?', 'How many chromosomes are there in a normal human body cell?', 46, 'kromosomer', 'chromosomes'),
  ('est-010', 'estimate', 'Hur många magavdelningar har en ko?', 'How many stomach compartments does a cow have?', 4, 'avdelningar', 'compartments'),
  ('est-011', 'estimate', 'Hur många ögon har ett honungsbi totalt?', 'How many eyes does a honey bee have in total?', 5, 'ögon', 'eyes'),
  ('est-012', 'estimate', 'Hur många revben har en människa normalt?', 'How many ribs does a human normally have?', 24, 'revben', 'ribs'),
  ('est-013', 'estimate', 'Hur många ben finns i en mänsklig hand (inklusive handleden)?', 'How many bones are there in a human hand (including the wrist)?', 27, 'ben', 'bones'),
  ('est-014', 'estimate', 'Hur många ben finns i en mänsklig fot?', 'How many bones are there in a human foot?', 26, 'ben', 'bones'),
  ('est-015', 'estimate', 'Hur många veckor varar en normal graviditet hos människor, räknat från sista mens?', 'How many weeks does a normal human pregnancy last, counted from the last period?', 40, 'veckor', 'weeks'),
  ('est-016', 'estimate', 'Ungefär hur många månader är en afrikansk elefant dräktig?', 'Approximately how many months is an African elephant pregnant?', 22, 'månader', 'months'),
  ('est-017', 'estimate', 'Hur många armar har en kalmar, de två långa fångstarmarna inräknade?', 'How many arms does a squid have, counting its two long tentacles?', 10, 'armar', 'arms'),
  ('est-018', 'estimate', 'Ungefär hur många liter blod har en vuxen människa?', 'Approximately how many litres of blood does an adult human have?', 5, 'liter', 'litres'),
  ('est-019', 'estimate', 'Hur många ögon har de flesta spindlar?', 'How many eyes do most spiders have?', 8, 'ögon', 'eyes'),
  ('est-020', 'estimate', 'Hur många grader Celsius är en människas normala kroppstemperatur, avrundat till hela grader?', 'What is normal human body temperature in degrees Celsius, rounded to whole degrees?', 37, '°C', '°C'),
  ('est-021', 'estimate', 'Hur många län har Sverige?', 'How many counties (län) does Sweden have?', 21, 'län', 'counties'),
  ('est-022', 'estimate', 'Hur många kommuner har Sverige?', 'How many municipalities does Sweden have?', 290, 'kommuner', 'municipalities'),
  ('est-023', 'estimate', 'Hur många landskap har Sverige?', 'How many historical provinces (landskap) does Sweden have?', 25, 'landskap', 'provinces'),
  ('est-024', 'estimate', 'Hur många länder gränsar till Tyskland?', 'How many countries border Germany?', 9, 'länder', 'countries'),
  ('est-025', 'estimate', 'Hur många länder gränsar till Kina på land?', 'How many countries share a land border with China?', 14, 'länder', 'countries'),
  ('est-026', 'estimate', 'Hur många provinser har Kanada?', 'How many provinces does Canada have?', 10, 'provinser', 'provinces'),
  ('est-027', 'estimate', 'Hur många kantoner har Schweiz?', 'How many cantons does Switzerland have?', 26, 'kantoner', 'cantons'),
  ('est-028', 'estimate', 'Hur många förbundsländer har Tyskland?', 'How many federal states does Germany have?', 16, 'förbundsländer', 'states'),
  ('est-029', 'estimate', 'Hur många regioner är Italien indelat i?', 'How many regions is Italy divided into?', 20, 'regioner', 'regions'),
  ('est-030', 'estimate', 'Hur många autonoma regioner (comunidades autónomas) har Spanien?', 'How many autonomous communities does Spain have?', 17, 'regioner', 'communities'),
  ('est-031', 'estimate', 'Hur många amerikanska delstater gränsar till Kanada?', 'How many US states border Canada?', 13, 'delstater', 'states'),
  ('est-032', 'estimate', 'Hur många självständiga länder finns i Sydamerika?', 'How many independent countries are there in South America?', 12, 'länder', 'countries'),
  ('est-033', 'estimate', 'Hur många medlemsländer hade EU efter att Storbritannien lämnat 2020?', 'How many member states did the EU have after the United Kingdom left in 2020?', 27, 'länder', 'countries'),
  ('est-034', 'estimate', 'Ungefär hur många kilometer är jordens omkrets vid ekvatorn, avrundat till tusental?', 'Approximately how many kilometres is the Earth''s circumference at the equator, rounded to the nearest thousand?', 40000, 'km', 'km'),
  ('est-035', 'estimate', 'Ungefär hur många meter djup är Marianergraven på sitt djupaste ställe, avrundat till tusental?', 'Approximately how many metres deep is the Mariana Trench at its deepest point, rounded to the nearest thousand?', 11000, 'meter', 'metres'),
  ('est-036', 'estimate', 'Hur många delstater har Australien?', 'How many states does Australia have?', 6, 'delstater', 'states'),
  ('est-037', 'estimate', 'Hur många meter över havet är Norges högsta berg Galdhøpiggen?', 'How many metres above sea level is Norway''s highest mountain, Galdhøpiggen?', 2469, 'meter', 'metres'),
  ('est-038', 'estimate', 'Ungefär hur många kilometer lång är själva Öresundsbron, avrundat till hel kilometer?', 'Approximately how many kilometres long is the Øresund Bridge itself, rounded to whole kilometres?', 8, 'km', 'km'),
  ('est-039', 'estimate', 'Ungefär hur många procent av jordens yta är land?', 'Approximately what percentage of the Earth''s surface is land?', 29, 'procent', 'percent'),
  ('est-040', 'estimate', 'Hur många delstater har Brasilien (huvudstadsdistriktet ej inräknat)?', 'How many states does Brazil have (not counting the federal district)?', 26, 'delstater', 'states'),
  ('est-041', 'estimate', 'Vilket år sjönk regalskeppet Vasa?', 'In what year did the warship Vasa sink?', 1628, '', ''),
  ('est-042', 'estimate', 'Vilket år valdes Gustav Vasa till kung av Sverige?', 'In what year was Gustav Vasa elected King of Sweden?', 1523, '', ''),
  ('est-043', 'estimate', 'Vilket år landade människan för första gången på månen?', 'In what year did humans first land on the Moon?', 1969, '', ''),
  ('est-044', 'estimate', 'Vilket år föll Berlinmuren?', 'In what year did the Berlin Wall fall?', 1989, '', ''),
  ('est-045', 'estimate', 'Vilket år gick Sverige med i EU?', 'In what year did Sweden join the EU?', 1995, '', ''),
  ('est-046', 'estimate', 'Vilket år gick Sverige över till högertrafik?', 'In what year did Sweden switch to driving on the right?', 1967, '', ''),
  ('est-047', 'estimate', 'Vilket år fick kvinnor rösta i ett riksdagsval i Sverige för första gången?', 'In what year could women vote in a Swedish parliamentary election for the first time?', 1921, '', ''),
  ('est-048', 'estimate', 'Vilket år nådde Columbus Amerika för första gången?', 'In what year did Columbus first reach the Americas?', 1492, '', ''),
  ('est-049', 'estimate', 'Vilket år stormades Bastiljen i Paris?', 'In what year was the Bastille in Paris stormed?', 1789, '', ''),
  ('est-050', 'estimate', 'Vilket år delades Nobelpriset ut för första gången?', 'In what year was the Nobel Prize first awarded?', 1901, '', ''),
  ('est-051', 'estimate', 'Vilket år upplöstes unionen mellan Sverige och Norge?', 'In what year was the union between Sweden and Norway dissolved?', 1905, '', ''),
  ('est-052', 'estimate', 'Vilket år bildades Kalmarunionen?', 'In what year was the Kalmar Union formed?', 1397, '', ''),
  ('est-053', 'estimate', 'Vilket år infördes kronan som valuta i Sverige?', 'In what year was the krona introduced as Sweden''s currency?', 1873, '', ''),
  ('est-054', 'estimate', 'Vilket år antogs USA:s självständighetsförklaring?', 'In what year was the US Declaration of Independence adopted?', 1776, '', ''),
  ('est-055', 'estimate', 'Vilket år undertecknades Magna Carta i England?', 'In what year was Magna Carta sealed in England?', 1215, '', ''),
  ('est-056', 'estimate', 'Vilket år blev Carl XVI Gustaf kung av Sverige?', 'In what year did Carl XVI Gustaf become King of Sweden?', 1973, '', ''),
  ('est-057', 'estimate', 'Vilket år grundades Uppsala universitet?', 'In what year was Uppsala University founded?', 1477, '', ''),
  ('est-058', 'estimate', 'Vilket år gick Sverige över till den gregorianska kalendern?', 'In what year did Sweden switch to the Gregorian calendar?', 1753, '', ''),
  ('est-059', 'estimate', 'Vilket år gjorde bröderna Wright sin första motoriserade flygning?', 'In what year did the Wright brothers make their first powered flight?', 1903, '', ''),
  ('est-060', 'estimate', 'Vilket år blev Jurij Gagarin den första människan i rymden?', 'In what year did Yuri Gagarin become the first human in space?', 1961, '', ''),
  ('est-061', 'estimate', 'Ungefär hur många kilometer per sekund färdas ljuset i vakuum, avrundat till tusental?', 'Approximately how many kilometres per second does light travel in a vacuum, rounded to the nearest thousand?', 300000, 'km/s', 'km/s'),
  ('est-062', 'estimate', 'Vid hur många grader Fahrenheit fryser vatten?', 'At how many degrees Fahrenheit does water freeze?', 32, '°F', '°F'),
  ('est-063', 'estimate', 'Hur många grundämnen finns i det periodiska systemet i dag?', 'How many elements are in the periodic table today?', 118, 'grundämnen', 'elements'),
  ('est-064', 'estimate', 'Vilket atomnummer har guld?', 'What is the atomic number of gold?', 79, '', ''),
  ('est-065', 'estimate', 'Vilket atomnummer har järn?', 'What is the atomic number of iron?', 26, '', ''),
  ('est-066', 'estimate', 'Vilket atomnummer har uran?', 'What is the atomic number of uranium?', 92, '', ''),
  ('est-067', 'estimate', 'Ungefär hur många kilometer är medelavståndet mellan jorden och månen, avrundat till tusental?', 'Approximately how many kilometres is the average distance between the Earth and the Moon, rounded to the nearest thousand?', 384000, 'km', 'km'),
  ('est-068', 'estimate', 'Ungefär hur många miljoner kilometer är det från jorden till solen?', 'Approximately how many million kilometres is it from the Earth to the Sun?', 150, 'miljoner km', 'million km'),
  ('est-069', 'estimate', 'Ungefär hur många minuter tar det för solljuset att nå jorden?', 'Approximately how many minutes does it take for sunlight to reach the Earth?', 8, 'minuter', 'minutes'),
  ('est-070', 'estimate', 'Hur många grader Celsius är den absoluta nollpunkten, avrundat till hela grader?', 'How many degrees Celsius is absolute zero, rounded to whole degrees?', -273, '°C', '°C'),
  ('est-071', 'estimate', 'Hur många jorddygn tar det för Mars att gå ett varv runt solen, avrundat till hela dygn?', 'How many Earth days does it take Mars to orbit the Sun, rounded to whole days?', 687, 'dygn', 'days'),
  ('est-072', 'estimate', 'Ungefär hur många meter per sekund färdas ljudet i luft vid 20 °C?', 'Approximately how many metres per second does sound travel in air at 20 °C?', 343, 'm/s', 'm/s'),
  ('est-073', 'estimate', 'Vid ungefär hur många grader Celsius smälter rent järn?', 'At approximately how many degrees Celsius does pure iron melt?', 1538, '°C', '°C'),
  ('est-074', 'estimate', 'Hur många grader är vinkelsumman i en sexhörning?', 'How many degrees do the interior angles of a hexagon add up to?', 720, 'grader', 'degrees'),
  ('est-075', 'estimate', 'Vilket år upptäckte Alexander Fleming penicillinet?', 'In what year did Alexander Fleming discover penicillin?', 1928, '', ''),
  ('est-076', 'estimate', 'Vilket år gav Charles Darwin ut Om arternas uppkomst?', 'In what year did Charles Darwin publish On the Origin of Species?', 1859, '', ''),
  ('est-077', 'estimate', 'Vilket år presenterade Anders Celsius sin temperaturskala?', 'In what year did Anders Celsius present his temperature scale?', 1742, '', ''),
  ('est-078', 'estimate', 'Vilket år patenterade Alfred Nobel dynamiten?', 'In what year did Alfred Nobel patent dynamite?', 1867, '', ''),
  ('est-079', 'estimate', 'Ungefär hur många jorddygn tar det för Venus att rotera ett varv runt sin egen axel?', 'Approximately how many Earth days does it take Venus to rotate once on its axis?', 243, 'dygn', 'days'),
  ('est-080', 'estimate', 'Vilket år omklassades Pluto till dvärgplanet?', 'In what year was Pluto reclassified as a dwarf planet?', 2006, '', ''),
  ('est-081', 'estimate', 'Hur många meter är ett maratonlopp?', 'How many metres is a marathon?', 42195, 'meter', 'metres'),
  ('est-082', 'estimate', 'Hur många centimeter brett är ett fotbollsmål (mellan stolparnas insidor)?', 'How many centimetres wide is a football goal (between the inside of the posts)?', 732, 'cm', 'cm'),
  ('est-083', 'estimate', 'Hur många centimeter över golvet sitter en basketkorg, avrundat till hela centimeter?', 'How many centimetres above the floor is a basketball hoop, rounded to whole centimetres?', 305, 'cm', 'cm'),
  ('est-084', 'estimate', 'Vilket år hölls de första moderna olympiska spelen?', 'In what year were the first modern Olympic Games held?', 1896, '', ''),
  ('est-085', 'estimate', 'Vilket år arrangerade Sverige herrarnas fotbolls-VM?', 'In what year did Sweden host the men''s FIFA World Cup?', 1958, '', ''),
  ('est-086', 'estimate', 'Hur många poäng är det högsta man kan få med tre pilar i dart?', 'What is the highest score possible with three darts?', 180, 'poäng', 'points'),
  ('est-087', 'estimate', 'Hur många poäng är ett maximalt break i snooker (utan frispel)?', 'How many points is a maximum break in snooker (without a free ball)?', 147, 'poäng', 'points'),
  ('est-088', 'estimate', 'Hur många poäng är en perfekt serie i bowling?', 'How many points is a perfect game in bowling?', 300, 'poäng', 'points'),
  ('est-089', 'estimate', 'Hur många kilometer är det klassiska Vasaloppet?', 'How many kilometres is the classic Vasaloppet ski race?', 90, 'km', 'km'),
  ('est-090', 'estimate', 'Vilket år kördes det första Vasaloppet?', 'In what year was the first Vasaloppet ski race held?', 1922, '', ''),
  ('est-091', 'estimate', 'Hur många spelare har ett rugby union-lag på planen samtidigt?', 'How many players does a rugby union team have on the field at once?', 15, 'spelare', 'players'),
  ('est-092', 'estimate', 'Hur många gånger vann Björn Borg Wimbledon i herrsingel?', 'How many times did Björn Borg win the Wimbledon men''s singles?', 5, 'gånger', 'times'),
  ('est-093', 'estimate', 'Hur många meter från mållinjen ligger straffpunkten i fotboll?', 'How many metres from the goal line is the penalty spot in football?', 11, 'meter', 'metres'),
  ('est-094', 'estimate', 'Vilket år kördes Tour de France för första gången?', 'In what year was the Tour de France first held?', 1903, '', ''),
  ('est-095', 'estimate', 'Vilket år spelades det första fotbolls-VM för herrar?', 'In what year was the first men''s FIFA World Cup played?', 1930, '', ''),
  ('est-096', 'estimate', 'Hur många gram väger kulan i herrarnas kulstötning?', 'How many grams does the shot weigh in men''s shot put?', 7260, 'gram', 'grams'),
  ('est-097', 'estimate', 'Hur många fjädrar har en fjäderboll i badminton?', 'How many feathers does a badminton shuttlecock have?', 16, 'fjädrar', 'feathers'),
  ('est-098', 'estimate', 'Hur många häckar ska en löpare över på 110 meter häck?', 'How many hurdles does a runner clear in the 110 metres hurdles?', 10, 'häckar', 'hurdles'),
  ('est-099', 'estimate', 'Hur många bollar ligger på snookerbordet när en frame börjar, köbollen inräknad?', 'How many balls are on the snooker table at the start of a frame, including the cue ball?', 22, 'bollar', 'balls'),
  ('est-100', 'estimate', 'Hur många spelare per lag är på isen samtidigt i ishockey, målvakten inräknad?', 'How many players per team are on the ice at once in ice hockey, including the goalie?', 6, 'spelare', 'players'),
  ('est-101', 'estimate', 'Hur många minuter går det på ett dygn?', 'How many minutes are there in a day?', 1440, 'minuter', 'minutes'),
  ('est-102', 'estimate', 'Hur många sekunder går det på en timme?', 'How many seconds are there in an hour?', 3600, 'sekunder', 'seconds'),
  ('est-103', 'estimate', 'Hur många timmar går det på ett vanligt år (inte skottår)?', 'How many hours are there in a normal year (not a leap year)?', 8760, 'timmar', 'hours'),
  ('est-104', 'estimate', 'Hur många kort finns i en vanlig kortlek utan jokrar?', 'How many cards are there in a standard deck without jokers?', 52, 'kort', 'cards'),
  ('est-105', 'estimate', 'Hur många prickar finns det sammanlagt på en vanlig tärning?', 'How many dots are there in total on a standard die?', 21, 'prickar', 'dots'),
  ('est-106', 'estimate', 'Hur många bokstäver har det svenska alfabetet?', 'How many letters are there in the Swedish alphabet?', 29, 'bokstäver', 'letters'),
  ('est-107', 'estimate', 'Hur många millimeter lång är den långa sidan på ett A4-papper?', 'How many millimetres long is the long side of an A4 sheet of paper?', 297, 'mm', 'mm'),
  ('est-108', 'estimate', 'Hur många brickor finns i ett vanligt dominospel (dubbel-sex)?', 'How many tiles are there in a standard double-six domino set?', 28, 'brickor', 'tiles'),
  ('est-109', 'estimate', 'Hur många färgade rutor finns det sammanlagt på en vanlig Rubiks kub (3×3×3)?', 'How many coloured squares are there in total on a standard 3×3×3 Rubik''s Cube?', 54, 'rutor', 'squares'),
  ('est-110', 'estimate', 'Hur många timmar går det på en vecka?', 'How many hours are there in a week?', 168, 'timmar', 'hours'),
  ('est-111', 'estimate', 'Hur många liter ryms i en kubikmeter?', 'How many litres fit in one cubic metre?', 1000, 'liter', 'litres'),
  ('est-112', 'estimate', 'Hur många meter är en engelsk mile, avrundat till hela meter?', 'How many metres is one mile, rounded to whole metres?', 1609, 'meter', 'metres'),
  ('est-113', 'estimate', 'Hur många gram är ett engelskt pund (lb), avrundat till hela gram?', 'How many grams is one pound (lb), rounded to whole grams?', 454, 'gram', 'grams'),
  ('est-114', 'estimate', 'Hur många rutor har en vanlig sudoku?', 'How many squares does a standard sudoku have?', 81, 'rutor', 'squares'),
  ('est-115', 'estimate', 'Hur många sekunder går det på ett dygn?', 'How many seconds are there in a day?', 86400, 'sekunder', 'seconds'),
  ('est-116', 'estimate', 'Hur många rutor finns runt spelplanen i Monopol?', 'How many spaces are there around a Monopoly board?', 40, 'rutor', 'spaces'),
  ('est-117', 'estimate', 'Hur många fot (feet) är en engelsk mile?', 'How many feet are there in a mile?', 5280, 'fot', 'feet'),
  ('est-118', 'estimate', 'Hur många av årets månader har 31 dagar?', 'How many months of the year have 31 days?', 7, 'månader', 'months'),
  ('est-119', 'estimate', 'Hur många pixlar bred är en Full HD-bild (1080p)?', 'How many pixels wide is a Full HD (1080p) image?', 1920, 'pixlar', 'pixels'),
  ('est-120', 'estimate', 'Hur många dagar är fyra år i rad, där ett av dem är skottår?', 'How many days are there in four consecutive years, one of which is a leap year?', 1461, 'dagar', 'days'),
  ('est-121', 'estimate', 'Hur många kilokalorier ger ett gram fett?', 'How many kilocalories does one gram of fat provide?', 9, 'kcal', 'kcal'),
  ('est-122', 'estimate', 'Hur många kilokalorier ger ett gram protein?', 'How many kilocalories does one gram of protein provide?', 4, 'kcal', 'kcal'),
  ('est-123', 'estimate', 'Hur många kilokalorier ger ett gram alkohol?', 'How many kilocalories does one gram of alcohol provide?', 7, 'kcal', 'kcal'),
  ('est-124', 'estimate', 'Vilket år skapades Coca-Cola?', 'In what year was Coca-Cola created?', 1886, '', ''),
  ('est-125', 'estimate', 'Vilket år öppnade den första McDonald''s-restaurangen i Sverige?', 'In what year did the first McDonald''s restaurant open in Sweden?', 1973, '', ''),
  ('est-126', 'estimate', 'Hur många milliliter rymmer en vanlig vinflaska?', 'How many millilitres does a standard wine bottle hold?', 750, 'ml', 'ml'),
  ('est-127', 'estimate', 'Vilket år lanserades Absolut Vodka?', 'In what year was Absolut Vodka launched?', 1979, '', ''),
  ('est-128', 'estimate', 'Vilket år lanserades Nutella?', 'In what year was Nutella launched?', 1964, '', ''),
  ('est-129', 'estimate', 'Vilket år bildades ett gemensamt Systembolaget för hela Sverige?', 'In what year was a single national Systembolaget formed for all of Sweden?', 1955, '', ''),
  ('est-130', 'estimate', 'Hur många milliliter rymmer en vanlig läskburk i Sverige?', 'How many millilitres does a standard soft drink can hold in Sweden?', 330, 'ml', 'ml'),
  ('est-131', 'estimate', 'Hur många teskedar går det på en matsked?', 'How many teaspoons are there in a (Swedish, 15 ml) tablespoon?', 3, 'teskedar', 'teaspoons'),
  ('est-132', 'estimate', 'Vilket år grundades Tetra Pak?', 'In what year was Tetra Pak founded?', 1951, '', ''),
  ('est-133', 'estimate', 'Hur många smaker syftar glasskedjan Baskin-Robbins på i sin klassiska slogan?', 'How many flavours does Baskin-Robbins refer to in its classic slogan?', 31, 'smaker', 'flavours'),
  ('est-134', 'estimate', 'Vilket tal står det på Heinz klassiska flaskor ("... varieties")?', 'Which number appears on Heinz''s classic bottles ("... varieties")?', 57, '', ''),
  ('est-135', 'estimate', 'Vilket år grundades glassföretaget Ben & Jerry''s?', 'In what year was the ice cream company Ben & Jerry''s founded?', 1978, '', ''),
  ('est-136', 'estimate', 'Vilket år öppnade Starbucks sitt första kafé?', 'In what year did Starbucks open its first coffee shop?', 1971, '', ''),
  ('est-137', 'estimate', 'Hur många vanliga 75-centilitersflaskor motsvarar en Nebukadnessar-flaska champagne?', 'How many standard 75 cl bottles is a Nebuchadnezzar bottle of champagne equivalent to?', 20, 'flaskor', 'bottles'),
  ('est-138', 'estimate', 'Vilket år lanserades Kalles Kaviar?', 'In what year was Kalles Kaviar launched?', 1954, '', ''),
  ('est-139', 'estimate', 'Vilket år började Coca-Cola säljas i Sverige?', 'In what year did Coca-Cola go on sale in Sweden?', 1953, '', ''),
  ('est-140', 'estimate', 'Vilket år såldes skivat bröd för första gången i butik?', 'In what year was sliced bread first sold commercially?', 1928, '', ''),
  ('est-141', 'estimate', 'Hur många tangenter har ett vanligt piano?', 'How many keys does a standard piano have?', 88, 'tangenter', 'keys'),
  ('est-142', 'estimate', 'Hur många rutor har ett schackbräde?', 'How many squares does a chessboard have?', 64, 'rutor', 'squares'),
  ('est-143', 'estimate', 'Vilket år vann ABBA Eurovision Song Contest med Waterloo?', 'In what year did ABBA win the Eurovision Song Contest with Waterloo?', 1974, '', ''),
  ('est-144', 'estimate', 'Hur många stavelser har en klassisk haiku?', 'How many syllables does a classic haiku have?', 17, 'stavelser', 'syllables'),
  ('est-145', 'estimate', 'Hur många rader har en sonett?', 'How many lines does a sonnet have?', 14, 'rader', 'lines'),
  ('est-146', 'estimate', 'Vilket år hade den första Star Wars-filmen premiär?', 'In what year was the first Star Wars film released?', 1977, '', ''),
  ('est-147', 'estimate', 'Hur många symfonier skrev Beethoven?', 'How many symphonies did Beethoven write?', 9, 'symfonier', 'symphonies'),
  ('est-148', 'estimate', 'Vilket år kom den första boken om Pippi Långstrump ut?', 'In what year was the first Pippi Longstocking book published?', 1945, '', ''),
  ('est-149', 'estimate', 'Hur många gånger hade Sverige vunnit Eurovision Song Contest till och med 2023?', 'How many times had Sweden won the Eurovision Song Contest up to and including 2023?', 7, 'gånger', 'times'),
  ('est-150', 'estimate', 'Vilket år föddes Wolfgang Amadeus Mozart?', 'In what year was Wolfgang Amadeus Mozart born?', 1756, '', ''),
  ('est-151', 'estimate', 'Vilket år föddes William Shakespeare?', 'In what year was William Shakespeare born?', 1564, '', ''),
  ('est-152', 'estimate', 'Vilket år stod Eiffeltornet färdigt?', 'In what year was the Eiffel Tower completed?', 1889, '', ''),
  ('est-153', 'estimate', 'Vilket år släppte The Beatles sitt första album, Please Please Me?', 'In what year did The Beatles release their first album, Please Please Me?', 1963, '', ''),
  ('est-154', 'estimate', 'Vilket år släpptes den fullständiga versionen av Minecraft?', 'In what year was the full version of Minecraft released?', 2011, '', ''),
  ('est-155', 'estimate', 'Vilket år lanserades Spotify?', 'In what year was Spotify launched?', 2008, '', ''),
  ('est-156', 'estimate', 'Vilket år kom det första Super Mario Bros-spelet?', 'In what year was the first Super Mario Bros. game released?', 1985, '', ''),
  ('est-157', 'estimate', 'Hur många avsnitt av tv-serien Vänner (Friends) spelades in totalt?', 'How many episodes of the TV series Friends were made in total?', 236, 'avsnitt', 'episodes'),
  ('est-158', 'estimate', 'Hur många Oscars vann filmen Titanic från 1997?', 'How many Oscars did the 1997 film Titanic win?', 11, 'Oscars', 'Oscars'),
  ('est-159', 'estimate', 'Vilket år fick Selma Lagerlöf Nobelpriset i litteratur?', 'In what year was Selma Lagerlöf awarded the Nobel Prize in Literature?', 1909, '', ''),
  ('est-160', 'estimate', 'Vilket år grundades IKEA?', 'In what year was IKEA founded?', 1943, '', '')
on conflict (id) do update
  set text_sv = excluded.text_sv, text_en = excluded.text_en, answer = excluded.answer,
      unit_sv = excluded.unit_sv, unit_en = excluded.unit_en;
