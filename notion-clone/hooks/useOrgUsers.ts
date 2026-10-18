"use client";

import { useQuery } from "@tanstack/react-query";
import { useSupabaseClient } from "@/hooks/useSupabaseClient";
import { useSupabaseUser } from "@/hooks/useSupabaseUser";
import { profileKeys } from "@/lib/queryKeys";
import { fetchProfiles } from "@/lib/data/profiles";

export const useOrgUsers = () => {
  const supabase = useSupabaseClient();
  const { user } = useSupabaseUser();

  return useQuery({
    queryKey: profileKeys.list(),
    queryFn: () => fetchProfiles(supabase),
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });
};
