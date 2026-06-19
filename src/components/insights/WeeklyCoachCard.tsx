import { useState } from "react";
import { useWeeklyCoach } from "@/hooks/useWeeklyCoach";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Trophy,
  TrendingUp,
  Target,
  Heart,
  Scale,
  CheckCircle2,
  AlertCircle,
  Lightbulb,
  Calendar,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import { cn } from "@/lib/utils";

export function WeeklyCoachCard() {
  const { report, loading, generating, generateReport, markAsRead } = useWeeklyCoach();
  const { t, language } = useLanguage();
  const [dialogOpen, setDialogOpen] = useState(false);
  const dateLocale = language === "de" ? de : undefined;

  const handleOpenChange = (open: boolean) => {
    setDialogOpen(open);
    if (open && report && !report.isRead) {
      markAsRead();
    }
  };

  if (loading) {
    return (
      <Card className="glass-panel-solid">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Trophy className="w-4 h-4 text-primary" />
            {t("weeklyCoach.title")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass-panel-solid overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Trophy className="w-4 h-4 text-primary" />
            {t("weeklyCoach.title")}
            {report && !report.isRead && (
              <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4">
                {t("weeklyCoach.new")}
              </Badge>
            )}
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={() => generateReport()} disabled={generating}>
            <RefreshCw className={cn("w-4 h-4", generating && "animate-spin")} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {!report ? (
          <div className="text-center py-4">
            <Sparkles className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground mb-3">{t("weeklyCoach.noReport")}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => generateReport()}
              disabled={generating}
            >
              {generating ? t("weeklyCoach.generating") : t("weeklyCoach.generate")}
            </Button>
          </div>
        ) : (
          <Dialog open={dialogOpen} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
              <button className="w-full text-left">
                <div className="flex items-center gap-4 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                  {/* Score Circles */}
                  <div className="flex gap-2">
                    <div className="relative w-12 h-12">
                      <svg className="w-12 h-12 -rotate-90">
                        <circle
                          cx="24"
                          cy="24"
                          r="20"
                          stroke="currentColor"
                          strokeWidth="4"
                          fill="none"
                          className="text-muted"
                        />
                        <circle
                          cx="24"
                          cy="24"
                          r="20"
                          stroke="currentColor"
                          strokeWidth="4"
                          fill="none"
                          strokeDasharray={`${(report.productivityScore || 0) * 1.256} 126`}
                          className="text-primary"
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-xs font-bold">{report.productivityScore || 0}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">
                      {t("weeklyCoach.weekOf")}{" "}
                      {format(parseISO(report.weekStart), "MMM d", { locale: dateLocale })}
                    </p>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {report.summaryText ||
                        `${report.tasksCompleted} ${t("weeklyCoach.tasksCompleted")}`}
                    </p>
                  </div>

                  <TrendingUp className="w-4 h-4 text-muted-foreground shrink-0" />
                </div>
              </button>
            </DialogTrigger>

            <DialogContent className="max-w-lg max-h-[85vh]">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-primary" />
                  {t("weeklyCoach.report")}
                </DialogTitle>
                <p className="text-sm text-muted-foreground">
                  {format(parseISO(report.weekStart), "MMM d", { locale: dateLocale })} -{" "}
                  {format(parseISO(report.weekEnd), "MMM d, yyyy", { locale: dateLocale })}
                </p>
              </DialogHeader>

              <ScrollArea className="max-h-[60vh] pr-4">
                <div className="space-y-4">
                  {/* Summary */}
                  {report.summaryText && (
                    <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                      <p className="text-sm">{report.summaryText}</p>
                    </div>
                  )}

                  {/* Score Cards */}
                  <div className="grid grid-cols-3 gap-2">
                    <ScoreCard
                      icon={Target}
                      label={t("weeklyCoach.productivity")}
                      score={report.productivityScore || 0}
                      color="primary"
                    />
                    <ScoreCard
                      icon={Heart}
                      label={t("weeklyCoach.wellbeing")}
                      score={report.wellbeingScore || 0}
                      color="destructive"
                    />
                    <ScoreCard
                      icon={Scale}
                      label={t("weeklyCoach.balance")}
                      score={report.balanceScore || 0}
                      color="warning"
                    />
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-2">
                    <StatItem
                      icon={CheckCircle2}
                      label={t("weeklyCoach.tasksCompleted")}
                      value={report.tasksCompleted}
                    />
                    <StatItem
                      icon={Calendar}
                      label={t("weeklyCoach.focusMinutes")}
                      value={report.focusMinutes}
                    />
                  </div>

                  {/* Wins */}
                  {report.wins.length > 0 && (
                    <Section
                      title={t("weeklyCoach.wins")}
                      icon={CheckCircle2}
                      iconColor="text-green-500"
                    >
                      {report.wins.map((win, i) => (
                        <li key={i} className="text-sm">
                          {win}
                        </li>
                      ))}
                    </Section>
                  )}

                  {/* Improvements */}
                  {report.improvements.length > 0 && (
                    <Section
                      title={t("weeklyCoach.areasToImprove")}
                      icon={AlertCircle}
                      iconColor="text-amber-500"
                    >
                      {report.improvements.map((item, i) => (
                        <li key={i} className="text-sm">
                          {item}
                        </li>
                      ))}
                    </Section>
                  )}

                  {/* Recommendations */}
                  {report.recommendations.length > 0 && (
                    <Section
                      title={t("weeklyCoach.recommendations")}
                      icon={Lightbulb}
                      iconColor="text-blue-500"
                    >
                      {report.recommendations.map((rec, i) => (
                        <li key={i} className="text-sm">
                          {rec}
                        </li>
                      ))}
                    </Section>
                  )}

                  {/* Goal Progress */}
                  {Object.keys(report.goalProgress).length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium flex items-center gap-2">
                        <Target className="w-4 h-4 text-primary" />
                        {t("weeklyCoach.goalProgress")}
                      </h4>
                      {Object.entries(report.goalProgress).map(([name, progress]) => (
                        <div key={name} className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span>{name}</span>
                            <span className="text-muted-foreground">{progress}%</span>
                          </div>
                          <Progress value={progress} className="h-1.5" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </ScrollArea>
            </DialogContent>
          </Dialog>
        )}
      </CardContent>
    </Card>
  );
}

function ScoreCard({
  icon: Icon,
  label,
  score,
  color,
}: {
  icon: typeof Target;
  label: string;
  score: number;
  color: "primary" | "destructive" | "warning";
}) {
  const colorClass = {
    primary: "text-primary",
    destructive: "text-destructive",
    warning: "text-warning",
  }[color];

  return (
    <div className="p-2 rounded-lg bg-muted/50 text-center">
      <Icon className={cn("w-4 h-4 mx-auto mb-1", colorClass)} />
      <div className="text-lg font-bold">{score}</div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
    </div>
  );
}

function StatItem({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof CheckCircle2;
  label: string;
  value: number;
}) {
  return (
    <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/30">
      <Icon className="w-4 h-4 text-muted-foreground" />
      <div>
        <div className="text-sm font-medium">{value}</div>
        <div className="text-[10px] text-muted-foreground">{label}</div>
      </div>
    </div>
  );
}

function Section({
  title,
  icon: Icon,
  iconColor,
  children,
}: {
  title: string;
  icon: typeof CheckCircle2;
  iconColor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium flex items-center gap-2">
        <Icon className={cn("w-4 h-4", iconColor)} />
        {title}
      </h4>
      <ul className="list-disc list-inside space-y-1 text-muted-foreground">{children}</ul>
    </div>
  );
}
