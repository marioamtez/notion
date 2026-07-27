"use client";

import dynamic from "next/dynamic";
import { useMemo, use } from "react";

import { Cover } from "@/components/cover";
import { Toolbar } from "@/components/toolbar";
import { Skeleton } from "@/components/ui/skeleton";

import { useDocument } from "@/hooks/useDocumentQueries";
import { useUpdateDocument } from "@/hooks/useDocumentMutations";

interface DocumentIdPageProps {
  params: Promise<{
    documentId: string;
  }>;
}

const DocumentIdPage = ({ params }: DocumentIdPageProps) => {
  const { documentId } = use(params);

  const Editor = useMemo(
    () => dynamic(() => import("@/components/editor"), { ssr: false }),
    [],
  );

  const { data: document } = useDocument(documentId);

  const { mutateAsync: update } = useUpdateDocument();

  const onChange = (content: string) => {
    update({
      id: documentId,
      content,
    });
  };

  if (document === undefined) {
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

  if (document === null) {
    return <div>Not found</div>;
  }

  return (
    <div className="pb-40">
      <Cover preview url={document.cover_image ?? undefined} />
      <div className="mx-auto md:max-w-3xl lg:max-w-4xl">
        <Toolbar
          preview
          initialData={document}
          editorFont={document.editor_font ?? "default"}
        />
        <Editor
          editable={false}
          onChange={onChange}
          initialContent={document.content ?? undefined}
          editorFont={document.editor_font ?? "default"}
        />
      </div>
    </div>
  );
};
export default DocumentIdPage;
