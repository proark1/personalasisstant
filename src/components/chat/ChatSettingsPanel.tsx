import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Bell, BellOff, UserX, Star } from "lucide-react";
import { useChatSettings } from "@/hooks/useChatSettings";

interface ChatSettingsPanelProps {
  userId: string;
}

export function ChatSettingsPanel({ userId: _userId }: ChatSettingsPanelProps) {
  const { settings, blockedUsers, updateSettings, unblockUser, isInDndMode } = useChatSettings();

  const [dndStart, setDndStart] = useState(settings.dndStart || "22:00");
  const [dndEnd, setDndEnd] = useState(settings.dndEnd || "08:00");

  const daysOfWeek = [
    { value: 0, label: "Sun" },
    { value: 1, label: "Mon" },
    { value: 2, label: "Tue" },
    { value: 3, label: "Wed" },
    { value: 4, label: "Thu" },
    { value: 5, label: "Fri" },
    { value: 6, label: "Sat" },
  ];

  const toggleDndDay = (day: number) => {
    const newDays = settings.dndDays.includes(day)
      ? settings.dndDays.filter((d) => d !== day)
      : [...settings.dndDays, day];
    updateSettings({ dndDays: newDays });
  };

  const handleDndToggle = (enabled: boolean) => {
    updateSettings({
      dndEnabled: enabled,
      dndStart: enabled ? dndStart : undefined,
      dndEnd: enabled ? dndEnd : undefined,
    });
  };

  const handleTimeChange = () => {
    if (settings.dndEnabled) {
      updateSettings({ dndStart, dndEnd });
    }
  };

  return (
    <div className="space-y-4">
      {/* Do Not Disturb */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            {isInDndMode() ? (
              <BellOff className="w-5 h-5 text-orange-500" />
            ) : (
              <Bell className="w-5 h-5" />
            )}
            Do Not Disturb
            {isInDndMode() && (
              <Badge variant="secondary" className="ml-2">
                Active
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="dnd-toggle">Enable Do Not Disturb</Label>
            <Switch
              id="dnd-toggle"
              checked={settings.dndEnabled}
              onCheckedChange={handleDndToggle}
            />
          </div>

          {settings.dndEnabled && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Time</Label>
                  <Input
                    type="time"
                    value={dndStart}
                    onChange={(e) => setDndStart(e.target.value)}
                    onBlur={handleTimeChange}
                  />
                </div>
                <div className="space-y-2">
                  <Label>End Time</Label>
                  <Input
                    type="time"
                    value={dndEnd}
                    onChange={(e) => setDndEnd(e.target.value)}
                    onBlur={handleTimeChange}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Active Days</Label>
                <div className="flex gap-1">
                  {daysOfWeek.map((day) => (
                    <Button
                      key={day.value}
                      variant={settings.dndDays.includes(day.value) ? "default" : "outline"}
                      size="sm"
                      className="w-10 h-10 p-0"
                      onClick={() => toggleDndDay(day.value)}
                    >
                      {day.label}
                    </Button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  {settings.dndDays.length === 0
                    ? "DND active every day"
                    : `DND active on selected days only`}
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Blocked Users */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <UserX className="w-5 h-5" />
            Blocked Users
          </CardTitle>
        </CardHeader>
        <CardContent>
          {blockedUsers.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No blocked users</p>
          ) : (
            <ScrollArea className="h-[150px]">
              <div className="space-y-2">
                {blockedUsers.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between p-2 rounded bg-accent/30"
                  >
                    <div>
                      <p className="font-medium">{user.blockedName}</p>
                      {user.reason && (
                        <p className="text-xs text-muted-foreground">{user.reason}</p>
                      )}
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => unblockUser(user.blockedId)}>
                      Unblock
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Priority Contacts */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Star className="w-5 h-5" />
            Priority Contacts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {settings.priorityContacts.length} priority contact
            {settings.priorityContacts.length !== 1 ? "s" : ""}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Messages from priority contacts will always notify you, even during DND.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
