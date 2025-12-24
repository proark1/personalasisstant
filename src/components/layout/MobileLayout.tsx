import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { ChatPanel } from '../chat/ChatPanel';
import { TeamChatPanel } from '../chat/TeamChatPanel';
import { CalendarHubPanel } from '../calendar/CalendarHubPanel';
import { NotificationCenter } from '../notifications/NotificationCenter';
import { SettingsPanelContent } from '../settings/SettingsPanelContent';
import { FamilyPanel } from '../family/FamilyPanel';
import { DashboardPanel } from '../dashboard/DashboardPanel';
import { HealthHubPanel } from '../health/HealthHubPanel';
import { SmartNudgeProvider } from '../nudges/SmartNudgeProvider';
import { BrainDumpFAB } from '../capture/BrainDumpFAB';
import { useNotifications } from '@/hooks/useNotifications';
import { Task, CalendarEvent, ChatMessage, UserSettings } from '@/types/flux';
import { SidebarFilter } from './Sidebar';
import { 
  Menu, 
  MessageSquare, 
  MessageCircle,
  CheckSquare, 
  Calendar, 
  Mic,
  Settings,
  LogOut,
  UserCircle,
  Sparkles,
  LayoutDashboard,
  Briefcase,
  User,
  Users,
  Target,
  Home,
  Phone,
  StickyNote,
  Flame,
  BookUser,
  FileText,
  Search,
  CalendarCheck,
  Zap,
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

type Tab = 'chat' | 'messages' | 'calendar' | 'settings' | 'family' | 'dashboard' | 'health';

export function MobileLayout({
  userId,
  tasks,
  events,
  sharedTasks = [],
  sharedEvents = [],
  messages,
  isProcessing,
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

  // Bottom nav: Calendar, Family, Assistant (center), Health, Friends
  const bottomTabs = [
    { id: 'calendar' as Tab, icon: Calendar },
    { id: 'family' as Tab, icon: Home },
    { id: 'assistant' as const, icon: Mic, isCenter: true },
    { id: 'health' as Tab, icon: Heart },
    { id: 'messages' as Tab, icon: MessageCircle },
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
                  
                  {/* AI Assistant */}
                  <Button
                    variant={activeTab === 'chat' ? 'secondary' : 'ghost'}
                    className="w-full justify-start gap-3"
                    onClick={() => {
                      setActiveTab('chat');
                      setSidebarOpen(false);
                    }}
                  >
                    <Sparkles className="w-5 h-5 shrink-0" />
                    <span>AI Assistant</span>
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

                  {/* Friends/Chat */}
                  <Button
                    variant={activeTab === 'messages' ? 'secondary' : 'ghost'}
                    className="w-full justify-start gap-3"
                    onClick={() => {
                      setActiveTab('messages');
                      setSidebarOpen(false);
                    }}
                  >
                    <MessageCircle className="w-5 h-5 shrink-0" />
                    <span>Friends</span>
                  </Button>

                  {/* Dashboard */}
                  <Button
                    variant="ghost"
                    className="w-full justify-start gap-3"
                    onClick={() => {
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

                  {/* Productivity section */}
                  <span className="text-xs font-medium text-muted-foreground px-3 py-1.5 block mt-4">Productivity</span>

                  {/* Notes */}
                  <Button
                    variant="ghost"
                    className="w-full justify-start gap-3"
                    onClick={() => {
                      setSidebarOpen(false);
                    }}
                  >
                    <StickyNote className="w-5 h-5 shrink-0" />
                    <span>Notes</span>
                  </Button>

                  {/* Habits */}
                  <Button
                    variant="ghost"
                    className="w-full justify-start gap-3"
                    onClick={() => {
                      setSidebarOpen(false);
                    }}
                  >
                    <Flame className="w-5 h-5 shrink-0" />
                    <span>Habits</span>
                  </Button>

                  {/* Contacts */}
                  <Button
                    variant="ghost"
                    className="w-full justify-start gap-3"
                    onClick={() => {
                      setSidebarOpen(false);
                    }}
                  >
                    <BookUser className="w-5 h-5 shrink-0" />
                    <span>Contacts</span>
                  </Button>

                  {/* Contracts */}
                  <Button
                    variant="ghost"
                    className="w-full justify-start gap-3"
                    onClick={() => {
                      setSidebarOpen(false);
                    }}
                  >
                    <FileText className="w-5 h-5 shrink-0" />
                    <span>Contracts</span>
                  </Button>
                </nav>

                {/* Bottom Actions */}
                <div className="p-3 border-t border-border space-y-1">
                  {onEditProfile && (
                    <Button
                      variant="ghost"
                      className="w-full justify-start gap-3"
                      onClick={() => {
                        onEditProfile();
                        setSidebarOpen(false);
                      }}
                    >
                      <UserCircle className="w-5 h-5 shrink-0" />
                      <span>Edit Profile</span>
                    </Button>
                  )}
                  
                  <Button
                    variant="ghost"
                    className="w-full justify-start gap-3"
                    onClick={() => {
                      setActiveTab('settings');
                      setSidebarOpen(false);
                    }}
                  >
                    <Settings className="w-5 h-5 shrink-0" />
                    <span>Settings</span>
                  </Button>
                  
                  <Button
                    variant="voice_mode"
                    className="w-full justify-start gap-3"
                    onClick={() => {
                      onVoiceMode();
                      setSidebarOpen(false);
                    }}
                  >
                    <Mic className="w-5 h-5 shrink-0" />
                    <span>Voice Mode</span>
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
          <ChatPanel 
            messages={messages}
            onSendMessage={onSendMessage}
            isProcessing={isProcessing}
          />
        </div>
        <div className={cn(
          "h-full",
          activeTab === 'messages' ? 'block' : 'hidden'
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

      </main>

      {/* Bottom Tab Bar */}
      <nav className="border-t border-border bg-background shrink-0" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="h-14 flex items-center justify-around px-2">
          {bottomTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => tab.isCenter ? onVoiceMode() : setActiveTab(tab.id as Tab)}
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
                  <Mic className="w-5 h-5 text-primary-foreground" />
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
      <BrainDumpFAB />
    </div>
  );
}
