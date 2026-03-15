Mafia game module

Files:
- `config.ts`: metadata for the game card and route.
- `types.ts`: typed models for rooms, players, and actions.
- `logic.ts`: role assignment and round resolution helpers.
- `schema.sql`: Supabase tables, indexes, triggers, and policies.
- `SUPABASE_SETUP.md`: short setup steps for Supabase.

This module is separate from MemeMatch on purpose.
Frontend routes:
- `/mafia`
- `/mafia-lobby`
- `/mafia-game`
- `/mafia-results`

Backend tables:
- `mafia_rooms`
- `mafia_players`
- `mafia_actions`
