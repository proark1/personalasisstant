import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Card, CardContent } from '@/components/ui/card';
import { TaskTemplate, useTaskTemplates } from '@/hooks/useTaskTemplates';
import { TaskCategory, TaskPriority } from '@/types/flux';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from 'sonner';
import { 
  LayoutTemplate, 
  Plus, 
  Trash2, 
  Sparkles,
  Briefcase,
  User,
  ChevronDown
} from 'lucide-react';

interface TaskTemplatesProps {
  onCreateFromTemplate: (template: TaskTemplate) => void;
}

// Pre-built template presets
const PRESET_TEMPLATES: Omit<TaskTemplate, 'id' | 'createdAt'>[] = [
  {
    name: 'Morning Routine',
    title: 'Complete morning routine',
    description: 'Exercise, shower, healthy breakfast',
    category: 'personal',
    priority: 'high',
    recurrenceRule: 'FREQ=DAILY',
  },
  {
    name: 'Weekly Review',
    title: 'Weekly planning & review',
    description: 'Review completed tasks, plan next week',
    category: 'business',
    priority: 'high',
    recurrenceRule: 'FREQ=WEEKLY;BYDAY=SU',
  },
  {
    name: 'Email Check',
    title: 'Process inbox to zero',
    description: 'Clear email inbox and respond to urgent items',
    category: 'business',
    priority: 'medium',
    recurrenceRule: 'FREQ=DAILY',
  },
  {
    name: 'Team Standup',
    title: 'Daily team standup meeting',
    description: 'Share updates and blockers with the team',
    category: 'business',
    priority: 'high',
    recurrenceRule: 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR',
  },
];

export function TaskTemplates({ onCreateFromTemplate }: TaskTemplatesProps) {
  const { t } = useLanguage();
  const { templates, createTemplate, deleteTemplate } = useTaskTemplates();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newTemplate, setNewTemplate] = useState<Omit<TaskTemplate, 'id' | 'createdAt'>>({
    name: '',
    title: '',
    description: '',
    category: 'personal',
    priority: 'medium',
  });

  const handleCreateTemplate = async () => {
    if (!newTemplate.name.trim() || !newTemplate.title.trim()) {
      toast.error(t('templates.toast.nameTitleRequired'));
      return;
    }

    const result = await createTemplate(newTemplate);
    if (result) {
      toast.success(t('templates.toast.created'));
      setShowCreateDialog(false);
      setNewTemplate({
        name: '',
        title: '',
        description: '',
        category: 'personal',
        priority: 'medium',
      });
    }
  };

  const handleUsePreset = async (preset: Omit<TaskTemplate, 'id' | 'createdAt'>) => {
    const result = await createTemplate(preset);
    if (result) {
      toast.success(t('templates.toast.added').replace('{name}', () => preset.name));
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    const { error } = await deleteTemplate(id);
    if (!error) {
      toast.success(t('templates.toast.deleted'));
    } else {
      toast.error(t('templates.toast.deleteFailed'));
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <LayoutTemplate className="w-4 h-4" />
          Templates
          <ChevronDown className="w-3 h-3" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <div className="p-3 border-b">
          <h4 className="font-medium text-sm">Task Templates</h4>
          <p className="text-xs text-muted-foreground">Quick task creation from saved templates</p>
        </div>

        <div className="max-h-[300px] overflow-y-auto p-2 space-y-2">
          {/* User Templates */}
          {templates.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground px-2 py-1">Your Templates</p>
              {templates.map(template => (
                <Card 
                  key={template.id} 
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                >
                  <CardContent className="p-2 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      className="flex-1 min-w-0 text-left"
                      onClick={() => onCreateFromTemplate(template)}
                    >
                      <div className="flex items-center gap-2">
                        {template.category === 'business' ? (
                          <Briefcase className="w-3 h-3 text-primary shrink-0" />
                        ) : (
                          <User className="w-3 h-3 text-accent shrink-0" />
                        )}
                        <span className="font-medium text-sm truncate">{template.name}</span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{template.title}</p>
                    </button>
                    <Button
                      variant="ghost"
                      size="iconSm"
                      className="shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteTemplate(template.id);
                      }}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Preset Templates */}
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground px-2 py-1">Quick Add Presets</p>
            {PRESET_TEMPLATES.map((preset, idx) => (
              <Card 
                key={idx} 
                className="cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => handleUsePreset(preset)}
              >
                <CardContent className="p-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-3 h-3 text-warning shrink-0" />
                    <span className="font-medium text-sm">{preset.name}</span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{preset.title}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <div className="p-2 border-t">
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="w-full gap-2">
                <Plus className="w-4 h-4" />
                Create Template
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Task Template</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Template Name</Label>
                  <Input
                    placeholder="e.g., Morning Routine"
                    value={newTemplate.name}
                    onChange={(e) => setNewTemplate(prev => ({ ...prev, name: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Task Title</Label>
                  <Input
                    placeholder="e.g., Complete morning routine"
                    value={newTemplate.title}
                    onChange={(e) => setNewTemplate(prev => ({ ...prev, title: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description (optional)</Label>
                  <Input
                    placeholder="Task description..."
                    value={newTemplate.description}
                    onChange={(e) => setNewTemplate(prev => ({ ...prev, description: e.target.value }))}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Category</Label>
                    <Select
                      value={newTemplate.category}
                      onValueChange={(val) => setNewTemplate(prev => ({ ...prev, category: val as TaskCategory }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="personal">Personal</SelectItem>
                        <SelectItem value="business">Business</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Priority</Label>
                    <Select
                      value={newTemplate.priority}
                      onValueChange={(val) => setNewTemplate(prev => ({ ...prev, priority: val as TaskPriority }))}
                    >
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
                </div>
                <Button onClick={handleCreateTemplate} className="w-full">
                  Create Template
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </PopoverContent>
    </Popover>
  );
}
