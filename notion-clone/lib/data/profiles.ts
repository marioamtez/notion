import type { SupabaseClient } from "@supabase/supabase-js";
import type { Profile } from "@/types/profile";

export async function fetchProfiles(supabase: SupabaseClient): Promise<Profile[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, full_name")
    .order("email", { ascending: true });
  if (error) throw error;
  return data ?? [];
}
