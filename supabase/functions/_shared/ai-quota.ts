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

export async function checkQuota(supabase: any, userId: string): Promise<QuotaCheck> {
  try {
    const { data, error } = await supabase.rpc('check_ai_quota', { p_user_id: userId });
    if (error) throw error;
    const r = Array.isArray(data) ? data[0] : data;
    return {
      allowed: !!r?.allowed,
      used_cents: Number(r?.used_cents ?? 0),
      cap_cents: Number(r?.cap_cents ?? 500),
      headroom_cents: Number(r?.headroom_cents ?? 0),
      used_pct: Number(r?.used_pct ?? 0),
      over_cap: !!r?.over_cap,
    };
  } catch (e) {
    // Fail-open on RPC errors — we'd rather charge than break the user.
    console.warn('[ai-quota.checkQuota] failed, allowing call', (e as Error).message);
    return { allowed: true, used_cents: 0, cap_cents: 500, headroom_cents: 500, used_pct: 0, over_cap: false };
  }
}

// Convenience: throw if over cap. Edge functions can wrap their AI
// section in try/catch and surface the message.
export async function assertWithinQuota(supabase: any, userId: string): Promise<QuotaCheck> {
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
    const err = new Error(
      `AI monthly cap reached (${(q.used_cents / 100).toFixed(2)} / ${(q.cap_cents / 100).toFixed(2)} USD). ` +
      'Wait until next month or ask the operator to bump your cap.',
    );
    (err as any).quota = q;
    (err as any).code = 'quota_exceeded';
    throw err;
  }
  return q;
}
