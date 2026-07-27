import type { SupabaseClient } from "@supabase/supabase-js";
import type { Document } from "@/types/document";

// Mirrors the old Convex getSidebar sort: rows without an explicit sort_order
// bubble to the top (newest first among themselves); the rest sort ascending
// by sort_order. Kept verbatim so tree ordering doesn't drift.
export function sortDocuments(documents: Document[]): Document[] {
  return [...documents].sort((a, b) => {
    if (a.sort_order == null && b.sort_order == null) {
      return a.created_at > b.created_at ? -1 : 1;
    }
    if (a.sort_order == null) return -1;
    if (b.sort_order == null) return 1;
    return a.sort_order - b.sort_order;
  });
}

export async function fetchSidebar(
  supabase: SupabaseClient,
  userId: string,
  parentId: string | undefined,
): Promise<Document[]> {
  let query = supabase
    .from("documents")
    .select("*")
    .eq("user_id", userId)
    .eq("is_archived", false);

  query = parentId
    ? query.eq("parent_document", parentId)
    : query.is("parent_document", null);

  const { data, error } = await query;
  if (error) throw error;
  return sortDocuments(data ?? []);
}

export async function fetchById(
  supabase: SupabaseClient,
  id: string,
): Promise<Document | null> {
  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function fetchSearch(
  supabase: SupabaseClient,
  userId: string,
): Promise<Document[]> {
  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .eq("user_id", userId)
    .eq("is_archived", false)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function fetchTrash(
  supabase: SupabaseClient,
  userId: string,
): Promise<Document[]> {
  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .eq("user_id", userId)
    .eq("is_archived", true)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function fetchFavorites(
  supabase: SupabaseClient,
  userId: string,
): Promise<Document[]> {
  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .eq("user_id", userId)
    .eq("is_favorite", true)
    .eq("is_archived", false)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function insertDocument(
  supabase: SupabaseClient,
  userId: string,
  args: { title: string; parent_document?: string },
): Promise<Document> {
  const { data, error } = await supabase
    .from("documents")
    .insert({
      user_id: userId,
      title: args.title,
      parent_document: args.parent_document ?? null,
      full_width: true,
      show_toc: true,
      is_archived: false,
      is_published: false,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export type DocumentPatch = Partial<
  Pick<
    Document,
    | "title"
    | "content"
    | "cover_image"
    | "icon"
    | "is_published"
    | "editor_font"
    | "full_width"
    | "small_text"
    | "show_toc"
  >
>;

export async function updateDocument(
  supabase: SupabaseClient,
  id: string,
  patch: DocumentPatch,
): Promise<Document> {
  const { data, error } = await supabase
    .from("documents")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function archiveDocument(
  supabase: SupabaseClient,
  id: string,
): Promise<Document[]> {
  const { data, error } = await supabase.rpc("archive_document", {
    target_id: id,
  });
  if (error) throw error;
  return data ?? [];
}

export async function restoreDocument(
  supabase: SupabaseClient,
  id: string,
): Promise<Document[]> {
  const { data, error } = await supabase.rpc("restore_document", {
    target_id: id,
  });
  if (error) throw error;
  return data ?? [];
}

export async function deleteDocument(
  supabase: SupabaseClient,
  id: string,
): Promise<void> {
  const { error } = await supabase.from("documents").delete().eq("id", id);
  if (error) throw error;
}

export async function deleteAllArchived(
  supabase: SupabaseClient,
  userId: string,
): Promise<void> {
  const { error } = await supabase
    .from("documents")
    .delete()
    .eq("user_id", userId)
    .eq("is_archived", true);
  if (error) throw error;
}

export async function reorderDocuments(
  supabase: SupabaseClient,
  parentId: string | undefined,
  orderedIds: string[],
): Promise<void> {
  const { error } = await supabase.rpc("reorder_documents", {
    p_parent_document: parentId ?? null,
    p_ordered_ids: orderedIds,
  });
  if (error) throw error;
}

export async function toggleFavoriteDocument(
  supabase: SupabaseClient,
  id: string,
): Promise<Document> {
  const { data, error } = await supabase
    .rpc("toggle_favorite", { target_id: id })
    .select("*")
    .single();
  if (error) throw error;
  return data as Document;
}
