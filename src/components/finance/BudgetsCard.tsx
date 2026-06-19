import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PiggyBank } from "lucide-react";
import type { BudgetRow } from "@/hooks/useFinanceSummary";

export function BudgetsCard({ rows }: { rows: BudgetRow[] }) {
  // Sort: over-budget first, then by spent amount.
  const sorted = [...rows].sort((a, b) => {
    const ap = a.pct_of_budget ?? 0;
    const bp = b.pct_of_budget ?? 0;
    if (ap !== bp) return bp - ap;
    return b.spent_mtd - a.spent_mtd;
  });
  return (
    <Card className="p-4 space-y-3">
      <div>
        <h2 className="text-base font-semibold flex items-center gap-2">
          <PiggyBank className="w-4 h-4 text-primary" />
          Budgets · this month
        </h2>
        <p className="text-xs text-muted-foreground">
          Spend per category vs. monthly cap. Categories without a budget show MTD spend only.
        </p>
      </div>
      {sorted.length === 0 ? (
        <p className="text-sm text-muted-foreground italic py-4 text-center">
          No transactions this month yet — sync a bank or add manual entries to populate.
        </p>
      ) : (
        <div className="space-y-3">
          {sorted.map((r) => (
            <BudgetRowItem key={r.category || "_uncat"} row={r} />
          ))}
        </div>
      )}
    </Card>
  );
}

function BudgetRowItem({ row }: { row: BudgetRow }) {
  const cat = row.category || "Uncategorised";
  const pct = row.pct_of_budget ?? 0;
  const over = pct >= 1;
  const tone = over ? "bg-destructive" : pct >= 0.85 ? "bg-amber-500" : "bg-primary";
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium capitalize">{cat}</span>
        <span className="text-muted-foreground">
          {row.spent_mtd.toFixed(2)}
          {row.monthly_limit != null && (
            <>
              {" "}
              / <span className="font-medium">{row.monthly_limit.toFixed(2)}</span>
            </>
          )}
          {over && (
            <Badge variant="destructive" className="ml-2 text-[10px]">
              over
            </Badge>
          )}
        </span>
      </div>
      {row.monthly_limit != null && row.monthly_limit > 0 ? (
        <div className="h-1.5 w-full rounded bg-muted/40 overflow-hidden">
          <div
            className={`h-full transition-all ${tone}`}
            style={{
              width: `${Math.min(100, Math.round((row.spent_mtd / row.monthly_limit) * 100))}%`,
            }}
          />
        </div>
      ) : (
        <div className="h-1.5 rounded bg-muted/30" />
      )}
    </div>
  );
}
