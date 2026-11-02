-- Imposter and Mafia: phones only read their own secrets. Roles, the secret word, night
-- actions and police results are dealt and resolved by the functions in
-- 20261102120000_server_dealt_roles.sql; this migration removes the direct access.

-- The trust switch is only for those functions.
revoke execute on function public.picklo_trust() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Guards: who is out, who won and the revealed word only change through the server
-- ---------------------------------------------------------------------------
create or replace function public.picklo_guard_room_outcome()
returns trigger
language plpgsql
as $$
begin
  if public.picklo_is_trusted() then
    return new;
  end if;
  if new.state::text = 'ended' and old.state::text is distinct from 'ended' then
    raise exception 'ONLY_SERVER' using errcode = '42501';
  end if;
  if to_jsonb(new) -> 'winner' is distinct from to_jsonb(old) -> 'winner'
     or to_jsonb(new) -> 'secret_prompt' is distinct from to_jsonb(old) -> 'secret_prompt' then
    raise exception 'ONLY_SERVER' using errcode = '42501';
  end if;
  return new;
end;
$$;

create or replace function public.picklo_guard_player_status()
returns trigger
language plpgsql
as $$
begin
  if new.status::text is distinct from old.status::text and not public.picklo_is_trusted() then
    raise exception 'ONLY_SERVER' using errcode = '42501';
  end if;
  return new;
end;
$$;

do $$
declare
  r record;
begin
  for r in select * from (values
    ('mafia_rooms', 'mafia_room_players'),
    ('imposter_rooms', 'imposter_room_players')
  ) as v(rooms, players) loop
    execute format('drop trigger if exists %I on public.%I', r.rooms || '_guard_outcome', r.rooms);
    execute format('create trigger %I before update on public.%I for each row execute function public.picklo_guard_room_outcome()',
      r.rooms || '_guard_outcome', r.rooms);
    execute format('drop trigger if exists %I on public.%I', r.players || '_guard_status', r.players);
    execute format('create trigger %I before update on public.%I for each row execute function public.picklo_guard_player_status()',
      r.players || '_guard_status', r.players);

    -- Players change their own row ("ready"); only the host changes everyone's.
    execute format('drop policy if exists "members update players" on public.%I', r.players);
    execute format('drop policy if exists "self or host updates player" on public.%I', r.players);
    execute format(
      $p$create policy "self or host updates player" on public.%I for update to authenticated
         using (auth_user_id = auth.uid() or public.picklo_is_room_host(%L::regclass, %L::regclass, room_id))
         with check (auth_user_id = auth.uid() or public.picklo_is_room_host(%L::regclass, %L::regclass, room_id))$p$,
      r.players, 'public.' || r.players, 'public.' || r.rooms, 'public.' || r.players, 'public.' || r.rooms);
  end loop;
end
$$;

-- ---------------------------------------------------------------------------
-- Imposter
-- ---------------------------------------------------------------------------
create or replace function public.imposter_room_ended(p_room uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select state = 'ended' from public.imposter_rooms where id = p_room), false);
$$;

create or replace function public.imposter_is_my_player(p_player uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.imposter_room_players where id = p_player and auth_user_id = auth.uid());
$$;

-- Your own card, everyone's once the game is over.
drop policy if exists "members read" on public.imposter_player_roles;
drop policy if exists "members insert" on public.imposter_player_roles;
drop policy if exists "members update" on public.imposter_player_roles;
drop policy if exists "members delete" on public.imposter_player_roles;
drop policy if exists "own card or game over" on public.imposter_player_roles;
create policy "own card or game over" on public.imposter_player_roles for select to authenticated
  using (public.imposter_is_my_player(player_id)
         or (public.imposter_is_member(room_id) and public.imposter_room_ended(room_id)));

-- Votes are open, but only cast as yourself while voting is on.
drop policy if exists "members insert" on public.imposter_votes;
drop policy if exists "members update" on public.imposter_votes;
drop policy if exists "members delete" on public.imposter_votes;
drop policy if exists "vote as self" on public.imposter_votes;
drop policy if exists "change own vote" on public.imposter_votes;
create policy "vote as self" on public.imposter_votes for insert to authenticated
  with check (public.imposter_is_my_player(voter_player_id) and public.imposter_is_member(room_id));
