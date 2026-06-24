import { useState, useEffect, useMemo, useCallback, Suspense, lazy, memo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CommandPalette, type CommandPaletteAction } from "../command/CommandPalette";
import { Sidebar, SidebarFilter, ActivePanel } from "./Sidebar";
import { useDeepLinkHandler } from "@/hooks/useDeepLinkHandler";
import { RealtimeNotificationCenter } from "../notifications/RealtimeNotificationCenter";
import { SmartNudgeProvider } from "../nudges/SmartNudgeProvider";
import { DoriBar } from "../assistant/DoriBar";
import { useAuth } from "@/hooks/useAuth";
import { Task, CalendarEvent, ChatMessage, Project, UserSettings } from "@/types/flux";
import { useIsMobile } from "@/hooks/use-mobile";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCelebration } from "@/hooks/useCelebration";
import { Button } from "@/components/ui/button";
import { List, Grid3X3, X, Activity, Plus, Timer, Mic, CalendarCheck, Target } from "lucide-react";
import { TaskViewSwitcher, TaskView } from "../tasks/TaskViewSwitcher";
import { PanelFallback } from "@/components/lazy/LazyLoader";
import { PanelErrorBoundary } from "@/components/PanelErrorBoundary";
import { ContextualHeader } from "./ContextualHeader";
import { motion, AnimatePresence } from "framer-motion";
import type { ActivityItem } from "@/hooks/useActivityFeed";
import type { SearchResult, SearchFilters } from "@/hooks/useGlobalSearch";
import type { Contact } from "@/hooks/useContacts";

// Lazy load feature panels for code splitting
// MobileLayout is desktop-dead-weight, so keep it out of the main chunk —
// it's only rendered on small screens.
const MobileLayout = lazy(() =>
  import("./MobileLayout").then((m) => ({ default: m.MobileLayout })),
);
const WhatNowButton = lazy(() =>
  import("../assistant/WhatNowButton").then((m) => ({ default: m.WhatNowButton })),
);
const ChatPanel = lazy(() => import("../chat/ChatPanel").then((m) => ({ default: m.ChatPanel })));
// Desktop now uses the richer DoriPanel (action cards + Next Up) for the
// assistant surface — the same component mobile uses — instead of the leaner
// ChatPanel, which silently dropped Dori's action results.
const DoriPanel = lazy(() =>
  import("../assistant/DoriPanel").then((m) => ({ default: m.DoriPanel })),
);
const _TeamChatPanel = lazy(() =>
  import("../chat/TeamChatPanel").then((m) => ({ default: m.TeamChatPanel })),
);
const TaskList = lazy(() => import("../tasks/TaskList").then((m) => ({ default: m.TaskList })));
const KanbanBoard = lazy(() =>
  import("../tasks/KanbanBoard").then((m) => ({ default: m.KanbanBoard })),
);
const PriorityBoardView = lazy(() =>
  import("../tasks/PriorityBoardView").then((m) => ({ default: m.PriorityBoardView })),
);
const TimelineView = lazy(() =>
  import("../tasks/TimelineView").then((m) => ({ default: m.TimelineView })),
);
const CalendarPanel = lazy(() =>
  import("../calendar/CalendarPanel").then((m) => ({ default: m.CalendarPanel })),
);
const CalendarView = lazy(() =>
  import("../calendar/CalendarView").then((m) => ({ default: m.CalendarView })),
);
const FocusTimer = lazy(() =>
  import("../focus/FocusTimer").then((m) => ({ default: m.FocusTimer })),
);
const TodayFocusView = lazy(() =>
  import("../focus/TodayFocusView").then((m) => ({ default: m.TodayFocusView })),
);
const ProjectManager = lazy(() =>
  import("../projects/ProjectManager").then((m) => ({ default: m.ProjectManager })),
);
const ActivityFeed = lazy(() =>
  import("../activity/ActivityFeed").then((m) => ({ default: m.ActivityFeed })),
);
const GlobalSearch = lazy(() =>
  import("../search/GlobalSearch").then((m) => ({ default: m.GlobalSearch })),
);
const _QuickAddFAB = lazy(() =>
  import("../tasks/QuickAddFAB").then((m) => ({ default: m.QuickAddFAB })),
);
const AICommandPanel = lazy(() =>
  import("../ai/AICommandPanel").then((m) => ({ default: m.AICommandPanel })),
);
const NotesPanel = lazy(() =>
  import("../notes/NotesPanel").then((m) => ({ default: m.NotesPanel })),
);
const HabitsPanel = lazy(() =>
  import("../habits/HabitsPanel").then((m) => ({ default: m.HabitsPanel })),
);
const AdminAnalyticsPanel = lazy(() =>
  import("../admin/AdminAnalyticsPanel").then((m) => ({ default: m.AdminAnalyticsPanel })),
);
const FamilyPanel = lazy(() =>
  import("../family/FamilyPanel").then((m) => ({ default: m.FamilyPanel })),
);
const CookingPanel = lazy(() =>
  import("../cooking/CookingPanel").then((m) => ({ default: m.CookingPanel })),
);
const _IslamPanel = lazy(() =>
  import("../islam/IslamPanel").then((m) => ({ default: m.IslamPanel })),
);
const IslamEnhancedPanel = lazy(() =>
  import("../islam/IslamEnhancedPanel").then((m) => ({ default: m.IslamEnhancedPanel })),
);
const PropertyPanel = lazy(() =>
  import("../property/PropertyPanel").then((m) => ({ default: m.PropertyPanel })),
);
const StartupWorkspacePanel = lazy(() =>
  import("../startup/StartupWorkspacePanel").then((m) => ({ default: m.StartupWorkspacePanel })),
);
const TechNewsPanel = lazy(() =>
  import("../news/TechNewsPanel").then((m) => ({ default: m.TechNewsPanel })),
);
const HealthHubPanel = lazy(() =>
  import("../health/HealthHubPanel").then((m) => ({ default: m.HealthHubPanel })),
);
const _CallHistory = lazy(() =>
  import("../calling/CallHistory").then((m) => ({ default: m.CallHistory })),
);
const SocialPanel = lazy(() =>
  import("../social/SocialPanel").then((m) => ({ default: m.SocialPanel })),
);
const DashboardPanel = lazy(() =>
  import("../dashboard/DashboardPanel").then((m) => ({ default: m.DashboardPanel })),
);
const ContactsPanel = lazy(() =>
  import("../contacts/ContactsPanel").then((m) => ({ default: m.ContactsPanel })),
);
const ContractsPanel = lazy(() =>
  import("../contracts/ContractsPanel").then((m) => ({ default: m.ContractsPanel })),
);
const SettingsPanelContent = lazy(() =>
  import("../settings/SettingsPanelContent").then((m) => ({ default: m.SettingsPanelContent })),
);
const EmailPanel = lazy(() =>
  import("../email/EmailPanel").then((m) => ({ default: m.EmailPanel })),
);
const FinancesPanel = lazy(() =>
  import("../finances/FinancesPanel").then((m) => ({ default: m.FinancesPanel })),
);
const TravelPanel = lazy(() =>
  import("../travel/TravelPanel").then((m) => ({ default: m.TravelPanel })),
);
const AssetsPanel = lazy(() =>
  import("../assets/AssetsPanel").then((m) => ({ default: m.AssetsPanel })),
);
const PersonalHealthPanel = lazy(() =>
  import("../health/PersonalHealthPanel").then((m) => ({ default: m.PersonalHealthPanel })),
);
const RelationshipsPlusPanel = lazy(() =>
  import("../relationships/RelationshipsPlusPanel").then((m) => ({
    default: m.RelationshipsPlusPanel,
  })),
);
const LearningPanel = lazy(() =>
  import("../learning/LearningPanel").then((m) => ({ default: m.LearningPanel })),
);
const JournalPanel = lazy(() =>
  import("../journal/JournalPanel").then((m) => ({ default: m.JournalPanel })),
);
const ChallengesPanel = lazy(() =>
  import("../gamification/ChallengesPanel").then((m) => ({ default: m.ChallengesPanel })),
);
const LocationRemindersPanel = lazy(() =>
  import("../location/LocationRemindersPanel").then((m) => ({ default: m.LocationRemindersPanel })),
);
const FamilyMembersList = lazy(() =>
  import("../family/FamilyMembersList").then((m) => ({ default: m.FamilyMembersList })),
);
const FamilyCalendarView = lazy(() =>
  import("../family/FamilyCalendarView").then((m) => ({ default: m.FamilyCalendarView })),
);
const ChildDashboard = lazy(() =>
  import("../family/ChildDashboard").then((m) => ({ default: m.ChildDashboard })),
);
const CorrelationsDashboard = lazy(() =>
  import("../insights/CorrelationsDashboard").then((m) => ({ default: m.CorrelationsDashboard })),
);
const MeetingBotsPanel = lazy(() =>
  import("../assistant/MeetingBotsPanel").then((m) => ({ default: m.MeetingBotsPanel })),
);
const AssistantOpsPanel = lazy(() =>
  import("../assistant/AssistantOpsPanel").then((m) => ({ default: m.AssistantOpsPanel })),
);
const ContentStudioPanel = lazy(() =>
  import("../content/ContentStudioPanel").then((m) => ({ default: m.ContentStudioPanel })),
);

