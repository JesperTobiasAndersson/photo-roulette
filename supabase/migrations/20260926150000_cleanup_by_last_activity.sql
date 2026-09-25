-- Rooms can now be replayed ("play again"), so expire them 24h after their last
-- activity instead of 24h after they were created.
create or replace function public.picklo_expired_memematch_rooms(p_max_age interval default interval '24 hours')
returns setof uuid
language sql stable security definer set search_path = '' as $$
  select id from public.rooms where greatest(created_at, updated_at) < now() - p_max_age;
$$;

create or replace function public.picklo_cleanup(p_max_age interval default interval '24 hours')
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_result jsonb := '{}'::jsonb;
  v_count integer;
  t text;
begin
  foreach t in array array['rooms', 'mafia_rooms', 'imposter_rooms', 'chicago_rooms', 'music_quiz_rooms', 'trivia_rooms'] loop
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

revoke execute on function public.picklo_expired_memematch_rooms(interval) from public, anon, authenticated;
revoke execute on function public.picklo_cleanup(interval) from public, anon, authenticated;
grant execute on function public.picklo_expired_memematch_rooms(interval) to service_role;
grant execute on function public.picklo_cleanup(interval) to service_role;