create policy "change own vote" on public.imposter_votes for update to authenticated
  using (public.imposter_is_my_player(voter_player_id))
  with check (public.imposter_is_my_player(voter_player_id) and public.imposter_is_member(room_id));

-- The word is only copied onto the room when the game ends.
update public.imposter_rooms set secret_prompt = null where state <> 'ended';

-- ---------------------------------------------------------------------------
-- Mafia
-- ---------------------------------------------------------------------------
create or replace function public.mafia_my_role(p_room uuid) returns public.mafia_role
language sql stable security definer set search_path = '' as $$
  select r.role from public.mafia_player_roles r
    join public.mafia_room_players p on p.id = r.player_id
   where r.room_id = p_room and p.auth_user_id = auth.uid();
$$;

create or replace function public.mafia_room_ended(p_room uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select state = 'ended' from public.mafia_rooms where id = p_room), false);
$$;

create or replace function public.mafia_is_my_player(p_player uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.mafia_room_players where id = p_player and auth_user_id = auth.uid());
$$;

-- Roles: your own; the mafia also see each other; everyone's once the game is over.
drop policy if exists "members read" on public.mafia_player_roles;
drop policy if exists "members insert" on public.mafia_player_roles;
drop policy if exists "members update" on public.mafia_player_roles;
drop policy if exists "members delete" on public.mafia_player_roles;
drop policy if exists "own role, mafia team or game over" on public.mafia_player_roles;
create policy "own role, mafia team or game over" on public.mafia_player_roles for select to authenticated
  using (public.mafia_is_my_player(player_id)
         or (role = 'mafia' and public.mafia_my_role(room_id) = 'mafia')
         or (public.mafia_is_member(room_id) and public.mafia_room_ended(room_id)));

-- Night actions: your own; the mafia also see the mafia's. Written only by the server.
drop policy if exists "members read" on public.mafia_night_actions;
drop policy if exists "members insert" on public.mafia_night_actions;
drop policy if exists "members update" on public.mafia_night_actions;
drop policy if exists "members delete" on public.mafia_night_actions;
drop policy if exists "own or mafia team actions" on public.mafia_night_actions;
create policy "own or mafia team actions" on public.mafia_night_actions for select to authenticated
  using (public.mafia_is_my_player(actor_player_id)
         or (actor_role = 'mafia' and public.mafia_my_role(room_id) = 'mafia'));

-- Police results: only the police.
drop policy if exists "members read" on public.mafia_police_reports;
drop policy if exists "members insert" on public.mafia_police_reports;
drop policy if exists "members update" on public.mafia_police_reports;
drop policy if exists "members delete" on public.mafia_police_reports;
drop policy if exists "own police reports" on public.mafia_police_reports;
create policy "own police reports" on public.mafia_police_reports for select to authenticated
  using (public.mafia_is_my_player(police_player_id));

-- Game events (night and vote results): read by the room, written only by the server.
drop policy if exists "members insert" on public.mafia_game_events;
drop policy if exists "members update" on public.mafia_game_events;
drop policy if exists "members delete" on public.mafia_game_events;

-- Day votes are open, but only cast as yourself.
drop policy if exists "members insert" on public.mafia_day_votes;
drop policy if exists "members update" on public.mafia_day_votes;
drop policy if exists "members delete" on public.mafia_day_votes;
drop policy if exists "vote as self" on public.mafia_day_votes;
drop policy if exists "change own vote" on public.mafia_day_votes;
create policy "vote as self" on public.mafia_day_votes for insert to authenticated
  with check (public.mafia_is_my_player(voter_player_id) and public.mafia_is_member(room_id));
create policy "change own vote" on public.mafia_day_votes for update to authenticated
  using (public.mafia_is_my_player(voter_player_id))
  with check (public.mafia_is_my_player(voter_player_id) and public.mafia_is_member(room_id));
