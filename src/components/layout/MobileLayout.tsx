import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { DoriPanel } from '../assistant/DoriPanel';
import { ChatPanel } from '../chat/ChatPanel';
import { TeamChatPanel } from '../chat/TeamChatPanel';
import { CalendarHubPanel } from '../calendar/CalendarHubPanel';
import { NotificationCenter } from '../notifications/NotificationCenter';
import { SettingsPanelContent } from '../settings/SettingsPanelContent';
import { CookingPanel } from '../cooking/CookingPanel';
import { DashboardPanel } from '../dashboard/DashboardPanel';
import { HealthHubPanel } from '../health/HealthHubPanel';
import { ContactsPanel } from '../contacts/ContactsPanel';
import { ContractsPanel } from '../contracts/ContractsPanel';
import { NotesPanel } from '../notes/NotesPanel';
import { HabitsPanel } from '../habits/HabitsPanel';
import { IslamPanel } from '../islam/IslamPanel';
import { IslamEnhancedPanel } from '../islam/IslamEnhancedPanel';
import { PropertyPanel } from '../property/PropertyPanel';
import { StartupWorkspacePanel } from '../startup/StartupWorkspacePanel';
import { TechNewsPanel } from '../news/TechNewsPanel';
import { SmartNudgeProvider } from '../nudges/SmartNudgeProvider';

import { useNotifications } from '@/hooks/useNotifications';
import { useLanguage } from '@/contexts/LanguageContext';
import { useHaptics } from '@/hooks/useHaptics';
import { Task, CalendarEvent, ChatMessage, UserSettings, Project } from '@/types/flux';
import { SidebarFilter } from './Sidebar';
import { 
  Menu, 
  MessageCircle,
  Calendar, 
  Settings,
  LogOut,
  Sparkles,
  LayoutDashboard,
  Briefcase,
  User,
  Users,
  StickyNote,
  Flame,
  BookUser,
  FileText,
  Heart,
  Moon,
  Building2,
  Newspaper,
  Utensils
} from 'lucide-react';
import { DoriNotificationIcon } from '@/components/assistant/DoriNotificationIcon';

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

