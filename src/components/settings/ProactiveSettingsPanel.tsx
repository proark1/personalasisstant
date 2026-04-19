import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Bell, Brain, Calendar, Clock, FileText, Heart, Moon, Users, Zap, Cake, Sparkles } from 'lucide-react';
import { useProactiveSettings } from '@/hooks/useProactiveSettings';
import { useExpoPushNotifications } from '@/hooks/useExpoPushNotifications';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

export function ProactiveSettingsPanel() {
  const { settings, loading, updateSettings, triggerProactiveCheck } = useProactiveSettings();
  const { permissionStatus, requestPermission, isNative } = useExpoPushNotifications();

  if (loading) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!settings) return null;

  return (
    <div className="space-y-6 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            Proactive Assistant
          </h2>
          <p className="text-sm text-muted-foreground">
            Let Dori remind you before you forget
          </p>
        </div>
        <Switch
          checked={settings.enabled}
          onCheckedChange={(enabled) => updateSettings({ enabled })}
        />
      </div>

      {settings.enabled && (
        <>
          {/* Push Notification Permission */}
          {isNative && permissionStatus !== 'granted' && (
            <Card className="border-primary/50 bg-primary/5">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Bell className="h-5 w-5 text-primary" />
                    <div>
                      <p className="font-medium">Enable Push Notifications</p>
                      <p className="text-sm text-muted-foreground">Get reminders even when the app is closed</p>
                    </div>
                  </div>
                  <Button size="sm" onClick={requestPermission}>
                    Enable
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Reminder Types */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">What to Remind You About</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <SettingRow
                icon={<FileText className="h-4 w-4" />}
                label="Forgotten Tasks"
                description="Tasks untouched for several days"
                checked={settings.forgotten_tasks_enabled}
                onChange={(v) => updateSettings({ forgotten_tasks_enabled: v })}
              />
              <SettingRow
                icon={<Calendar className="h-4 w-4" />}
                label="Contract Renewals"
                description="Upcoming contract deadlines"
                checked={settings.contract_renewals_enabled}
                onChange={(v) => updateSettings({ contract_renewals_enabled: v })}
              />
              <SettingRow
                icon={<Users className="h-4 w-4" />}
                label="Contact Check-ins"
                description="Reconnect with people you haven't talked to"
                checked={settings.contact_checkins_enabled}
                onChange={(v) => updateSettings({ contact_checkins_enabled: v })}
              />
              <SettingRow
                icon={<Clock className="h-4 w-4" />}
                label="Event Preparation"
                description="Get ready before meetings and events"
                checked={settings.event_prep_enabled}
                onChange={(v) => updateSettings({ event_prep_enabled: v })}
              />
              <SettingRow
                icon={<Zap className="h-4 w-4" />}
                label="Habit Streaks"
                description="Don't break your streaks"
                checked={settings.habit_streaks_enabled}
                onChange={(v) => updateSettings({ habit_streaks_enabled: v })}
              />
              <SettingRow
                icon={<Heart className="h-4 w-4" />}
                label="Daily Review"
                description="Evening reflection prompts"
                checked={settings.daily_review_enabled}
                onChange={(v) => updateSettings({ daily_review_enabled: v })}
              />
              <SettingRow
                icon={<Clock className="h-4 w-4" />}
                label="Meeting Briefings"
                description="Pings 15/5/1 min before each meeting with context"
                checked={settings.meeting_briefing_enabled ?? true}
                onChange={(v) => updateSettings({ meeting_briefing_enabled: v })}
              />
              <SettingRow
                icon={<Heart className="h-4 w-4" />}
                label="Meeting Follow-ups"
                description="Asks how it went after each meeting"
                checked={settings.meeting_followup_enabled ?? true}
                onChange={(v) => updateSettings({ meeting_followup_enabled: v })}
              />
              <SettingRow
                icon={<Bell className="h-4 w-4" />}
                label="Telegram Alerts"
                description="Mirror critical alerts to your Telegram bot"
                checked={settings.telegram_proactive_enabled ?? true}
                onChange={(v) => updateSettings({ telegram_proactive_enabled: v })}
              />
              <SettingRow
                icon={<Users className="h-4 w-4" />}
                label="Send to Family Group"
                description="Prefer the linked Telegram group over personal chat"
                checked={settings.telegram_group_enabled ?? true}
                onChange={(v) => updateSettings({ telegram_group_enabled: v })}
              />
              <SettingRow
                icon={<Cake className="h-4 w-4" />}
                label="Birthday Reminders"
                description="Heads-up before contacts' birthdays so you can plan a gift"
                checked={settings.birthday_reminders_enabled ?? true}
                onChange={(v) => updateSettings({ birthday_reminders_enabled: v })}
              />
              <SettingRow
                icon={<Moon className="h-4 w-4" />}
                label="Prayer Reminders"
                description="Telegram nudge a few minutes before each salah"
                checked={settings.prayer_reminders_enabled ?? false}
                onChange={(v) => updateSettings({ prayer_reminders_enabled: v })}
              />
              <SettingRow
                icon={<Sparkles className="h-4 w-4" />}
                label="Evening Dua Reminder"
                description="Gentle nudge after Maghrib to make dua"
                checked={settings.evening_dua_enabled ?? false}
                onChange={(v) => updateSettings({ evening_dua_enabled: v })}
              />
            </CardContent>
          </Card>

          {/* Thresholds */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Sensitivity</CardTitle>
              <CardDescription>How soon to remind you</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label className="text-sm">Forgotten task threshold: {settings.forgotten_task_days} days</Label>
                <Slider
                  value={[settings.forgotten_task_days]}
                  onValueChange={([v]) => updateSettings({ forgotten_task_days: v })}
                  min={1}
                  max={14}
                  step={1}
                  className="mt-2"
                />
              </div>
              <div>
                <Label className="text-sm">Contact check-in: {settings.contact_checkin_days} days</Label>
                <Slider
                  value={[settings.contact_checkin_days]}
                  onValueChange={([v]) => updateSettings({ contact_checkin_days: v })}
                  min={7}
                  max={60}
                  step={1}
                  className="mt-2"
                />
              </div>
              {settings.prayer_reminders_enabled && (
                <div>
                  <Label className="text-sm">Prayer reminder: {settings.prayer_reminder_minutes ?? 10} min before</Label>
                  <Slider
                    value={[settings.prayer_reminder_minutes ?? 10]}
                    onValueChange={([v]) => updateSettings({ prayer_reminder_minutes: v })}
                    min={5}
                    max={30}
                    step={5}
                    className="mt-2"
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quiet Hours */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Moon className="h-4 w-4" />
                    Quiet Hours
                  </CardTitle>
                  <CardDescription>No notifications during these hours</CardDescription>
                </div>
                <Switch
                  checked={settings.quiet_hours_enabled}
                  onCheckedChange={(v) => updateSettings({ quiet_hours_enabled: v })}
                />
              </div>
            </CardHeader>
            {settings.quiet_hours_enabled && (
              <CardContent>
                <div className="flex items-center gap-4 text-sm">
                  <span>{settings.quiet_hours_start}</span>
                  <span className="text-muted-foreground">to</span>
                  <span>{settings.quiet_hours_end}</span>
                </div>
              </CardContent>
            )}
          </Card>

          {/* Delivery Channels */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Notification Channels</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <SettingRow
                icon={<Bell className="h-4 w-4" />}
                label="Push Notifications"
                description="Get notified on your phone"
                checked={settings.push_notifications_enabled}
                onChange={(v) => updateSettings({ push_notifications_enabled: v })}
              />
              <SettingRow
                icon={<FileText className="h-4 w-4" />}
                label="In-App Notifications"
                description="See reminders in the app"
                checked={settings.in_app_notifications_enabled}
                onChange={(v) => updateSettings({ in_app_notifications_enabled: v })}
              />
            </CardContent>
          </Card>

          {/* Test Button */}
          <Button 
            variant="outline" 
            className="w-full"
            onClick={() => triggerProactiveCheck()}
          >
            Test Proactive Check Now
          </Button>
        </>
      )}
    </div>
  );
}

function SettingRow({ 
  icon, 
  label, 
  description, 
  checked, 
  onChange 
}: { 
  icon: React.ReactNode;
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="text-muted-foreground">{icon}</div>
        <div>
          <Label className="text-sm font-medium">{label}</Label>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
