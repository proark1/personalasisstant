import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Task, TaskPriority, TaskCategory, Project, ChecklistItem } from '@/types/flux';
import type { Contact } from '@/hooks/useContacts';
import { recurrencePresets, toRRuleString, getRecurrenceDescription, parseRRuleString } from '@/lib/recurrence';
import { X, Calendar as CalendarIcon, Trash2, Repeat, Bell, Clock, User, Users, FolderOpen, Plus, Check, Sparkles } from 'lucide-react';
import { format } from 'date-fns';
import { RecurrenceFrequency } from '@/types/flux';
import { Checkbox } from '@/components/ui/checkbox';
import { TaskBreakdownDialog } from '@/components/ai/TaskBreakdownDialog';
import { useToast } from '@/hooks/use-toast';
import { useSpaceMembers } from '@/hooks/useSpaceMembers';
import { useAuth } from '@/hooks/useAuth';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';


interface EditTaskModalProps {
  task: Task;
  onClose: () => void;
  onSave: (id: string, updates: Partial<Task>) => Promise<void> | void;
  onDelete: (id: string) => void;
  onAddSubtasks?: (parentId: string, subtasks: { title: string; priority: 'high' | 'medium' | 'low' }[]) => void;
  projects?: Project[];
  contacts?: Contact[];
}

const REMINDER_OPTIONS = [
  { value: 0, label: 'No reminder' },
  { value: 15, label: '15 minutes before' },
  { value: 30, label: '30 minutes before' },
  { value: 60, label: '1 hour before' },
  { value: 120, label: '2 hours before' },
  { value: 1440, label: '1 day before' },
  { value: 2880, label: '2 days before' },
  { value: 10080, label: '1 week before' },
];

const WEEKDAYS = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 0, label: 'Sun' },
];

