import { motion } from "framer-motion";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";
import { useHaptics } from "@/hooks/useHaptics";
import { cn } from "@/lib/utils";

interface DhikrType {
  id: string;
  arabic: string;
  english: string;
  defaultTarget: number;
}

interface DhikrLog {
  id: string;
  dhikr_type: string;
  target_count: number;
  completed_count: number;
  log_date: string;
}

interface DhikrCounterProps {
  dhikrTypes: DhikrType[];
  dhikrLogs: DhikrLog[];
  onIncrement: (type: string) => void;
  onReset: (type: string) => void;
  compact?: boolean;
}

export function DhikrCounter({
  dhikrTypes,
  dhikrLogs,
  onIncrement,
  onReset,
  compact,
}: DhikrCounterProps) {
  const { vibrate } = useHaptics();

  const getLog = (typeId: string) => dhikrLogs.find((l) => l.dhikr_type === typeId);

  const totalCompleted = dhikrTypes.reduce((sum, t) => {
    const log = getLog(t.id);
    return sum + (log?.completed_count || 0);
  }, 0);

  const totalTarget = dhikrTypes.reduce((sum, t) => {
    const log = getLog(t.id);
    return sum + (log?.target_count || t.defaultTarget);
  }, 0);

  const handleTap = (typeId: string) => {
    vibrate("light");
    onIncrement(typeId);
  };

  if (compact) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-medium">Today's Dhikr</span>
          <span className="text-xs text-muted-foreground">
            {totalCompleted}/{totalTarget}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {dhikrTypes.slice(0, 3).map((type) => {
            const log = getLog(type.id);
            const count = log?.completed_count || 0;
            const target = log?.target_count || type.defaultTarget;
            const pct = Math.min((count / target) * 100, 100);
            const done = count >= target;

            return (
              <motion.button
                key={type.id}
                whileTap={{ scale: 0.92 }}
                onClick={() => handleTap(type.id)}
                className={cn(
                  "relative rounded-xl p-3 text-center border transition-colors",
                  done
                    ? "bg-emerald-500/10 border-emerald-500/30"
                    : "bg-muted/50 border-border hover:bg-muted",
                )}
              >
                <div
                  className="absolute inset-0 rounded-xl bg-primary/10 origin-bottom transition-all"
                  style={{ transform: `scaleY(${pct / 100})` }}
                />
                <p className="relative font-arabic text-base leading-tight">{type.arabic}</p>
                <p className="relative text-xs text-muted-foreground mt-1">
                  {count}/{target}
                </p>
              </motion.button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {dhikrTypes.map((type) => {
        const log = getLog(type.id);
        const count = log?.completed_count || 0;
        const target = log?.target_count || type.defaultTarget;
        const pct = Math.min((count / target) * 100, 100);
        const done = count >= target;

        return (
          <GlassCard
            key={type.id}
            pressable
            haptic="light"
            onClick={() => handleTap(type.id)}
            className={cn("relative overflow-hidden p-4", done && "border-emerald-500/40")}
          >
            {/* Progress fill */}
            <div
              className={cn(
                "absolute inset-0 origin-left transition-all duration-300",
                done ? "bg-emerald-500/10" : "bg-primary/5",
              )}
              style={{ transform: `scaleX(${pct / 100})` }}
            />

            <div className="relative flex items-center justify-between">
              <div className="flex items-center gap-3">
                {/* Circular mini progress */}
                <div className="relative w-12 h-12 shrink-0">
                  <svg viewBox="0 0 48 48" className="w-full h-full -rotate-90">
                    <circle
                      cx="24"
                      cy="24"
                      r="20"
                      fill="none"
                      strokeWidth="3"
                      className="stroke-muted"
                    />
                    <circle
                      cx="24"
                      cy="24"
                      r="20"
                      fill="none"
                      strokeWidth="3"
                      className={done ? "stroke-emerald-500" : "stroke-primary"}
                      strokeDasharray={`${pct * 1.257} 125.7`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-xs font-bold">
                    {count}
                  </span>
                </div>

                <div>
                  <p className="font-arabic text-lg leading-tight">{type.arabic}</p>
                  <p className="text-xs text-muted-foreground">
                    {type.english} · {target}
                  </p>
                </div>
              </div>

              {count > 0 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    onReset(type.id);
                  }}
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </Button>
              )}
            </div>
          </GlassCard>
        );
      })}
    </div>
  );
}
