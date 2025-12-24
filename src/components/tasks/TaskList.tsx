import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Task, TaskCategory, TaskPriority, Project, TimeFilter } from '@/types/flux';
import type { Contact } from '@/hooks/useContacts';
import { RecurrenceSelector } from '@/components/shared/RecurrenceSelector';
import { getRecurrenceDescription } from '@/lib/recurrence';
import { EditTaskModal } from './EditTaskModal';
import { TaskTagBadges } from './TaskTagBadges';
import { useLanguage } from '@/contexts/LanguageContext';
import { 
  DndContext, 
  closestCenter, 
  KeyboardSensor, 
  PointerSensor, 
  useSensor, 
  useSensors,
  DragEndEvent 
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { 
  CheckCircle2, 
  Circle, 
  Plus, 
  Trash2, 
  Calendar as CalendarIcon,
  Briefcase,
  User,
  Share2,
  X,
  Repeat,
  GripVertical,
  ChevronRight,
  ChevronDown,
  AlertCircle,
  Pencil,
  UserCircle,
  Filter,
  Users
} from 'lucide-react';
import { format, isPast, isToday, isTomorrow, isThisWeek, isThisMonth, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { de, enUS } from 'date-fns/locale';

import { SidebarFilter } from '@/components/layout/Sidebar';

interface Tag {
  id: string;
  name: string;
  color: string;
}

interface TaskListProps {
  tasks: Task[];
  sharedTasks?: Task[];
  filter?: SidebarFilter;
  onFilterChange?: (filter: SidebarFilter) => void;
  onToggleComplete: (id: string) => void;
  onDeleteTask: (id: string) => void;
  onDeleteTasks?: (ids: string[]) => Promise<{ error: string | null }> | void;
  onAddTask: (task: Omit<Task, 'id' | 'createdAt'>) => void;
  onUpdateTask?: (id: string, updates: Partial<Task>) => void;
  onReorderTasks?: (taskOrders: { id: string; sortOrder: number }[]) => void;
  onShareTask?: (id: string, title: string) => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  projects?: Project[];
  contacts?: Contact[];
  tags?: Tag[];
  getTaskTags?: (taskId: string) => Tag[];
  compactMode?: boolean;
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

interface SortableTaskItemProps {
  task: Task;
  subtasks: Task[];
  isSelectMode: boolean;
  selectedTasks: Set<string>;
  toggleSelectTask: (id: string) => void;
  onToggleComplete: (id: string) => void;
  onDeleteTask: (id: string) => void;
  onShareTask?: (id: string, title: string) => void;
  onUpdateTask?: (id: string, updates: Partial<Task>) => void;
  onEditTask?: (task: Task) => void;
  onAddSubtask: (parentId: string) => void;
  tags?: Tag[];
  level?: number;
  compactMode?: boolean;
}

function SortableTaskItem({ 
  task, 
  subtasks,
  isSelectMode, 
  selectedTasks, 
  toggleSelectTask, 
  onToggleComplete, 
  onDeleteTask,
  onShareTask,
  onUpdateTask,
  onEditTask,
  onAddSubtask,
  tags = [],
  level = 0,
  compactMode = false,
}: SortableTaskItemProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [showDatePicker, setShowDatePicker] = useState(false);

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

  const completedSubtasks = subtasks.filter(t => t.completed).length;
  const totalSubtasks = subtasks.length;
  const progressPercent = totalSubtasks > 0 ? (completedSubtasks / totalSubtasks) * 100 : 0;

  const isOverdue = task.dueDate && !task.completed && isPast(task.dueDate) && !isToday(task.dueDate);
  const isDueToday = task.dueDate && isToday(task.dueDate);
  const isDueTomorrow = task.dueDate && isTomorrow(task.dueDate);

  const handleDateSelect = (date: Date | undefined) => {
    if (onUpdateTask) {
      onUpdateTask(task.id, { dueDate: date });
    }
    setShowDatePicker(false);
  };

  return (
    <div ref={setNodeRef} style={style}>
      <div 
        className={cn(
          "group flex items-start gap-1.5 rounded-lg transition-all duration-200 hover:bg-muted/50",
          compactMode ? "p-2" : "p-3 gap-2",
          task.completed && "opacity-60",
          selectedTasks.has(task.id) && "bg-primary/10 border border-primary/20",
          isDragging && "opacity-50 bg-muted",
          isOverdue && !task.completed && "border-l-2 border-l-destructive",
          level > 0 && "ml-4 border-l border-border"
        )}
      >
        {/* Drag Handle - hide in compact mode */}
        {!isSelectMode && !compactMode && (
          <button
            {...attributes}
            {...listeners}
            className="mt-0.5 shrink-0 cursor-grab active:cursor-grabbing text-muted-foreground/50 hover:text-muted-foreground"
          >
            <GripVertical className="w-4 h-4" />
          </button>
        )}

        {/* Expand/Collapse for parent tasks - hide in compact mode if no subtasks */}
        {!compactMode && subtasks.length > 0 ? (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="mt-0.5 shrink-0 text-muted-foreground hover:text-foreground"
          >
            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
        ) : !compactMode ? (
          <div className="w-4" />
        ) : null}

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
            {isOverdue && (
              <span className="flex items-center gap-1 text-destructive text-xs">
                <AlertCircle className="w-3 h-3" />
                {/* We'll access t() from parent component context */}
              </span>
            )}
          </div>

          {/* Subtask Progress */}
          {subtasks.length > 0 && (
            <div className="flex items-center gap-2 mt-1.5">
              <Progress value={progressPercent} className="h-1.5 flex-1 max-w-[100px]" />
              <span className="text-xs text-muted-foreground">
                {completedSubtasks}/{totalSubtasks}
              </span>
            </div>
          )}
          
          {!compactMode && task.description && (
            <p className="text-xs text-muted-foreground mt-0.5 truncate">
              {task.description}
            </p>
          )}
          
          <div className={cn(
            "flex items-center flex-wrap",
            compactMode ? "gap-2 mt-1" : "gap-3 mt-1.5"
          )}>
            {!compactMode && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                {task.category === 'business' ? (
                  <Briefcase className="w-3 h-3" />
                ) : (
                  <User className="w-3 h-3" />
                )}
                {task.category}
              </span>
            )}

            {/* Due Date - simplified in compact mode */}
            {compactMode ? (
              task.dueDate && (
                <span className={cn(
                  "flex items-center gap-1 text-[10px]",
                  isOverdue ? "text-destructive" : 
                  isDueToday ? "text-warning" :
                  isDueTomorrow ? "text-primary" :
                  "text-muted-foreground"
                )}>
                  <CalendarIcon className="w-2.5 h-2.5" />
                  {format(task.dueDate, 'MMM d')}
                </span>
              )
            ) : (
              <Popover open={showDatePicker} onOpenChange={setShowDatePicker}>
                <PopoverTrigger asChild>
                  <button className={cn(
                    "flex items-center gap-1 text-xs hover:underline",
                    isOverdue ? "text-destructive" : 
                    isDueToday ? "text-warning" :
                    isDueTomorrow ? "text-primary" :
                    "text-muted-foreground"
                  )}>
                    <CalendarIcon className="w-3 h-3" />
                    {task.dueDate ? format(task.dueDate, 'MMM d') : 'Set due date'}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={task.dueDate}
                    onSelect={handleDateSelect}
                    initialFocus
                  />
                  {task.dueDate && (
                    <div className="p-2 border-t">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="w-full text-destructive hover:text-destructive"
                        onClick={() => handleDateSelect(undefined)}
                      >
                        Clear due date
                      </Button>
                    </div>
                  )}
                </PopoverContent>
              </Popover>
            )}

            {!compactMode && task.recurrenceRule && (
              <span className="flex items-center gap-1 text-xs text-primary">
                <Repeat className="w-3 h-3" />
                {getRecurrenceDescription(task.recurrenceRule)}
              </span>
            )}

            {!compactMode && task.sharedBy && (
              <span className="flex items-center gap-1 text-xs text-accent-foreground bg-accent/30 px-1.5 py-0.5 rounded">
                <UserCircle className="w-3 h-3" />
                Shared by {task.sharedBy.displayName || task.sharedBy.email || 'someone'}
              </span>
            )}
            {!compactMode && task.sharedByOwner && (
              <span className="flex items-center gap-1 text-xs text-primary-foreground bg-primary/80 px-1.5 py-0.5 rounded">
                <Users className="w-3 h-3" />
                {task.sharedByOwner.display_name || task.sharedByOwner.email || 'Team member'}
              </span>
            )}
            {!compactMode && tags.length > 0 && (
              <TaskTagBadges tags={tags} size="sm" />
            )}
          </div>
        </div>

        {!isSelectMode && (
          <div className={cn(
            "flex items-center shrink-0 transition-opacity",
            compactMode 
              ? "gap-0.5 opacity-100" 
              : "gap-1 opacity-0 group-hover:opacity-100"
          )}>
            {onEditTask && (
              <button
                className={cn(
                  "p-1 rounded text-muted-foreground hover:text-primary hover:bg-muted/50",
                  compactMode && "p-0.5"
                )}
                onClick={() => onEditTask(task)}
                title="Edit task"
              >
                <Pencil className={compactMode ? "w-3.5 h-3.5" : "w-4 h-4"} />
              </button>
            )}
            {!compactMode && !task.parentId && (
              <button
                className="p-1 rounded text-muted-foreground hover:text-primary hover:bg-muted/50"
                onClick={() => onAddSubtask(task.id)}
                title="Add subtask"
              >
                <Plus className="w-4 h-4" />
              </button>
            )}
            {!compactMode && onShareTask && (
              <button
                className="p-1 rounded text-muted-foreground hover:text-primary hover:bg-muted/50"
                onClick={() => onShareTask(task.id, task.title)}
              >
                <Share2 className="w-4 h-4" />
              </button>
            )}
            <button
              className={cn(
                "p-1 rounded text-muted-foreground hover:text-destructive hover:bg-muted/50",
                compactMode && "p-0.5"
              )}
              onClick={() => onDeleteTask(task.id)}
            >
              <Trash2 className={compactMode ? "w-3.5 h-3.5" : "w-4 h-4"} />
            </button>
          </div>
        )}
      </div>

      {/* Render Subtasks - hide in compact mode */}
      {!compactMode && isExpanded && subtasks.length > 0 && (
        <div className="space-y-1">
          {subtasks.map(subtask => (
            <SortableTaskItem
              key={subtask.id}
              task={subtask}
              subtasks={[]}
              isSelectMode={isSelectMode}
              selectedTasks={selectedTasks}
              toggleSelectTask={toggleSelectTask}
              onToggleComplete={onToggleComplete}
              onDeleteTask={onDeleteTask}
              onShareTask={onShareTask}
              onUpdateTask={onUpdateTask}
              onEditTask={onEditTask}
              onAddSubtask={onAddSubtask}
              tags={[]}
              level={level + 1}
              compactMode={compactMode}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function TaskList({ 
  tasks, 
  sharedTasks = [],
  filter: externalFilter, 
  onFilterChange,
  onToggleComplete, 
  onDeleteTask, 
  onDeleteTasks, 
  onAddTask, 
  onUpdateTask,
  onReorderTasks,
  onShareTask,
  projects = [],
  contacts = [],
  tags = [],
  getTaskTags,
  compactMode = false,
}: TaskListProps) {
  const { t, language } = useLanguage();
  const dateLocale = language === 'de' ? de : enUS;
  const [isAdding, setIsAdding] = useState(false);
  const [addingSubtaskFor, setAddingSubtaskFor] = useState<string | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDueDate, setNewTaskDueDate] = useState<Date | undefined>();
  const [newTaskRecurrence, setNewTaskRecurrence] = useState<string | undefined>();
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [showDueDatePicker, setShowDueDatePicker] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [timeFilter, setTimeFilter] = useState<TimeFilter | 'all'>('all');
  const [internalFilter, setInternalFilter] = useState<SidebarFilter>('all');

  // Use external filter if provided, otherwise use internal
  const filter = externalFilter ?? internalFilter;
  const handleFilterChange = onFilterChange ?? setInternalFilter;

  const categoryFilters: { label: string; filter: SidebarFilter }[] = [
    { label: t('category.all'), filter: 'all' },
    { label: t('category.business'), filter: 'business' },
    { label: t('category.personal'), filter: 'personal' },
    { label: t('category.family'), filter: 'family' },
    { label: t('category.shared'), filter: 'shared' },
  ];

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Apply category filter first - use sharedTasks for shared filter
  const categoryFilteredTasks = filter === 'shared'
    ? sharedTasks 
    : filter === 'all'
      ? tasks 
      : tasks.filter(task => task.category === filter);

  // Apply time filter
  const filteredTasks = useMemo(() => {
    if (timeFilter === 'all') return categoryFilteredTasks;
    
    const now = new Date();
    return categoryFilteredTasks.filter(task => {
      if (timeFilter === 'noDate') return !task.dueDate;
      if (!task.dueDate) return false;
      
      const dueDate = new Date(task.dueDate);
      switch (timeFilter) {
        case 'today':
          return isToday(dueDate);
        case 'week':
          return isWithinInterval(dueDate, { start: startOfWeek(now), end: endOfWeek(now) });
        case 'month':
          return isWithinInterval(dueDate, { start: startOfMonth(now), end: endOfMonth(now) });
        default:
          return true;
      }
    });
  }, [categoryFilteredTasks, timeFilter]);

  // Organize tasks into parent-child hierarchy
  const { parentTasks, subtasksByParent } = useMemo(() => {
    const parents = filteredTasks.filter(t => !t.parentId);
    const subtasks: Record<string, Task[]> = {};
    
    filteredTasks.forEach(task => {
      if (task.parentId) {
        if (!subtasks[task.parentId]) subtasks[task.parentId] = [];
        subtasks[task.parentId].push(task);
      }
    });
    
    return { parentTasks: parents, subtasksByParent: subtasks };
  }, [filteredTasks]);

  const incompleteTasks = parentTasks.filter(t => !t.completed);
  const completedTasks = parentTasks.filter(t => t.completed);

  const handleAddTask = (parentId?: string) => {
    if (newTaskTitle.trim()) {
      onAddTask({
        title: newTaskTitle.trim(),
        category: (filter === 'all' || filter === 'shared') ? 'personal' : filter,
        priority: 'medium',
        completed: false,
        dueDate: newTaskDueDate,
        recurrenceRule: newTaskRecurrence,
        parentId: parentId,
        sortOrder: tasks.length,
      });
      setNewTaskTitle('');
      setNewTaskDueDate(undefined);
      setNewTaskRecurrence(undefined);
      setIsAdding(false);
      setAddingSubtaskFor(null);
      setShowDueDatePicker(false);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (over && active.id !== over.id && onReorderTasks) {
      const oldIndex = incompleteTasks.findIndex(t => t.id === active.id);
      const newIndex = incompleteTasks.findIndex(t => t.id === over.id);
      
      if (oldIndex !== -1 && newIndex !== -1) {
        const reordered = arrayMove(incompleteTasks, oldIndex, newIndex);
        const taskOrders = reordered.map((task, index) => ({
          id: task.id,
          sortOrder: index,
        }));
        onReorderTasks(taskOrders);
      }
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
    
    if (onDeleteTasks) {
      await onDeleteTasks(idsToDelete);
    } else {
      for (const id of idsToDelete) {
        await onDeleteTask(id);
      }
    }
    clearSelection();
  };

  const handleAddSubtask = (parentId: string) => {
    setAddingSubtaskFor(parentId);
    setNewTaskTitle('');
  };

  const AddTaskForm = ({ parentId }: { parentId?: string }) => (
    <div className={cn(
      "p-3 mb-2 rounded-lg bg-muted/50 border border-border animate-scale-in",
      parentId && "ml-6"
    )}>
      <Input
        value={newTaskTitle}
        onChange={(e) => setNewTaskTitle(e.target.value)}
        placeholder={parentId ? t('taskList.addSubtask') + "..." : t('taskList.newTask')}
        className="mb-2"
        autoFocus
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleAddTask(parentId);
          if (e.key === 'Escape') {
            setIsAdding(false);
            setAddingSubtaskFor(null);
          }
        }}
      />
      <div className="flex gap-2 justify-between items-center flex-wrap">
        <div className="flex gap-2">
          {/* Due Date Picker */}
          <Popover open={showDueDatePicker} onOpenChange={setShowDueDatePicker}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1">
              <CalendarIcon className="w-4 h-4" />
              {newTaskDueDate ? format(newTaskDueDate, 'MMM d', { locale: dateLocale }) : t('common.dueDate')}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={newTaskDueDate}
                onSelect={(date) => {
                  setNewTaskDueDate(date);
                  setShowDueDatePicker(false);
                }}
                initialFocus
              />
            </PopoverContent>
          </Popover>
          
          {!parentId && (
            <RecurrenceSelector
              value={newTaskRecurrence}
              onChange={setNewTaskRecurrence}
            />
          )}
        </div>
        
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => {
            setIsAdding(false);
            setAddingSubtaskFor(null);
            setNewTaskRecurrence(undefined);
            setNewTaskDueDate(undefined);
          }}>
            {t('common.cancel')}
          </Button>
          <Button size="sm" onClick={() => handleAddTask(parentId)}>
            {parentId ? t('taskList.addSubtask') : t('taskList.addTask')}
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      {/* Category Filter Tabs */}
      <div className="px-4 pt-3 pb-2 border-b border-border">
        <div className="flex gap-1 flex-wrap">
          {categoryFilters.map((item) => (
            <Button
              key={item.filter}
              variant={filter === item.filter ? 'secondary' : 'ghost'}
              size="sm"
              className={cn(
                "h-8 px-3 text-xs",
                filter === item.filter && "bg-primary text-primary-foreground"
              )}
              onClick={() => handleFilterChange(item.filter)}
            >
              {item.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Header */}
      <div className="h-14 px-4 flex items-center justify-between border-b border-border">
        <div className="flex items-center gap-3">
          <h2 className="font-semibold">
            {t('nav.tasks')}
            <span className="ml-2 text-sm text-muted-foreground font-normal">
              {incompleteTasks.length} {language === 'de' ? 'übrig' : 'remaining'}
            </span>
          </h2>
          {/* Due Date Filter */}
          <Select value={timeFilter} onValueChange={(v) => setTimeFilter(v as TimeFilter | 'all')}>
            <SelectTrigger className="h-8 w-[130px] text-xs">
              <Filter className="w-3 h-3 mr-1" />
              <SelectValue placeholder={t('common.dueDate')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('time.all')}</SelectItem>
              <SelectItem value="today">{t('time.today')}</SelectItem>
              <SelectItem value="week">{t('time.week')}</SelectItem>
              <SelectItem value="month">{t('time.month')}</SelectItem>
              <SelectItem value="noDate">{t('time.noDate')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
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
                {t('common.all')}
              </Button>
              <Button 
                variant="destructive" 
                size="sm"
                onClick={handleBulkDelete}
                disabled={selectedTasks.size === 0}
              >
                <Trash2 className="w-4 h-4 mr-1" />
                {t('common.delete')} ({selectedTasks.size})
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
                {language === 'de' ? 'Auswählen' : 'Select'}
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                className="gap-1"
                onClick={() => setIsAdding(true)}
              >
                <Plus className="w-4 h-4" />
                {t('common.add')}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Task List */}
      <div className="flex-1 overflow-y-auto p-2">
        {/* Add Task Input */}
        {isAdding && <AddTaskForm />}

        {/* Incomplete Tasks with Drag and Drop */}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={incompleteTasks.map(t => t.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-1">
              {incompleteTasks.map(task => (
                <div key={task.id}>
                <SortableTaskItem
                    task={task}
                    subtasks={subtasksByParent[task.id] || []}
                    isSelectMode={isSelectMode}
                    selectedTasks={selectedTasks}
                    toggleSelectTask={toggleSelectTask}
                    onToggleComplete={onToggleComplete}
                    onDeleteTask={onDeleteTask}
                    onShareTask={onShareTask}
                    onUpdateTask={onUpdateTask}
                    onEditTask={setEditingTask}
                    onAddSubtask={handleAddSubtask}
                    compactMode={compactMode}
                  />
                  {addingSubtaskFor === task.id && <AddTaskForm parentId={task.id} />}
                </div>
              ))}
            </div>
          </SortableContext>
        </DndContext>

        {/* Completed Tasks */}
        {completedTasks.length > 0 && (
          <div className="mt-4">
            <div className="px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {t('taskList.completed')} ({completedTasks.length})
            </div>
            <div className="space-y-1">
              {completedTasks.map(task => (
                <SortableTaskItem
                  key={task.id}
                  task={task}
                  subtasks={subtasksByParent[task.id] || []}
                  isSelectMode={isSelectMode}
                  selectedTasks={selectedTasks}
                  toggleSelectTask={toggleSelectTask}
                  onToggleComplete={onToggleComplete}
                  onDeleteTask={onDeleteTask}
                  onShareTask={onShareTask}
                  onUpdateTask={onUpdateTask}
                  onEditTask={setEditingTask}
                  onAddSubtask={handleAddSubtask}
                  compactMode={compactMode}
                />
              ))}
            </div>
          </div>
        )}

        {filteredTasks.length === 0 && !isAdding && (
          <div className="flex flex-col items-center justify-center h-40 text-center">
            <CheckCircle2 className="w-10 h-10 text-muted-foreground/30 mb-2" />
            <p className="text-sm text-muted-foreground">{t('taskList.noTasks')}</p>
            <Button 
              variant="link" 
              size="sm" 
              className="text-primary"
              onClick={() => setIsAdding(true)}
            >
              {t('taskList.startAdding')}
            </Button>
          </div>
        )}
      </div>

      {/* Edit Task Modal */}
      {editingTask && onUpdateTask && (
        <EditTaskModal
          task={editingTask}
          onClose={() => setEditingTask(null)}
          onSave={onUpdateTask}
          onDelete={onDeleteTask}
          onAddSubtasks={(parentId, subtasks) => {
            subtasks.forEach((subtask) => {
              onAddTask({
                title: subtask.title,
                priority: subtask.priority,
                category: editingTask.category,
                completed: false,
                parentId,
                sortOrder: tasks.length,
              });
            });
            setEditingTask(null);
          }}
          projects={projects}
          contacts={contacts}
        />
      )}
    </div>
  );
}
