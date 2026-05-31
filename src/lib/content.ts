// Content Studio — shared types and pure helpers.
//
// Types mirror the columns in the 20260531120000_content_studio migration.
// The pure helpers here are deliberately framework-free so they can be unit
// tested (see content.test.ts) and reused across the panel components.

export type IdeaKind = 'current' | 'evergreen';
export type IdeaStatus = 'new' | 'liked' | 'dismissed' | 'scheduled';
export type ScriptFormat = 'short' | 'long';
export type Platform = 'youtube' | 'instagram' | 'tiktok';

export interface CreatorProfile {
  id: string;
  user_id: string;
  persona: string;
  tone: string[];
  topics: string[];
  audience: string;
  business_context: string;
  default_cta: string;
  platforms: Platform[];
  primary_language: string;
  ideas_per_day: number;
  trending_ratio: number;
  enabled: boolean;
  deliver_at: string; // "HH:MM" / "HH:MM:SS"
  channels: string[]; // 'push' | 'telegram'
  last_generated_on: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface ContentIdea {
  id: string;
  user_id: string;
  generated_on: string;
  kind: IdeaKind;
  topic: string;
  headline: string;
  hook: string;
  summary: string;
  source_url: string | null;
  source_title: string | null;
  rank: number;
  status: IdeaStatus;
  scheduled_for: string | null;
  scheduled_event_id: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface PlatformVariant {
  platform: string;
  hook?: string;
  caption: string;
  hashtags: string[];
  notes?: string;
}

export interface ContentScript {
  id: string;
  user_id: string;
  idea_id: string;
  format: ScriptFormat;
  platform: string;
  title_options: string[];
  hook: string;
  script: string;
  shot_list: string;
  caption: string;
  hashtags: string[];
  cta: string;
  thumbnail_concept: string;
  description: string;
  duration_seconds: number | null;
  platform_variants: PlatformVariant[];
  created_at?: string;
  updated_at?: string;
}

export const ALL_PLATFORMS: Platform[] = ['youtube', 'instagram', 'tiktok'];

export const KIND_META: Record<IdeaKind, { label: string; emoji: string }> = {
  current: { label: 'Trending now', emoji: '🔥' },
  evergreen: { label: 'Evergreen', emoji: '♻️' },
};

// Defaults used when creating a creator profile row for the first time. Callers
// (the hook) merge in prefill from the user's general profile.
export const DEFAULT_CREATOR_PROFILE: Omit<
  CreatorProfile,
  'id' | 'user_id' | 'created_at' | 'updated_at' | 'last_generated_on'
> = {
  persona: '',
  tone: [],
  topics: [],
  audience: '',
  business_context: '',
  default_cta: '',
  platforms: ['youtube', 'instagram', 'tiktok'],
  primary_language: 'en',
  ideas_per_day: 10,
  trending_ratio: 0.5,
  enabled: true,
  deliver_at: '08:00',
  channels: ['push', 'telegram'],
};

/**
 * How many of `total` ideas should be "current" vs "evergreen" given the
 * trending↔evergreen ratio. MUST stay in sync with splitIdeaCounts() in
 * supabase/functions/_shared/contentIdeas.ts so the UI preview matches what the
 * backend actually generates.
 */
export function computeIdeaSplit(total: number, trendingRatio: number): { current: number; evergreen: number } {
  const t = Math.max(1, Math.min(Math.round(total) || 1, 20));
  const r = Math.max(0, Math.min(Number.isFinite(trendingRatio) ? trendingRatio : 0.5, 1));
  const current = Math.max(0, Math.min(Math.round(t * r), t));
  return { current, evergreen: t - current };
}

export function groupIdeasByKind(ideas: ContentIdea[]): Record<IdeaKind, ContentIdea[]> {
  return {
    current: ideas.filter((i) => i.kind === 'current'),
    evergreen: ideas.filter((i) => i.kind === 'evergreen'),
  };
}

export function platformLabel(p: string): string {
  switch (p) {
    case 'youtube':
      return 'YouTube';
    case 'instagram':
      return 'Instagram';
    case 'tiktok':
      return 'TikTok';
    default:
      return 'General';
  }
}

/** Seconds → "m:ss" (e.g. 30 → "0:30", 420 → "7:00"). */
export function formatDuration(seconds: number | null | undefined): string {
  if (!seconds || seconds <= 0) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * Turn a Supabase/PostgREST error into a user-facing message. The common failure
 * mode right after shipping Content Studio is that the database migration hasn't
 * been applied yet, so the tables are missing from PostgREST's schema cache
 * (code PGRST205 / "Could not find the table … in the schema cache"). Call that
 * out explicitly instead of a generic "failed", and otherwise surface the real
 * message so problems aren't swallowed.
 */
export function describeContentError(err: unknown, fallback: string): string {
  // Extract message/code without trusting the shape of `err` at runtime: it may
  // be a PostgREST error object, a plain Error, a string, or something else.
  let msg = '';
  let code = '';
  if (err && typeof err === 'object') {
    const e = err as { message?: unknown; code?: unknown };
    if (typeof e.message === 'string') msg = e.message;
    if (typeof e.code === 'string') code = e.code;
  } else if (typeof err === 'string') {
    msg = err;
  }
  if (code === 'PGRST205' || /schema cache|does not exist/i.test(msg)) {
    return 'Content Studio isn’t set up on the server yet — the database migration needs to be applied.';
  }
  return msg ? `${fallback}: ${msg}` : fallback;
}
