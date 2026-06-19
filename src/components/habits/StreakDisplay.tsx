import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Flame } from "lucide-react";
import { subDays, format, startOfDay } from "date-fns";
import { cn } from "@/lib/utils";

interface HabitWithStreak {
  id: string;
  name: string;
  icon: string;
  color: string;
  streak: number;
  isCompleted: boolean;
}

interface StreakDisplayProps {
  habits: HabitWithStreak[];
}

export function StreakDisplay({ habits }: StreakDisplayProps) {
  const longestStreak = Math.max(...habits.map((h) => h.streak), 0);
  const totalCompletedToday = habits.filter((h) => h.isCompleted).length;

  // Generate last 7 days for calendar view
  const lastSevenDays = useMemo(() => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      days.push(subDays(new Date(), i));
    }
    return days;
  }, []);

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-medium flex items-center gap-2">
          <Flame className="w-4 h-4 text-orange-500" />
          Streak Overview
        </h3>
        <div className="text-right">
          <p className="text-2xl font-bold text-orange-500">{longestStreak}</p>
          <p className="text-xs text-muted-foreground">longest streak</p>
        </div>
      </div>

      {/* Weekly Calendar */}
      <div className="grid grid-cols-7 gap-1 mb-4">
        {lastSevenDays.map((day, i) => {
          const isToday = startOfDay(day).getTime() === startOfDay(new Date()).getTime();
          const dayName = format(day, "EEE")[0];

          return (
            <div key={i} className="text-center">
              <span className="text-xs text-muted-foreground">{dayName}</span>
              <div
                className={cn(
                  "w-8 h-8 mx-auto mt-1 rounded-full flex items-center justify-center text-xs font-medium",
                  isToday ? "bg-primary text-primary-foreground" : "bg-muted",
                )}
              >
                {format(day, "d")}
              </div>
            </div>
          );
        })}
      </div>

      {/* Habit Streaks */}
      <div className="space-y-2">
        {habits
          .filter((h) => h.streak > 0)
          .sort((a, b) => b.streak - a.streak)
          .slice(0, 5)
          .map((habit) => (
            <div key={habit.id} className="flex items-center gap-2">
              <span className="text-sm">{habit.icon}</span>
              <span className="text-sm flex-1 truncate">{habit.name}</span>
              <div className="flex items-center gap-1">
                <Flame className="w-3 h-3 text-orange-500" />
                <span className="text-sm font-medium">{habit.streak}</span>
              </div>
            </div>
          ))}

        {habits.filter((h) => h.streak > 0).length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-2">
            Complete habits to build streaks!
          </p>
        )}
      </div>

      {/* Today's Summary */}
      <div className="mt-4 pt-4 border-t border-border text-center">
        <p className="text-sm text-muted-foreground">
          Today:{" "}
          <span className="font-medium text-foreground">
            {totalCompletedToday}/{habits.length}
          </span>{" "}
          habits completed
        </p>
      </div>
    </Card>
  );
}
