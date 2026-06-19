import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, CheckCircle2, Sparkles, Moon, Utensils, Coins, ListChecks } from "lucide-react";
import { useFamilyDailyLife } from "@/hooks/useFamilyDailyLife";
import { useFamilyMembers } from "@/hooks/useFamilyMembers";
import { AddChoreDialog } from "./AddChoreDialog";
import { AddAllowanceDialog } from "./AddAllowanceDialog";
import { EditMealPrefsDialog } from "./EditMealPrefsDialog";
import { EditSleepScheduleDialog } from "./EditSleepScheduleDialog";

export function FamilyDailyLifeCard() {
  const { chores, allowance, mealPrefs, sleepSchedules, loading, completeChore } =
    useFamilyDailyLife();
  const { members } = useFamilyMembers();
  const [choreOpen, setChoreOpen] = useState(false);
  const [allowOpen, setAllowOpen] = useState(false);
  const [mealOpen, setMealOpen] = useState(false);
  const [sleepOpen, setSleepOpen] = useState(false);

  const memberName = (id: string | null) =>
    id ? members.find((m) => m.id === id)?.name || "—" : "Anyone";

  const balances = useMemo(() => {
    const map = new Map<string, number>();
    allowance.forEach((a) => {
      const sign = a.entry_type === "spent" ? -1 : 1;
      map.set(a.family_member_id, (map.get(a.family_member_id) || 0) + sign * Number(a.amount));
    });
    return map;
  }, [allowance]);

  if (loading) return <div className="text-sm text-muted-foreground p-4">Loading…</div>;

  return (
    <div className="space-y-4">
      {/* Chores */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ListChecks className="h-4 w-4 text-primary" />
            Chores
          </CardTitle>
          <Button size="sm" variant="outline" onClick={() => setChoreOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Add
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {chores.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No chores yet. Add one to start tracking.
            </p>
          )}
          {chores
            .filter((c) => c.is_active)
            .map((c) => (
              <div key={c.id} className="flex items-center justify-between rounded-lg border p-3">
                <div className="min-w-0">
                  <div className="font-medium text-sm truncate">{c.title}</div>
                  <div className="text-xs text-muted-foreground flex items-center gap-2">
                    <span>{memberName(c.family_member_id)}</span>
                    <Badge variant="secondary" className="text-[10px]">
                      {c.frequency}
                    </Badge>
                    <span className="flex items-center gap-1">
                      <Sparkles className="h-3 w-3" /> {c.points}pt
                    </span>
                  </div>
                </div>
                <Button size="sm" variant="ghost" onClick={() => completeChore(c)}>
                  <CheckCircle2 className="h-4 w-4 text-success" />
                </Button>
              </div>
            ))}
        </CardContent>
      </Card>

      {/* Allowance */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Coins className="h-4 w-4 text-warning" />
            Allowance
          </CardTitle>
          <Button size="sm" variant="outline" onClick={() => setAllowOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Log
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {balances.size === 0 && <p className="text-sm text-muted-foreground">No entries yet.</p>}
          {Array.from(balances.entries()).map(([mid, balance]) => (
            <div key={mid} className="flex items-center justify-between rounded-lg border p-3">
              <span className="text-sm font-medium">{memberName(mid)}</span>
              <span
                className={`text-sm font-semibold ${balance >= 0 ? "text-success" : "text-destructive"}`}
              >
                {balance.toFixed(2)}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Meal Prefs */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Utensils className="h-4 w-4 text-accent-foreground" />
            Meal preferences
          </CardTitle>
          <Button size="sm" variant="outline" onClick={() => setMealOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Edit
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {mealPrefs.length === 0 && (
            <p className="text-sm text-muted-foreground">No preferences saved.</p>
          )}
          {mealPrefs.map((p) => (
            <div key={p.id} className="rounded-lg border p-3 text-sm">
              <div className="font-medium">{memberName(p.family_member_id)}</div>
              {!!p.loves?.length && (
                <div className="text-xs text-muted-foreground mt-1">❤️ {p.loves.join(", ")}</div>
              )}
              {!!p.dislikes?.length && (
                <div className="text-xs text-muted-foreground">🚫 {p.dislikes.join(", ")}</div>
              )}
              {!!p.dietary_restrictions?.length && (
                <div className="text-xs text-muted-foreground">
                  ⚠️ {p.dietary_restrictions.join(", ")}
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Sleep */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Moon className="h-4 w-4 text-primary" />
            Sleep & screen-time
          </CardTitle>
          <Button size="sm" variant="outline" onClick={() => setSleepOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Edit
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {sleepSchedules.length === 0 && (
            <p className="text-sm text-muted-foreground">No schedules saved.</p>
          )}
          {sleepSchedules.map((s) => (
            <div key={s.id} className="rounded-lg border p-3 text-sm">
              <div className="font-medium">{memberName(s.family_member_id)}</div>
              <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-3">
                {s.bedtime && <span>🌙 {s.bedtime.slice(0, 5)}</span>}
                {s.wake_time && <span>☀️ {s.wake_time.slice(0, 5)}</span>}
                {s.nap_time && <span>💤 {s.nap_time.slice(0, 5)}</span>}
                {s.screen_time_limit_minutes && <span>📱 {s.screen_time_limit_minutes}m/day</span>}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <AddChoreDialog open={choreOpen} onOpenChange={setChoreOpen} />
      <AddAllowanceDialog open={allowOpen} onOpenChange={setAllowOpen} />
      <EditMealPrefsDialog open={mealOpen} onOpenChange={setMealOpen} />
      <EditSleepScheduleDialog open={sleepOpen} onOpenChange={setSleepOpen} />
    </div>
  );
}
