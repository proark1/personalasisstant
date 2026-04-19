import { useState, useEffect, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import {
  LayoutDashboard,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Sparkles,
  LogOut,
  BookUser,
  Target,
  CalendarCheck,
  Calendar,
  Settings,
  CheckSquare,
  Zap,
  FileText,
  MessageCircle,
  Flame,
  StickyNote,
  BarChart3,
  Utensils,
  Moon,
  Building2,
  Briefcase,
  Newspaper,
  Heart,
  Mail,
  Wallet,
  Plane,
  Home,
  Pill,
  GraduationCap,
  BookHeart,
} from 'lucide-react';
import { TaskCategory } from '@/types/flux';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/contexts/LanguageContext';
import { useUnreadEmailCount } from '@/hooks/useUnreadEmailCount';


export type SidebarFilter = TaskCategory | 'all' | 'shared';
export type ActivePanel = 'tasks' | 'social' | 'calendar' | 'assistant' | 'dashboard' | 'projects' | 'contacts' | 'contracts' | 'activity' | 'settings' | 'notes' | 'habits' | 'admin' | 'family' | 'islam' | 'properties' | 'startups' | 'news' | 'health' | 'email' | 'finances' | 'travel' | 'assets' | 'personal-health' | 'relationships-plus' | 'learning' | 'journal' | null;

interface SidebarProps {
  onEditProfile?: () => void;
  onSignOut?: () => void;
  onOpenFocusTimer?: () => void;
  onOpenWeeklyReview?: () => void;
  onPanelChange?: (panel: ActivePanel) => void;
  onOpenTodayFocus?: () => void;
  activePanel?: ActivePanel;
}

interface NavItemProps {
  icon: React.ElementType;
  label: string;
  panel: ActivePanel;
  activePanel?: ActivePanel;
  collapsed: boolean;
  onClick: (panel: ActivePanel) => void;
  badge?: number;
}

function NavItem({ icon: Icon, label, panel, activePanel, collapsed, onClick, badge }: NavItemProps) {
  const isActive = activePanel === panel;
  const btn = (
    <Button
      variant={isActive ? 'secondary' : 'ghost'}
      className={cn(
        "w-full h-9 gap-3 relative",
        collapsed ? "justify-center px-0" : "justify-start",
        isActive && "bg-sidebar-accent text-sidebar-primary font-medium"
      )}
      onClick={() => onClick(panel)}
    >
      {isActive && (
        <motion.div
          layoutId="sidebar-active-indicator"
          className="absolute left-0 top-1 bottom-1 w-[3px] rounded-r-full bg-primary"
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
        />
      )}
      <Icon className="w-4 h-4 shrink-0" />
      {!collapsed && <span className="text-sm">{label}</span>}
      {!collapsed && badge && badge > 0 ? (
        <span className="ml-auto text-[10px] font-semibold bg-primary text-primary-foreground rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
          {badge > 99 ? '99+' : badge}
        </span>
      ) : null}
    </Button>
  );

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{btn}</TooltipTrigger>
        <TooltipContent side="right">{label}</TooltipContent>
      </Tooltip>
    );
  }
  return btn;
}

