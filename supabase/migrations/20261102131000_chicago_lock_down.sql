-- Chicago: phones read only their own hand and can no longer write game state; every move
-- goes through the functions in 20261102121000_chicago_server_rules.sql.

-- Decks dealt by the old phone-side code move to the private table.
insert into public.chicago_decks (round_id, cards)
select id, deck from public.chicago_rounds where jsonb_array_length(deck) > 0
on conflict (round_id) do nothing;
update public.chicago_rounds set deck = '[]'::jsonb where jsonb_array_length(deck) > 0;

-- Hands and exchanges: only your own. Written by the server.
drop policy if exists "members read" on public.chicago_player_hands;
drop policy if exists "members insert" on public.chicago_player_hands;
drop policy if exists "members update" on public.chicago_player_hands;
drop policy if exists "members delete" on public.chicago_player_hands;
drop policy if exists "own hand" on public.chicago_player_hands;
create policy "own hand" on public.chicago_player_hands for select to authenticated
  using (player_id = public.chicago_my_player(room_id));

drop policy if exists "members read" on public.chicago_draw_actions;
drop policy if exists "members insert" on public.chicago_draw_actions;
drop policy if exists "members update" on public.chicago_draw_actions;
drop policy if exists "members delete" on public.chicago_draw_actions;
drop policy if exists "own exchanges" on public.chicago_draw_actions;
create policy "own exchanges" on public.chicago_draw_actions for select to authenticated
  using (player_id = public.chicago_my_player(public.chicago_round_room(round_id)));

-- Rounds, tricks and played cards stay readable by the room, but only the server writes them.
do $$
declare
  t text;
begin
  foreach t in array array['chicago_rounds', 'chicago_tricks', 'chicago_cards_played'] loop
    execute format('drop policy if exists "members insert" on public.%I', t);
    execute format('drop policy if exists "members update" on public.%I', t);
    execute format('drop policy if exists "members delete" on public.%I', t);
  end loop;
end
$$;

-- Room and players: phones may only claim the host seat of a room they just created (and
-- rename themselves); turn, phase, scores and the winner change only on the server.
create or replace function public.chicago_guard_row()
returns trigger
language plpgsql
as $$
begin
  if public.picklo_is_trusted() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if tg_table_name = 'chicago_room_players' then
      new.score := 0;
      new.status := 'active';
      new.draw_ready := false;
      new.trick_ready := false;
      new.chicago_declared := false;
    elsif new.state::text <> 'lobby' or new.winner_player_id is not null then
      raise exception 'ONLY_SERVER' using errcode = '42501';
    end if;
    return new;
  end if;
  if (to_jsonb(new) - array['host_player_id', 'display_name', 'updated_at'])
     is distinct from (to_jsonb(old) - array['host_player_id', 'display_name', 'updated_at']) then
    raise exception 'ONLY_SERVER' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists chicago_rooms_guard on public.chicago_rooms;
create trigger chicago_rooms_guard before insert or update on public.chicago_rooms
  for each row execute function public.chicago_guard_row();
drop trigger if exists chicago_room_players_guard on public.chicago_room_players;
create trigger chicago_room_players_guard before insert or update on public.chicago_room_players
  for each row execute function public.chicago_guard_row();

-- Players update only their own row (the guard limits that to the name).
drop policy if exists "members update players" on public.chicago_room_players;
drop policy if exists "self updates player" on public.chicago_room_players;
create policy "self updates player" on public.chicago_room_players for update to authenticated
  using (auth_user_id = auth.uid()) with check (auth_user_id = auth.uid());
