"use client";

import { ActionTooltip } from "@/components/action-tooltip";
import { ConfirmModal } from "@/components/modals/ConfirmModal";
import { Spinner } from "@/components/spinner";
import { Input } from "@/components/ui/input";
import { getDocumentUrls, useEdgeStore } from "@/lib/edgestore";
import { useTrash } from "@/hooks/useDocumentQueries";
import {
  useRemoveAllDocuments,
  useRemoveDocument,
  useRestoreDocument,
} from "@/hooks/useDocumentMutations";
import { Coffee, Search, Trash, Trash2, Undo } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

export const TrashBox = () => {
  const router = useRouter();
  const params = useParams();

  const { edgestore } = useEdgeStore();

  const { data: documents } = useTrash();
  const { mutateAsync: restore } = useRestoreDocument();
  const { mutateAsync: remove } = useRemoveDocument();
  const { mutateAsync: removeAll } = useRemoveAllDocuments();

  const [search, setSearch] = useState("");

  const filteredDocuments = documents?.filter((document) => {
    return document.title.toLowerCase().includes(search.toLowerCase());
  });

  const onClick = (documentId: string) => {
    router.push(`/documents/${documentId}`);
  };

  const onRestore = (
    event: React.MouseEvent<HTMLButtonElement, MouseEvent>,
    documentId: string,
  ) => {
    event.stopPropagation();
    const promise = restore({ id: documentId });

    toast.promise(promise, {
      loading: "Restaurando nota..",
      success: "¡Nota restaurada!",
      error: "No se pudo restaurar la nota.",
    });
  };

  const deleteFromEdgeStore = async (urls: string[]) => {
    await Promise.allSettled(
      urls.map((url) => edgestore.publicFiles.delete({ url })),
    );
  };

  const onRemove = (documentId: string) => {
    const document = documents?.find((d) => d.id === documentId);
    if (document) {
      deleteFromEdgeStore(getDocumentUrls(document));
    }

    const promise = remove({ id: documentId });

    toast.promise(promise, {
      loading: "Eliminando nota..",
      success: "¡Nota eliminada!",
      error: "No se pudo eliminar la nota.",
    });

    if (params.documentId === documentId) {
      router.push("/documents");
    }
  };

  const onEmptyTrash = () => {
    if (documents) {
      const allUrls = documents.flatMap(getDocumentUrls);
      deleteFromEdgeStore(allUrls);
    }

    const promise = removeAll();

    toast.promise(promise, {
      loading: "Vaciando la papelera..",
      success: "¡Papelera vaciada!",
      error: "No se pudo vaciar la papelera.",
    });

    if (params.documentId) {
      const isCurrentDocInTrash = documents?.some(
        (doc) => doc.id === params.documentId,
      );
      if (isCurrentDocInTrash) {
        router.push("/documents");
      }
    }
  };

  if (documents === undefined) {
    return (
      <div
        className="flex h-full items-center justify-center p-4"
        aria-busy="true"
        aria-label="cargando"
      >
        <Spinner size="md" />
      </div>
    );
  }

  return (
    <section className="text-sm">
      <div className="flex items-center gap-x-1 p-2">
        <Search className="h-4 w-4" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-secondary h-7 px-2 focus-visible:ring-transparent"
          placeholder="Filtrar por título de página..."
          aria-label="Filtrar por título de página"
        />
        {documents.length > 0 && (
          <ConfirmModal onConfirm={onEmptyTrash}>
            <div>
              <ActionTooltip label="Vaciar papelera">
                <div
                  role="button"
                  className="rounded-sm p-2 hover:bg-neutral-200 dark:hover:bg-neutral-600"
                >
                  <Trash2 className="size-4 text-rose-500" />
                </div>
              </ActionTooltip>
            </div>
          </ConfirmModal>
        )}
      </div>

      <div className="mt-2 px-1 pb-1">
        {documents.length === 0 ? (
          <p className="text-muted-foreground pb-2 text-center text-xs">
            La papelera está vacía
            <Coffee className="mb-1 ml-1 inline-block size-4" />
          </p>
        ) : (
          filteredDocuments?.length === 0 && (
            <p className="text-muted-foreground pb-2 text-center text-xs">
              No se encontraron documentos.
            </p>
          )
        )}
        <div className="max-h-[50vh] overflow-y-auto">
          {filteredDocuments?.map((document) => (
            <div
              key={document.id}
              role="button"
              onClick={() => onClick(document.id)}
              className="text-primary hover:bg-primary/5 flex w-full items-center justify-between rounded-sm text-sm"
              aria-label="Documento"
            >
              <span className="truncate pl-2">{document.title}</span>
              <div className="flex items-center">
                <ActionTooltip label="Restaurar página">
                  <button
                    onClick={(e) => onRestore(e, document.id)}
                    className="rounded-sm p-2 hover:bg-neutral-200 dark:hover:bg-neutral-600"
                    aria-label="Restaurar documento"
                  >
                    <Undo className="text-muted-foreground h-4 w-4" />
                  </button>
                </ActionTooltip>
                <ConfirmModal onConfirm={() => onRemove(document.id)}>
                  <div>
                    <ActionTooltip label="Eliminar para siempre">
                      <button
                        className="rounded-sm p-2 hover:bg-neutral-200 dark:hover:bg-neutral-600"
                        aria-label="Eliminar permanentemente"
                      >
                        <Trash className="text-muted-foreground h-4 w-4" />
                      </button>
                    </ActionTooltip>
                  </div>
                </ConfirmModal>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
