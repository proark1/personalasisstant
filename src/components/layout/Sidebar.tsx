import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { prefetchPanel } from "@/lib/panelPrefetch";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Sparkles,
  LogOut,
  Target,
  CalendarCheck,
  Zap,
  BarChart3,
} from "lucide-react";
import { TaskCategory } from "@/types/flux";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUnreadEmailCount } from "@/hooks/useUnreadEmailCount";
import {
  NAV_AREAS,
  SETTINGS_ITEM,
  areaForPanel,
  resolveNavLabel,
  type NavItem as NavConfigItem,
} from "@/config/navigation";

export type SidebarFilter = TaskCategory | "all" | "shared";
export type ActivePanel =
  | "tasks"
  | "social"
  | "calendar"
  | "assistant"
  | "dashboard"
  | "projects"
  | "contacts"
  | "contracts"
  | "activity"
  | "settings"
  | "notes"
  | "habits"
  | "admin"
  | "family"
  | "cooking"
  | "islam"
  | "properties"
  | "startups"
  | "news"
  | "health"
  | "email"
  | "finances"
  | "travel"
  | "assets"
  | "personal-health"
  | "relationships-plus"
  | "learning"
  | "journal"
  | "challenges"
  | "location-reminders"
  | "family-members"
  | "family-calendar"
  | "child-mode"
  | "correlations"
  | "meetings"
  | "content"
  | "content-liked"
  | "content-calendar"
  | "content-profile"
  | null;

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

