import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { ChatPanel } from '../chat/ChatPanel';
import { TeamChatPanel } from '../chat/TeamChatPanel';
import { TaskList } from '../tasks/TaskList';
import { CalendarPanel } from '../calendar/CalendarPanel';
import { TodayFocusView } from '../focus/TodayFocusView';
import { WorkspaceTabs } from '../workspace/WorkspaceTabs';
import { NotificationCenter } from '../notifications/NotificationCenter';
import { SettingsPanelContent } from '../settings/SettingsPanelContent';
import { VoiceQuickAdd } from '../tasks/VoiceQuickAdd';
import { FamilyPanel } from '../family/FamilyPanel';
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
  Home
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

type Tab = 'chat' | 'messages' | 'tasks' | 'calendar' | 'focus' | 'settings' | 'family';

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

  const tabs = [
    { id: 'chat' as Tab, icon: Sparkles, label: 'Assistant' },
    { id: 'messages' as Tab, icon: MessageCircle, label: 'Friends' },
    { id: 'tasks' as Tab, icon: CheckSquare, label: 'Tasks' },
    { id: 'calendar' as Tab, icon: Calendar, label: 'Calendar' },
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
    <div className="flex flex-col h-screen w-full bg-background">
      {/* Header */}
      <header className="h-14 px-4 flex items-center justify-between border-b border-border bg-background shrink-0">
        <div className="flex items-center gap-3">
          <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="shrink-0">
                <Menu className="w-5 h-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0">
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
                <nav className="flex-1 p-3 space-y-1">
                  {navItems.map((item) => (
                    <Button
                      key={item.filter}
                      variant={filter === item.filter && activeTab === 'tasks' ? 'secondary' : 'ghost'}
                      className="w-full justify-start gap-3"
                      onClick={() => {
                        setFilter(item.filter as SidebarFilter);
                        setActiveTab('tasks');
                        setSidebarOpen(false);
                      }}
                    >
                      <item.icon className="w-5 h-5 shrink-0" />
                      <span>{item.label}</span>
                    </Button>
                  ))}
                  
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

      {/* Workspace Tabs */}
      <div className="px-3 py-2 border-b border-border">
        <WorkspaceTabs
          activeWorkspace={activeWorkspace}
          onWorkspaceChange={setActiveWorkspace}
          workspaceTaskCounts={workspaceTaskCounts}
        />
      </div>

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
          activeTab === 'focus' ? 'block' : 'hidden'
        )}>
          <TodayFocusView
            tasks={tasks}
            events={events}
            onToggleComplete={onToggleTaskComplete}
            onClose={() => setActiveTab('tasks')}
          />
        </div>
        <div className={cn(
          "h-full",
          activeTab === 'tasks' ? 'block' : 'hidden'
        )}>
          <TaskList
            tasks={displayTasks}
            filter={filter}
            onToggleComplete={onToggleTaskComplete}
            onDeleteTask={onDeleteTask}
            onDeleteTasks={onDeleteTasks}
            onAddTask={onAddTask}
            onUpdateTask={onUpdateTask}
            onReorderTasks={onReorderTasks}
            onShareTask={onShareTask}
          />
        </div>
        <div className={cn(
          "h-full",
          activeTab === 'calendar' ? 'block' : 'hidden'
        )}>
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

        {/* Voice Quick Add FAB */}
        <div className="absolute bottom-4 right-4 z-10">
          <VoiceQuickAdd onVoiceCommand={onSendMessage} />
        </div>
      </main>

      {/* Bottom Tab Bar */}
      <nav className="h-16 border-t border-border bg-background flex items-center justify-around shrink-0 safe-area-bottom">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-colors",
              activeTab === tab.id 
                ? "text-primary" 
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <tab.icon className="w-5 h-5" />
            <span className="text-xs font-medium">{tab.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
