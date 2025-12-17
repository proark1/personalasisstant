import { useState, useRef, useEffect, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Plus, X, Sparkles, Calendar, Flag, Folder } from 'lucide-react';
import { parseTaskInput } from '@/lib/taskParser';
import { detectProjectFromText } from '@/lib/projectDetection';
import { Task, Project } from '@/types/flux';
import { format } from 'date-fns';

interface QuickAddFABProps {
  onAddTask: (task: Omit<Task, 'id' | 'createdAt'>) => void;
  projects?: Project[];
}

export function QuickAddFAB({ onAddTask, projects = [] }: QuickAddFABProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState<string | undefined>();
  const inputRef = useRef<HTMLInputElement>(null);

  const parsedTask = input.trim() ? parseTaskInput(input) : null;
  
  // Detect project from input text
  const projectSuggestion = useMemo(() => {
    if (!input.trim() || projects.length === 0) return null;
    return detectProjectFromText(input, projects);
  }, [input, projects]);

  // Auto-select suggested project if user hasn't manually selected one
  useEffect(() => {
    if (projectSuggestion && !selectedProjectId) {
      // Only auto-suggest, don't auto-select
    }
  }, [projectSuggestion, selectedProjectId]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Keyboard shortcut to open (Ctrl/Cmd + Shift + A)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'a') {
        e.preventDefault();
        setIsOpen(true);
      }
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
        setInput('');
        setSelectedProjectId(undefined);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
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
    <>
      {/* Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-background/60 backdrop-blur-sm z-40"
          onClick={() => {
            setIsOpen(false);
            setInput('');
            setSelectedProjectId(undefined);
          }}
        />
      )}

      {/* FAB */}
      <div className="fixed bottom-6 right-6 z-50">
        {isOpen ? (
          <div className="animate-scale-in w-80 glass-panel-solid p-4 shadow-2xl">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Sparkles className="w-4 h-4 text-primary" />
                Quick Add
              </div>
              <Button
                variant="ghost"
                size="iconSm"
                onClick={() => {
                  setIsOpen(false);
                  setInput('');
                  setSelectedProjectId(undefined);
                }}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <form onSubmit={handleSubmit}>
              <Input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder='Try "Buy milk for family shopping"'
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

              <div className="flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground">
                  ⌘⇧A to open
                </span>
                <Button 
                  type="submit" 
                  size="sm"
                  disabled={!parsedTask?.title}
                >
                  Add Task
                </Button>
              </div>
            </form>
          </div>
        ) : (
          <Button
            size="lg"
            className="h-14 w-14 rounded-full shadow-lg glow-primary hover:scale-110 transition-transform"
            onClick={() => setIsOpen(true)}
          >
            <Plus className="w-6 h-6" />
          </Button>
        )}
      </div>
    </>
  );
}
