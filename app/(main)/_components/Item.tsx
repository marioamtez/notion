"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useParams, useRouter } from "next/navigation";
import {
  useArchiveDocument,
  useConvertSpaceType,
  useCreateDocument,
  useRestoreDocument,
} from "@/hooks/useDocumentMutations";
import { useDocument } from "@/hooks/useDocumentQueries";
import { useSupabaseUser } from "@/hooks/useSupabaseUser";
import { useShareModal } from "@/hooks/useShareModal";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  ChevronDown,
  ChevronRight,
  Globe,
  GripVertical,
  Lock,
  LucideIcon,
  MoreHorizontal,
  Plus,
  Settings,
  Star,
  Trash,
  Users,
} from "lucide-react";

import { ActionTooltip } from "@/components/action-tooltip";
import { useNavDrawer } from "@/hooks/useNavDrawer";

interface ItemProps {
  id?: string;
  documentIcon?: string;
  active?: boolean;
  expanded?: boolean;
  level?: number;
  onExpand?: () => void;
  label?: string;
  onClick?: () => void;
  icon: LucideIcon;
  isFavorite?: boolean;
  onFavorite?: () => void;
  shortcut?: string;
  showDragHandle?: boolean;
  navDrawer?: boolean;
}

export const Item = ({
  id,
  label,
  onClick,
  icon: Icon,
  active,
  documentIcon,
  level = 0,
  onExpand,
  expanded,
  isFavorite,
  onFavorite,
  shortcut,
  showDragHandle = true,
  navDrawer,
}: ItemProps) => {
  const router = useRouter();
  const params = useParams();

  const { setInnerPopoverOpen } = useNavDrawer();
  const { user } = useSupabaseUser();
  const shareModal = useShareModal();

  const { mutateAsync: create } = useCreateDocument();
  const { mutateAsync: archive } = useArchiveDocument();
  const { mutateAsync: restore } = useRestoreDocument();
  const { mutate: convertSpaceType } = useConvertSpaceType();

  const { data: document } = useDocument(id, { enabled: !!id });

  const isOwner = !!document && !!user && document.user_id === user.id;
  const isRoot = !!document && document.parent_document === null;

  const onArchive = (event: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    event.stopPropagation();
    if (!id) return;

    if (params.documentId === id) {
      router.push("/documents");
    }

    const promise = archive({ id });

    toast.promise(promise, {
      loading: "Moviendo a la papelera...",
      error: "No se pudo archivar la nota.",
    });

    promise.then(() => {
      toast("Nota movida a la papelera", {
        action: {
          label: "Deshacer",
          onClick: () => restore({ id }),
        },
      });
    });
  };

  const handleExpand = (
    event: React.MouseEvent<HTMLDivElement, MouseEvent>,
  ) => {
    event.stopPropagation();
    onExpand?.();
  };

  const onCreate = (event: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    event.stopPropagation();
    if (!id) return;

    const promise = create({ title: "Sin título", parent_document: id }).then(
      (doc) => {
        if (!expanded) {
          onExpand?.();
        }
        router.push(`/documents/${doc.id}`);
      },
    );

    toast.promise(promise, {
      loading: "Creando nota nueva",
      success: "Nota creada.",
      error: "No se pudo crear la nota.",
    });
  };

  const onOpenChange = (open: boolean) => {
    if (!navDrawer) return;
    setInnerPopoverOpen(open);
  };

  const ChevronIcon = expanded ? ChevronDown : ChevronRight;

  return (
    <div
      onClick={onClick}
      role="button"
      style={{ paddingLeft: level ? `${level * 12 + 12}px` : "12px" }}
      className={cn(
        "group text-muted-foreground hover:bg-primary/5 relative flex min-h-6.75 w-full items-center py-1 pr-3 text-sm font-medium",
        active && "bg-primary/5 text-primary",
        navDrawer && !id ? "rounded-full" : "rounded-none",
      )}
    >
      <div className="group flex items-center justify-center truncate">
        {!!id && showDragHandle && (
          <GripVertical className="text-muted-foreground/50 absolute left-0.5 size-3 opacity-0 group-hover:opacity-100" />
        )}
        {!!id && (
          <div
            role="button"
            aria-label={expanded ? "Contraer página" : "Expandir página"}
            aria-expanded={!!expanded}
            className="mr-1 h-full rounded-sm hover:bg-neutral-300 dark:hover:bg-neutral-600"
            onClick={handleExpand}
          >
            <ChevronIcon className="text-muted-foreground/50 h-4 w-4 shrink-0" />
          </div>
        )}
        {documentIcon ? (
          <div className="mr-1 shrink-0 text-[1.125rem] leading-none">
            {documentIcon}
          </div>
        ) : (
          <Icon
            className={`text-muted-foreground h-4.5 w-4.5 shrink-0 ${navDrawer && Icon === Settings ? "mr-0" : "mr-2"}`}
          />
        )}
        {label && (
          <span className="truncate" title={label}>
            {label}
          </span>
        )}
        {isRoot && (
          <ActionTooltip
            label={
              document!.space_type === "public"
                ? "Pila pública: visible para todo Mbrand"
                : "Espacio personal: solo tú lo ves"
            }
          >
            {document!.space_type === "public" ? (
              <Globe className="ml-1.5 size-3 shrink-0 text-sky-500" />
            ) : (
              <Lock className="text-muted-foreground/50 ml-1.5 size-3 shrink-0" />
            )}
          </ActionTooltip>
        )}
        {!isRoot && document?.is_shared && (
          <ActionTooltip label="Compartido con acceso restringido">
            <Users className="text-muted-foreground/50 ml-1.5 size-3 shrink-0" />
          </ActionTooltip>
        )}
      </div>
      {shortcut && (
        <kbd className="bg-muted text-muted-foreground pointer-events-none ml-auto hidden h-5 items-center gap-1 rounded border px-1.5 font-mono text-[.625rem] font-medium opacity-100 select-none md:inline-flex dark:bg-neutral-700">
          {shortcut}
        </kbd>
      )}
      {!!id && (
        <div className="ml-auto flex items-center gap-x-2">
          <ActionTooltip label="Añadir subpágina">
            <div
              role="button"
              aria-label="Añadir subpágina"
              onClick={onCreate}
              className="ml-auto h-full rounded-sm opacity-100 transition hover:bg-neutral-300 md:opacity-0 md:group-hover:opacity-100 dark:hover:bg-neutral-600"
            >
              <Plus className="text-muted-foreground h-4 w-4" />
            </div>
          </ActionTooltip>
          <DropdownMenu onOpenChange={navDrawer ? onOpenChange : undefined}>
            <ActionTooltip label="Más acciones">
              <DropdownMenuTrigger onClick={(e) => e.stopPropagation()} asChild>
                <div
                  role="button"
                  aria-label="Más acciones"
                  className="ml-auto h-full rounded-sm opacity-100 transition hover:bg-neutral-300 md:opacity-0 md:group-hover:opacity-100 dark:hover:bg-neutral-600"
                >
                  <MoreHorizontal className="text-muted-foreground h-4 w-4" />
                </div>
              </DropdownMenuTrigger>
            </ActionTooltip>
            <DropdownMenuContent
              className="w-65"
              align="start"
              side="right"
              forceMount
            >
              {isOwner && (
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onFavorite?.();
                  }}
                >
                  <Star
                    className={cn(
                      "mr-2 h-4 w-4",
                      isFavorite && "fill-yellow-400 text-yellow-400",
                    )}
                  />
                  {isFavorite ? "Quitar de favoritos" : "Añadir a favoritos"}
                </DropdownMenuItem>
              )}
              {isOwner && (
                <DropdownMenuItem onClick={onArchive}>
                  <Trash className="mr-2 h-4 w-4" />
                  Eliminar
                </DropdownMenuItem>
              )}
              {isRoot && isOwner && (
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    convertSpaceType({
                      id: id!,
                      spaceType:
                        document!.space_type === "public"
                          ? "personal"
                          : "public",
                    });
                  }}
                >
                  {document!.space_type === "public" ? (
                    <>
                      <Lock className="mr-2 h-4 w-4" />
                      Convertir en espacio personal
                    </>
                  ) : (
                    <>
                      <Globe className="mr-2 h-4 w-4" />
                      Convertir en pila pública
                    </>
                  )}
                </DropdownMenuItem>
              )}
              {isOwner && (
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    shareModal.onOpen(id!);
                  }}
                >
                  <Users className="mr-2 h-4 w-4" />
                  Compartir...
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <div className="space-y-0.5 p-2 text-[.6875rem]">
                <p className="text-muted-foreground/70">
                  Última edición el{" "}
                  {document
                    ? new Date(
                        document.updated_at ?? document.created_at,
                      ).toLocaleString("es-ES", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "..."}
                </p>
                <p className="text-muted-foreground/70">
                  Creado el{" "}
                  {document
                    ? new Date(document.created_at).toLocaleString("es-ES", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })
                    : "..."}
                </p>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </div>
  );
};

Item.Skeleton = function ItemSkeleton({ level }: { level?: number }) {
  return (
    <div
      style={{ paddingLeft: level ? `${level * 12 + 25}px` : "12px" }}
      className="flex gap-x-2 py-0.75"
    >
      <Skeleton className="h-4 w-4" />
      <Skeleton className="h-4 w-[30%]" />
    </div>
  );
};
