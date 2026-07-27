"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useFavorites } from "@/hooks/useDocumentQueries";
import { useToggleFavoriteDocument } from "@/hooks/useDocumentMutations";
import { Item } from "./Item";
import { DocumentList } from "./DocumentList";
import { FileIcon, Star } from "lucide-react";
import { toast } from "sonner";

export const FavoritesList = ({ navDrawer }: { navDrawer?: boolean }) => {
  const params = useParams();
  const router = useRouter();
  const { data: documents } = useFavorites();
  const { mutateAsync: toggleFavorite } = useToggleFavoriteDocument();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const onToggleFavorite = (id: string) => {
    const promise = toggleFavorite({ id });
    toast.promise(promise, {
      loading: "Updating favorites...",
      success: "Favorites updated!",
      error: "Failed to update favorites.",
    });
  };

  const onExpand = (id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  if (documents === undefined) {
    return (
      <>
        <Item.Skeleton level={0} />
        <Item.Skeleton level={0} />
      </>
    );
  }

  if (documents.length === 0) return null;

  return (
    <div className="w-full">
      <p className="text-muted-foreground/60 flex items-center px-3 py-1 text-xs font-medium">
        <Star className="mr-1 size-3 shrink-0 fill-yellow-400 text-yellow-400" />
        Favorites
      </p>
      {documents.map((document) => (
        <div key={document.id}>
          <Item
            id={document.id}
            onClick={() => router.push(`/documents/${document.id}`)}
            label={document.title}
            icon={FileIcon}
            documentIcon={document.icon ?? undefined}
            active={params.documentId === document.id}
            level={0}
            expanded={expanded[document.id]}
            onExpand={() => onExpand(document.id)}
            isFavorite={document.is_favorite}
            onFavorite={() => onToggleFavorite(document.id)}
            showDragHandle={false}
            navDrawer={navDrawer}
          />
          {expanded[document.id] && (
            <DocumentList
              parentDocumentId={document.id}
              level={1}
              navDrawer={navDrawer}
            />
          )}
        </div>
      ))}
    </div>
  );
};
