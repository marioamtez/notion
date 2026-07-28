"use client";

import { useQuery } from "@tanstack/react-query";
import { useSupabaseClient } from "@/hooks/useSupabaseClient";
import { useSupabaseUser } from "@/hooks/useSupabaseUser";
import { documentKeys } from "@/lib/queryKeys";
import {
  fetchById,
  fetchFavorites,
  fetchSearch,
  fetchSidebar,
  fetchTrash,
} from "@/lib/data/documents";
import { fetchShares } from "@/lib/data/documentShares";

export const useSidebar = (parentId?: string) => {
  const supabase = useSupabaseClient();
  const { user } = useSupabaseUser();

  return useQuery({
    queryKey: documentKeys.sidebar(parentId),
    queryFn: () => fetchSidebar(supabase, parentId),
    enabled: !!user,
  });
};

export const useDocument = (
  id: string | undefined,
  options?: { enabled?: boolean },
) => {
  const supabase = useSupabaseClient();

  return useQuery({
    queryKey: documentKeys.detail(id ?? ""),
    queryFn: () => fetchById(supabase, id!),
    enabled: !!id && (options?.enabled ?? true),
  });
};

export const useSearchDocuments = () => {
  const supabase = useSupabaseClient();
  const { user } = useSupabaseUser();

  return useQuery({
    queryKey: documentKeys.search(),
    queryFn: () => fetchSearch(supabase),
    enabled: !!user,
  });
};

export const useTrash = () => {
  const supabase = useSupabaseClient();
  const { user } = useSupabaseUser();

  return useQuery({
    queryKey: documentKeys.trash(),
    queryFn: () => fetchTrash(supabase, user!.id),
    enabled: !!user,
  });
};

export const useFavorites = () => {
  const supabase = useSupabaseClient();
  const { user } = useSupabaseUser();

  return useQuery({
    queryKey: documentKeys.favorites(),
    queryFn: () => fetchFavorites(supabase, user!.id),
    enabled: !!user,
  });
};

export const useDocumentShares = (documentId: string | undefined) => {
  const supabase = useSupabaseClient();

  return useQuery({
    queryKey: documentKeys.shares(documentId ?? ""),
    queryFn: () => fetchShares(supabase, documentId!),
    enabled: !!documentId,
  });
};
