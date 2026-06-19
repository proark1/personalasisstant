import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useChallenges } from "@/hooks/useChallenges";
import { useLanguage } from "@/contexts/LanguageContext";
import { Trophy, Target, CheckCircle, Clock, Plus, Sparkles } from "lucide-react";
import { MilestoneCelebration } from "./MilestoneCelebration";

export function ChallengesPanel() {
  const { t } = useLanguage();
  const {
    loading,
    celebratingChallenge,
    joinChallenge,
    dismissCelebration,
    getActiveUserChallenges,
    getCompletedUserChallenges,
    getUnjoinedChallenges,
  } = useChallenges();

  const activeChallenges = getActiveUserChallenges();
  const completedChallenges = getCompletedUserChallenges();
  const availableChallenges = getUnjoinedChallenges();

  if (loading) {
    return (
      <Card className="animate-pulse">
        <CardHeader className="pb-2">
          <div className="h-5 w-32 bg-muted rounded" />
        </CardHeader>
        <CardContent>
          <div className="h-48 bg-muted rounded" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <MilestoneCelebration challenge={celebratingChallenge} onDismiss={dismissCelebration} />

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-500" />
            {t("challenges.title")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="active" className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-4">
              <TabsTrigger value="active" className="text-xs">
                {t("challenges.active")} ({activeChallenges.length})
              </TabsTrigger>
              <TabsTrigger value="available" className="text-xs">
                {t("challenges.available")} ({availableChallenges.length})
              </TabsTrigger>
              <TabsTrigger value="completed" className="text-xs">
                {t("challenges.done")} ({completedChallenges.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="active" className="space-y-3">
              {activeChallenges.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  <Target className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">{t("challenges.noActive")}</p>
                  <p className="text-xs">{t("challenges.joinToStart")}</p>
                </div>
              ) : (
                activeChallenges.map((uc) => (
                  <div key={uc.id} className="p-3 rounded-lg border bg-card">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h4 className="font-medium text-sm">{uc.challenge.title}</h4>
                        <p className="text-xs text-muted-foreground">{uc.challenge.description}</p>
                      </div>
                      <Badge variant="secondary" className="text-xs shrink-0">
                        +{uc.challenge.xpReward} XP
                      </Badge>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span>
                          {uc.currentValue} / {uc.challenge.targetValue}
                        </span>
                        <span className="text-muted-foreground">{uc.progress}%</span>
                      </div>
                      <Progress value={uc.progress} className="h-2" />
                    </div>
                  </div>
                ))
              )}
            </TabsContent>

            <TabsContent value="available" className="space-y-3">
              {availableChallenges.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  <Sparkles className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">{t("challenges.allJoined")}</p>
                </div>
              ) : (
                availableChallenges.map((challenge) => (
                  <div key={challenge.id} className="p-3 rounded-lg border bg-card">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="font-medium text-sm">{challenge.title}</h4>
                        <p className="text-xs text-muted-foreground mb-2">
                          {challenge.description}
                        </p>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            <Target className="w-3 h-3 mr-1" />
                            {challenge.targetValue} {challenge.targetMetric.replace("_", " ")}
                          </Badge>
                          <Badge variant="secondary" className="text-xs">
                            +{challenge.xpReward} XP
                          </Badge>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => joinChallenge(challenge.id)}
                        className="shrink-0"
                      >
                        <Plus className="w-3 h-3 mr-1" />
                        {t("challenges.join")}
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </TabsContent>

            <TabsContent value="completed" className="space-y-3">
              {completedChallenges.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  <CheckCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">{t("challenges.noCompleted")}</p>
                  <p className="text-xs">{t("challenges.keepGoing")}</p>
                </div>
              ) : (
                completedChallenges.map((uc) => (
                  <div
                    key={uc.id}
                    className="p-3 rounded-lg border bg-green-500/5 border-green-500/20"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
                        <CheckCircle className="w-5 h-5 text-green-500" />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-medium text-sm">{uc.challenge.title}</h4>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Clock className="w-3 h-3" />
                          {t("challenges.completed")}{" "}
                          {uc.completedAt ? new Date(uc.completedAt).toLocaleDateString() : ""}
                        </div>
                      </div>
                      <Badge className="bg-green-500 text-white">+{uc.challenge.xpReward} XP</Badge>
                    </div>
                  </div>
                ))
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </>
  );
}
