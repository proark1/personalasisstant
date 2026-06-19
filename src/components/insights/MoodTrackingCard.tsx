import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useMoodTracking } from "@/hooks/useMoodTracking";
import { useLanguage } from "@/contexts/LanguageContext";
import { Smile, Frown, Meh, Zap, Battery, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export function MoodTrackingCard() {
  const { t } = useLanguage();

  const MOOD_OPTIONS = [
    { value: 1, icon: Frown, label: t("mood.veryLow"), color: "text-red-500" },
    { value: 2, icon: Frown, label: t("mood.low"), color: "text-orange-500" },
    { value: 3, icon: Meh, label: t("mood.neutral"), color: "text-yellow-500" },
    { value: 4, icon: Smile, label: t("mood.good"), color: "text-lime-500" },
    { value: 5, icon: Smile, label: t("mood.great"), color: "text-green-500" },
  ];

  const ENERGY_OPTIONS = [
    { value: 1, icon: Battery, label: t("mood.exhausted"), color: "text-red-500" },
    { value: 2, icon: Battery, label: t("mood.tired"), color: "text-orange-500" },
    { value: 3, icon: Battery, label: t("mood.okay"), color: "text-yellow-500" },
    { value: 4, icon: Zap, label: t("mood.energized"), color: "text-lime-500" },
    { value: 5, icon: Zap, label: t("mood.pumped"), color: "text-green-500" },
  ];

  const CONTEXT_TAGS = [
    t("mood.work"),
    t("mood.family"),
    t("mood.exercise"),
    t("mood.social"),
    t("mood.aloneTime"),
    t("mood.outdoors"),
    t("mood.creative"),
    t("mood.learning"),
    t("mood.relaxing"),
    t("mood.stressed"),
  ];

  const { todayLogs, stats, logMood, loading } = useMoodTracking();
  const [isLogging, setIsLogging] = useState(false);
  const [selectedMood, setSelectedMood] = useState<number | null>(null);
  const [selectedEnergy, setSelectedEnergy] = useState<number | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!selectedMood || !selectedEnergy) {
      toast.error("Please select both mood and energy levels");
      return;
    }

    setSubmitting(true);
    try {
      await logMood(selectedMood, selectedEnergy, selectedTags, notes || undefined);
      toast.success("Mood logged!");
      setIsLogging(false);
      setSelectedMood(null);
      setSelectedEnergy(null);
      setSelectedTags([]);
      setNotes("");
    } catch {
      toast.error("Failed to log mood");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  };

  const getTrendIcon = (trend: "improving" | "declining" | "stable") => {
    switch (trend) {
      case "improving":
        return <TrendingUp className="w-3 h-3 text-green-500" />;
      case "declining":
        return <TrendingDown className="w-3 h-3 text-red-500" />;
      default:
        return <Minus className="w-3 h-3 text-muted-foreground" />;
    }
  };

  if (loading) {
    return (
      <Card className="animate-pulse">
        <CardHeader className="pb-2">
          <div className="h-5 w-32 bg-muted rounded" />
        </CardHeader>
        <CardContent>
          <div className="h-24 bg-muted rounded" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Smile className="w-5 h-5 text-primary" />
            {t("mood.title")}
          </CardTitle>
          {!isLogging && (
            <Button size="sm" onClick={() => setIsLogging(true)}>
              {t("mood.logNow")}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLogging ? (
          <div className="space-y-4">
            {/* Mood Selection */}
            <div>
              <p className="text-sm font-medium mb-2">{t("mood.howFeeling")}</p>
              <div className="flex justify-between">
                {MOOD_OPTIONS.map((option) => {
                  const Icon = option.icon;
                  return (
                    <button
                      key={option.value}
                      onClick={() => setSelectedMood(option.value)}
                      className={cn(
                        "flex flex-col items-center gap-1 p-2 rounded-lg transition-all",
                        selectedMood === option.value
                          ? "bg-primary/10 ring-2 ring-primary"
                          : "hover:bg-muted",
                      )}
                    >
                      <Icon className={cn("w-6 h-6", option.color)} />
                      <span className="text-xs">{option.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Energy Selection */}
            <div>
              <p className="text-sm font-medium mb-2">{t("mood.energyLevel")}</p>
              <div className="flex justify-between">
                {ENERGY_OPTIONS.map((option) => {
                  const Icon = option.icon;
                  return (
                    <button
                      key={option.value}
                      onClick={() => setSelectedEnergy(option.value)}
                      className={cn(
                        "flex flex-col items-center gap-1 p-2 rounded-lg transition-all",
                        selectedEnergy === option.value
                          ? "bg-primary/10 ring-2 ring-primary"
                          : "hover:bg-muted",
                      )}
                    >
                      <Icon className={cn("w-6 h-6", option.color)} />
                      <span className="text-xs">{option.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Context Tags */}
            <div>
              <p className="text-sm font-medium mb-2">{t("mood.influences")}</p>
              <div className="flex flex-wrap gap-1.5">
                {CONTEXT_TAGS.map((tag) => (
                  <Badge
                    key={tag}
                    variant={selectedTags.includes(tag) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => toggleTag(tag)}
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Notes */}
            <Textarea
              placeholder={t("mood.notes")}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />

            {/* Actions */}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setIsLogging(false)} className="flex-1">
                {t("common.cancel")}
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={submitting || !selectedMood || !selectedEnergy}
                className="flex-1"
              >
                {submitting ? t("mood.saving") : t("mood.save")}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Today's Logs Summary */}
            {todayLogs.length > 0 ? (
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">{t("mood.todayAverage")}</p>
                  <div className="flex items-center gap-4 mt-1">
                    <div className="flex items-center gap-1">
                      <Smile className="w-4 h-4 text-primary" />
                      <span className="font-semibold">
                        {(
                          todayLogs.reduce((sum, l) => sum + l.moodScore, 0) / todayLogs.length
                        ).toFixed(1)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Zap className="w-4 h-4 text-amber-500" />
                      <span className="font-semibold">
                        {(
                          todayLogs.reduce((sum, l) => sum + l.energyScore, 0) / todayLogs.length
                        ).toFixed(1)}
                      </span>
                    </div>
                  </div>
                </div>
                <Badge variant="outline">
                  {todayLogs.length} {t("mood.logs")}
                </Badge>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-2">
                {t("mood.noLogsToday")}
              </p>
            )}

            {/* Weekly Stats */}
            {stats && (
              <div className="grid grid-cols-2 gap-3 pt-2 border-t">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <Smile className="w-4 h-4 text-primary" />
                    <span className="text-sm font-medium">Mood</span>
                    {getTrendIcon(stats.moodTrend)}
                  </div>
                  <p className="text-2xl font-bold">{stats.averageMood}</p>
                  <p className="text-xs text-muted-foreground">{t("mood.weeklyAvg")}</p>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <Zap className="w-4 h-4 text-amber-500" />
                    <span className="text-sm font-medium">{t("mood.energized")}</span>
                    {getTrendIcon(stats.energyTrend)}
                  </div>
                  <p className="text-2xl font-bold">{stats.averageEnergy}</p>
                  <p className="text-xs text-muted-foreground">{t("mood.weeklyAvg")}</p>
                </div>
              </div>
            )}

            {/* Top Contexts */}
            {stats?.topContexts && stats.topContexts.length > 0 && (
              <div className="pt-2 border-t">
                <p className="text-xs text-muted-foreground mb-1.5">{t("mood.topInfluences")}</p>
                <div className="flex flex-wrap gap-1">
                  {stats.topContexts.slice(0, 3).map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
