// Run with: deno test --allow-env supabase/functions/_shared/cors.test.ts
//
// Locks in the CORS hardening from PR #28: the helper must never fall
// back to "*", must echo a matching origin, must reject a non-matching
// one (by returning the canonical origin, which the browser blocks),
// and must honour APP_URLS + APP_ENV=development.

import { assert, assertEquals, assertThrows } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { buildCorsHeaders, jsonResponse, preflight, strictAppOrigin } from './cors.ts';

const PROD = 'https://app.darai.example';
const STAGING = 'https://staging.darai.example';

function reset() {
  Deno.env.delete('APP_URL');
  Deno.env.delete('APP_URLS');
  Deno.env.delete('APP_ENV');
}

function req(origin?: string): Request {
  return new Request('http://fn.test', origin ? { headers: { origin } } : undefined);
}

Deno.test('strictAppOrigin throws when APP_URL is unset', () => {
  reset();
  assertThrows(() => strictAppOrigin(), Error, 'CORS misconfigured');
});

Deno.test('strictAppOrigin returns the canonical origin', () => {
  reset();
  Deno.env.set('APP_URL', PROD);
  assertEquals(strictAppOrigin(), PROD);
});

Deno.test('strictAppOrigin never returns a wildcard', () => {
  reset();
  Deno.env.set('APP_URL', PROD);
  assert(strictAppOrigin() !== '*');
});

Deno.test('buildCorsHeaders echoes a matching origin', () => {
  reset();
  Deno.env.set('APP_URL', PROD);
  const h = buildCorsHeaders(req(PROD));
  assertEquals(h['Access-Control-Allow-Origin'], PROD);
  assertEquals(h['X-Content-Type-Options'], 'nosniff');
  assertEquals(h['Vary'], 'Origin');
});

Deno.test('buildCorsHeaders falls back to canonical origin for a non-matching origin', () => {
  reset();
  Deno.env.set('APP_URL', PROD);
  // An attacker's origin must NOT be echoed — we return the canonical
  // origin so the browser refuses the cross-origin response.
  const h = buildCorsHeaders(req('https://evil.example'));
  assertEquals(h['Access-Control-Allow-Origin'], PROD);
});

Deno.test('APP_URLS adds extra allowed origins', () => {
  reset();
  Deno.env.set('APP_URL', PROD);
  Deno.env.set('APP_URLS', `${STAGING}, https://preview.darai.example`);
  assertEquals(buildCorsHeaders(req(STAGING))['Access-Control-Allow-Origin'], STAGING);
  assertEquals(
    buildCorsHeaders(req('https://preview.darai.example'))['Access-Control-Allow-Origin'],
    'https://preview.darai.example',
  );
});

Deno.test('localhost is only allowed when APP_ENV=development', () => {
  reset();
  Deno.env.set('APP_URL', PROD);
  // Not in dev → localhost is rejected (canonical returned).
  assertEquals(
    buildCorsHeaders(req('http://localhost:8080'))['Access-Control-Allow-Origin'],
    PROD,
  );
  // In dev → localhost is echoed.
  Deno.env.set('APP_ENV', 'development');
  assertEquals(
    buildCorsHeaders(req('http://localhost:8080'))['Access-Control-Allow-Origin'],
    'http://localhost:8080',
  );
});

Deno.test('preflight returns 204 with CORS headers', () => {
  reset();
  Deno.env.set('APP_URL', PROD);
  const res = preflight(req(PROD));
  assertEquals(res.status, 204);
  assertEquals(res.headers.get('Access-Control-Allow-Origin'), PROD);
});

Deno.test('jsonResponse attaches CORS and content-type', async () => {
  reset();
  Deno.env.set('APP_URL', PROD);
  const res = jsonResponse(req(PROD), { ok: true }, { status: 201 });
  assertEquals(res.status, 201);
  assertEquals(res.headers.get('Content-Type'), 'application/json');
  assertEquals(res.headers.get('Access-Control-Allow-Origin'), PROD);
  assertEquals(await res.json(), { ok: true });
});
