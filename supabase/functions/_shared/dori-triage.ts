// Per-turn "how hard is this turn?" decision.
//
// Drives two things the chat brain previously hardcoded:
//   - which Gemini model answers the turn (Flash vs a stronger Pro tier)
//   - how many agent rounds the tool-loop is allowed
//
// Two layers:
//   1. decideTier() — cheap synchronous heuristic, runs every turn, no
//      network. Keeps the common/simple path on Flash with today's latency
//      and cost.
//   2. runTriage() — one cheap Flash structured-output call. Meant to run
//      ONLY when the regex router is unsure, so p50 latency is unchanged.
//      Returns {specialists, complexity, multiStep}, which sharpens both the
//      tier decision and (Phase 3) specialist routing.
//
// Fail-open everywhere: if the Pro model isn't configured (DORI_PRO_MODEL
// unset) or triage errors, we silently fall back to Flash. Intelligence is
// an uplift, never a blocker — and with no env set, behaviour is identical
// to before this module existed.

import type { Specialist } from './dori-router.ts';

// The Flash tier mirrors the model the chat brain has always used. Kept here
// so the chat function imports a single source of truth.
export const FLASH_MODEL = 'gemini-3-flash-preview';
export const FLASH_ROUNDS = 4;
export const PRO_ROUNDS = 8;
// After this many tools have executed in a single turn, a Flash turn is
// clearly doing real multi-step work — escalate it to the Pro tier (if
// configured) for the remaining rounds.
export const ESCALATE_AFTER_TOOLS = 3;

export type Complexity = 'low' | 'med' | 'high';

export interface TierDecision {
  model: string;
  maxRounds: number;
  tier: 'flash' | 'pro';
  reason: string;
}

export interface TierSignals {
  message: string;
  routeConfidence: number; // 0..1 from the regex classifier
  hasImage: boolean;
  triageComplexity?: Complexity | null;
  triageMultiStep?: boolean | null;
}

// Reasoning cues that benefit from a stronger model. Deliberately broad — a
// false positive only costs a bit more on a minority of turns, while a false
// negative leaves a genuinely hard turn under-powered, which is the worse
// failure for "make it more intelligent".
const REASONING_RE =
  /\b(plan|planning|compare|comparison|why|which|analy[sz]e|analysis|decide|decision|strateg|trade[- ]?offs?|pros and cons|brainstorm|figure out|recommend|prioriti[sz]e|break (it|this|them) down|step[- ]by[- ]step|walk me through|optimi[sz]e|draft a plan|help me think)\b/i;
const MULTI_INTENT_RE = /( and then | after that |, then |\balso\b| as well as |\bboth\b)/i;

// Cheap, synchronous tier decision. Returns Flash unless the Pro model is
// configured AND at least one "this is hard" signal fires.
export function decideTier(s: TierSignals, proModel: string | null): TierDecision {
  const flash: TierDecision = { model: FLASH_MODEL, maxRounds: FLASH_ROUNDS, tier: 'flash', reason: 'default' };
  if (!proModel) return flash;

  const msg = s.message || '';
  const reasons: string[] = [];
  if (s.triageComplexity === 'high') reasons.push('triage:high');
  if (s.triageMultiStep) reasons.push('triage:multistep');
  if (REASONING_RE.test(msg)) reasons.push('reasoning');
  if (MULTI_INTENT_RE.test(msg)) reasons.push('multi-intent');
  if (s.hasImage) reasons.push('image');
  if (msg.length > 320) reasons.push('long');
  // A non-trivial message the router couldn't confidently place is exactly
  // the kind of ambiguous ask that benefits from stronger reasoning.
  if (s.routeConfidence > 0 && s.routeConfidence < 0.4 && msg.length > 40) reasons.push('ambiguous');

  if (reasons.length === 0) return flash;
  return { model: proModel, maxRounds: PRO_ROUNDS, tier: 'pro', reason: reasons.join(',') };
}

// Mid-loop escalation: a Flash turn that has already fired several tools is
// doing heavier lifting than the upfront heuristic predicted. Returns the
// upgraded model/rounds, or null if no change applies.
export function escalateModel(
  currentTier: 'flash' | 'pro',
  toolsExecuted: number,
  proModel: string | null,
): { model: string; maxRounds: number; tier: 'flash' | 'pro' } | null {
  if (currentTier === 'pro' || !proModel) return null;
  if (toolsExecuted < ESCALATE_AFTER_TOOLS) return null;
  return { model: proModel, maxRounds: PRO_ROUNDS, tier: 'pro' };
}

// ---- Tool-result observation feedback -------------------------------------

