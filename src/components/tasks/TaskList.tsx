import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Task, TaskCategory, TaskPriority } from '@/types/flux';
import { RecurrenceSelector } from '@/components/shared/RecurrenceSelector';
import { getRecurrenceDescription } from '@/lib/recurrence';
import { 
  CheckCircle2, 
  Circle, 
  Plus, 
  Trash2, 
  Calendar,
  Briefcase,
  User,
  Share2,
  X,
  Repeat
} from 'lucide-react';
import { format } from 'date-fns';

interface TaskListProps {
  tasks: Task[];
  filter: TaskCategory | 'all';
  onToggleComplete: (id: string) => void;
  onDeleteTask: (id: string) => void;
  onDeleteTasks?: (ids: string[]) => Promise<{ error: string | null }> | void;
  onAddTask: (task: Omit<Task, 'id' | 'createdAt'>) => void;
  onShareTask?: (id: string, title: string) => void;
}

const priorityColors: Record<TaskPriority, string> = {
  high: 'text-destructive',
  medium: 'text-warning',
  low: 'text-muted-foreground',
};

const priorityBg: Record<TaskPriority, string> = {
  high: 'bg-destructive/10',
  medium: 'bg-warning/10',
  low: 'bg-muted',
};

export function TaskList({ tasks, filter, onToggleComplete, onDeleteTask, onDeleteTasks, onAddTask, onShareTask }: TaskListProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskRecurrence, setNewTaskRecurrence] = useState<string | undefined>();
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());
  const [isSelectMode, setIsSelectMode] = useState(false);

  const filteredTasks = filter === 'all' 
    ? tasks 
    : tasks.filter(task => task.category === filter);

  const incompleteTasks = filteredTasks.filter(t => !t.completed);
  const completedTasks = filteredTasks.filter(t => t.completed);

  const handleAddTask = () => {
    if (newTaskTitle.trim()) {
      onAddTask({
        title: newTaskTitle.trim(),
        category: filter === 'all' ? 'personal' : filter,
        priority: 'medium',
        completed: false,
        recurrenceRule: newTaskRecurrence,
      });
      setNewTaskTitle('');
      setNewTaskRecurrence(undefined);
      setIsAdding(false);
    }
  };

  const toggleSelectTask = (id: string) => {
    setSelectedTasks(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAllVisible = () => {
    const allIds = filteredTasks.map(t => t.id);
    setSelectedTasks(new Set(allIds));
  };

  const clearSelection = () => {
    setSelectedTasks(new Set());
    setIsSelectMode(false);
  };

  const handleBulkDelete = async () => {
    if (selectedTasks.size === 0) return;
    
    const idsToDelete = Array.from(selectedTasks);
    console.log('Deleting tasks:', idsToDelete.length);
    
    if (onDeleteTasks) {
      const result = await onDeleteTasks(idsToDelete);
      console.log('Delete result:', result);
    } else {
      // Fallback to individual deletes
      for (const id of idsToDelete) {
        await onDeleteTask(id);
      }
    }
    clearSelection();
  };

  const TaskItem = ({ task }: { task: Task }) => (
    <div 
      className={cn(
        "group flex items-start gap-3 p-3 rounded-lg transition-all duration-200 hover:bg-muted/50",
        task.completed && "opacity-60",
        selectedTasks.has(task.id) && "bg-primary/10 border border-primary/20"
      )}
    >
      {isSelectMode ? (
        <Checkbox
          checked={selectedTasks.has(task.id)}
          onCheckedChange={() => toggleSelectTask(task.id)}
          className="mt-0.5"
        />
      ) : (
        <button
          onClick={() => onToggleComplete(task.id)}
          className="mt-0.5 shrink-0"
        >
          {task.completed ? (
            <CheckCircle2 className="w-5 h-5 text-primary" />
          ) : (
            <Circle className="w-5 h-5 text-muted-foreground hover:text-primary transition-colors" />
          )}
        </button>
      )}
      
      <div className="flex-1 min-w-0" onClick={() => isSelectMode && toggleSelectTask(task.id)}>
        <div className="flex items-center gap-2">
          <span className={cn(
            "text-sm font-medium truncate",
            task.completed && "line-through text-muted-foreground"
          )}>
            {task.title}
          </span>
          <span className={cn(
            "shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium uppercase",
            priorityBg[task.priority],
            priorityColors[task.priority]
          )}>
            {task.priority}
          </span>
        </div>
        
        {task.description && (
          <p className="text-xs text-muted-foreground mt-0.5 truncate">
            {task.description}
          </p>
        )}
        
        <div className="flex items-center gap-3 mt-1.5">
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            {task.category === 'business' ? (
              <Briefcase className="w-3 h-3" />
            ) : (
              <User className="w-3 h-3" />
            )}
            {task.category}
          </span>
          {task.dueDate && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Calendar className="w-3 h-3" />
              {format(task.dueDate, 'MMM d')}
            </span>
          )}
          {task.recurrenceRule && (
            <span className="flex items-center gap-1 text-xs text-primary">
              <Repeat className="w-3 h-3" />
              {getRecurrenceDescription(task.recurrenceRule)}
            </span>
          )}
        </div>
      </div>

      {!isSelectMode && (
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {onShareTask && (
            <Button
              variant="ghost"
              size="iconSm"
              className="text-muted-foreground hover:text-primary"
              onClick={() => onShareTask(task.id, task.title)}
            >
              <Share2 className="w-4 h-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="iconSm"
            className="text-muted-foreground hover:text-destructive"
            onClick={() => onDeleteTask(task.id)}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="h-14 px-4 flex items-center justify-between border-b border-border">
        <h2 className="font-semibold">
          Tasks
          <span className="ml-2 text-sm text-muted-foreground font-normal">
            {incompleteTasks.length} remaining
          </span>
        </h2>
        <div className="flex items-center gap-2">
          {isSelectMode ? (
            <>
              <span className="text-sm text-muted-foreground">
                {selectedTasks.size} selected
              </span>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={selectAllVisible}
              >
                Select All
              </Button>
              <Button 
                variant="destructive" 
                size="sm"
                onClick={handleBulkDelete}
                disabled={selectedTasks.size === 0}
              >
                <Trash2 className="w-4 h-4 mr-1" />
                Delete ({selectedTasks.size})
              </Button>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={clearSelection}
              >
                <X className="w-4 h-4" />
              </Button>
            </>
          ) : (
            <>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setIsSelectMode(true)}
              >
                Select
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                className="gap-1"
                onClick={() => setIsAdding(true)}
              >
                <Plus className="w-4 h-4" />
                Add
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Task List */}
      <div className="flex-1 overflow-y-auto p-2">
        {/* Add Task Input */}
        {isAdding && (
          <div className="p-3 mb-2 rounded-lg bg-muted/50 border border-border animate-scale-in">
            <Input
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              placeholder="What needs to be done?"
              className="mb-2"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddTask();
                if (e.key === 'Escape') setIsAdding(false);
              }}
            />
            <div className="flex gap-2 justify-end">
              <RecurrenceSelector
                value={newTaskRecurrence}
                onChange={setNewTaskRecurrence}
              />
              <Button variant="ghost" size="sm" onClick={() => {
                setIsAdding(false);
                setNewTaskRecurrence(undefined);
              }}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleAddTask}>
                Add Task
              </Button>
            </div>
          </div>
        )}

        {/* Incomplete Tasks */}
        <div className="space-y-1">
          {incompleteTasks.map(task => (
            <TaskItem key={task.id} task={task} />
          ))}
        </div>

        {/* Completed Tasks */}
        {completedTasks.length > 0 && (
          <div className="mt-4">
            <div className="px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Completed ({completedTasks.length})
            </div>
            <div className="space-y-1">
              {completedTasks.map(task => (
                <TaskItem key={task.id} task={task} />
              ))}
            </div>
          </div>
        )}

        {filteredTasks.length === 0 && !isAdding && (
          <div className="flex flex-col items-center justify-center h-40 text-center">
            <CheckCircle2 className="w-10 h-10 text-muted-foreground/30 mb-2" />
            <p className="text-sm text-muted-foreground">No tasks yet</p>
            <Button 
              variant="link" 
              size="sm" 
              className="text-primary"
              onClick={() => setIsAdding(true)}
            >
              Add your first task
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}