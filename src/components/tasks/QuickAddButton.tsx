import { useState, useRef, useEffect, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Plus, Sparkles, Calendar, Flag, Folder, X } from 'lucide-react';
import { parseTaskInput } from '@/lib/taskParser';
import { detectProjectFromText } from '@/lib/projectDetection';
import { Task, Project } from '@/types/flux';
import { format } from 'date-fns';

interface QuickAddButtonProps {
  onAddTask: (task: Omit<Task, 'id' | 'createdAt'>) => void;
  projects?: Project[];
}

export function QuickAddButton({ onAddTask, projects = [] }: QuickAddButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState<string | undefined>();
  const inputRef = useRef<HTMLInputElement>(null);

  const parsedTask = input.trim() ? parseTaskInput(input) : null;
  
  const projectSuggestion = useMemo(() => {
    if (!input.trim() || projects.length === 0) return null;
    return detectProjectFromText(input, projects);
  }, [input, projects]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!parsedTask || !parsedTask.title) return;

    onAddTask({
      title: parsedTask.title,
      priority: parsedTask.priority,
      category: parsedTask.category,
      completed: false,
      dueDate: parsedTask.dueDate,
      sortOrder: 0,
      projectId: selectedProjectId || projectSuggestion?.project.id,
    });

    setInput('');
    setSelectedProjectId(undefined);
    setIsOpen(false);
  };

  const handleAcceptSuggestion = () => {
    if (projectSuggestion) {
      setSelectedProjectId(projectSuggestion.project.id);
    }
  };

  const handleClearProject = () => {
    setSelectedProjectId(undefined);
  };

  const priorityColors = {
    high: 'text-destructive',
    medium: 'text-warning',
    low: 'text-muted-foreground',
  };

  const activeProject = selectedProjectId 
    ? projects.find(p => p.id === selectedProjectId)
    : projectSuggestion?.project;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
        >
          <Plus className="w-5 h-5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-80 p-3" 
        align="end"
        sideOffset={8}
      >
        <div className="flex items-center gap-2 text-sm font-medium mb-3">
          <Sparkles className="w-4 h-4 text-primary" />
          Quick Add Task
        </div>

        <form onSubmit={handleSubmit}>
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder='Try "Buy milk tomorrow high priority"'
            className="mb-3"
          />

          {/* Project suggestion chip */}
          {projectSuggestion && !selectedProjectId && (
            <div className="mb-3 flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Suggested:</span>
              <Badge 
                variant="outline" 
                className="cursor-pointer hover:bg-primary/10 transition-colors"
                onClick={handleAcceptSuggestion}
              >
                <div 
                  className="w-2 h-2 rounded-full mr-1.5"
                  style={{ backgroundColor: projectSuggestion.project.color }}
                />
                {projectSuggestion.project.name}
              </Badge>
            </div>
          )}

          {/* Selected project */}
          {selectedProjectId && activeProject && (
            <div className="mb-3 flex items-center gap-2">
              <Badge variant="secondary" className="flex items-center gap-1.5">
                <div 
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: activeProject.color }}
                />
                {activeProject.name}
                <button 
                  type="button"
                  onClick={handleClearProject}
                  className="ml-1 hover:text-destructive"
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            </div>
          )}

          {/* Preview parsed result */}
          {parsedTask && parsedTask.title && (
            <div className="text-xs space-y-1.5 mb-3 p-2 bg-muted/50 rounded-lg">
              <div className="font-medium text-foreground truncate">
                {parsedTask.title}
              </div>
              <div className="flex items-center gap-3 text-muted-foreground flex-wrap">
                {parsedTask.dueDate && (
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {format(parsedTask.dueDate, 'MMM d, h:mm a')}
                  </span>
                )}
                <span className={cn("flex items-center gap-1", priorityColors[parsedTask.priority])}>
                  <Flag className="w-3 h-3" />
                  {parsedTask.priority}
                </span>
                {activeProject && (
                  <span className="flex items-center gap-1">
                    <Folder className="w-3 h-3" />
                    {activeProject.name}
                  </span>
                )}
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <Button 
              type="submit" 
              size="sm"
              disabled={!parsedTask?.title}
            >
              Add Task
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}
