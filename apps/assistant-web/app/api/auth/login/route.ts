import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const SESSION_COOKIE = "assistant_session";
const API_BASE_URL =
  process.env.ASSISTANT_API_URL ??
  process.env.NEXT_PUBLIC_ASSISTANT_API_URL ??
  "http://localhost:8000";
const SESSION_TTL_SECONDS = Number(process.env.AUTH_SESSION_TTL_SECONDS ?? 43200);

// Login BFF: forward credentials to the assistant API and, on success, store the
// bearer in an httpOnly cookie so client JavaScript never holds the token.
export async function POST(request: NextRequest) {
  const payload = await request.text();
  let upstream: Response;
  try {
    upstream = await fetch(`${API_BASE_URL}/v1/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: payload || "{}",
      cache: "no-store"
    });
  } catch {
    return NextResponse.json({ detail: "Assistant API unreachable." }, { status: 502 });
  }

  if (!upstream.ok) {
    const detail = await upstream.text();
    return new NextResponse(detail, {
      status: upstream.status,
      headers: { "content-type": upstream.headers.get("content-type") ?? "application/json" }
    });
  }

  const body = (await upstream.json()) as {
    access_token: string;
    scope?: unknown;
    identity_source?: string;
  };
  const store = await cookies();
  store.set(SESSION_COOKIE, body.access_token, {
    httpOnly: true,
    sameSite: "lax",
    secure: request.nextUrl.protocol === "https:",
    path: "/",
    maxAge: SESSION_TTL_SECONDS
  });
  return NextResponse.json({
    ok: true,
    scope: body.scope,
    identity_source: body.identity_source
  });
}
