-- Chicago: dealing, exchanges, poker scoring, tricks and points run in the database, so no
-- phone can see the deck or another hand, play out of turn or change a score. Same rules and
-- public messages as the old phone-side code (src/games/chicago/logic.ts and api.ts). This
-- file only ADDS functions and a table; direct access is locked down in a later migration.

create table if not exists public.chicago_decks (
  round_id uuid primary key references public.chicago_rounds(id) on delete cascade,
  cards jsonb not null default '[]'::jsonb
);
alter table public.chicago_decks enable row level security;


-- ---------------------------------------------------------------------------
-- Cards and poker hands
-- ---------------------------------------------------------------------------
create or replace function public.chicago_rank_value(p_rank text) returns integer
language sql immutable as $$
  select case p_rank when 'J' then 11 when 'Q' then 12 when 'K' then 13 when 'A' then 14 else p_rank::integer end;
$$;

create or replace function public.chicago_my_player(p_room uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select id from public.chicago_room_players where room_id = p_room and auth_user_id = auth.uid();
$$;

-- Same ranking as evaluatePokerHand: tiebreak[1] is the hand's weight, then the deciding ranks.
create or replace function public.chicago_evaluate(p_cards jsonb, out name text, out label text, out points integer, out tiebreak integer[])
language plpgsql immutable set search_path = '' as $$
declare
  v_asc integer[];
  v_desc integer[];
  v_flush boolean;
  v_high integer;
  v_cv integer[];
  v_cc integer[];
begin
  select array_agg(public.chicago_rank_value(c ->> 'rank') order by public.chicago_rank_value(c ->> 'rank')),
         count(distinct c ->> 'suit') = 1
    into v_asc, v_flush
    from jsonb_array_elements(coalesce(p_cards, '[]'::jsonb)) c;
  select array_agg(v order by v desc) into v_desc from unnest(v_asc) v;
  select array_agg(v order by n desc, v desc), array_agg(n order by n desc, v desc) into v_cv, v_cc
    from (select v, count(*)::int n from unnest(v_asc) v group by v) t;

  if coalesce(array_length(v_asc, 1), 0) <> 5 then
    name := 'high_card'; label := 'High Card'; points := 0; tiebreak := array[0] || coalesce(v_desc, '{}');
    return;
  end if;

  if array_length(v_cv, 1) = 5 then
    if v_asc = array[2, 3, 4, 5, 14] then v_high := 5;
    elsif v_asc[5] - v_asc[1] = 4 then v_high := v_asc[5];
    end if;
  end if;

  if v_flush and v_asc = array[10, 11, 12, 13, 14] then
    name := 'royal_straight_flush'; label := 'Royal Straight Flush'; points := 52; tiebreak := array[9, 14];
  elsif v_flush and v_high is not null then
    name := 'straight_flush'; label := 'Straight Flush'; points := 8; tiebreak := array[8, v_high];
  elsif v_cc[1] = 4 then
    name := 'four_of_a_kind'; label := 'Four of a Kind'; points := 7; tiebreak := array[7, v_cv[1], v_cv[2]];
  elsif v_cc[1] = 3 and v_cc[2] = 2 then
    name := 'full_house'; label := 'Full House'; points := 6; tiebreak := array[6, v_cv[1], v_cv[2]];
  elsif v_flush then
    name := 'flush'; label := 'Flush'; points := 5; tiebreak := array[5] || v_desc;
  elsif v_high is not null then
    name := 'straight'; label := 'Straight'; points := 4; tiebreak := array[4, v_high];
  elsif v_cc[1] = 3 then
    name := 'three_of_a_kind'; label := 'Three of a Kind'; points := 3; tiebreak := array[3] || v_cv;
  elsif v_cc[1] = 2 and v_cc[2] = 2 then
    name := 'two_pair'; label := 'Two Pair'; points := 2;
    tiebreak := array[2, greatest(v_cv[1], v_cv[2]), least(v_cv[1], v_cv[2]), v_cv[3]];
  elsif v_cc[1] = 2 then
    name := 'pair'; label := 'Pair'; points := 1; tiebreak := array[1] || v_cv;
  else
    name := 'high_card'; label := 'High Card'; points := 0; tiebreak := array[0] || v_desc;
  end if;
end;
$$;

-- The cards in p_hand minus p_remove (each removed card once).
create or replace function public.chicago_without(p_hand jsonb, p_remove jsonb) returns jsonb
language sql immutable as $$
  select coalesce(jsonb_agg(c order by i), '[]'::jsonb)
    from jsonb_array_elements(p_hand) with ordinality h(c, i)
   where not exists (
     select 1 from jsonb_array_elements(p_remove) r
      where r ->> 'rank' = c ->> 'rank' and r ->> 'suit' = c ->> 'suit'
   );
$$;

create or replace function public.chicago_add_score(p_player uuid, p_amount integer) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_score integer;
begin
  perform public.picklo_trust();
  update public.chicago_room_players set score = score + p_amount where id = p_player returning score into v_score;
  return v_score;
end;
$$;

-- Ends the game when someone reached 52 (the highest score wins if several did).
create or replace function public.chicago_finish_if_won(p_room uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_winner public.chicago_room_players%rowtype;
begin
  select * into v_winner from public.chicago_room_players
   where room_id = p_room and score >= 52 order by score desc, seat_order limit 1;
  if not found then return false; end if;
  perform public.picklo_trust();
  update public.chicago_rooms
     set state = 'game_over', winner_player_id = v_winner.id, current_turn_player_id = null,
         public_message = v_winner.display_name || ' reached 52 points and wins Chicago.'
   where id = p_room;
  return true;
end;
$$;

revoke execute on function public.chicago_add_score(uuid, integer) from public, anon, authenticated;
revoke execute on function public.chicago_finish_if_won(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Game steps
-- ---------------------------------------------------------------------------
create or replace function public.chicago_start_round(p_room uuid)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_room public.chicago_rooms%rowtype;
  v_players uuid[];
  v_n integer;
  v_dealer integer;
  v_deck jsonb;
  v_round uuid;
begin
  select * into v_room from public.chicago_rooms where id = p_room for update;
  if not found then raise exception 'ROOM_NOT_FOUND' using errcode = 'P0002'; end if;
  if not public.picklo_is_room_host('public.chicago_room_players', 'public.chicago_rooms', p_room) then
    raise exception 'Only the host can do that' using errcode = '42501';
  end if;
  select array_agg(id order by seat_order) into v_players from public.chicago_room_players where room_id = p_room and status = 'active';
  v_n := coalesce(array_length(v_players, 1), 0);
  if v_n < 2 or v_n > 6 then raise exception 'Chicago requires 2 to 6 active players' using errcode = 'P0001'; end if;

  v_dealer := case when v_room.current_round > 0 then v_room.current_round % v_n else 0 end;
  select jsonb_agg(jsonb_build_object('rank', r, 'suit', s) order by random()) into v_deck
    from unnest(array['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']) r
   cross join unnest(array['clubs', 'diamonds', 'hearts', 'spades']) s;

  insert into public.chicago_rounds (room_id, round_number, dealer_player_id, active_phase, draw_number, trick_number)
  values (p_room, v_room.current_round + 1, v_players[v_dealer + 1], 'draw_phase_1', 1, 0)
  returning id into v_round;

  delete from public.chicago_player_hands where room_id = p_room;
  insert into public.chicago_player_hands (player_id, room_id, round_id, cards)
  select v_players[i], p_room, v_round,
         (select jsonb_agg(c order by o) from jsonb_array_elements(v_deck) with ordinality d(c, o) where o between (i - 1) * 5 + 1 and i * 5)
    from generate_subscripts(v_players, 1) i;
  insert into public.chicago_decks (round_id, cards)
  select v_round, coalesce(jsonb_agg(c order by o), '[]'::jsonb)
    from jsonb_array_elements(v_deck) with ordinality d(c, o) where o > v_n * 5;

  perform public.picklo_trust();
  update public.chicago_room_players set draw_ready = false, trick_ready = false, chicago_declared = false
   where room_id = p_room and status = 'active';
  update public.chicago_rooms
     set state = 'draw_phase_1', current_round = v_room.current_round + 1, dealer_player_id = v_players[v_dealer + 1],
         lead_player_id = v_players[(v_dealer + 1) % v_n + 1], current_turn_player_id = null,
         phase_number = phase_number + 1, phase_ends_at = null, winner_player_id = null,
         public_message = 'Round dealt. Choose cards to exchange.'
   where id = p_room;
end;
$$;

create or replace function public.chicago_submit_draw(p_room uuid, p_discards jsonb)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_room public.chicago_rooms%rowtype;
  v_round public.chicago_rounds%rowtype;
  v_me public.chicago_room_players%rowtype;
  v_hand jsonb;
  v_keep jsonb;
  v_count integer := jsonb_array_length(coalesce(p_discards, '[]'::jsonb));
  v_deck jsonb;
  v_new jsonb;
  v_lead uuid;
begin
  -- Locking the room queues simultaneous exchanges, so two phones never draw the same card.
  select * into v_room from public.chicago_rooms where id = p_room for update;
  select * into v_me from public.chicago_room_players where room_id = p_room and auth_user_id = auth.uid();
  if v_room.id is null or v_me.id is null then raise exception 'NOT_A_MEMBER' using errcode = '42501'; end if;
  if v_room.state not in ('draw_phase_1', 'draw_phase_2', 'draw_phase_3') then
    raise exception 'Draw phase is not active' using errcode = 'P0001';
  end if;
  if v_me.draw_ready then raise exception 'You already exchanged cards this time' using errcode = 'P0001'; end if;
  select * into v_round from public.chicago_rounds where room_id = p_room order by round_number desc limit 1;
  select cards into v_hand from public.chicago_player_hands where player_id = v_me.id;

  v_keep := public.chicago_without(v_hand, coalesce(p_discards, '[]'::jsonb));
  if jsonb_array_length(v_hand) - jsonb_array_length(v_keep) <> v_count then
    raise exception 'Choose cards that are actually in your hand' using errcode = 'P0001';
  end if;

  select cards into v_deck from public.chicago_decks where round_id = v_round.id for update;
  -- A round dealt by the old phone-side code keeps its deck on the round until the lockdown moves it.
  v_deck := coalesce(v_deck, v_round.deck, '[]'::jsonb);
  if jsonb_array_length(v_deck) < v_count then
    -- The stock ran out: shuffle the cards thrown earlier this round back in, except any that
    -- are in a hand again (including the ones being thrown now).
    select v_deck || coalesce(jsonb_agg(c order by random()), '[]'::jsonb) into v_deck from (
      select distinct c from public.chicago_draw_actions a, jsonb_array_elements(a.discarded_cards) c
       where a.round_id = v_round.id
         and not exists (select 1 from public.chicago_player_hands h, jsonb_array_elements(h.cards) hc
                          where h.room_id = p_room and hc = c)
         and not exists (select 1 from jsonb_array_elements(v_deck) dc where dc = c)
    ) pile;
  end if;
  if jsonb_array_length(v_deck) < v_count then
    raise exception 'Not enough cards left in the deck' using errcode = 'P0001';
  end if;

  select coalesce(jsonb_agg(c order by o), '[]'::jsonb) into v_new from jsonb_array_elements(v_deck) with ordinality d(c, o) where o <= v_count;
  select coalesce(jsonb_agg(c order by o), '[]'::jsonb) into v_deck from jsonb_array_elements(v_deck) with ordinality d(c, o) where o > v_count;
  update public.chicago_player_hands set cards = v_keep || v_new where player_id = v_me.id;
  insert into public.chicago_draw_actions (player_id, round_id, draw_number, discarded_cards)
  values (v_me.id, v_round.id, v_round.draw_number, coalesce(p_discards, '[]'::jsonb))
  on conflict (player_id, round_id, draw_number) do update set discarded_cards = excluded.discarded_cards;
  insert into public.chicago_decks (round_id, cards) values (v_round.id, v_deck)
  on conflict (round_id) do update set cards = excluded.cards;

  perform public.picklo_trust();
  update public.chicago_room_players set draw_ready = true where id = v_me.id;
  if exists (select 1 from public.chicago_room_players where room_id = p_room and status = 'active' and not draw_ready) then
    return;
  end if;

  update public.chicago_room_players set draw_ready = false where room_id = p_room and status = 'active';
  if v_room.state = 'draw_phase_1' then
    update public.chicago_rooms set state = 'poker_score_1', phase_number = phase_number + 1,
           public_message = 'All draws submitted. Score the first poker hand.' where id = p_room;
    update public.chicago_rounds set active_phase = 'poker_score_1' where id = v_round.id;
  elsif v_room.state = 'draw_phase_2' then
    update public.chicago_rooms set state = 'poker_score_2', phase_number = phase_number + 1,
           public_message = 'All draws submitted. Score the second poker hand.' where id = p_room;
    update public.chicago_rounds set active_phase = 'poker_score_2' where id = v_round.id;
  else
    insert into public.chicago_tricks (round_id, trick_number) values (v_round.id, 1) on conflict do nothing;
    update public.chicago_rounds set active_phase = 'trick_phase', trick_number = 1 where id = v_round.id;
    v_lead := coalesce(v_room.lead_player_id,
      (select id from public.chicago_room_players where room_id = p_room and status = 'active' order by seat_order limit 1));
    update public.chicago_rooms set state = 'trick_phase', current_turn_player_id = v_lead, phase_number = phase_number + 1,
           public_message = 'Final draw complete. Play tricks and fight for the last one.' where id = p_room;
  end if;
end;
$$;

-- Every phone may ask for the scoring; the first one does it, the others find it done.
create or replace function public.chicago_score_poker(p_room uuid)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_room public.chicago_rooms%rowtype;
  v_winner uuid;
  v_name text;
  v_label text;
  v_points integer;
  v_hand_name text;
  v_top integer[];
  v_tied boolean;
  v_score integer;
  v_first boolean;
  v_next public.chicago_phase;
begin
  if public.chicago_my_player(p_room) is null then raise exception 'NOT_A_MEMBER' using errcode = '42501'; end if;
  select * into v_room from public.chicago_rooms where id = p_room for update;
  if v_room.state not in ('poker_score_1', 'poker_score_2') then return; end if;
  v_first := v_room.state = 'poker_score_1';

  select h.player_id, p.display_name, (e).label, (e).points, (e).name, (e).tiebreak
    into v_winner, v_name, v_label, v_points, v_hand_name, v_top
    from (select player_id, public.chicago_evaluate(cards) e from public.chicago_player_hands where room_id = p_room) h
    join public.chicago_room_players p on p.id = h.player_id
   order by (e).tiebreak desc, p.seat_order limit 1;
  if v_winner is null then raise exception 'No hands found' using errcode = 'P0001'; end if;
  select count(*) > 1 into v_tied from public.chicago_player_hands
   where room_id = p_room and (public.chicago_evaluate(cards)).tiebreak = v_top;

  update public.chicago_player_hands set last_poker_hand_name = v_hand_name, last_poker_points = v_points where player_id = v_winner;
  if not v_tied and v_points > 0 then
    v_score := public.chicago_add_score(v_winner, v_points);
    if public.chicago_finish_if_won(p_room) then return; end if;
  end if;

  v_next := case when v_first then 'draw_phase_2' else 'draw_phase_3' end;
  update public.chicago_rounds set active_phase = v_next, draw_number = case when v_first then 2 else 3 end
   where id = (select id from public.chicago_rounds where room_id = p_room order by round_number desc limit 1);
  perform public.picklo_trust();
  update public.chicago_rooms
     set state = v_next, phase_number = phase_number + 1, phase_ends_at = null,
         public_message = case
           when v_tied then format('The %s poker scoring tied. No points were awarded.', case when v_first then 'first' else 'second' end)
           when v_points > 0 then format('%s wins the %s scoring with %s for %s point%s.', v_name,
             case when v_first then 'first' else 'second' end, v_label, v_points, case when v_points = 1 then '' else 's' end)
           else format('%s had the best high card in the %s scoring. No points were awarded.', v_name, case when v_first then 'first' else 'second' end)
         end
   where id = p_room;
end;
$$;

create or replace function public.chicago_declare(p_room uuid)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_room public.chicago_rooms%rowtype;
  v_me public.chicago_room_players%rowtype;
  v_round public.chicago_rounds%rowtype;
begin
  select * into v_room from public.chicago_rooms where id = p_room for update;
  select * into v_me from public.chicago_room_players where room_id = p_room and auth_user_id = auth.uid();
  if v_room.id is null or v_me.id is null then raise exception 'NOT_A_MEMBER' using errcode = '42501'; end if;
  if v_room.state <> 'trick_phase' then raise exception 'Chicago can only be declared in the trick phase' using errcode = 'P0001'; end if;
  if v_me.chicago_declared then raise exception 'You already declared Chicago this round' using errcode = 'P0001'; end if;
  select * into v_round from public.chicago_rounds where room_id = p_room order by round_number desc limit 1;
  if v_round.chicago_declared_by is not null then raise exception 'Chicago has already been claimed this round' using errcode = 'P0001'; end if;
  if exists (select 1 from public.chicago_cards_played c join public.chicago_tricks t on t.id = c.trick_id where t.round_id = v_round.id) then
    raise exception 'Chicago must be declared before the first card is played' using errcode = 'P0001';
  end if;

  update public.chicago_rounds set chicago_declared_by = v_me.id where id = v_round.id;
  perform public.picklo_trust();
  update public.chicago_room_players set chicago_declared = true where id = v_me.id;
  update public.chicago_rooms
     set lead_player_id = v_me.id, current_turn_player_id = v_me.id,
         public_message = v_me.display_name || ' declared CHICAGO and leads the first trick.'
   where id = p_room;
end;
$$;

create or replace function public.chicago_play_card(p_room uuid, p_card jsonb)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_room public.chicago_rooms%rowtype;
  v_me public.chicago_room_players%rowtype;
  v_round public.chicago_rounds%rowtype;
  v_trick public.chicago_tricks%rowtype;
  v_hand jsonb;
  v_card jsonb := jsonb_build_object('rank', p_card ->> 'rank', 'suit', p_card ->> 'suit');
  v_played integer;
  v_active uuid[];
  v_next uuid;
  v_winner uuid;
  v_final uuid;
  v_final_points integer;
  v_final_top integer[];
  v_final_tied boolean;
begin
  select * into v_room from public.chicago_rooms where id = p_room for update;
  select * into v_me from public.chicago_room_players where room_id = p_room and auth_user_id = auth.uid();
  if v_room.id is null or v_me.id is null then raise exception 'NOT_A_MEMBER' using errcode = '42501'; end if;
  select * into v_round from public.chicago_rounds where room_id = p_room order by round_number desc limit 1;
  if v_round.id is null then raise exception 'No active round' using errcode = 'P0001'; end if;
  if v_room.state <> 'trick_phase' then raise exception 'Trick phase is not active' using errcode = 'P0001'; end if;
  if v_room.current_turn_player_id is distinct from v_me.id then
    -- A double tap: the first tap already played this card and passed the turn on.
    if exists (select 1 from public.chicago_cards_played c join public.chicago_tricks t on t.id = c.trick_id
                where t.round_id = v_round.id and c.player_id = v_me.id and c.card = v_card) then
      return;
    end if;
    raise exception 'It is not your turn' using errcode = 'P0001';
  end if;

  select cards into v_hand from public.chicago_player_hands where player_id = v_me.id;
  if not exists (select 1 from jsonb_array_elements(v_hand) c where c = v_card) then
    raise exception 'That card is not in your hand' using errcode = 'P0001';
  end if;

  select * into v_trick from public.chicago_tricks where round_id = v_round.id and trick_number = v_round.trick_number;
  if v_trick.id is null then
    insert into public.chicago_tricks (round_id, trick_number) values (v_round.id, 1) returning * into v_trick;
  end if;
  select count(*) into v_played from public.chicago_cards_played where trick_id = v_trick.id;

  if v_trick.lead_suit is not null and v_card ->> 'suit' <> v_trick.lead_suit
     and exists (select 1 from jsonb_array_elements(v_hand) c where c ->> 'suit' = v_trick.lead_suit) then
    raise exception 'You must follow suit if possible' using errcode = 'P0001';
  end if;
  if v_round.chicago_declared_by is not null and v_round.chicago_declared_by <> v_me.id and v_round.trick_number <= 1 and v_played = 0 then
    raise exception 'It is not your turn' using errcode = 'P0001';
  end if;

  insert into public.chicago_cards_played (trick_id, player_id, card, play_order) values (v_trick.id, v_me.id, v_card, v_played + 1);
  update public.chicago_player_hands set cards = public.chicago_without(v_hand, jsonb_build_array(v_card)) where player_id = v_me.id;
  if v_trick.lead_suit is null then
    update public.chicago_tricks set lead_suit = v_card ->> 'suit' where id = v_trick.id returning * into v_trick;
  end if;

  perform public.picklo_trust();
  select array_agg(id order by seat_order) into v_active from public.chicago_room_players where room_id = p_room and status = 'active';
  if v_played + 1 < array_length(v_active, 1) then
    v_next := v_active[array_position(v_active, v_me.id) % array_length(v_active, 1) + 1];
    update public.chicago_rooms set current_turn_player_id = v_next where id = p_room;
    return;
  end if;

  -- Highest card in the led suit takes the trick.
  select c.player_id into v_winner from public.chicago_cards_played c
   where c.trick_id = v_trick.id and c.card ->> 'suit' = v_trick.lead_suit
   order by public.chicago_rank_value(c.card ->> 'rank') desc limit 1;
  update public.chicago_tricks set winner_player_id = v_winner where id = v_trick.id;

  if v_round.chicago_declared_by is not null and v_winner is distinct from v_round.chicago_declared_by then
    perform public.chicago_add_score(v_round.chicago_declared_by, -15);
    update public.chicago_rounds set chicago_failed = true, chicago_resolved = true where id = v_round.id;
    update public.chicago_rooms
       set state = 'result', current_turn_player_id = null, phase_number = phase_number + 1,
           public_message = 'Chicago failed. The round ends immediately and the caller loses 15 points.'
     where id = p_room;
    perform public.chicago_finish_if_won(p_room);
    return;
  end if;

  if v_round.trick_number >= 5 then
    if v_winner is not null then perform public.chicago_add_score(v_winner, 5); end if;
    if v_round.chicago_declared_by is not null and v_winner = v_round.chicago_declared_by then
      perform public.chicago_add_score(v_round.chicago_declared_by, 15);
    end if;

    -- Final poker on the five cards each player played; a tie scores nothing.
    with played as (
      select c.player_id, public.chicago_evaluate(jsonb_agg(c.card order by c.created_at)) e
        from public.chicago_cards_played c join public.chicago_tricks t on t.id = c.trick_id
       where t.round_id = v_round.id group by c.player_id
    )
    select player_id, (e).points, (e).tiebreak into v_final, v_final_points, v_final_top
      from played order by (e).tiebreak desc limit 1;
    select count(*) > 1 into v_final_tied from (
      select c.player_id from public.chicago_cards_played c join public.chicago_tricks t on t.id = c.trick_id
       where t.round_id = v_round.id group by c.player_id
      having (public.chicago_evaluate(jsonb_agg(c.card order by c.created_at))).tiebreak = v_final_top
    ) tied;
    if v_final is not null and not v_final_tied and v_final_points > 0 then
      perform public.chicago_add_score(v_final, v_final_points);
    end if;

    update public.chicago_rounds set last_trick_winner_player_id = v_winner where id = v_round.id;
    update public.chicago_rooms
       set state = 'result', current_turn_player_id = null, phase_number = phase_number + 1,
           public_message = 'Round complete. Review the scores and deal the next hand.'
     where id = p_room;
    perform public.chicago_finish_if_won(p_room);
    return;
  end if;

  insert into public.chicago_tricks (round_id, trick_number) values (v_round.id, v_round.trick_number + 1);
  update public.chicago_rounds set trick_number = v_round.trick_number + 1 where id = v_round.id;
  update public.chicago_rooms
     set current_turn_player_id = v_winner, lead_player_id = v_winner,
         public_message = format('Trick %s resolved. %s leads next.', v_round.trick_number,
           coalesce((select display_name from public.chicago_room_players where id = v_winner), 'A player'))
   where id = p_room;
end;
$$;

create or replace function public.chicago_reset_to_lobby(p_room uuid)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.picklo_is_room_host('public.chicago_room_players', 'public.chicago_rooms', p_room) then
    raise exception 'Only the host can do that' using errcode = '42501';
  end if;
  perform public.picklo_trust();
  update public.chicago_rooms
     set state = 'lobby', current_round = 0, dealer_player_id = null, lead_player_id = null, current_turn_player_id = null,
         winner_player_id = null, phase_ends_at = null, phase_number = phase_number + 1,
         public_message = 'Waiting for players to join Chicago.'
   where id = p_room;
  -- Hands, draws, decks, tricks and played cards cascade from the rounds.
  delete from public.chicago_rounds where room_id = p_room;
  update public.chicago_room_players
     set score = 0, status = 'active', draw_ready = false, trick_ready = false, chicago_declared = false
   where room_id = p_room;
end;
$$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'chicago_start_round(uuid)', 'chicago_submit_draw(uuid, jsonb)', 'chicago_score_poker(uuid)',
    'chicago_declare(uuid)', 'chicago_play_card(uuid, jsonb)', 'chicago_reset_to_lobby(uuid)'
  ] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end
$$;
