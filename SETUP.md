# Running Picklo (free)

Picklo is a static web app (Expo / React Native Web) backed by Supabase.
Everything below fits in free tiers: **Supabase Free**, **Vercel Hobby** (fine now that
the site has no ads) and **GitHub Actions**. The only optional cost is a custom domain.

## 1. Supabase project (≈10 min)

1. Create a project at <https://supabase.com/dashboard> → **New project**.
   Region: **North EU (Stockholm)**. Save the database password somewhere safe.
2. **Authentication → Sign In / Providers** → turn on **Allow anonymous sign-ins**.
   (Every phone gets an invisible anonymous identity; players never see a login.)
3. **Authentication → Rate Limits** → raise *anonymous sign-ins per hour per IP*
   from 30 to ~300. A party on one Wi-Fi shares an IP address.
4. **SQL Editor** → paste all of
   [`supabase/migrations/20260925120000_picklo_init.sql`](supabase/migrations/20260925120000_picklo_init.sql)
   → **Run**. This creates all six games, the security rules, Realtime and the
   `game-images` storage bucket. It is safe to run again.
5. **Project Settings → API**: copy the **Project URL** and the **publishable / anon key**.

## 2. App configuration

Local development — create `.env` from `.env.example`:

```
EXPO_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<publishable or anon key>
```

Then `npm install` and `npm run web`.

Hosting (Vercel) — **Project → Settings → Environment Variables**, add the same two
variables (plus the optional ones below), then **Redeploy**. Build command:
`npx expo export --platform web`, output directory: `dist`.

| Variable | Needed | What it does |
|---|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | yes | Supabase project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | yes | Public client key (safe to expose) |
| `EXPO_PUBLIC_SITE_URL` | no | Public address for share links/SEO, e.g. `https://picklo.app` |
| `EXPO_PUBLIC_TIP_URL` | no | Tip link shown after a game ends; empty hides it |

## 3. Daily cleanup + keep-alive (≈5 min)

Free Supabase projects are **paused after 7 days without activity** — that's what took
Picklo down. A daily job both prevents that and deletes rooms/photos older than 24h
(keeps you far under the 1 GB storage limit).

```bash
npx supabase login
npx supabase link --project-ref <project-ref>
npx supabase secrets set CLEANUP_SECRET=<long random string>
npx supabase functions deploy cleanup --no-verify-jwt
```

Then in GitHub → **Settings → Secrets and variables → Actions** add:
`SUPABASE_URL` and `CLEANUP_SECRET` (same value as above).
Run **Actions → Daily cleanup & keep-alive → Run workflow** once to check it returns JSON.

> GitHub stops scheduled workflows after 60 days without commits (it emails you first).
> For belt-and-braces, add a free job on <https://cron-job.org> that POSTs to
> `https://<project-ref>.supabase.co/functions/v1/cleanup` with header
> `x-cleanup-secret: <same secret>` once a day.

## 4. Check it works

Open the site on two phones (or one normal + one private browser window — the same
browser window shares one identity), create a room on one, join with the code on the
other, and play a round.

## How security works

- Each device signs in anonymously; every player row stores that device's `auth_user_id`.
- Row Level Security: you can only read or change data of rooms you are a member of.
  The public anon key on its own can read nothing.
- Joining happens through the `join_room()` database function, which checks the code,
  game state and player limit, and gives a re-joining phone its old seat back.
- MemeMatch additionally prevents playing/voting as someone else and voting for yourself;
  scores are only written by the server.
- Known limitation: inside a room, secret information (Mafia roles, Chicago hands, the
  Imposter word) is still readable by other *members* of that room with developer tools,
  because the game logic runs on the phones. Fixing that means moving each game's
  resolution into database functions — a good next step, but not needed to play.

## Database changes

Add new SQL files to `supabase/migrations/` (e.g. `20261001120000_add_x.sql`) and apply
them with the SQL editor or `npx supabase db push`.
