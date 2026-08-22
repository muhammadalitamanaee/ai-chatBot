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
    <div className="flex items-center gap-3 border-t border-border p-3">
      {user?.image ? (
        <Image
          src={user.image}
          alt={user.name ?? "کاربر"}
          width={32}
          height={32}
          className="shrink-0 rounded-xl"
        />
      ) : (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-surface-soft text-xs font-medium text-foreground">
          {user?.name?.[0]?.toUpperCase() ?? "?"}
        </div>
      )}

      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-foreground">
          {user?.name ?? "کاربر"}
        </p>
        <p dir="ltr" className="truncate text-left text-[10px] text-muted">{user?.email ?? ""}</p>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <DarkModeToggle />
        <SignOutButton />
      </div>
    </div>
  );
}
