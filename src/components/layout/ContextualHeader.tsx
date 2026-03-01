import { Button } from '@/components/ui/button';
import { Search, Bell, Menu } from 'lucide-react';
import { NotificationCenter } from '@/components/notifications/NotificationCenter';
import { DoriNotificationIcon } from '@/components/assistant/DoriNotificationIcon';
import { useLanguage } from '@/contexts/LanguageContext';

interface ContextualHeaderProps {
  title: string;
  onOpenMenu?: () => void;
  onOpenSearch?: () => void;
  notifications: any[];
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onDeleteNotification: (id: string) => void;
  onClearAll: () => void;
  rightSlot?: React.ReactNode;
}

export function ContextualHeader({
  title,
  onOpenMenu,
  onOpenSearch,
  notifications,
  onMarkRead,
  onMarkAllRead,
  onDeleteNotification,
  onClearAll,
  rightSlot,
}: ContextualHeaderProps) {
  return (
    <header className="h-14 px-4 flex items-center justify-between border-b border-border bg-background/95 backdrop-blur-lg shrink-0 sticky top-0 z-50">
      <div className="flex items-center gap-1 min-w-0">
        {onOpenMenu && (
          <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={onOpenMenu}>
            <Menu className="w-5 h-5" />
          </Button>
        )}
        <h1 className="text-lg font-semibold text-foreground truncate">{title}</h1>
      </div>
      <div className="flex items-center gap-1">
        {onOpenSearch && (
          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={onOpenSearch}>
            <Search className="w-4.5 h-4.5" />
          </Button>
        )}
        <DoriNotificationIcon />
        <NotificationCenter
          notifications={notifications}
          onMarkRead={onMarkRead}
          onMarkAllRead={onMarkAllRead}
          onDelete={onDeleteNotification}
          onClearAll={onClearAll}
        />
        {rightSlot}
      </div>
    </header>
  );
}
