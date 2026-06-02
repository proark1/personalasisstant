import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ShieldCheck, AlertTriangle, ChevronRight, Mail, Loader2 } from 'lucide-react';
import type { SubscriptionAuditRow } from '@/hooks/useFinanceSummary';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { describeEdgeError } from '@/lib/edgeError';
import { toast } from 'sonner';

// Closes the loop on detect-recurring-payments: now we cross-reference
// every active contract with the actual transaction history and flag:
//   - GHOST: contract still active but no charge in 90 days → likely
//     a cancelled service the user forgot to delete.
//   - STILL CHARGING: cancelled contract with recent charges → bank
//     is still pulling money.
//   - CHARGED: matched recent charge — the normal case.
//   - UNMATCHED: contract has no transactions matching merchant —
//     either no bank linked or merchant name mismatch.
export function SubscriptionAuditCard({ rows }: { rows: SubscriptionAuditRow[] }) {
  const navigate = useNavigate();

  // Sort: ghosts first (most actionable), then by total charged.
  const sorted = [...rows].sort((a, b) => {
    const aFlag = flagFor(a);
    const bFlag = flagFor(b);
    const order = { ghost: 0, unmatched: 1, charged: 2 } as Record<string, number>;
    if (order[aFlag] !== order[bFlag]) return order[aFlag] - order[bFlag];
    return (b.total_charged_90d ?? 0) - (a.total_charged_90d ?? 0);
  });

  const ghostCount = sorted.filter((r) => flagFor(r) === 'ghost').length;

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-primary" />
            Subscription audit
            {ghostCount > 0 && (
              <Badge variant="destructive" className="text-[10px] gap-1">
                <AlertTriangle className="w-3 h-3" />
                {ghostCount} flagged
              </Badge>
            )}
          </h2>
          <p className="text-xs text-muted-foreground">
            Each active contract cross-checked against bank transactions to find ghost subscriptions and runaway charges.
          </p>
        </div>
        <Button size="sm" variant="ghost" onClick={() => navigate('/contracts')}>
          Manage contracts
        </Button>
      </div>

      {sorted.length === 0 ? (
        <p className="text-sm text-muted-foreground italic py-4 text-center">
          No active contracts. Add subscriptions on the contracts page.
        </p>
      ) : (
        <div className="space-y-2">
          {sorted.map((r) => (
            <AuditRow key={r.contract_id} row={r} />
          ))}
        </div>
      )}
    </Card>
  );
}

type AuditFlag = 'ghost' | 'charged' | 'unmatched';

function flagFor(r: SubscriptionAuditRow): AuditFlag {
  if (!r.last_transaction_id) return 'unmatched';
  if ((r.days_since_last_charge ?? 0) > 90) return 'ghost';
  return 'charged';
}

function AuditRow({ row }: { row: SubscriptionAuditRow }) {
  const [busy, setBusy] = useState(false);
  const flag = flagFor(row);
  const flagMeta: Record<AuditFlag, { label: string; tone: string }> = {
    ghost:    { label: 'GHOST',    tone: 'bg-destructive/15 text-destructive' },
    charged:  { label: 'CHARGED',  tone: 'bg-emerald-500/15 text-emerald-600' },
    unmatched:{ label: 'NO MATCH', tone: 'bg-muted text-muted-foreground' },
  };
  const m = flagMeta[flag];
  const onCancelDraft = async () => {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke('cancel-subscription', {
        body: { contract_id: row.contract_id, tone: 'formal', language: 'en' },
      });
      if (error) throw error;
      const d = data as { error?: string; drafts_count?: number } | null;
      if (d?.error) throw new Error(d.error);
      const n = d?.drafts_count ?? 0;
      toast.success(`Drafted ${n} version${n === 1 ? '' : 's'} · follow-up task added`);
    } catch (e) {
      toast.error(await describeEdgeError(e, 'Failed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-md border border-border bg-card/40 p-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded uppercase ${m.tone}`}>
              {m.label}
            </span>
            <span className="font-medium text-sm truncate">{row.contract_name}</span>
            {row.contract_provider && (
              <span className="text-[10px] text-muted-foreground">· {row.contract_provider}</span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground">
            {row.expected_amount != null && (
              <span>
                Expected: <span className="font-medium text-foreground">{Number(row.expected_amount).toFixed(2)}</span>
                {row.expected_frequency && <span className="text-muted-foreground"> /{row.expected_frequency}</span>}
              </span>
            )}
            {row.last_transaction_date && (
              <span>
                Last: <span className="font-medium text-foreground">{Number(row.last_transaction_amount ?? 0).toFixed(2)}</span> on {row.last_transaction_date}
              </span>
            )}
            {row.charge_count_90d != null && row.charge_count_90d > 0 && (
              <span>
                <ChevronRight className="w-3 h-3 inline" />
                {row.charge_count_90d}× / 90d ({Number(row.total_charged_90d ?? 0).toFixed(2)})
              </span>
            )}
          </div>
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-[11px] gap-1 shrink-0"
          onClick={onCancelDraft}
          disabled={busy}
          title="Draft a cancellation email + create a follow-up task"
        >
          {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Mail className="w-3 h-3" />}
          Cancel
        </Button>
      </div>
    </div>
  );
}
