// Run with: deno test --allow-env supabase/functions/_shared/ai-quota.test.ts
//
// Proves the fail-SOFT (not fail-open) behaviour from PR #28:
//   - a healthy RPC result is returned and cached
//   - if the RPC later fails, the cached value is served (fail-soft)
//   - if the RPC fails with NO cache, the call is DENIED (cap_cents=0)
//   - assertWithinQuota throws the right code in each rejection case
//
// The cache is module-global keyed by user_id, so each test uses a
// unique id to avoid cross-test pollution.

import { assert, assertEquals, assertRejects } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { assertWithinQuota, checkQuota } from './ai-quota.ts';
import type { SupabaseQuotaClient } from './ai-quota.ts';

// Minimal fake of the supabase client surface these functions touch.
function fakeSupabase(opts: {
  rpc: () => { data: unknown; error: unknown };
}) {
  return {
    rpc: (_name: string, _args: unknown) => Promise.resolve(opts.rpc()),
    from: (_t: string) => ({
      insert: (_row: unknown) => Promise.resolve({ error: null }),
    }),
  };
}

const ALLOWED = { allowed: true, used_cents: 100, cap_cents: 500, headroom_cents: 400, used_pct: 20, over_cap: false };
const OVER = { allowed: false, used_cents: 510, cap_cents: 500, headroom_cents: 0, used_pct: 102, over_cap: true };

Deno.test('checkQuota returns and normalises a healthy RPC result', async () => {
  const sb = fakeSupabase({ rpc: () => ({ data: [ALLOWED], error: null }) });
  const q = await checkQuota(sb as SupabaseQuotaClient, 'user-healthy');
  assertEquals(q.allowed, true);
  assertEquals(q.used_cents, 100);
  assertEquals(q.cap_cents, 500);
});

Deno.test('checkQuota serves the cached value when the RPC fails (fail-soft)', async () => {
  const userId = 'user-failsoft';
  // 1) Prime the cache with a healthy result.
  const healthy = fakeSupabase({ rpc: () => ({ data: [ALLOWED], error: null }) });
  await checkQuota(healthy as SupabaseQuotaClient, userId);
  // 2) Now the RPC errors — we should still get the cached ALLOWED.
  const broken = fakeSupabase({ rpc: () => ({ data: null, error: { message: 'db down' } }) });
  const q = await checkQuota(broken as SupabaseQuotaClient, userId);
  assertEquals(q.allowed, true);
  assertEquals(q.cap_cents, 500); // came from cache, not the 0 sentinel
});

Deno.test('checkQuota DENIES when the RPC fails with no cache (not fail-open)', async () => {
  const broken = fakeSupabase({ rpc: () => ({ data: null, error: { message: 'db down' } }) });
  const q = await checkQuota(broken as SupabaseQuotaClient, 'user-nocache-unique');
  assertEquals(q.allowed, false);
  assertEquals(q.cap_cents, 0); // sentinel for "service down"
  assert(q.over_cap);
});

Deno.test('assertWithinQuota returns silently when allowed', async () => {
  const sb = fakeSupabase({ rpc: () => ({ data: [ALLOWED], error: null }) });
  const q = await assertWithinQuota(sb as SupabaseQuotaClient, 'user-ok');
  assertEquals(q.allowed, true);
});

Deno.test('assertWithinQuota throws quota_exceeded when over cap', async () => {
  const sb = fakeSupabase({ rpc: () => ({ data: [OVER], error: null }) });
  const err = await assertRejects(
    () => assertWithinQuota(sb as SupabaseQuotaClient, 'user-over'),
    Error,
    'AI monthly cap reached',
  );
  assertEquals((err as Error & { code: string }).code, 'quota_exceeded');
});

Deno.test('assertWithinQuota throws quota_service_unavailable when service is down', async () => {
  const broken = fakeSupabase({ rpc: () => ({ data: null, error: { message: 'db down' } }) });
  const err = await assertRejects(
    () => assertWithinQuota(broken as SupabaseQuotaClient, 'user-down-unique'),
    Error,
    'AI quota service unavailable',
  );
  assertEquals((err as Error & { code: string }).code, 'quota_service_unavailable');
});
