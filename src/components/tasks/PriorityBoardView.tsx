import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Task, TaskPriority } from '@/types/flux';
import { SwipeableTaskItem } from './SwipeableTaskItem';
import { 
  ChevronDown, 
  ChevronRight, 
  ArrowUpCircle, 
  Minus, 
  ArrowDownCircle,
  CheckCircle2,
  Circle,
  AlertCircle,
  Calendar as CalendarIcon,
  Sparkles,
} from 'lucide-react';
import { format, isPast, isToday } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';

interface PriorityBoardViewProps {
  tasks: Task[];
  onToggleComplete: (id: string) => void;
  onDeleteTask: (id: string) => void;
  onUpdateTask?: (id: string, updates: Partial<Task>) => void;
}

const prioritySections: {
  priority: TaskPriority;
  label: string;
  icon: React.ElementType;
  accentColor: string;
  bgColor: string;
  borderColor: string;
  defaultOpen: boolean;
}[] = [
  {
    priority: 'high',
    label: 'High Priority',
    icon: ArrowUpCircle,
    accentColor: 'text-destructive',
    bgColor: 'bg-destructive/5',
    borderColor: 'border-destructive/20',
    defaultOpen: true,
  },
  {
    priority: 'medium',
    label: 'Medium Priority',
    icon: Minus,
    accentColor: 'text-warning',
    bgColor: 'bg-warning/5',
    borderColor: 'border-warning/20',
    defaultOpen: true,
  },
  {
    priority: 'low',
    label: 'Low Priority',
    icon: ArrowDownCircle,
    accentColor: 'text-muted-foreground',
    bgColor: 'bg-muted/30',
    borderColor: 'border-border',
    defaultOpen: false,
  },
];

function PriorityTaskRow({ task, onToggleComplete }: { task: Task; onToggleComplete: (id: string) => void }) {
  const isOverdue = task.dueDate && !task.completed && isPast(task.dueDate) && !isToday(task.dueDate);
  const isDueToday = task.dueDate && isToday(task.dueDate);

  return (
    <div className={cn(
      "flex items-center gap-2 px-3 py-2.5 rounded-lg hover:bg-muted/50 transition-colors",
      task.completed && "opacity-50",
      isOverdue && "border-l-2 border-l-destructive"
    )}>
      <button onClick={() => onToggleComplete(task.id)} className="shrink-0">
        {task.completed ? (
          <CheckCircle2 className="w-4.5 h-4.5 text-primary" />
        ) : (
          <Circle className="w-4.5 h-4.5 text-muted-foreground hover:text-primary transition-colors" />
        )}
      </button>
      
      <span className={cn(
        "flex-1 text-sm font-medium truncate",
        task.completed && "line-through text-muted-foreground"
      )}>
        {task.title}
      </span>

      <div className="flex items-center gap-2 shrink-0">
        {isOverdue && (
          <AlertCircle className="w-3.5 h-3.5 text-destructive" />
        )}
        {task.dueDate && (
          <span className={cn(
            "text-xs",
            isOverdue ? "text-destructive" :
            isDueToday ? "text-warning" :
            "text-muted-foreground"
          )}>
            <CalendarIcon className="w-3 h-3 inline mr-0.5" />
            {format(task.dueDate, 'MMM d')}
          </span>
        )}
        <Badge variant="outline" className="text-[10px] h-5 capitalize">
          {task.category}
        </Badge>
      </div>
    </div>
  );
}

export function PriorityBoardView({
  tasks,
  onToggleComplete,
  onDeleteTask,
  onUpdateTask: _onUpdateTask,
}: PriorityBoardViewProps) {
  const incompleteTasks = useMemo(() => tasks.filter(t => !t.completed && !t.trashed), [tasks]);

  const tasksByPriority = useMemo(() => {
    const grouped: Record<TaskPriority, Task[]> = { high: [], medium: [], low: [] };
    incompleteTasks.forEach(task => {
      grouped[task.priority].push(task);
    });
    // Sort each group: overdue first, then by due date
    Object.keys(grouped).forEach(key => {
      grouped[key as TaskPriority].sort((a, b) => {
        if (a.dueDate && !b.dueDate) return -1;
        if (!a.dueDate && b.dueDate) return 1;
        if (a.dueDate && b.dueDate) return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        return 0;
      });
    });
    return grouped;
  }, [incompleteTasks]);

  if (incompleteTasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-16 text-center">
        <Sparkles className="w-12 h-12 text-primary/30 mb-3" />
        <p className="text-base font-medium">All clear!</p>
        <p className="text-sm text-muted-foreground">No tasks to prioritize</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 p-4 overflow-y-auto h-full">
      {prioritySections.map((section) => {
        const sectionTasks = tasksByPriority[section.priority];
        const _Icon = section.icon;

        return (
          <PrioritySection
            key={section.priority}
            section={section}
            tasks={sectionTasks}
            onToggleComplete={onToggleComplete}
            onDeleteTask={onDeleteTask}
          />
        );
      })}
    </div>
  );
}

function PrioritySection({ 
  section, 
  tasks, 
  onToggleComplete, 
  onDeleteTask 
}: { 
  section: typeof prioritySections[0]; 
  tasks: Task[];
  onToggleComplete: (id: string) => void;
  onDeleteTask: (id: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(section.defaultOpen);
  const Icon = section.icon;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <button className={cn(
          "w-full flex items-center gap-2 px-3 py-2.5 rounded-lg border transition-colors",
          section.bgColor,
          section.borderColor,
          "hover:bg-muted/50"
        )}>
          {isOpen ? (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          )}
          <Icon className={cn("w-4 h-4", section.accentColor)} />
          <span className={cn("font-medium text-sm", section.accentColor)}>
            {section.label}
          </span>
          <Badge variant="secondary" className="ml-auto text-xs">
            {tasks.length}
          </Badge>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <AnimatePresence mode="popLayout">
          <div className="mt-1 space-y-0.5">
            {tasks.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">
                No {section.priority} priority tasks
              </p>
            ) : (
              tasks.map(task => (
                <motion.div
                  key={task.id}
                  layout
                  initial={{ opacity: 1 }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <SwipeableTaskItem
                    onComplete={() => onToggleComplete(task.id)}
                    onDelete={() => onDeleteTask(task.id)}
                    isCompleted={task.completed}
                  >
                    <PriorityTaskRow task={task} onToggleComplete={onToggleComplete} />
                  </SwipeableTaskItem>
                </motion.div>
              ))
            )}
          </div>
        </AnimatePresence>
      </CollapsibleContent>
    </Collapsible>
  );
}
