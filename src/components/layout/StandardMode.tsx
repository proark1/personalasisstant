import { useState, useEffect, useMemo } from 'react';
import { Sidebar, SidebarFilter } from './Sidebar';
import { MobileLayout } from './MobileLayout';
import { ChatPanel } from '../chat/ChatPanel';
import { TaskList } from '../tasks/TaskList';
import { CalendarPanel } from '../calendar/CalendarPanel';
import { CalendarView } from '../calendar/CalendarView';
import { FocusTimer } from '../focus/FocusTimer';
import { TodayFocusView } from '../focus/TodayFocusView';
import { ProjectManager } from '../projects/ProjectManager';
import { ActivityPanel } from '../activity/ActivityPanel';
import { GlobalSearch } from '../search/GlobalSearch';
import { QuickAddFAB } from '../tasks/QuickAddFAB';
import { AICommandPanel } from '../ai/AICommandPanel';
import { WorkspaceTabs } from '../workspace/WorkspaceTabs';
import { NotificationCenter } from '../notifications/NotificationCenter';
import { useNotifications } from '@/hooks/useNotifications';
import { Task, CalendarEvent, ChatMessage, Project } from '@/types/flux';
import { useIsMobile } from '@/hooks/use-mobile';
import { useCelebration } from '@/hooks/useCelebration';
import { Button } from '@/components/ui/button';
import { List, Grid3X3, X, Mic } from 'lucide-react';
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
  onOpenSettings: () => void;
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
  onOpenSettings,
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
}: StandardModeProps) {
  const [filter, setFilter] = useState<SidebarFilter>('all');
  const [calendarMode, setCalendarMode] = useState<'agenda' | 'grid'>('agenda');
  const [fullscreenPanel, setFullscreenPanel] = useState<FullscreenPanel>(null);
  const [showFocusTimer, setShowFocusTimer] = useState(false);
  const [showTodayFocus, setShowTodayFocus] = useState(false);
  const [showProjectPanel, setShowProjectPanel] = useState(false);
  const [showActivityPanel, setShowActivityPanel] = useState(false);
  const [showGlobalSearch, setShowGlobalSearch] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string | undefined>();
  const [activeWorkspace, setActiveWorkspace] = useState<string>('all');
  const isMobile = useIsMobile();
  const { celebrate } = useCelebration();
  const { 
    notifications, 
    markRead, 
    markAllRead, 
    deleteNotification, 
    clearAll,
    addNotification,
  } = useNotifications();

  // Workspace task counts
  const workspaceTaskCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: tasks.filter(t => !t.completed).length,
      family: tasks.filter(t => !t.completed && t.category === 'family').length,
      work: tasks.filter(t => !t.completed && t.category === 'business').length,
      personal: tasks.filter(t => !t.completed && t.category === 'personal').length,
    };
    return counts;
  }, [tasks]);

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
      // Could scroll to the task or open edit modal
    } else if (result.type === 'event') {
      // Could navigate to calendar
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
        tasks={tasks}
        events={events}
        sharedTasks={sharedTasks}
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
        onOpenSettings={onOpenSettings}
        onEditProfile={onEditProfile}
        onShareTask={onShareTask}
        onShareEvent={onShareEvent}
        onSignOut={onSignOut}
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
        activeFilter={filter}
        onFilterChange={setFilter}
        onVoiceMode={onVoiceMode}
        onOpenSettings={onOpenSettings}
        onSignOut={onSignOut}
        onOpenFocusTimer={() => setShowFocusTimer(true)}
        onOpenWeeklyReview={onOpenWeeklyReview}
        onToggleProjects={() => setShowProjectPanel(!showProjectPanel)}
        onOpenActivityFeed={() => setShowActivityPanel(true)}
        onOpenGlobalSearch={() => setShowGlobalSearch(true)}
        onToggleCalendar={() => setShowCalendar(!showCalendar)}
        onOpenTodayFocus={() => setShowTodayFocus(true)}
        showCalendar={showCalendar}
        notificationButton={
          <NotificationCenter
            notifications={notifications}
            onMarkRead={markRead}
            onMarkAllRead={markAllRead}
            onDelete={deleteNotification}
            onClearAll={clearAll}
          />
        }
      />
      
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Workspace Tabs */}
        <div className="px-4 pt-3 pb-1">
          <WorkspaceTabs
            activeWorkspace={activeWorkspace}
            onWorkspaceChange={setActiveWorkspace}
            workspaceTaskCounts={workspaceTaskCounts}
          />
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Project Panel */}
          {showProjectPanel && onAddProject && onUpdateProject && onDeleteProject && getProjectProgress && (
            <div className="w-64 border-r border-border p-3 overflow-y-auto">
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

          {/* Chat Panel */}
          <div className="w-[400px] border-r border-border flex flex-col glass-panel-solid m-2 mr-1 rounded-xl overflow-hidden">
            <ChatPanel 
              messages={messages}
              onSendMessage={onSendMessage}
              isProcessing={isProcessing}
              onToggleFullscreen={() => setFullscreenPanel('chat')}
              contacts={contacts}
            />
          </div>

          {/* Right Side - Tasks & Calendar */}
        <div className="flex-1 flex flex-col p-2 pl-1 gap-2">
          {/* AI Commands */}
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
          </div>

          {/* Tasks - takes full height when calendar hidden */}
          <div className="flex-1 glass-panel-solid rounded-xl overflow-hidden">
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
              projects={projects}
              contacts={contacts}
              onToggleFullscreen={() => setFullscreenPanel('tasks')}
            />
          </div>

          {/* Calendar - only shown when toggled */}
          {showCalendar && (
            <div className="h-80 glass-panel-solid rounded-xl overflow-hidden">
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
              <div className="h-[calc(100%-2.5rem)]">
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
                    onToggleFullscreen={() => setFullscreenPanel('calendar')}
                  />
                )}
              </div>
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

      {/* Activity Panel */}
      <ActivityPanel
        open={showActivityPanel}
        onOpenChange={setShowActivityPanel}
        activities={activities}
        loading={activityLoading}
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
