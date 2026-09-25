import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import { Platform } from "react-native";

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    "Missing Supabase configuration. Ensure EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY are set."
  );
}

try {
  new URL(SUPABASE_URL);
} catch {
  throw new Error(
    `EXPO_PUBLIC_SUPABASE_URL is invalid: ${SUPABASE_URL}. Make sure it is the correct Supabase project URL.`
  );
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    // Web uses localStorage (the default); native needs AsyncStorage to keep the session.
    ...(Platform.OS === "web" ? null : { storage: AsyncStorage }),
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});

let pendingSession: Promise<void> | null = null;

/**
 * Every device gets an anonymous Supabase identity (no account, no email).
 * The database uses it to know which players belong to this phone, so call
 * this before creating or joining a room. Cheap after the first time.
 */
export function ensureSession(): Promise<void> {
  if (!pendingSession) {
    pendingSession = (async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) return;
      const { error } = await supabase.auth.signInAnonymously();
      if (error) throw error;
    })().finally(() => {
      pendingSession = null;
    });
  }
  return pendingSession;
}

/** Joins (or re-joins) a room by code through the database, which enforces the game's rules. */
export async function joinRoomByCode(game: string, code: string, name: string) {
  await ensureSession();
  const { data, error } = await supabase.rpc("join_room", { p_game: game, p_code: code, p_name: name });
  if (error) throw error;
  const result = data as { room_id: string; player_id: string; code: string };
  return { roomId: result.room_id, playerId: result.player_id, code: result.code };
}