interface StandardModeProps {
  tasks: Task[];
  events: CalendarEvent[];
  sharedTasks?: Task[];
  sharedEvents?: CalendarEvent[];
  messages: ChatMessage[];
  isProcessing: boolean;
  projects?: Project[];
  contacts?: Contact[];
  activities?: ActivityItem[];
  activityLoading?: boolean;
  searchResults?: SearchResult[];
  recentSearches?: { id: string; query: string; createdAt: Date }[];
  searchLoading?: boolean;
  onSearch?: (query: string, filters?: SearchFilters) => void;
  onClearSearchResults?: () => void;
  onClearRecentSearches?: () => void;
  onLogActivity?: (
    action: ActivityItem["action"],
    itemType: "task" | "event",
    itemId: string,
    itemTitle?: string,
    targetUserId?: string,
    details?: Record<string, unknown>,
  ) => void;
  onAddTask: (task: Omit<Task, "id" | "createdAt">) => void;
  onToggleTaskComplete: (id: string) => void;
  onDeleteTask: (id: string) => void;
  onDeleteTasks?: (ids: string[]) => Promise<{ error: string | null }> | void;
  onUpdateTask?: (id: string, updates: Partial<Task>) => void;
  onReorderTasks?: (taskOrders: { id: string; sortOrder: number }[]) => void;
  onAddEvent: (event: Omit<CalendarEvent, "id">) => void;
  onUpdateEvent?: (id: string, updates: Partial<CalendarEvent>) => void;
  onDeleteEvent?: (id: string) => void;
  onImportEvents?: (events: CalendarEvent[]) => void;
  onSendMessage: (content: string) => void;
  thinkingStatus?: string;
  actionCards?: import("../assistant/ActionCard").ActionCardData[];
  doriStats?: {
    overdueTasks?: number;
    unreadEmails?: number;
    habitsAtRisk?: number;
    todayEvents?: number;
    pendingTasks?: number;
  };
  onVoiceMode: () => void;
  onEditProfile?: () => void;
  onShareTask?: (id: string, title: string) => void;
  onShareEvent?: (id: string, title: string) => void;
  onSignOut?: () => void;
  onOpenWeeklyReview?: () => void;
  onAddProject?: (
    project: Omit<Project, "id" | "createdAt" | "updatedAt">,
  ) => Promise<Project | null>;
  onUpdateProject?: (id: string, updates: Partial<Project>) => void;
  onDeleteProject?: (id: string) => void;
  getProjectProgress?: (
    projectId: string,
    tasks: { projectId?: string; completed: boolean }[],
  ) => number;
  onShareProject?: (projectId: string, projectName: string) => void;
  onShareProjectWithEmail?: (projectId: string, email: string) => Promise<{ error: string | null }>;
  settings?: UserSettings;
  onUpdateSettings?: (updates: Partial<UserSettings>) => void;
  onUpdateNotifications?: (updates: Partial<UserSettings["notifications"]>) => void;
}

