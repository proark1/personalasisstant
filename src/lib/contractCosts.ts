// Compute monthly / yearly cost totals across active contracts.
// Pure function extracted from Index.tsx's onToolCall handler so the
// math can be unit-tested independently of the chat plumbing.

export interface ContractCostInput {
  isActive?: boolean;
  costAmount?: number | null;
  costFrequency?: string | null;
}

export interface ContractCostTotals {
  monthlyTotal: number;
  yearlyTotal: number;
  activeCount: number;
}

export function computeContractCosts(contracts: ContractCostInput[]): ContractCostTotals {
  const active = contracts.filter((c) => c.isActive !== false);
  let monthlyTotal = 0;
  let yearlyTotal = 0;

  for (const c of active) {
    if (!c.costAmount) continue;
    const amount = c.costAmount;
    const freq = c.costFrequency || "monthly";
    switch (freq) {
      case "monthly":
        monthlyTotal += amount;
        yearlyTotal += amount * 12;
        break;
      case "yearly":
        monthlyTotal += amount / 12;
        yearlyTotal += amount;
        break;
      case "quarterly":
        monthlyTotal += amount / 3;
        yearlyTotal += amount * 4;
        break;
      case "one_time":
        yearlyTotal += amount;
        break;
      default:
        // Fallback: treat unknown frequencies as monthly.
        monthlyTotal += amount;
        yearlyTotal += amount * 12;
    }
  }

  return { monthlyTotal, yearlyTotal, activeCount: active.length };
}

export interface FormatContractCostInput extends ContractCostInput {
  name: string;
  provider?: string | null;
}

// Format a textual summary block matching the prior inline rendering
// (markdown-bold totals + the 10 most expensive line items).
export function formatContractCostSummary(contracts: FormatContractCostInput[]): string {
  const { monthlyTotal, yearlyTotal, activeCount } = computeContractCosts(contracts);
  const active = contracts.filter((c) => c.isActive !== false);
  const lineItems = active
    .filter((c) => c.costAmount)
    .sort((a, b) => (b.costAmount || 0) - (a.costAmount || 0))
    .slice(0, 10)
    .map(
      (c) =>
        `- ${c.name}${c.provider ? ` (${c.provider})` : ""}: €${c.costAmount}/${c.costFrequency || "month"}`,
    )
    .join("\n");

  return (
    `📊 **Financial Summary**\n\n` +
    `**Monthly costs:** €${monthlyTotal.toFixed(2)}\n` +
    `**Yearly costs:** €${yearlyTotal.toFixed(2)}\n` +
    `**Active contracts:** ${activeCount}\n\n` +
    lineItems
  );
}
