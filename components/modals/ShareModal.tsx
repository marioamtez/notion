"use client";

import { useMemo, useState } from "react";
import { X } from "lucide-react";
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useShareModal } from "@/hooks/useShareModal";
import { useDocument, useDocumentShares } from "@/hooks/useDocumentQueries";
import { useAddShare, useRemoveShare } from "@/hooks/useDocumentMutations";
import { useOrgUsers } from "@/hooks/useOrgUsers";
import { useSupabaseUser } from "@/hooks/useSupabaseUser";

const initialsFor = (email: string, fullName: string | null) => {
  const source = fullName?.trim() || email;
  return source.slice(0, 2).toUpperCase();
};

export const ShareModal = () => {
  const shareModal = useShareModal();
  const { user } = useSupabaseUser();

  const { data: document } = useDocument(shareModal.documentId, {
    enabled: shareModal.isOpen,
  });
  const { data: shares } = useDocumentShares(
    shareModal.isOpen ? shareModal.documentId : undefined,
  );
  const { data: orgUsers } = useOrgUsers();

  const { mutate: addShare, isPending: isAdding } = useAddShare();
  const { mutate: removeShare } = useRemoveShare();

  const [search, setSearch] = useState("");

  const sharedUserIds = useMemo(
    () => new Set((shares ?? []).map((s) => s.user_id)),
    [shares],
  );

  const candidates = useMemo(
    () =>
      (orgUsers ?? []).filter(
        (u) => u.id !== user?.id && !sharedUserIds.has(u.id),
      ),
    [orgUsers, user?.id, sharedUserIds],
  );

  const grantees = useMemo(
    () =>
      (shares ?? [])
        .map((s) => ({
          share: s,
          profile: orgUsers?.find((u) => u.id === s.user_id),
        }))
        .filter((row) => !!row.profile),
    [shares, orgUsers],
  );

  const onAdd = (userId: string) => {
    if (!shareModal.documentId) return;
    addShare({ documentId: shareModal.documentId, userId });
    setSearch("");
  };

  const onRemove = (userId: string) => {
    if (!shareModal.documentId) return;
    removeShare({ documentId: shareModal.documentId, userId });
  };

  return (
    <Dialog open={shareModal.isOpen} onOpenChange={shareModal.onClose}>
      <DialogContent className="dark:bg-dark">
        <DialogHeader className="border-b pb-2">
          <h2 className="truncate text-lg font-medium">
            Compartir {document?.title ? `"${document.title}"` : ""}
          </h2>
          <p className="text-muted-foreground text-[0.8rem]">
            Las personas que añadas aquí podrán ver y editar esta página y
            todo lo que cuelgue de ella.
          </p>
        </DialogHeader>

        <Command className="rounded-md border" shouldFilter={false}>
          <CommandInput
            placeholder="Buscar por nombre o email..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>No se encontraron personas.</CommandEmpty>
            <CommandGroup>
              {candidates
                .filter((u) =>
                  `${u.full_name ?? ""} ${u.email}`
                    .toLowerCase()
                    .includes(search.toLowerCase()),
                )
                .map((candidate) => (
                  <CommandItem
                    key={candidate.id}
                    value={candidate.id}
                    disabled={isAdding}
                    onSelect={() => onAdd(candidate.id)}
                  >
                    <Avatar size="sm" className="mr-2">
                      <AvatarFallback>
                        {initialsFor(candidate.email, candidate.full_name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="truncate">
                      {candidate.full_name || candidate.email}
                    </span>
                  </CommandItem>
                ))}
            </CommandGroup>
          </CommandList>
        </Command>

        <div className="space-y-1">
          <p className="text-muted-foreground text-xs font-medium">
            Compartido con
          </p>
          {grantees.length === 0 && (
            <p className="text-muted-foreground py-2 text-sm">
              Aún no has compartido esto con nadie.
            </p>
          )}
          {grantees.map(({ share, profile }) => (
            <div
              key={share.id}
              className="flex items-center justify-between rounded-md px-1 py-1.5"
            >
              <div className="flex items-center gap-2 overflow-hidden">
                <Avatar size="sm">
                  <AvatarFallback>
                    {initialsFor(profile!.email, profile!.full_name)}
                  </AvatarFallback>
                </Avatar>
                <span className="truncate text-sm">
                  {profile!.full_name || profile!.email}
                </span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 shrink-0"
                onClick={() => onRemove(share.user_id)}
              >
                <X className="size-4" />
              </Button>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};
