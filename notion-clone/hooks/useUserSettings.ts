"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSupabaseClient } from "@/hooks/useSupabaseClient";
import { useSupabaseUser } from "@/hooks/useSupabaseUser";
import { userSettingsKeys } from "@/lib/queryKeys";
import { fetchUserSettings, upsertUserSettings } from "@/lib/data/userSettings";

export const useUserSettings = (enabled: boolean) => {
  const supabase = useSupabaseClient();
  const { user } = useSupabaseUser();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: userSettingsKeys.detail(user?.id ?? ""),
    queryFn: () => fetchUserSettings(supabase, user!.id),
    enabled: enabled && !!user,
  });

  const mutation = useMutation({
    mutationFn: (patch: { editor_font?: string; focus_mode?: boolean }) =>
      upsertUserSettings(supabase, user!.id, patch),
    onSuccess: (settings) => {
      queryClient.setQueryData(
        userSettingsKeys.detail(settings.user_id),
        settings,
      );
    },
  });

  return { settings: query.data, isLoading: query.isLoading, mutation };
};
