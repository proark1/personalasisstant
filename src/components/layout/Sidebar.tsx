import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { 
  LayoutDashboard, 
  Briefcase, 
  User, 
  Ghost,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Settings,
  LogOut,
  UserCircle
} from 'lucide-react';
import { TaskCategory } from '@/types/flux';

interface SidebarProps {
  activeFilter: TaskCategory | 'all';
  onFilterChange: (filter: TaskCategory | 'all') => void;
  onGhostMode: () => void;
  onOpenSettings: () => void;
  onEditProfile?: () => void;
  onSignOut?: () => void;
}

export function Sidebar({ activeFilter, onFilterChange, onGhostMode, onOpenSettings, onEditProfile, onSignOut }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);

  const navItems = [
    { icon: LayoutDashboard, label: 'Dashboard', filter: 'all' as const },
    { icon: Briefcase, label: 'Business', filter: 'business' as const },
    { icon: User, label: 'Personal', filter: 'personal' as const },
  ];

  return (
    <aside 
      className={cn(
        "h-screen bg-sidebar border-r border-sidebar-border flex flex-col transition-all duration-300",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Logo */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-sidebar-border">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-semibold text-lg text-foreground">Flux</span>
          </div>
        )}
        <Button 
          variant="ghost" 
          size="iconSm"
          onClick={() => setCollapsed(!collapsed)}
          className="text-muted-foreground hover:text-foreground"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1">
        {navItems.map((item) => (
          <Button
            key={item.filter}
            variant={activeFilter === item.filter ? 'secondary' : 'ghost'}
            className={cn(
              "w-full justify-start gap-3",
              collapsed && "justify-center px-0",
              activeFilter === item.filter && "bg-sidebar-accent text-sidebar-primary"
            )}
            onClick={() => onFilterChange(item.filter)}
          >
            <item.icon className="w-5 h-5 shrink-0" />
            {!collapsed && <span>{item.label}</span>}
          </Button>
        ))}
      </nav>

      {/* Bottom Actions */}
      <div className="p-3 border-t border-sidebar-border space-y-1">
        {onEditProfile && (
          <Button
            variant="ghost"
            className={cn(
              "w-full gap-3",
              collapsed && "justify-center px-0"
            )}
            onClick={onEditProfile}
          >
            <UserCircle className="w-5 h-5 shrink-0" />
            {!collapsed && <span>Edit Profile</span>}
          </Button>
        )}
        
        <Button
          variant="ghost"
          className={cn(
            "w-full gap-3",
            collapsed && "justify-center px-0"
          )}
          onClick={onOpenSettings}
        >
          <Settings className="w-5 h-5 shrink-0" />
          {!collapsed && <span>Settings</span>}
        </Button>
        
        <Button
          variant="ghost_mode"
          className={cn(
            "w-full gap-3",
            collapsed && "justify-center px-0"
          )}
          onClick={onGhostMode}
        >
          <Ghost className="w-5 h-5 shrink-0" />
          {!collapsed && <span>Ghost Mode</span>}
        </Button>

        {onSignOut && (
          <Button
            variant="ghost"
            className={cn(
              "w-full gap-3 text-muted-foreground hover:text-destructive",
              collapsed && "justify-center px-0"
            )}
            onClick={onSignOut}
          >
            <LogOut className="w-5 h-5 shrink-0" />
            {!collapsed && <span>Sign Out</span>}
          </Button>
        )}
      </div>
    </aside>
  );
}
