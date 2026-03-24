alter table public.rooms
add column if not exists statement_category text default 'innocent';

update public.rooms
set statement_category = 'innocent'
where statement_category is null;
