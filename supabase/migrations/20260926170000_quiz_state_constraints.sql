-- The production database was created before some quiz states/options existed, and
-- `create table if not exists` never updated its CHECK constraints. Finishing a Music
-- Quiz match ("completed") was rejected as a result. Bring the rules in line with the app.
alter table public.music_quiz_rooms drop constraint if exists music_quiz_rooms_state_check;
alter table public.music_quiz_rooms
  add constraint music_quiz_rooms_state_check check (state in ('lobby', 'question', 'reveal', 'completed'));

alter table public.music_quiz_rooms drop constraint if exists music_quiz_rooms_selected_pool_check;
alter table public.music_quiz_rooms
  add constraint music_quiz_rooms_selected_pool_check check (selected_pool is null or selected_pool in ('hits', 'classics', 'mix'));

alter table public.trivia_rooms drop constraint if exists trivia_rooms_state_check;
alter table public.trivia_rooms
  add constraint trivia_rooms_state_check check (state in ('lobby', 'question', 'reveal', 'completed'));
