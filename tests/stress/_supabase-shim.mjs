// Stand-in for src/lib/supabase.tsx when the real game api.ts files are loaded in Node.
// `supabase` resolves to the client of whichever "phone" is currently acting
// (set with asPlayer(client, fn) via AsyncLocalStorage), so many phones can run
// the app's own api functions concurrently in one process.
import { AsyncLocalStorage } from "node:async_hooks";

export const als = new AsyncLocalStorage();

function current() {
  const c = als.getStore();
  if (!c) throw new Error("supabase shim: no current player (wrap the call in asPlayer(client, fn))");
  return c;
}

export const supabase = new Proxy(
  {},
  {
    get(_t, prop) {
      const c = current();
      const v = c[prop];
      return typeof v === "function" ? v.bind(c) : v;
    },
  }
);

export async function ensureSession() {}

export async function joinRoomByCode(game, code, name) {
  const { data, error } = await current().rpc("join_room", { p_game: game, p_code: code, p_name: name });
  if (error) throw error;
  return { roomId: data.room_id, playerId: data.player_id, code: data.code };
}
