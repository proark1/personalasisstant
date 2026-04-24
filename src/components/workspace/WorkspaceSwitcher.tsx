import { useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Check, ChevronDown, Plus, Settings, User } from 'lucide-react';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { Link } from 'react-router-dom';

// Compact workspace picker for the header. Shows the active context (either
// "Personal" or a workspace name) and lets the user switch, create, or jump
// to the workspaces settings page.
export function WorkspaceSwitcher() {
  const { workspaces, activeWorkspace, activeWorkspaceId, setActiveWorkspaceId } = useWorkspace();
  const [open, setOpen] = useState(false);

  const label = activeWorkspace
    ? `${activeWorkspace.icon ? `${activeWorkspace.icon} ` : ''}${activeWorkspace.name}`
    : 'Personal';

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 max-w-[160px] px-2 gap-1.5 text-sm font-medium"
          title="Switch workspace"
        >
          <span className="truncate">{label}</span>
          <ChevronDown className="w-3.5 h-3.5 shrink-0 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-60">
        <DropdownMenuLabel className="text-[11px] text-muted-foreground uppercase tracking-wide">
          Current context
        </DropdownMenuLabel>
        <DropdownMenuItem
          onClick={() => setActiveWorkspaceId(null)}
          className="gap-2"
        >
          <User className="w-4 h-4 opacity-70" />
          <span className="flex-1">Personal</span>
          {activeWorkspaceId === null && <Check className="w-4 h-4" />}
        </DropdownMenuItem>
        {workspaces.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-[11px] text-muted-foreground uppercase tracking-wide">
              Workspaces
            </DropdownMenuLabel>
            {workspaces.map((ws) => (
              <DropdownMenuItem
                key={ws.id}
                onClick={() => setActiveWorkspaceId(ws.id)}
                className="gap-2"
              >
                <span className="w-4 shrink-0 text-center">{ws.icon || '📁'}</span>
                <span className="flex-1 truncate">{ws.name}</span>
                {activeWorkspaceId === ws.id && <Check className="w-4 h-4" />}
              </DropdownMenuItem>
            ))}
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/workspaces" className="gap-2">
            <Plus className="w-4 h-4" />
            New workspace
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/workspaces" className="gap-2">
            <Settings className="w-4 h-4" />
            Manage workspaces
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
