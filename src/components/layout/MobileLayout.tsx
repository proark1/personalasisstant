import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { DoriPanel } from '../assistant/DoriPanel';
import { ChatPanel } from '../chat/ChatPanel';
import { TeamChatPanel } from '../chat/TeamChatPanel';
import { CalendarHubPanel } from '../calendar/CalendarHubPanel';
import { NotificationCenter } from '../notifications/NotificationCenter';
import { SettingsPanelContent } from '../settings/SettingsPanelContent';
import { FamilyPanel } from '../family/FamilyPanel';
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
  Home,
  StickyNote,
  Flame,
  BookUser,
  FileText,
  Heart,
  Moon,
  Building2,
  Newspaper
} from 'lucide-react';
import { BrainDumpFAB } from '@/components/capture/BrainDumpFAB';

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
  const [activeTab, setActiveTab] = useState<Tab>('chat');
  const [filter, setFilter] = useState<SidebarFilter>('all');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeWorkspace, setActiveWorkspace] = useState<string>('all');
  
  const { 
    notifications, 
    markRead, 
    markAllRead, 
    deleteNotification, 
    clearAll 
  } = useNotifications();

  // Get tasks/events based on current filter
  const displayTasks = filter === 'shared' ? sharedTasks : tasks;
  const displayEvents = filter === 'shared' ? sharedEvents : events;

  // Bottom nav: Calendar, Family, Dori (center), Islam, Social
  const bottomTabs = [
    { id: 'calendar' as Tab, icon: Calendar },
    { id: 'family' as Tab, icon: Home },
    { id: 'dori' as const, icon: Sparkles, isCenter: true },
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
    <div className="flex flex-col h-[100dvh] w-full bg-background overflow-hidden">
      {/* Safe area top spacer */}
      <div className="bg-background shrink-0" style={{ height: 'max(env(safe-area-inset-top), 8px)' }} />
      {/* Header */}
      <header className="h-14 px-4 flex items-center justify-between border-b border-border bg-background shrink-0">
        <div className="flex items-center gap-3">
          <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="shrink-0">
                <Menu className="w-5 h-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0 pt-[env(safe-area-inset-top)]">
              <div className="flex flex-col h-full">
                {/* Logo */}
                <div className="h-16 flex items-center px-4 border-b border-border">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                      <Sparkles className="w-5 h-5 text-primary-foreground" />
                    </div>
                    <span className="font-semibold text-lg">DarAI</span>
                  </div>
                </div>

                {/* Navigation */}
                <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
                  {/* Main section label */}
                  <span className="text-xs font-medium text-muted-foreground px-3 py-1.5 block">Main</span>
                  
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
                    <span>Dori</span>
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
                    <span>Calendar</span>
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
                    <span>Social</span>
                  </Button>

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
                    <span>Dashboard</span>
                  </Button>

                  {/* Family Hub */}
                  <Button
                    variant={activeTab === 'family' ? 'secondary' : 'ghost'}
                    className="w-full justify-start gap-3"
                    onClick={() => {
                      setActiveTab('family');
                      setSidebarOpen(false);
                    }}
                  >
                    <Home className="w-5 h-5 shrink-0" />
                    <span>Family Hub</span>
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
                    <span>Islam</span>
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
                    <span>Properties</span>
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
                    <span>Startups</span>
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
                    <span>Tech News</span>
                  </Button>

                  {/* Productivity section */}
                  <span className="text-xs font-medium text-muted-foreground px-3 py-1.5 block mt-4">Productivity</span>

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
                    <span>Notes</span>
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
                    <span>Habits</span>
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
                    <span>Contacts</span>
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
                    <span>Contracts</span>
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
                    <span>Settings</span>
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
                      <span>Sign Out</span>
                    </Button>
                  )}
                </div>
              </div>
            </SheetContent>
          </Sheet>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-semibold">DarAI</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <BrainDumpFAB className="static bottom-auto right-auto" collapsed={true} />
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
          <FamilyPanel />
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

      {/* Bottom Tab Bar */}
      <nav className="border-t border-border bg-background shrink-0" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="h-14 flex items-center justify-around px-2">
          {bottomTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => tab.isCenter ? setActiveTab('chat') : setActiveTab(tab.id as Tab)}
              className={cn(
                "flex items-center justify-center w-12 h-12",
                tab.isCenter ? "" : "",
                !tab.isCenter && activeTab === tab.id 
                  ? "text-primary" 
                  : !tab.isCenter ? "text-muted-foreground hover:text-foreground" : ""
              )}
            >
              {tab.isCenter ? (
                <div className="w-12 h-12 -mt-4 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg border-4 border-background">
                  <Sparkles className="w-5 h-5 text-primary-foreground" />
                </div>
              ) : (
                <tab.icon className="w-6 h-6" />
              )}
            </button>
          ))}
        </div>
      </nav>

      {/* ADHD Support Overlays */}
      <SmartNudgeProvider tasks={tasks} events={events} />
    </div>
  );
}
