import { useState, useCallback, useRef, useEffect, Suspense, lazy } from 'react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { PanelFallback } from '@/components/lazy/LazyLoader';
import { PanelErrorBoundary } from '@/components/PanelErrorBoundary';
// Feature panels are lazy-loaded so they are code-split into their own chunks
// instead of being inlined into the main bundle. (Statically importing them
// here previously pulled every panel into the Index chunk, cancelling out the
// lazy() splitting StandardMode already does for the desktop path.)
const DoriPanel = lazy(() => import('../assistant/DoriPanel').then(m => ({ default: m.DoriPanel })));
const TeamChatPanel = lazy(() => import('../chat/TeamChatPanel').then(m => ({ default: m.TeamChatPanel })));
const CalendarHubPanel = lazy(() => import('../calendar/CalendarHubPanel').then(m => ({ default: m.CalendarHubPanel })));
const SettingsPanelContent = lazy(() => import('../settings/SettingsPanelContent').then(m => ({ default: m.SettingsPanelContent })));
const CookingPanel = lazy(() => import('../cooking/CookingPanel').then(m => ({ default: m.CookingPanel })));
const FamilyPanel = lazy(() => import('../family/FamilyPanel').then(m => ({ default: m.FamilyPanel })));
const DashboardPanel = lazy(() => import('../dashboard/DashboardPanel').then(m => ({ default: m.DashboardPanel })));
const HealthHubPanel = lazy(() => import('../health/HealthHubPanel').then(m => ({ default: m.HealthHubPanel })));
const ContactsPanel = lazy(() => import('../contacts/ContactsPanel').then(m => ({ default: m.ContactsPanel })));
const ContractsPanel = lazy(() => import('../contracts/ContractsPanel').then(m => ({ default: m.ContractsPanel })));
const NotesPanel = lazy(() => import('../notes/NotesPanel').then(m => ({ default: m.NotesPanel })));
const HabitsPanel = lazy(() => import('../habits/HabitsPanel').then(m => ({ default: m.HabitsPanel })));
const IslamEnhancedPanel = lazy(() => import('../islam/IslamEnhancedPanel').then(m => ({ default: m.IslamEnhancedPanel })));
const PropertyPanel = lazy(() => import('../property/PropertyPanel').then(m => ({ default: m.PropertyPanel })));
const StartupWorkspacePanel = lazy(() => import('../startup/StartupWorkspacePanel').then(m => ({ default: m.StartupWorkspacePanel })));
const TechNewsPanel = lazy(() => import('../news/TechNewsPanel').then(m => ({ default: m.TechNewsPanel })));
const EmailPanel = lazy(() => import('../email/EmailPanel').then(m => ({ default: m.EmailPanel })));
const FinancesPanel = lazy(() => import('../finances/FinancesPanel').then(m => ({ default: m.FinancesPanel })));
const TravelPanel = lazy(() => import('../travel/TravelPanel').then(m => ({ default: m.TravelPanel })));
const AssetsPanel = lazy(() => import('../assets/AssetsPanel').then(m => ({ default: m.AssetsPanel })));
const PersonalHealthPanel = lazy(() => import('../health/PersonalHealthPanel').then(m => ({ default: m.PersonalHealthPanel })));
const RelationshipsPlusPanel = lazy(() => import('../relationships/RelationshipsPlusPanel').then(m => ({ default: m.RelationshipsPlusPanel })));
const LearningPanel = lazy(() => import('../learning/LearningPanel').then(m => ({ default: m.LearningPanel })));
const JournalPanel = lazy(() => import('../journal/JournalPanel').then(m => ({ default: m.JournalPanel })));
const ChallengesPanel = lazy(() => import('../gamification/ChallengesPanel').then(m => ({ default: m.ChallengesPanel })));
const LocationRemindersPanel = lazy(() => import('../location/LocationRemindersPanel').then(m => ({ default: m.LocationRemindersPanel })));
const FamilyMembersList = lazy(() => import('../family/FamilyMembersList').then(m => ({ default: m.FamilyMembersList })));
const FamilyCalendarView = lazy(() => import('../family/FamilyCalendarView').then(m => ({ default: m.FamilyCalendarView })));
const ChildDashboard = lazy(() => import('../family/ChildDashboard').then(m => ({ default: m.ChildDashboard })));
const CorrelationsDashboard = lazy(() => import('../insights/CorrelationsDashboard').then(m => ({ default: m.CorrelationsDashboard })));
const MeetingBotsPanel = lazy(() => import('../assistant/MeetingBotsPanel').then(m => ({ default: m.MeetingBotsPanel })));
const ContentStudioPanel = lazy(() => import('../content/ContentStudioPanel').then(m => ({ default: m.ContentStudioPanel })));
// Layout chrome + the always-mounted nudge provider stay eager — they're small
// and needed on first paint.
import { SmartNudgeProvider } from '../nudges/SmartNudgeProvider';
import { PullToRefresh } from '../shared/PullToRefresh';
import { ContextualHeader } from './ContextualHeader';
import { MoreSheet, MoreSheetPanel } from './MoreSheet';

