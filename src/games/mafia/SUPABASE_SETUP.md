1. Run `src/games/mafia/schema.sql` in the Supabase SQL editor.
2. Add these tables to Realtime:
   - `mafia_rooms`
   - `mafia_room_players`
   - `mafia_player_roles`
   - `mafia_night_actions`
   - `mafia_police_reports`
   - `mafia_day_votes`
   - `mafia_game_events`
3. Reload the app and create a room from the Mafia game screen.
4. Open the same room on another device or browser tab with the room code to test realtime updates.

Notes:
- Mafia now works like MemeMatch: the app writes directly to the Mafia tables and uses Realtime for updates.
- No Edge Functions or Supabase CLI deployment is required for this version.
- Hidden information is separated in the UI, not fully locked down at the database level.
- If you created the schema from an older auth-based version, run:
  `alter table public.mafia_rooms alter column created_by drop not null;`
- If you created the schema before discussion voting readiness was added, run:
  `alter table public.mafia_room_players add column if not exists discussion_ready boolean not null default false;`
