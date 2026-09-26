# Picklo tests

| Command | What it does | Time |
|---|---|---|
| `npm run typecheck` | TypeScript check of the whole app | ~30 s |
| `npm run test:db` | Every migration against an in-memory Postgres (PGlite) with a Supabase stand-in: security rules, RPCs, cleanup. `LEGACY=1` starts from the old production schema. | ~15 s |
| `npm run test:stress` | Hits the **live** Supabase project like many phones at once: join storms, realtime fan-out, MemeMatch vote races, 30 rooms at once, Chicago concurrency, abuse attempts. `node tests/stress/run-all.mjs joins` runs one scenario. | ~2 min |
| `npm run test:e2e` | Plays every game end to end in headless Chrome, several "phones" per game, through to the winner and "play again". Needs `npm run web` running (or `BASE=https://picklo.app`). `QUICK=1` for shorter Chicago/Mafia; `node tests/run-e2e.mjs imposter` for one game. | ~25 min (QUICK ~12) |

Requirements: Google Chrome installed (or `CHROME_PATH`), and `.env` with the Supabase URL/key.
Stress and e2e tests create rooms in the live database; the daily cleanup removes them after 24 h
of inactivity. Screenshots from e2e runs land in `tests/artifacts/` (git-ignored).

## Known, accepted failures

`test:stress` → `abuse` reports 4 failures on purpose: players who use browser developer tools can
read secret game data inside their own room (Mafia roles, the Imposter word, Chicago hands) and set
their own Chicago score. Normal play never shows it; fixing it means moving those games' rules into
database functions. Outsiders can't see anything.
