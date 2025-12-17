import { useState } from 'react';
import { Sidebar, SidebarFilter } from './Sidebar';
import { MobileLayout } from './MobileLayout';
import { ChatPanel } from '../chat/ChatPanel';
import { TaskList } from '../tasks/TaskList';
import { CalendarPanel } from '../calendar/CalendarPanel';
import { CalendarView } from '../calendar/CalendarView';
import { FocusTimer } from '../focus/FocusTimer';
import { ProjectManager } from '../projects/ProjectManager';
import { Task, CalendarEvent, ChatMessage, Project } from '@/types/flux';
import { useIsMobile } from '@/hooks/use-mobile';
import { Button } from '@/components/ui/button';
import { List, Grid3X3, X, FolderOpen } from 'lucide-react';

interface Contact {
  id: string;
  userId: string;
  email: string;
  displayName?: string;
}

interface StandardModeProps {
  tasks: Task[];
  events: CalendarEvent[];
  sharedTasks?: Task[];
  sharedEvents?: CalendarEvent[];
  messages: ChatMessage[];
  isProcessing: boolean;
  projects?: Project[];
  contacts?: Contact[];
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
}: StandardModeProps) {
  const [filter, setFilter] = useState<SidebarFilter>('all');
  const [calendarMode, setCalendarMode] = useState<'agenda' | 'grid'>('agenda');
  const [fullscreenPanel, setFullscreenPanel] = useState<FullscreenPanel>(null);
  const [showFocusTimer, setShowFocusTimer] = useState(false);
  const [showProjectPanel, setShowProjectPanel] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string | undefined>();
  const isMobile = useIsMobile();

  // Get tasks based on current filter
  const displayTasks = filter === 'shared' 
    ? sharedTasks 
    : selectedProjectId 
      ? tasks.filter(t => t.projectId === selectedProjectId)
      : tasks;
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
            />
          )}
          {fullscreenPanel === 'tasks' && (
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
        onEditProfile={onEditProfile}
        onSignOut={onSignOut}
        onOpenFocusTimer={() => setShowFocusTimer(true)}
        onOpenWeeklyReview={onOpenWeeklyReview}
        onToggleProjects={() => setShowProjectPanel(!showProjectPanel)}
      />
      
      <main className="flex-1 flex overflow-hidden">
        {/* Project Panel */}
        {showProjectPanel && onAddProject && onUpdateProject && onDeleteProject && getProjectProgress && (
          <div className="w-64 border-r border-border p-3 overflow-y-auto">
            <ProjectManager
              projects={projects}
              tasks={tasks}
              onAddProject={onAddProject}
              onUpdateProject={onUpdateProject}
              onDeleteProject={onDeleteProject}
              getProjectProgress={getProjectProgress}
              selectedProjectId={selectedProjectId}
              onSelectProject={setSelectedProjectId}
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
          />
        </div>

        {/* Right Side - Tasks & Calendar */}
        <div className="flex-1 flex flex-col p-2 pl-1 gap-2">
          {/* Tasks */}
          <div className="flex-1 glass-panel-solid rounded-xl overflow-hidden">
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
              projects={projects}
              contacts={contacts}
              onToggleFullscreen={() => setFullscreenPanel('tasks')}
            />
          </div>

          {/* Calendar */}
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
        </div>
      </main>

      {/* Focus Timer Dialog */}
      <FocusTimer
        tasks={tasks}
        isOpen={showFocusTimer}
        onClose={() => setShowFocusTimer(false)}
      />
    </div>
  );
}
