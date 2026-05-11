import { createClient as createSupabaseClient, SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

let cached: SupabaseClient | null = null;

export const supabaseConfigured = () => Boolean(supabaseUrl && supabaseKey);

export const supabase = () => {
  if (typeof window === "undefined") {
    throw new Error("supabase() can only be called in the browser; this is a static-export site.");
  }
  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.");
  }
  if (!cached) {
    cached = createSupabaseClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false },
    });
  }
  return cached;
};
