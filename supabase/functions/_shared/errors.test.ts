// Run with: deno test --allow-env supabase/functions/_shared/errors.test.ts
//
// Proves respondError() does NOT leak internal detail: a raw Error with
// a SQL-ish / path-ish message must come back as the generic string,
// while an intentionally code-tagged short message is allowed through.
// Every response carries a request_id and the CORS headers.

import { assert, assertEquals, assertMatch } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { respondClientError, respondError } from "./errors.ts";

const PROD = "https://app.darai.example";

function setup() {
  Deno.env.set("APP_URL", PROD);
}
function req(): Request {
  return new Request("http://fn.test", { headers: { origin: PROD } });
}

Deno.test("respondError redacts a raw error message", async () => {
  setup();
  const res = respondError(req(), new Error('relation "public.users" does not exist'));
  assertEquals(res.status, 500);
  const body = await res.json();
  assertEquals(body.error, "Internal error.");
  // request_id present and uuid-shaped.
  assertMatch(body.request_id, /^[0-9a-f-]{36}$/);
  // CORS attached.
  assertEquals(res.headers.get("Access-Control-Allow-Origin"), PROD);
});

Deno.test("respondError does not leak file paths", async () => {
  setup();
  const e = new Error("/home/deno/functions/chat/index.ts:42 boom");
  const body = await respondError(req(), e).json();
  assertEquals(body.error, "Internal error.");
  assert(!String(body.error).includes("/home/deno"));
});

Deno.test("respondError passes through a short code-tagged message", async () => {
  setup();
  const e = new Error("AI monthly cap reached");
  (e as Error & { code: string }).code = "quota_exceeded";
  const res = respondError(req(), e, { status: 429 });
  assertEquals(res.status, 429);
  const body = await res.json();
  assertEquals(body.error, "AI monthly cap reached");
  assertEquals(body.code, "quota_exceeded");
});

Deno.test("respondError still redacts a long code-tagged message", async () => {
  setup();
  const e = new Error("x".repeat(250)); // too long → not "safe"
  (e as Error & { code: string }).code = "weird";
  const body = await respondError(req(), e).json();
  assertEquals(body.error, "Internal error.");
  assertEquals(body.code, "weird"); // code still surfaced
});

Deno.test("respondError honours an explicit publicMessage", async () => {
  setup();
  const body = await respondError(req(), new Error("secret detail"), {
    status: 503,
    publicMessage: "Service temporarily unavailable",
  }).json();
  assertEquals(body.error, "Service temporarily unavailable");
});

Deno.test("respondClientError surfaces the message verbatim", async () => {
  setup();
  const res = respondClientError(req(), "invalid plan_id", 400, "bad_request");
  assertEquals(res.status, 400);
  const body = await res.json();
  assertEquals(body.error, "invalid plan_id");
  assertEquals(body.code, "bad_request");
});
