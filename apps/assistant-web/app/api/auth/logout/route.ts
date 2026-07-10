import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const SESSION_COOKIE = "assistant_session";
const API_BASE_URL =
  process.env.ASSISTANT_API_URL ??
  process.env.NEXT_PUBLIC_ASSISTANT_API_URL ??
  "http://localhost:8000";

// Logout BFF: revoke the session server-side (best effort) and clear the cookie.
export async function POST() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    try {
      await fetch(`${API_BASE_URL}/v1/auth/logout`, {
        method: "POST",
        headers: { authorization: `Bearer ${token}` },
        cache: "no-store"
      });
    } catch {
      // Clear the cookie even if the revoke call cannot be reached.
    }
  }
  store.delete(SESSION_COOKIE);
  return NextResponse.json({ ok: true });
}
