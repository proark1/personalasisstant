// Platform playbooks — the content best-practices knowledge that makes the
// generated scripts genuinely good rather than generic.
//
// Each platform/format pairing has a distilled set of rules the script prompt
// injects so Gemini writes to how the platform actually rewards content (hook
// timing, length, captions, retention tactics, CTAs). Kept here, in one place,
// so the `content-script` function and any future surface stay consistent.

export type Platform = "youtube" | "instagram" | "tiktok" | "generic";
export type ScriptFormat = "short" | "long";

export const KNOWN_PLATFORMS: Platform[] = ["youtube", "instagram", "tiktok"];

export function platformLabel(p: string): string {
  switch (p) {
    case "youtube":
      return "YouTube";
    case "instagram":
      return "Instagram";
    case "tiktok":
      return "TikTok";
    default:
      return "General";
  }
}

// Short-form guidance, per platform. Short-form is the primary focus.
const SHORT_PLAYBOOK: Record<Platform, string[]> = {
  tiktok: [
    "Hook in the first 1-2 seconds — say the most surprising/valuable thing immediately; no slow intros, no 'hey guys'.",
    "Target 21-34 seconds (sweet spot); hard cap 60s. Fast pace, frequent cuts.",
    "Write like a person talking to one friend — casual, native, opinionated. Avoid corporate tone.",
    "Use a pattern interrupt every ~5-7 seconds (new visual, B-roll, on-screen text, or a question).",
    "End on a loop or an open question that drives comments and rewatches.",
    "Caption: 1 short punchy line. 3-5 niche-relevant hashtags (mix of broad + specific). Suggest a trending-sound style if relevant.",
  ],
  instagram: [
    "Reels: 7-30 seconds is ideal for reach; strong visual cover/hook frame.",
    "Lead with value or relatability in the first 2 seconds; make it save-worthy and share-worthy.",
    "Always assume sound-off: bake the message into on-screen text/captions.",
    "Tighter, slightly more polished than TikTok but still authentic.",
    "Caption: a hooky first line + a little context; 3-5 hashtags; CTA to save/share or visit profile link.",
  ],
  youtube: [
    "YouTube Shorts: 30-60 seconds, vertical, single clear payoff.",
    "Title doubles as a searchable hook (people find Shorts via search/suggested).",
    "Hook states the payoff up front, then deliver it — no filler.",
    "End with a reason to check the channel / a related long-form video.",
  ],
  generic: [
    "Hook in the first 2 seconds with the single most valuable or surprising idea.",
    "Keep it 20-45 seconds, one idea, tight pacing, on-screen text for sound-off viewing.",
    "Conversational, in the creator's voice; end with a comment-driving question or CTA.",
  ],
};

// Long-form guidance (YouTube is the canonical long-form home).
const LONG_PLAYBOOK: string[] = [
  "Format: YouTube long-form, 6-10 minutes for this kind of business/startup content.",
  "Open with a 0-15 second hook that restates the promise of the title and tells the viewer exactly what they'll get — no long intro.",
  "Provide 3-6 clear chapters/sections with smooth transitions; structure beats polish.",
  "Add a re-hook roughly every 45-90 seconds (a tease of what's coming, a story turn, or a bold claim) to hold retention.",
  "Use concrete examples, numbers, and a short story — not abstract advice.",
  "Place one natural mid-roll CTA (subscribe / free resource) and one end CTA with a next-video suggestion.",
  "Provide an SEO description (2-3 sentences + a short outline) and a clickable, curiosity-driven thumbnail concept (3-5 words of on-thumbnail text).",
  "Offer 3 title options: each specific, benefit- or curiosity-driven, ideally under 60 characters.",
];

export function shortPlaybook(platforms: string[]): string {
  const targets = platforms.filter((p): p is Platform => (KNOWN_PLATFORMS as string[]).includes(p));
  const list = targets.length ? targets : (["generic"] as Platform[]);
  return list
    .map(
      (p) => `${platformLabel(p)} short-form best practices:\n- ${SHORT_PLAYBOOK[p].join("\n- ")}`,
    )
    .join("\n\n");
}

export function longPlaybook(): string {
  return `Long-form (YouTube) best practices:\n- ${LONG_PLAYBOOK.join("\n- ")}`;
}