import { useNotifications } from '@/hooks/useNotifications';
import { useHaptics } from '@/hooks/useHaptics';
import { Task, CalendarEvent, ChatMessage, UserSettings, Project } from '@/types/flux';
import { SidebarFilter } from './Sidebar';
import { MOBILE_PRIMARY_TABS, panelLabel } from '@/config/navigation';
import doriFish from '@/assets/dori-fish.png';

interface MobileLayoutProps {
  userId: string;
  tasks: Task[];
  events: CalendarEvent[];
  sharedTasks?: Task[];
  sharedEvents?: CalendarEvent[];
  messages: ChatMessage[];
  isProcessing: boolean;
  projects?: Project[];
  onAddTask: (task: Omit<Task, 'id' | 'createdAt'>) => void;
  onToggleTaskComplete: (id: string) => void;
  onDeleteTask: (id: string) => void;
  onDeleteTasks?: (ids: string[]) => Promise<{ error: string | null }> | void;
  onUpdateTask?: (id: string, updates: Partial<Task>) => void;
  onReorderTasks?: (taskOrders: { id: string; sortOrder: number }[]) => void;
  onAddEvent: (event: Omit<CalendarEvent, 'id'>) => void;
  onUpdateEvent?: (id: string, updates: Partial<CalendarEvent>) => void;
  onDeleteEvent?: (id: string) => void;
  onImportEvents?: (events: CalendarEvent[]) => void;
  onSendMessage: (content: string) => void;
  thinkingStatus?: string;
  actionCards?: import('../assistant/ActionCard').ActionCardData[];
  doriStats?: { overdueTasks?: number; unreadEmails?: number; habitsAtRisk?: number; todayEvents?: number; pendingTasks?: number };
  onVoiceMode: () => void;
  onEditProfile?: () => void;
  onShareTask?: (id: string, title: string) => void;
  onShareEvent?: (id: string, title: string) => void;
  onSignOut?: () => void;
  settings?: UserSettings;
  onUpdateSettings?: (updates: Partial<UserSettings>) => void;
  onUpdateNotifications?: (updates: Partial<UserSettings['notifications']>) => void;
}

type Tab = 'dashboard' | 'calendar' | 'chat' | 'tasks' | 'more'
  | 'social' | 'family' | 'health' | 'contacts' | 'contracts'
  | 'notes' | 'habits' | 'islam' | 'properties' | 'startups'
  | 'news' | 'settings' | 'email'
  | 'journal' | 'finances' | 'travel' | 'assets'
  | 'personal-health' | 'relationships-plus' | 'learning' | 'cooking'
  | 'challenges' | 'location-reminders'
  | 'family-members' | 'family-calendar' | 'child-mode' | 'correlations' | 'meetings'
  | 'content' | 'content-liked' | 'content-calendar' | 'content-profile';

const panelTransition = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -6 },
  transition: { duration: 0.2, ease: 'easeOut' },
};

