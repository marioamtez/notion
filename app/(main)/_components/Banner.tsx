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
      loading: "Deleting note...",
      success: "Note Deleted!",
      error: "Failed to delete note.",
    });

    router.push("/documents");
  };

  const onRestore = () => {
    const promise = restore({ id: documentId });

    toast.promise(promise, {
      loading: "Restoring note...",
      success: "Note restored!",
      error: "Failed to restore note.",
    });
  };

  return (
    <div className="flex w-full items-center justify-center gap-x-2 bg-rose-500 p-2 text-center text-sm text-white">
      <p>
        This page is in the <span className="font-bold">Trash.</span>
      </p>
      <Button
        size="sm"
        onClick={onRestore}
        variant="outline"
        className="h-auto border-white bg-transparent p-1 px-2 font-normal text-white transition hover:bg-white hover:text-rose-500"
      >
        Restore page
      </Button>
      <ConfirmModal onConfirm={onRemove}>
        <Button
          size="sm"
          variant="outline"
          className="h-auto border-white bg-transparent p-1 px-2 font-normal text-white transition hover:bg-white hover:text-rose-500"
        >
          Delete forever
        </Button>
      </ConfirmModal>
    </div>
  );
};
