"use client";

import { useState, useEffect } from "react";
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
import type { Document } from "@/types/document";

import { Item } from "./Item";

import { FileIcon } from "lucide-react";
import { toast } from "sonner";

interface SortableItemProps {
  document: Document;
  level: number;
  onExpand: (id: string) => void;
  expanded: boolean;
  onRedirect: (id: string) => void;
  activeId?: string | string[];
  isFavorite?: boolean;
  onFavorite?: (id: string) => void;
  navDrawer?: boolean;
}
interface DocumentListProps {
  parentDocumentId?: string;
  level?: number;
  data?: Document[];
  navDrawer?: boolean;
}

const SortableItem = ({
  document,
  level,
  onExpand,
  expanded,
  onRedirect,
  activeId,
  onFavorite,
  navDrawer,
}: SortableItemProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: document.id });

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
        level={level}
        onExpand={() => onExpand(document.id)}
        expanded={expanded}
        isFavorite={document.is_favorite}
        onFavorite={() => onFavorite?.(document.id)}
        navDrawer={navDrawer}
      />
      {expanded && (
        <DocumentList
          parentDocumentId={document.id}
          level={level + 1}
          navDrawer={navDrawer}
        />
      )}
    </div>
  );
};

export const DocumentList = ({
  parentDocumentId,
  level = 0,
  navDrawer,
}: DocumentListProps) => {
  const params = useParams();
  const router = useRouter();

  const { mutateAsync: reorder } = useReorderDocuments();
  const { mutateAsync: toggleFavorite } = useToggleFavoriteDocument();

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [isDragging, setIsDragging] = useState(false);
  const [orderedDocuments, setOrderedDocuments] = useState<Document[]>([]);

  const { data: documents } = useSidebar(parentDocumentId);

  useEffect(() => {
    if (isDragging) {
      return;
    }
    if (documents) {
      setOrderedDocuments(documents);
    }
  }, [documents]);

  const onExpand = (documentId: string) => {
    setExpanded((prevExpanded) => ({
      ...prevExpanded,
      [documentId]: !prevExpanded[documentId],
    }));
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    setIsDragging(false);

    const { active, over } = event;

    if (!over) return;

    if (active.id !== over.id) {
      const oldIndex = orderedDocuments.findIndex(
        (doc) => doc.id === active.id,
      );
      const newIndex = orderedDocuments.findIndex((doc) => doc.id === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        const reordered = arrayMove(orderedDocuments, oldIndex, newIndex);
        setOrderedDocuments(reordered);
        reorder({
          parentId: parentDocumentId,
          orderedIds: reordered.map((doc) => doc.id),
        });
      }
    }
  };

  const onToggleFavorite = (id: string) => {
    const promise = toggleFavorite({ id });
    toast.promise(promise, {
      loading: "Updating favorites...",
      success: "Favorites updated!",
      error: "Failed to update favorites.",
    });
  };

  const onRedirect = (documentId: string) => {
    router.push(`/documents/${documentId}`);
  };

  if (documents === undefined) {
    return (
      <>
        <Item.Skeleton level={level} />
        {level === 0 && (
          <>
            <Item.Skeleton level={level} />
            <Item.Skeleton level={level} />
          </>
        )}
      </>
    );
  }

  return (
    <div className="w-full">
      {orderedDocuments.length === 0 && level !== 0 && (
        <p
          style={{ paddingLeft: level ? `${level * 12 + 25}px` : undefined }}
          className="text-muted-foreground/80 py-1 text-sm font-medium"
        >
          No pages inside
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
          handleDragEnd(event);
        }}
        modifiers={[restrictToVerticalAxis, restrictToParentElement]}
        collisionDetection={closestCorners}
      >
        <SortableContext
          items={orderedDocuments.map((doc) => doc.id)}
          strategy={verticalListSortingStrategy}
        >
          {orderedDocuments.map((document) => (
            <SortableItem
              key={document.id}
              document={document}
              level={level}
              onExpand={onExpand}
              expanded={expanded[document.id]}
              onRedirect={onRedirect}
              activeId={params.documentId}
              isFavorite={document.is_favorite}
              onFavorite={onToggleFavorite}
              navDrawer={navDrawer}
            />
          ))}
        </SortableContext>
      </DndContext>
    </div>
  );
};
