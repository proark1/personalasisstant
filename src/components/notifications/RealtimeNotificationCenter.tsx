import { formatDistanceToNow } from "date-fns";
import {
  Bell,
  Trash2,
  CheckCheck,
  X,
  Calendar,
  CheckSquare,
  FileText,
  Contact,
  Users,
  Share2,
  Clock,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useRealtimeNotifications, UserNotification } from "@/hooks/useRealtimeNotifications";
import { cn } from "@/lib/utils";

interface RealtimeNotificationCenterProps {
  userId: string | undefined;
}

const getNotificationIcon = (type: UserNotification["type"]) => {
  switch (type) {
    case "task":
      return CheckSquare;
    case "event":
      return Calendar;
    case "contract":
      return FileText;
    case "contact":
      return Contact;
    case "invitation":
      return Users;
    case "share":
      return Share2;
    case "reminder":
      return Clock;
    default:
      return Info;
  }
};

const getNotificationColor = (type: UserNotification["type"]) => {
  switch (type) {
    case "task":
      return "text-primary";
    case "event":
      return "text-accent";
    case "contract":
      return "text-warning";
    case "contact":
      return "text-info";
    case "invitation":
      return "text-success";
    case "share":
      return "text-primary";
    case "reminder":
      return "text-warning";
    default:
      return "text-muted-foreground";
  }
};

export function RealtimeNotificationCenter({ userId }: RealtimeNotificationCenterProps) {
  const { notifications, unreadCount, markRead, markAllRead, deleteNotification, clearAll } =
    useRealtimeNotifications(userId);

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 w-5 h-5 p-0 flex items-center justify-center text-xs"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader>
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-primary" />
              Notifications
              {unreadCount > 0 && <Badge variant="secondary">{unreadCount} new</Badge>}
            </SheetTitle>
            <div className="flex gap-1">
              {unreadCount > 0 && (
                <Button variant="ghost" size="sm" onClick={markAllRead} className="text-xs">
                  <CheckCheck className="w-4 h-4 mr-1" />
                  Mark all read
                </Button>
              )}
              {notifications.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearAll}
                  className="text-xs text-destructive hover:text-destructive"
                >
                  <Trash2 className="w-4 h-4 mr-1" />
                  Clear all
                </Button>
              )}
            </div>
          </div>
          <SheetDescription>Stay updated with shared items and reminders</SheetDescription>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-140px)] mt-4 -mx-6 px-6">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Bell className="w-12 h-12 text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">No notifications yet</p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                You'll be notified when there are updates
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {notifications.map((notification) => {
                const Icon = getNotificationIcon(notification.type);
                const iconColor = getNotificationColor(notification.type);

                return (
                  <div
                    key={notification.id}
                    className={cn(
                      "group relative p-4 rounded-lg border transition-colors",
                      notification.read ? "bg-background" : "bg-primary/5 border-primary/20",
                    )}
                    role="button"
                    tabIndex={0}
                    onClick={() => !notification.read && markRead(notification.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        if (!notification.read) markRead(notification.id);
                      }
                    }}
                  >
                    <div className="flex gap-3">
                      <div className={cn("mt-0.5", iconColor)}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <h4
                            className={cn(
                              "text-sm font-medium truncate",
                              !notification.read && "text-primary",
                            )}
                          >
                            {notification.title}
                          </h4>
                          <div className="flex items-center gap-1 shrink-0">
                            {!notification.read && (
                              <div className="w-2 h-2 rounded-full bg-primary" />
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="w-6 h-6 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteNotification(notification.id);
                              }}
                            >
                              <X className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                          {notification.message}
                        </p>
                        <p className="text-xs text-muted-foreground/70 mt-2">
                          {formatDistanceToNow(new Date(notification.created_at), {
                            addSuffix: true,
                          })}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
