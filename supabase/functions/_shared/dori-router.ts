// Specialist routing.
//
// The base system prompt tries to be everything to everyone — it
// covers tasks, calendar, family, health, finance, email, web search,
// memory rules, multi-tool chaining, and confirm-before-act all in
// one ~600-line monolith. When the user asks a focused question
// (e.g. "what should I eat tonight given my sleep last night?"), the
// model is wading through irrelevant family-coordination + finance
// rules just to find the health rules that apply.
//
// Router output: a *specialist add-on* that gets prepended to the
// dynamic tail (after intelligenceBlock, before contextMessage) so
// the cache-stable prefix is untouched, but the model's attention is
// pulled toward the right rules for this turn.
//
// Classification is rules-first (cheap, deterministic, debuggable)
// with a confidence score. The chat function may log every routing
// decision for offline evaluation. We deliberately avoid a second AI
// call for classification — adds a round-trip and the rules cover
// >90% of real cases. Fall-through is 'general' which keeps the full
// base prompt behaviour, so we never make it worse.

export type Specialist =
  | "general"
  | "health"
  | "family"
  | "meeting"
  | "finance"
  | "travel"
  | "email";

export interface RouteResult {
  specialist: Specialist;
  confidence: number;
  matched: string[]; // patterns that fired, for logging
}

interface Pattern {
  re: RegExp;
  weight: number;
}

const PATTERNS: Record<Exclude<Specialist, "general">, Pattern[]> = {
  health: [
    {
      re: /\b(sleep|slept|sleeping|sleep score|hrv|heart rate|resting hr|steps?|calories?|workout|workouts|exercise|gym|run|running|walk|walking|stretch|yoga|meditation|mindfulness)\b/i,
      weight: 0.6,
    },
    {
      re: /\b(medication|meds?|prescription|refill|doctor|appointment|symptom|sick|pain|ache|headache|fatigue|tired|energy|mood|anxiety|stress|fitness|weight|bmi|blood (pressure|sugar|oxygen)|water intake|hydration)\b/i,
      weight: 0.7,
    },
    {
      re: /\b(diet|nutrition|eat|food|meal|breakfast|lunch|dinner|snack|recipe|calorie|protein|carbs?|fat)\b/i,
      weight: 0.4,
    },
  ],
  family: [
    {
      re: /\b(my (wife|husband|spouse|partner|kid|kids|son|daughter|child|children|mom|dad|mother|father|brother|sister|family))\b/i,
      weight: 0.7,
    },
    {
      re: /\b(school|teacher|classroom|grade|kindergarten|daycare|nursery|homework|playdate|sleepover|birthday party|sitter|babysitter)\b/i,
      weight: 0.6,
    },
    {
      re: /\b(shopping list|grocery|groceries|family schedule|family event|allergies?|allergy)\b/i,
      weight: 0.5,
    },
  ],
  meeting: [
    { re: /\b(schedule (a |an )?(meeting|call|sync|1:1|standup|review))\b/i, weight: 0.8 },
    {
      re: /\b(find (a )?time|book a slot|find a slot|when (can|should) we meet|when (is|are) (\w+ )?free|set up a meeting)\b/i,
      weight: 0.8,
    },
    {
      re: /\b(reschedule|move (the |that )?meeting|push (the |that )?meeting|cancel (the |that )?meeting)\b/i,
      weight: 0.7,
    },
    { re: /\b(prep|prepare) (for )?(the |a |my )?(meeting|call|interview)\b/i, weight: 0.6 },
  ],
  finance: [
    {
      re: /\b(contract|subscription|renewal|cancel(?:lation)?|bill|invoice|invoiced|payment|charged|spending|budget|cost|expense|salary|income|tax|taxes)\b/i,
      weight: 0.7,
    },
    {
      re: /\b(insurance|netflix|spotify|amazon prime|electricity|gas|water|telecom|internet|mobile plan)\b/i,
      weight: 0.4,
    },
  ],
  travel: [
    {
      re: /\b(flight|fly|flying|airport|hotel|airbnb|trip|travel(?:ing|ling)?|going to (\w+)|in (paris|london|berlin|nyc|tokyo|dubai)|destination|itinerary|pack(?:ing)?)\b/i,
      weight: 0.6,
    },
    { re: /\b(visa|passport|booking|reservation|check[- ]in|jet ?lag)\b/i, weight: 0.7 },
  ],
  email: [
    {
      re: /\b(email|inbox|gmail|reply to|draft (a |an )?(reply|email|response)|send (an |the )?email|compose)\b/i,
      weight: 0.7,
    },
    { re: /\b(unread|important emails?|latest emails?|from .{1,30}@)\b/i, weight: 0.6 },
  ],
};

