"use client";

import { useMemo, useState } from "react";
import { Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { useMovePagesModal } from "@/hooks/useMovePagesModal";
import { useDocument, useSidebar } from "@/hooks/useDocumentQueries";
import { useMoveDocument } from "@/hooks/useDocumentMutations";
import { useSupabaseUser } from "@/hooks/useSupabaseUser";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const MovePagesModal = () => {
  const movePagesModal = useMovePagesModal();
  const { user } = useSupabaseUser();

  const { data: pila } = useDocument(movePagesModal.pilaId, {
    enabled: movePagesModal.isOpen,
  });
  const { data: rootDocuments } = useSidebar(undefined);

  const { mutateAsync: moveDocument, isPending } = useMoveDocument();

  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const candidates = useMemo(
    () =>
      (rootDocuments ?? []).filter(
        (doc) => doc.user_id === user?.id && doc.id !== movePagesModal.pilaId,
      ),
    [rootDocuments, user?.id, movePagesModal.pilaId],
  );

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const onClose = () => {
    setSearch("");
    setSelectedIds(new Set());
    movePagesModal.onClose();
  };

  const onConfirm = async () => {
    if (!movePagesModal.pilaId || selectedIds.size === 0) {
      onClose();
      return;
    }
    const promise = Promise.all(
      [...selectedIds].map((id) =>
        moveDocument({ id, newParentId: movePagesModal.pilaId! }),
      ),
    );
    toast.promise(promise, {
      loading: "Moviendo páginas...",
      success: "Páginas añadidas a la pila.",
      error: "No se pudieron mover todas las páginas.",
    });
    await promise.catch(() => {});
    onClose();
  };

  return (
    <Dialog open={movePagesModal.isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="dark:bg-dark">
        <DialogHeader className="border-b pb-2">
          <h2 className="truncate text-lg font-medium">
            Añadir páginas a {pila?.title ? `"${pila.title}"` : "la pila"}
          </h2>
          <p className="text-muted-foreground text-[0.8rem]">
            Elige páginas tuyas para moverlas dentro. Todo lo que cuelgue de
            ellas se mueve también, y pasan a ser públicas.
          </p>
        </DialogHeader>

        <Command className="rounded-md border" shouldFilter={false}>
          <CommandInput
            placeholder="Buscar tus páginas..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>No se encontraron páginas.</CommandEmpty>
            <CommandGroup>
              {candidates
                .filter((doc) =>
                  doc.title.toLowerCase().includes(search.toLowerCase()),
                )
                .map((doc) => (
                  <CommandItem
                    key={doc.id}
                    value={doc.id}
                    onSelect={() => toggleSelected(doc.id)}
                  >
                    <div
                      className={cn(
                        "mr-2 flex size-4 items-center justify-center rounded-sm border",
                        selectedIds.has(doc.id) &&
                          "bg-primary border-primary text-primary-foreground",
                      )}
                    >
                      {selectedIds.has(doc.id) && <Check className="size-3" />}
                    </div>
                    {doc.icon && <span className="mr-1">{doc.icon}</span>}
                    <span className="truncate">{doc.title}</span>
                  </CommandItem>
                ))}
            </CommandGroup>
          </CommandList>
        </Command>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Ahora no
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isPending || selectedIds.size === 0}
          >
            Añadir {selectedIds.size > 0 ? `(${selectedIds.size})` : ""}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