export interface ObsResult {
  tool: string;
  ok: boolean;
  message: string;
}

// Builds the system message fed back after a round of tool execution. On
// success it nudges the model to wrap up; on failure it explicitly tells the
// model to self-correct (retry with fixed args OR ask the user) instead of
// claiming the action worked — the previous prompt was silent on failures,
// so the model would often report success right after a FAIL.
export function buildToolObservation(results: ObsResult[]): string {
  const lines = results
    .map((r, i) => `[${i + 1}] ${r.tool} → ${r.ok ? 'OK' : 'FAIL'}: ${r.message}`)
    .join('\n');
  const anyFail = results.some((r) => !r.ok);
  const guidance = anyFail
    ? 'One or more tools FAILED. Do NOT tell the user it worked. For each failure, either (a) retry the tool with corrected arguments if you can infer the fix, or (b) ask the user for the missing or ambiguous detail. If a task/contact/event was not found, say so plainly and offer the closest matches instead of guessing.'
    : "If the user's request is now fully satisfied, reply with a brief natural-language confirmation and DO NOT emit more tools. If more steps remain, emit the next tool(s).";
  return `Tool results from your last turn:\n${lines}\n\n${guidance}`;
}

// A stable signature of the FAILED tools in a round. If two consecutive
// rounds produce the same signature, the model is stuck repeating an
// identical broken call — the caller should break the loop rather than burn
// rounds (and money) re-failing the same way.
export function failureSignature(results: ObsResult[]): string {
  return results
    .filter((r) => !r.ok)
    .map((r) => `${r.tool}:${r.message}`)
    .sort()
    .join('|');
}

// ---- Optional LLM triage --------------------------------------------------

export interface TriageResult {
  specialists: Specialist[];
  complexity: Complexity;
  multiStep: boolean;
}

const VALID_SPECIALISTS: Specialist[] = ['general', 'health', 'family', 'meeting', 'finance', 'travel', 'email'];

const TRIAGE_SYSTEM =
  'You are a fast router for a personal-assistant AI. Classify the user\'s message. ' +
  'Pick 1-2 specialists that best fit (general, health, family, meeting, finance, travel, email). ' +
  'Rate complexity: "low" = simple lookup or single action; "med" = needs some context or a couple of steps; ' +
  '"high" = multi-step reasoning, planning, comparison, or cross-domain. ' +
  'Set multiStep=true if fulfilling it clearly needs several distinct actions. ' +
  'Call the triage tool. Do not write prose.';

const TRIAGE_TOOL = {
  type: 'function',
  function: {
    name: 'triage',
    description: 'Classify the user message for routing and effort.',
    parameters: {
      type: 'object',
      properties: {
        specialists: {
          type: 'array',
          items: { type: 'string', enum: VALID_SPECIALISTS },
          description: '1-2 best-fit specialists',
        },
        complexity: { type: 'string', enum: ['low', 'med', 'high'] },
        multiStep: { type: 'boolean' },
      },
      required: ['specialists', 'complexity', 'multiStep'],
    },
  },
};

// One cheap Flash structured-output call. Returns null on any failure so the
// caller falls back to the regex route + heuristic tier.
export async function runTriage(message: string, geminiApiKey: string): Promise<TriageResult | null> {
  const text = (message || '').trim();
  if (!text || !geminiApiKey) return null;
  try {
    const res = await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${geminiApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: FLASH_MODEL,
        temperature: 0,
        messages: [
          { role: 'system', content: TRIAGE_SYSTEM },
          { role: 'user', content: text.slice(0, 1200) },
        ],
        tools: [TRIAGE_TOOL],
        tool_choice: { type: 'function', function: { name: 'triage' } },
      }),
    });
    if (!res.ok) {
      console.warn('[runTriage] gateway', res.status);
      return null;
    }
    const data = await res.json();
    const call = data.choices?.[0]?.message?.tool_calls?.[0];
    const args = call?.function?.arguments;
    if (!args) return null;
    const parsed = JSON.parse(args);
    const specialists: Specialist[] = Array.isArray(parsed.specialists)
      ? parsed.specialists.filter((s: string) => VALID_SPECIALISTS.includes(s as Specialist)).slice(0, 2)
      : [];
    const complexity: Complexity = ['low', 'med', 'high'].includes(parsed.complexity) ? parsed.complexity : 'med';
    return {
      specialists: specialists.length ? specialists : ['general'],
      complexity,
      multiStep: !!parsed.multiStep,
    };
  } catch (e) {
    console.warn('[runTriage] failed', (e as Error).message);
    return null;
  }
}
