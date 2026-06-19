import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Target, Flame, BookOpen, TrendingUp, Settings, CheckCircle2 } from "lucide-react";
import { useQuranReadingProgress } from "@/hooks/useQuranReadingProgress";
import { cn } from "@/lib/utils";

export function QuranProgressPanel() {
  const {
    loading,
    todayAyahsRead,
    todayGoalProgress,
    goal,
    weeklyStats,
    totalAyahsRead,
    currentStreak,
    updateGoal,
  } = useQuranReadingProgress();

  const [showGoalDialog, setShowGoalDialog] = useState(false);
  const [newGoal, setNewGoal] = useState(goal?.daily_ayahs_goal || 10);

  const handleSaveGoal = async () => {
    await updateGoal({ daily_ayahs_goal: newGoal });
    setShowGoalDialog(false);
  };

  if (loading) {
    return (
      <div className="p-4 space-y-4 animate-pulse">
        <div className="h-32 bg-muted rounded-lg" />
        <div className="h-24 bg-muted rounded-lg" />
      </div>
    );
  }

  const goalCompleted = goal && todayAyahsRead >= goal.daily_ayahs_goal;

  return (
    <div className="p-4 space-y-4">
      {/* Today's Progress Card */}
      <Card
        className={cn(
          "p-4 bg-gradient-to-br",
          goalCompleted
            ? "from-emerald-500/20 via-green-500/10 to-background border-emerald-500/30"
            : "from-primary/20 via-primary/10 to-background border-primary/30",
        )}
      >
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="text-sm text-muted-foreground">Today's Progress</p>
            <div className="flex items-center gap-2">
              <h3 className="text-3xl font-bold">
                {todayAyahsRead}
                <span className="text-lg font-normal text-muted-foreground">
                  /{goal?.daily_ayahs_goal || 10}
                </span>
              </h3>
              {goalCompleted && <CheckCircle2 className="w-6 h-6 text-emerald-500" />}
            </div>
            <p className="text-xs text-muted-foreground">ayahs read</p>
          </div>
          <Dialog open={showGoalDialog} onOpenChange={setShowGoalDialog}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon">
                <Settings className="w-4 h-4" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Set Daily Reading Goal</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Ayahs per day</label>
                  <Input
                    type="number"
                    value={newGoal}
                    onChange={(e) => setNewGoal(parseInt(e.target.value) || 10)}
                    min={1}
                    max={500}
                  />
                  <p className="text-xs text-muted-foreground">
                    At this pace, you'll complete the Quran in approximately{" "}
                    {Math.ceil(6236 / (newGoal || 1))} days
                  </p>
                </div>
                <Button onClick={handleSaveGoal} className="w-full">
                  Save Goal
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
        <Progress
          value={Math.min(todayGoalProgress, 100)}
          className={cn("h-3", goalCompleted && "[&>div]:bg-emerald-500")}
        />
        {goalCompleted ? (
          <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-2 font-medium">
            🎉 Daily goal completed! Keep reading for extra reward.
          </p>
        ) : (
          <p className="text-xs text-muted-foreground mt-2">
            {goal ? goal.daily_ayahs_goal - todayAyahsRead : 10 - todayAyahsRead} more ayahs to
            reach your goal
          </p>
        )}
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-3 text-center">
          <Flame className="w-5 h-5 mx-auto mb-1 text-orange-500" />
          <p className="text-2xl font-bold">{currentStreak}</p>
          <p className="text-xs text-muted-foreground">Day Streak</p>
        </Card>
        <Card className="p-3 text-center">
          <BookOpen className="w-5 h-5 mx-auto mb-1 text-primary" />
          <p className="text-2xl font-bold">{totalAyahsRead.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">Total Ayahs</p>
        </Card>
        <Card className="p-3 text-center">
          <Target className="w-5 h-5 mx-auto mb-1 text-emerald-500" />
          <p className="text-2xl font-bold">{((totalAyahsRead / 6236) * 100).toFixed(1)}%</p>
          <p className="text-xs text-muted-foreground">Complete</p>
        </Card>
      </div>

      {/* Weekly Chart */}
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="w-4 h-4 text-primary" />
          <h4 className="font-medium">This Week</h4>
        </div>
        <div className="flex items-end justify-between gap-1 h-24">
          {weeklyStats.map((day, i) => {
            const maxAyahs = Math.max(
              ...weeklyStats.map((d) => d.ayahsRead),
              goal?.daily_ayahs_goal || 10,
            );
            const height = maxAyahs > 0 ? (day.ayahsRead / maxAyahs) * 100 : 0;
            const isToday = i === weeklyStats.length - 1;
            const reachedGoal = goal && day.ayahsRead >= goal.daily_ayahs_goal;

            return (
              <div key={day.date} className="flex flex-col items-center flex-1">
                <div className="relative w-full flex justify-center mb-1">
                  <div
                    className={cn(
                      "w-full max-w-8 rounded-t transition-all",
                      reachedGoal ? "bg-emerald-500" : isToday ? "bg-primary" : "bg-primary/40",
                    )}
                    style={{ height: `${Math.max(height, 4)}%`, minHeight: "4px" }}
                  />
                </div>
                <span
                  className={cn(
                    "text-xs",
                    isToday ? "font-medium text-primary" : "text-muted-foreground",
                  )}
                >
                  {day.date}
                </span>
              </div>
            );
          })}
        </div>
        {goal && (
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border">
            <div className="w-3 h-3 rounded bg-emerald-500" />
            <span className="text-xs text-muted-foreground">
              Goal reached ({goal.daily_ayahs_goal} ayahs)
            </span>
          </div>
        )}
      </Card>
    </div>
  );
}
