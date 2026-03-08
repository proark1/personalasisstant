import { useState, useCallback, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { DoriPanel } from '../assistant/DoriPanel';
import { ChatPanel } from '../chat/ChatPanel';
import { TeamChatPanel } from '../chat/TeamChatPanel';
import { CalendarHubPanel } from '../calendar/CalendarHubPanel';
import { SettingsPanelContent } from '../settings/SettingsPanelContent';
import { CookingPanel } from '../cooking/CookingPanel';
import { DashboardPanel } from '../dashboard/DashboardPanel';
import { HealthHubPanel } from '../health/HealthHubPanel';
import { ContactsPanel } from '../contacts/ContactsPanel';
import { ContractsPanel } from '../contracts/ContractsPanel';
import { NotesPanel } from '../notes/NotesPanel';
import { HabitsPanel } from '../habits/HabitsPanel';
import { IslamEnhancedPanel } from '../islam/IslamEnhancedPanel';
import { PropertyPanel } from '../property/PropertyPanel';
import { StartupWorkspacePanel } from '../startup/StartupWorkspacePanel';
import { TechNewsPanel } from '../news/TechNewsPanel';
import { SmartNudgeProvider } from '../nudges/SmartNudgeProvider';
import { EmailPanel } from '../email/EmailPanel';
import { PullToRefresh } from '../shared/PullToRefresh';
import { ContextualHeader } from './ContextualHeader';
import { MoreSheet, MoreSheetPanel } from './MoreSheet';

import { useNotifications } from '@/hooks/useNotifications';
import { useLanguage } from '@/contexts/LanguageContext';
import { useHaptics } from '@/hooks/useHaptics';
import { Task, CalendarEvent, ChatMessage, UserSettings, Project } from '@/types/flux';
import { SidebarFilter } from './Sidebar';
import {
  LayoutDashboard,
  Calendar,
  Sparkles,
  Mail,
  Heart,
} from 'lucide-react';

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
  | 'news' | 'settings' | 'email';

const tabTitles: Record<string, string> = {
  dashboard: 'Dashboard',
  calendar: 'Calendar',
  chat: 'Dori AI',
  tasks: 'Tasks',
  social: 'Social',
  family: 'Cooking',
  health: 'Health',
  contacts: 'Contacts',
  contracts: 'Contracts',
  notes: 'Notes',
  habits: 'Habits',
  islam: 'Islam',
  properties: 'Properties',
  startups: 'Startups',
  news: 'Tech News',
  settings: 'Settings',
  email: 'Email',
};

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
  onVoiceMode,
  onEditProfile,
  onShareTask,
  onShareEvent,
  onSignOut,
  settings,
  onUpdateSettings,
  onUpdateNotifications,
}: MobileLayoutProps) {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [filter, setFilter] = useState<SidebarFilter>('all');
  const [moreOpen, setMoreOpen] = useState(false);

  const { t } = useLanguage();
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
    setActiveTab(panel as Tab);
  }, []);

  // Scroll to top on panel change
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: 'instant' });
  }, [activeTab]);

  const displayTasks = filter === 'shared' ? sharedTasks : tasks;
  const displayEvents = filter === 'shared' ? sharedEvents : events;

  const primaryTabs = [
    { id: 'dashboard' as const, icon: LayoutDashboard },
    { id: 'calendar' as const, icon: Calendar },
    { id: 'dori' as const, icon: Sparkles, isCenter: true },
    { id: 'email' as const, icon: Mail },
    { id: 'health' as const, icon: Heart },
  ];

  // Determine header title
  const headerTitle = t(`nav.${activeTab}`) || tabTitles[activeTab] || 'DarAI';

  const renderPanel = () => {
    switch (activeTab) {
      case 'chat':
        return (
          <DoriPanel
            messages={messages}
            onSendMessage={onSendMessage}
            isProcessing={isProcessing}
            onVoiceMode={onVoiceMode}
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
        return <CookingPanel />;
      case 'dashboard':
        return <DashboardPanel userId={userId} />;
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
      case 'news':
        return <TechNewsPanel />;
      case 'email':
        return <EmailPanel />;
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col h-[100dvh] w-full bg-background overflow-hidden safe-area-top">
      {/* Contextual Header */}
      <ContextualHeader
        title={headerTitle}
        onOpenMenu={() => setMoreOpen(true)}
        notifications={notifications}
        onMarkRead={markRead}
        onMarkAllRead={markAllRead}
        onDeleteNotification={deleteNotification}
        onClearAll={clearAll}
      />

      {/* Content with AnimatePresence transitions */}
      <main className="flex-1 overflow-hidden relative">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={activeTab}
            {...panelTransition}
            ref={scrollRef}
            className="h-full overflow-y-auto"
          >
            {renderPanel()}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Bottom Tab Bar - 5 items */}
      <nav className="border-t border-border shrink-0 bg-background/95 backdrop-blur-lg safe-area-bottom">
        <div className="h-16 flex items-center justify-around px-1">
          {primaryTabs.map((tab) => {
            const isActive = !tab.isCenter && activeTab === tab.id;

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
                  <div className={cn(
                    "w-14 h-14 -mt-6 rounded-full bg-gradient-to-br from-primary to-accent",
                    "flex items-center justify-center",
                    "shadow-lg shadow-primary/30 border-4 border-background",
                    "transition-all duration-200 ease-out",
                    "active:scale-95 active:shadow-primary/50",
                    "animate-pulse-glow"
                  )}>
                    <Sparkles className="w-6 h-6 text-primary-foreground" />
                  </div>
                ) : (
                  <div className="relative p-1.5 rounded-lg transition-all duration-200">
                    <tab.icon className={cn(
                      "w-5 h-5 transition-transform duration-200",
                      isActive && "scale-110"
                    )} />
                    {isActive && (
                      <motion.div
                        layoutId="mobile-tab-indicator"
                        className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-5 h-0.5 rounded-full bg-primary"
                        transition={{ type: "spring", stiffness: 500, damping: 30 }}
                      />
                    )}
                  </div>
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
