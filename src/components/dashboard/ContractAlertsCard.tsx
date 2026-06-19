import { useMemo } from "react";
import {
  GlassCard,
  GlassCardContent,
  GlassCardHeader,
  GlassCardTitle,
} from "@/components/ui/glass-card";
import { FileWarning } from "lucide-react";
import { differenceInDays } from "date-fns";
import { cn } from "@/lib/utils";

interface ContractAlert {
  id: string;
  name: string;
  renewalDate?: Date | null;
  cancellationNoticeDays: number;
  autoRenews: boolean;
}

interface ContractAlertsCardProps {
  contracts: ContractAlert[];
  onNavigate?: (panel: string) => void;
}

export function ContractAlertsCard({ contracts, onNavigate }: ContractAlertsCardProps) {
  const alerts = useMemo(() => {
    const now = new Date();
    return contracts
      .filter((c) => {
        if (!c.renewalDate) return false;
        const daysUntilRenewal = differenceInDays(c.renewalDate, now);
        return daysUntilRenewal >= 0 && daysUntilRenewal <= 14;
      })
      .map((c) => ({
        ...c,
        daysLeft: differenceInDays(c.renewalDate!, now),
      }))
      .sort((a, b) => a.daysLeft - b.daysLeft)
      .slice(0, 3);
  }, [contracts]);

  if (alerts.length === 0) return null;

  return (
    <GlassCard pressable haptic="light" className="border-l-4 border-l-warning">
      <GlassCardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <GlassCardTitle className="text-base flex items-center gap-2">
            <FileWarning className="w-4 h-4 text-warning" />
            Contract Alerts
          </GlassCardTitle>
          <button
            onClick={() => onNavigate?.("contracts")}
            className="text-xs text-primary hover:underline"
          >
            View all
          </button>
        </div>
      </GlassCardHeader>
      <GlassCardContent className="space-y-1.5">
        {alerts.map((alert) => (
          <div
            key={alert.id}
            className="flex items-center justify-between p-2.5 rounded-lg bg-muted/50"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">{alert.name}</p>
              <p className="text-xs text-muted-foreground">
                {alert.autoRenews ? "Auto-renews" : "Expires"} in {alert.daysLeft} day
                {alert.daysLeft !== 1 ? "s" : ""}
              </p>
            </div>
            <div
              className={cn(
                "text-[10px] px-1.5 py-0.5 rounded-full shrink-0 ml-2",
                alert.daysLeft <= 3
                  ? "bg-destructive/10 text-destructive"
                  : "bg-warning/10 text-warning",
              )}
            >
              {alert.daysLeft}d
            </div>
          </div>
        ))}
      </GlassCardContent>
    </GlassCard>
  );
}
