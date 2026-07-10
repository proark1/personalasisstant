"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FormEvent } from "react";

function nextDestination(): string {
  if (typeof window === "undefined") {
    return "/";
  }
  const next = new URLSearchParams(window.location.search).get("next");
  return next && next.startsWith("/") ? next : "/";
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setWorking(true);
    setError(null);
    try {
      // The BFF route sets the session in an httpOnly cookie; the token never
      // touches client JavaScript.
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(email || password ? { email, password } : {})
      });
      if (response.status === 401) {
        setError("Invalid email or password.");
        setWorking(false);
        return;
      }
      if (response.status === 503) {
        setError("Sign-in is paused: the OneBrain identity service is not reachable.");
        setWorking(false);
        return;
      }
      if (!response.ok) {
        setError("Sign-in failed. Please try again.");
        setWorking(false);
        return;
      }
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
          Use your OneBrain account. Your assistant is protected: sign in to reach today&rsquo;s
          work, follow-ups, and approvals.
        </p>
        <form className="auth-form" onSubmit={signIn}>
          <label className="field-label" htmlFor="login-email">
            Email
          </label>
          <input
            id="login-email"
            className="text-field"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
          />
          <label className="field-label" htmlFor="login-password">
            Password
          </label>
          <input
            id="login-password"
            className="text-field"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <button
            className="text-button"
            data-variant="primary"
            type="submit"
            disabled={working}
            style={{ width: "100%" }}
          >
            {working ? "Signing in…" : "Sign in"}
          </button>
        </form>
        {error ? (
          <p className="auth-error" role="alert">
            {error}
          </p>
        ) : null}
      </section>
    </main>
  );
}
