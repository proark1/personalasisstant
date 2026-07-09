"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { SESSION_COOKIE } from "../../src/api/client";

const API_BASE_URL = process.env.NEXT_PUBLIC_ASSISTANT_API_URL ?? "http://localhost:8000";

function nextDestination(): string {
  if (typeof window === "undefined") {
    return "/";
  }
  const next = new URLSearchParams(window.location.search).get("next");
  return next && next.startsWith("/") ? next : "/";
}

export default function LoginPage() {
  const router = useRouter();
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signIn() {
    setWorking(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/v1/auth/login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({})
      });
      if (response.status === 503) {
        setError("Sign-in is paused until the OneBrain identity service is connected.");
        setWorking(false);
        return;
      }
      if (!response.ok) {
        setError("Sign-in failed. Please try again.");
        setWorking(false);
        return;
      }
      const body = (await response.json()) as { access_token: string };
      const secure = window.location.protocol === "https:" ? "; Secure" : "";
      document.cookie =
        `${SESSION_COOKIE}=${encodeURIComponent(body.access_token)}; path=/; SameSite=Lax` + secure;
      router.replace(nextDestination());
      router.refresh();
    } catch {
      setError("Could not reach the assistant service.");
      setWorking(false);
    }
  }

  return (
    <main className="auth-screen">
      <section className="auth-card">
        <div className="auth-brand">
          <span className="brand-mark">1B</span>
          OneBrain Assistant
        </div>
        <h1 className="auth-title">Sign in</h1>
        <p className="auth-subtitle">
          Your assistant is protected. Sign in to reach today&rsquo;s work, follow-ups, and
          approvals.
        </p>
        <button
          className="text-button"
          data-variant="primary"
          onClick={signIn}
          disabled={working}
          style={{ width: "100%" }}
        >
          {working ? "Signing in…" : "Sign in"}
        </button>
        {error ? (
          <p className="auth-error" role="alert">
            {error}
          </p>
        ) : null}
      </section>
    </main>
  );
}
