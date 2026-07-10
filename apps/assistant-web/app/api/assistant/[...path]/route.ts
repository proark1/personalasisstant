import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const SESSION_COOKIE = "assistant_session";
const API_BASE_URL =
  process.env.ASSISTANT_API_URL ??
  process.env.NEXT_PUBLIC_ASSISTANT_API_URL ??
  "http://localhost:8000";

// Same-origin BFF proxy: the browser calls /api/assistant/v1/... with only the
// httpOnly session cookie; this handler attaches the bearer server-side and
// forwards to the assistant API. The token never reaches client JavaScript.
async function proxy(request: NextRequest, path: string[]): Promise<NextResponse> {
  if (path[0] !== "v1") {
    return NextResponse.json({ detail: "Not found." }, { status: 404 });
  }
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) {
    return NextResponse.json({ detail: "Authentication required." }, { status: 401 });
  }

  const url = `${API_BASE_URL}/${path.join("/")}${request.nextUrl.search}`;
  const headers: Record<string, string> = {
    authorization: `Bearer ${token}`,
    accept: "application/json"
  };
  let body: string | undefined;
  if (request.method !== "GET" && request.method !== "HEAD") {
    body = await request.text();
    headers["content-type"] = request.headers.get("content-type") ?? "application/json";
  }

  let upstream: Response;
  try {
    upstream = await fetch(url, { method: request.method, headers, body, cache: "no-store" });
  } catch {
    return NextResponse.json({ detail: "Assistant API unreachable." }, { status: 502 });
  }

  const text = await upstream.text();
  return new NextResponse(text, {
    status: upstream.status,
    headers: { "content-type": upstream.headers.get("content-type") ?? "application/json" }
  });
}

type Context = { params: Promise<{ path: string[] }> };

export async function GET(request: NextRequest, ctx: Context) {
  return proxy(request, (await ctx.params).path);
}

export async function POST(request: NextRequest, ctx: Context) {
  return proxy(request, (await ctx.params).path);
}
