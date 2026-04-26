import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sparkles, AlertTriangle } from 'lucide-react';
import { useAIUsage } from '@/hooks/useAIUsage';
import { cn } from '@/lib/utils';

const MONTH_LABEL = (iso: string): string => {
  if (!iso) return '';
  const [y, m] = iso.split('-');
  const dt = new Date(Number(y), Number(m) - 1, 1);
  return dt.toLocaleString(undefined, { month: 'short', year: '2-digit' });
};

// "AI usage" card. Shows current-month spend vs. cap, plus a
// 12-month sparkline-style strip below. Sits at the top of the
// Memory dashboard since both surfaces are about transparency.

export function AIUsageCard() {
  const usage = useAIUsage();
  if (!usage.summary) {
    return (
      <Card className="p-3">
        <p className="text-xs text-muted-foreground">Loading usage…</p>
      </Card>
    );
  }
  const s = usage.summary;
  const capDollars = (s.cap_cents / 100).toFixed(2);
  const spentDollars = (s.spent_cents / 100).toFixed(2);
  const tone = s.over_cap
    ? 'bg-destructive'
    : s.used_pct >= 85
    ? 'bg-amber-500'
    : 'bg-primary';

  // Find the max cost across the 12-month strip for normalisation.
  const maxCost = Math.max(...usage.monthly.map((m) => m.cost_cents), 1);

  return (
    <Card className="p-3 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            AI usage · this month
          </h3>
          <p className="text-[10px] text-muted-foreground">
            What every AI call (memory, packing, scheduler, vision) costs.
          </p>
        </div>
        {s.over_cap && (
          <Badge variant="destructive" className="text-[10px] gap-1">
            <AlertTriangle className="w-3 h-3" /> over cap
          </Badge>
        )}
      </div>

      {/* Progress bar */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span className="font-mono">${spentDollars} / ${capDollars}</span>
          <span className="text-muted-foreground">
            {s.calls} call{s.calls === 1 ? '' : 's'} · {s.tokens.toLocaleString()} tokens
          </span>
        </div>
        <div className="h-1.5 w-full rounded bg-muted/40 overflow-hidden">
          <div
            className={cn('h-full transition-all', tone)}
            style={{ width: `${Math.min(100, s.used_pct)}%` }}
          />
        </div>
      </div>

      {/* 12-month strip */}
      {usage.monthly.length > 0 && (
        <div className="space-y-1">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Last {usage.monthly.length} months
          </p>
          <div className="flex items-end gap-1 h-12">
            {[...usage.monthly].reverse().map((m) => {
              const h = Math.max(2, Math.round((m.cost_cents / maxCost) * 100));
              return (
                <div
                  key={m.month}
                  className="flex-1 flex flex-col items-center justify-end"
                  title={`${MONTH_LABEL(m.month)}: $${(m.cost_cents / 100).toFixed(2)} · ${m.calls} calls`}
                >
                  <div
                    className="w-full bg-primary/40 rounded-t-sm"
                    style={{ height: `${h}%` }}
                  />
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-between text-[9px] text-muted-foreground">
            <span>{MONTH_LABEL(usage.monthly[usage.monthly.length - 1]?.month ?? '')}</span>
            <span>{MONTH_LABEL(usage.monthly[0]?.month ?? '')}</span>
          </div>
        </div>
      )}

      {s.over_cap && (
        <p className="text-[10px] text-destructive">
          AI features will return early until next month — ask the operator to bump your cap if needed.
        </p>
      )}
    </Card>
  );
}
