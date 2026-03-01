import { useState, useEffect, useMemo, Suspense, lazy } from 'react';
import { Sidebar, SidebarFilter, ActivePanel } from './Sidebar';
import { MobileLayout } from './MobileLayout';
import { RealtimeNotificationCenter } from '../notifications/RealtimeNotificationCenter';
import { useAuth } from '@/hooks/useAuth';
import { Task, CalendarEvent, ChatMessage, Project, UserSettings } from '@/types/flux';
import { useIsMobile } from '@/hooks/use-mobile';
import { useLanguage } from '@/contexts/LanguageContext';
import { useCelebration } from '@/hooks/useCelebration';
import { Button } from '@/components/ui/button';
import { List, Grid3X3, X, LayoutGrid, Activity } from 'lucide-react';
import { PanelFallback } from '@/components/lazy/LazyLoader';
import { ContextualHeader } from './ContextualHeader';
import type { ActivityItem } from '@/hooks/useActivityFeed';
import type { SearchResult, SearchFilters } from '@/hooks/useGlobalSearch';
import type { Contact } from '@/hooks/useContacts';

// Lazy load feature panels for code splitting
const ChatPanel = lazy(() => import('../chat/ChatPanel').then(m => ({ default: m.ChatPanel })));
const TeamChatPanel = lazy(() => import('../chat/TeamChatPanel').then(m => ({ default: m.TeamChatPanel })));
const TaskList = lazy(() => import('../tasks/TaskList').then(m => ({ default: m.TaskList })));
const KanbanBoard = lazy(() => import('../tasks/KanbanBoard').then(m => ({ default: m.KanbanBoard })));
const CalendarPanel = lazy(() => import('../calendar/CalendarPanel').then(m => ({ default: m.CalendarPanel })));
const CalendarView = lazy(() => import('../calendar/CalendarView').then(m => ({ default: m.CalendarView })));
const FocusTimer = lazy(() => import('../focus/FocusTimer').then(m => ({ default: m.FocusTimer })));
const TodayFocusView = lazy(() => import('../focus/TodayFocusView').then(m => ({ default: m.TodayFocusView })));
const ProjectManager = lazy(() => import('../projects/ProjectManager').then(m => ({ default: m.ProjectManager })));
const ActivityFeed = lazy(() => import('../activity/ActivityFeed').then(m => ({ default: m.ActivityFeed })));
const GlobalSearch = lazy(() => import('../search/GlobalSearch').then(m => ({ default: m.GlobalSearch })));
const QuickAddFAB = lazy(() => import('../tasks/QuickAddFAB').then(m => ({ default: m.QuickAddFAB })));
const AICommandPanel = lazy(() => import('../ai/AICommandPanel').then(m => ({ default: m.AICommandPanel })));
const NotesPanel = lazy(() => import('../notes/NotesPanel').then(m => ({ default: m.NotesPanel })));
const HabitsPanel = lazy(() => import('../habits/HabitsPanel').then(m => ({ default: m.HabitsPanel })));
const AdminAnalyticsPanel = lazy(() => import('../admin/AdminAnalyticsPanel').then(m => ({ default: m.AdminAnalyticsPanel })));
const FamilyPanel = lazy(() => import('../family/FamilyPanel').then(m => ({ default: m.FamilyPanel })));
const IslamPanel = lazy(() => import('../islam/IslamPanel').then(m => ({ default: m.IslamPanel })));
const IslamEnhancedPanel = lazy(() => import('../islam/IslamEnhancedPanel').then(m => ({ default: m.IslamEnhancedPanel })));
const PropertyPanel = lazy(() => import('../property/PropertyPanel').then(m => ({ default: m.PropertyPanel })));
const StartupWorkspacePanel = lazy(() => import('../startup/StartupWorkspacePanel').then(m => ({ default: m.StartupWorkspacePanel })));
const TechNewsPanel = lazy(() => import('../news/TechNewsPanel').then(m => ({ default: m.TechNewsPanel })));
const HealthHubPanel = lazy(() => import('../health/HealthHubPanel').then(m => ({ default: m.HealthHubPanel })));
const CallHistory = lazy(() => import('../calling/CallHistory').then(m => ({ default: m.CallHistory })));
const SocialPanel = lazy(() => import('../social/SocialPanel').then(m => ({ default: m.SocialPanel })));
const DashboardPanel = lazy(() => import('../dashboard/DashboardPanel').then(m => ({ default: m.DashboardPanel })));
const ContactsPanel = lazy(() => import('../contacts/ContactsPanel').then(m => ({ default: m.ContactsPanel })));
const ContractsPanel = lazy(() => import('../contracts/ContractsPanel').then(m => ({ default: m.ContractsPanel })));
const SettingsPanelContent = lazy(() => import('../settings/SettingsPanelContent').then(m => ({ default: m.SettingsPanelContent })));
const EmailPanel = lazy(() => import('../email/EmailPanel').then(m => ({ default: m.EmailPanel })));

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
    action: ActivityItem['action'],
    itemType: 'task' | 'event',
    itemId: string,
    itemTitle?: string,
    targetUserId?: string,
    details?: Record<string, any>
  ) => void;
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
  onOpenWeeklyReview?: () => void;
  onAddProject?: (project: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Project | null>;
  onUpdateProject?: (id: string, updates: Partial<Project>) => void;
  onDeleteProject?: (id: string) => void;
  getProjectProgress?: (projectId: string, tasks: { projectId?: string; completed: boolean }[]) => number;
  onShareProject?: (projectId: string, projectName: string) => void;
  onShareProjectWithEmail?: (projectId: string, email: string) => Promise<{ error: string | null }>;
  settings?: UserSettings;
  onUpdateSettings?: (updates: Partial<UserSettings>) => void;
  onUpdateNotifications?: (updates: Partial<UserSettings['notifications']>) => void;
}