interface NavGroupProps {
  title: string;
  collapsed: boolean;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

function NavGroup({ title, collapsed, defaultOpen = true, children }: NavGroupProps) {
  const [open, setOpen] = useState(defaultOpen);

  if (collapsed) {
    return <div className="space-y-0.5">{children}</div>;
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center justify-between w-full px-3 py-1.5 group cursor-pointer">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{title}</span>
        <ChevronDown className={cn(
          "w-3 h-3 text-muted-foreground transition-transform duration-200",
          !open && "-rotate-90"
        )} />
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-0.5">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}

export function Sidebar({
  onSignOut,
  onOpenFocusTimer,
  onOpenWeeklyReview,
  onPanelChange,
  onOpenTodayFocus,
  activePanel,
}: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const { user } = useAuth();
  const { t } = useLanguage();
  const { unreadCount } = useUnreadEmailCount();

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
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          "h-screen bg-sidebar border-r border-sidebar-border flex flex-col transition-all duration-300",
          collapsed ? "w-16" : "w-56"
        )}
      >
        {/* Header */}
        <div className="h-14 flex items-center justify-between px-3 border-b border-sidebar-border">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-primary-foreground" />
            </div>
            {!collapsed && <span className="font-semibold text-foreground">DarAI</span>}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={() => setCollapsed(!collapsed)}
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </Button>
        </div>

        {/* Today Focus CTA */}
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

        <Separator className="my-2 mx-2" />

        {/* Navigation */}
        <nav className="flex-1 px-2 space-y-2 overflow-y-auto pb-2">
          {/* My Day */}
          <NavGroup title="My Day" collapsed={collapsed}>
            <NavItem icon={LayoutDashboard} label={t('nav.dashboard')} panel="dashboard" activePanel={activePanel} collapsed={collapsed} onClick={handlePanelClick} />
            <NavItem icon={CheckSquare} label={t('nav.tasks')} panel="tasks" activePanel={activePanel} collapsed={collapsed} onClick={handlePanelClick} />
            <NavItem icon={Calendar} label={t('nav.calendar')} panel="calendar" activePanel={activePanel} collapsed={collapsed} onClick={handlePanelClick} />
          </NavGroup>

          {/* Assistant */}
          <NavGroup title="Assistant" collapsed={collapsed}>
            <NavItem icon={Sparkles} label={t('nav.assistant')} panel="assistant" activePanel={activePanel} collapsed={collapsed} onClick={handlePanelClick} />
          </NavGroup>

          {/* Life */}
          <NavGroup title="Life" collapsed={collapsed}>
            <NavItem icon={Heart} label={t('nav.health') || 'Health'} panel="health" activePanel={activePanel} collapsed={collapsed} onClick={handlePanelClick} />
            <NavItem icon={Pill} label="Personal Health" panel="personal-health" activePanel={activePanel} collapsed={collapsed} onClick={handlePanelClick} />
            <NavItem icon={Flame} label={t('nav.habits')} panel="habits" activePanel={activePanel} collapsed={collapsed} onClick={handlePanelClick} />
            <NavItem icon={Utensils} label={t('nav.cooking') || 'Cooking'} panel="family" activePanel={activePanel} collapsed={collapsed} onClick={handlePanelClick} />
            <NavItem icon={Moon} label={t('nav.islam') || 'Islam'} panel="islam" activePanel={activePanel} collapsed={collapsed} onClick={handlePanelClick} />
            <NavItem icon={Heart} label="Relationships+" panel="relationships-plus" activePanel={activePanel} collapsed={collapsed} onClick={handlePanelClick} />
            <NavItem icon={BookHeart} label="Journal" panel="journal" activePanel={activePanel} collapsed={collapsed} onClick={handlePanelClick} />
          </NavGroup>

          {/* Money & Assets */}
          <NavGroup title="Money & Assets" collapsed={collapsed}>
            <NavItem icon={Wallet} label="Finances" panel="finances" activePanel={activePanel} collapsed={collapsed} onClick={handlePanelClick} />
            <NavItem icon={Plane} label="Travel" panel="travel" activePanel={activePanel} collapsed={collapsed} onClick={handlePanelClick} />
            <NavItem icon={Home} label="Properties & Vehicles" panel="assets" activePanel={activePanel} collapsed={collapsed} onClick={handlePanelClick} />
          </NavGroup>

          {/* Business */}
          <NavGroup title="Business" collapsed={collapsed}>
            <NavItem icon={Mail} label={t('nav.email') || 'Email'} panel="email" activePanel={activePanel} collapsed={collapsed} onClick={handlePanelClick} badge={unreadCount || undefined} />
            <NavItem icon={BookUser} label={t('nav.contacts')} panel="contacts" activePanel={activePanel} collapsed={collapsed} onClick={handlePanelClick} />
            <NavItem icon={FileText} label={t('nav.contracts')} panel="contracts" activePanel={activePanel} collapsed={collapsed} onClick={handlePanelClick} />
            <NavItem icon={Building2} label={t('nav.properties') || 'Properties'} panel="properties" activePanel={activePanel} collapsed={collapsed} onClick={handlePanelClick} />
            <NavItem icon={Briefcase} label={t('nav.startups') || 'Startups'} panel="startups" activePanel={activePanel} collapsed={collapsed} onClick={handlePanelClick} />
            <NavItem icon={Newspaper} label={t('nav.news') || 'Tech News'} panel="news" activePanel={activePanel} collapsed={collapsed} onClick={handlePanelClick} />
          </NavGroup>

          {/* Tools */}
          <NavGroup title="Tools" collapsed={collapsed}>
            <NavItem icon={StickyNote} label={t('nav.notes')} panel="notes" activePanel={activePanel} collapsed={collapsed} onClick={handlePanelClick} />
            <NavItem icon={GraduationCap} label="Learning" panel="learning" activePanel={activePanel} collapsed={collapsed} onClick={handlePanelClick} />
            <NavItem icon={MessageCircle} label={t('nav.social')} panel="social" activePanel={activePanel} collapsed={collapsed} onClick={handlePanelClick} />
          </NavGroup>

          {/* Productivity actions */}
          {(onOpenFocusTimer || onOpenWeeklyReview) && (
            <>
              <Separator className="my-1" />
              {onOpenFocusTimer && (
                <NavItem icon={Target} label={t('nav.focusMode')} panel={null} activePanel={activePanel} collapsed={collapsed} onClick={() => onOpenFocusTimer()} />
              )}
              {onOpenWeeklyReview && (
                <NavItem icon={CalendarCheck} label={t('nav.weeklyReview')} panel={null} activePanel={activePanel} collapsed={collapsed} onClick={() => onOpenWeeklyReview()} />
              )}
            </>
          )}
        </nav>

        {/* Footer */}
        <div className="p-2 border-t border-sidebar-border space-y-0.5">
          <NavItem icon={Settings} label={t('nav.settings')} panel="settings" activePanel={activePanel} collapsed={collapsed} onClick={handlePanelClick} />

          {isAdmin && (
            <NavItem icon={BarChart3} label={t('nav.admin')} panel="admin" activePanel={activePanel} collapsed={collapsed} onClick={handlePanelClick} />
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
    </TooltipProvider>
  );
}
