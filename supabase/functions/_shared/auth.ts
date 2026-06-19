// Shared auth helper.
//
// Two paths into our edge functions:
//   1. End-user JWT in Authorization (the normal path)
//   2. Service-role bearer + x-telegram-user-id header — used when
//      another edge function (chat, telegram-router, dori-execute-action)
//      delegates on behalf of a known user. The header value MUST be
//      a UUID; anything else is rejected. Edge functions that call
//      each other should additionally pass an HMAC token (see
//      `mintInternalToken`/`verifyInternalToken` below) so a leaked
//      service key alone is not enough to impersonate a user.
//
// Both paths return a user_id; callers no longer have to hand-roll the
// six lines of auth boilerplate per function.

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface ResolvedAuth {
  userId: string;
  // True when the call came in via a service-role token (so the caller
  // is implicitly trusted). Useful for selectively relaxing checks
  // (e.g. allowing requests on behalf of a Telegram user).
  isInternal: boolean;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const INTERNAL_TOKEN_HEADER = "x-internal-token";
const INTERNAL_TOKEN_TTL_MS = 5 * 60 * 1000; // 5 min — covers retries, blocks replay.

function hexEncode(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hmacSha256(key: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(message));
  return hexEncode(new Uint8Array(sig));
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

// Sign an internal-call token. The secret is INTERNAL_AUTH_SECRET (set
// per-environment); rotation only requires updating the env var and
// re-deploying. Format: `${unixSecondsIssued}.${hex(hmac(secret, userId + '.' + issued))}`
export async function mintInternalToken(userId: string): Promise<string> {
  const secret = Deno.env.get("INTERNAL_AUTH_SECRET");
  if (!secret) throw new Error("INTERNAL_AUTH_SECRET not set");
  const issued = Math.floor(Date.now() / 1000);
  const sig = await hmacSha256(secret, `${userId}.${issued}`);
  return `${issued}.${sig}`;
}

async function verifyInternalToken(userId: string, token: string | null): Promise<boolean> {
  const secret = Deno.env.get("INTERNAL_AUTH_SECRET");
  if (!secret || !token) return false;
  const [issuedStr, sig] = token.split(".");
  const issued = Number(issuedStr);
  if (!Number.isFinite(issued) || !sig) return false;
  const ageMs = Date.now() - issued * 1000;
  if (ageMs < 0 || ageMs > INTERNAL_TOKEN_TTL_MS) return false;
  const expected = await hmacSha256(secret, `${userId}.${issued}`);
  return timingSafeEqual(expected, sig);
}

export async function resolveUserId(req: Request): Promise<ResolvedAuth | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return null;

  const token = authHeader.replace(/^Bearer\s+/i, "");
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!supabaseUrl) return null;

  // Path 2 first — cheap, no network call. Validate UUID before use so
  // a hostile header (`x-telegram-user-id: '%' OR 1=1`) can't reach any
  // downstream SQL even if a query is built unsafely.
  const tgUserId = req.headers.get("x-telegram-user-id");
  if (serviceKey && token === serviceKey && tgUserId) {
    if (!UUID_RE.test(tgUserId)) {
      console.warn("[auth] rejected non-UUID x-telegram-user-id");
      return null;
    }
    // Require a valid HMAC token for service-role delegation. This means a
    // leaked service key alone is not enough — the attacker also needs the
    // rotating signing key. Local/transition environments can temporarily set
    // ALLOW_LEGACY_INTERNAL_AUTH=true, but production should not.
    const internalSecret = Deno.env.get("INTERNAL_AUTH_SECRET");
    if (internalSecret) {
      const ok = await verifyInternalToken(tgUserId, req.headers.get(INTERNAL_TOKEN_HEADER));
      if (!ok) {
        console.warn("[auth] internal token missing or invalid for", tgUserId);
        return null;
      }
    } else if (Deno.env.get("ALLOW_LEGACY_INTERNAL_AUTH") === "true") {
      console.warn(
        "[auth] ALLOW_LEGACY_INTERNAL_AUTH=true — service-role + x-telegram-user-id path is unprotected",
      );
    } else {
      console.warn(
        "[auth] INTERNAL_AUTH_SECRET unset — rejecting service-role + x-telegram-user-id delegation",
      );
      return null;
    }
    return { userId: tgUserId, isInternal: true };
  }

  // Path 1 — verify with Supabase.
  try {
    const userClient = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY") || "",
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data, error } = await userClient.auth.getUser();
    if (error || !data?.user) return null;
    return { userId: data.user.id, isInternal: false };
  } catch {
    return null;
  }
}

// Convenience: pull the admin (service-role) client. Every edge fn that
// reads/writes on behalf of the resolved user will need this.
export function adminClient(): SupabaseClient {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(supabaseUrl, serviceKey);
}
