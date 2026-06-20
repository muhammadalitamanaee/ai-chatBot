"use client";

import { useEffect, useState } from "react";
import { SignOutButton } from "@/components/SignOutButton";
import { DarkModeToggle } from "@/components/DarkModeToggle";
import Image from "next/image";

export function UserPanel() {
  const [user, setUser] = useState<{
    name?: string | null;
    email?: string | null;
    image?: string | null;
  } | null>(null);

  useEffect(() => {
    // /api/auth/session is provided by NextAuth automatically
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((data) => setUser(data?.user ?? null))
      .catch(console.error);
  }, []);

  return (
    <div className="p-3 border-t border-neutral-200 dark:border-neutral-700 flex items-center gap-3">
      {user?.image ? (
        <Image
          src={user.image}
          alt={user.name ?? "User"}
          width={32}
          height={32}
          className="rounded-full flex-shrink-0"
        />
      ) : (
        <div className="w-8 h-8 rounded-full bg-neutral-300 dark:bg-neutral-600 flex items-center justify-center text-xs font-medium flex-shrink-0">
          {user?.name?.[0]?.toUpperCase() ?? "?"}
        </div>
      )}

      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-neutral-800 dark:text-neutral-200 truncate">
          {user?.name ?? "User"}
        </p>
        <p className="text-xs text-neutral-400 truncate">{user?.email ?? ""}</p>
      </div>

      <div className="flex items-center gap-1 flex-shrink-0">
        <DarkModeToggle />
        <SignOutButton />
      </div>
    </div>
  );
}
