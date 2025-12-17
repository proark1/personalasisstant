import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { 
  LayoutDashboard, 
  Briefcase, 
  User, 
  Mic,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  LogOut,
  UserCircle,
  Users,
  BookUser,
  BarChart3,
  Target,
  CalendarCheck,
  FolderKanban
} from 'lucide-react';
import { TaskCategory } from '@/types/flux';

export type SidebarFilter = TaskCategory | 'all' | 'shared';

interface SidebarProps {
  activeFilter: SidebarFilter;
  onFilterChange: (filter: SidebarFilter) => void;
  onVoiceMode: () => void;
  onOpenSettings: () => void;
  onEditProfile?: () => void;
  onSignOut?: () => void;
  onOpenFocusTimer?: () => void;
  onOpenWeeklyReview?: () => void;
  onToggleProjects?: () => void;
}

export function Sidebar({ 
  activeFilter, 
  onFilterChange, 
  onVoiceMode, 
  onOpenSettings, 
  onEditProfile, 
  onSignOut, 
  onOpenFocusTimer,
  onOpenWeeklyReview,
  onToggleProjects,
}: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();

  const navItems: { icon: typeof LayoutDashboard; label: string; filter: SidebarFilter }[] = [
    { icon: LayoutDashboard, label: 'All Tasks', filter: 'all' },
    { icon: Briefcase, label: 'Business', filter: 'business' },
    { icon: User, label: 'Personal', filter: 'personal' },
    { icon: Users, label: 'Shared with me', filter: 'shared' },
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
        {/* Dashboard Link */}
        <Button
          variant="ghost"
          className={cn(
            "w-full justify-start gap-3 mb-2",
            collapsed && "justify-center px-0"
          )}
          onClick={() => navigate('/dashboard')}
        >
          <BarChart3 className="w-5 h-5 shrink-0 text-primary" />
          {!collapsed && <span>Dashboard</span>}
        </Button>

        <div className="border-b border-sidebar-border mb-2" />

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
        {onToggleProjects && (
          <Button
            variant="ghost"
            className={cn(
              "w-full gap-3",
              collapsed && "justify-center px-0"
            )}
            onClick={onToggleProjects}
          >
            <FolderKanban className="w-5 h-5 shrink-0" />
            {!collapsed && <span>Projects</span>}
          </Button>
        )}

        {onOpenWeeklyReview && (
          <Button
            variant="ghost"
            className={cn(
              "w-full gap-3",
              collapsed && "justify-center px-0"
            )}
            onClick={onOpenWeeklyReview}
          >
            <CalendarCheck className="w-5 h-5 shrink-0" />
            {!collapsed && <span>Weekly Review</span>}
          </Button>
        )}

        {onOpenFocusTimer && (
          <Button
            variant="outline"
            className={cn(
              "w-full gap-3 border-primary/50 text-primary hover:bg-primary/10",
              collapsed && "justify-center px-0"
            )}
            onClick={onOpenFocusTimer}
          >
            <Target className="w-5 h-5 shrink-0" />
            {!collapsed && <span>Focus Mode</span>}
          </Button>
        )}

        <Button
          variant="ghost"
          className={cn(
            "w-full gap-3",
            collapsed && "justify-center px-0"
          )}
          onClick={() => navigate('/contacts')}
        >
          <BookUser className="w-5 h-5 shrink-0" />
          {!collapsed && <span>Contacts</span>}
        </Button>

        <Button
          variant="ghost"
          className={cn(
            "w-full gap-3",
            collapsed && "justify-center px-0"
          )}
          onClick={onOpenSettings}
        >
          <UserCircle className="w-5 h-5 shrink-0" />
          {!collapsed && <span>Profile & Settings</span>}
        </Button>
        
        <Button
          variant="voice_mode"
          className={cn(
            "w-full gap-3",
            collapsed && "justify-center px-0"
          )}
          onClick={onVoiceMode}
        >
          <Mic className="w-5 h-5 shrink-0" />
          {!collapsed && <span>Voice Mode</span>}
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
