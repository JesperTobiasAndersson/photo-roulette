import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    "Missing Supabase configuration. Ensure EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY are set."
  );
}

try {
  // Ensure the URL is valid and resolvable:
  new URL(SUPABASE_URL);
} catch (err) {
  throw new Error(
    `EXPO_PUBLIC_SUPABASE_URL is invalid: ${SUPABASE_URL}. Make sure it is the correct Supabase project URL.`
  );
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

