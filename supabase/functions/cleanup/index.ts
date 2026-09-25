// Daily housekeeping, triggered by .github/workflows/daily-cleanup.yml.
//
// 1. Deletes MemeMatch photos of rooms older than 24h (through the Storage API,
//    so the files are really gone, not just their database rows).
// 2. Deletes all expired rooms of every game (their data cascades) and stale
//    anonymous users.
//
// Being called every day also counts as project activity, which stops the free
// Supabase project from being paused.
//
// Deploy:  npx supabase functions deploy cleanup --no-verify-jwt
//          (it checks its own secret header instead of a Supabase JWT)
// Secret:  npx supabase secrets set CLEANUP_SECRET=<random string>
import { createClient } from "jsr:@supabase/supabase-js@2";

const BUCKET = "game-images";
const PAGE = 100;

Deno.serve(async (req) => {
  const secret = Deno.env.get("CLEANUP_SECRET");
  if (!secret || req.headers.get("x-cleanup-secret") !== secret) {
    return new Response("forbidden", { status: 403 });
  }

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });

  const { data: roomIds, error: listError } = await admin.rpc("picklo_expired_memematch_rooms");
  if (listError) return Response.json({ error: listError.message }, { status: 500 });

  let imagesRemoved = 0;
  for (const roomId of (roomIds ?? []) as string[]) {
    const folder = `${roomId}/hand`;
    while (true) {
      const { data: files, error } = await admin.storage.from(BUCKET).list(folder, { limit: PAGE });
      if (error || !files?.length) break;
      const paths = files.map((file) => `${folder}/${file.name}`);
      const { error: removeError } = await admin.storage.from(BUCKET).remove(paths);
      if (removeError) break;
      imagesRemoved += paths.length;
      if (files.length < PAGE) break;
    }
  }

  const { data: summary, error: cleanupError } = await admin.rpc("picklo_cleanup");
  if (cleanupError) return Response.json({ error: cleanupError.message, images_removed: imagesRemoved }, { status: 500 });

  return Response.json({ images_removed: imagesRemoved, ...(summary as Record<string, number>) });
});
