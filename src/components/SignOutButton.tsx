"use client";

import { handleSignOut } from "@/lib/actions";

export function SignOutButton() {
  return (
    <button
      onClick={() => handleSignOut()}
      className="rounded-lg px-2 py-2 text-xs text-muted transition-colors hover:bg-surface-soft hover:text-foreground"
      aria-label="خروج از حساب"
    >
      خروج
    </button>
  );
}
