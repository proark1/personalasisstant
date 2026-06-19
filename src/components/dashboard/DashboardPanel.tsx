import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useActiveWorkspaceId } from "@/contexts/WorkspaceContext";
import { useLifeScore } from "@/hooks/useLifeScore";
import { useCelebration } from "@/hooks/useCelebration";
import { CheckinPrompt } from "@/components/checkin/CheckinPrompt";
import { DashboardHero } from "./DashboardHero";

import { StatPills } from "./StatPills";
import { TodayTimeline } from "./TodayTimeline";
import { SmartInsightCard } from "./SmartInsightCard";
import { DailyBriefingCard } from "./DailyBriefingCard";
import { QuickActionsBar } from "./QuickActionsBar";
import { OnboardingChecklist } from "@/components/onboarding/OnboardingChecklist";
import { useWorkspaceRealtime } from "@/hooks/useWorkspaceRealtime";
import { WeatherCard } from "./WeatherCard";
import { ContractAlertsCard } from "./ContractAlertsCard";
import { ContactRemindersCard } from "./ContactRemindersCard";
import { DashboardPrayerCard } from "./DashboardPrayerCard";
import { ConflictAlertsCard } from "./ConflictAlertsCard";
import { EmailActionPipelineCard } from "./EmailActionPipelineCard";
import { TravelIntelCard } from "./TravelIntelCard";
import { EnergyCoachCard } from "./EnergyCoachCard";
import { MeetingBriefsCard } from "./MeetingBriefsCard";
import { LearnedRoutinesCard } from "./LearnedRoutinesCard";
import { LifeScoreCommentaryCard } from "./LifeScoreCommentaryCard";
import { EpisodicMemoriesCard } from "./EpisodicMemoriesCard";
import { MorningThreadCard } from "./MorningThreadCard";
import { MentalLoadCard } from "./MentalLoadCard";
import { StaggerContainer, StaggerItem } from "@/components/ui/page-transition";
import { PanelSkeleton } from "@/components/ui/panel-skeleton";
import { CustomizableCard } from "./CustomizableCard";
import { useDashboardLayout } from "@/hooks/useDashboardLayout";
import { Sliders, Check } from "lucide-react";
import { useSmartTaskSuggestions } from "@/hooks/useSmartTaskSuggestions";
import { Task, TaskCategory, CalendarEvent, EventCategory } from "@/types/flux";
import { Badge } from "@/components/ui/badge";
import { isSameDay, subDays, startOfDay, endOfDay, isToday } from "date-fns";
import { cn } from "@/lib/utils";

interface DbEvent {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  description: string | null;
  category: string | null;
}

interface DbContract {
  id: string;
  name: string;
  renewal_date: string | null;
  cancellation_notice_days: number | null;
  auto_renews: boolean | null;
}

interface DbTask {
  id: string;
  title: string;
  description: string | null;
  category: string;
  priority: string;
  completed: boolean;
  created_at: string;
  due_date: string | null;
  user_id: string;
}

interface ContractAlert {
  id: string;
  name: string;
  renewalDate: Date | null;
  cancellationNoticeDays: number;
  autoRenews: boolean;
}

interface OverdueContact {
  id: string;
  name: string;
  last_contacted_at: string | null;
}

interface EmailItem {
  id: string;
  from_name: string | null;
  from_email: string | null;
  subject: string | null;
  priority_score: number | null;
  category: string | null;
  is_read?: boolean;
  user_archived?: boolean;
}

interface DashboardPanelProps {
  userId: string;
  onNavigate?: (panel: string) => void;
}

