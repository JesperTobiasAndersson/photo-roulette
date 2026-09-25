Mafia game module

Files:
- `config.ts`: metadata for the game card and route.
- `types.ts`: frontend enums and DTOs.
- `logic.ts`: UI text plus role assignment and resolution helpers.
- `api.ts`: direct Supabase room and game actions.
- `useMafiaRoom.ts`: realtime room state hook.
- Database schema and access rules: `supabase/migrations/` (see `SETUP.md` in the repo root).

Frontend routes:
- `/mafia`
- `/mafia-lobby`
- `/mafia-game`
- `/mafia-results`

Supabase backend:
- SQL tables locked to room members (anonymous Supabase auth identifies each device)
- Direct client writes for room creation, actions, and resolution
- Realtime subscriptions for phase changes and mafia coordination
