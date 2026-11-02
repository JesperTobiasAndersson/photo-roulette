-- Imposter and Mafia: the server deals roles, picks the secret word and resolves votes and
-- nights, so no phone ever needs to read another player's secret. This file only ADDS
-- functions, tables and a column; the phone-side access is locked down in the next
-- migration once the app uses these functions.
--
-- Functions that change who is out, who won or the secret word set picklo.trusted for the
-- rest of their transaction; the guard triggers in the next migration only accept those
-- changes from here.

-- ---------------------------------------------------------------------------
-- Shared helpers
-- ---------------------------------------------------------------------------
create or replace function public.picklo_trust()
returns void
language sql
as $$
  select set_config('picklo.trusted', 'on', true);
$$;

create or replace function public.picklo_is_trusted()
returns boolean
language sql stable
as $$
  select auth.uid() is null or coalesce(current_setting('picklo.trusted', true), '') = 'on';
$$;

create or replace function public.imposter_my_player(p_room uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select id from public.imposter_room_players where room_id = p_room and auth_user_id = auth.uid();
$$;

create or replace function public.mafia_my_player(p_room uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select id from public.mafia_room_players where room_id = p_room and auth_user_id = auth.uid();
$$;

-- ---------------------------------------------------------------------------
-- Imposter: word lists and the current word live where no phone can read them
-- ---------------------------------------------------------------------------
create table if not exists public.imposter_words (
  category_id text not null,
  prompt text not null,
  primary key (category_id, prompt)
);
alter table public.imposter_words enable row level security;

create table if not exists public.imposter_secrets (
  room_id uuid primary key references public.imposter_rooms(id) on delete cascade,
  prompt text not null
);
alter table public.imposter_secrets enable row level security;

-- Same lists as src/games/imposter/data.ts (IMPOSTER_CATEGORIES); keep the two in sync.
insert into public.imposter_words (category_id, prompt) values
  ('celebrities', 'Taylor Swift'),
  ('celebrities', 'Cristiano Ronaldo'),
  ('celebrities', 'Beyonce'),
  ('celebrities', 'Zendaya'),
  ('celebrities', 'Drake'),
  ('celebrities', 'Rihanna'),
  ('celebrities', 'Leonardo DiCaprio'),
  ('celebrities', 'Ariana Grande'),
  ('celebrities', 'Dwayne Johnson'),
  ('celebrities', 'Billie Eilish'),
  ('celebrities', 'Kim Kardashian'),
  ('celebrities', 'Tom Holland'),
  ('celebrities', 'Justin Bieber'),
  ('celebrities', 'Selena Gomez'),
  ('celebrities', 'Ed Sheeran'),
  ('celebrities', 'Lady Gaga'),
  ('celebrities', 'Bad Bunny'),
  ('celebrities', 'The Weeknd'),
  ('celebrities', 'Elon Musk'),
  ('celebrities', 'MrBeast'),
  ('celebrities', 'Harry Styles'),
  ('celebrities', 'Timothee Chalamet'),
  ('celebrities', 'Margot Robbie'),
  ('celebrities', 'Snoop Dogg'),
  ('celebrities', 'Zara Larsson'),
  ('celebrities', 'PewDiePie'),
  ('celebrities', 'Dua Lipa'),
  ('celebrities', 'Eminem'),
  ('celebrities', 'Sabrina Carpenter'),
  ('celebrities', 'Keanu Reeves'),
  ('football', 'Lionel Messi'),
  ('football', 'Kylian Mbappe'),
  ('football', 'Erling Haaland'),
  ('football', 'Jude Bellingham'),
  ('football', 'Vinicius Junior'),
  ('football', 'Kevin De Bruyne'),
  ('football', 'Harry Kane'),
  ('football', 'Mohamed Salah'),
  ('football', 'Lamine Yamal'),
  ('football', 'Bukayo Saka'),
  ('football', 'Pedri'),
  ('football', 'Robert Lewandowski'),
  ('football', 'Zlatan Ibrahimovic'),
  ('football', 'Alexander Isak'),
  ('football', 'Viktor Gyokeres'),
  ('football', 'Dejan Kulusevski'),
  ('football', 'Neymar'),
  ('football', 'Luka Modric'),
  ('football', 'Virgil van Dijk'),
  ('football', 'Son Heung-min'),
  ('football', 'Florian Wirtz'),
  ('football', 'Phil Foden'),
  ('football', 'Rodri'),
  ('football', 'Jamal Musiala'),
  ('football', 'Antoine Griezmann'),
  ('football', 'Thibaut Courtois'),
  ('football', 'Manuel Neuer'),
  ('football', 'Ousmane Dembele'),
  ('football', 'Achraf Hakimi'),
  ('football', 'Cole Palmer'),
  ('food', 'Pizza'),
  ('food', 'Burger'),
  ('food', 'Sushi'),
  ('food', 'Pasta'),
  ('food', 'Tacos'),
  ('food', 'Ice cream'),
  ('food', 'Pancakes'),
  ('food', 'Ramen'),
  ('food', 'Lasagna'),
  ('food', 'Chocolate cake'),
  ('food', 'French fries'),
  ('food', 'Fried chicken'),
  ('food', 'Hot dog'),
  ('food', 'Kebab'),
  ('food', 'Burrito'),
  ('food', 'Meatballs'),
  ('food', 'Waffles'),
  ('food', 'Cinnamon bun'),
  ('food', 'Popcorn'),
  ('food', 'Donut'),
  ('food', 'Croissant'),
  ('food', 'Falafel'),
  ('food', 'Nachos'),
  ('food', 'Dumplings'),
  ('food', 'Pad thai'),
  ('food', 'Omelette'),
  ('food', 'Sandwich'),
  ('food', 'Paella'),
  ('food', 'Apple pie'),
  ('food', 'Cotton candy'),
  ('movies', 'Titanic'),
  ('movies', 'The Dark Knight'),
  ('movies', 'Frozen'),
  ('movies', 'Interstellar'),
  ('movies', 'Barbie'),
  ('movies', 'Avatar'),
  ('movies', 'Shrek'),
  ('movies', 'Toy Story'),
  ('movies', 'The Lion King'),
  ('movies', 'Harry Potter'),
  ('movies', 'Gladiator'),
  ('movies', 'Finding Nemo'),
  ('movies', 'Star Wars'),
  ('movies', 'Jurassic Park'),
  ('movies', 'Avengers: Endgame'),
  ('movies', 'Spider-Man'),
  ('movies', 'Home Alone'),
  ('movies', 'The Matrix'),
  ('movies', 'Pirates of the Caribbean'),
  ('movies', 'Minions'),
  ('movies', 'Jaws'),
  ('movies', 'E.T.'),
  ('movies', 'Back to the Future'),
  ('movies', 'Up'),
  ('movies', 'Cars'),
  ('movies', 'Oppenheimer'),
  ('movies', 'The Hunger Games'),
  ('movies', 'Inside Out'),
  ('movies', 'Mamma Mia!'),
  ('movies', 'Moana'),
  ('countries', 'Brazil'),
  ('countries', 'Japan'),
  ('countries', 'Italy'),
  ('countries', 'Spain'),
  ('countries', 'Australia'),
  ('countries', 'Mexico'),
  ('countries', 'France'),
  ('countries', 'Norway'),
  ('countries', 'Egypt'),
  ('countries', 'Argentina'),
  ('countries', 'Thailand'),
  ('countries', 'Canada'),
  ('countries', 'Sweden'),
  ('countries', 'Germany'),
  ('countries', 'United States'),
  ('countries', 'United Kingdom'),
  ('countries', 'China'),
  ('countries', 'India'),
  ('countries', 'Greece'),
  ('countries', 'Turkey'),
  ('countries', 'Netherlands'),
  ('countries', 'Portugal'),
  ('countries', 'Iceland'),
  ('countries', 'Finland'),
  ('countries', 'Denmark'),
  ('countries', 'South Korea'),
  ('countries', 'Morocco'),
  ('countries', 'South Africa'),
  ('countries', 'Jamaica'),
  ('countries', 'Switzerland'),
  ('animals', 'Dog'),
  ('animals', 'Cat'),
  ('animals', 'Horse'),
  ('animals', 'Lion'),
  ('animals', 'Tiger'),
  ('animals', 'Elephant'),
  ('animals', 'Giraffe'),
  ('animals', 'Zebra'),
  ('animals', 'Gorilla'),
  ('animals', 'Kangaroo'),
  ('animals', 'Panda'),
  ('animals', 'Polar bear'),
  ('animals', 'Penguin'),
  ('animals', 'Shark'),
  ('animals', 'Dolphin'),
  ('animals', 'Octopus'),
  ('animals', 'Crocodile'),
  ('animals', 'Snake'),
  ('animals', 'Frog'),
  ('animals', 'Owl'),
  ('animals', 'Flamingo'),
  ('animals', 'Moose'),
  ('animals', 'Hedgehog'),
  ('animals', 'Squirrel'),
  ('animals', 'Butterfly'),
  ('sports', 'Football'),
  ('sports', 'Ice hockey'),
  ('sports', 'Basketball'),
  ('sports', 'Tennis'),
  ('sports', 'Golf'),
  ('sports', 'Swimming'),
  ('sports', 'Skiing'),
  ('sports', 'Boxing'),
  ('sports', 'Handball'),
  ('sports', 'Volleyball'),
  ('sports', 'Floorball'),
  ('sports', 'Padel'),
  ('sports', 'Table tennis'),
  ('sports', 'Cycling'),
  ('sports', 'Figure skating'),
  ('sports', 'Surfing'),
  ('sports', 'Skateboarding'),
  ('sports', 'Horse riding'),
  ('sports', 'Bowling'),
  ('sports', 'Badminton'),
  ('sports', 'Baseball'),
  ('sports', 'American football'),
  ('sports', 'Formula One'),
  ('sports', 'Gymnastics'),
  ('sports', 'Darts'),
  ('jobs', 'Firefighter'),
  ('jobs', 'Police officer'),
  ('jobs', 'Doctor'),
  ('jobs', 'Nurse'),
  ('jobs', 'Teacher'),
  ('jobs', 'Chef'),
  ('jobs', 'Pilot'),
  ('jobs', 'Astronaut'),
  ('jobs', 'Farmer'),
  ('jobs', 'Dentist'),
  ('jobs', 'Hairdresser'),
  ('jobs', 'Mechanic'),
  ('jobs', 'Carpenter'),
  ('jobs', 'Plumber'),
  ('jobs', 'Electrician'),
  ('jobs', 'Veterinarian'),
  ('jobs', 'Photographer'),
  ('jobs', 'Waiter'),
  ('jobs', 'Bus driver'),
  ('jobs', 'Mail carrier'),
  ('jobs', 'Soldier'),
  ('jobs', 'Baker'),
  ('jobs', 'Lifeguard'),
  ('jobs', 'Garbage collector'),
  ('jobs', 'Architect'),
  ('landmarks', 'Eiffel Tower'),
  ('landmarks', 'Statue of Liberty'),
  ('landmarks', 'Great Wall of China'),
  ('landmarks', 'Pyramids of Giza'),
  ('landmarks', 'Colosseum'),
  ('landmarks', 'Big Ben'),
  ('landmarks', 'Taj Mahal'),
  ('landmarks', 'Leaning Tower of Pisa'),
  ('landmarks', 'Sydney Opera House'),
  ('landmarks', 'Christ the Redeemer'),
  ('landmarks', 'Machu Picchu'),
  ('landmarks', 'Stonehenge'),
  ('landmarks', 'Golden Gate Bridge'),
  ('landmarks', 'Mount Rushmore'),
  ('landmarks', 'Burj Khalifa'),
  ('landmarks', 'Sagrada Familia'),
  ('landmarks', 'Niagara Falls'),
  ('landmarks', 'Mount Everest'),
  ('landmarks', 'Hollywood Sign'),
  ('landmarks', 'Acropolis'),
  ('landmarks', 'Brandenburg Gate'),
  ('landmarks', 'Empire State Building'),
  ('landmarks', 'Neuschwanstein Castle'),
  ('landmarks', 'Mount Fuji'),
  ('landmarks', 'Turning Torso'),
  ('swedes', 'Greta Thunberg'),
  ('swedes', 'Avicii'),
  ('swedes', 'Armand Duplantis'),
  ('swedes', 'Loreen'),
  ('swedes', 'Mans Zelmerlow'),
  ('swedes', 'Tove Lo'),
  ('swedes', 'Robyn'),
  ('swedes', 'Benjamin Ingrosso'),
  ('swedes', 'Molly Sanden'),
  ('swedes', 'Felix Sandman'),
  ('swedes', 'Veronica Maggio'),
  ('swedes', 'Yung Lean'),
  ('swedes', 'Carola'),
  ('swedes', 'Pernilla Wahlgren'),
  ('swedes', 'Henrik Lundqvist'),
  ('swedes', 'Peter Forsberg'),
  ('swedes', 'Sarah Sjostrom'),
  ('swedes', 'Bjorn Borg'),
  ('swedes', 'Alicia Vikander'),
  ('swedes', 'Alexander Skarsgard'),
  ('swedes', 'Mikael Persbrandt'),
  ('swedes', 'King Carl XVI Gustaf'),
  ('swedes', 'Crown Princess Victoria'),
  ('swedes', 'Astrid Lindgren'),
  ('swedes', 'Ingvar Kamprad')
on conflict do nothing;

-- Words dealt before this migration move to the private table.
insert into public.imposter_secrets (room_id, prompt)
select id, secret_prompt from public.imposter_rooms where secret_prompt is not null
on conflict (room_id) do nothing;

create or replace function public.imposter_start_game(p_room uuid)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_room public.imposter_rooms%rowtype;
  v_previous text;
  v_word text;
  v_imposter uuid;
begin
  select * into v_room from public.imposter_rooms where id = p_room for update;
  if not found then raise exception 'ROOM_NOT_FOUND' using errcode = 'P0002'; end if;
  if not public.picklo_is_room_host('public.imposter_room_players', 'public.imposter_rooms', p_room) then
    raise exception 'Only the host can do that' using errcode = '42501';
  end if;
  if (select count(*) from public.imposter_room_players where room_id = p_room) < 3 then
    raise exception 'At least 3 players are required' using errcode = 'P0001';
  end if;

  -- Never the same word twice in a row.
  select prompt into v_previous from public.imposter_secrets where room_id = p_room;
  select prompt into v_word from public.imposter_words
   where category_id = v_room.category_id and prompt is distinct from v_previous
   order by random() limit 1;
  if v_word is null then
    select prompt into v_word from public.imposter_words where category_id = v_room.category_id order by random() limit 1;
  end if;
  if v_word is null then raise exception 'Choose a category first' using errcode = 'P0001'; end if;

  select id into v_imposter from public.imposter_room_players where room_id = p_room order by random() limit 1;

  delete from public.imposter_player_roles where room_id = p_room;
  delete from public.imposter_votes where room_id = p_room;
  insert into public.imposter_player_roles (player_id, room_id, role, prompt)
  select id, p_room,
         case when id = v_imposter then 'imposter' else 'crew' end::public.imposter_role,
         case when id = v_imposter then null else v_word end
    from public.imposter_room_players where room_id = p_room;
  insert into public.imposter_secrets (room_id, prompt) values (p_room, v_word)
  on conflict (room_id) do update set prompt = excluded.prompt;

  perform public.picklo_trust();
  update public.imposter_room_players
     set status = 'alive', role_reveal_ready = false, discussion_ready = false
   where room_id = p_room;
  update public.imposter_rooms
     set state = 'role_reveal', secret_prompt = null, phase_number = phase_number + 1,
         phase_ends_at = null, winner = null, public_message = 'Roles assigned. Reveal your card privately.'
   where id = p_room;
end;
$$;

create or replace function public.imposter_resolve_voting(p_room uuid)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_room public.imposter_rooms%rowtype;
  v_imposter uuid;
  v_out uuid;
  v_top integer;
  v_second integer;
  v_alive integer;
  v_winner public.imposter_winner;
begin
  select * into v_room from public.imposter_rooms where id = p_room for update;
  if not found then raise exception 'ROOM_NOT_FOUND' using errcode = 'P0002'; end if;
  if not public.picklo_is_room_host('public.imposter_room_players', 'public.imposter_rooms', p_room) then
    raise exception 'Only the host can do that' using errcode = '42501';
  end if;
  if v_room.state <> 'voting' then raise exception 'Voting is not active' using errcode = 'P0001'; end if;

  select player_id into v_imposter from public.imposter_player_roles where room_id = p_room and role = 'imposter';

  -- The player with the most votes is out; a tie (or no votes) puts nobody out.
  select target_player_id, n into v_out, v_top from (
    select target_player_id, count(*)::int n from public.imposter_votes
     where room_id = p_room and phase_number = v_room.phase_number group by target_player_id
  ) t order by n desc limit 1;
  select n into v_second from (
    select count(*)::int n from public.imposter_votes
     where room_id = p_room and phase_number = v_room.phase_number group by target_player_id
  ) t order by n desc offset 1 limit 1;
  if v_second is not null and v_second = v_top then v_out := null; end if;

  perform public.picklo_trust();
  if v_out is not null then
    update public.imposter_room_players set status = 'eliminated' where id = v_out and room_id = p_room;
  end if;

  select count(*) into v_alive from public.imposter_room_players where room_id = p_room and status = 'alive';
  if v_imposter is null or v_out = v_imposter then
    v_winner := 'crew';
  elsif v_alive <= 2 then
    v_winner := 'imposter';
  end if;

  if v_winner is not null then
    update public.imposter_rooms
       set state = 'ended', winner = v_winner, phase_number = phase_number + 1, phase_ends_at = null,
           secret_prompt = (select prompt from public.imposter_secrets where room_id = p_room),
           public_message = case when v_winner = 'crew' then 'The group found the imposter.'
                                 else 'Only two players remain. The imposter takes the win.' end
     where id = p_room;
    return;
  end if;

  update public.imposter_room_players set discussion_ready = false where room_id = p_room and status = 'alive';
  update public.imposter_rooms
     set state = 'discussion', winner = null, phase_number = phase_number + 1, phase_ends_at = now() + interval '240 seconds',
         public_message = case when v_out is not null then 'The group voted out the wrong player. The game continues.'
                               else 'Nobody was eliminated. Keep discussing.' end
   where id = p_room;
end;
$$;

create or replace function public.imposter_return_to_lobby(p_room uuid)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.picklo_is_room_host('public.imposter_room_players', 'public.imposter_rooms', p_room) then
    raise exception 'Only the host can do that' using errcode = '42501';
  end if;
  perform public.picklo_trust();
  update public.imposter_rooms
     set state = 'lobby', winner = null, phase_ends_at = null, phase_number = phase_number + 1,
         secret_prompt = null, public_message = 'Waiting for players to join.'
   where id = p_room;
  update public.imposter_room_players
     set status = 'alive', role_reveal_ready = false, discussion_ready = false
   where room_id = p_room;
  delete from public.imposter_player_roles where room_id = p_room;
  delete from public.imposter_votes where room_id = p_room;
end;
$$;

-- ---------------------------------------------------------------------------
-- Mafia
-- ---------------------------------------------------------------------------
-- Public "has confirmed tonight" flag: villagers confirm a dummy action too, so it says
-- nothing about roles, and phones no longer need to read each other's night actions.
alter table public.mafia_room_players add column if not exists night_action_confirmed boolean not null default false;

create or replace function public.mafia_winner(p_room uuid) returns text
language sql stable security definer set search_path = '' as $$
  select case
    when count(*) filter (where role = 'mafia') = 0 then 'village'
    when count(*) filter (where role = 'mafia') >= count(*) filter (where role <> 'mafia') then 'mafia'
  end
  from public.mafia_player_roles where room_id = p_room and is_alive;
$$;

create or replace function public.mafia_eliminate(p_room uuid, p_player uuid)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.picklo_trust();
  update public.mafia_player_roles set is_alive = false where player_id = p_player and room_id = p_room;
  update public.mafia_room_players set status = 'eliminated' where id = p_player and room_id = p_room;
end;
$$;
revoke execute on function public.mafia_eliminate(uuid, uuid) from public, anon, authenticated;

create or replace function public.mafia_start_game(p_room uuid)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_room public.mafia_rooms%rowtype;
  v_ids uuid[];
  v_count integer;
  v_mafia integer;
  v_prev_host_role public.mafia_role;
  v_try integer := 0;
begin
  select * into v_room from public.mafia_rooms where id = p_room for update;
  if not found then raise exception 'ROOM_NOT_FOUND' using errcode = 'P0002'; end if;
  if not public.picklo_is_room_host('public.mafia_room_players', 'public.mafia_rooms', p_room) then
    raise exception 'Only the host can do that' using errcode = '42501';
  end if;
  select count(*) into v_count from public.mafia_room_players where room_id = p_room;
  if v_count < 4 then raise exception 'At least 4 players are required' using errcode = 'P0001'; end if;
  v_mafia := case when v_count >= 7 then 2 else 1 end;

  -- Shuffled seats: the first v_mafia are mafia, then doctor, police, villagers. A host who was
  -- mafia last game gets a few re-deals to avoid being mafia twice in a row.
  select role into v_prev_host_role from public.mafia_player_roles where player_id = v_room.host_player_id;
  loop
    select array_agg(id order by random()) into v_ids from public.mafia_room_players where room_id = p_room;
    v_try := v_try + 1;
    exit when v_prev_host_role is distinct from 'mafia' or v_count <= 4 or v_try >= 8
           or not (v_room.host_player_id = any (v_ids[1:v_mafia]));
  end loop;

  delete from public.mafia_player_roles where room_id = p_room;
  delete from public.mafia_night_actions where room_id = p_room;
  delete from public.mafia_day_votes where room_id = p_room;
  delete from public.mafia_police_reports where room_id = p_room;
  delete from public.mafia_game_events where room_id = p_room;
  insert into public.mafia_player_roles (player_id, room_id, role, is_alive)
  select v_ids[i], p_room,
         case when i <= v_mafia then 'mafia' when i = v_mafia + 1 then 'doctor' when i = v_mafia + 2 then 'police' else 'villager' end::public.mafia_role,
         true
    from generate_subscripts(v_ids, 1) i;

  perform public.picklo_trust();
  update public.mafia_rooms
     set state = 'role_reveal', phase_number = 1, winner = null, phase_ends_at = now() + interval '12 seconds',
         public_message = 'Roles assigned. Reveal your role privately.'
   where id = p_room;
  update public.mafia_room_players
     set status = 'alive', role_reveal_ready = false, discussion_ready = false, night_action_confirmed = false
   where room_id = p_room;
end;
$$;

create or replace function public.mafia_submit_night_action(p_room uuid, p_target uuid, p_confirm boolean)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_room public.mafia_rooms%rowtype;
  v_me uuid := public.mafia_my_player(p_room);
  v_role public.mafia_player_roles%rowtype;
  v_confirmed boolean;
begin
  select * into v_room from public.mafia_rooms where id = p_room;
  if not found or v_me is null then raise exception 'NOT_A_MEMBER' using errcode = '42501'; end if;
  if v_room.state <> 'night' then raise exception 'Night actions are closed' using errcode = 'P0001'; end if;
  select * into v_role from public.mafia_player_roles where player_id = v_me;
  if not found or not v_role.is_alive then raise exception 'Only living players can act' using errcode = 'P0001'; end if;
  if v_role.role <> 'villager' and p_target is null then raise exception 'Choose a target first' using errcode = 'P0001'; end if;
  if p_target is not null and not exists (
    select 1 from public.mafia_room_players where id = p_target and room_id = p_room and status = 'alive'
  ) then
    raise exception 'Choose a living player' using errcode = 'P0001';
  end if;

  v_confirmed := v_role.role = 'villager' or coalesce(p_confirm, false);
  insert into public.mafia_night_actions (room_id, phase_number, actor_player_id, actor_role, target_player_id, fake_ready, confirmed)
  values (p_room, v_room.phase_number, v_me, v_role.role, p_target, v_role.role = 'villager', v_confirmed)
  on conflict (room_id, phase_number, actor_player_id) do update
    set target_player_id = excluded.target_player_id, confirmed = excluded.confirmed, locked_at = null;
  update public.mafia_room_players set discussion_ready = false, night_action_confirmed = v_confirmed where id = v_me;

  -- All mafia confirmed on the same target: lock it in.
  if v_role.role = 'mafia' and not exists (
    select 1 from public.mafia_night_actions
     where room_id = p_room and phase_number = v_room.phase_number and actor_role = 'mafia' and not confirmed
  ) and (
    select count(distinct target_player_id) from public.mafia_night_actions
     where room_id = p_room and phase_number = v_room.phase_number and actor_role = 'mafia'
  ) = 1 then
    update public.mafia_night_actions set locked_at = now()
     where room_id = p_room and phase_number = v_room.phase_number and actor_role = 'mafia';
  end if;
end;
$$;

create or replace function public.mafia_resolve_night(p_room uuid)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_room public.mafia_rooms%rowtype;
  v_phase integer;
  v_kill uuid;
  v_top integer;
  v_second integer;
  v_targets integer;
  v_all_confirmed boolean;
  v_doctor_target uuid;
  v_police uuid;
  v_police_target uuid;
  v_out uuid;
  v_saved uuid;
  v_winner text;
  v_summary text;
begin
  select * into v_room from public.mafia_rooms where id = p_room for update;
  if not found then raise exception 'ROOM_NOT_FOUND' using errcode = 'P0002'; end if;
  if not public.picklo_is_room_host('public.mafia_room_players', 'public.mafia_rooms', p_room) then
    raise exception 'Only the host can do that' using errcode = '42501';
  end if;
  if v_room.state <> 'night' then raise exception 'Night is not active' using errcode = 'P0001'; end if;
  v_phase := v_room.phase_number;

  -- Mafia target (same rules as resolveNightActions in src/games/mafia/logic.ts): a confirmed,
  -- unanimous pick; otherwise the only target; otherwise a clear majority; otherwise nobody.
  select count(distinct target_player_id), bool_and(confirmed) into v_targets, v_all_confirmed
    from public.mafia_night_actions
   where room_id = p_room and phase_number = v_phase and actor_role = 'mafia' and target_player_id is not null;
  select target_player_id, n into v_kill, v_top from (
    select target_player_id, count(*)::int n from public.mafia_night_actions
     where room_id = p_room and phase_number = v_phase and actor_role = 'mafia' and target_player_id is not null
     group by target_player_id
  ) t order by n desc limit 1;
  select n into v_second from (
    select count(*)::int n from public.mafia_night_actions
     where room_id = p_room and phase_number = v_phase and actor_role = 'mafia' and target_player_id is not null
     group by target_player_id
  ) t order by n desc offset 1 limit 1;
  if v_targets > 1 and v_second = v_top then v_kill := null; end if;

  select target_player_id into v_doctor_target from public.mafia_night_actions
   where room_id = p_room and phase_number = v_phase and actor_role = 'doctor' limit 1;
  if v_kill is not null and v_kill = v_doctor_target then v_saved := v_kill; else v_out := v_kill; end if;

  select actor_player_id, target_player_id into v_police, v_police_target from public.mafia_night_actions
   where room_id = p_room and phase_number = v_phase and actor_role = 'police' limit 1;
  if v_police_target is not null then
    insert into public.mafia_police_reports (room_id, phase_number, police_player_id, target_player_id, result_alignment)
    select p_room, v_phase, v_police, v_police_target,
           case when role = 'mafia' then 'mafia' else 'village' end
      from public.mafia_player_roles where player_id = v_police_target
    on conflict (room_id, phase_number, police_player_id) do update
      set target_player_id = excluded.target_player_id, result_alignment = excluded.result_alignment;
  end if;

  if v_out is not null then perform public.mafia_eliminate(p_room, v_out); end if;
  v_winner := public.mafia_winner(p_room);
  v_summary := case when v_out is not null then 'Someone was eliminated during the night.' else 'Nobody was eliminated during the night.' end;

  insert into public.mafia_game_events (room_id, phase_number, phase, visible_to, event_type, payload)
  values (p_room, v_phase, 'night_result', 'all', 'night_result', jsonb_build_object(
    'summary', v_summary, 'eliminatedPlayerId', v_out, 'doctorSaved', v_saved is not null, 'doctorSavedPlayerId', v_saved));

  perform public.picklo_trust();
  update public.mafia_rooms
     set state = case when v_winner is not null then 'ended' else 'night_result' end::public.mafia_phase,
         winner = v_winner, phase_number = phase_number + 1, public_message = v_summary,
         phase_ends_at = case when v_winner is not null then null else now() + interval '10 seconds' end
   where id = p_room;
end;
$$;

create or replace function public.mafia_resolve_day_vote(p_room uuid)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_room public.mafia_rooms%rowtype;
  v_out uuid;
  v_top integer;
  v_second integer;
  v_winner text;
  v_summary text;
begin
  select * into v_room from public.mafia_rooms where id = p_room for update;
  if not found then raise exception 'ROOM_NOT_FOUND' using errcode = 'P0002'; end if;
  if not public.picklo_is_room_host('public.mafia_room_players', 'public.mafia_rooms', p_room) then
    raise exception 'Only the host can do that' using errcode = '42501';
  end if;
  if v_room.state <> 'day_voting' then raise exception 'Voting is not active' using errcode = 'P0001'; end if;

  select target_player_id, n into v_out, v_top from (
    select target_player_id, count(*)::int n from public.mafia_day_votes
     where room_id = p_room and phase_number = v_room.phase_number group by target_player_id
  ) t order by n desc limit 1;
  select n into v_second from (
    select count(*)::int n from public.mafia_day_votes
     where room_id = p_room and phase_number = v_room.phase_number group by target_player_id
  ) t order by n desc offset 1 limit 1;

  if v_out is null then
    v_summary := 'No votes were cast.';
  elsif v_second = v_top then
    v_out := null;
    v_summary := 'The vote tied. Nobody was eliminated.';
  else
    v_summary := 'The village eliminated a player.';
    perform public.mafia_eliminate(p_room, v_out);
  end if;
  v_winner := public.mafia_winner(p_room);

  insert into public.mafia_game_events (room_id, phase_number, phase, visible_to, event_type, payload)
  values (p_room, v_room.phase_number, 'vote_result', 'all', 'vote_result',
          jsonb_build_object('summary', v_summary, 'eliminatedPlayerId', v_out));

  perform public.picklo_trust();
  update public.mafia_rooms
     set state = case when v_winner is not null then 'ended' else 'vote_result' end::public.mafia_phase,
         winner = v_winner, phase_number = phase_number + 1, public_message = v_summary,
         phase_ends_at = case when v_winner is not null then null else now() + interval '10 seconds' end
   where id = p_room;
end;
$$;

create or replace function public.mafia_return_to_lobby(p_room uuid)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.picklo_is_room_host('public.mafia_room_players', 'public.mafia_rooms', p_room) then
    raise exception 'Only the host can do that' using errcode = '42501';
  end if;
  perform public.picklo_trust();
  update public.mafia_rooms
     set state = 'lobby', phase_number = 0, winner = null, phase_ends_at = null, public_message = 'Waiting for players.'
   where id = p_room;
  update public.mafia_room_players
     set status = 'alive', role_reveal_ready = false, discussion_ready = false, night_action_confirmed = false
   where room_id = p_room;
end;
$$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'imposter_start_game(uuid)', 'imposter_resolve_voting(uuid)', 'imposter_return_to_lobby(uuid)',
    'mafia_start_game(uuid)', 'mafia_submit_night_action(uuid, uuid, boolean)', 'mafia_resolve_night(uuid)',
    'mafia_resolve_day_vote(uuid)', 'mafia_return_to_lobby(uuid)'
  ] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end
$$;
