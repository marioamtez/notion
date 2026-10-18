"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import {
  DndContext,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import {
  restrictToVerticalAxis,
  restrictToParentElement,
} from "@dnd-kit/modifiers";
import { CSS } from "@dnd-kit/utilities";

import { useSidebar } from "@/hooks/useDocumentQueries";
import {
  useReorderDocuments,
  useToggleFavoriteDocument,
} from "@/hooks/useDocumentMutations";
import { useSupabaseUser } from "@/hooks/useSupabaseUser";
import type { Document } from "@/types/document";

import { DocumentList } from "./DocumentList";
import { Item } from "./Item";

import { FileIcon, Globe, Lock } from "lucide-react";
import { toast } from "sonner";

interface RootSortableItemProps {
  document: Document;
  onExpand: (id: string) => void;
  expanded: boolean;
  onRedirect: (id: string) => void;
  activeId?: string | string[];
  onFavorite: (id: string) => void;
  isOwnRow: boolean;
  navDrawer?: boolean;
}

const RootSortableItem = ({
  document,
  onExpand,
  expanded,
  onRedirect,
  activeId,
  onFavorite,
  isOwnRow,
  navDrawer,
}: RootSortableItemProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: document.id, disabled: !isOwnRow });

  const style = {
    transform: CSS.Transform.toString(
      transform ? { ...transform, scaleY: 1, scaleX: 1 } : null,
    ),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 100 : undefined,
    cursor: isDragging ? "grabbing" : "pointer",
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <Item
        id={document.id}
        onClick={() => onRedirect(document.id)}
        label={document.title}
        icon={FileIcon}
        documentIcon={document.icon ?? undefined}
        active={activeId === document.id}
        level={0}
        onExpand={() => onExpand(document.id)}
        expanded={expanded}
        isFavorite={document.is_favorite}
        onFavorite={() => onFavorite(document.id)}
        showDragHandle={isOwnRow}
        navDrawer={navDrawer}
      />
      {expanded && (
        <DocumentList
          parentDocumentId={document.id}
          level={1}
          navDrawer={navDrawer}
        />
      )}
    </div>
  );
};

interface RootDocumentListProps {
  navDrawer?: boolean;
}

export const RootDocumentList = ({ navDrawer }: RootDocumentListProps) => {
  const params = useParams();
  const router = useRouter();
  const { user } = useSupabaseUser();

  const { data: documents } = useSidebar(undefined);
  const { mutateAsync: reorder } = useReorderDocuments();
  const { mutateAsync: toggleFavorite } = useToggleFavoriteDocument();

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [isDragging, setIsDragging] = useState(false);
  const [orderedPersonal, setOrderedPersonal] = useState<Document[]>([]);
  const [orderedPublic, setOrderedPublic] = useState<Document[]>([]);

  useEffect(() => {
    if (isDragging || !documents) return;
    setOrderedPersonal(documents.filter((d) => d.space_type === "personal"));
    setOrderedPublic(documents.filter((d) => d.space_type === "public"));
  }, [documents]);

  const onExpand = (documentId: string) => {
    setExpanded((prev) => ({ ...prev, [documentId]: !prev[documentId] }));
  };

  const onRedirect = (documentId: string) => {
    router.push(`/documents/${documentId}`);
  };

  const onToggleFavorite = (id: string) => {
    const promise = toggleFavorite({ id });
    toast.promise(promise, {
      loading: "Actualizando favoritos...",
      success: "¡Favoritos actualizados!",
      error: "No se pudieron actualizar los favoritos.",
    });
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const makeDragEndHandler =
    (
      section: Document[],
      setSection: (docs: Document[]) => void,
    ) =>
    (event: DragEndEvent) => {
      setIsDragging(false);
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = section.findIndex((doc) => doc.id === active.id);
      const newIndex = section.findIndex((doc) => doc.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;

      const reordered = arrayMove(section, oldIndex, newIndex);
      setSection(reordered);
      reorder({
        parentId: undefined,
        orderedIds: reordered.map((doc) => doc.id),
      });
    };

  const isLoading = documents === undefined;

  return (
    <div className="w-full">
      <p className="text-muted-foreground/60 flex items-center gap-1 px-3 py-1 text-xs font-medium">
        <Lock className="size-3 shrink-0" />
        Espacio personal
      </p>
      {!isLoading && orderedPersonal.length === 0 && (
        <p className="text-muted-foreground/80 px-3 py-1 text-sm font-medium">
          No tienes páginas aquí todavía
        </p>
      )}
      <DndContext
        sensors={sensors}
        onDragStart={() => {
          setIsDragging(true);
          document.body.classList.add("cursor-grabbing");
        }}
        onDragEnd={(event) => {
          document.body.classList.remove("cursor-grabbing");
          makeDragEndHandler(orderedPersonal, setOrderedPersonal)(event);
        }}
        modifiers={[restrictToVerticalAxis, restrictToParentElement]}
        collisionDetection={closestCorners}
      >
        <SortableContext
          items={orderedPersonal.map((doc) => doc.id)}
          strategy={verticalListSortingStrategy}
        >
          {orderedPersonal.map((doc) => (
            <RootSortableItem
              key={doc.id}
              document={doc}
              onExpand={onExpand}
              expanded={!!expanded[doc.id]}
              onRedirect={onRedirect}
              activeId={params.documentId}
              onFavorite={onToggleFavorite}
              isOwnRow={doc.user_id === user?.id}
              navDrawer={navDrawer}
            />
          ))}
        </SortableContext>
      </DndContext>

      <p className="text-muted-foreground/60 mt-3 flex items-center gap-1 px-3 py-1 text-xs font-medium">
        <Globe className="size-3 shrink-0" />
        Pilas públicas
      </p>
      {!isLoading && orderedPublic.length === 0 && (
        <p className="text-muted-foreground/80 px-3 py-1 text-sm font-medium">
          Aún no hay ninguna pila pública
        </p>
      )}
      <DndContext
        sensors={sensors}
        onDragStart={() => {
          setIsDragging(true);
          document.body.classList.add("cursor-grabbing");
        }}
        onDragEnd={(event) => {
          document.body.classList.remove("cursor-grabbing");
          makeDragEndHandler(orderedPublic, setOrderedPublic)(event);
        }}
        modifiers={[restrictToVerticalAxis, restrictToParentElement]}
        collisionDetection={closestCorners}
      >
        <SortableContext
          items={orderedPublic.map((doc) => doc.id)}
          strategy={verticalListSortingStrategy}
        >
          {orderedPublic.map((doc) => (
            <RootSortableItem
              key={doc.id}
              document={doc}
              onExpand={onExpand}
              expanded={!!expanded[doc.id]}
              onRedirect={onRedirect}
              activeId={params.documentId}
              onFavorite={onToggleFavorite}
              isOwnRow={doc.user_id === user?.id}
              navDrawer={navDrawer}
            />
          ))}
        </SortableContext>
      </DndContext>
    </div>
  );
};
