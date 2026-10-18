"use client";

import { ConfirmModal } from "@/components/modals/ConfirmModal";
import { Button } from "@/components/ui/button";
import {
  useRemoveDocument,
  useRestoreDocument,
} from "@/hooks/useDocumentMutations";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

interface BannerProps {
  documentId: string;
}

export const Banner = ({ documentId }: BannerProps) => {
  const router = useRouter();
  const { mutateAsync: remove } = useRemoveDocument();
  const { mutateAsync: restore } = useRestoreDocument();

  const onRemove = () => {
    const promise = remove({ id: documentId });

    toast.promise(promise, {
      loading: "Eliminando nota...",
      success: "¡Nota eliminada!",
      error: "No se pudo eliminar la nota.",
    });

    router.push("/documents");
  };

  const onRestore = () => {
    const promise = restore({ id: documentId });

    toast.promise(promise, {
      loading: "Restaurando nota...",
      success: "¡Nota restaurada!",
      error: "No se pudo restaurar la nota.",
    });
  };

  return (
    <div className="flex w-full items-center justify-center gap-x-2 bg-rose-500 p-2 text-center text-sm text-white">
      <p>
        Esta página está en la <span className="font-bold">papelera.</span>
      </p>
      <Button
        size="sm"
        onClick={onRestore}
        variant="outline"
        className="h-auto border-white bg-transparent p-1 px-2 font-normal text-white transition hover:bg-white hover:text-rose-500"
      >
        Restaurar página
      </Button>
      <ConfirmModal onConfirm={onRemove}>
        <Button
          size="sm"
          variant="outline"
          className="h-auto border-white bg-transparent p-1 px-2 font-normal text-white transition hover:bg-white hover:text-rose-500"
        >
          Eliminar para siempre
        </Button>
      </ConfirmModal>
    </div>
  );
};
