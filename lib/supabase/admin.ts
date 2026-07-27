import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Server-only: uses the service_role key, which bypasses RLS entirely.
// Never import this from a "use client" component.
export const createAdminClient = () =>
  createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