export function EditTaskModal({ task, onClose, onSave, onDelete, onAddSubtasks, projects = [], contacts = [] }: EditTaskModalProps) {
  const { toast } = useToast();
  const { online } = useNetworkStatus();
  const { user, profile } = useAuth();
  const { members } = useSpaceMembers(user?.id);
  
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description || '');
  const [priority, setPriority] = useState<TaskPriority>(task.priority);
  const [category, setCategory] = useState<TaskCategory>(task.category);
  const [dueDate, setDueDate] = useState<Date | undefined>(task.dueDate);
  const [recurrenceRule, setRecurrenceRule] = useState<string | undefined>(task.recurrenceRule);
  const [reminderBefore, setReminderBefore] = useState<number>(task.reminderBefore ?? 0);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showRecurrenceEditor, setShowRecurrenceEditor] = useState(false);
  const [projectId, setProjectId] = useState<string | undefined>(task.projectId);
  const [mainResponsibleId, setMainResponsibleId] = useState<string | undefined>(task.mainResponsibleId);
  const [secondaryResponsibleId, setSecondaryResponsibleId] = useState<string | undefined>(task.secondaryResponsibleId);
  const [checklist, setChecklist] = useState<ChecklistItem[]>(task.checklist || []);
  const [newChecklistItem, setNewChecklistItem] = useState('');
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Build list of assignable people: current user + accepted space members
  // Uses profile IDs since main_responsible_id references profiles.id
  const assignablePeople = useMemo(() => {
    const people: { id: string; name: string }[] = [];
    
    // Add current user first (using profile.id, not user.id)
    if (profile?.id) {
      people.push({
        id: profile.id,
        name: profile.display_name || profile.email || user?.email || 'Me',
      });
    }
    
    // Add accepted space members (using their profile.id)
    members
      .filter(m => m.status === 'accepted' && m.member_profile?.id)
      .forEach(m => {
        people.push({
          id: m.member_profile!.id,
          name: m.member_profile?.display_name || m.member_profile?.email || m.member_email,
        });
      });
    
    return people;
  }, [user, profile, members]);

  // Parse existing recurrence rule for custom controls
  const existingRule = task.recurrenceRule ? parseRRuleString(task.recurrenceRule) : null;

  // Custom recurrence state - initialize from existing rule if present
  const [customFrequency, setCustomFrequency] = useState<RecurrenceFrequency>(existingRule?.frequency || 'weekly');
  const [customInterval, setCustomInterval] = useState(existingRule?.interval || 1);
  const [customDays, setCustomDays] = useState<number[]>(existingRule?.daysOfWeek || []);
  const [customEndDate, setCustomEndDate] = useState<Date | undefined>(existingRule?.endDate);
  const handleSave = async () => {
    if (!title.trim() || isSaving) return;

    if (!online) {
      toast({
        title: 'Offline',
        description: 'Reconnect to the internet to save changes.',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);

    try {
      await Promise.resolve(
        onSave(task.id, {
          title: title.trim(),
          description: description.trim() || undefined,
          priority,
          category,
          dueDate,
          recurrenceRule,
          reminderBefore: reminderBefore > 0 ? reminderBefore : undefined,
          projectId,
          mainResponsibleId,
          secondaryResponsibleId,
          checklist,
        })
      );
      toast({ title: 'Saved' });
      onClose();
    } catch (e: any) {
      console.error('Failed to save task:', e);
      toast({
        title: 'Save failed',
        description: e?.message ? String(e.message) : 'Please try again',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = () => {
    onDelete(task.id);
    onClose();
  };

  const handlePresetRecurrence = (preset: string) => {
    setRecurrenceRule(preset);
    // Also sync the custom state variables so they stay in sync
    const parsedPreset = parseRRuleString(preset);
    if (parsedPreset) {
      setCustomFrequency(parsedPreset.frequency);
      setCustomInterval(parsedPreset.interval);
      setCustomDays(parsedPreset.daysOfWeek || []);
      setCustomEndDate(parsedPreset.endDate);
    }
    setShowRecurrenceEditor(false);
  };

  const handleCustomRecurrenceApply = () => {
    const rule = toRRuleString({
      frequency: customFrequency,
      interval: customInterval,
      daysOfWeek: customFrequency === 'weekly' ? customDays : undefined,
      endDate: customEndDate,
    });
    setRecurrenceRule(rule);
    setShowRecurrenceEditor(false);
  };

  const toggleDay = (day: number) => {
    setCustomDays(prev => 
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  const addChecklistItem = () => {
    if (!newChecklistItem.trim()) return;
    setChecklist(prev => [...prev, {
      id: crypto.randomUUID(),
      text: newChecklistItem.trim(),
      completed: false,
    }]);
    setNewChecklistItem('');
  };

  const toggleChecklistItem = (id: string) => {
    setChecklist(prev => prev.map(item =>
      item.id === id ? { ...item, completed: !item.completed } : item
    ));
  };

  const removeChecklistItem = (id: string) => {
    setChecklist(prev => prev.filter(item => item.id !== id));
  };

  const getPersonDisplay = (personId: string | undefined) => {
    if (!personId) return 'Not assigned';
    const person = assignablePeople.find(p => p.id === personId);
    return person?.name || 'Unknown';
  };

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-start sm:items-center justify-center p-2 sm:p-4 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] overflow-y-auto">
      <div className="glass-panel-solid w-full max-w-lg animate-scale-in max-h-[calc(100vh-1rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] sm:max-h-[90vh] overflow-hidden flex flex-col my-1 sm:my-0 rounded-lg">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
          <h2 className="text-lg font-semibold">Edit Task</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4 overflow-y-auto flex-1">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Task title"
              autoFocus
            />
          </div>

          {/* Description with Markdown support hint */}
          <div className="space-y-2">
            <Label htmlFor="description">Description (Markdown supported)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description - supports **bold**, *italic*, - lists..."
              rows={3}
            />
          </div>

          {/* Project */}
          {projects.length > 0 && (
            <div className="space-y-2">
              <Label>Project</Label>
              <Select value={projectId || '_none'} onValueChange={(v) => setProjectId(v === '_none' ? undefined : v)}>
                <SelectTrigger>
                  <div className="flex items-center gap-2">
                    <FolderOpen className="w-4 h-4" />
                    <SelectValue placeholder="Select project" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">No project</SelectItem>
                  {projects.filter(p => !p.isArchived).map(project => (
                    <SelectItem key={project.id} value={project.id}>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: project.color }} />
                        {project.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Responsibles */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Main Responsible</Label>
              <Select value={mainResponsibleId || '_none'} onValueChange={(v) => setMainResponsibleId(v === '_none' ? undefined : v)}>
                <SelectTrigger>
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4" />
                    <span className="truncate">{getPersonDisplay(mainResponsibleId)}</span>
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Not assigned</SelectItem>
                  {assignablePeople.map(person => (
                    <SelectItem key={person.id} value={person.id}>
                      {person.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Secondary Responsible</Label>
              <Select value={secondaryResponsibleId || '_none'} onValueChange={(v) => setSecondaryResponsibleId(v === '_none' ? undefined : v)}>
                <SelectTrigger>
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    <span className="truncate">{getPersonDisplay(secondaryResponsibleId)}</span>
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Not assigned</SelectItem>
                  {assignablePeople.map(person => (
                    <SelectItem key={person.id} value={person.id}>
                      {person.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Priority & Category */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={(v: TaskPriority) => setPriority(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={category} onValueChange={(v: TaskCategory) => setCategory(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="personal">Personal</SelectItem>
                  <SelectItem value="business">Business</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Due Date & Time */}
          <div className="space-y-2">
            <Label>Due Date & Time</Label>
            <div className="flex gap-2">
              <Popover open={showDatePicker} onOpenChange={setShowDatePicker}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="flex-1 justify-start gap-2">
                    <CalendarIcon className="w-4 h-4" />
                    {dueDate ? format(dueDate, 'PPP') : 'No due date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dueDate}
                    onSelect={(date) => {
                      if (date) {
                        const hours = dueDate?.getHours() || 9;
                        const minutes = dueDate?.getMinutes() || 0;
                        date.setHours(hours, minutes, 0, 0);
                      }
                      setDueDate(date);
                      setShowDatePicker(false);
                    }}
                    initialFocus
                    className="pointer-events-auto"
                  />
                  {dueDate && (
                    <div className="p-2 border-t">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full text-destructive hover:text-destructive"
                        onClick={() => {
                          setDueDate(undefined);
                          setShowDatePicker(false);
                        }}
                      >
                        Clear due date
                      </Button>
                    </div>
                  )}
                </PopoverContent>
              </Popover>
              {dueDate && (
                <div className="flex items-center gap-1">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <Input
                    type="time"
                    value={dueDate ? format(dueDate, 'HH:mm') : '09:00'}
                    onChange={(e) => {
                      if (dueDate && e.target.value) {
                        const [hours, minutes] = e.target.value.split(':').map(Number);
                        const newDate = new Date(dueDate);
                        newDate.setHours(hours, minutes, 0, 0);
                        setDueDate(newDate);
                      }
                    }}
                    className="w-24"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Recurrence */}
          <div className="space-y-2">
            <Label>Recurrence</Label>
            <Popover open={showRecurrenceEditor} onOpenChange={setShowRecurrenceEditor}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start gap-2">
                  <Repeat className={cn("w-4 h-4", recurrenceRule && "text-primary")} />
                  {recurrenceRule ? getRecurrenceDescription(recurrenceRule) : 'No recurrence'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-0" align="start">
                <div className="p-2 space-y-1">
                  {recurrenceRule && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => {
                        setRecurrenceRule(undefined);
                        setShowRecurrenceEditor(false);
                      }}
                    >
                      <X className="w-4 h-4 mr-2" />
                      Don't repeat
                    </Button>
                  )}
                  {recurrencePresets.map((preset) => (
                    <Button
                      key={preset.value}
                      variant={recurrenceRule === preset.value ? 'secondary' : 'ghost'}
                      size="sm"
                      className="w-full justify-start"
                      onClick={() => handlePresetRecurrence(preset.value)}
                    >
                      {preset.label}
                    </Button>
                  ))}
                  <div className="border-t border-border my-2" />
                  <div className="p-2 space-y-3">
                    <h4 className="font-medium text-sm">Custom Recurrence</h4>
                    <div className="flex items-center gap-2">
                      <span className="text-sm w-12">Every</span>
                      <Select value={customInterval.toString()} onValueChange={(v) => setCustomInterval(parseInt(v))}>
                        <SelectTrigger className="w-16">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[1, 2, 3, 4, 5, 6].map(n => (
                            <SelectItem key={n} value={n.toString()}>{n}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select value={customFrequency} onValueChange={(v) => setCustomFrequency(v as RecurrenceFrequency)}>
                        <SelectTrigger className="flex-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="daily">Day(s)</SelectItem>
                          <SelectItem value="weekly">Week(s)</SelectItem>
                          <SelectItem value="monthly">Month(s)</SelectItem>
                          <SelectItem value="yearly">Year(s)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {customFrequency === 'weekly' && (
                      <div>
                        <Label className="text-xs mb-1.5 block">On days</Label>
                        <div className="flex gap-1">
                          {WEEKDAYS.map(day => (
                            <Button
                              key={day.value}
                              variant={customDays.includes(day.value) ? 'default' : 'outline'}
                              size="sm"
                              className="w-8 h-8 p-0 text-xs"
                              onClick={() => toggleDay(day.value)}
                            >
                              {day.label[0]}
                            </Button>
                          ))}
                        </div>
                      </div>
                    )}
                    <Button size="sm" className="w-full" onClick={handleCustomRecurrenceApply}>
                      Apply Custom
                    </Button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {/* Checklist */}
          <div className="space-y-2">
            <Label>Checklist</Label>
            <div className="space-y-2">
              {checklist.map(item => (
                <div key={item.id} className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                  <Checkbox
                    checked={item.completed}
                    onCheckedChange={() => toggleChecklistItem(item.id)}
                  />
                  <span className={cn("flex-1 text-sm", item.completed && "line-through text-muted-foreground")}>
                    {item.text}
                  </span>
                  <Button variant="ghost" size="iconSm" onClick={() => removeChecklistItem(item.id)}>
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              ))}
              <div className="flex gap-2">
                <Input
                  value={newChecklistItem}
                  onChange={(e) => setNewChecklistItem(e.target.value)}
                  placeholder="Add checklist item..."
                  onKeyDown={(e) => e.key === 'Enter' && addChecklistItem()}
                />
                <Button size="sm" onClick={addChecklistItem} disabled={!newChecklistItem.trim()}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Reminder */}
          <div className="space-y-2">
            <Label>Reminder</Label>
            <Select 
              value={reminderBefore.toString()} 
              onValueChange={(v) => setReminderBefore(parseInt(v))}
            >
              <SelectTrigger>
                <div className="flex items-center gap-2">
                  <Bell className={cn("w-4 h-4", reminderBefore > 0 && "text-primary")} />
                  <SelectValue />
                </div>
              </SelectTrigger>
              <SelectContent>
                {REMINDER_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value.toString()}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Get notified before the task is due
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-border shrink-0">
          <div className="flex gap-1 sm:gap-2">
            <Button variant="destructive" size="sm" onClick={handleDelete} className="px-2 sm:px-3">
              <Trash2 className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Delete</span>
            </Button>
            {onAddSubtasks && !task.parentId && (
              <Button variant="outline" size="sm" onClick={() => setShowBreakdown(true)} className="px-2 sm:px-3">
                <Sparkles className="w-4 h-4 sm:mr-2 text-primary" />
                <span className="hidden sm:inline">AI Breakdown</span>
              </Button>
            )}
          </div>
          <div className="flex gap-1 sm:gap-2">
            <Button variant="outline" size="sm" onClick={onClose} className="px-2 sm:px-3">
              <X className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Cancel</span>
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleSave();
              }}
              disabled={!online || isSaving || !title.trim()}
              className="px-2 sm:px-3"
              aria-label="Save task"
            >
              <Check className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">{isSaving ? 'Saving...' : online ? 'Save Changes' : 'Offline'}</span>
            </Button>
          </div>
        </div>
      </div>

      {/* AI Breakdown Dialog */}
      {onAddSubtasks && (
        <TaskBreakdownDialog
          task={task}
          open={showBreakdown}
          onOpenChange={setShowBreakdown}
          onAddSubtasks={(subtasks) => {
            onAddSubtasks(task.id, subtasks);
            setShowBreakdown(false);
          }}
        />
      )}
    </div>
  );
}
