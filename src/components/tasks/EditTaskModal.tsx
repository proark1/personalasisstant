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
import { getRecurrenceDescription } from '@/lib/recurrence';
import { X, Calendar as CalendarIcon, Trash2, Repeat } from 'lucide-react';
import { format } from 'date-fns';

interface EditTaskModalProps {
  task: Task;
  onClose: () => void;
  onSave: (id: string, updates: Partial<Task>) => void;
  onDelete: (id: string) => void;
}

export function EditTaskModal({ task, onClose, onSave, onDelete }: EditTaskModalProps) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description || '');
  const [priority, setPriority] = useState<TaskPriority>(task.priority);
  const [category, setCategory] = useState<TaskCategory>(task.category);
  const [dueDate, setDueDate] = useState<Date | undefined>(task.dueDate);
  const [recurrenceRule, setRecurrenceRule] = useState<string | undefined>(task.recurrenceRule);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showRecurrence, setShowRecurrence] = useState(false);

  const handleSave = () => {
    if (!title.trim()) return;
    
    onSave(task.id, {
      title: title.trim(),
      description: description.trim() || undefined,
      priority,
      category,
      dueDate,
      recurrenceRule,
    });
    onClose();
  };

  const handleDelete = () => {
    onDelete(task.id);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="glass-panel-solid w-full max-w-md animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold">Edit Task</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
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
              rows={3}
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
            {recurrenceRule ? (
              <div className="flex items-center justify-between p-2 rounded-md bg-muted">
                <span className="flex items-center gap-2 text-sm">
                  <Repeat className="w-4 h-4 text-primary" />
                  {getRecurrenceDescription(recurrenceRule)}
                </span>
                <Button variant="ghost" size="sm" onClick={() => setRecurrenceRule(undefined)}>
                  Clear
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                className="w-full justify-start gap-2"
                onClick={() => setShowRecurrence(true)}
              >
                <Repeat className="w-4 h-4" />
                Add recurrence
              </Button>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-border">
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

      {/* Recurrence Selector Dialog */}
      {showRecurrence && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="glass-panel-solid w-full max-w-sm animate-scale-in p-4">
            <RecurrenceSelector
              value={recurrenceRule}
              onChange={(v) => {
                setRecurrenceRule(v);
                setShowRecurrence(false);
              }}
            />
            <Button
              variant="ghost"
              className="w-full mt-2"
              onClick={() => setShowRecurrence(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
