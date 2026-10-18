import type { SupabaseClient } from "@supabase/supabase-js";
import type { DocumentShare } from "@/types/documentShare";

export async function fetchShares(
  supabase: SupabaseClient,
  documentId: string,
): Promise<DocumentShare[]> {
  const { data, error } = await supabase
    .from("document_shares")
    .select("*")
    .eq("document_id", documentId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function addShare(
  supabase: SupabaseClient,
  documentId: string,
  userId: string,
  createdBy: string,
): Promise<DocumentShare> {
  const { data, error } = await supabase
    .from("document_shares")
    .insert({ document_id: documentId, user_id: userId, created_by: createdBy })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function removeShare(
  supabase: SupabaseClient,
  documentId: string,
  userId: string,
): Promise<void> {
  const { error } = await supabase
    .from("document_shares")
    .delete()
    .eq("document_id", documentId)
    .eq("user_id", userId);
  if (error) throw error;
}