type FullscreenPanel = "chat" | "tasks" | "calendar" | null;

export const StandardMode = memo(function StandardMode({
  tasks,
  events,
  sharedTasks = [],
  sharedEvents = [],
  messages,
  isProcessing,
  projects = [],
  contacts = [],
  activities = [],
  activityLoading = false,
  searchResults = [],
  recentSearches = [],
  searchLoading = false,
  onSearch,
  onClearSearchResults,
  onClearRecentSearches,
  onLogActivity: _onLogActivity,
  onAddTask,
  onToggleTaskComplete,
  onDeleteTask,
  onDeleteTasks,
  onUpdateTask,
  onReorderTasks,
  onAddEvent,
  onUpdateEvent,
  onDeleteEvent,
  onImportEvents,
  onSendMessage,
  thinkingStatus,
  actionCards,
  doriStats,
  onVoiceMode,
  onEditProfile,
  onShareTask,
  onShareEvent,
  onSignOut,
  onOpenWeeklyReview,
  onAddProject,
  onUpdateProject,
  onDeleteProject,
  getProjectProgress,
  onShareProject,
  onShareProjectWithEmail,
  settings,
  onUpdateSettings,
  onUpdateNotifications,
}: StandardModeProps) {
  const [filter, setFilter] = useState<SidebarFilter>("all");
  const [calendarMode, setCalendarMode] = useState<"agenda" | "grid">("agenda");
  const [taskViewMode, setTaskViewMode] = useState<TaskView>("list");
  const [fullscreenPanel, setFullscreenPanel] = useState<FullscreenPanel>(null);
  const [showFocusTimer, setShowFocusTimer] = useState(false);
  const [showTodayFocus, setShowTodayFocus] = useState(false);

  const [showGlobalSearch, setShowGlobalSearch] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // --- URL-routable panels (#3) -----------------------------------------
  // The active panel lives in the `?panel=` query param so refreshes,
  // shared links, and the browser/mobile back button all work. React state
  // is kept in sync as a fast local mirror.
  const panelFromUrl = (searchParams.get("panel") as ActivePanel) || "tasks";
  const [activePanel, setActivePanelState] = useState<ActivePanel>(panelFromUrl);
  const [selectedProjectId, setSelectedProjectId] = useState<string | undefined>();

  // Sync state when the URL changes underneath us (back/forward, deep links).
  useEffect(() => {
    if (panelFromUrl !== activePanel) setActivePanelState(panelFromUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panelFromUrl]);

  // Single entry point for changing panels: updates both state and the URL.
  const setActivePanel = useCallback(
    (panel: ActivePanel) => {
      setActivePanelState(panel);
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (!panel || panel === "tasks") next.delete("panel");
          else next.set("panel", panel);
          return next;
        },
        { replace: false },
      );
    },
    [setSearchParams],
  );

  // Each nav id maps 1:1 to a panel. "Family Hub" (family) and "Cooking"
  // (cooking) are distinct surfaces per src/config/navigation.ts, so there's
  // no aliasing — this just narrows the string from the nav config to ActivePanel.
  const goToPanel = useCallback(
    (panelId: string) => {
      setActivePanel(panelId as ActivePanel);
    },
    [setActivePanel],
  );

  // Deep-linking from push notifications, AI replies, etc. — listens for
  // `dori:open-entity` window events and routes to the right surface.
  // The options object is memoized so the inner useEffect doesn't tear
  // down + re-add the window listener on every parent render.
  const deepLinkOptions = useMemo(
    () => ({
      setActivePanel: (p: string) => setActivePanel(p as ActivePanel),
      setSelectedProjectId,
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }),
    [setSelectedProjectId],
  );
  useDeepLinkHandler(deepLinkOptions);
  const { celebrate } = useCelebration();
  const { user } = useAuth();
  const { t } = useLanguage();

  const panelTitle = useMemo(() => {
    const titles: Record<string, string> = {
      dashboard: t("nav.dashboard"),
      tasks: t("nav.tasks"),
      calendar: t("nav.calendar"),
      assistant: t("nav.assistant"),
      "assistant-ops": t("nav.assistantOps") || "Assistant Ops",
      social: t("nav.social"),
      contacts: t("nav.contacts"),
      contracts: t("nav.contracts"),
      notes: t("nav.notes"),
      habits: t("nav.habits"),
      family: t("nav.familyHub") || "Family Hub",
      cooking: t("nav.cooking") || "Cooking",
      islam: t("nav.islam") || "Islam",
      health: t("nav.health") || "Health",
      email: t("nav.email") || "Email",
      properties: t("nav.properties") || "Properties",
      assets: t("nav.assets") || "Properties & Vehicles",
      startups: t("nav.startups") || "Startups",
      content: "Content",
      "content-liked": "Content · Liked & Scripts",
      "content-calendar": "Content · Calendar",
      "content-profile": "Content · Creator Profile",
      news: t("nav.news") || "Tech News",
      settings: t("nav.settings"),
      admin: t("nav.admin"),
      projects: "Projects",
      activity: "Activity",
    };
    return titles[activePanel || "tasks"] || "DarAI";
  }, [activePanel, t]);

  // Wrapper for task completion with celebration
  const handleToggleTaskComplete = (id: string) => {
    const task = tasks.find((t) => t.id === id);
    if (task && !task.completed) {
      // Task is being completed
      if (task.priority === "high") {
        celebrate({ type: "highPriorityComplete" });
      } else {
        celebrate({ type: "taskComplete" });
      }
    }
    onToggleTaskComplete(id);
  };

  // Sort tasks by due date (closest first), then by priority
  const sortTasksByDueDate = (tasksToSort: Task[]) => {
    return [...tasksToSort].sort((a, b) => {
      // Completed tasks go to the bottom
      if (a.completed !== b.completed) return a.completed ? 1 : -1;

      // Tasks with due dates come before tasks without
      if (a.dueDate && !b.dueDate) return -1;
      if (!a.dueDate && b.dueDate) return 1;

      // Sort by due date (closest first)
      if (a.dueDate && b.dueDate) {
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      }

      // Then by priority
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  };

  // Keyboard shortcut for the command palette (Cmd/Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setShowCommandPalette((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Quick actions surfaced at the top of the command palette.
  const commandActions = useMemo<CommandPaletteAction[]>(
    () => [
      {
        id: "new-task",
        label: "New task",
        icon: Plus,
        keywords: "add create todo",
        run: () => goToPanel("tasks"),
      },
      {
        id: "voice",
        label: "Talk to Dori (voice)",
        icon: Mic,
        keywords: "voice ghost speak",
        run: onVoiceMode,
      },
      {
        id: "focus-timer",
        label: "Start focus timer",
        icon: Timer,
        keywords: "pomodoro deep work",
        run: () => setShowFocusTimer(true),
      },
      {
        id: "today-focus",
        label: "Today's focus",
        icon: Target,
        keywords: "now priorities",
        run: () => setShowTodayFocus(true),
      },
      ...(onOpenWeeklyReview
        ? [
            {
              id: "weekly-review",
              label: "Weekly review",
              icon: CalendarCheck,
              keywords: "recap reflect",
              run: onOpenWeeklyReview,
            } as CommandPaletteAction,
          ]
        : []),
    ],
    [goToPanel, onVoiceMode, onOpenWeeklyReview],
  );

  // Ask Dori from the palette: open the assistant, then send the message.
  const handleAskDori = useCallback(
    (text: string) => {
      setActivePanel("assistant");
      onSendMessage(text);
    },
    [setActivePanel, onSendMessage],
  );

  // Let any surface (dashboard hero prompts, cards, etc.) hand a prompt to
  // Dori via a `dori:ask` window event — reuses the app's event-bus pattern.
  useEffect(() => {
    const handler = (e: Event) => {
      const text = (e as CustomEvent<{ text?: string }>).detail?.text;
      if (text) handleAskDori(text);
    };
    window.addEventListener("dori:ask", handler as EventListener);
    return () => window.removeEventListener("dori:ask", handler as EventListener);
  }, [handleAskDori]);

  // The Dori bar's inline popover can "expand" into the full assistant panel.
  useEffect(() => {
    const open = () => setActivePanel("assistant");
    window.addEventListener("dori:open-assistant", open);
    return () => window.removeEventListener("dori:open-assistant", open);
  }, [setActivePanel]);

  // Handle search result selection
  const handleSelectSearchResult = (result: SearchResult) => {
    setShowGlobalSearch(false);
    // Navigate to the result based on type. We prefer the SPA router
    // (react-router's `navigate`) over window.location.href so the app
    // doesn't lose state on a full reload.
    if (result.type === "task") {
      setFilter("all");
      setSelectedProjectId(undefined);
      // Could scroll to the task or open edit modal
    } else if (result.type === "event") {
      setActivePanel("calendar");
    } else if (result.type === "project") {
      setActivePanel("projects");
      setSelectedProjectId(result.id);
    } else if (result.type === "note") {
      // Switch to the notes panel, then dispatch a window event the
      // panel listens for so it auto-selects the requested note. We
      // queue with a microtask so the panel mount runs before the event.
      setActivePanel("notes");
      queueMicrotask(() => {
        window.dispatchEvent(new CustomEvent("dori:select-note", { detail: { id: result.id } }));
      });
    } else if (result.type === "workspace") {
      navigate("/workspaces");
    } else if (result.type === "contract") {
      navigate("/contracts");
    } else if (result.type === "contact") {
      navigate("/contacts");
    }
  };

  // Get tasks based on current filter and sort by due date
  const filteredTasks =
    filter === "shared"
      ? sharedTasks
      : selectedProjectId
        ? tasks.filter((t) => t.projectId === selectedProjectId)
        : filter !== "all"
          ? tasks.filter((t) => t.category === filter)
          : tasks;
  const displayTasks = sortTasksByDueDate(filteredTasks);
  const displayEvents = filter === "shared" ? sharedEvents : events;

  // Use mobile layout on small screens
  if (isMobile) {
    return (
      <Suspense fallback={<PanelFallback />}>
        <MobileLayout
          userId={user?.id || ""}
          tasks={tasks}
          events={events}
          sharedTasks={sharedTasks}
          sharedEvents={sharedEvents}
          messages={messages}
          isProcessing={isProcessing}
          projects={projects}
          onAddTask={onAddTask}
          onToggleTaskComplete={onToggleTaskComplete}
          onDeleteTask={onDeleteTask}
          onDeleteTasks={onDeleteTasks}
          onUpdateTask={onUpdateTask}
          onReorderTasks={onReorderTasks}
          onAddEvent={onAddEvent}
          onUpdateEvent={onUpdateEvent}
          onDeleteEvent={onDeleteEvent}
          onImportEvents={onImportEvents}
          onSendMessage={onSendMessage}
          thinkingStatus={thinkingStatus}
          actionCards={actionCards}
          doriStats={doriStats}
          onVoiceMode={onVoiceMode}
          onEditProfile={onEditProfile}
          onShareTask={onShareTask}
          onShareEvent={onShareEvent}
          onSignOut={onSignOut}
          settings={settings}
          onUpdateSettings={onUpdateSettings}
          onUpdateNotifications={onUpdateNotifications}
        />
      </Suspense>
    );
  }

  // Fullscreen overlay
  if (fullscreenPanel) {
    return (
      <div className="fixed inset-0 z-50 bg-background flex flex-col">
        <div className="h-14 px-4 flex items-center justify-end border-b border-border">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Exit fullscreen"
            onClick={() => setFullscreenPanel(null)}
          >
            <X className="w-5 h-5" />
          </Button>
        </div>
        <div className="flex-1 overflow-hidden">
          <Suspense fallback={<PanelFallback />}>
            {fullscreenPanel === "chat" && (
              <ChatPanel
                messages={messages}
                onSendMessage={onSendMessage}
                isProcessing={isProcessing}
                isFullscreen={true}
                onToggleFullscreen={() => setFullscreenPanel(null)}
                onVoiceMode={onVoiceMode}
                contacts={contacts}
                proactiveStats={doriStats}
              />
            )}
            {fullscreenPanel === "tasks" && (
              <TaskList
                tasks={displayTasks}
                filter={filter}
                onToggleComplete={handleToggleTaskComplete}
                onDeleteTask={onDeleteTask}
                onDeleteTasks={onDeleteTasks}
                onAddTask={onAddTask}
                onUpdateTask={onUpdateTask}
                onReorderTasks={onReorderTasks}
                onShareTask={onShareTask}
                isFullscreen={true}
                onToggleFullscreen={() => setFullscreenPanel(null)}
              />
            )}
            {fullscreenPanel === "calendar" &&
              (calendarMode === "agenda" ? (
                <CalendarPanel
                  events={events}
                  tasks={tasks}
                  onAddEvent={onAddEvent}
                  onUpdateEvent={onUpdateEvent}
                  onDeleteEvent={onDeleteEvent}
                  onImportEvents={onImportEvents}
                  onShareEvent={onShareEvent}
                  onShareTask={onShareTask}
                  onToggleTaskComplete={onToggleTaskComplete}
                  onUpdateTask={onUpdateTask}
                  onDeleteTask={onDeleteTask}
                  isFullscreen={true}
                  onToggleFullscreen={() => setFullscreenPanel(null)}
                />
              ) : (
                <CalendarView
                  events={events}
                  tasks={tasks}
                  onToggleTaskComplete={onToggleTaskComplete}
                  onUpdateTask={onUpdateTask}
                  onDeleteTask={onDeleteTask}
                  onAddTask={(task) =>
                    onAddTask({
                      ...task,
                      completed: false,
                      priority: task.priority || "medium",
                      category: task.category || "personal",
                    } as Omit<Task, "id" | "createdAt">)
                  }
                  isFullscreen={true}
                  onToggleFullscreen={() => setFullscreenPanel(null)}
                />
              ))}
          </Suspense>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full min-w-0 overflow-hidden bg-background">
      <Sidebar
        onSignOut={onSignOut}
        onOpenFocusTimer={() => setShowFocusTimer(true)}
        onOpenWeeklyReview={onOpenWeeklyReview}
        onOpenTodayFocus={() => setShowTodayFocus(true)}
        onPanelChange={(p) => goToPanel(p as string)}
        activePanel={activePanel}
      />

      <main className="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden">
        {/* Desktop Content Header */}
        <ContextualHeader
          title={panelTitle}
          onOpenSearch={() => setShowCommandPalette(true)}
          notifications={[]}
          onMarkRead={() => {}}
          onMarkAllRead={() => {}}
          onDeleteNotification={() => {}}
          onClearAll={() => {}}
          rightSlot={<RealtimeNotificationCenter userId={user?.id} />}
        />

        <div className="flex-1 min-w-0 min-h-0 flex overflow-hidden">
          {/* Main Content Area - Only one panel at a time */}
          <div className="flex-1 min-w-0 min-h-0 flex flex-col gap-3 overflow-hidden p-3 md:p-5">
            <AnimatePresence mode="wait">
              <motion.div
                key={activePanel}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2 }}
                className="flex-1 min-w-0 min-h-0 flex flex-col gap-2 overflow-hidden"
              >
                <PanelErrorBoundary panelName={panelTitle}>
                  <Suspense fallback={<PanelFallback />}>
                    {/* AI Assistant Panel */}
                    {activePanel === "assistant" && (
                      <div className="flex-1 glass-panel-solid rounded-xl overflow-hidden">
                        <DoriPanel
                          messages={messages}
                          onSendMessage={onSendMessage}
                          isProcessing={isProcessing}
                          onVoiceMode={onVoiceMode}
                          contacts={contacts}
                          thinkingStatus={thinkingStatus}
                          actionCards={actionCards}
                          stats={doriStats}
                        />
                      </div>
                    )}

                    {activePanel === "assistant-ops" && (
                      <div className="flex-1 glass-panel-solid rounded-xl overflow-hidden">
                        <AssistantOpsPanel />
                      </div>
                    )}

                    {/* Tasks Panel */}
                    {activePanel === "tasks" && (
                      <>
                        {/* View Toggle for Tasks */}
                        <div className="flex items-center justify-between px-2">
                          <AICommandPanel
                            tasks={tasks}
                            events={events}
                            onRescheduleTask={(taskId, newDate) => {
                              if (onUpdateTask) {
                                onUpdateTask(taskId, { dueDate: newDate });
                              }
                            }}
                          />
                          <TaskViewSwitcher
                            activeView={taskViewMode}
                            onViewChange={setTaskViewMode}
                          />
                        </div>

                        {/* Tasks - Multi-view */}
                        <div className="flex-1 glass-panel-solid rounded-xl overflow-hidden">
                          {taskViewMode === "kanban" ? (
                            <KanbanBoard
                              tasks={displayTasks}
                              sharedTasks={sharedTasks}
                              projects={projects}
                              onUpdateTask={onUpdateTask || (() => {})}
                              onToggleComplete={handleToggleTaskComplete}
                              onDeleteTask={onDeleteTask}
                            />
                          ) : taskViewMode === "priority" ? (
                            <PriorityBoardView
                              tasks={displayTasks}
                              onToggleComplete={handleToggleTaskComplete}
                              onDeleteTask={onDeleteTask}
                              onUpdateTask={onUpdateTask}
                            />
                          ) : taskViewMode === "timeline" ? (
                            <TimelineView
                              tasks={displayTasks}
                              onToggleComplete={handleToggleTaskComplete}
                              onDeleteTask={onDeleteTask}
                              onUpdateTask={onUpdateTask}
                            />
                          ) : (
                            <TaskList
                              tasks={tasks}
                              sharedTasks={sharedTasks}
                              onToggleComplete={handleToggleTaskComplete}
                              onDeleteTask={onDeleteTask}
                              onDeleteTasks={onDeleteTasks}
                              onAddTask={onAddTask}
                              onUpdateTask={onUpdateTask}
                              onReorderTasks={onReorderTasks}
                              onShareTask={onShareTask}
                              projects={projects}
                              contacts={contacts}
                              onToggleFullscreen={() => setFullscreenPanel("tasks")}
                            />
                          )}
                        </div>
                      </>
                    )}

                    {/* Calendar Panel */}
                    {activePanel === "calendar" && (
                      <div className="flex-1 glass-panel-solid rounded-xl overflow-hidden flex flex-col">
                        <div className="h-10 px-4 flex items-center justify-end border-b border-border gap-1">
                          <Button
                            variant={calendarMode === "agenda" ? "secondary" : "ghost"}
                            size="sm"
                            className="h-7 px-2"
                            onClick={() => setCalendarMode("agenda")}
                          >
                            <List className="w-4 h-4" />
                          </Button>
                          <Button
                            variant={calendarMode === "grid" ? "secondary" : "ghost"}
                            size="sm"
                            className="h-7 px-2"
                            onClick={() => setCalendarMode("grid")}
                          >
                            <Grid3X3 className="w-4 h-4" />
                          </Button>
                        </div>
                        <div className="flex-1 overflow-hidden">
                          {calendarMode === "agenda" ? (
                            <CalendarPanel
                              events={displayEvents}
                              tasks={displayTasks}
                              onAddEvent={onAddEvent}
                              onUpdateEvent={onUpdateEvent}
                              onDeleteEvent={onDeleteEvent}
                              onImportEvents={onImportEvents}
                              onShareEvent={onShareEvent}
                              onShareTask={onShareTask}
                              onToggleTaskComplete={onToggleTaskComplete}
                              onUpdateTask={onUpdateTask}
                              onDeleteTask={onDeleteTask}
                              onToggleFullscreen={() => setFullscreenPanel("calendar")}
                            />
                          ) : (
                            <CalendarView
                              events={displayEvents}
                              tasks={displayTasks}
                              onToggleTaskComplete={onToggleTaskComplete}
                              onUpdateTask={onUpdateTask}
                              onDeleteTask={onDeleteTask}
                              onAddTask={(task) =>
                                onAddTask({
                                  ...task,
                                  completed: false,
                                  priority: task.priority || "medium",
                                  category: task.category || "personal",
                                } as Omit<Task, "id" | "createdAt">)
                              }
                              onToggleFullscreen={() => setFullscreenPanel("calendar")}
                            />
                          )}
                        </div>
                      </div>
                    )}

                    {/* Social Panel (Chat + Calls) */}
                    {activePanel === "social" && user?.id && (
                      <div className="flex-1 glass-panel-solid rounded-xl overflow-hidden">
                        <SocialPanel userId={user.id} />
                      </div>
                    )}

                    {/* Dashboard Panel */}
                    {activePanel === "dashboard" && user?.id && (
                      <div className="flex-1 glass-panel-solid rounded-xl overflow-hidden">
                        <DashboardPanel
                          userId={user.id}
                          onNavigate={(p) => setActivePanel(p as ActivePanel)}
                        />
                      </div>
                    )}

                    {/* Projects Panel */}
                    {activePanel === "projects" &&
                      onAddProject &&
                      onUpdateProject &&
                      onDeleteProject &&
                      getProjectProgress && (
                        <div className="flex-1 glass-panel-solid rounded-xl overflow-hidden p-4">
                          <ProjectManager
                            projects={projects}
                            tasks={tasks}
                            contacts={contacts}
                            onAddProject={onAddProject}
                            onUpdateProject={onUpdateProject}
                            onDeleteProject={onDeleteProject}
                            getProjectProgress={getProjectProgress}
                            selectedProjectId={selectedProjectId}
                            onSelectProject={setSelectedProjectId}
                            onShareProject={onShareProject}
                            onShareProjectWithEmail={onShareProjectWithEmail}
                            onAddTask={(task) => onAddTask({ ...task, completed: false })}
                          />
                        </div>
                      )}

                    {/* Contacts Panel */}
                    {activePanel === "contacts" && user?.id && (
                      <div className="flex-1 glass-panel-solid rounded-xl overflow-hidden">
                        <ContactsPanel userId={user.id} />
                      </div>
                    )}

                    {/* Contracts Panel */}
                    {activePanel === "contracts" && user?.id && (
                      <div className="flex-1 glass-panel-solid rounded-xl overflow-hidden">
                        <ContractsPanel userId={user.id} />
                      </div>
                    )}

                    {/* Activity Panel */}
                    {activePanel === "activity" && (
                      <div className="flex-1 glass-panel-solid rounded-xl overflow-hidden p-4">
                        <div className="flex items-center gap-2 mb-4">
                          <Activity className="h-5 w-5" />
                          <h2 className="text-lg font-semibold">Activity Feed</h2>
                        </div>
                        <ActivityFeed activities={activities} loading={activityLoading} />
                      </div>
                    )}

                    {/* Settings Panel */}
                    {activePanel === "settings" &&
                      settings &&
                      onUpdateSettings &&
                      onUpdateNotifications && (
                        <div className="flex-1 min-h-0 glass-panel-solid rounded-xl overflow-hidden flex flex-col">
                          <SettingsPanelContent
                            settings={settings}
                            onUpdateSettings={onUpdateSettings}
                            onUpdateNotifications={onUpdateNotifications}
                          />
                        </div>
                      )}

                    {/* Notes Panel */}
                    {activePanel === "notes" && user?.id && (
                      <div className="flex-1 glass-panel-solid rounded-xl overflow-hidden">
                        <NotesPanel userId={user.id} />
                      </div>
                    )}

                    {/* Habits Panel */}
                    {activePanel === "habits" && user?.id && (
                      <div className="flex-1 glass-panel-solid rounded-xl overflow-hidden">
                        <HabitsPanel userId={user.id} />
                      </div>
                    )}

                    {/* Family Hub Panel */}
                    {activePanel === "family" && user?.id && (
                      <div className="flex-1 glass-panel-solid rounded-xl overflow-hidden">
                        <FamilyPanel />
                      </div>
                    )}

                    {/* Cooking Panel — distinct from the Family Hub (recipes, meal planning) */}
                    {activePanel === "cooking" && user?.id && (
                      <div className="flex-1 glass-panel-solid rounded-xl overflow-hidden">
                        <CookingPanel />
                      </div>
                    )}

                    {/* Admin Analytics Panel */}
                    {activePanel === "admin" && user?.id && (
                      <div className="flex-1 glass-panel-solid rounded-xl overflow-hidden">
                        <AdminAnalyticsPanel userId={user.id} />
                      </div>
                    )}

                    {/* Islam Panel - Enhanced */}
                    {activePanel === "islam" && (
                      <div className="flex-1 glass-panel-solid rounded-xl overflow-hidden">
                        <IslamEnhancedPanel />
                      </div>
                    )}

                    {/* Properties Panel */}
                    {activePanel === "properties" && user?.id && (
                      <div className="flex-1 glass-panel-solid rounded-xl overflow-hidden">
                        <PropertyPanel />
                      </div>
                    )}

                    {/* Startups Panel */}
                    {activePanel === "startups" && user?.id && (
                      <div className="flex-1 glass-panel-solid rounded-xl overflow-hidden">
                        <StartupWorkspacePanel />
                      </div>
                    )}

                    {/* Content Studio Panel — four nav ids deep-link to its tabs */}
                    {(activePanel === "content" ||
                      activePanel === "content-liked" ||
                      activePanel === "content-calendar" ||
                      activePanel === "content-profile") &&
                      user?.id && (
                        <div className="flex-1 glass-panel-solid rounded-xl overflow-hidden">
                          <ContentStudioPanel
                            initialTab={
                              activePanel === "content-liked"
                                ? "liked"
                                : activePanel === "content-calendar"
                                  ? "calendar"
                                  : activePanel === "content-profile"
                                    ? "profile"
                                    : "today"
                            }
                          />
                        </div>
                      )}

                    {/* Tech News Panel */}
                    {activePanel === "news" && user?.id && (
                      <div className="flex-1 glass-panel-solid rounded-xl overflow-hidden">
                        <TechNewsPanel />
                      </div>
                    )}

                    {/* Email Panel */}
                    {activePanel === "email" && user?.id && (
                      <div className="flex-1 min-w-0 min-h-0 glass-panel-solid rounded-xl overflow-hidden">
                        <EmailPanel />
                      </div>
                    )}

                    {/* Health Panel */}
                    {activePanel === "health" && (
                      <div className="flex-1 glass-panel-solid rounded-xl overflow-hidden">
                        <HealthHubPanel />
                      </div>
                    )}

                    {activePanel === "finances" && (
                      <div className="flex-1 glass-panel-solid rounded-xl overflow-hidden">
                        <FinancesPanel />
                      </div>
                    )}

                    {activePanel === "travel" && (
                      <div className="flex-1 glass-panel-solid rounded-xl overflow-hidden">
                        <TravelPanel />
                      </div>
                    )}

                    {activePanel === "assets" && (
                      <div className="flex-1 glass-panel-solid rounded-xl overflow-hidden">
                        <AssetsPanel />
                      </div>
                    )}

                    {activePanel === "personal-health" && (
                      <div className="flex-1 glass-panel-solid rounded-xl overflow-hidden">
                        <PersonalHealthPanel />
                      </div>
                    )}

                    {activePanel === "relationships-plus" && (
                      <div className="flex-1 glass-panel-solid rounded-xl overflow-hidden">
                        <RelationshipsPlusPanel />
                      </div>
                    )}

                    {activePanel === "learning" && (
                      <div className="flex-1 glass-panel-solid rounded-xl overflow-hidden">
                        <LearningPanel />
                      </div>
                    )}

                    {activePanel === "journal" && (
                      <div className="flex-1 glass-panel-solid rounded-xl overflow-hidden">
                        <JournalPanel />
                      </div>
                    )}

                    {activePanel === "challenges" && (
                      <div className="flex-1 glass-panel-solid rounded-xl overflow-hidden">
                        <ChallengesPanel />
                      </div>
                    )}

                    {activePanel === "location-reminders" && (
                      <div className="flex-1 glass-panel-solid rounded-xl overflow-hidden">
                        <LocationRemindersPanel />
                      </div>
                    )}

                    {activePanel === "family-members" && (
                      <div className="flex-1 glass-panel-solid rounded-xl overflow-hidden">
                        <FamilyMembersList />
                      </div>
                    )}

                    {activePanel === "family-calendar" && (
                      <div className="flex-1 glass-panel-solid rounded-xl overflow-hidden">
                        <FamilyCalendarView />
                      </div>
                    )}

                    {activePanel === "child-mode" && (
                      <div className="flex-1 glass-panel-solid rounded-xl overflow-hidden">
                        <ChildDashboard />
                      </div>
                    )}

                    {activePanel === "correlations" && (
                      <div className="flex-1 glass-panel-solid rounded-xl overflow-hidden">
                        <CorrelationsDashboard />
                      </div>
                    )}

                    {activePanel === "meetings" && (
                      <div className="flex-1 glass-panel-solid rounded-xl overflow-hidden">
                        <MeetingBotsPanel />
                      </div>
                    )}
                  </Suspense>
                </PanelErrorBoundary>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* The persistent Dori spine — ask from any panel (reply streams into an
            inline popover), see what's next, jump to voice. Hidden on the
            assistant panel (you're already there). */}
        <DoriBar onVoiceMode={onVoiceMode} hidden={activePanel === "assistant"} />
      </main>

      {/* Proactive surfaces (desktop) — previously only mounted on mobile.
          ADHD-style smart nudges (hydration/break/stuck detection) and the
          floating "What now?" assistant that suggests the best next task. */}
      <SmartNudgeProvider tasks={tasks} events={events} />

      {/* Today Focus View */}
      <Suspense fallback={null}>
        <WhatNowButton
          tasks={tasks}
          events={events}
          variant="fab"
          onStartTask={() => {
            setSelectedProjectId(undefined);
            setFilter("all");
            setActivePanel("tasks");
          }}
        />

        {showTodayFocus && (
          <TodayFocusView
            tasks={tasks}
            events={events}
            onToggleComplete={handleToggleTaskComplete}
            onClose={() => setShowTodayFocus(false)}
          />
        )}

        {/* Focus Timer Dialog */}
        <FocusTimer
          tasks={tasks}
          isOpen={showFocusTimer}
          onClose={() => setShowFocusTimer(false)}
        />

        {/* Command palette (⌘K) — fast nav + actions + Ask Dori */}
        <CommandPalette
          open={showCommandPalette}
          onOpenChange={setShowCommandPalette}
          onNavigate={goToPanel}
          onAskDori={handleAskDori}
          onOpenSearch={onSearch ? () => setShowGlobalSearch(true) : undefined}
          actions={commandActions}
        />

        {/* Global Search */}
        {onSearch && onClearSearchResults && onClearRecentSearches && (
          <GlobalSearch
            open={showGlobalSearch}
            onOpenChange={setShowGlobalSearch}
            results={searchResults}
            recentSearches={recentSearches}
            loading={searchLoading}
            onSearch={onSearch}
            onClearResults={onClearSearchResults}
            onClearRecent={onClearRecentSearches}
            onSelectResult={handleSelectSearchResult}
          />
        )}
      </Suspense>
    </div>
  );
});
