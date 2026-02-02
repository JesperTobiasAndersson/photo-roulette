import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const k = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";
console.log("ANON_KEY_LEN", k.length);
console.log("ANON_KEY_START", k.slice(0, 10));
console.log("ANON_KEY_END", k.slice(-10));
