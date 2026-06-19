import { useMemo, useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import {
  Sparkles,
  RefreshCw,
  Lightbulb,
  ThumbsUp,
  CalendarDays,
  UserRound,
  Clapperboard,
  ArrowRight,
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCreatorProfile } from "@/hooks/useCreatorProfile";
import { useContentIdeas } from "@/hooks/useContentIdeas";
import { groupIdeasByKind, KIND_META, type ContentIdea } from "@/lib/content";
import { ContentIdeaCard } from "./ContentIdeaCard";
import { ContentScriptDialog } from "./ContentScriptDialog";
import { ContentCalendarStrip } from "./ContentCalendarStrip";
import { CreatorProfileForm } from "./CreatorProfileForm";

export type ContentTab = "today" | "liked" | "calendar" | "profile";

function isToday(dateStr: string | null): boolean {
  if (!dateStr) return false;
  const now = new Date();
  const today = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
  return dateStr === today;
}

export function ContentStudioPanel({ initialTab = "today" }: { initialTab?: ContentTab }) {
  const { t } = useLanguage();
  const [tab, setTab] = useState<ContentTab>(initialTab);
  const [scriptIdea, setScriptIdea] = useState<ContentIdea | null>(null);
  const [scriptOpen, setScriptOpen] = useState(false);

  const {
    profile,
    loading: profileLoading,
    saving,
    save,
    prefillFromProfile,
  } = useCreatorProfile();
  const {
    latestBatch,
    latestDay,
    liked,
    scheduled,
    loading: ideasLoading,
    generating,
    generateNow,
    setStatus,
    scheduleIdea,
    unschedule,
  } = useContentIdeas();

  const openScripts = (idea: ContentIdea) => {
    setScriptIdea(idea);
    setScriptOpen(true);
  };
  const toggleLike = (idea: ContentIdea) => {
    if (idea.status === "scheduled") return; // scheduled is "beyond" liked
    setStatus(idea.id, idea.status === "liked" ? "new" : "liked");
  };

  const visibleBatch = useMemo(
    () => latestBatch.filter((i) => i.status !== "dismissed"),
    [latestBatch],
  );
  const grouped = useMemo(() => groupIdeasByKind(visibleBatch), [visibleBatch]);
  const needsProfile = !profileLoading && (!profile || (profile.topics?.length ?? 0) === 0);

  const renderIdeaCard = (idea: ContentIdea) => (
    <ContentIdeaCard
      key={idea.id}
      idea={idea}
      onLike={() => toggleLike(idea)}
      onDismiss={() => setStatus(idea.id, "dismissed")}
      onWriteScripts={() => openScripts(idea)}
      onSchedule={(whenISO, durationMin) => scheduleIdea(idea, whenISO, durationMin)}
      onUnschedule={() => unschedule(idea)}
    />
  );

  return (
    <div className="h-full flex flex-col">
      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as ContentTab)}
        className="flex-1 flex flex-col min-h-0"
      >
        <div className="px-4 pt-4 space-y-3 border-b">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Clapperboard className="h-5 w-5 text-primary" />
                {t("content.title")}
              </h2>
              <p className="text-sm text-muted-foreground">{t("content.subtitle")}</p>
            </div>
            <Button onClick={() => generateNow()} disabled={generating} className="gap-2">
              {generating ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {generating ? t("content.generating") : t("content.generateToday")}
            </Button>
          </div>
          <TabsList className="w-full justify-start overflow-x-auto">
            <TabsTrigger value="today" className="gap-1">
              <Lightbulb className="h-4 w-4" /> {t("content.tab.today")}
            </TabsTrigger>
            <TabsTrigger value="liked" className="gap-1">
              <ThumbsUp className="h-4 w-4" /> {t("content.tab.liked")}
            </TabsTrigger>
            <TabsTrigger value="calendar" className="gap-1">
              <CalendarDays className="h-4 w-4" /> {t("content.tab.calendar")}
            </TabsTrigger>
            <TabsTrigger value="profile" className="gap-1">
              <UserRound className="h-4 w-4" /> {t("content.tab.profile")}
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          {/* ── Today's Ideas ──────────────────────────────────── */}
          <TabsContent value="today" className="mt-0 space-y-4">
            {needsProfile && (
              <Card className="border-primary/30 bg-primary/5">
                <CardContent className="p-4 flex items-center justify-between gap-3">
                  <p className="text-sm">{t("content.needsProfile")}</p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1 shrink-0"
                    onClick={() => setTab("profile")}
                  >
                    {t("content.setUp")} <ArrowRight className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            )}

            {ideasLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-36 w-full" />
                <Skeleton className="h-36 w-full" />
              </div>
            ) : visibleBatch.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center space-y-4">
                  <Sparkles className="h-8 w-8 mx-auto text-muted-foreground" />
                  <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                    {t("content.emptyBody")}
                  </p>
                  <Button onClick={() => generateNow()} disabled={generating} className="gap-2">
                    {generating ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                    {generating ? t("content.generating") : t("content.generateIdeas")}
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <>
                <p className="text-xs text-muted-foreground">
                  {isToday(latestDay)
                    ? t("content.todayBatch")
                    : `${t("content.latestBatch")} · ${latestDay}`}{" "}
                  · {visibleBatch.length}{" "}
                  {visibleBatch.length === 1 ? t("content.ideaWord") : t("content.ideasWord")}
                </p>
                {grouped.current.length > 0 && (
                  <section className="space-y-3">
                    <h3 className="text-sm font-semibold">
                      {KIND_META.current.emoji} {t("content.kind.current")}
                    </h3>
                    {grouped.current.map(renderIdeaCard)}
                  </section>
                )}
                {grouped.evergreen.length > 0 && (
                  <section className="space-y-3 pt-2">
                    <h3 className="text-sm font-semibold">
                      {KIND_META.evergreen.emoji} {t("content.kind.evergreen")}
                    </h3>
                    {grouped.evergreen.map(renderIdeaCard)}
                  </section>
                )}
              </>
            )}
          </TabsContent>

          {/* ── Liked & Scripts ────────────────────────────────── */}
          <TabsContent value="liked" className="mt-0 space-y-3">
            {liked.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center space-y-3">
                  <ThumbsUp className="h-8 w-8 mx-auto text-muted-foreground" />
                  <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                    {t("content.likedEmpty")}
                  </p>
                </CardContent>
              </Card>
            ) : (
              liked.map(renderIdeaCard)
            )}
          </TabsContent>

          {/* ── Calendar ───────────────────────────────────────── */}
          <TabsContent value="calendar" className="mt-0">
            <ContentCalendarStrip
              scheduled={scheduled}
              onOpenScripts={openScripts}
              onUnschedule={unschedule}
            />
          </TabsContent>

          {/* ── Profile ────────────────────────────────────────── */}
          <TabsContent value="profile" className="mt-0">
            {profileLoading ? (
              <div className="space-y-3 max-w-2xl">
                <Skeleton className="h-64 w-full" />
                <Skeleton className="h-40 w-full" />
              </div>
            ) : (
              <CreatorProfileForm
                profile={profile}
                saving={saving}
                onSave={(v) => save(v)}
                onPrefill={prefillFromProfile}
              />
            )}
          </TabsContent>
        </div>
      </Tabs>

      <ContentScriptDialog
        idea={scriptIdea}
        open={scriptOpen}
        onOpenChange={setScriptOpen}
        defaultFormat={profile?.default_format ?? "both"}
      />
    </div>
  );
}
