Run the SQL in `src/games/mafia/schema.sql` inside the Supabase SQL editor.

After that:
1. Open `Database` -> `Replication`.
2. Make sure these tables are included in realtime:
   `mafia_rooms`
   `mafia_players`
   `mafia_actions`
3. Keep your existing `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
4. No storage bucket is needed for Mafia right now.

Notes:
- This setup uses open RLS policies because the app currently works without Supabase auth.
- Mafia is intentionally separate from MemeMatch, so do not reuse the MemeMatch tables for it.
- If you want stricter security later, we can move Mafia to authenticated users and tighten the policies.
