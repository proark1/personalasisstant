// Shared AI quota gate.
//
// Edge functions call assertWithinQuota() before any expensive AI op.
// On exhaustion, the call returns a structured failure the caller
// can turn into a 429 / soft fallback. Logs the rejection into
// ai_usage so the user's "rate limited" history is auditable.
//
// Default cap is 500 cents ($5) per calendar month — defined in the
// migration's check_ai_quota() RPC. Override per-user via the
// ai_quotas table.

export interface QuotaCheck {
  allowed: boolean;
  used_cents: number;
  cap_cents: number;
  headroom_cents: number;
  used_pct: number;
  over_cap: boolean;
}

// In-memory cache of the last successful quota check, keyed by user_id.
// Used as fail-soft fallback when the RPC is temporarily unavailable: we
// keep enforcing the previously-observed cap rather than letting users
// rack up unbounded spend during a DB hiccup. TTL is short so a user
// who just paid for more headroom isn't blocked for long.
const QUOTA_CACHE_TTL_MS = 5 * 60 * 1000;
const quotaCache = new Map<string, { value: QuotaCheck; expiresAt: number }>();

function cacheGet(userId: string): QuotaCheck | null {
  const hit = quotaCache.get(userId);
  if (!hit) return null;
  if (Date.now() > hit.expiresAt) {
    quotaCache.delete(userId);
    return null;
  }
  return hit.value;
}

function cacheSet(userId: string, value: QuotaCheck) {
  quotaCache.set(userId, { value, expiresAt: Date.now() + QUOTA_CACHE_TTL_MS });
}

// Minimal Supabase client surface these functions use.
export interface SupabaseQuotaClient {
  rpc(name: string, args: Record<string, unknown>): Promise<{ data: unknown; error: { message: string } | null }>;
  from(table: string): { insert(row: Record<string, unknown>): Promise<{ error: { message: string } | null }> };
}

export async function checkQuota(supabase: SupabaseQuotaClient, userId: string): Promise<QuotaCheck> {
  try {
    const { data, error } = await supabase.rpc('check_ai_quota', { p_user_id: userId });
    if (error) throw error;
    const r = Array.isArray(data) ? data[0] : data;
    const result: QuotaCheck = {
      allowed: !!r?.allowed,
      used_cents: Number(r?.used_cents ?? 0),
      cap_cents: Number(r?.cap_cents ?? 500),
      headroom_cents: Number(r?.headroom_cents ?? 0),
      used_pct: Number(r?.used_pct ?? 0),
      over_cap: !!r?.over_cap,
    };
    cacheSet(userId, result);
    return result;
  } catch (e) {
    // Fail-soft, not fail-open. If we have a recent successful check,
    // re-use it. Otherwise deny the call — better to surface a 503-style
    // message than to let one DB outage burn unbounded AI spend.
    const cached = cacheGet(userId);
    if (cached) {
      console.warn(
        '[ai-quota.checkQuota] RPC failed, serving cached value',
        (e as Error).message,
      );
      return cached;
    }
    console.error('[ai-quota.checkQuota] RPC failed with no cache, denying', (e as Error).message);
    return {
      allowed: false,
      used_cents: 0,
      cap_cents: 0,
      headroom_cents: 0,
      used_pct: 0,
      over_cap: true,
    };
  }
}

// Convenience: throw if over cap. Edge functions can wrap their AI
// section in try/catch and surface the message.
export async function assertWithinQuota(supabase: SupabaseQuotaClient, userId: string): Promise<QuotaCheck> {
  const q = await checkQuota(supabase, userId);
  if (!q.allowed) {
    // Best-effort: log the rejection so it shows up in the usage feed.
    try {
      await supabase.from('ai_usage').insert({
        user_id: userId,
        function_name: 'quota_rejection',
        model: 'n/a',
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0,
        cost_estimate: 0,
        response_status: 'rate_limited',
        request_data: { used_cents: q.used_cents, cap_cents: q.cap_cents },
      });
    } catch { /* ignore */ }
    // cap_cents == 0 is the sentinel that the quota service was
    // unreachable AND no cached value was available. Surface that
    // explicitly so the client can retry rather than think it's locked
    // out for the rest of the month.
    const isServiceDown = q.cap_cents === 0;
    const err = new Error(
      isServiceDown
        ? 'AI quota service unavailable. Please retry shortly.'
        : `AI monthly cap reached (${(q.used_cents / 100).toFixed(2)} / ${(q.cap_cents / 100).toFixed(2)} USD). ` +
          'Wait until next month or ask the operator to bump your cap.',
    );
    (err as unknown as Record<string, unknown>).quota = q;
    (err as unknown as Record<string, unknown>).code = isServiceDown ? 'quota_service_unavailable' : 'quota_exceeded';
    throw err;
  }
  return q;
}
