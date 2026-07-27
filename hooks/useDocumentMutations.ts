"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSupabaseClient } from "@/hooks/useSupabaseClient";
import { useSupabaseUser } from "@/hooks/useSupabaseUser";
import { documentKeys } from "@/lib/queryKeys";
import {
  archiveDocument,
  deleteAllArchived,
  deleteDocument,
  insertDocument,
  reorderDocuments,
  restoreDocument,
  toggleFavoriteDocument,
  updateDocument,
  type DocumentPatch,
} from "@/lib/data/documents";
import type { Document } from "@/types/document";

export const useCreateDocument = () => {
  const supabase = useSupabaseClient();
  const { user } = useSupabaseUser();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (args: { title: string; parent_document?: string }) =>
      insertDocument(supabase, user!.id, args),
    onSuccess: (doc) => {
      queryClient.setQueryData(documentKeys.detail(doc.id), doc);
      queryClient.invalidateQueries({
        queryKey: documentKeys.sidebar(doc.parent_document ?? undefined),
      });
      queryClient.invalidateQueries({ queryKey: documentKeys.search() });
    },
  });
};

export const useUpdateDocument = () => {
  const supabase = useSupabaseClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (args: { id: string } & DocumentPatch) => {
      const { id, ...patch } = args;
      return updateDocument(supabase, id, patch);
    },
    onSuccess: (doc: Document) => {
      queryClient.setQueryData(documentKeys.detail(doc.id), doc);
      queryClient.invalidateQueries({
        queryKey: documentKeys.sidebar(doc.parent_document ?? undefined),
      });
      queryClient.invalidateQueries({ queryKey: documentKeys.search() });
      if (doc.is_favorite) {
        queryClient.invalidateQueries({ queryKey: documentKeys.favorites() });
      }
      if (doc.is_archived) {
        queryClient.invalidateQueries({ queryKey: documentKeys.trash() });
      }
    },
  });
};

export const useRemoveIcon = () => {
  const update = useUpdateDocument();
  return {
    ...update,
    mutateAsync: (args: { id: string }) =>
      update.mutateAsync({ id: args.id, icon: null }),
  };
};

export const useRemoveCoverImage = () => {
  const update = useUpdateDocument();
  return {
    ...update,
    mutateAsync: (args: { id: string }) =>
      update.mutateAsync({ id: args.id, cover_image: null }),
  };
};

const invalidateAfterTreeChange = (queryClient: ReturnType<typeof useQueryClient>) => {
  queryClient.invalidateQueries({ queryKey: documentKeys.sidebarAll });
  queryClient.invalidateQueries({ queryKey: documentKeys.search() });
  queryClient.invalidateQueries({ queryKey: documentKeys.favorites() });
  queryClient.invalidateQueries({ queryKey: documentKeys.trash() });
};

export const useArchiveDocument = () => {
  const supabase = useSupabaseClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (args: { id: string }) => archiveDocument(supabase, args.id),
    onSuccess: (rows) => {
      rows.forEach((row) =>
        queryClient.setQueryData(documentKeys.detail(row.id), row),
      );
      invalidateAfterTreeChange(queryClient);
    },
  });
};

export const useRestoreDocument = () => {
  const supabase = useSupabaseClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (args: { id: string }) => restoreDocument(supabase, args.id),
    onSuccess: (rows) => {
      rows.forEach((row) =>
        queryClient.setQueryData(documentKeys.detail(row.id), row),
      );
      invalidateAfterTreeChange(queryClient);
    },
  });
};

export const useRemoveDocument = () => {
  const supabase = useSupabaseClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (args: { id: string }) => deleteDocument(supabase, args.id),
    onSuccess: (_data, args) => {
      queryClient.removeQueries({ queryKey: documentKeys.detail(args.id) });
      queryClient.invalidateQueries({ queryKey: documentKeys.trash() });
      queryClient.invalidateQueries({ queryKey: documentKeys.sidebarAll });
    },
  });
};

export const useRemoveAllDocuments = () => {
  const supabase = useSupabaseClient();
  const { user } = useSupabaseUser();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => deleteAllArchived(supabase, user!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: documentKeys.trash() });
    },
  });
};

export const useReorderDocuments = () => {
  const supabase = useSupabaseClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (args: { parentId?: string; orderedIds: string[] }) =>
      reorderDocuments(supabase, args.parentId, args.orderedIds),
    onSuccess: (_data, args) => {
      queryClient.invalidateQueries({
        queryKey: documentKeys.sidebar(args.parentId),
      });
    },
  });
};

export const useToggleFavoriteDocument = () => {
  const supabase = useSupabaseClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (args: { id: string }) =>
      toggleFavoriteDocument(supabase, args.id),
    onSuccess: (doc) => {
      queryClient.setQueryData(documentKeys.detail(doc.id), doc);
      queryClient.invalidateQueries({ queryKey: documentKeys.favorites() });
      queryClient.invalidateQueries({
        queryKey: documentKeys.sidebar(doc.parent_document ?? undefined),
      });
    },
  });
};
