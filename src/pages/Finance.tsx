import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, RefreshCw, Wallet } from "lucide-react";
import { useFinanceSummary } from "@/hooks/useFinanceSummary";
import { BankConnectionsCard } from "@/components/finance/BankConnectionsCard";
import { BudgetsCard } from "@/components/finance/BudgetsCard";
import { SubscriptionAuditCard } from "@/components/finance/SubscriptionAuditCard";
import { RecentTransactionsCard } from "@/components/finance/RecentTransactionsCard";

export default function FinancePage() {
  const navigate = useNavigate();
  const { summary, loading, syncing, refresh, syncAll, syncOne, disconnect } = useFinanceSummary();

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-5xl mx-auto py-8 px-4 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate("/")} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={refresh}
              disabled={loading}
            >
              <RefreshCw className={loading ? "w-4 h-4 animate-spin" : "w-4 h-4"} />
              Refresh
            </Button>
            <Button
              size="sm"
              className="gap-2"
              onClick={syncAll}
              disabled={syncing || (summary?.connections?.length ?? 0) === 0}
            >
              {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : "Sync banks"}
            </Button>
          </div>
        </div>

        {/* Title + balance */}
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Wallet className="w-6 h-6 text-primary" />
            Finance
          </h1>
          <p className="text-sm text-muted-foreground">
            Linked accounts, budgets, and the subscription audit. Connect a bank to see automatic
            transactions.
          </p>
        </div>

        {/* Top stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <StatCard
            label="Total balance"
            value={summary ? formatBalances(summary.balances) : "—"}
            sub={
              summary
                ? `${summary.accounts.length} account${summary.accounts.length === 1 ? "" : "s"}`
                : ""
            }
          />
          <StatCard
            label="Spent (30d)"
            value={summary ? `${summary.totals.spend_30d.toFixed(2)}` : "—"}
            sub="across all accounts"
            tone="negative"
          />
          <StatCard
            label="Income (30d)"
            value={summary ? `${summary.totals.income_30d.toFixed(2)}` : "—"}
            sub={
              summary
                ? `Net ${summary.totals.net_30d >= 0 ? "+" : ""}${summary.totals.net_30d.toFixed(2)}`
                : ""
            }
            tone="positive"
          />
        </div>

        {/* Bank connections + Plaid Link */}
        <BankConnectionsCard
          connections={summary?.connections ?? []}
          accounts={summary?.accounts ?? []}
          syncing={syncing}
          onSyncOne={syncOne}
          onDisconnect={disconnect}
        />

        {/* Budgets */}
        <BudgetsCard rows={summary?.summary ?? []} />

        {/* Subscription audit */}
        <SubscriptionAuditCard rows={summary?.subscription_audit ?? []} />

        {/* Recent transactions */}
        <RecentTransactionsCard transactions={summary?.recent_transactions ?? []} />
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "positive" | "negative";
}) {
  const valueClass =
    tone === "positive"
      ? "text-emerald-600"
      : tone === "negative"
        ? "text-amber-600"
        : "text-foreground";
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`text-2xl font-semibold mt-1 ${valueClass}`}>{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground mt-1">{sub}</p>}
    </div>
  );
}

function formatBalances(b: Record<string, number>): string {
  const entries = Object.entries(b);
  if (!entries.length) return "0";
  // For multi-currency accounts, show the largest first.
  entries.sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
  const [primary, amount] = entries[0];
  const more = entries.length > 1 ? ` +${entries.length - 1}` : "";
  return `${amount.toFixed(2)} ${primary}${more}`;
}