export function MobileLayout({
  userId,
  tasks,
  events,
  sharedTasks = [],
  sharedEvents = [],
  messages,
  isProcessing,
  projects = [],
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
  onEditProfile: _onEditProfile,
  onShareTask,
  onShareEvent,
  onSignOut: _onSignOut,
  settings,
  onUpdateSettings,
  onUpdateNotifications,
}: MobileLayoutProps) {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [filter, setFilter] = useState<SidebarFilter>('all');
  const [moreOpen, setMoreOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const { vibrate } = useHaptics();
  const {
    notifications,
    markRead,
    markAllRead,
    deleteNotification,
    clearAll,
  } = useNotifications();

  const handleTabChange = useCallback((tab: Tab) => {
    vibrate('light');
    setActiveTab(tab);
  }, [vibrate]);

  const handleDoriPress = useCallback(() => {
    vibrate('medium');
    setActiveTab('chat');
  }, [vibrate]);

  const handleMoreNavigate = useCallback((panel: MoreSheetPanel) => {
    // 'assistant' has no standalone mobile panel — it is the Dori chat view,
    // so route it there instead of falling through to a blank screen.
    setActiveTab(panel === 'assistant' ? 'chat' : (panel as Tab));
  }, []);

  // Scroll to top on panel change
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: 'instant' });
  }, [activeTab]);

  const displayTasks = filter === 'shared' ? sharedTasks : tasks;
  const displayEvents = filter === 'shared' ? sharedEvents : events;

  const primaryTabs = MOBILE_PRIMARY_TABS;

  // Always show the header so the burger menu is reachable from every tab.
  // Chat has its own internal header, so we still suppress it there.
  const showHeader = activeTab !== 'chat';
  const headerTitle = activeTab === 'chat' ? 'Dori' : panelLabel(activeTab);

  const renderPanel = () => {
    switch (activeTab) {
      case 'chat':
        return (
          <DoriPanel
            messages={messages}
            onSendMessage={onSendMessage}
            isProcessing={isProcessing}
            onVoiceMode={onVoiceMode}
            thinkingStatus={thinkingStatus}
            actionCards={actionCards}
            stats={doriStats}
          />
        );
      case 'social':
        return userId ? <TeamChatPanel userId={userId} /> : null;
      case 'calendar':
      case 'tasks':
        return (
          <CalendarHubPanel
            userId={userId}
            tasks={displayTasks}
            sharedTasks={sharedTasks}
            events={displayEvents}
            filter={filter}
            projects={projects}
            onFilterChange={setFilter}
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
            onShareTask={onShareTask}
            onShareEvent={onShareEvent}
          />
        );
      case 'settings':
        return settings && onUpdateSettings && onUpdateNotifications ? (
          <SettingsPanelContent
            settings={settings}
            onUpdateSettings={onUpdateSettings}
            onUpdateNotifications={onUpdateNotifications}
          />
        ) : null;
      case 'family':
        return <FamilyPanel />;
      case 'dashboard':
        return <DashboardPanel key={refreshKey} userId={userId} onNavigate={handleTabChange} />;
      case 'health':
        return <HealthHubPanel />;
      case 'contacts':
        return <ContactsPanel userId={userId} />;
      case 'contracts':
        return <ContractsPanel userId={userId} />;
      case 'notes':
        return <NotesPanel userId={userId} />;
      case 'habits':
        return <HabitsPanel userId={userId} />;
      case 'islam':
        return <IslamEnhancedPanel />;
      case 'properties':
        return <PropertyPanel />;
      case 'startups':
        return <StartupWorkspacePanel />;
      case 'content':
        return <ContentStudioPanel initialTab="today" />;
      case 'content-liked':
        return <ContentStudioPanel initialTab="liked" />;
      case 'content-calendar':
        return <ContentStudioPanel initialTab="calendar" />;
      case 'content-profile':
        return <ContentStudioPanel initialTab="profile" />;
      case 'news':
        return <TechNewsPanel />;
      case 'email':
        return <EmailPanel />;
      case 'cooking':
        return <CookingPanel />;
      case 'finances':
        return <FinancesPanel />;
      case 'travel':
        return <TravelPanel />;
      case 'assets':
        return <AssetsPanel />;
      case 'personal-health':
        return <PersonalHealthPanel />;
      case 'relationships-plus':
        return <RelationshipsPlusPanel />;
      case 'learning':
        return <LearningPanel />;
      case 'journal':
        return <JournalPanel />;
      case 'challenges':
        return <ChallengesPanel />;
      case 'location-reminders':
        return <LocationRemindersPanel />;
      case 'family-members':
        return <FamilyMembersList />;
      case 'family-calendar':
        return <FamilyCalendarView />;
      case 'child-mode':
        return <ChildDashboard />;
      case 'correlations':
        return <CorrelationsDashboard />;
      case 'meetings':
        return <MeetingBotsPanel />;
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col h-[100dvh] w-full bg-background overflow-hidden safe-area-top">
      {/* Contextual Header — burger menu always visible (top-right) */}
      {showHeader && (
        <ContextualHeader
          title={headerTitle}
          onOpenMenu={() => setMoreOpen(true)}
          notifications={notifications}
          onMarkRead={markRead}
          onMarkAllRead={markAllRead}
          onDeleteNotification={deleteNotification}
          onClearAll={clearAll}
        />
      )}

      {/* Content */}
      <main className="flex-1 overflow-hidden relative">
        <PullToRefresh
          onRefresh={async () => {
            setRefreshKey(k => k + 1);
            const { toast } = await import('sonner');
            toast.success('Refreshed', { duration: 1500 });
          }}
          className="h-full"
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={activeTab}
              {...panelTransition}
              ref={scrollRef}
              className="h-full overflow-y-auto"
            >
              <PanelErrorBoundary panelName={headerTitle}>
                <Suspense fallback={<PanelFallback />}>
                  {renderPanel()}
                </Suspense>
              </PanelErrorBoundary>
            </motion.div>
          </AnimatePresence>
        </PullToRefresh>
      </main>

      {/* Bottom Tab Bar with labels */}
      <nav className="border-t border-border shrink-0 bg-background/95 backdrop-blur-lg safe-area-bottom">
        <div className="h-16 flex items-center justify-around px-1">
          {primaryTabs.map((tab) => {
            const isActive = !tab.isCenter && activeTab === tab.id;
            const label = tab.label;

            return (
              <button
                key={tab.id}
                onClick={() => {
                  if (tab.isCenter) {
                    handleDoriPress();
                  } else {
                    handleTabChange(tab.id as Tab);
                  }
                }}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 w-14 h-14 rounded-xl",
                  "touch-manipulation select-none",
                  "transition-all duration-200 ease-out",
                  "active:scale-90",
                  isActive
                    ? "text-primary"
                    : !tab.isCenter ? "text-muted-foreground" : ""
                )}
              >
                {tab.isCenter ? (
                  <div className="flex flex-col items-center gap-0.5">
                    <div className={cn(
                      "w-14 h-14 -mt-6 rounded-full",
                      "bg-gradient-to-br from-primary to-accent",
                      "flex items-center justify-center",
                      "shadow-lg border-4 border-background",
                      "transition-all duration-200 ease-out",
                      "active:scale-95",
                      "overflow-hidden",
                      activeTab === 'chat'
                        ? "ring-2 ring-primary ring-offset-2 ring-offset-background shadow-primary/50"
                        : "shadow-primary/30 animate-pulse-glow"
                    )}>
                      <img src={doriFish} alt="Dori" className="w-9 h-9 object-contain" />
                    </div>
                    <span className="text-[10px] leading-none font-medium text-muted-foreground">Dori</span>
                  </div>
                ) : (
                  <>
                    <div className="relative p-1 rounded-lg transition-all duration-200">
                      {tab.icon && <tab.icon className={cn(
                        "w-[18px] h-[18px] transition-transform duration-200",
                        isActive && "scale-110"
                      )} />}
                      {isActive && (
                        <motion.div
                          layoutId="mobile-tab-indicator"
                          className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-4 h-0.5 rounded-full bg-primary"
                          transition={{ type: "spring", stiffness: 500, damping: 30 }}
                        />
                      )}
                    </div>
                    <span className={cn(
                      "text-[10px] leading-none font-medium",
                      isActive ? "text-primary" : "text-muted-foreground"
                    )}>
                      {label}
                    </span>
                  </>
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {/* More Sheet */}
      <MoreSheet
        open={moreOpen}
        onOpenChange={setMoreOpen}
        onNavigate={handleMoreNavigate}
        activePanel={activeTab}
      />

      {/* ADHD Support Overlays */}
      <SmartNudgeProvider tasks={tasks} events={events} />
    </div>
  );
}
