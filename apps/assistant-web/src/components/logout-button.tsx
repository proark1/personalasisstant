"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function LogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function signOut() {
    setBusy(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // Navigate to login regardless; the gate will require a fresh session.
    }
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="session-bar">
      <button
        className="text-button"
        data-variant="quiet"
        type="button"
        onClick={signOut}
        disabled={busy}
      >
        Sign out
      </button>
    </div>
  );
}