export function DashboardPanel({ userId, onNavigate }: DashboardPanelProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [contractAlerts, setContractAlerts] = useState<ContractAlert[]>([]);
  const [overdueContacts, setOverdueContacts] = useState<OverdueContact[]>([]);
  const [emails, setEmails] = useState<EmailItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"today" | "insights">("today");
  const { profile } = useAuth();
  const { todayScore } = useLifeScore();
  const {
    suggestion,
    loading: sugLoading,
    refresh: refreshSuggestion,
  } = useSmartTaskSuggestions(tasks, events);
  const { celebrate, checkStreak } = useCelebration();
  const { isHidden, toggleCard, customizing, setCustomizing, hiddenCount, resetCards } =
    useDashboardLayout();

  const handleStartTask = (_taskId: string | null, _title: string) => {
    onNavigate?.("tasks");
  };

  const workspaceId = useActiveWorkspaceId();
  // Live teammates-are-doing-stuff toasts + `workspace:changed` event bus.
  useWorkspaceRealtime();

  const fetchAll = useCallback(async () => {
    if (!userId) return;
    const now = new Date();

    // Tasks/events scope depends on the active workspace. Workspace mode
    // pulls ALL tasks/events in that workspace (across members); personal
    // mode pulls only the current user's own un-workspaced rows.
    const tasksQuery = workspaceId
      ? supabase
          .from("tasks")
          .select("id, title, description, category, priority, completed, created_at, due_date")
          .eq("workspace_id", workspaceId)
      : supabase
          .from("tasks")
          .select("id, title, description, category, priority, completed, created_at, due_date")
          .eq("user_id", userId)
          .is("workspace_id", null);
    const eventsQuery = workspaceId
      ? supabase
          .from("events")
          .select("*")
          .eq("workspace_id", workspaceId)
          .gte("start_time", startOfDay(now).toISOString())
          .lte("start_time", endOfDay(now).toISOString())
      : supabase
          .from("events")
          .select("*")
          .eq("user_id", userId)
          .is("workspace_id", null)
          .gte("start_time", startOfDay(now).toISOString())
          .lte("start_time", endOfDay(now).toISOString());

    const [tasksRes, eventsRes, contractsRes, contactsRes, emailsRes] = await Promise.all([
      tasksQuery,
      eventsQuery,
      supabase
        .from("contracts")
        .select("id, name, renewal_date, cancellation_notice_days, auto_renews")
        .eq("user_id", userId)
        .eq("is_active", true)
        .not("renewal_date", "is", null),
      supabase
        .from("user_contacts")
        .select("id, name, last_contacted_at")
        .eq("user_id", userId)
        .lt("last_contacted_at", subDays(now, 30).toISOString())
        .order("last_contacted_at", { ascending: true })
        .limit(3),
      supabase
        .from("user_emails")
        .select("id, from_name, from_email, subject, priority_score, category")
        .eq("user_id", userId)
        .eq("is_read", false)
        .eq("user_archived", false)
        .order("priority_score")
        .limit(10),
    ]);

    if (tasksRes.data) {
      setTasks(
        tasksRes.data.map((t: DbTask) => ({
          id: t.id,
          title: t.title,
          description: t.description || undefined,
          category: t.category as TaskCategory,
          priority: t.priority as "high" | "medium" | "low",
          completed: t.completed,
          createdAt: new Date(t.created_at),
          dueDate: t.due_date ? new Date(t.due_date) : undefined,
        })),
      );
    }

    if (eventsRes.data) {
      setEvents(
        eventsRes.data.map((e: DbEvent) => ({
          id: e.id,
          title: e.title,
          startTime: new Date(e.start_time),
          endTime: new Date(e.end_time),
          description: e.description || undefined,
          category: (e.category as EventCategory) || undefined,
        })),
      );
    }

    if (contractsRes.data) {
      setContractAlerts(
        contractsRes.data.map((c: DbContract) => ({
          id: c.id,
          name: c.name,
          renewalDate: c.renewal_date ? new Date(c.renewal_date) : null,
          cancellationNoticeDays: c.cancellation_notice_days || 30,
          autoRenews: c.auto_renews ?? true,
        })),
      );
    }

    if (contactsRes.data) setOverdueContacts(contactsRes.data);
    if (emailsRes.data) setEmails(emailsRes.data);

    setLoading(false);
  }, [userId, workspaceId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const stats = useMemo(() => {
    const now = new Date();
    const completedToday = tasks.filter(
      (t) => t.completed && t.createdAt && isToday(t.createdAt),
    ).length;
    const completedThisWeek = tasks.filter((t) => {
      if (!t.completed || !t.createdAt) return false;
      return Math.floor((now.getTime() - t.createdAt.getTime()) / (1000 * 60 * 60 * 24)) < 7;
    }).length;

    let streak = 0;
    let checkDate = startOfDay(now);
    for (let i = 0; i < 365; i++) {
      const dayTasks = tasks.filter(
        (t) => t.completed && t.createdAt && isSameDay(t.createdAt, checkDate),
      );
      if (dayTasks.length > 0) {
        streak++;
        checkDate = subDays(checkDate, 1);
      } else break;
    }

    return { completedToday, completedThisWeek, streak };
  }, [tasks]);

  const handleCompleteTask = async (taskId: string) => {
    // NOTE: do NOT scope this by user_id. In workspace mode the dashboard
    // shows tasks owned by other members, and RLS authorizes members to
    // complete them — a user_id predicate would match zero rows and the UI
    // would desync (marked done locally, unchanged in the DB).
    const { error } = await supabase.from("tasks").update({ completed: true }).eq("id", taskId);
    if (!error) {
      setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, completed: true } : t)));
      const newStreak = stats.streak + 1;
      if (!checkStreak(newStreak)) celebrate({ type: "taskComplete" });
    }
  };

  if (loading) {
    return (
      <div className="h-full p-4 md:p-6">
        <PanelSkeleton variant="grid" />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-4 md:p-6 pb-24">
      <StaggerContainer className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
        {/* Slim check-in banner */}
        <StaggerItem className="col-span-full">
          <CheckinPrompt />
        </StaggerItem>

        {/* Tier 1: Merged Hero + WhatNow */}
        <StaggerItem className="col-span-full">
          <DashboardHero
            userName={profile?.display_name}
            tasks={tasks}
            suggestion={suggestion}
            sugLoading={sugLoading}
            onRefreshSuggestion={refreshSuggestion}
            onStartTask={handleStartTask}
            onNavigate={onNavigate}
          />
        </StaggerItem>

        {/* First-day Getting-started checklist (self-hides once dismissed) */}
        <StaggerItem className="col-span-full">
          <OnboardingChecklist />
        </StaggerItem>

        {/* Quick Actions — immediately after hero */}
        <StaggerItem className="col-span-full">
          <QuickActionsBar onNavigate={onNavigate} />
        </StaggerItem>

        {/* Today / Insights segmented control — keeps the default view calm */}
        <StaggerItem className="col-span-full">
          <div className="flex items-center justify-between gap-2">
            <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-muted">
              {(["today", "insights"] as const).map((v) => {
                const alertCount = contractAlerts.length + overdueContacts.length;
                return (
                  <button
                    key={v}
                    onClick={() => setView(v)}
                    className={cn(
                      "px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5",
                      view === v
                        ? "bg-card text-foreground shadow-soft"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {v === "today" ? "Today" : "Insights"}
                    {v === "insights" && alertCount > 0 && (
                      <Badge
                        variant="destructive"
                        className="text-[10px] px-1.5 py-0 h-4 min-w-[18px] justify-center"
                      >
                        {alertCount}
                      </Badge>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Customize insight cards */}
            {view === "insights" && (
              <div className="flex items-center gap-2">
                {customizing && hiddenCount > 0 && (
                  <button
                    onClick={resetCards}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Reset
                  </button>
                )}
                <button
                  onClick={() => setCustomizing(!customizing)}
                  aria-pressed={customizing}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    customizing
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  {customizing ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    <Sliders className="h-3.5 w-3.5" />
                  )}
                  {customizing ? "Done" : "Customize"}
                </button>
              </div>
            )}
          </div>
        </StaggerItem>

        {/* Today: the essentials only */}
        {view === "today" && (
          <>
            <StaggerItem className="col-span-full">
              <div className="flex items-center gap-3">
                <div className="shrink-0">
                  <WeatherCard />
                </div>
                <div className="flex-1 min-w-0 overflow-hidden">
                  <StatPills
                    streak={stats.streak}
                    completedToday={stats.completedToday}
                    completedThisWeek={stats.completedThisWeek}
                    lifeScore={todayScore?.overallScore}
                    onNavigate={onNavigate}
                  />
                </div>
              </div>
            </StaggerItem>

            <StaggerItem className="col-span-full">
              <DashboardPrayerCard onNavigate={onNavigate} />
            </StaggerItem>

            <StaggerItem className="col-span-full">
              <TodayTimeline
                tasks={tasks}
                events={events}
                onNavigate={onNavigate}
                onCompleteTask={handleCompleteTask}
              />
            </StaggerItem>
          </>
        )}

        {/* Insights: the deeper, opt-in detail */}
        {view === "insights" && (
          <StaggerItem className="col-span-full">
            {customizing && (
              <p className="text-sm text-muted-foreground mb-3">
                Hide cards you don't use — your dashboard, your way. Changes save automatically.
              </p>
            )}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
              {(
                [
                  {
                    id: "morning-thread",
                    label: "Morning Thread",
                    span: "md:col-span-3",
                    node: <MorningThreadCard />,
                  },
                  {
                    id: "life-score",
                    label: "Life Score",
                    span: "md:col-span-3",
                    node: <LifeScoreCommentaryCard />,
                  },
                  {
                    id: "conflict-alerts",
                    label: "Conflict Alerts",
                    span: "md:col-span-3",
                    node: <ConflictAlertsCard />,
                  },
                  {
                    id: "travel-intel",
                    label: "Travel Intel",
                    span: "md:col-span-3",
                    node: <TravelIntelCard />,
                  },
                  {
                    id: "email-pipeline",
                    label: "Email Pipeline",
                    span: "md:col-span-3",
                    node: <EmailActionPipelineCard />,
                  },
                  {
                    id: "meeting-briefs",
                    label: "Meeting Briefs",
                    span: "md:col-span-2",
                    node: <MeetingBriefsCard />,
                  },
                  {
                    id: "energy-coach",
                    label: "Energy Coach",
                    span: "md:col-span-1",
                    node: <EnergyCoachCard />,
                  },
                  {
                    id: "learned-routines",
                    label: "Learned Routines",
                    span: "md:col-span-2",
                    node: <LearnedRoutinesCard />,
                  },
                  {
                    id: "episodic-memories",
                    label: "Episodic Memories",
                    span: "md:col-span-1",
                    node: <EpisodicMemoriesCard />,
                  },
                  {
                    id: "mental-load",
                    label: "Mental Load",
                    span: "md:col-span-3",
                    node: <MentalLoadCard />,
                  },
                  {
                    id: "daily-briefing",
                    label: "Daily Briefing",
                    span: "md:col-span-2",
                    node: <DailyBriefingCard />,
                  },
                  {
                    id: "smart-insight",
                    label: "Smart Insight",
                    span: "md:col-span-1",
                    node: (
                      <SmartInsightCard
                        tasks={tasks}
                        emails={emails}
                        contracts={contractAlerts}
                        contacts={overdueContacts}
                        events={events}
                      />
                    ),
                  },
                ] as const
              ).map((card) => (
                <CustomizableCard
                  key={card.id}
                  id={card.id}
                  label={card.label}
                  className={card.span}
                  customizing={customizing}
                  hidden={isHidden(card.id)}
                  onToggle={toggleCard}
                >
                  {card.node}
                </CustomizableCard>
              ))}
              {contractAlerts.length > 0 && (
                <CustomizableCard
                  id="contract-alerts"
                  label="Contract Alerts"
                  className="md:col-span-2"
                  customizing={customizing}
                  hidden={isHidden("contract-alerts")}
                  onToggle={toggleCard}
                >
                  <ContractAlertsCard contracts={contractAlerts} onNavigate={onNavigate} />
                </CustomizableCard>
              )}
              {overdueContacts.length > 0 && (
                <CustomizableCard
                  id="contact-reminders"
                  label="Contact Reminders"
                  className="md:col-span-1"
                  customizing={customizing}
                  hidden={isHidden("contact-reminders")}
                  onToggle={toggleCard}
                >
                  <ContactRemindersCard contacts={overdueContacts} onNavigate={onNavigate} />
                </CustomizableCard>
              )}
            </div>
          </StaggerItem>
        )}
      </StaggerContainer>
    </div>
  );
}
