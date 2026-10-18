"use client";

import { useScrollTop } from "@/hooks/useScrollTop";
import { cn } from "@/lib/utils";
import { Logo } from "./Logo";
import { ModeToggle } from "@/components/mode-toggle";
import { useSupabaseUser } from "@/hooks/useSupabaseUser";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/spinner";
import { UserItem } from "@/app/(main)/_components/UserItem";
import Link from "next/link";

export const Navbar = () => {
  const { user, isLoading } = useSupabaseUser();
  const isAuthenticated = !!user;
  const scrolled = useScrollTop();

  return (
    <nav
      className={cn(
        "bg-background dark:bg-dark sticky inset-x-0 top-0 z-50 mx-auto flex w-full items-center p-6",
        scrolled && "border-b shadow-xs",
      )}
    >
      <Logo />
      <div className="flex w-full items-center justify-end md:ml-auto">
        <div className="flex items-center gap-x-2">
          {isLoading && <Spinner />}
          {!isLoading && !isAuthenticated && (
            <Button className="hidden md:block" variant="ghost" size="sm" asChild>
              <Link href="/sign-in">Log In</Link>
            </Button>
          )}

          {isAuthenticated && !isLoading && (
            <>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/documents"> Enter Zotion </Link>
              </Button>
              <UserItem />
            </>
          )}
          <ModeToggle />
        </div>
      </div>
    </nav>
  );
};
