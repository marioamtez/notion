"use client";

import { useRouter } from "next/navigation";
import { useDocument } from "@/hooks/useDocumentQueries";
import {
  useArchiveDocument,
  useUpdateDocument,
} from "@/hooks/useDocumentMutations";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AArrowDown,
  Maximize2,
  MoreHorizontal,
  Settings,
  TableOfContents,
  Trash,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useSettings } from "@/hooks/useSettingsModal";
import { ActionTooltip } from "@/components/action-tooltip";
import { useWordCount } from "@/hooks/useWordCount";
import { Switch } from "@/components/ui/switch";

interface MenuProps {
  documentId: string;
}

export const Menu = ({ documentId }: MenuProps) => {
  const router = useRouter();

  const settings = useSettings();
  const words = useWordCount();

  const { data: document } = useDocument(documentId);
  const { mutateAsync: archive } = useArchiveDocument();
  const { mutateAsync: update } = useUpdateDocument();

  const isFullWidth = document?.full_width ?? true;
  const toggleToc = document?.show_toc ?? true;
  const isSmallText = !!document?.small_text;

  const onArchive = () => {
    router.push("/documents");
    const promise = archive({ id: documentId });

    toast.promise(promise, {
      loading: "Moving to trash...",
      success: "Note moved to trash!",
      error: "Failed to archive note.",
    });
  };

  const onFullWidthChange = (checked: boolean) => {
    update({
      id: documentId,
      full_width: checked,
    });
  };

  const onSmallTextChange = (checked: boolean) => {
    update({
      id: documentId,
      small_text: checked,
    });
  };

  const onTocChange = (checked: boolean) => {
    update({
      id: documentId,
      show_toc: checked,
    });
  };

  return (
    <DropdownMenu>
      <ActionTooltip label="Page actions">
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="ghost" aria-label="Page actions">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
      </ActionTooltip>
      <DropdownMenuContent
        className="w-65 px-2"
        align="end"
        alignOffset={8}
        forceMount
      >
        <MenuToggleItem
          label="Small text"
          icon={AArrowDown}
          checked={isSmallText}
          onChange={onSmallTextChange}
        />
        <MenuToggleItem
          label="Full width"
          icon={Maximize2}
          checked={isFullWidth}
          onChange={onFullWidthChange}
        />
        <MenuToggleItem
          label="Show table of contents"
          icon={TableOfContents}
          checked={toggleToc}
          onChange={onTocChange}
        />
        <DropdownMenuSeparator className="mx-1.5" />
        <DropdownMenuItem onClick={settings.onOpen}>
          <Settings className="mr-2 h-4 w-4" />
          Settings
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onArchive}>
          <Trash className="mr-2 h-4 w-4" />
          Move to Trash
        </DropdownMenuItem>
        <DropdownMenuSeparator className="mx-1.5" />
        <div className="text-muted-foreground/70 space-y-0.5 p-2 text-[.6875rem]">
          <p>
            Word count: {words.wordCount}{" "}
            {words.wordCount === 1 ? "word" : "words"}
          </p>
          <p>
            Last edited on{" "}
            {document
              ? new Date(
                  document.updated_at ?? document.created_at,
                ).toLocaleString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: true,
                })
              : "..."}
          </p>
          <p>
            Created on{" "}
            {document
              ? new Date(document.created_at).toLocaleString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })
              : "..."}
          </p>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

Menu.Skeleton = function MenuSkeleton() {
  return <Skeleton className="h-8 w-8" />;
};

const MenuToggleItem = ({
  label,
  icon: Icon,
  checked,
  onChange,
}: {
  label: string;
  icon: React.FC<{ className?: string }>;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) => (
  <DropdownMenuItem
    onSelect={(e) => e.preventDefault()}
    onClick={() => {
      onChange(!checked);
    }}
    className="flex items-center justify-between"
  >
    <div className="flex items-center justify-between gap-1">
      <Icon
        className={`mr-2 h-4 w-4 ${label === "Full width" ? "rotate-45" : " "}`}
      />
      {label}
    </div>
    <Switch size="sm" checked={checked} onCheckedChange={onChange} />
  </DropdownMenuItem>
);
