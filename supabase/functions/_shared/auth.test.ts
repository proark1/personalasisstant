// Run with: deno test --allow-env supabase/functions/_shared/auth.test.ts
//
// These tests prove the service-role + x-telegram-user-id delegation
// path is locked down:
//   - rejects non-UUID values (header smuggling)
//   - rejects missing internal token when INTERNAL_AUTH_SECRET is set
//   - accepts a freshly minted token
//   - rejects an expired token
//
// They do NOT exercise the JWT path — that requires a live Supabase.

import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { mintInternalToken, resolveUserId } from './auth.ts';

const SERVICE_KEY = 'test-service-role-key';
const SECRET = 'test-internal-auth-secret';
const USER_ID = '11111111-2222-3333-4444-555555555555';

function setupEnv(opts: { secret?: boolean } = { secret: true }) {
  Deno.env.set('SUPABASE_URL', 'https://example.supabase.co');
  Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', SERVICE_KEY);
  if (opts.secret) Deno.env.set('INTERNAL_AUTH_SECRET', SECRET);
  else Deno.env.delete('INTERNAL_AUTH_SECRET');
}

function req(headers: Record<string, string>): Request {
  return new Request('http://x.test', { headers });
}

Deno.test('rejects when Authorization header is missing', async () => {
  setupEnv();
  const r = await resolveUserId(req({}));
  assertEquals(r, null);
});

Deno.test('rejects a non-UUID x-telegram-user-id', async () => {
  setupEnv();
  const token = await mintInternalToken("'; DROP TABLE users; --");
  const r = await resolveUserId(req({
    Authorization: `Bearer ${SERVICE_KEY}`,
    'x-telegram-user-id': "'; DROP TABLE users; --",
    'x-internal-token': token,
  }));
  assertEquals(r, null);
});

Deno.test('rejects service-role call without internal token when secret is set', async () => {
  setupEnv({ secret: true });
  const r = await resolveUserId(req({
    Authorization: `Bearer ${SERVICE_KEY}`,
    'x-telegram-user-id': USER_ID,
    // no x-internal-token
  }));
  assertEquals(r, null);
});

Deno.test('accepts a valid minted internal token', async () => {
  setupEnv({ secret: true });
  const token = await mintInternalToken(USER_ID);
  const r = await resolveUserId(req({
    Authorization: `Bearer ${SERVICE_KEY}`,
    'x-telegram-user-id': USER_ID,
    'x-internal-token': token,
  }));
  assert(r);
  assertEquals(r.userId, USER_ID);
  assertEquals(r.isInternal, true);
});

Deno.test('rejects an internal token issued for a different user', async () => {
  setupEnv({ secret: true });
  const tokenForOther = await mintInternalToken('99999999-9999-9999-9999-999999999999');
  const r = await resolveUserId(req({
    Authorization: `Bearer ${SERVICE_KEY}`,
    'x-telegram-user-id': USER_ID,
    'x-internal-token': tokenForOther,
  }));
  assertEquals(r, null);
});

Deno.test('rejects an expired internal token', async () => {
  setupEnv({ secret: true });
  // Forge a token claiming to be 10 minutes old (TTL is 5).
  const oldIssued = Math.floor(Date.now() / 1000) - 10 * 60;
  // Re-run the HMAC manually since mintInternalToken always uses "now".
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(`${USER_ID}.${oldIssued}`));
  const sigHex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0')).join('');
  const oldToken = `${oldIssued}.${sigHex}`;

  const r = await resolveUserId(req({
    Authorization: `Bearer ${SERVICE_KEY}`,
    'x-telegram-user-id': USER_ID,
    'x-internal-token': oldToken,
  }));
  assertEquals(r, null);
});

Deno.test('legacy path: accepts when INTERNAL_AUTH_SECRET is unset (back-compat)', async () => {
  setupEnv({ secret: false });
  const r = await resolveUserId(req({
    Authorization: `Bearer ${SERVICE_KEY}`,
    'x-telegram-user-id': USER_ID,
  }));
  assert(r);
  assertEquals(r.userId, USER_ID);
});
