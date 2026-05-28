import React, { useState, useMemo } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Task, TaskStatus, TaskPriority, Project } from '@/types/flux';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { 
  GripVertical, 
  Calendar, 
  AlertCircle, 
  Clock, 
  CheckCircle2,
  Circle,
  ArrowUpCircle,
  Minus,
  ArrowDownCircle,
  LayoutGrid,
  Trash2,
} from 'lucide-react';
import { format, isPast, isToday } from 'date-fns';

interface KanbanBoardProps {
  tasks: Task[];
  sharedTasks?: Task[];
  projects?: Project[];
  onUpdateTask: (id: string, updates: Partial<Task>) => void;
  onToggleComplete: (id: string) => void;
  onDeleteTask?: (id: string) => void;
}

interface KanbanColumn {
  id: TaskStatus;
  title: string;
  color: string;
  icon: React.ElementType;
}

const columns: KanbanColumn[] = [
  { id: 'backlog', title: 'Backlog', color: 'bg-muted', icon: Circle },
  { id: 'in_progress', title: 'In Progress', color: 'bg-blue-500/20', icon: Clock },
  { id: 'done', title: 'Done', color: 'bg-green-500/20', icon: CheckCircle2 },
];

const priorityConfig = {
  high: { icon: ArrowUpCircle, color: 'text-red-400', bg: 'bg-red-500/10' },
  medium: { icon: Minus, color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
  low: { icon: ArrowDownCircle, color: 'text-green-400', bg: 'bg-green-500/10' },
};

interface SortableTaskCardProps {
  task: Task;
  projects?: Project[];
  onToggleComplete: (id: string) => void;
  onDeleteTask?: (id: string) => void;
}

function SortableTaskCard({ task, projects, onToggleComplete, onDeleteTask }: SortableTaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const project = projects?.find(p => p.id === task.projectId);
  const priority = priorityConfig[task.priority];
  const PriorityIcon = priority.icon;
  
  const isOverdue = task.dueDate && isPast(task.dueDate) && !isToday(task.dueDate) && !task.completed;
  const isDueToday = task.dueDate && isToday(task.dueDate);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group p-3 rounded-lg border border-border bg-card hover:border-primary/50 transition-all cursor-pointer",
        isDragging && "opacity-50 rotate-2 scale-105 shadow-xl",
        task.completed && "opacity-60"
      )}
    >
      <div className="flex items-start gap-2">
        <button
          {...attributes}
          {...listeners}
          className="mt-1 p-0.5 rounded hover:bg-muted cursor-grab active:cursor-grabbing"
        >
          <GripVertical className="w-4 h-4 text-muted-foreground" />
        </button>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleComplete(task.id);
              }}
              className="mt-0.5 flex-shrink-0"
            >
              {task.completed ? (
                <CheckCircle2 className="w-4 h-4 text-green-500" />
              ) : (
                <Circle className="w-4 h-4 text-muted-foreground hover:text-primary" />
              )}
            </button>
            
            <span className={cn(
              "text-sm font-medium line-clamp-2",
              task.completed && "line-through text-muted-foreground"
            )}>
              {task.title}
            </span>
          </div>

          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {/* Priority */}
            <div className={cn("flex items-center gap-1 px-1.5 py-0.5 rounded text-xs", priority.bg)}>
              <PriorityIcon className={cn("w-3 h-3", priority.color)} />
            </div>

            {/* Category */}
            <Badge variant="outline" className="text-xs h-5">
              {task.category}
            </Badge>

            {/* Project */}
            {project && (
              <div 
                className="flex items-center gap-1 text-xs"
                style={{ color: project.color }}
              >
                <div 
                  className="w-2 h-2 rounded-full" 
                  style={{ backgroundColor: project.color }}
                />
                <span className="truncate max-w-[60px]">{project.name}</span>
              </div>
            )}

            {/* Due Date */}
            {task.dueDate && (
              <div className={cn(
                "flex items-center gap-1 text-xs",
                isOverdue && "text-red-400",
                isDueToday && !isOverdue && "text-yellow-400",
                !isOverdue && !isDueToday && "text-muted-foreground"
              )}>
                <Calendar className="w-3 h-3" />
                {format(task.dueDate, 'MMM d')}
              </div>
            )}

            {/* Overdue badge */}
            {isOverdue && (
              <Badge variant="destructive" className="text-[10px] h-4 px-1.5">
                <AlertCircle className="w-3 h-3 mr-0.5" />
                Overdue
              </Badge>
            )}

            {/* Shared indicator */}
            {task.sharedByOwner && (
              <Avatar className="w-5 h-5">
                <AvatarFallback className="text-[10px] bg-primary/20">
                  {task.sharedByOwner.display_name?.charAt(0) || 'U'}
                </AvatarFallback>
              </Avatar>
            )}
          </div>
        </div>

        {/* Delete button */}
        {onDeleteTask && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDeleteTask(task.id);
            }}
            className="absolute top-2 right-2 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

