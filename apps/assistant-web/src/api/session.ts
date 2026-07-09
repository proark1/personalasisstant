import { cookies } from "next/headers";

import { SESSION_COOKIE } from "./client";

// Server-only: reads the assistant session token from the request cookie so server
// components can authenticate their API calls. Presence is gated by middleware.ts.
export async function getServerSessionToken(): Promise<string | undefined> {
  const store = await cookies();
  return store.get(SESSION_COOKIE)?.value;
}
