import { useState, useEffect } from 'react';
import { Bell, Volume2, VolumeX, Moon, Clock, Vibrate, Share2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface NotificationPreferences {
  default_reminder_minutes: number;
  adhd_mode: boolean;
  sound_enabled: boolean;
  sound_type: string;
  vibration_enabled: boolean;
  quiet_hours_enabled: boolean;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  task_notifications: boolean;
  event_notifications: boolean;
  shared_item_notifications: boolean;
}

const DEFAULT_PREFERENCES: NotificationPreferences = {
  default_reminder_minutes: 30,
  adhd_mode: false,
  sound_enabled: true,
  sound_type: 'default',
  vibration_enabled: true,
  quiet_hours_enabled: false,
  quiet_hours_start: '22:00',
  quiet_hours_end: '08:00',
  task_notifications: true,
  event_notifications: true,
  shared_item_notifications: true,
};

const REMINDER_OPTIONS = [
  { value: 5, label: '5 minutes before' },
  { value: 10, label: '10 minutes before' },
  { value: 15, label: '15 minutes before' },
  { value: 30, label: '30 minutes before' },
  { value: 60, label: '1 hour before' },
  { value: 120, label: '2 hours before' },
  { value: 1440, label: '1 day before' },
];

const SOUND_OPTIONS = [
  { value: 'default', label: 'Default' },
  { value: 'gentle', label: 'Gentle Chime' },
  { value: 'urgent', label: 'Urgent Alert' },
  { value: 'melody', label: 'Soft Melody' },
  { value: 'none', label: 'Silent' },
];

export function NotificationSettingsPanel() {
  const { user } = useAuth();
  const [preferences, setPreferences] = useState<NotificationPreferences>(DEFAULT_PREFERENCES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      loadPreferences();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const loadPreferences = async () => {
    try {
      const { data, error } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', user?.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading preferences:', error);
      }

      if (data) {
        setPreferences({
          default_reminder_minutes: data.default_reminder_minutes,
          adhd_mode: data.adhd_mode,
          sound_enabled: data.sound_enabled,
          sound_type: data.sound_type,
          vibration_enabled: data.vibration_enabled,
          quiet_hours_enabled: data.quiet_hours_enabled,
          quiet_hours_start: data.quiet_hours_start,
          quiet_hours_end: data.quiet_hours_end,
          task_notifications: data.task_notifications,
          event_notifications: data.event_notifications,
          shared_item_notifications: data.shared_item_notifications,
        });
      }
    } catch (error) {
      console.error('Error loading preferences:', error);
    } finally {
      setLoading(false);
    }
  };

  const savePreferences = async () => {
    if (!user) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('notification_preferences')
        .upsert({
          user_id: user.id,
          ...preferences,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id',
        });

      if (error) throw error;
      toast.success('Notification preferences saved');
    } catch (error) {
      console.error('Error saving preferences:', error);
      toast.error('Failed to save preferences');
    } finally {
      setSaving(false);
    }
  };

  const updatePreference = <K extends keyof NotificationPreferences>(
    key: K,
    value: NotificationPreferences[K]
  ) => {
    setPreferences(prev => ({ ...prev, [key]: value }));
  };

  const playTestSound = () => {
    try {
      const audioContext = new (window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext!)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      const frequency = preferences.sound_type === 'urgent' ? 1000 : 
                       preferences.sound_type === 'gentle' ? 400 : 
                       preferences.sound_type === 'melody' ? 600 : 800;

      oscillator.frequency.value = frequency;
      oscillator.type = 'sine';
      gainNode.gain.value = 0.1;

      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.2);
      
      toast.success('Test sound played');
    } catch {
      toast.error('Could not play test sound');
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notification Settings
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-10 bg-muted rounded" />
            <div className="h-10 bg-muted rounded" />
            <div className="h-10 bg-muted rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Notification Settings
        </CardTitle>
        <CardDescription>
          Customize how and when you receive notifications
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Reminder Time */}
        <div className="space-y-3">
          <Label className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Default Reminder Time
          </Label>
          <Select
            value={preferences.default_reminder_minutes.toString()}
            onValueChange={(value) => updatePreference('default_reminder_minutes', parseInt(value))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {REMINDER_OPTIONS.map(option => (
                <SelectItem key={option.value} value={option.value.toString()}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* ADHD Mode */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>ADHD Mode</Label>
            <p className="text-sm text-muted-foreground">
              Multiple gentle reminders at 15min, 5min, and when due
            </p>
          </div>
          <Switch
            checked={preferences.adhd_mode}
            onCheckedChange={(checked) => updatePreference('adhd_mode', checked)}
          />
        </div>

        {/* Sound Settings */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-2">
              {preferences.sound_enabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
              Notification Sound
            </Label>
            <Switch
              checked={preferences.sound_enabled}
              onCheckedChange={(checked) => updatePreference('sound_enabled', checked)}
            />
          </div>
          
          {preferences.sound_enabled && (
            <div className="flex gap-2">
              <Select
                value={preferences.sound_type}
                onValueChange={(value) => updatePreference('sound_type', value)}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SOUND_OPTIONS.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={playTestSound}>
                Test
              </Button>
            </div>
          )}
        </div>

        {/* Vibration */}
        <div className="flex items-center justify-between">
          <Label className="flex items-center gap-2">
            <Vibrate className="h-4 w-4" />
            Vibration
          </Label>
          <Switch
            checked={preferences.vibration_enabled}
            onCheckedChange={(checked) => updatePreference('vibration_enabled', checked)}
          />
        </div>

        {/* Quiet Hours */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-2">
              <Moon className="h-4 w-4" />
              Quiet Hours
            </Label>
            <Switch
              checked={preferences.quiet_hours_enabled}
              onCheckedChange={(checked) => updatePreference('quiet_hours_enabled', checked)}
            />
          </div>
          
          {preferences.quiet_hours_enabled && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Start</Label>
                <input
                  type="time"
                  value={preferences.quiet_hours_start || '22:00'}
                  onChange={(e) => updatePreference('quiet_hours_start', e.target.value)}
                  className="w-full px-3 py-2 border rounded-md bg-background"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">End</Label>
                <input
                  type="time"
                  value={preferences.quiet_hours_end || '08:00'}
                  onChange={(e) => updatePreference('quiet_hours_end', e.target.value)}
                  className="w-full px-3 py-2 border rounded-md bg-background"
                />
              </div>
            </div>
          )}
        </div>

        {/* Notification Types */}
        <div className="space-y-3">
          <Label>Notification Types</Label>
          
          <div className="flex items-center justify-between">
            <span className="text-sm">Task Reminders</span>
            <Switch
              checked={preferences.task_notifications}
              onCheckedChange={(checked) => updatePreference('task_notifications', checked)}
            />
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-sm">Event Reminders</span>
            <Switch
              checked={preferences.event_notifications}
              onCheckedChange={(checked) => updatePreference('event_notifications', checked)}
            />
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-sm flex items-center gap-2">
              <Share2 className="h-3 w-3" />
              Shared Item Notifications
            </span>
            <Switch
              checked={preferences.shared_item_notifications}
              onCheckedChange={(checked) => updatePreference('shared_item_notifications', checked)}
            />
          </div>
        </div>

        {/* Save Button */}
        <Button 
          onClick={savePreferences} 
          disabled={saving}
          className="w-full"
        >
          {saving ? 'Saving...' : 'Save Preferences'}
        </Button>
      </CardContent>
    </Card>
  );
}