type Tab = 'chat' | 'social' | 'calendar' | 'settings' | 'family' | 'dashboard' | 'health' | 'contacts' | 'contracts' | 'notes' | 'habits' | 'islam' | 'properties' | 'startups' | 'news';

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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeWorkspace, setActiveWorkspace] = useState<string>('all');
  
  const { t } = useLanguage();
  const { vibrate } = useHaptics();
  const { 
    notifications, 
    markRead, 
    markAllRead, 
    deleteNotification, 
    clearAll 
  } = useNotifications();

  const handleTabChange = useCallback((tab: Tab) => {
    vibrate('light');
    setActiveTab(tab);
  }, [vibrate]);

  const handleDoriPress = useCallback(() => {
    vibrate('medium');
    onVoiceMode();
  }, [vibrate, onVoiceMode]);

  // Get tasks/events based on current filter
  const displayTasks = filter === 'shared' ? sharedTasks : tasks;
  const displayEvents = filter === 'shared' ? sharedEvents : events;

  // Bottom nav: Notes, Calendar, Cooking, Dori (center), Health, Islam, Social
  const bottomTabs = [
    { id: 'notes' as Tab, icon: StickyNote },
    { id: 'calendar' as Tab, icon: Calendar },
    { id: 'family' as Tab, icon: Utensils }, // Changed to Cooking icon
    { id: 'dori' as const, icon: Sparkles, isCenter: true },
    { id: 'health' as Tab, icon: Heart },
    { id: 'islam' as Tab, icon: Moon },
    { id: 'social' as Tab, icon: MessageCircle },
  ];

  const navItems: { icon: typeof LayoutDashboard; label: string; filter: SidebarFilter | 'family' }[] = [
    { icon: LayoutDashboard, label: 'All Tasks', filter: 'all' },
    { icon: Briefcase, label: 'Business', filter: 'business' },
    { icon: User, label: 'Personal', filter: 'personal' },
    { icon: Users, label: 'Shared with me', filter: 'shared' },
  ];

  // Workspace task counts
  const workspaceTaskCounts: Record<string, number> = {
    all: tasks.filter(t => !t.completed).length,
    family: tasks.filter(t => !t.completed && t.category === 'personal').length,
    work: tasks.filter(t => !t.completed && t.category === 'business').length,
    personal: tasks.filter(t => !t.completed && !t.projectId).length,
  };

  return (
    <div className="flex flex-col h-[100dvh] w-full bg-background overflow-hidden safe-area-top">
      {/* Header - Enhanced with blur */}
      <header className="h-14 px-4 flex items-center justify-between border-b border-border bg-background/95 backdrop-blur-lg shrink-0 sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="shrink-0 touch-target">
                <Menu className="w-5 h-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0 pt-[env(safe-area-inset-top)]">
              <div className="flex flex-col h-full">
                {/* Logo */}
                <div className="h-16 flex items-center px-4 border-b border-border">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/20">
                      <Sparkles className="w-5 h-5 text-primary-foreground" />
                    </div>
                    <span className="font-semibold text-lg">DarAI</span>
                  </div>
                </div>

                {/* Navigation */}
                <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
                  {/* Main section label */}
                  <span className="text-xs font-medium text-muted-foreground px-3 py-1.5 block">{t('nav.main')}</span>
                  
                  {/* Dashboard */}
                  <Button
                    variant={activeTab === 'dashboard' ? 'secondary' : 'ghost'}
                    className="w-full justify-start gap-3"
                    onClick={() => {
                      setActiveTab('dashboard');
                      setSidebarOpen(false);
                    }}
                  >
                    <LayoutDashboard className="w-5 h-5 shrink-0" />
                    <span>{t('nav.dashboard')}</span>
                  </Button>

                  {/* Dori AI Assistant */}
                  <Button
                    variant={activeTab === 'chat' ? 'secondary' : 'ghost'}
                    className="w-full justify-start gap-3"
                    onClick={() => {
                      setActiveTab('chat');
                      setSidebarOpen(false);
                    }}
                  >
                    <Sparkles className="w-5 h-5 shrink-0" />
                    <span>{t('nav.dori')}</span>
                  </Button>

                  {/* Calendar (includes Focus & Tasks) */}
                  <Button
                    variant={activeTab === 'calendar' ? 'secondary' : 'ghost'}
                    className="w-full justify-start gap-3"
                    onClick={() => {
                      setActiveTab('calendar');
                      setSidebarOpen(false);
                    }}
                  >
                    <Calendar className="w-5 h-5 shrink-0" />
                    <span>{t('nav.calendar')}</span>
                  </Button>

                  {/* Social (Chat + Calls) */}
                  <Button
                    variant={activeTab === 'social' ? 'secondary' : 'ghost'}
                    className="w-full justify-start gap-3"
                    onClick={() => {
                      setActiveTab('social');
                      setSidebarOpen(false);
                    }}
                  >
                    <MessageCircle className="w-5 h-5 shrink-0" />
                    <span>{t('nav.social')}</span>
                  </Button>

                  {/* Cooking */}
                  <Button
                    variant={activeTab === 'family' ? 'secondary' : 'ghost'}
                    className="w-full justify-start gap-3"
                    onClick={() => {
                      setActiveTab('family');
                      setSidebarOpen(false);
                    }}
                  >
                    <Utensils className="w-5 h-5 shrink-0" />
                    <span>{t('nav.cooking')}</span>
                  </Button>

                  {/* Islam */}
                  <Button
                    variant={activeTab === 'islam' ? 'secondary' : 'ghost'}
                    className="w-full justify-start gap-3"
                    onClick={() => {
                      setActiveTab('islam');
                      setSidebarOpen(false);
                    }}
                  >
                    <Moon className="w-5 h-5 shrink-0" />
                    <span>{t('nav.islam')}</span>
                  </Button>

                  {/* Properties */}
                  <Button
                    variant={activeTab === 'properties' ? 'secondary' : 'ghost'}
                    className="w-full justify-start gap-3"
                    onClick={() => {
                      setActiveTab('properties');
                      setSidebarOpen(false);
                    }}
                  >
                    <Building2 className="w-5 h-5 shrink-0" />
                    <span>{t('nav.properties')}</span>
                  </Button>

                  {/* Startups */}
                  <Button
                    variant={activeTab === 'startups' ? 'secondary' : 'ghost'}
                    className="w-full justify-start gap-3"
                    onClick={() => {
                      setActiveTab('startups');
                      setSidebarOpen(false);
                    }}
                  >
                    <Briefcase className="w-5 h-5 shrink-0" />
                    <span>{t('nav.startups')}</span>
                  </Button>

                  {/* Tech News */}
                  <Button
                    variant={activeTab === 'news' ? 'secondary' : 'ghost'}
                    className="w-full justify-start gap-3"
                    onClick={() => {
                      setActiveTab('news');
                      setSidebarOpen(false);
                    }}
                  >
                    <Newspaper className="w-5 h-5 shrink-0" />
                    <span>{t('nav.news')}</span>
                  </Button>

                  {/* Productivity section */}
                  <span className="text-xs font-medium text-muted-foreground px-3 py-1.5 block mt-4">{t('nav.productivity')}</span>

                  {/* Notes */}
                  <Button
                    variant={activeTab === 'notes' ? 'secondary' : 'ghost'}
                    className="w-full justify-start gap-3"
                    onClick={() => {
                      setActiveTab('notes');
                      setSidebarOpen(false);
                    }}
                  >
                    <StickyNote className="w-5 h-5 shrink-0" />
                    <span>{t('nav.notes')}</span>
                  </Button>

                  {/* Habits */}
                  <Button
                    variant={activeTab === 'habits' ? 'secondary' : 'ghost'}
                    className="w-full justify-start gap-3"
                    onClick={() => {
                      setActiveTab('habits');
                      setSidebarOpen(false);
                    }}
                  >
                    <Flame className="w-5 h-5 shrink-0" />
                    <span>{t('nav.habits')}</span>
                  </Button>

                  {/* Contacts */}
                  <Button
                    variant={activeTab === 'contacts' ? 'secondary' : 'ghost'}
                    className="w-full justify-start gap-3"
                    onClick={() => {
                      setActiveTab('contacts');
                      setSidebarOpen(false);
                    }}
                  >
                    <BookUser className="w-5 h-5 shrink-0" />
                    <span>{t('nav.contacts')}</span>
                  </Button>

                  {/* Contracts */}
                  <Button
                    variant={activeTab === 'contracts' ? 'secondary' : 'ghost'}
                    className="w-full justify-start gap-3"
                    onClick={() => {
                      setActiveTab('contracts');
                      setSidebarOpen(false);
                    }}
                  >
                    <FileText className="w-5 h-5 shrink-0" />
                    <span>{t('nav.contracts')}</span>
                  </Button>
                </nav>

                {/* Bottom Actions */}
                <div className="p-3 border-t border-border space-y-1">
                  <Button
                    variant={activeTab === 'settings' ? 'secondary' : 'ghost'}
                    className="w-full justify-start gap-3"
                    onClick={() => {
                      setActiveTab('settings');
                      setSidebarOpen(false);
                    }}
                  >
                    <Settings className="w-5 h-5 shrink-0" />
                    <span>{t('nav.settings')}</span>
                  </Button>

                  {onSignOut && (
                    <Button
                      variant="ghost"
                      className="w-full justify-start gap-3 text-muted-foreground hover:text-destructive"
                      onClick={() => {
                        onSignOut();
                        setSidebarOpen(false);
                      }}
                    >
                      <LogOut className="w-5 h-5 shrink-0" />
                      <span>{t('nav.signOut')}</span>
                    </Button>
                  )}
                </div>
              </div>
            </SheetContent>
          </Sheet>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/20">
              <Sparkles className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-semibold">DarAI</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <DoriNotificationIcon />
          <NotificationCenter
            notifications={notifications}
            onMarkRead={markRead}
            onMarkAllRead={markAllRead}
            onDelete={deleteNotification}
            onClearAll={clearAll}
          />
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-hidden relative">
        <div className={cn(
          "h-full",
          activeTab === 'chat' ? 'block' : 'hidden'
        )}>
          <DoriPanel 
            messages={messages}
            onSendMessage={onSendMessage}
            isProcessing={isProcessing}
            onVoiceMode={onVoiceMode}
          />
        </div>
        <div className={cn(
          "h-full",
          activeTab === 'social' ? 'block' : 'hidden'
        )}>
          {userId && <TeamChatPanel userId={userId} />}
        </div>
        <div className={cn(
          "h-full",
          activeTab === 'calendar' ? 'block' : 'hidden'
        )}>
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
        </div>
        {activeTab === 'settings' && settings && onUpdateSettings && onUpdateNotifications && (
          <div className="h-full">
            <SettingsPanelContent
              settings={settings}
              onUpdateSettings={onUpdateSettings}
              onUpdateNotifications={onUpdateNotifications}
            />
          </div>
        )}
        <div className={cn(
          "h-full",
          activeTab === 'family' ? 'block' : 'hidden'
        )}>
          <CookingPanel />
        </div>
        <div className={cn(
          "h-full overflow-y-auto",
          activeTab === 'dashboard' ? 'block' : 'hidden'
        )}>
          <DashboardPanel userId={userId} />
        </div>
        <div className={cn(
          "h-full",
          activeTab === 'health' ? 'block' : 'hidden'
        )}>
          <HealthHubPanel />
        </div>
        <div className={cn(
          "h-full overflow-y-auto",
          activeTab === 'contacts' ? 'block' : 'hidden'
        )}>
          <ContactsPanel userId={userId} />
        </div>
        <div className={cn(
          "h-full overflow-y-auto",
          activeTab === 'contracts' ? 'block' : 'hidden'
        )}>
          <ContractsPanel userId={userId} />
        </div>
        <div className={cn(
          "h-full overflow-y-auto",
          activeTab === 'notes' ? 'block' : 'hidden'
        )}>
          <NotesPanel userId={userId} />
        </div>
        <div className={cn(
          "h-full overflow-y-auto",
          activeTab === 'habits' ? 'block' : 'hidden'
        )}>
          <HabitsPanel userId={userId} />
        </div>
        <div className={cn(
          "h-full overflow-y-auto",
          activeTab === 'islam' ? 'block' : 'hidden'
        )}>
          <IslamEnhancedPanel />
        </div>
        <div className={cn(
          "h-full overflow-y-auto",
          activeTab === 'properties' ? 'block' : 'hidden'
        )}>
          <PropertyPanel />
        </div>
        <div className={cn(
          "h-full overflow-y-auto",
          activeTab === 'startups' ? 'block' : 'hidden'
        )}>
          <StartupWorkspacePanel />
        </div>
        <div className={cn(
          "h-full overflow-y-auto",
          activeTab === 'news' ? 'block' : 'hidden'
        )}>
          <TechNewsPanel />
        </div>

      </main>

      {/* Bottom Tab Bar - Enhanced Mobile UX */}
      <nav className="border-t border-border shrink-0 bg-background/95 backdrop-blur-lg safe-area-bottom">
        <div className="h-16 flex items-center justify-around px-1">
          {bottomTabs.map((tab) => {
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
                  tab.isCenter ? "" : "relative",
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
                  <>
                    <div className={cn(
                      "relative p-1.5 rounded-lg transition-all duration-200",
                      isActive && "bg-primary/10"
                    )}>
                      <tab.icon className={cn(
                        "w-5 h-5 transition-transform duration-200",
                        isActive && "scale-110"
                      )} />
                      {isActive && (
                        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />
                      )}
                    </div>
                  </>
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {/* ADHD Support Overlays */}
      <SmartNudgeProvider tasks={tasks} events={events} />
    </div>
  );
}
