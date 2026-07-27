import type { SupabaseClient } from "@supabase/supabase-js";
import type { UserSettings } from "@/types/document";

export async function fetchUserSettings(
  supabase: SupabaseClient,
  userId: string,
): Promise<UserSettings | null> {
  const { data, error } = await supabase
    .from("user_settings")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function upsertUserSettings(
  supabase: SupabaseClient,
  userId: string,
  patch: { editor_font?: string; focus_mode?: boolean },
): Promise<UserSettings> {
  const { data, error } = await supabase
    .from("user_settings")
    .upsert(
      { user_id: userId, ...patch, updated_at: new Date().toISOString() },
      { onConflict: "user_id" },
    )
    .select("*")
    .single();
  if (error) throw error;
  return data;
}
