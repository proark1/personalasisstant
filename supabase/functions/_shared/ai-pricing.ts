// Per-model token pricing + a compact usage footer for Telegram replies.
//
// Rates are USD per 1M tokens. Flash rates match what logAIUsage has always
// used ($0.075 in / $0.30 out). Pro rates are best-effort ESTIMATES — adjust
// here when you have exact figures; the cost shown to users is labelled "~".

export interface ModelRate {
  inputPer1M: number;
  outputPer1M: number;
}

const PRICING: Record<string, ModelRate> = {
  "gemini-3-flash-preview": { inputPer1M: 0.075, outputPer1M: 0.3 },
  "gemini-2.5-flash": { inputPer1M: 0.075, outputPer1M: 0.3 },
  // Estimate — verify against current Gemini Pro pricing before relying on it.
  "gemini-3-pro-preview": { inputPer1M: 1.25, outputPer1M: 10.0 },
};
const DEFAULT_RATE: ModelRate = { inputPer1M: 0.075, outputPer1M: 0.3 };

export function rateFor(model: string): ModelRate {
  return PRICING[model] ?? DEFAULT_RATE;
}

export function estimateCostUsd(
  model: string,
  promptTokens: number,
  completionTokens: number,
): number {
  const r = rateFor(model);
  return (promptTokens / 1_000_000) * r.inputPer1M + (completionTokens / 1_000_000) * r.outputPer1M;
}

// Compact footer appended to a Telegram reply. Emphasises the SUM of input +
// output tokens, with the split and an estimated cost.
export function usageFooter(
  model: string,
  promptTokens: number,
  completionTokens: number,
): string {
  const total = promptTokens + completionTokens;
  const cost = estimateCostUsd(model, promptTokens, completionTokens);
  const costStr = cost >= 0.01 ? `$${cost.toFixed(3)}` : `$${cost.toFixed(5)}`;
  const n = (x: number) => x.toLocaleString("en-US");
  return `\n\n———\n🔢 ${n(total)} tokens (↑${n(promptTokens)} ↓${n(completionTokens)}) · ~${costStr}`;
}
