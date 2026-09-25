-- The production database had an (unversioned) trigger that refused ANY change to
-- player_images.used_in_round_id once set ("This image is already locked to a round…").
-- That also blocked MemeMatch "play again", which unlocks everyone's photos.
-- Replace it with a rule that still prevents moving a used photo to another round,
-- but allows unlocking (setting it back to null).
do $$
declare
  trg record;
begin
  for trg in
    select t.tgname
    from pg_trigger t
    join pg_proc p on p.oid = t.tgfoid
    where t.tgrelid = 'public.player_images'::regclass
      and not t.tgisinternal
      and p.prosrc ilike '%locked%'
  loop
    execute format('drop trigger if exists %I on public.player_images', trg.tgname);
  end loop;
end
$$;

create or replace function public.player_images_keep_round_lock()
returns trigger
language plpgsql
as $$
begin
  if old.used_in_round_id is not null
     and new.used_in_round_id is not null
     and new.used_in_round_id is distinct from old.used_in_round_id then
    raise exception 'This image is already locked to a round and cannot be changed.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists player_images_keep_round_lock on public.player_images;
create trigger player_images_keep_round_lock
before update of used_in_round_id on public.player_images
for each row execute function public.player_images_keep_round_lock();