function NavItem({
  icon: Icon,
  label,
  panel,
  activePanel,
  collapsed,
  onClick,
  badge,
}: NavItemProps) {
  const isActive = activePanel === panel;
  // Warm the panel's chunk on hover/focus so the click feels instant.
  const warm = () => prefetchPanel(panel as string);
  const btn = (
    <Button
      variant={isActive ? "secondary" : "ghost"}
      className={cn(
        "w-full h-9 gap-3 relative",
        collapsed ? "justify-center px-0" : "justify-start",
        isActive && "bg-sidebar-accent text-sidebar-primary font-medium",
      )}
      onClick={() => onClick(panel)}
      onMouseEnter={warm}
      onFocus={warm}
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
          {badge > 99 ? "99+" : badge}
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
  icon: React.ElementType;
  collapsed: boolean;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

function NavGroup({ title, icon: Icon, collapsed, defaultOpen = false, children }: NavGroupProps) {
  const [open, setOpen] = useState(defaultOpen);

  // When the active panel moves into this area, make sure it's revealed.
  useEffect(() => {
    if (defaultOpen) setOpen(true);
  }, [defaultOpen]);

  if (collapsed) {
    return <div className="space-y-0.5">{children}</div>;
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center gap-2 w-full px-3 py-1.5 group cursor-pointer rounded-md hover:bg-sidebar-accent/50 transition-colors">
        <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
        <span className="text-sm font-medium text-foreground/80">{title}</span>
        <ChevronDown
          className={cn(
            "w-3.5 h-3.5 text-muted-foreground ml-auto transition-transform duration-200",
            !open && "-rotate-90",
          )}
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-0.5 pt-0.5 pl-2">{children}</CollapsibleContent>
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
      if (!user) {
        setIsAdmin(false);
        return;
      }

      const { data, error } = await supabase.rpc("is_admin", {
        check_user_id: user.id,
      });

      if (error) {
        console.error("Error checking sidebar admin access:", error);
      }

      setIsAdmin(Boolean(data));
    };
    checkAdmin();
  }, [user]);

  const handlePanelClick = (panel: ActivePanel) => {
    if (onPanelChange) {
      onPanelChange(activePanel === panel ? "tasks" : panel);
    }
  };

  const label = (item: NavConfigItem) => resolveNavLabel(item, t);
  const activeArea = areaForPanel(activePanel ?? "")?.id;

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          "h-screen shrink-0 bg-sidebar border-r border-sidebar-border flex flex-col transition-all duration-300",
          collapsed ? "w-16" : "w-56",
        )}
      >
        {/* Header */}
        <div className="h-14 flex items-center justify-between px-3 border-b border-sidebar-border">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-primary-foreground" />
            </div>
            {!collapsed && <span className="font-semibold text-foreground">DarAI</span>}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!collapsed}
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
              className={cn("w-full gap-2", collapsed ? "justify-center px-0" : "justify-start")}
              onClick={onOpenTodayFocus}
            >
              <Zap className="w-4 h-4 shrink-0" />
              {!collapsed && <span className="text-sm font-medium">{t("nav.todayFocus")}</span>}
            </Button>
          </div>
        )}

        <Separator className="my-2 mx-2" />

        {/* Navigation — 7 areas, only the active one expanded */}
        <nav className="flex-1 px-2 space-y-1 overflow-y-auto pb-2">
          {NAV_AREAS.map((area) => {
            // A single-item area (e.g. Home) renders as a plain nav row.
            if (area.items.length === 1) {
              const only = area.items[0];
              return (
                <NavItem
                  key={area.id}
                  icon={only.icon}
                  label={label(only)}
                  panel={only.id as ActivePanel}
                  activePanel={activePanel}
                  collapsed={collapsed}
                  onClick={handlePanelClick}
                />
              );
            }
            return (
              <NavGroup
                key={area.id}
                title={area.label}
                icon={area.icon}
                collapsed={collapsed}
                defaultOpen={activeArea === area.id}
              >
                {area.items.map((item) => (
                  <NavItem
                    key={item.id}
                    icon={item.icon}
                    label={label(item)}
                    panel={item.id as ActivePanel}
                    activePanel={activePanel}
                    collapsed={collapsed}
                    onClick={handlePanelClick}
                    badge={item.id === "email" ? unreadCount || undefined : undefined}
                  />
                ))}
              </NavGroup>
            );
          })}

          {/* Productivity tools (modals, not panels) */}
          {(onOpenFocusTimer || onOpenWeeklyReview) && (
            <NavGroup title="Productivity" icon={Target} collapsed={collapsed}>
              {onOpenFocusTimer && (
                <NavItem
                  icon={Target}
                  label={t("nav.focusMode")}
                  panel={null}
                  activePanel={activePanel}
                  collapsed={collapsed}
                  onClick={() => onOpenFocusTimer()}
                />
              )}
              {onOpenWeeklyReview && (
                <NavItem
                  icon={CalendarCheck}
                  label={t("nav.weeklyReview")}
                  panel={null}
                  activePanel={activePanel}
                  collapsed={collapsed}
                  onClick={() => onOpenWeeklyReview()}
                />
              )}
            </NavGroup>
          )}
        </nav>

        {/* Footer */}
        <div className="p-2 border-t border-sidebar-border space-y-0.5">
          <NavItem
            icon={SETTINGS_ITEM.icon}
            label={label(SETTINGS_ITEM)}
            panel="settings"
            activePanel={activePanel}
            collapsed={collapsed}
            onClick={handlePanelClick}
          />

          {isAdmin && (
            <NavItem
              icon={BarChart3}
              label={t("nav.admin")}
              panel="admin"
              activePanel={activePanel}
              collapsed={collapsed}
              onClick={handlePanelClick}
            />
          )}

          {onSignOut && (
            <Button
              variant="ghost"
              className={cn(
                "w-full h-9 gap-3 text-muted-foreground hover:text-destructive",
                collapsed ? "justify-center px-0" : "justify-start",
              )}
              onClick={onSignOut}
            >
              <LogOut className="w-4 h-4 shrink-0" />
              {!collapsed && <span className="text-sm">{t("nav.signOut")}</span>}
            </Button>
          )}
        </div>
      </aside>
    </TooltipProvider>
  );
}
