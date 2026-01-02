import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { 
  LayoutDashboard, 
  ChevronLeft,
  ChevronRight,
  Sparkles,
  LogOut,
  BookUser,
  Target,
  CalendarCheck,
  Search,
  Calendar,
  Settings,
  CheckSquare,
  Zap,
  FileText,
  MessageCircle,
  Flame,
  StickyNote,
  BarChart3,
  Home,
  Brain,
  Moon,
  Building2,
  Briefcase,
  Newspaper
} from 'lucide-react';
import { TaskCategory } from '@/types/flux';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/contexts/LanguageContext';
import { BrainDumpFAB } from '@/components/capture/BrainDumpFAB';
import { DoriNotificationIcon } from '@/components/assistant/DoriNotificationIcon';

export type SidebarFilter = TaskCategory | 'all' | 'shared';
export type ActivePanel = 'tasks' | 'social' | 'calendar' | 'assistant' | 'dashboard' | 'projects' | 'contacts' | 'contracts' | 'activity' | 'settings' | 'notes' | 'habits' | 'admin' | 'family' | 'islam' | 'properties' | 'startups' | 'news' | null;

interface SidebarProps {
  onEditProfile?: () => void;
  onSignOut?: () => void;
  onOpenFocusTimer?: () => void;
  onOpenWeeklyReview?: () => void;
  onOpenGlobalSearch?: () => void;
  onPanelChange?: (panel: ActivePanel) => void;
  onOpenTodayFocus?: () => void;
  activePanel?: ActivePanel;
  notificationButton?: React.ReactNode;
}

