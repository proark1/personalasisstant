import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { authorizeFunctionRequest } from "./function-auth.ts";

const ENV_KEYS = [
  "SUPABASE_URL",
  "SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "EDGE_FUNCTION_SERVICE_SECRET",
  "CRON_SECRET",
  "TELEGRAM_WEBHOOK_SECRET",
  "DORI_ALLOW_UNSECURED_TELEGRAM_WEBHOOK",
  "MEETINGBOT_WEBHOOK_SECRET",
] as const;

async function withEnv(fn: () => Promise<void> | void) {
  const previous = new Map<string, string | undefined>();
  for (const key of ENV_KEYS) {
    previous.set(key, Deno.env.get(key));
    Deno.env.delete(key);
  }

  try {
    await fn();
  } finally {
    for (const [key, value] of previous) {
      if (value === undefined) Deno.env.delete(key);
      else Deno.env.set(key, value);
    }
  }
}

function req(headers: HeadersInit = {}) {
  return new Request("https://edge.test/functions/v1/chat-ai", {
    method: "POST",
    headers,
  });
}

Deno.test("allows public functions without authorization", async () => {
  await withEnv(async () => {
    const res = await authorizeFunctionRequest(req(), "chat");
    assertEquals(res, null);
  });
});

Deno.test("rejects user functions without a bearer token", async () => {
  await withEnv(async () => {
    const res = await authorizeFunctionRequest(req(), "chat-ai");
    assertEquals(res?.status, 401);
  });
});

Deno.test("rejects user functions when the bearer token cannot be verified", async () => {
  await withEnv(async () => {
    const res = await authorizeFunctionRequest(
      req({ Authorization: "Bearer not-real" }),
      "chat-ai",
    );
    assertEquals(res?.status, 401);
  });
});

Deno.test("allows service functions with the service role bearer", async () => {
  await withEnv(async () => {
    Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "service-secret");
    const res = await authorizeFunctionRequest(
      req({ Authorization: "Bearer service-secret" }),
      "telegram-router",
    );
    assertEquals(res, null);
  });
});

Deno.test("rejects telegram webhook calls when the secret is not configured", async () => {
  await withEnv(async () => {
    const res = await authorizeFunctionRequest(req(), "telegram-poll");
    assertEquals(res?.status, 503);
  });
});

Deno.test("allows telegram webhook calls with the configured secret header", async () => {
  await withEnv(async () => {
    Deno.env.set("TELEGRAM_WEBHOOK_SECRET", "telegram-secret");
    const res = await authorizeFunctionRequest(
      req({ "x-telegram-bot-api-secret-token": "telegram-secret" }),
      "telegram-poll",
    );
    assertEquals(res, null);
  });
});

Deno.test("meeting bot webhooks must carry a signature header", async () => {
  await withEnv(async () => {
    Deno.env.set("MEETINGBOT_WEBHOOK_SECRET", "meeting-secret");
    const res = await authorizeFunctionRequest(req(), "meeting-bot-webhook");
    assertEquals(res?.status, 401);
  });
});
