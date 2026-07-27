"use client";

import Image from "next/image";
import { useSupabaseUser } from "@/hooks/useSupabaseUser";
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";
import { useCreateDocument } from "@/hooks/useDocumentMutations";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

const DocumentsPage = () => {
  const { user } = useSupabaseUser();
  const firstName =
    user?.user_metadata?.first_name ??
    user?.user_metadata?.full_name?.split(" ")[0] ??
    user?.email;
  const router = useRouter();
  const { mutateAsync: create } = useCreateDocument();

  const onCreate = () => {
    const promise = create({ title: "Untitled" }).then((doc) =>
      router.push(`/documents/${doc.id}`),
    );

    toast.promise(promise, {
      loading: "Creating a new note....",
      success: "New note created!",
      error: "Failed to create a new note.",
    });
  };

  return (
    <div className="flex h-full flex-col items-center justify-center space-y-4">
      <Image
        src="/empty.svg"
        alt="empty"
        height={760}
        width={1036}
        priority
        className="size-75 dark:hidden"
      />
      <Image
        src="/empty-dark.svg"
        alt="empty"
        height={760}
        width={1036}
        priority
        className="hidden size-75 dark:block"
      />
      <h2 className="text-lg font-medium">
        Welcome to {firstName}&apos;s Zotion
      </h2>
      <Button onClick={onCreate}>
        <PlusCircle className="mr-2 h-4 w-4" />
        Create a note
      </Button>
    </div>
  );
};
export default DocumentsPage;
