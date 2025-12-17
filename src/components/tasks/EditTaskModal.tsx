import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Task, TaskPriority, TaskCategory } from '@/types/flux';
import { RecurrenceSelector } from '@/components/shared/RecurrenceSelector';
import { getRecurrenceDescription, recurrencePresets, toRRuleString } from '@/lib/recurrence';
import { X, Calendar as CalendarIcon, Trash2, Repeat, Bell, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { RecurrenceFrequency } from '@/types/flux';

interface EditTaskModalProps {
  task: Task;
  onClose: () => void;
  onSave: (id: string, updates: Partial<Task>) => void;
  onDelete: (id: string) => void;
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

export function EditTaskModal({ task, onClose, onSave, onDelete }: EditTaskModalProps) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description || '');
  const [priority, setPriority] = useState<TaskPriority>(task.priority);
  const [category, setCategory] = useState<TaskCategory>(task.category);
  const [dueDate, setDueDate] = useState<Date | undefined>(task.dueDate);
  const [recurrenceRule, setRecurrenceRule] = useState<string | undefined>(task.recurrenceRule);
  const [reminderBefore, setReminderBefore] = useState<number>(task.reminderBefore ?? 0);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showRecurrenceEditor, setShowRecurrenceEditor] = useState(false);
  
  // Custom recurrence state
  const [customFrequency, setCustomFrequency] = useState<RecurrenceFrequency>('weekly');
  const [customInterval, setCustomInterval] = useState(1);
  const [customDays, setCustomDays] = useState<number[]>([]);
  const [customEndDate, setCustomEndDate] = useState<Date | undefined>();

  const handleSave = () => {
    if (!title.trim()) return;
    
    onSave(task.id, {
      title: title.trim(),
      description: description.trim() || undefined,
      priority,
      category,
      dueDate,
      recurrenceRule,
      reminderBefore: reminderBefore > 0 ? reminderBefore : undefined,
    });
    onClose();
  };

  const handleDelete = () => {
    onDelete(task.id);
    onClose();
  };

  const handlePresetRecurrence = (preset: string) => {
    setRecurrenceRule(preset);
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

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="glass-panel-solid w-full max-w-md animate-scale-in max-h-[90vh] overflow-hidden flex flex-col">
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

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              rows={2}
            />
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

          {/* Due Date */}
          <div className="space-y-2">
            <Label>Due Date</Label>
            <Popover open={showDatePicker} onOpenChange={setShowDatePicker}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start gap-2">
                  <CalendarIcon className="w-4 h-4" />
                  {dueDate ? format(dueDate, 'PPP') : 'No due date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dueDate}
                  onSelect={(date) => {
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
          <Button variant="destructive" size="sm" onClick={handleDelete}>
            <Trash2 className="w-4 h-4 mr-2" />
            Delete
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSave}>Save Changes</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
