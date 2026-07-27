import { useUserSettings } from "@/hooks/useUserSettings";

interface UseFocusModeOptions {
  enabled?: boolean;
}

export const useFocusMode = ({ enabled = true }: UseFocusModeOptions = {}) => {
  const { settings, mutation } = useUserSettings(enabled);

  const focusMode = settings?.focus_mode ?? false;

  const setFocusMode = (value: boolean) => {
    if (!enabled) return;
    mutation.mutateAsync({ focus_mode: value });
  };

  return { focusMode, setFocusMode };
};
