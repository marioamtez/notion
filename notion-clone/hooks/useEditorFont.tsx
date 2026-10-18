import { useUserSettings } from "@/hooks/useUserSettings";
import { useLocalStorage } from "usehooks-ts";

export type EditorFont = "default" | "Lora" | "JetBrains Mono";

interface UseEditorFontOptions {
  enabled?: boolean;
}

export const useEditorFont = ({ enabled = true }: UseEditorFontOptions) => {
  const [cachedFont, setCachedFont] = useLocalStorage<EditorFont>(
    "zotion-editor-font",
    "default",
  );

  const { settings, isLoading, mutation } = useUserSettings(enabled);
  const isFontLoading = enabled && isLoading;

  const editorFont: EditorFont =
    (settings?.editor_font as EditorFont) ?? cachedFont;

  const setEditorFont = (font: EditorFont) => {
    if (!enabled) return;
    setCachedFont(font);
    mutation.mutateAsync({ editor_font: font }).catch(console.error);
  };

  return { editorFont, setEditorFont, isFontLoading };
};
