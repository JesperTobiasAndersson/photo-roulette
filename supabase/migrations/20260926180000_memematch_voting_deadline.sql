-- MemeMatch voting fixes found by the end-to-end tests:
-- 1. Voting had no deadline: one player whose phone locked could freeze the round forever.
--    Switching to voting now sets ends_at = now() + 45s, and the round finishes when
--    everyone has voted OR the deadline has passed.
-- 2. Only players who played a photo in the round may vote, and only their votes count.

create or replace function public.memematch_played_in_round(p_round uuid, p_player uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.submissions where round_id = p_round and player_id = p_player);
$$;

drop policy if exists "vote as self" on public.votes;
create policy "vote as self" on public.votes for insert to authenticated
  with check (public.memematch_is_my_player(voter_player_id)
    and public.memematch_submission_owner(submission_id) <> voter_player_id
    and public.memematch_played_in_round(round_id, voter_player_id)
    and public.memematch_is_member(public.memematch_round_room(round_id)));

create or replace function public.advance_round_if_ready(p_round_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_round public.rounds%rowtype;
  v_expected integer;
  v_players integer;
  v_subs integer;
  v_votes integer;
begin
  select * into v_round from public.rounds where id = p_round_id for update;
  if not found then return 'missing'; end if;
  if not public.memematch_is_member(v_round.room_id) then
    raise exception 'NOT_A_MEMBER' using errcode = '42501';
  end if;

  select count(*) into v_players from public.players where room_id = v_round.room_id;
  select least(coalesce(expected_players, v_players), v_players) into v_expected
  from public.rooms where id = v_round.room_id;
  select count(*) into v_subs from public.submissions where round_id = p_round_id;

  if v_round.status = 'collecting' then
    if v_subs >= greatest(v_expected, 2)
       or (v_round.ends_at is not null and now() > v_round.ends_at and v_subs >= 2) then
      update public.rounds set status = 'voting', ends_at = now() + interval '45 seconds' where id = p_round_id;
      return 'voting';
    end if;
  elsif v_round.status = 'voting' then
    -- Only votes from players who played a photo this round count.
    select count(*) into v_votes
    from public.votes v
    where v.round_id = p_round_id
      and exists (select 1 from public.submissions s where s.round_id = p_round_id and s.player_id = v.voter_player_id);
    if v_votes >= v_subs or (v_round.ends_at is not null and now() > v_round.ends_at) then
      perform public.finalize_round(p_round_id);
      update public.rounds set status = 'done' where id = p_round_id;
      return 'done';
    end if;
  end if;

  return v_round.status;
end;
$$;

revoke execute on function public.advance_round_if_ready(uuid) from public, anon;
grant execute on function public.advance_round_if_ready(uuid) to authenticated;
