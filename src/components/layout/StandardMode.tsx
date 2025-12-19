import { useState, useEffect, useMemo } from 'react';
import { Sidebar, SidebarFilter, ActivePanel } from './Sidebar';
import { MobileLayout } from './MobileLayout';
import { ChatPanel } from '../chat/ChatPanel';
import { TeamChatPanel } from '../chat/TeamChatPanel';
import { TaskList } from '../tasks/TaskList';
import { KanbanBoard } from '../tasks/KanbanBoard';
import { CalendarPanel } from '../calendar/CalendarPanel';
import { CalendarView } from '../calendar/CalendarView';
import { FocusTimer } from '../focus/FocusTimer';
import { TodayFocusView } from '../focus/TodayFocusView';
import { ProjectManager } from '../projects/ProjectManager';
import { ActivityFeed } from '../activity/ActivityFeed';
import { GlobalSearch } from '../search/GlobalSearch';
import { QuickAddFAB } from '../tasks/QuickAddFAB';
import { AICommandPanel } from '../ai/AICommandPanel';

import { RealtimeNotificationCenter } from '../notifications/RealtimeNotificationCenter';
import { CallHistory } from '../calling/CallHistory';
import { DashboardPanel } from '../dashboard/DashboardPanel';
import { ContactsPanel } from '../contacts/ContactsPanel';
import { ContractsPanel } from '../contracts/ContractsPanel';
import { SettingsPanelContent } from '../settings/SettingsPanelContent';
import { useAuth } from '@/hooks/useAuth';
import { Task, CalendarEvent, ChatMessage, Project, UserSettings } from '@/types/flux';
import { useIsMobile } from '@/hooks/use-mobile';
import { useCelebration } from '@/hooks/useCelebration';
import { Button } from '@/components/ui/button';
import { List, Grid3X3, X, LayoutGrid, Activity } from 'lucide-react';
import type { ActivityItem } from '@/hooks/useActivityFeed';
import type { SearchResult, SearchFilters } from '@/hooks/useGlobalSearch';
import type { Contact } from '@/hooks/useContacts';

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
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full bg-background">
      <Sidebar 
        onVoiceMode={onVoiceMode}
        onSignOut={onSignOut}
        onOpenFocusTimer={() => setShowFocusTimer(true)}
        onOpenWeeklyReview={onOpenWeeklyReview}
        
        onOpenGlobalSearch={() => setShowGlobalSearch(true)}
        onOpenTodayFocus={() => setShowTodayFocus(true)}
        onPanelChange={setActivePanel}
        activePanel={activePanel}
        notificationButton={
          <RealtimeNotificationCenter userId={user?.id} />
        }
      />
      
      <main className="flex-1 flex flex-col overflow-hidden">

        <div className="flex-1 flex overflow-hidden">

          {/* Main Content Area - Only one panel at a time */}
          <div className="flex-1 flex flex-col p-2 gap-2">
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

            {/* Team Chat Panel */}
            {activePanel === 'chat' && user?.id && (
              <div className="flex-1 glass-panel-solid rounded-xl overflow-hidden">
                <TeamChatPanel userId={user.id} />
              </div>
            )}

            {/* Call History Panel */}
            {activePanel === 'calls' && user?.id && (
              <div className="flex-1 glass-panel-solid rounded-xl overflow-hidden">
                <CallHistory userId={user.id} />
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
          </div>
        </div>
      </main>

      {/* Today Focus View */}
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

      {/* Quick Add FAB */}
      <QuickAddFAB onAddTask={onAddTask} projects={projects} />
    </div>
  );
}
