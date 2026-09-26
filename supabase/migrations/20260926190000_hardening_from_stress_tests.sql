-- Hardening based on the stress/abuse test suite (tests/stress).

-- ---------------------------------------------------------------------------
-- 1. join_room: simultaneous joins broke the player limit and seat numbers,
--    and a double tap from one phone raised a raw unique-violation error.
--    Lock the room row so joins to the same room queue up; seats = max + 1.
-- ---------------------------------------------------------------------------
create or replace function public.join_room(p_game text, p_code text, p_name text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_code text := upper(trim(coalesce(p_code, '')));
  v_name text := left(trim(coalesce(p_name, '')), 40);
  v_room_id uuid;
  v_state text;
  v_count integer;
  v_seat integer;
  v_player_id uuid;
begin
  if v_uid is null then
    raise exception 'NOT_SIGNED_IN' using errcode = '28000';
  end if;
  if v_name = '' then
    raise exception 'NAME_REQUIRED' using errcode = '22023';
  end if;

  if p_game = 'memematch' then
    select id, phase into v_room_id, v_state from public.rooms where code = v_code for update;
    if v_room_id is null then raise exception 'ROOM_NOT_FOUND' using errcode = 'P0002'; end if;
    select id into v_player_id from public.players where room_id = v_room_id and auth_user_id = v_uid;
    if v_player_id is null then
      if v_state = 'finished' then raise exception 'GAME_ALREADY_ENDED' using errcode = 'P0001'; end if;
      insert into public.players (room_id, name, auth_user_id) values (v_room_id, v_name, v_uid) returning id into v_player_id;
    end if;

  elsif p_game = 'mafia' then
    select id, state::text into v_room_id, v_state from public.mafia_rooms where code = v_code for update;
    if v_room_id is null then raise exception 'ROOM_NOT_FOUND' using errcode = 'P0002'; end if;
    select id into v_player_id from public.mafia_room_players where room_id = v_room_id and auth_user_id = v_uid;
    if v_player_id is null then
      if v_state <> 'lobby' then raise exception 'GAME_ALREADY_STARTED' using errcode = 'P0001'; end if;
      select count(*), coalesce(max(seat_order), 0) + 1 into v_count, v_seat from public.mafia_room_players where room_id = v_room_id;
      if v_count >= 20 then raise exception 'ROOM_FULL' using errcode = 'P0001'; end if;
      insert into public.mafia_room_players (room_id, display_name, seat_order, auth_user_id)
      values (v_room_id, v_name, v_seat, v_uid) returning id into v_player_id;
    end if;

  elsif p_game = 'imposter' then
    select id, state::text into v_room_id, v_state from public.imposter_rooms where code = v_code for update;
    if v_room_id is null then raise exception 'ROOM_NOT_FOUND' using errcode = 'P0002'; end if;
    select id into v_player_id from public.imposter_room_players where room_id = v_room_id and auth_user_id = v_uid;
    if v_player_id is null then
      if v_state <> 'lobby' then raise exception 'GAME_ALREADY_STARTED' using errcode = 'P0001'; end if;
      select count(*), coalesce(max(seat_order), 0) + 1 into v_count, v_seat from public.imposter_room_players where room_id = v_room_id;
      if v_count >= 12 then raise exception 'ROOM_FULL' using errcode = 'P0001'; end if;
      insert into public.imposter_room_players (room_id, display_name, seat_order, auth_user_id)
      values (v_room_id, v_name, v_seat, v_uid) returning id into v_player_id;
    end if;

  elsif p_game = 'chicago' then
    select id, state::text into v_room_id, v_state from public.chicago_rooms where code = v_code for update;
    if v_room_id is null then raise exception 'ROOM_NOT_FOUND' using errcode = 'P0002'; end if;
    select id into v_player_id from public.chicago_room_players where room_id = v_room_id and auth_user_id = v_uid;
    if v_player_id is null then
      if v_state = 'game_over' then raise exception 'GAME_ALREADY_ENDED' using errcode = 'P0001'; end if;
      select count(*), coalesce(max(seat_order), 0) + 1 into v_count, v_seat from public.chicago_room_players where room_id = v_room_id;
      if v_count >= 6 then raise exception 'ROOM_FULL' using errcode = 'P0001'; end if;
      insert into public.chicago_room_players (room_id, display_name, seat_order, auth_user_id)
      values (v_room_id, v_name, v_seat, v_uid) returning id into v_player_id;
    end if;

  elsif p_game = 'musicQuiz' then
    select id, state into v_room_id, v_state from public.music_quiz_rooms where code = v_code for update;
    if v_room_id is null then raise exception 'ROOM_NOT_FOUND' using errcode = 'P0002'; end if;
    select id into v_player_id from public.music_quiz_players where room_id = v_room_id and auth_user_id = v_uid;
    if v_player_id is null then
      select count(*), coalesce(max(seat_order), 0) + 1 into v_count, v_seat from public.music_quiz_players where room_id = v_room_id;
      if v_count >= 20 then raise exception 'ROOM_FULL' using errcode = 'P0001'; end if;
      insert into public.music_quiz_players (room_id, display_name, seat_order, auth_user_id)
      values (v_room_id, v_name, v_seat, v_uid) returning id into v_player_id;
    end if;

  elsif p_game = 'trivia' then
    select id, state into v_room_id, v_state from public.trivia_rooms where code = v_code for update;
    if v_room_id is null then raise exception 'ROOM_NOT_FOUND' using errcode = 'P0002'; end if;
    select id into v_player_id from public.trivia_players where room_id = v_room_id and auth_user_id = v_uid;
    if v_player_id is null then
      if v_state <> 'lobby' then raise exception 'GAME_ALREADY_STARTED' using errcode = 'P0001'; end if;
      select count(*), coalesce(max(seat_order), 0) + 1 into v_count, v_seat from public.trivia_players where room_id = v_room_id;
      if v_count >= 12 then raise exception 'ROOM_FULL' using errcode = 'P0001'; end if;
      insert into public.trivia_players (room_id, display_name, seat_order, auth_user_id)
      values (v_room_id, v_name, v_seat, v_uid) returning id into v_player_id;
    end if;

  else
    raise exception 'UNKNOWN_GAME' using errcode = '22023';
  end if;

  return jsonb_build_object('room_id', v_room_id, 'player_id', v_player_id, 'code', v_code);
end;
$$;

revoke execute on function public.join_room(text, text, text) from public, anon;
grant execute on function public.join_room(text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Player names: trimmed, 1–40 characters, for every game (also on create).
-- ---------------------------------------------------------------------------
create or replace function public.picklo_normalize_player_name()
returns trigger
language plpgsql
as $$
declare
  v_col text := tg_argv[0];
  v_name text;
begin
  v_name := left(trim(coalesce(to_jsonb(new) ->> v_col, '')), 40);
  if v_name = '' then
    raise exception 'NAME_REQUIRED' using errcode = '22023';
  end if;
  new := jsonb_populate_record(new, jsonb_build_object(v_col, v_name));
  return new;
end;
$$;

do $$
declare
  r record;
begin
  for r in select * from (values
    ('players', 'name'),
    ('mafia_room_players', 'display_name'),
    ('imposter_room_players', 'display_name'),
    ('chicago_room_players', 'display_name'),
    ('music_quiz_players', 'display_name'),
    ('trivia_players', 'display_name')
  ) as v(tbl, col) loop
    execute format('drop trigger if exists %I on public.%I', r.tbl || '_normalize_name', r.tbl);
    execute format(
      'create trigger %I before insert or update of %I on public.%I for each row execute function public.picklo_normalize_player_name(%L)',
      r.tbl || '_normalize_name', r.col, r.tbl, r.col);
  end loop;
end
$$;

-- ---------------------------------------------------------------------------
-- 3. Room codes: a collision gets a fresh code instead of a unique-violation error.
-- ---------------------------------------------------------------------------
create or replace function public.picklo_unique_room_code()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_chars constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_exists boolean;
  v_try integer := 0;
begin
  new.code := upper(trim(new.code));
  loop
    execute format('select exists (select 1 from public.%I where code = $1)', tg_table_name) into v_exists using new.code;
    exit when not v_exists;
    v_try := v_try + 1;
    if v_try > 50 then
      raise exception 'Could not find a free room code' using errcode = 'P0001';
    end if;
    new.code := (
      select string_agg(substr(v_chars, 1 + floor(random() * length(v_chars))::int, 1), '')
      from generate_series(1, 4)
    );
  end loop;
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array['rooms', 'mafia_rooms', 'imposter_rooms', 'chicago_rooms', 'music_quiz_rooms', 'trivia_rooms'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_unique_code', t);
    execute format('create trigger %I before insert on public.%I for each row execute function public.picklo_unique_room_code()', t || '_unique_code', t);
  end loop;
end
$$;

-- ---------------------------------------------------------------------------
-- 4. Host protection: only the current host can hand over the host role, and a new
--    room's host must be the creator's own player. Removing players: only yourself,
--    or the host.
-- ---------------------------------------------------------------------------
create or replace function public.picklo_protect_host()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_players text := tg_argv[0];
  v_ok boolean;
begin
  if new.host_player_id is not distinct from old.host_player_id or auth.uid() is null then
    return new; -- unchanged, or server-side (service role / housekeeping)
  end if;

  if old.host_player_id is null then
    -- Claiming an empty host seat: only with your own player row in this room.
    execute format('select exists (select 1 from public.%I where id = $1 and room_id = $2 and auth_user_id = auth.uid())', v_players)
      into v_ok using new.host_player_id, new.id;
  else
    -- Handing over: only the current host may do it.
    execute format('select exists (select 1 from public.%I where id = $1 and auth_user_id = auth.uid())', v_players)
      into v_ok using old.host_player_id;
  end if;

  if not coalesce(v_ok, false) then
    raise exception 'ONLY_HOST' using errcode = '42501';
  end if;
  return new;
end;
$$;

create or replace function public.picklo_is_room_host(p_players regclass, p_rooms regclass, p_room uuid)
returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare
  v_ok boolean;
begin
  execute format(
    'select exists (select 1 from %s r join %s p on p.id = r.host_player_id where r.id = $1 and p.auth_user_id = auth.uid())',
    p_rooms, p_players)
    into v_ok using p_room;
  return coalesce(v_ok, false);
end;
$$;

do $$
declare
  r record;
begin
  for r in select * from (values
    ('rooms', 'players'),
    ('mafia_rooms', 'mafia_room_players'),
    ('imposter_rooms', 'imposter_room_players'),
    ('chicago_rooms', 'chicago_room_players'),
    ('music_quiz_rooms', 'music_quiz_players'),
    ('trivia_rooms', 'trivia_players')
  ) as v(rooms, players) loop
    execute format('drop trigger if exists %I on public.%I', r.rooms || '_protect_host', r.rooms);
    execute format(
      'create trigger %I before update of host_player_id on public.%I for each row execute function public.picklo_protect_host(%L)',
      r.rooms || '_protect_host', r.rooms, r.players);

    execute format('drop policy if exists "members delete players" on public.%I', r.players);
    execute format(
      $p$create policy "self or host removes player" on public.%I for delete to authenticated
         using (auth_user_id = auth.uid() or public.picklo_is_room_host(%L::regclass, %L::regclass, room_id))$p$,
      r.players, 'public.' || r.players, 'public.' || r.rooms);
  end loop;
end
$$;

-- ---------------------------------------------------------------------------
-- 5. MemeMatch: members could delete other players' votes/submissions and take over
--    other players' photos; votes could be changed after the round ended.
-- ---------------------------------------------------------------------------
create or replace function public.memematch_round_status(p_round uuid) returns text
language sql stable security definer set search_path = '' as $$
  select status from public.rounds where id = p_round;
$$;

drop policy if exists "members delete" on public.votes;
drop policy if exists "members delete" on public.submissions;
drop policy if exists "members update" on public.player_images;
drop policy if exists "update own images" on public.player_images;
create policy "update own images" on public.player_images for update to authenticated
  using (public.memematch_is_my_player(player_id))
  with check (public.memematch_is_my_player(player_id) and public.memematch_is_member(room_id));

drop policy if exists "submit as self" on public.submissions;
create policy "submit as self" on public.submissions for insert to authenticated
  with check (public.memematch_is_my_player(player_id)
    and public.memematch_round_status(round_id) = 'collecting'
    and public.memematch_is_member(public.memematch_round_room(round_id)));

drop policy if exists "vote as self" on public.votes;
create policy "vote as self" on public.votes for insert to authenticated
  with check (public.memematch_is_my_player(voter_player_id)
    and public.memematch_submission_owner(submission_id) <> voter_player_id
    and public.memematch_played_in_round(round_id, voter_player_id)
    and public.memematch_round_status(round_id) = 'voting'
    and public.memematch_is_member(public.memematch_round_room(round_id)));

drop policy if exists "change own vote" on public.votes;
create policy "change own vote" on public.votes for update to authenticated
  using (public.memematch_is_my_player(voter_player_id) and public.memematch_round_status(round_id) = 'voting')
  with check (public.memematch_is_my_player(voter_player_id)
    and public.memematch_submission_owner(submission_id) <> voter_player_id
    and public.memematch_round_status(round_id) = 'voting');
