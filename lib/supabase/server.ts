import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Server-only Supabase client with the service role key. It bypasses RLS, so
// it must never be imported from a client component.
let cached: SupabaseClient | null = null;

export const supabaseAdminConfigured = () =>
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

export const supabaseAdmin = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  }
  if (!cached) {
    cached = createClient(url, key, {
      auth: { persistSession: false },
    });
  }
  return cached;
};
