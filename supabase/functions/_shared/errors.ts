// Shared error response helper.
//
// Before this, ~100 edge functions ended their try/catch with:
//   return new Response(JSON.stringify({ error: e.message }), { status: 500 })
// which leaked stack traces, internal function names, RLS policy text,
// and DB schema details to whoever called the function.
//
// respondError logs the full detail server-side and returns a generic
// payload to the client with a request_id the user can quote in support.

import { buildCorsHeaders } from './cors.ts';

interface ErrorRespondOptions {
  // HTTP status to return. Defaults to 500.
  status?: number;
  // Optional short error code (e.g. 'quota_exceeded'). Surfaced to client.
  code?: string;
  // Optional client-safe message. If omitted, returns a generic string.
  // Never pass `e.message` here — that's exactly what we're trying to
  // stop leaking. Use it only for messages you intentionally surface.
  publicMessage?: string;
}

function isSafeMessage(msg: string): boolean {
  // Heuristic: messages that look like our own intentional surfaces
  // (short, no path separators, no SQL keywords) are safe.
  if (msg.length > 200) return false;
  if (/[/\\]|\bSELECT\b|\bINSERT\b|\bUPDATE\b|\bDELETE\b|\bpg_\w+/i.test(msg)) return false;
  return true;
}

export function respondError(
  req: Request,
  error: unknown,
  opts: ErrorRespondOptions = {},
): Response {
  const status = opts.status ?? 500;
  const requestId = crypto.randomUUID();
  const err = error instanceof Error ? error : new Error(String(error));

  // Always log the full error server-side — request_id ties the client
  // ticket to the log line.
  console.error(`[${requestId}]`, err.stack || err.message);

  // Decide what to tell the client. Code-tagged errors (`(err as any).code`)
  // are intentional surfaces — pass their message through. Everything
  // else gets a generic.
  const errCode = (err as Error & { code?: string }).code || opts.code;
  const clientMessage = opts.publicMessage
    || (errCode && isSafeMessage(err.message) ? err.message : 'Internal error.');

  const body: Record<string, unknown> = {
    error: clientMessage,
    request_id: requestId,
  };
  if (errCode) body.code = errCode;

  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...buildCorsHeaders(req),
      'Content-Type': 'application/json',
    },
  });
}

// Convenience for 400-class client errors where the message IS the point.
export function respondClientError(
  req: Request,
  message: string,
  status = 400,
  code?: string,
): Response {
  return new Response(
    JSON.stringify({ error: message, ...(code ? { code } : {}) }),
    {
      status,
      headers: {
        ...buildCorsHeaders(req),
        'Content-Type': 'application/json',
      },
    },
  );
}
