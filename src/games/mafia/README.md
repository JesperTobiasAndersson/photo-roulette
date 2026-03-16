Mafia game module

Files:
- `config.ts`: metadata for the game card and route.
- `types.ts`: frontend enums and DTOs.
- `logic.ts`: UI text plus role assignment and resolution helpers.
- `api.ts`: direct Supabase room and game actions.
- `useMafiaRoom.ts`: realtime room state hook.
- `schema.sql`: Supabase schema for rooms, roles, actions, votes, and events.
- `SUPABASE_SETUP.md`: database and realtime setup steps.

Frontend routes:
- `/mafia`
- `/mafia-lobby`
- `/mafia-game`
- `/mafia-results`

Supabase backend:
- SQL tables with open-access policies for the current no-login version
- Direct client writes for room creation, actions, and resolution
- Realtime subscriptions for phase changes and mafia coordination
