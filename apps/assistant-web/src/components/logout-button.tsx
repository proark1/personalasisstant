"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { SESSION_COOKIE } from "../api/client";

const API_BASE_URL = process.env.NEXT_PUBLIC_ASSISTANT_API_URL ?? "http://localhost:8000";

function readCookie(name: string): string | undefined {
  if (typeof document === "undefined") {
    return undefined;
  }
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : undefined;
}

export function LogoutButton() {
  const router = useRouter();
  const [token, setToken] = useState<string | undefined>(undefined);

  useEffect(() => {
    setToken(readCookie(SESSION_COOKIE));
  }, []);

  if (!token) {
    return null;
  }

  async function signOut() {
    try {
      await fetch(`${API_BASE_URL}/v1/auth/logout`, {
        method: "POST",
        headers: { authorization: `Bearer ${token}` }
      });
    } catch {
      // Clear the local cookie even if the revoke call cannot be reached.
    }
    document.cookie = `${SESSION_COOKIE}=; path=/; Max-Age=0; SameSite=Lax`;
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="session-bar">
      <button className="text-button" data-variant="quiet" onClick={signOut}>
        Sign out
      </button>
    </div>
  );
}
