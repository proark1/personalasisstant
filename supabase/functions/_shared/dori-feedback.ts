// Proactive nudge feedback loop.
//
// proactive_feedback rows (👍/👎 from Telegram inline buttons + the web UI)
// were being RECORDED but never READ. This module reads them back so the
// assistant stops sending nudge *types* a user consistently dislikes — the
// simplest, safest "learn from the human" loop in the proactive stack.
//
// Shared so dori-proactive and proactive-assistant apply the same policy.
// Fail-open: any error returns "suppress nothing".

// Trigger types that are safe to auto-suppress when disliked. High-urgency
// types (meeting prep, contract renewals) are deliberately EXCLUDED — a user
// shrugging off a reminder must never make us drop a contract that
// auto-renews in 3 days or a meeting starting in 15 minutes.
export const SUPPRESSIBLE_TRIGGERS = new Set<string>([
  'morning_brief',
  'birthday_reminder',
  'prayer_reminder',
  'evening_dua',
  'email_actions',
  'stale_contact',
  'forgotten_task',
  'predictive_slip',
  'habit_streak',
  'daily_review',
  'weekly_planning',
]);

export interface FeedbackStats {
  disliked: Set<string>; // suppress these trigger types
  netByType: Record<string, number>;
}

// Suppress a trigger type only when the dislike is CONSISTENT, not a one-off
// bad day: at least MIN_NEGATIVE thumbs-down AND a net rating at/below
// NET_THRESHOLD over the recent window.
const WINDOW_DAYS = 90;
const MIN_NEGATIVE = 3;
const NET_THRESHOLD = -2;

export async function loadFeedbackStats(supabase: any, userId: string): Promise<FeedbackStats> {
  const empty: FeedbackStats = { disliked: new Set(), netByType: {} };
  if (!userId) return empty;
  try {
    const since = new Date(Date.now() - WINDOW_DAYS * 24 * 3600_000).toISOString();
    const { data, error } = await supabase
      .from('proactive_feedback')
      .select('trigger_type, rating')
      .eq('user_id', userId)
      .gte('created_at', since);
    if (error || !Array.isArray(data) || data.length === 0) return empty;

    const net: Record<string, number> = {};
    const neg: Record<string, number> = {};
    for (const r of data) {
      const t = String(r.trigger_type || '');
      if (!t) continue;
      const rating = Number(r.rating) || 0;
      net[t] = (net[t] ?? 0) + rating;
      if (rating < 0) neg[t] = (neg[t] ?? 0) + 1;
    }
    const disliked = new Set<string>();
    for (const t of Object.keys(net)) {
      if (!SUPPRESSIBLE_TRIGGERS.has(t)) continue;
      if ((neg[t] ?? 0) >= MIN_NEGATIVE && net[t] <= NET_THRESHOLD) disliked.add(t);
    }
    return { disliked, netByType: net };
  } catch (e) {
    console.warn('[loadFeedbackStats] failed', (e as Error).message);
    return empty;
  }
}
