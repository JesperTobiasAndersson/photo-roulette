-- MemeMatch "Play again": the host restarts with the same players in the same room.
-- Rounds, submissions, votes and scores are cleared; everyone keeps their photos
-- (their used-in-round markers reset automatically) and can swap some before the
-- next game. Everyone's screen follows the room's phase change to "picking".
create or replace function public.memematch_play_again(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.rooms r
    join public.players p on p.id = r.host_player_id
    where r.id = p_room_id and p.auth_user_id = auth.uid()
  ) then
    raise exception 'ONLY_HOST' using errcode = '42501';
  end if;

  -- Submissions and votes cascade; player_images.used_in_round_id is set to null.
  delete from public.rounds where room_id = p_room_id;
  delete from public.room_scores where room_id = p_room_id;
  update public.rooms set phase = 'picking', expected_players = null where id = p_room_id;
end;
$$;

revoke execute on function public.memematch_play_again(uuid) from public, anon;
grant execute on function public.memematch_play_again(uuid) to authenticated;
