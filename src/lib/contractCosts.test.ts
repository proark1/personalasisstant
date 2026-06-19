import { describe, it, expect } from "vitest";
import { computeContractCosts, formatContractCostSummary } from "./contractCosts";

describe("computeContractCosts", () => {
  it("returns zeros for an empty list", () => {
    expect(computeContractCosts([])).toEqual({
      monthlyTotal: 0,
      yearlyTotal: 0,
      activeCount: 0,
    });
  });

  it("ignores contracts with isActive === false", () => {
    expect(
      computeContractCosts([
        { isActive: false, costAmount: 100, costFrequency: "monthly" },
        { isActive: true, costAmount: 20, costFrequency: "monthly" },
      ]),
    ).toMatchObject({ monthlyTotal: 20, yearlyTotal: 240, activeCount: 1 });
  });

  it("treats missing isActive as active (undefined !== false)", () => {
    expect(computeContractCosts([{ costAmount: 50, costFrequency: "monthly" }])).toMatchObject({
      monthlyTotal: 50,
      yearlyTotal: 600,
      activeCount: 1,
    });
  });

  it("handles each cost frequency correctly", () => {
    const r = computeContractCosts([
      { costAmount: 10, costFrequency: "monthly" }, // 10/mo, 120/yr
      { costAmount: 120, costFrequency: "yearly" }, // 10/mo, 120/yr
      { costAmount: 30, costFrequency: "quarterly" }, // 10/mo, 120/yr
      { costAmount: 50, costFrequency: "one_time" }, //  0/mo,  50/yr
    ]);
    expect(r.monthlyTotal).toBeCloseTo(30);
    expect(r.yearlyTotal).toBeCloseTo(410);
    expect(r.activeCount).toBe(4);
  });

  it("treats unknown frequencies as monthly", () => {
    expect(computeContractCosts([{ costAmount: 7, costFrequency: "weekly" }])).toMatchObject({
      monthlyTotal: 7,
      yearlyTotal: 84,
    });
  });

  it("skips contracts without a costAmount", () => {
    expect(
      computeContractCosts([
        { costAmount: null, costFrequency: "monthly" },
        { costAmount: 0, costFrequency: "monthly" },
      ]),
    ).toMatchObject({ monthlyTotal: 0, yearlyTotal: 0 });
  });
});

describe("formatContractCostSummary", () => {
  it("renders totals + sorted top-10 line items", () => {
    const out = formatContractCostSummary([
      { name: "A", costAmount: 5, costFrequency: "monthly" },
      { name: "B", provider: "Acme", costAmount: 50, costFrequency: "monthly" },
      { name: "C", costAmount: 10, costFrequency: "monthly", isActive: false },
    ]);
    expect(out).toMatch(/Monthly costs:\*\* €55.00/);
    expect(out).toMatch(/Yearly costs:\*\* €660.00/);
    expect(out).toMatch(/Active contracts:\*\* 2/);
    // Inactive C must not appear; B should sort before A (higher cost).
    const bIdx = out.indexOf("B (Acme)");
    const aIdx = out.indexOf("- A:");
    expect(bIdx).toBeGreaterThan(-1);
    expect(aIdx).toBeGreaterThan(-1);
    expect(bIdx).toBeLessThan(aIdx);
    expect(out).not.toMatch(/- C/);
  });
});
