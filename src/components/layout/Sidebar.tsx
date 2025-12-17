import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { 
  LayoutDashboard, 
  Briefcase, 
  User, 
  Mic,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  LogOut,
  Users,
  BookUser,
  Target,
  CalendarCheck,
  FolderKanban,
  Activity,
  Search,
  Calendar,
  Settings,
  CheckSquare,
  Zap,
  FileText,
  Home
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
  onOpenActivityFeed?: () => void;
  onOpenGlobalSearch?: () => void;
  onToggleCalendar?: () => void;
  onOpenTodayFocus?: () => void;
  showCalendar?: boolean;
  notificationButton?: React.ReactNode;
}

export function Sidebar({ 
  activeFilter, 
  onFilterChange, 
  onVoiceMode, 
  onOpenSettings, 
  onSignOut, 
  onOpenFocusTimer,
  onOpenWeeklyReview,
  onToggleProjects,
  onOpenActivityFeed,
  onOpenGlobalSearch,
  onToggleCalendar,
  onOpenTodayFocus,
  showCalendar,
  notificationButton,
}: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const categoryFilters: { icon: typeof LayoutDashboard; label: string; filter: SidebarFilter }[] = [
    { icon: CheckSquare, label: 'All Tasks', filter: 'all' },
    { icon: Briefcase, label: 'Business', filter: 'business' },
    { icon: User, label: 'Personal', filter: 'personal' },
    { icon: Home, label: 'Family', filter: 'family' },
    { icon: Users, label: 'Shared', filter: 'shared' },
  ];

  return (
    <aside 
      className={cn(
        "h-screen bg-sidebar border-r border-sidebar-border flex flex-col transition-all duration-300",
        collapsed ? "w-16" : "w-56"
      )}
    >
      {/* Header with Logo */}
      <div className="h-14 flex items-center justify-between px-3 border-b border-sidebar-border">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-semibold text-foreground">Flux</span>
          </div>
        )}
        <div className="flex items-center gap-1">
          {!collapsed && notificationButton}
          <Button 
            variant="ghost" 
            size="icon"
            className={cn("h-8 w-8 text-muted-foreground hover:text-foreground", collapsed && "mx-auto")}
            onClick={() => setCollapsed(!collapsed)}
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      {/* Today Focus Button - Prominent CTA */}
      {onOpenTodayFocus && (
        <div className="px-2 pt-2">
          <Button
            variant="default"
            className={cn(
              "w-full gap-2 bg-gradient-to-r from-primary to-accent hover:opacity-90",
              collapsed ? "justify-center px-0" : "justify-start"
            )}
            onClick={onOpenTodayFocus}
          >
            <Zap className="w-4 h-4 shrink-0" />
            {!collapsed && <span className="text-sm font-medium">Today's Focus</span>}
          </Button>
        </div>
      )}

      {/* Main Navigation */}
      <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
        {/* Search */}
        {onOpenGlobalSearch && (
          <Button
            variant="ghost"
            className={cn(
              "w-full h-9 gap-3 text-muted-foreground hover:text-foreground",
              collapsed ? "justify-center px-0" : "justify-start"
            )}
            onClick={onOpenGlobalSearch}
          >
            <Search className="w-4 h-4 shrink-0" />
            {!collapsed && <span className="text-sm">Search</span>}
            {!collapsed && <span className="ml-auto text-xs text-muted-foreground/60">⌘K</span>}
          </Button>
        )}

        <Separator className="my-2" />

        {/* Category Filters */}
        <div className={cn("space-y-0.5", !collapsed && "mb-2")}>
          {!collapsed && (
            <span className="text-xs font-medium text-muted-foreground px-3 py-1.5 block">Tasks</span>
          )}
          {categoryFilters.map((item) => (
            <Button
              key={item.filter}
              variant={activeFilter === item.filter ? 'secondary' : 'ghost'}
              className={cn(
                "w-full h-9 gap-3",
                collapsed ? "justify-center px-0" : "justify-start",
                activeFilter === item.filter && "bg-sidebar-accent text-sidebar-primary font-medium"
              )}
              onClick={() => onFilterChange(item.filter)}
            >
              <item.icon className="w-4 h-4 shrink-0" />
              {!collapsed && <span className="text-sm">{item.label}</span>}
            </Button>
          ))}
        </div>

        <Separator className="my-2" />

        {/* Views & Tools */}
        <div className={cn("space-y-0.5", !collapsed && "mb-2")}>
          {!collapsed && (
            <span className="text-xs font-medium text-muted-foreground px-3 py-1.5 block">Views</span>
          )}
          
          {onToggleCalendar && (
            <Button
              variant={showCalendar ? 'secondary' : 'ghost'}
              className={cn(
                "w-full h-9 gap-3",
                collapsed ? "justify-center px-0" : "justify-start",
                showCalendar && "bg-sidebar-accent text-sidebar-primary font-medium"
              )}
              onClick={onToggleCalendar}
            >
              <Calendar className="w-4 h-4 shrink-0" />
              {!collapsed && <span className="text-sm">Calendar</span>}
            </Button>
          )}

          {onToggleProjects && (
            <Button
              variant="ghost"
              className={cn(
                "w-full h-9 gap-3",
                collapsed ? "justify-center px-0" : "justify-start"
              )}
              onClick={onToggleProjects}
            >
              <FolderKanban className="w-4 h-4 shrink-0" />
              {!collapsed && <span className="text-sm">Projects</span>}
            </Button>
          )}

          <Button
            variant={location.pathname === '/dashboard' ? 'secondary' : 'ghost'}
            className={cn(
              "w-full h-9 gap-3",
              collapsed ? "justify-center px-0" : "justify-start"
            )}
            onClick={() => navigate('/dashboard')}
          >
            <LayoutDashboard className="w-4 h-4 shrink-0" />
            {!collapsed && <span className="text-sm">Dashboard</span>}
          </Button>

          {onOpenActivityFeed && (
            <Button
              variant="ghost"
              className={cn(
                "w-full h-9 gap-3",
                collapsed ? "justify-center px-0" : "justify-start"
              )}
              onClick={onOpenActivityFeed}
            >
              <Activity className="w-4 h-4 shrink-0" />
              {!collapsed && <span className="text-sm">Activity</span>}
            </Button>
          )}
        </div>

        <Separator className="my-2" />

        {/* Productivity */}
        <div className={cn("space-y-0.5")}>
          {!collapsed && (
            <span className="text-xs font-medium text-muted-foreground px-3 py-1.5 block">Productivity</span>
          )}

          {onOpenFocusTimer && (
            <Button
              variant="ghost"
              className={cn(
                "w-full h-9 gap-3",
                collapsed ? "justify-center px-0" : "justify-start"
              )}
              onClick={onOpenFocusTimer}
            >
              <Target className="w-4 h-4 shrink-0" />
              {!collapsed && <span className="text-sm">Focus Mode</span>}
            </Button>
          )}

          {onOpenWeeklyReview && (
            <Button
              variant="ghost"
              className={cn(
                "w-full h-9 gap-3",
                collapsed ? "justify-center px-0" : "justify-start"
              )}
              onClick={onOpenWeeklyReview}
            >
              <CalendarCheck className="w-4 h-4 shrink-0" />
              {!collapsed && <span className="text-sm">Weekly Review</span>}
            </Button>
          )}

          <Button
            variant={location.pathname === '/contacts' ? 'secondary' : 'ghost'}
            className={cn(
              "w-full h-9 gap-3",
              collapsed ? "justify-center px-0" : "justify-start"
            )}
            onClick={() => navigate('/contacts')}
          >
            <BookUser className="w-4 h-4 shrink-0" />
            {!collapsed && <span className="text-sm">Contacts</span>}
          </Button>

          <Button
            variant={location.pathname === '/contracts' ? 'secondary' : 'ghost'}
            className={cn(
              "w-full h-9 gap-3",
              collapsed ? "justify-center px-0" : "justify-start"
            )}
            onClick={() => navigate('/contracts')}
          >
            <FileText className="w-4 h-4 shrink-0" />
            {!collapsed && <span className="text-sm">Contracts</span>}
          </Button>
        </div>
      </nav>

      {/* Footer Actions */}
      <div className="p-2 border-t border-sidebar-border space-y-0.5">
        <Button
          variant="voice_mode"
          className={cn(
            "w-full h-9 gap-3",
            collapsed ? "justify-center px-0" : "justify-start"
          )}
          onClick={onVoiceMode}
        >
          <Mic className="w-4 h-4 shrink-0" />
          {!collapsed && <span className="text-sm">Voice Mode</span>}
        </Button>

        <Button
          variant="ghost"
          className={cn(
            "w-full h-9 gap-3",
            collapsed ? "justify-center px-0" : "justify-start"
          )}
          onClick={onOpenSettings}
        >
          <Settings className="w-4 h-4 shrink-0" />
          {!collapsed && <span className="text-sm">Settings</span>}
        </Button>

        {onSignOut && (
          <Button
            variant="ghost"
            className={cn(
              "w-full h-9 gap-3 text-muted-foreground hover:text-destructive",
              collapsed ? "justify-center px-0" : "justify-start"
            )}
            onClick={onSignOut}
          >
            <LogOut className="w-4 h-4 shrink-0" />
            {!collapsed && <span className="text-sm">Sign Out</span>}
          </Button>
        )}
      </div>
    </aside>
  );
}