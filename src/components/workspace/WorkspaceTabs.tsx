import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Home, 
  Briefcase, 
  Users, 
  ShoppingCart, 
  Plus,
  X
} from 'lucide-react';
import { cn } from '@/lib/utils';


import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export type WorkspaceType = 'all' | 'family' | 'work' | 'personal' | string;

interface Workspace {
  id: string;
  name: string;
  icon: typeof Home;
  color: string;
  taskCount?: number;
  isCustom?: boolean;
}

const defaultWorkspaces: Workspace[] = [
  { id: 'all', name: 'All', icon: Home, color: 'text-foreground' },
  { id: 'family', name: 'Family', icon: Users, color: 'text-pink-500' },
  { id: 'work', name: 'Work', icon: Briefcase, color: 'text-blue-500' },
  { id: 'personal', name: 'Personal', icon: ShoppingCart, color: 'text-green-500' },
];

interface WorkspaceTabsProps {
  activeWorkspace: string;
  onWorkspaceChange: (workspace: string) => void;
  workspaceTaskCounts?: Record<string, number>;
  customWorkspaces?: Workspace[];
  onAddWorkspace?: (name: string) => void;
  onRemoveWorkspace?: (id: string) => void;
}

export function WorkspaceTabs({
  activeWorkspace,
  onWorkspaceChange,
  workspaceTaskCounts = {},
  customWorkspaces = [],
  onAddWorkspace,
  onRemoveWorkspace,
}: WorkspaceTabsProps) {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');

  const allWorkspaces = [...defaultWorkspaces, ...customWorkspaces];

  const handleAddWorkspace = () => {
    if (newWorkspaceName.trim() && onAddWorkspace) {
      onAddWorkspace(newWorkspaceName.trim());
      setNewWorkspaceName('');
      setShowAddDialog(false);
    }
  };

  return (
    <>
      <div className="flex items-center gap-1 p-1 bg-muted/50 rounded-lg overflow-x-auto">
        {allWorkspaces.map((workspace) => {
          const isActive = activeWorkspace === workspace.id;
          const count = workspaceTaskCounts[workspace.id];
          const Icon = workspace.icon;

          return (
            <div key={workspace.id} className="relative group">
              <Button
                variant={isActive ? 'secondary' : 'ghost'}
                size="sm"
                className={cn(
                  "h-8 gap-2 transition-all whitespace-nowrap",
                  isActive && "shadow-sm",
                  workspace.isCustom && "pr-2"
                )}
                onClick={() => onWorkspaceChange(workspace.id)}
              >
                <Icon className={cn("w-4 h-4", workspace.color)} />
                <span className="text-sm">{workspace.name}</span>
                {count !== undefined && count > 0 && (
                  <Badge 
                    variant="outline" 
                    className="h-5 px-1.5 text-xs ml-1"
                  >
                    {count}
                  </Badge>
                )}
              </Button>

              {/* Remove button for custom workspaces */}
              {workspace.isCustom && onRemoveWorkspace && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-muted opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveWorkspace(workspace.id);
                  }}
                >
                  <X className="w-3 h-3" />
                </Button>
              )}
            </div>
          );
        })}

        {/* Add workspace button */}
        {onAddWorkspace && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2"
            onClick={() => setShowAddDialog(true)}
          >
            <Plus className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* Add Workspace Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Add Workspace</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="workspace-name">Workspace Name</Label>
              <Input
                id="workspace-name"
                placeholder="e.g., Startup A, Shopping List"
                value={newWorkspaceName}
                onChange={(e) => setNewWorkspaceName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddWorkspace();
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddWorkspace}>
              Add Workspace
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}