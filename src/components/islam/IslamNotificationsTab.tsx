import { useState, useEffect } from "react";
import { GlassCard } from "@/components/ui/glass-card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";

import { motion } from "framer-motion";
import { staggerItem, staggerContainer } from "@/components/ui/panel-shell";
import { Moon, Calendar, BookOpen, Zap, Loader2 } from "lucide-react";
import { useIslamicNotifications } from "@/hooks/useIslamicNotifications";

const PRAYER_NAMES = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"];

export function IslamNotificationsTab() {
  const {
    settings,
    isLoading,
    isSaving,
    toggleEventReminders,
    toggleDailyHadith,
    togglePrayerReminders,
    updatePrayerSelections,
    updateHadithTime,
    updateEventReminderTime,
    updatePrayerReminderMinutes,
    updateEventReminderHours,
  } = useIslamicNotifications();

  const [tempHadithTime, setTempHadithTime] = useState(settings?.daily_hadith_time || "07:00");
  const [tempEventTime, setTempEventTime] = useState(settings?.events_send_time || "08:00");

  // Sync temp states when settings load
  useEffect(() => {
    if (settings?.daily_hadith_time) setTempHadithTime(settings.daily_hadith_time);
    if (settings?.events_send_time) setTempEventTime(settings.events_send_time);
  }, [settings?.daily_hadith_time, settings?.events_send_time]);

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        Failed to load notification settings
      </div>
    );
  }

  return (
    <motion.div
      className="p-3 md:p-4 space-y-4"
      variants={staggerContainer}
      initial="initial"
      animate="animate"
    >
      {/* Islamic Event Reminders */}
      <motion.div variants={staggerItem}>
        <GlassCard className="p-5">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
                <Calendar className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-medium text-base">Islamic Events Reminders</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Get notified about Eid, Ramadan, Day of Arafah, and other important dates
                </p>
              </div>
            </div>
            <Switch
              checked={settings.events_enabled}
              onCheckedChange={toggleEventReminders}
              disabled={isSaving}
            />
          </div>

          {settings.events_enabled && (
            <div className="space-y-3 mt-4 border-t pt-4">
              <div>
                <Label className="text-xs text-muted-foreground mb-2 block">
                  Notify before event
                </Label>
                <Slider
                  value={[settings.events_hours_before]}
                  onValueChange={(value) => updateEventReminderHours(value[0])}
                  min={1}
                  max={48}
                  step={1}
                  disabled={isSaving}
                  className="mb-1"
                />
                <p className="text-xs text-foreground font-medium">
                  {settings.events_hours_before} hours before
                </p>
              </div>

              <div>
                <Label htmlFor="event-time" className="text-xs text-muted-foreground mb-2 block">
                  Preferred notification time
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="event-time"
                    type="time"
                    value={tempEventTime}
                    onChange={(e) => setTempEventTime(e.target.value)}
                    disabled={isSaving}
                    className="flex-1"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => updateEventReminderTime(tempEventTime)}
                    disabled={isSaving}
                  >
                    {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : "Save"}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </GlassCard>
      </motion.div>

      {/* Daily Hadith */}
      <motion.div variants={staggerItem}>
        <GlassCard className="p-5">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center flex-shrink-0 mt-1">
                <BookOpen className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <h3 className="font-medium text-base">Daily Hadith</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Authentic Sunni hadiths from Sahih Bukhari, Muslim, Tirmidhi, and Abu Dawud
                </p>
              </div>
            </div>
            <Switch
              checked={settings.daily_hadith_enabled}
              onCheckedChange={toggleDailyHadith}
              disabled={isSaving}
            />
          </div>

          {settings.daily_hadith_enabled && (
            <div className="space-y-3 mt-4 border-t pt-4">
              <div>
                <Label htmlFor="hadith-time" className="text-xs text-muted-foreground mb-2 block">
                  Daily hadith delivery time
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="hadith-time"
                    type="time"
                    value={tempHadithTime}
                    onChange={(e) => setTempHadithTime(e.target.value)}
                    disabled={isSaving}
                    className="flex-1"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => updateHadithTime(tempHadithTime)}
                    disabled={isSaving}
                  >
                    {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : "Save"}
                  </Button>
                </div>
              </div>
              <Badge variant="secondary" className="text-xs">
                📖 Arabic + English translation
              </Badge>
            </div>
          )}
        </GlassCard>
      </motion.div>

      {/* Prayer Reminders */}
      <motion.div variants={staggerItem}>
        <GlassCard className="p-5">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0 mt-1">
                <Moon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h3 className="font-medium text-base">Prayer Time Reminders</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Get reminded before each Salah for the five daily prayers
                </p>
              </div>
            </div>
            <Switch
              checked={settings.prayer_reminders_enabled}
              onCheckedChange={togglePrayerReminders}
              disabled={isSaving}
            />
          </div>

          {settings.prayer_reminders_enabled && (
            <div className="space-y-3 mt-4 border-t pt-4">
              <div>
                <Label className="text-xs text-muted-foreground mb-2 block">
                  Remind before each prayer
                </Label>
                <Slider
                  value={[settings.prayer_reminder_minutes_before]}
                  onValueChange={(value) => updatePrayerReminderMinutes(value[0])}
                  min={1}
                  max={30}
                  step={1}
                  disabled={isSaving}
                  className="mb-1"
                />
                <p className="text-xs text-foreground font-medium">
                  {settings.prayer_reminder_minutes_before} minutes before
                </p>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground mb-3 block">Select prayers</Label>
                <div className="grid grid-cols-2 gap-3">
                  {PRAYER_NAMES.map((prayer) => (
                    <label
                      key={prayer}
                      className="flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-primary/5 transition-colors"
                    >
                      <Checkbox
                        checked={settings.prayer_reminders_selected.includes(prayer)}
                        onCheckedChange={(checked) => {
                          const updated = checked
                            ? [...settings.prayer_reminders_selected, prayer]
                            : settings.prayer_reminders_selected.filter((p) => p !== prayer);
                          updatePrayerSelections(updated);
                        }}
                        disabled={isSaving}
                      />
                      <span className="text-sm font-medium">{prayer}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}
        </GlassCard>
      </motion.div>

      {/* Notification Status */}
      <motion.div variants={staggerItem}>
        <GlassCard variant="gradient" className="p-5">
          <div className="flex items-start gap-3">
            <Zap className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium mb-1">All Sunni-Based</p>
              <p className="text-xs text-muted-foreground">
                Hadiths from authentic Sunni collections: Sahih Bukhari, Sahih Muslim, Sunan
                at-Tirmidhi, and Sunan Abu Dawud. Prayer times calculated using trusted Sunni
                methods.
              </p>
            </div>
          </div>
        </GlassCard>
      </motion.div>
    </motion.div>
  );
}
