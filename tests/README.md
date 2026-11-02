# Picklo tests

| Command | What it does | Time |
|---|---|---|
| `npm run typecheck` | TypeScript check of the whole app | ~30 s |
| `npm run test:db` | Every migration against an in-memory Postgres (PGlite) with a Supabase stand-in: security rules, RPCs, cleanup. `LEGACY=1` starts from the old production schema. | ~15 s |
| `npm run test:stress` | Hits the **live** Supabase project like many phones at once: join storms, realtime fan-out, MemeMatch vote races, 30 rooms at once, Chicago concurrency, abuse attempts. `node tests/stress/run-all.mjs joins` runs one scenario. | ~2 min |
| `npm run test:e2e` | Plays every game end to end in headless Chrome, several "phones" per game, through to the winner and "play again". Needs `npm run web` running (or `BASE=https://picklo.app`). `QUICK=1` for shorter Chicago/Mafia; `node tests/run-e2e.mjs imposter` for one game. | ~25 min (QUICK ~12) |

Requirements: Google Chrome installed (or `CHROME_PATH`), and `.env` with the Supabase URL/key.
`tests/e2e/one-phone.mjs` (the pass-the-phone versions of Imposter, Trivia, Music Quiz and Mafia) never
touches the database, so it also runs against a dev server started without a real `.env`.
Stress and e2e tests create rooms in the live database; the daily cleanup removes them after 24 h
of inactivity. Screenshots from e2e runs land in `tests/artifacts/` (git-ignored).

## Secrets inside a room

Imposter words, Mafia roles and night actions, and Chicago hands and the deck are dealt and
resolved by database functions (`supabase/migrations/20261102*`); each phone can only read its own
secrets, and scores, turns and results only change on the server. `test:stress` → `abuse` checks
this against the live project, and the e2e tests read the database the same way a phone does.
