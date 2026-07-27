"use client";

import { useEffect, useState } from "react";
import { File } from "lucide-react";
import { useRouter } from "next/navigation";
import { useSupabaseUser } from "@/hooks/useSupabaseUser";

import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useSearch } from "@/hooks/useSearch";
import { useSearchDocuments } from "@/hooks/useDocumentQueries";
import { DialogTitle } from "./ui/dialog";

export const SearchCommand = () => {
  const { user } = useSupabaseUser();
  const fullName = user?.user_metadata?.full_name ?? user?.user_metadata?.name;
  const router = useRouter();
  const { data: documents } = useSearchDocuments();
  const [isMounted, setIsMounted] = useState(false);

  const toggle = useSearch((store) => store.toggle);
  const isOpen = useSearch((store) => store.isOpen);
  const onClose = useSearch((store) => store.onClose);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        toggle();
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [toggle]);

  const onSelect = (id: string) => {
    router.push(`/documents/${id}`);
    onClose();
  };

  if (!isMounted) {
    return null;
  }

  return (
    <CommandDialog open={isOpen} onOpenChange={onClose}>
      <DialogTitle hidden>Search Documents</DialogTitle>
      <Command
        loop
        filter={(value, search) => {
          const [documentTitle = ""] = value.split("|");
          if (documentTitle.toLowerCase().includes(search.toLowerCase()))
            return 1;
          return 0;
        }}
      >
        <CommandInput placeholder={`Search ${fullName}'s Zotion..`} />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Documents" className="pb-1">
            {documents?.map((document) => (
              <CommandItem
                key={document.id}
                value={`${document.title}|${document.id}`}
                title={document.title}
                onSelect={() => onSelect(document.id)}
              >
                {document.icon ? (
                  <p className="mr-2 text-[1.125rem] leading-0">
                    {document.icon}
                  </p>
                ) : (
                  <File className="mr-2 h-4 w-4" />
                )}
                <span>{document.title}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </Command>
    </CommandDialog>
  );
};
