"use client";

import { Spinner } from "@/components/spinner";
import { Button } from "@/components/ui/button";
import { useSupabaseUser } from "@/hooks/useSupabaseUser";
import { ArrowRight } from "lucide-react";
import Link from "next/link";

export const Heading = () => {
  const { user, isLoading } = useSupabaseUser();
  const isAuthenticated = !!user;

  return (
    <div className="max-w-3xl space-y-4">
      <h1 className="text-3xl font-bold sm:text-5xl md:text-5xl">
        Your Ideas💡, Documents📕, & Plans🚀. Welcome to{" "}
        <span className="underline">Zotion</span>
      </h1>
      <h2 className="text-base font-medium sm:text-xl">
        Zotion is the connected workspace where <br /> better, faster work
        happens.
      </h2>
      {isLoading && (
        <div className="flex w-full items-center justify-center">
          <Spinner size="md" />
        </div>
      )}
      {isAuthenticated && !isLoading && (
        <Button asChild>
          <Link href="/documents">
            Enter Zotion
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      )}
      {!isAuthenticated && !isLoading && (
        <Button asChild>
          <Link href="/sign-in">
            Log in to Zotion
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      )}
    </div>
  );
};
