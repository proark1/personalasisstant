import { useState } from 'react';
import { Project, Task } from '@/types/flux';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { FolderPlus, Archive, Trash2, Pencil, Users } from 'lucide-react';
import { FamilyShoppingTemplate } from '../shopping/FamilyShoppingTemplate';

const PROJECT_COLORS = [
  '#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6',
  '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1',
];

interface Contact {
  id?: string;
  userId: string;
  email?: string;
  displayName?: string;
}

interface ProjectManagerProps {
  projects: Project[];
  tasks: Task[];
  contacts?: Contact[];
  onAddProject: (project: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Project | null>;
  onUpdateProject: (id: string, updates: Partial<Project>) => void;
  onDeleteProject: (id: string) => void;
  getProjectProgress: (projectId: string, tasks: { projectId?: string; completed: boolean }[]) => number;
  selectedProjectId?: string;
  onSelectProject?: (projectId: string | undefined) => void;
  onShareProject?: (projectId: string, projectName: string) => void;
  onShareProjectWithEmail?: (projectId: string, email: string) => Promise<{ error: string | null }>;
  onAddTask?: (task: { title: string; projectId: string; category: 'personal'; priority: 'medium' }) => void;
}

export function ProjectManager({
  projects,
  tasks,
  contacts = [],
  onAddProject,
  onUpdateProject,
  onDeleteProject,
  getProjectProgress,
  selectedProjectId,
  onSelectProject,
  onShareProject,
  onShareProjectWithEmail,
  onAddTask,
}: ProjectManagerProps) {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newProject, setNewProject] = useState({ name: '', description: '', color: '#3b82f6' });

  const activeProjects = projects.filter(p => !p.isArchived);
  const archivedProjects = projects.filter(p => p.isArchived);

  const handleAddProject = async () => {
    if (!newProject.name.trim()) return;
    
    await onAddProject({
      name: newProject.name.trim(),
      description: newProject.description.trim() || undefined,
      color: newProject.color,
      isArchived: false,
    });
    
    setNewProject({ name: '', description: '', color: '#3b82f6' });
    setShowAddDialog(false);
  };

  const ProjectItem = ({ project }: { project: Project }) => {
    const progress = getProjectProgress(project.id, tasks);
    const taskCount = tasks.filter(t => t.projectId === project.id).length;
    const isSelected = selectedProjectId === project.id;

    return (
      <div
        role="button"
        tabIndex={0}
        className={cn(
          "group p-3 rounded-lg border border-border hover:bg-muted/50 cursor-pointer transition-all",
          isSelected && "bg-primary/10 border-primary/30"
        )}
        onClick={() => onSelectProject?.(isSelected ? undefined : project.id)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelectProject?.(isSelected ? undefined : project.id);
          }
        }}
      >
        <div className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full shrink-0"
            style={{ backgroundColor: project.color }}
          />
          <span className="font-medium text-sm flex-1 truncate">{project.name}</span>
          <span className="text-xs text-muted-foreground">{taskCount} tasks</span>
          
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {onShareProject && (
              <Button
                variant="ghost"
                size="iconSm"
                onClick={(e) => { e.stopPropagation(); onShareProject(project.id, project.name); }}
                title="Share project"
              >
                <Users className="w-3 h-3" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="iconSm"
              onClick={(e) => { e.stopPropagation(); setEditingId(project.id); }}
            >
              <Pencil className="w-3 h-3" />
            </Button>
            <Button
              variant="ghost"
              size="iconSm"
              onClick={(e) => { 
                e.stopPropagation(); 
                onUpdateProject(project.id, { isArchived: !project.isArchived }); 
              }}
            >
              <Archive className="w-3 h-3" />
            </Button>
            <Button
              variant="ghost"
              size="iconSm"
              className="text-destructive hover:text-destructive"
              onClick={(e) => { e.stopPropagation(); onDeleteProject(project.id); }}
            >
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>
        </div>
        
        {project.description && (
          <p className="text-xs text-muted-foreground mt-1 truncate">{project.description}</p>
        )}
        
        {taskCount > 0 && (
          <div className="mt-2 flex items-center gap-2">
            <Progress value={progress} className="h-1.5 flex-1" />
            <span className="text-xs text-muted-foreground">{progress}%</span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Projects</h3>
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7">
              <FolderPlus className="w-4 h-4 mr-1" />
              New
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Project</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  value={newProject.name}
                  onChange={(e) => setNewProject(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Project name"
                />
              </div>
              <div className="space-y-2">
                <Label>Description (optional)</Label>
                <Textarea
                  value={newProject.description}
                  onChange={(e) => setNewProject(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Brief description"
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label>Color</Label>
                <div className="flex gap-2 flex-wrap">
                  {PROJECT_COLORS.map(color => (
                    <button
                      key={color}
                      className={cn(
                        "w-8 h-8 rounded-full border-2 transition-all",
                        newProject.color === color ? "border-foreground scale-110" : "border-transparent"
                      )}
                      style={{ backgroundColor: color }}
                      onClick={() => setNewProject(prev => ({ ...prev, color }))}
                    />
                  ))}
                </div>
              </div>
              <Button onClick={handleAddProject} className="w-full">Create Project</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Family Shopping Template */}
      {onShareProjectWithEmail && onAddTask && (
        <FamilyShoppingTemplate
          onCreateProject={onAddProject}
          onShareProject={onShareProjectWithEmail}
          onAddTask={onAddTask}
          contacts={contacts}
        />
      )}

      <div className="space-y-2">
        {activeProjects.map(project => (
          <ProjectItem key={project.id} project={project} />
        ))}
        
        {activeProjects.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-4">No projects yet</p>
        )}
      </div>

      {archivedProjects.length > 0 && (
        <div className="pt-4 border-t border-border">
          <h4 className="text-xs font-medium text-muted-foreground mb-2">Archived</h4>
          <div className="space-y-2">
            {archivedProjects.map(project => (
              <ProjectItem key={project.id} project={project} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