const SPECIALIST_PROMPTS: Record<Specialist, string> = {
  general: "",
  health: `## ACTIVE SPECIALIST: HEALTH COACH
Right now the user is asking about health, fitness, sleep, mood, food, or medical matters. Apply these rules in addition to the base prompt:
- Pull the most recent dailySummary, weeklyTrends, medications, and appointments from context FIRST.
- Be specific with numbers ("you averaged 6.4h of sleep this week vs your 7.5h goal") rather than vague encouragement.
- If the user asks for diet/exercise advice, factor in active medications, allergies, and any medical notes you can see.
- Never give a definitive medical diagnosis. For symptoms or concerning trends, suggest seeing their physician + offer to create a task or appointment.
- Sleep + HRV are leading indicators — if either is bad, reflect that in your tone (lower-effort suggestions, not "crush a 10k today").
- Skip meeting/finance/email tools unless the user pivots there.`,
  family: `## ACTIVE SPECIALIST: FAMILY COORDINATOR
The user is talking about family. Apply these rules in addition to the base:
- Use family member NAMES (not "your son"). If only one child fits, you may use "(child name)" without asking.
- Cross-check timing against todayEvents/tomorrowEvents/family schedule for clashes BEFORE you confirm anything.
- For shopping, use add_shopping_item — don't create generic tasks.
- Allergies are non-negotiable: if a meal/activity could touch a logged allergy, flag it.
- Birthdays / school events / parent-teacher: prefer schedule_event with a 30-min reminder + a "Buy gift" task 3 days prior.
- If the user is in a workspace marked as a family workspace, all created items go in that scope.`,
  meeting: `## ACTIVE SPECIALIST: MEETING SCHEDULER
The user wants to schedule, reschedule, or prep for a meeting. Apply these:
- If it's a workspace request with named participants → use find_time FIRST to get free slots, then PROPOSE the top 3 with the participants' names. Wait for the user to pick before emitting schedule_event.
- For solo blocks, just emit schedule_event directly with a sensible duration (default 30 min if not stated).
- Always include a brief description / agenda field when you can infer one from the conversation.
- For prep requests, use the meeting-prep capability: surface the relevant contact, last interactions, and a suggested talking-points list — don't create a vague "prep for meeting" task.
- Reschedules touch BOTH the original event (manage_event update or delete) AND any prep tasks tied to it.`,
  finance: `## ACTIVE SPECIALIST: FINANCE & CONTRACTS
The user is asking about money, contracts, subscriptions, or renewals. Apply these:
- Use manage_contract / get_summary for cost and renewal questions — never invent numbers.
- Show monthly + yearly totals when summarising. Highlight contracts auto-renewing in the next 30 days.
- For "cancel X": find the contract → propose a cancellation email draft → create a task "Verify X cancelled" 7 days out. Don't actually file the cancellation yourself.
- Round to whole currency units in prose ("€42/month") but keep precision in tool payloads.`,
  travel: `## ACTIVE SPECIALIST: TRAVEL PLANNER
The user is talking about a trip. Apply these:
- Cross-reference contacts in the destination — proactively offer to ping the top 1-2 if it's a city the user has connections in.
- Block calendar Tue-Thu (or matching span) with a travel event covering the dates.
- Create a "Pack for {destination}" task due 2 days before departure.
- If a passport/visa renewal looks tight, flag it.`,
  email: `## ACTIVE SPECIALIST: EMAIL TRIAGE
The user is asking about email. Apply these:
- For "show me emails" → fetch_emails with the right scope, summarise each in ≤2 lines, then ask which to act on.
- For "reply to X" → identify the email by subject/sender, then draft_email_reply with an explicit tone. Show the user the draft before send_email.
- Never call send_email on a draft the user hasn't seen first.
- For inbox-zero asks, group by sender / topic and ask whether to triage by oldest-first or by importance.`,
};

export function classifyIntent(message: string): RouteResult {
  const text = message || "";
  const scores: Record<string, number> = {};
  const matched: Record<string, string[]> = {};

  for (const [specialist, patterns] of Object.entries(PATTERNS)) {
    let score = 0;
    const hits: string[] = [];
    for (const p of patterns) {
      if (p.re.test(text)) {
        score += p.weight;
        hits.push(p.re.source);
      }
    }
    if (score > 0) {
      scores[specialist] = score;
      matched[specialist] = hits;
    }
  }

  // Pick the highest-scoring specialist if it clears a min bar; else general.
  const ranked = Object.entries(scores).sort(([, a], [, b]) => b - a);
  if (ranked.length === 0 || ranked[0][1] < 0.5) {
    return { specialist: "general", confidence: 0, matched: [] };
  }
  const [winner, score] = ranked[0];
  // Confidence = score / (score + runner-up). Above 0.65 = clear win.
  const runner = ranked[1]?.[1] ?? 0;
  const confidence = score / (score + runner + 0.0001);
  return {
    specialist: winner as Specialist,
    confidence,
    matched: matched[winner] ?? [],
  };
}

export function specialistPrompt(specialist: Specialist): string {
  return SPECIALIST_PROMPTS[specialist] || "";
}

// Sticky routing: if the last turn picked a specialist and the new
// message is a short follow-up ("yes", "do it", "ok", "the second
// one"), keep the same specialist instead of re-classifying.
export function isFollowUpAffirmative(message: string): boolean {
  const m = (message || "").trim().toLowerCase();
  if (m.length > 40) return false;
  return /^(yes|y|ok|okay|sure|do it|go|go ahead|sounds good|perfect|👍|thumbs up|the (first|second|third|1st|2nd|3rd)( one)?|all of (them|those)|skip \d|drop \d)/.test(
    m,
  );
}

export interface RouteDecision extends RouteResult {
  effective: Specialist; // after sticky-follow-up logic
  prompt: string;
}

export function decideRoute(message: string, previousSpecialist?: string | null): RouteDecision {
  const cls = classifyIntent(message);
  let effective: Specialist = cls.specialist;
  if (cls.confidence < 0.55 && previousSpecialist && isFollowUpAffirmative(message)) {
    effective = previousSpecialist as Specialist;
  }
  return { ...cls, effective, prompt: specialistPrompt(effective) };
}
