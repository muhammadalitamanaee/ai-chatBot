"use client";

import { useSession } from "next-auth/react";
import { SignOutButton } from "@/components/SignOutButton";
import { DarkModeToggle } from "@/components/DarkModeToggle";
import Image from "next/image";

export function UserPanel() {
  const { data: session, status } = useSession();
  const user = session?.user;

  // Optional: Show a subtle skeleton or blank state while checking auth
  if (status === "loading") {
    return (
      <div className="p-3 border-t border-neutral-200 dark:border-neutral-700 flex items-center gap-3 animate-pulse">
        <div className="w-8 h-8 rounded-full bg-neutral-200 dark:bg-neutral-700 flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-2.5 bg-neutral-200 dark:bg-neutral-700 rounded w-1/2" />
          <div className="h-2 bg-neutral-200 dark:bg-neutral-700 rounded w-3/4" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 border-t border-neutral-200 dark:border-neutral-700 flex items-center gap-3">
      {/* Avatar */}
      {user?.image ? (
        <Image
          src={user.image}
          alt={user.name ?? "User"}
          width={32}
          height={32}
          className="rounded-full flex-shrink-0"
          unoptimized // Useful if pulling external OAuth images locally
        />
      ) : (
        <div className="w-8 h-8 rounded-full bg-neutral-300 dark:bg-neutral-600 flex items-center justify-center text-xs font-medium flex-shrink-0">
          {user?.name?.[0]?.toUpperCase() ?? "?"}
        </div>
      )}

      {/* Name */}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-neutral-800 dark:text-neutral-200 truncate">
          {user?.name ?? "User"}
        </p>
        <p className="text-xs text-neutral-400 truncate">{user?.email ?? ""}</p>
      </div>

      {/* Dark mode + sign out */}
      <div className="flex items-center gap-1 flex-shrink-0">
        <DarkModeToggle />
        <SignOutButton />
      </div>
    </div>
  );
}
