import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowDownLeft, ArrowUpRight, Receipt } from "lucide-react";
import type { FinanceTransaction } from "@/hooks/useFinanceSummary";

export function RecentTransactionsCard({ transactions }: { transactions: FinanceTransaction[] }) {
  return (
    <Card className="p-4 space-y-3">
      <div>
        <h2 className="text-base font-semibold flex items-center gap-2">
          <Receipt className="w-4 h-4 text-primary" />
          Recent transactions
        </h2>
        <p className="text-xs text-muted-foreground">Last 30 days, newest first.</p>
      </div>
      {transactions.length === 0 ? (
        <p className="text-sm text-muted-foreground italic py-4 text-center">
          Nothing yet — sync a bank or add manual entries.
        </p>
      ) : (
        <div className="divide-y divide-border">
          {transactions.slice(0, 50).map((t) => (
            <TxRow key={t.id} t={t} />
          ))}
        </div>
      )}
    </Card>
  );
}

function TxRow({ t }: { t: FinanceTransaction }) {
  const expense = t.direction === "expense";
  const amountSign = expense ? "-" : "+";
  const amountTone = expense ? "text-foreground" : "text-emerald-600";
  return (
    <div className="flex items-center justify-between gap-2 py-2">
      <div className="min-w-0 flex-1 flex items-center gap-2">
        <div className={expense ? "text-amber-600" : "text-emerald-500"}>
          {expense ? (
            <ArrowUpRight className="w-3.5 h-3.5" />
          ) : (
            <ArrowDownLeft className="w-3.5 h-3.5" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate">
            {t.merchant || t.description || "Transaction"}
          </p>
          <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-muted-foreground">
            <span>{t.occurred_on}</span>
            {t.category && (
              <>
                <span>·</span>
                <span className="capitalize truncate">{t.category}</span>
              </>
            )}
            {t.pending && (
              <Badge variant="outline" className="h-3.5 px-1 text-[9px]">
                pending
              </Badge>
            )}
            {t.source && t.source !== "manual" && (
              <Badge variant="outline" className="h-3.5 px-1 text-[9px] uppercase">
                {t.source}
              </Badge>
            )}
          </div>
        </div>
      </div>
      <div className={`text-sm font-mono font-semibold shrink-0 ${amountTone}`}>
        {amountSign}
        {Number(t.amount).toFixed(2)}
      </div>
    </div>
  );
}
