"use client";

import dynamic from "next/dynamic";
import { useMemo, use, useState, useEffect } from "react";
import { useTheme } from "next-themes";

import { Cover } from "@/components/cover";
import { Toolbar } from "@/components/toolbar";
import { Skeleton } from "@/components/ui/skeleton";

import { useDocument } from "@/hooks/useDocumentQueries";
import { useUpdateDocument } from "@/hooks/useDocumentMutations";
import { BlockNoteEditor } from "@blocknote/core";
import { TableOfContents } from "@/components/table-of-contents";
import { useEditorFont } from "@/hooks/useEditorFont";

interface DocumentIdPageProps {
  params: Promise<{
    documentId: string;
  }>;
}

const DocumentIdPage = ({ params }: DocumentIdPageProps) => {
  const { documentId } = use(params);
  const [editor, setEditor] = useState<BlockNoteEditor | null>(null);
  const { resolvedTheme } = useTheme();

  const Editor = useMemo(
    () => dynamic(() => import("@/components/editor"), { ssr: false }),
    [],
  );

  const { data: doc } = useDocument(documentId);

  const { editorFont, isFontLoading } = useEditorFont({ enabled: true });

  const { mutateAsync: update } = useUpdateDocument();

  useEffect(() => {
    if (!doc) return;

    const defaultFavicon =
      resolvedTheme === "dark" ? "/logo-dark.svg" : "/logo.svg";

    window.document.title = `${doc.title || "Untitled"} | Mbrand Notion`;

    const link = window.document.querySelector(
      "link[rel~='icon']",
    ) as HTMLLinkElement;
    if (link) {
      link.href = doc.icon
        ? `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text x='50%' y='50%' dominant-baseline='central' text-anchor='middle' font-size='100'>${doc.icon}</text></svg>`
        : defaultFavicon;
    }

    return () => {
      window.document.title = "Mbrand Notion";
      if (link) link.href = defaultFavicon;
    };
  }, [doc?.title, doc?.icon, resolvedTheme, documentId]);

  useEffect(() => {
    if (!doc) return;
    if (doc.editor_font === editorFont) return;

    update({
      id: documentId,
      editor_font: editorFont,
    });
  }, [doc, editorFont, documentId, update]);

  const activeFont = doc?.editor_font ?? editorFont;
  const isFullWidth = doc?.full_width ?? true;
  const isSmallText = doc?.small_text ?? false;
  const showToc = doc?.show_toc ?? true;

  const onChange = (content: string) => {
    update({
      id: documentId,
      content,
    });
  };

  if (doc === undefined || isFontLoading) {
    return (
      <div>
        <Cover.Skeleton />
        <div className="mx-auto mt-10 md:max-w-3xl lg:max-w-4xl">
          <div className="space-y-4 pt-4 pl-8">
            <Skeleton className="h-14 w-1/2" />
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-4 w-2/5" />
            <Skeleton className="h-4 w-3/5" />
          </div>
        </div>
      </div>
    );
  }

  if (doc === null) {
    return <div>Not found</div>;
  }

  return (
    <div className="pb-35">
      <Cover url={doc.cover_image ?? undefined} />
      <div
        className={`relative mx-auto md:w-[90%] ${
          !isFullWidth ? "max-w-200" : ""
        }`}
      >
        <Toolbar initialData={doc} editorFont={activeFont} />
        <Editor
          onChange={onChange}
          initialContent={doc.content ?? undefined}
          smallText={isSmallText}
          onEditorReady={setEditor}
          editorFont={activeFont}
        />
        {showToc && <TableOfContents editor={editor} />}
      </div>
    </div>
  );
};
export default DocumentIdPage;
