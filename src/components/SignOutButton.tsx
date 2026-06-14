"use client";

import { handleSignOut } from "@/lib/actions";

export function SignOutButton() {
  return (
    <button
      onClick={() => handleSignOut()}
      className="text-xs text-neutral-400 hover:text-neutral-700 transition-colors"
    >
      Sign out
    </button>
  );
}
