import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  Sparkles,
  TrendingUp,
  CheckCircle,
  Clock,
  Flame,
  Brain,
  Target,
  RefreshCw,
  Loader2,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useWeeklyInsights } from "@/hooks/useWeeklyInsights";

interface WeeklyInsightsPanelProps {
  className?: string;
  compact?: boolean;
}

export function WeeklyInsightsPanel({ className, compact = false }: WeeklyInsightsPanelProps) {
  const {
    insights,
    weeklyStats,
    isLoading,
    isGenerating,
    generateInsights,
    markInsightRead,
    markActionTaken,
  } = useWeeklyInsights();
  const { t } = useLanguage();

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="w-5 h-5" />
            {t("weeklyInsights.title")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (compact) {
    return (
      <Card className={cn("cursor-pointer hover:bg-muted/50 transition-colors", className)}>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Brain className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-sm">{t("weeklyInsights.title")}</p>
              {weeklyStats && (
                <p className="text-xs text-muted-foreground">
                  {weeklyStats.tasksCompleted} {t("xp.tasks")} • {weeklyStats.focusMinutes}min
                </p>
              )}
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Brain className="w-5 h-5 text-primary" />
            {t("weeklyInsights.title")}
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={generateInsights} disabled={isGenerating}>
            {isGenerating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stats Overview */}
        {weeklyStats && (
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-muted/50">
              <div className="flex items-center gap-2 text-primary mb-1">
                <CheckCircle className="w-4 h-4" />
                <span className="text-xs font-medium">{t("weeklyInsights.tasksDone")}</span>
              </div>
              <p className="text-2xl font-bold">{weeklyStats.tasksCompleted}</p>
              <Progress value={weeklyStats.completionRate} className="h-1 mt-2" />
              <p className="text-xs text-muted-foreground mt-1">
                {weeklyStats.completionRate}% {t("weeklyInsights.completionRate")}
              </p>
            </div>

            <div className="p-3 rounded-lg bg-muted/50">
              <div className="flex items-center gap-2 text-accent mb-1">
                <Clock className="w-4 h-4" />
                <span className="text-xs font-medium">{t("weeklyInsights.focusTime")}</span>
              </div>
              <p className="text-2xl font-bold">{Math.round(weeklyStats.focusMinutes / 60)}h</p>
              <p className="text-xs text-muted-foreground mt-1">
                {weeklyStats.focusMinutes} {t("weeklyInsights.minutesTotal")}
              </p>
            </div>

            <div className="p-3 rounded-lg bg-muted/50">
              <div className="flex items-center gap-2 text-warning mb-1">
                <Flame className="w-4 h-4" />
                <span className="text-xs font-medium">{t("weeklyInsights.habits")}</span>
              </div>
              <p className="text-2xl font-bold">{weeklyStats.habitsCompleted}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {t("weeklyInsights.completedThisWeek")}
              </p>
            </div>

            <div className="p-3 rounded-lg bg-muted/50">
              <div className="flex items-center gap-2 text-secondary mb-1">
                <Target className="w-4 h-4" />
                <span className="text-xs font-medium">{t("weeklyInsights.energy")}</span>
              </div>
              <p className="text-lg font-bold capitalize">{weeklyStats.averageEnergy || "—"}</p>
              <p className="text-xs text-muted-foreground mt-1">{t("weeklyInsights.avgEnergy")}</p>
            </div>
          </div>
        )}

        {/* AI Insights */}
        {insights.length > 0 ? (
          <ScrollArea className="h-[200px]">
            <div className="space-y-3">
              {insights.slice(0, 5).map((insight) => (
                <Card
                  key={insight.id}
                  className={cn(
                    "transition-colors",
                    !insight.is_read && "border-primary/50 bg-primary/5",
                  )}
                  onClick={() => !insight.is_read && markInsightRead(insight.id)}
                >
                  <CardContent className="p-3">
                    <div className="flex items-start gap-2">
                      <Sparkles
                        className={cn(
                          "w-4 h-4 mt-0.5 shrink-0",
                          insight.is_actionable ? "text-warning" : "text-muted-foreground",
                        )}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium text-sm">{insight.title}</p>
                          {insight.is_actionable && !insight.action_taken && (
                            <Badge variant="outline" className="text-xs">
                              {t("weeklyInsights.actionNeeded")}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">{insight.content}</p>
                        {insight.is_actionable && !insight.action_taken && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="mt-2 h-7 text-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              markActionTaken(insight.id);
                            }}
                          >
                            <CheckCircle className="w-3 h-3 mr-1" />
                            {t("weeklyInsights.markDone")}
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        ) : (
          <div className="text-center py-6">
            <TrendingUp className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">{t("weeklyInsights.noInsights")}</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={generateInsights}
              disabled={isGenerating || !weeklyStats}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {t("weeklyInsights.generating")}
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  {t("weeklyInsights.generate")}
                </>
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
