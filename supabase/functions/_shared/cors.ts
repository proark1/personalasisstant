// Shared CORS helper.
//
// One source of truth for Access-Control-Allow-Origin. Previously each
// function had `Deno.env.get("APP_URL") || "*"` — if APP_URL was unset
// in any environment, the wildcard fallback opened every authenticated
// endpoint to any origin.
//
// This helper refuses to fall back: missing APP_URL throws at first use,
// turning a silent misconfiguration into a loud one.

const DEV_HOSTS = new Set([
  'http://localhost:8080',
  'http://localhost:5173',
  'http://127.0.0.1:8080',
  'http://127.0.0.1:5173',
]);

function readAllowedOrigins(): string[] {
  // APP_URL is the canonical production origin. APP_URLS (plural,
  // comma-separated) lets staging/preview environments add extras
  // without re-deploying. Empty values are filtered out.
  const single = Deno.env.get('APP_URL');
  const multi = Deno.env.get('APP_URLS');
  const list = [
    ...(single ? [single] : []),
    ...(multi ? multi.split(',') : []),
  ]
    .map((s) => s.trim())
    .filter(Boolean);
  if (list.length === 0) {
    throw new Error(
      'CORS misconfigured: set APP_URL (and optionally APP_URLS) on this function. ' +
      'Refusing to fall back to "*".',
    );
  }
  return list;
}

function pickOrigin(reqOrigin: string | null): string {
  const allowed = readAllowedOrigins();
  // If APP_ENV=development, also accept local dev hosts.
  const inDev = Deno.env.get('APP_ENV') === 'development';
  const candidates = inDev ? [...allowed, ...DEV_HOSTS] : allowed;
  if (reqOrigin && candidates.includes(reqOrigin)) return reqOrigin;
  // No match — echo the canonical origin so the browser blocks the
  // response (correct behaviour) and we don't leak that we know
  // anything about the requester.
  return allowed[0];
}

// Lightweight drop-in for the old `Deno.env.get('APP_URL') || '*'` pattern.
// Throws if APP_URL is unset rather than silently allowing any origin.
// Use this only when you don't have access to the Request (e.g. inside a
// module-level corsHeaders object). Prefer buildCorsHeaders(req) otherwise.
export function strictAppOrigin(): string {
  return readAllowedOrigins()[0];
}

export function buildCorsHeaders(req: Request): Record<string, string> {
  const origin = pickOrigin(req.headers.get('origin'));
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers':
      'authorization, x-client-info, apikey, content-type, x-telegram-user-id',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Vary': 'Origin',
    'X-Content-Type-Options': 'nosniff',
  };
}

// Convenience: handle the OPTIONS preflight in one line.
//   if (req.method === 'OPTIONS') return preflight(req);
export function preflight(req: Request): Response {
  return new Response(null, { status: 204, headers: buildCorsHeaders(req) });
}

// Convenience JSON response with CORS attached.
export function jsonResponse(
  req: Request,
  body: unknown,
  init: ResponseInit = {},
): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      ...buildCorsHeaders(req),
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
}