function TaskCardOverlay({ task, projects }: { task: Task; projects?: Project[] }) {
  const project = projects?.find(p => p.id === task.projectId);
  const priority = priorityConfig[task.priority];
  const PriorityIcon = priority.icon;

  return (
    <div className="p-3 rounded-lg border-2 border-primary bg-card shadow-2xl rotate-3 scale-105">
      <div className="flex items-start gap-2">
        <GripVertical className="w-4 h-4 text-muted-foreground mt-1" />
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2">
            <Circle className="w-4 h-4 text-muted-foreground mt-0.5" />
            <span className="text-sm font-medium line-clamp-2">{task.title}</span>
          </div>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <div className={cn("flex items-center gap-1 px-1.5 py-0.5 rounded text-xs", priority.bg)}>
              <PriorityIcon className={cn("w-3 h-3", priority.color)} />
            </div>
            <Badge variant="outline" className="text-xs h-5">{task.category}</Badge>
            {project && (
              <div className="flex items-center gap-1 text-xs" style={{ color: project.color }}>
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: project.color }} />
                <span className="truncate max-w-[60px]">{project.name}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function KanbanBoard({
  tasks,
  sharedTasks = [],
  projects = [],
  onUpdateTask,
  onToggleComplete,
  onDeleteTask,
}: KanbanBoardProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [priorityFilter, setPriorityFilter] = useState<'all' | TaskPriority>('all');
  
  const allTasks = useMemo(() => {
    const base = [...tasks, ...sharedTasks].filter(t => !t.trashed);
    if (priorityFilter === 'all') return base;
    return base.filter(t => t.priority === priorityFilter);
  }, [tasks, sharedTasks, priorityFilter]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const tasksByColumn = useMemo(() => {
    const result: Record<TaskStatus, Task[]> = {
      backlog: [],
      in_progress: [],
      done: [],
    };
    
    allTasks.forEach(task => {
      const status = task.status || 'backlog';
      // If task is completed, put it in done column
      if (task.completed && status !== 'done') {
        result.done.push(task);
      } else {
        result[status].push(task);
      }
    });

    // Sort each column by sortOrder
    Object.keys(result).forEach(key => {
      result[key as TaskStatus].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
    });

    return result;
  }, [allTasks]);

  const activeTask = activeId ? allTasks.find(t => t.id === activeId) : null;

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeTaskId = active.id as string;
    const overId = over.id as string;

    // Check if we're over a column
    const overColumn = columns.find(c => c.id === overId);
    if (overColumn) {
      const activeTask = allTasks.find(t => t.id === activeTaskId);
      if (activeTask && activeTask.status !== overColumn.id) {
        // Move to new column
        const isCompleted = overColumn.id === 'done';
        onUpdateTask(activeTaskId, { 
          status: overColumn.id,
          completed: isCompleted
        });
      }
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    
    if (!over) return;

    const activeTaskId = active.id as string;
    const overId = over.id as string;

    // Check if dropped over a column
    const overColumn = columns.find(c => c.id === overId);
    if (overColumn) {
      const activeTask = allTasks.find(t => t.id === activeTaskId);
      if (activeTask) {
        const isCompleted = overColumn.id === 'done';
        onUpdateTask(activeTaskId, { 
          status: overColumn.id,
          completed: isCompleted
        });
      }
      return;
    }

    // Check if dropped over another task
    const overTask = allTasks.find(t => t.id === overId);
    if (overTask) {
      const activeTask = allTasks.find(t => t.id === activeTaskId);
      if (activeTask) {
        // Move to the same column as the task we dropped on
        const targetStatus = overTask.status || 'backlog';
        const isCompleted = targetStatus === 'done';
        
        if (activeTask.status !== targetStatus) {
          onUpdateTask(activeTaskId, { 
            status: targetStatus,
            completed: isCompleted
          });
        }
      }
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-3 border-b border-border space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold flex items-center gap-2">
            <LayoutGrid className="w-5 h-5 text-primary" />
            Kanban Board
          </h2>
          <span className="text-sm text-muted-foreground">{allTasks.length} tasks</span>
        </div>
        <div className="flex gap-1">
          {(['all', 'high', 'medium', 'low'] as const).map(p => (
            <Button
              key={p}
              variant={priorityFilter === p ? 'secondary' : 'ghost'}
              size="sm"
              className={cn("h-6 px-2 text-xs capitalize", priorityFilter === p && "bg-background shadow-sm")}
              onClick={() => setPriorityFilter(p)}
            >
              {p === 'all' ? 'All' : p}
            </Button>
          ))}
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="flex-1 flex gap-4 p-4 overflow-x-auto">
          {columns.map(column => {
            const columnTasks = tasksByColumn[column.id];
            const ColumnIcon = column.icon;
            
            return (
              <div
                key={column.id}
                className="flex-1 min-w-[280px] max-w-[400px] flex flex-col"
              >
                <div className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-t-lg",
                  column.color
                )}>
                  <ColumnIcon className="w-4 h-4" />
                  <span className="font-medium text-sm">{column.title}</span>
                  <Badge variant="secondary" className="ml-auto">
                    {columnTasks.length}
                  </Badge>
                </div>
                
                <ScrollArea className="flex-1 border border-t-0 border-border rounded-b-lg bg-muted/30">
                  <SortableContext
                    id={column.id}
                    items={columnTasks.map(t => t.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="p-2 space-y-2 min-h-[200px]">
                      {columnTasks.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-32 text-sm text-muted-foreground gap-1">
                          <span>No tasks here</span>
                          <span className="text-xs">Drag tasks to move them</span>
                        </div>
                      ) : (
                        columnTasks.map(task => (
                          <SortableTaskCard
                            key={task.id}
                            task={task}
                            projects={projects}
                            onToggleComplete={onToggleComplete}
                            onDeleteTask={onDeleteTask}
                          />
                        ))
                      )}
                    </div>
                  </SortableContext>
                </ScrollArea>
              </div>
            );
          })}
        </div>

        <DragOverlay>
          {activeTask ? (
            <TaskCardOverlay task={activeTask} projects={projects} />
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
