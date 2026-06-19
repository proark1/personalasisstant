import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useLifeScore } from "@/hooks/useLifeScore";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Minus,
  Brain,
  Heart,
  Users,
  Star,
  Home,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ScoreCategoryProps {
  label: string;
  score: number;
  icon: React.ReactNode;
  trend: "up" | "down" | "stable";
  color: string;
}

function ScoreCategory({ label, score, icon, trend, color }: ScoreCategoryProps) {
  return (
    <div className="flex items-center gap-3">
      <div className={cn("w-8 h-8 rounded-full flex items-center justify-center", color)}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-medium truncate">{label}</span>
          <div className="flex items-center gap-1">
            <span className="text-sm font-semibold">{score}</span>
            {trend === "up" && <TrendingUp className="w-3 h-3 text-green-500" />}
            {trend === "down" && <TrendingDown className="w-3 h-3 text-red-500" />}
            {trend === "stable" && <Minus className="w-3 h-3 text-muted-foreground" />}
          </div>
        </div>
        <Progress value={score} className="h-1.5" />
      </div>
    </div>
  );
}

export function LifeScoreCard() {
  const { todayScore, calculating, calculateScore, getTrend, loading } = useLifeScore();
  const { t } = useLanguage();

  const overallScore = todayScore?.overallScore || 0;
  const circumference = 2 * Math.PI * 45;
  const strokeDashoffset = circumference - (overallScore / 100) * circumference;

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-500";
    if (score >= 60) return "text-yellow-500";
    if (score >= 40) return "text-orange-500";
    return "text-red-500";
  };

  const getScoreLabel = (score: number) => {
    if (score >= 80) return t("lifeScore.thriving");
    if (score >= 60) return t("lifeScore.good");
    if (score >= 40) return t("lifeScore.fair");
    return t("lifeScore.needsAttention");
  };

  if (loading) {
    return (
      <Card className="animate-pulse">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <div className="w-5 h-5 bg-muted rounded" />
            <div className="h-5 w-24 bg-muted rounded" />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-32 bg-muted rounded" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Star className="w-5 h-5 text-primary" />
            {t("lifeScore.title")}
          </CardTitle>
          <Button
            variant="ghost"
            size="icon"
            onClick={calculateScore}
            disabled={calculating}
            className="h-8 w-8"
          >
            <RefreshCw className={cn("w-4 h-4", calculating && "animate-spin")} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Main Score Circle */}
        <div className="flex items-center justify-center">
          <div className="relative w-32 h-32">
            <svg className="w-32 h-32 transform -rotate-90">
              <circle
                cx="64"
                cy="64"
                r="45"
                stroke="currentColor"
                strokeWidth="8"
                fill="none"
                className="text-muted"
              />
              <circle
                cx="64"
                cy="64"
                r="45"
                stroke="currentColor"
                strokeWidth="8"
                fill="none"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                className={cn("transition-all duration-1000", getScoreColor(overallScore))}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={cn("text-3xl font-bold", getScoreColor(overallScore))}>
                {overallScore}
              </span>
              <span className="text-xs text-muted-foreground">{getScoreLabel(overallScore)}</span>
            </div>
          </div>
        </div>

        {/* Category Scores */}
        <div className="space-y-3">
          <ScoreCategory
            label={t("lifeScore.productivity")}
            score={todayScore?.productivityScore || 0}
            icon={<Brain className="w-4 h-4 text-white" />}
            trend={getTrend("productivityScore").trend}
            color="bg-blue-500"
          />
          <ScoreCategory
            label={t("lifeScore.health")}
            score={todayScore?.healthScore || 0}
            icon={<Heart className="w-4 h-4 text-white" />}
            trend={getTrend("healthScore").trend}
            color="bg-red-500"
          />
          <ScoreCategory
            label={t("lifeScore.relationships")}
            score={todayScore?.relationshipsScore || 0}
            icon={<Users className="w-4 h-4 text-white" />}
            trend={getTrend("relationshipsScore").trend}
            color="bg-green-500"
          />
          <ScoreCategory
            label={t("lifeScore.spiritual")}
            score={todayScore?.spiritualScore || 0}
            icon={<Star className="w-4 h-4 text-white" />}
            trend={getTrend("spiritualScore").trend}
            color="bg-purple-500"
          />
          <ScoreCategory
            label={t("lifeScore.family")}
            score={todayScore?.familyScore || 0}
            icon={<Home className="w-4 h-4 text-white" />}
            trend={getTrend("familyScore").trend}
            color="bg-orange-500"
          />
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-2 pt-2 border-t">
          <div className="text-center">
            <p className="text-lg font-semibold">{todayScore?.tasksCompleted || 0}</p>
            <p className="text-xs text-muted-foreground">{t("lifeScore.tasks")}</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-semibold">{todayScore?.focusMinutes || 0}</p>
            <p className="text-xs text-muted-foreground">{t("lifeScore.focusMin")}</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-semibold">{todayScore?.habitsLogged || 0}</p>
            <p className="text-xs text-muted-foreground">{t("lifeScore.habits")}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