type FullscreenPanel = 'chat' | 'tasks' | 'calendar' | null;

export function StandardMode({
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
  onLogActivity,
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
  const [filter, setFilter] = useState<SidebarFilter>('all');
  const [calendarMode, setCalendarMode] = useState<'agenda' | 'grid'>('agenda');
  const [taskViewMode, setTaskViewMode] = useState<'list' | 'kanban'>('list');
  const [fullscreenPanel, setFullscreenPanel] = useState<FullscreenPanel>(null);
  const [showFocusTimer, setShowFocusTimer] = useState(false);
  const [showTodayFocus, setShowTodayFocus] = useState(false);
  
  const [showGlobalSearch, setShowGlobalSearch] = useState(false);
  const [activePanel, setActivePanel] = useState<ActivePanel>('tasks');
  const [selectedProjectId, setSelectedProjectId] = useState<string | undefined>();
  const isMobile = useIsMobile();
  const { celebrate } = useCelebration();
  const { user } = useAuth();
  const { t } = useLanguage();

  const panelTitle = useMemo(() => {
    const titles: Record<string, string> = {
      dashboard: t('nav.dashboard'),
      tasks: t('nav.tasks'),
      calendar: t('nav.calendar'),
      assistant: t('nav.assistant'),
      social: t('nav.social'),
      contacts: t('nav.contacts'),
      contracts: t('nav.contracts'),
      notes: t('nav.notes'),
      habits: t('nav.habits'),
      family: t('nav.cooking') || 'Cooking',
      islam: t('nav.islam') || 'Islam',
      health: t('nav.health') || 'Health',
      email: t('nav.email') || 'Email',
      properties: t('nav.properties') || 'Properties',
      startups: t('nav.startups') || 'Startups',
      news: t('nav.news') || 'Tech News',
      settings: t('nav.settings'),
      admin: t('nav.admin'),
      projects: 'Projects',
      activity: 'Activity',
    };
    return titles[activePanel || 'tasks'] || 'DarAI';
  }, [activePanel, t]);

  // Wrapper for task completion with celebration
  const handleToggleTaskComplete = (id: string) => {
    const task = tasks.find(t => t.id === id);
    if (task && !task.completed) {
      // Task is being completed
      if (task.priority === 'high') {
        celebrate({ type: 'highPriorityComplete' });
      } else {
        celebrate({ type: 'taskComplete' });
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

  // Keyboard shortcut for global search (Cmd+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowGlobalSearch(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Handle search result selection
  const handleSelectSearchResult = (result: SearchResult) => {
    setShowGlobalSearch(false);
    // Navigate to the result based on type
    if (result.type === 'task') {
      setFilter('all');
      setSelectedProjectId(undefined);
      // Could scroll to the task or open edit modal
    } else if (result.type === 'event') {
      setActivePanel('calendar');
    } else if (result.type === 'project') {
      setActivePanel('projects');
      setSelectedProjectId(result.id);
    } else if (result.type === 'contract') {
      // Navigate to contracts page
      window.location.href = '/contracts';
    } else if (result.type === 'contact') {
      // Navigate to contacts page
      window.location.href = '/contacts';
    }
  };

  // Get tasks based on current filter and sort by due date
  const filteredTasks = filter === 'shared' 
    ? sharedTasks 
    : selectedProjectId 
      ? tasks.filter(t => t.projectId === selectedProjectId)
      : filter !== 'all'
        ? tasks.filter(t => t.category === filter)
        : tasks;
  const displayTasks = sortTasksByDueDate(filteredTasks);
  const displayEvents = filter === 'shared' ? sharedEvents : events;

  // Use mobile layout on small screens
  if (isMobile) {
    return (
      <MobileLayout
        userId={user?.id || ''}
        tasks={tasks}
        events={events}
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
        onVoiceMode={onVoiceMode}
        onEditProfile={onEditProfile}
        onShareTask={onShareTask}
        onShareEvent={onShareEvent}
        onSignOut={onSignOut}
        settings={settings}
        onUpdateSettings={onUpdateSettings}
        onUpdateNotifications={onUpdateNotifications}
      />
    );
  }

  // Fullscreen overlay
  if (fullscreenPanel) {
    return (
      <div className="fixed inset-0 z-50 bg-background flex flex-col">
        <div className="h-14 px-4 flex items-center justify-end border-b border-border">
          <Button variant="ghost" size="icon" onClick={() => setFullscreenPanel(null)}>
            <X className="w-5 h-5" />
          </Button>
        </div>
        <div className="flex-1 overflow-hidden">
          <Suspense fallback={<PanelFallback />}>
            {fullscreenPanel === 'chat' && (
              <ChatPanel 
                messages={messages}
                onSendMessage={onSendMessage}
                isProcessing={isProcessing}
                isFullscreen={true}
                onToggleFullscreen={() => setFullscreenPanel(null)}
                contacts={contacts}
              />
            )}
            {fullscreenPanel === 'tasks' && (
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
            {fullscreenPanel === 'calendar' && (
              calendarMode === 'agenda' ? (
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
                  onAddTask={(task) => onAddTask({ ...task, completed: false, priority: task.priority || 'medium', category: task.category || 'personal' } as Omit<Task, 'id' | 'createdAt'>)}
                  isFullscreen={true}
                  onToggleFullscreen={() => setFullscreenPanel(null)}
                />
              )
            )}
          </Suspense>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full bg-background">
      <Sidebar 
        onSignOut={onSignOut}
        onOpenFocusTimer={() => setShowFocusTimer(true)}
        onOpenWeeklyReview={onOpenWeeklyReview}
        onOpenTodayFocus={() => setShowTodayFocus(true)}
        onPanelChange={setActivePanel}
        activePanel={activePanel}
      />
      
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Desktop Content Header */}
        <ContextualHeader
          title={panelTitle}
          onOpenSearch={() => setShowGlobalSearch(true)}
          notifications={[]}
          onMarkRead={() => {}}
          onMarkAllRead={() => {}}
          onDeleteNotification={() => {}}
          onClearAll={() => {}}
          rightSlot={<RealtimeNotificationCenter userId={user?.id} />}
        />

        <div className="flex-1 flex overflow-hidden">

          {/* Main Content Area - Only one panel at a time */}
          <div className="flex-1 flex flex-col p-2 gap-2">
            <Suspense fallback={<PanelFallback />}>
              {/* AI Assistant Panel */}
              {activePanel === 'assistant' && (
                <div className="flex-1 glass-panel-solid rounded-xl overflow-hidden">
                  <ChatPanel 
                    messages={messages}
                    onSendMessage={onSendMessage}
                    isProcessing={isProcessing}
                    onToggleFullscreen={() => setFullscreenPanel('chat')}
                    contacts={contacts}
                  />
                </div>
              )}

              {/* Tasks Panel */}
              {activePanel === 'tasks' && (
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
                    <div className="flex items-center gap-1">
                      <Button
                        variant={taskViewMode === 'list' ? 'secondary' : 'ghost'}
                        size="sm"
                        className="h-7 px-2"
                        onClick={() => setTaskViewMode('list')}
                      >
                        <List className="w-4 h-4" />
                      </Button>
                      <Button
                        variant={taskViewMode === 'kanban' ? 'secondary' : 'ghost'}
                        size="sm"
                        className="h-7 px-2"
                        onClick={() => setTaskViewMode('kanban')}
                      >
                        <LayoutGrid className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Tasks - List or Kanban view */}
                  <div className="flex-1 glass-panel-solid rounded-xl overflow-hidden">
                    {taskViewMode === 'kanban' ? (
                      <KanbanBoard
                        tasks={displayTasks}
                        sharedTasks={sharedTasks}
                        projects={projects}
                        onUpdateTask={onUpdateTask || (() => {})}
                        onToggleComplete={handleToggleTaskComplete}
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
                        onToggleFullscreen={() => setFullscreenPanel('tasks')}
                      />
                    )}
                  </div>
                </>
              )}

              {/* Calendar Panel */}
              {activePanel === 'calendar' && (
                <div className="flex-1 glass-panel-solid rounded-xl overflow-hidden flex flex-col">
                  <div className="h-10 px-4 flex items-center justify-end border-b border-border gap-1">
                    <Button
                      variant={calendarMode === 'agenda' ? 'secondary' : 'ghost'}
                      size="sm"
                      className="h-7 px-2"
                      onClick={() => setCalendarMode('agenda')}
                    >
                      <List className="w-4 h-4" />
                    </Button>
                    <Button
                      variant={calendarMode === 'grid' ? 'secondary' : 'ghost'}
                      size="sm"
                      className="h-7 px-2"
                      onClick={() => setCalendarMode('grid')}
                    >
                      <Grid3X3 className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="flex-1 overflow-hidden">
                    {calendarMode === 'agenda' ? (
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
                        onToggleFullscreen={() => setFullscreenPanel('calendar')}
                      />
                    ) : (
                      <CalendarView
                        events={displayEvents}
                        tasks={displayTasks}
                        onToggleTaskComplete={onToggleTaskComplete}
                        onUpdateTask={onUpdateTask}
                        onDeleteTask={onDeleteTask}
                        onAddTask={(task) => onAddTask({ ...task, completed: false, priority: task.priority || 'medium', category: task.category || 'personal' } as Omit<Task, 'id' | 'createdAt'>)}
                        onToggleFullscreen={() => setFullscreenPanel('calendar')}
                      />
                    )}
                  </div>
                </div>
              )}

              {/* Social Panel (Chat + Calls) */}
              {activePanel === 'social' && user?.id && (
                <div className="flex-1 glass-panel-solid rounded-xl overflow-hidden">
                  <SocialPanel userId={user.id} />
                </div>
              )}

              {/* Dashboard Panel */}
              {activePanel === 'dashboard' && user?.id && (
                <div className="flex-1 glass-panel-solid rounded-xl overflow-hidden">
                  <DashboardPanel userId={user.id} />
                </div>
              )}

              {/* Projects Panel */}
              {activePanel === 'projects' && onAddProject && onUpdateProject && onDeleteProject && getProjectProgress && (
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
              {activePanel === 'contacts' && user?.id && (
                <div className="flex-1 glass-panel-solid rounded-xl overflow-hidden">
                  <ContactsPanel userId={user.id} />
                </div>
              )}

              {/* Contracts Panel */}
              {activePanel === 'contracts' && user?.id && (
                <div className="flex-1 glass-panel-solid rounded-xl overflow-hidden">
                  <ContractsPanel userId={user.id} />
                </div>
              )}

              {/* Activity Panel */}
              {activePanel === 'activity' && (
                <div className="flex-1 glass-panel-solid rounded-xl overflow-hidden p-4">
                  <div className="flex items-center gap-2 mb-4">
                    <Activity className="h-5 w-5" />
                    <h2 className="text-lg font-semibold">Activity Feed</h2>
                  </div>
                  <ActivityFeed activities={activities} loading={activityLoading} />
                </div>
              )}

              {/* Settings Panel */}
              {activePanel === 'settings' && settings && onUpdateSettings && onUpdateNotifications && (
                <div className="flex-1 glass-panel-solid rounded-xl overflow-hidden">
                  <SettingsPanelContent
                    settings={settings}
                    onUpdateSettings={onUpdateSettings}
                    onUpdateNotifications={onUpdateNotifications}
                  />
                </div>
              )}

              {/* Notes Panel */}
              {activePanel === 'notes' && user?.id && (
                <div className="flex-1 glass-panel-solid rounded-xl overflow-hidden">
                  <NotesPanel userId={user.id} />
                </div>
              )}

              {/* Habits Panel */}
              {activePanel === 'habits' && user?.id && (
                <div className="flex-1 glass-panel-solid rounded-xl overflow-hidden">
                  <HabitsPanel userId={user.id} />
                </div>
              )}

              {/* Family Panel */}
              {activePanel === 'family' && user?.id && (
                <div className="flex-1 glass-panel-solid rounded-xl overflow-hidden">
                  <FamilyPanel />
                </div>
              )}

              {/* Admin Analytics Panel */}
              {activePanel === 'admin' && user?.id && (
                <div className="flex-1 glass-panel-solid rounded-xl overflow-hidden">
                  <AdminAnalyticsPanel userId={user.id} />
                </div>
              )}

              {/* Islam Panel - Enhanced */}
              {activePanel === 'islam' && (
                <div className="flex-1 glass-panel-solid rounded-xl overflow-hidden">
                  <IslamEnhancedPanel />
                </div>
              )}

              {/* Properties Panel */}
              {activePanel === 'properties' && user?.id && (
                <div className="flex-1 glass-panel-solid rounded-xl overflow-hidden">
                  <PropertyPanel />
                </div>
              )}

              {/* Startups Panel */}
              {activePanel === 'startups' && user?.id && (
                <div className="flex-1 glass-panel-solid rounded-xl overflow-hidden">
                  <StartupWorkspacePanel />
                </div>
              )}

              {/* Tech News Panel */}
              {activePanel === 'news' && user?.id && (
                <div className="flex-1 glass-panel-solid rounded-xl overflow-hidden">
                  <TechNewsPanel />
                </div>
              )}

              {/* Email Panel */}
              {activePanel === 'email' && user?.id && (
                <div className="flex-1 glass-panel-solid rounded-xl overflow-hidden">
                  <EmailPanel />
                </div>
              )}

              {/* Health Panel */}
              {activePanel === 'health' && (
                <div className="flex-1 glass-panel-solid rounded-xl overflow-hidden">
                  <HealthHubPanel />
                </div>
              )}
            </Suspense>
          </div>
        </div>
      </main>

      {/* Today Focus View */}
      <Suspense fallback={null}>
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
}