export function Sidebar({ 
  onSignOut, 
  onOpenFocusTimer,
  onOpenWeeklyReview,
  onOpenGlobalSearch,
  onPanelChange,
  onOpenTodayFocus,
  activePanel,
  notificationButton,
}: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const { user } = useAuth();
  const { t } = useLanguage();

  useEffect(() => {
    const checkAdmin = async () => {
      if (!user) return;
      const { data } = await supabase
        .from('admin_users')
        .select('id')
        .eq('user_id', user.id)
        .single();
      setIsAdmin(!!data);
    };
    checkAdmin();
  }, [user]);

  const handlePanelClick = (panel: ActivePanel) => {
    if (onPanelChange) {
      onPanelChange(activePanel === panel ? 'tasks' : panel);
    }
  };

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
            <span className="font-semibold text-foreground">DarAI</span>
          </div>
        )}
        <div className="flex items-center gap-1">
          {!collapsed && <DoriNotificationIcon />}
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
            {!collapsed && <span className="text-sm font-medium">{t('nav.todayFocus')}</span>}
          </Button>
        </div>
      )}

      {/* Main Navigation */}
      <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
        {/* Quick Actions Row */}
        <div className="flex items-center gap-1 mb-2">
          {/* Search */}
          {onOpenGlobalSearch && (
            <Button
              variant="ghost"
              className={cn(
                "flex-1 h-9 gap-3 text-muted-foreground hover:text-foreground",
                collapsed ? "justify-center px-0" : "justify-start"
              )}
              onClick={onOpenGlobalSearch}
            >
              <Search className="w-4 h-4 shrink-0" />
              {!collapsed && <span className="text-sm">{t('nav.search')}</span>}
              {!collapsed && <span className="ml-auto text-xs text-muted-foreground/60">⌘K</span>}
            </Button>
          )}
          
          {/* Brain Dump / Quick Note */}
          <BrainDumpFAB className="static bottom-auto right-auto" collapsed={collapsed} />
        </div>

        <Separator className="my-2" />

        {/* Main Views */}
        <div className={cn("space-y-0.5", !collapsed && "mb-2")}>
          {!collapsed && (
            <span className="text-xs font-medium text-muted-foreground px-3 py-1.5 block">{t('nav.main')}</span>
          )}
          
          {/* AI Assistant */}
          <Button
            variant={activePanel === 'assistant' ? 'secondary' : 'ghost'}
            className={cn(
              "w-full h-9 gap-3",
              collapsed ? "justify-center px-0" : "justify-start",
              activePanel === 'assistant' && "bg-sidebar-accent text-sidebar-primary font-medium"
            )}
            onClick={() => handlePanelClick('assistant')}
          >
            <Sparkles className="w-4 h-4 shrink-0" />
            {!collapsed && <span className="text-sm">{t('nav.assistant')}</span>}
          </Button>

          {/* Tasks */}
          <Button
            variant={activePanel === 'tasks' ? 'secondary' : 'ghost'}
            className={cn(
              "w-full h-9 gap-3",
              collapsed ? "justify-center px-0" : "justify-start",
              activePanel === 'tasks' && "bg-sidebar-accent text-sidebar-primary font-medium"
            )}
            onClick={() => handlePanelClick('tasks')}
          >
            <CheckSquare className="w-4 h-4 shrink-0" />
            {!collapsed && <span className="text-sm">{t('nav.tasks')}</span>}
          </Button>

          {/* Social (Chat + Calls) */}
          <Button
            variant={activePanel === 'social' ? 'secondary' : 'ghost'}
            className={cn(
              "w-full h-9 gap-3",
              collapsed ? "justify-center px-0" : "justify-start",
              activePanel === 'social' && "bg-sidebar-accent text-sidebar-primary font-medium"
            )}
            onClick={() => handlePanelClick('social')}
          >
            <MessageCircle className="w-4 h-4 shrink-0" />
            {!collapsed && <span className="text-sm">{t('nav.social')}</span>}
          </Button>
          
          {/* Calendar */}
          <Button
            variant={activePanel === 'calendar' ? 'secondary' : 'ghost'}
            className={cn(
              "w-full h-9 gap-3",
              collapsed ? "justify-center px-0" : "justify-start",
              activePanel === 'calendar' && "bg-sidebar-accent text-sidebar-primary font-medium"
            )}
            onClick={() => handlePanelClick('calendar')}
          >
            <Calendar className="w-4 h-4 shrink-0" />
            {!collapsed && <span className="text-sm">{t('nav.calendar')}</span>}
          </Button>

          {/* Dashboard */}
          <Button
            variant={activePanel === 'dashboard' ? 'secondary' : 'ghost'}
            className={cn(
              "w-full h-9 gap-3",
              collapsed ? "justify-center px-0" : "justify-start",
              activePanel === 'dashboard' && "bg-sidebar-accent text-sidebar-primary font-medium"
            )}
            onClick={() => handlePanelClick('dashboard')}
          >
            <LayoutDashboard className="w-4 h-4 shrink-0" />
            {!collapsed && <span className="text-sm">{t('nav.dashboard')}</span>}
          </Button>

          {/* Cooking */}
          <Button
            variant={activePanel === 'family' ? 'secondary' : 'ghost'}
            className={cn(
              "w-full h-9 gap-3",
              collapsed ? "justify-center px-0" : "justify-start",
              activePanel === 'family' && "bg-sidebar-accent text-sidebar-primary font-medium"
            )}
            onClick={() => handlePanelClick('family')}
          >
            <Home className="w-4 h-4 shrink-0" />
            {!collapsed && <span className="text-sm">Cooking</span>}
          </Button>

          {/* Islam */}
          <Button
            variant={activePanel === 'islam' ? 'secondary' : 'ghost'}
            className={cn(
              "w-full h-9 gap-3",
              collapsed ? "justify-center px-0" : "justify-start",
              activePanel === 'islam' && "bg-sidebar-accent text-sidebar-primary font-medium"
            )}
            onClick={() => handlePanelClick('islam')}
          >
            <Moon className="w-4 h-4 shrink-0" />
            {!collapsed && <span className="text-sm">{t('nav.islam') || 'Islam'}</span>}
          </Button>

          {/* Properties */}
          <Button
            variant={activePanel === 'properties' ? 'secondary' : 'ghost'}
            className={cn(
              "w-full h-9 gap-3",
              collapsed ? "justify-center px-0" : "justify-start",
              activePanel === 'properties' && "bg-sidebar-accent text-sidebar-primary font-medium"
            )}
            onClick={() => handlePanelClick('properties')}
          >
            <Building2 className="w-4 h-4 shrink-0" />
            {!collapsed && <span className="text-sm">{t('nav.properties') || 'Properties'}</span>}
          </Button>

          {/* Startups */}
          <Button
            variant={activePanel === 'startups' ? 'secondary' : 'ghost'}
            className={cn(
              "w-full h-9 gap-3",
              collapsed ? "justify-center px-0" : "justify-start",
              activePanel === 'startups' && "bg-sidebar-accent text-sidebar-primary font-medium"
            )}
            onClick={() => handlePanelClick('startups')}
          >
            <Briefcase className="w-4 h-4 shrink-0" />
            {!collapsed && <span className="text-sm">{t('nav.startups') || 'Startups'}</span>}
          </Button>

          {/* Tech News */}
          <Button
            variant={activePanel === 'news' ? 'secondary' : 'ghost'}
            className={cn(
              "w-full h-9 gap-3",
              collapsed ? "justify-center px-0" : "justify-start",
              activePanel === 'news' && "bg-sidebar-accent text-sidebar-primary font-medium"
            )}
            onClick={() => handlePanelClick('news')}
          >
            <Newspaper className="w-4 h-4 shrink-0" />
            {!collapsed && <span className="text-sm">{t('nav.news') || 'Tech News'}</span>}
          </Button>
        </div>

        <Separator className="my-2" />

        {/* Productivity */}
        <div className={cn("space-y-0.5")}>
          {!collapsed && (
            <span className="text-xs font-medium text-muted-foreground px-3 py-1.5 block">{t('nav.productivity')}</span>
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
              {!collapsed && <span className="text-sm">{t('nav.focusMode')}</span>}
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
              {!collapsed && <span className="text-sm">{t('nav.weeklyReview')}</span>}
            </Button>
          )}

          {/* Notes */}
          <Button
            variant={activePanel === 'notes' ? 'secondary' : 'ghost'}
            className={cn(
              "w-full h-9 gap-3",
              collapsed ? "justify-center px-0" : "justify-start",
              activePanel === 'notes' && "bg-sidebar-accent text-sidebar-primary font-medium"
            )}
            onClick={() => handlePanelClick('notes')}
          >
            <StickyNote className="w-4 h-4 shrink-0" />
            {!collapsed && <span className="text-sm">{t('nav.notes')}</span>}
          </Button>

          {/* Habits */}
          <Button
            variant={activePanel === 'habits' ? 'secondary' : 'ghost'}
            className={cn(
              "w-full h-9 gap-3",
              collapsed ? "justify-center px-0" : "justify-start",
              activePanel === 'habits' && "bg-sidebar-accent text-sidebar-primary font-medium"
            )}
            onClick={() => handlePanelClick('habits')}
          >
            <Flame className="w-4 h-4 shrink-0" />
            {!collapsed && <span className="text-sm">{t('nav.habits')}</span>}
          </Button>

          {/* Contacts */}
          <Button
            variant={activePanel === 'contacts' ? 'secondary' : 'ghost'}
            className={cn(
              "w-full h-9 gap-3",
              collapsed ? "justify-center px-0" : "justify-start",
              activePanel === 'contacts' && "bg-sidebar-accent text-sidebar-primary font-medium"
            )}
            onClick={() => handlePanelClick('contacts')}
          >
            <BookUser className="w-4 h-4 shrink-0" />
            {!collapsed && <span className="text-sm">{t('nav.contacts')}</span>}
          </Button>

          {/* Contracts */}
          <Button
            variant={activePanel === 'contracts' ? 'secondary' : 'ghost'}
            className={cn(
              "w-full h-9 gap-3",
              collapsed ? "justify-center px-0" : "justify-start",
              activePanel === 'contracts' && "bg-sidebar-accent text-sidebar-primary font-medium"
            )}
            onClick={() => handlePanelClick('contracts')}
          >
            <FileText className="w-4 h-4 shrink-0" />
            {!collapsed && <span className="text-sm">{t('nav.contracts')}</span>}
          </Button>
        </div>
      </nav>

      {/* Footer Actions */}
      <div className="p-2 border-t border-sidebar-border space-y-0.5">
        <Button
          variant={activePanel === 'settings' ? 'secondary' : 'ghost'}
          className={cn(
            "w-full h-9 gap-3",
            collapsed ? "justify-center px-0" : "justify-start",
            activePanel === 'settings' && "bg-sidebar-accent text-sidebar-primary font-medium"
          )}
          onClick={() => handlePanelClick('settings')}
        >
          <Settings className="w-4 h-4 shrink-0" />
          {!collapsed && <span className="text-sm">{t('nav.settings')}</span>}
        </Button>

        {isAdmin && (
          <Button
            variant={activePanel === 'admin' ? 'secondary' : 'ghost'}
            className={cn(
              "w-full h-9 gap-3",
              collapsed ? "justify-center px-0" : "justify-start",
              activePanel === 'admin' && "bg-sidebar-accent text-sidebar-primary font-medium"
            )}
            onClick={() => handlePanelClick('admin')}
          >
            <BarChart3 className="w-4 h-4 shrink-0" />
            {!collapsed && <span className="text-sm">{t('nav.admin')}</span>}
          </Button>
        )}

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
            {!collapsed && <span className="text-sm">{t('nav.signOut')}</span>}
          </Button>
        )}
      </div>
    </aside>
  );
}
