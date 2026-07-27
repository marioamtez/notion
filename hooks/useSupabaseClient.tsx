"use client";

import { useMemo } from "react";
import { createClient } from "@/lib/supabase/client";

export const useSupabaseClient = () => useMemo(() => createClient(), []);
