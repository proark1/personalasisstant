import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { UserSettings, ThemeMode, ColorScheme, TaskCategory, TaskPriority } from '@/types/flux';
import { 
  Settings, 
  X, 
  Palette, 
  Bell, 
  ListTodo, 
  Sun, 
  Moon,
  Check
} from 'lucide-react';

interface SettingsPanelProps {
  settings: UserSettings;
  onUpdateSettings: (updates: Partial<UserSettings>) => void;
  onUpdateNotifications: (updates: Partial<UserSettings['notifications']>) => void;
  onClose: () => void;
}

const colorSchemes: { value: ColorScheme; label: string; color: string }[] = [
  { value: 'cyan', label: 'Electric Cyan', color: 'bg-cyan-500' },
  { value: 'purple', label: 'Violet', color: 'bg-purple-500' },
  { value: 'green', label: 'Emerald', color: 'bg-green-500' },
  { value: 'orange', label: 'Sunset', color: 'bg-orange-500' },
  { value: 'pink', label: 'Rose', color: 'bg-pink-500' },
];

export function SettingsPanel({ 
  settings, 
  onUpdateSettings, 
  onUpdateNotifications, 
  onClose 
}: SettingsPanelProps) {
  const [activeTab, setActiveTab] = useState<'appearance' | 'notifications' | 'defaults'>('appearance');

  const tabs = [
    { id: 'appearance' as const, label: 'Appearance', icon: Palette },
    { id: 'notifications' as const, label: 'Notifications', icon: Bell },
    { id: 'defaults' as const, label: 'Defaults', icon: ListTodo },
  ];

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="glass-panel-solid w-full max-w-lg animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold">Settings</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-3 text-sm transition-colors",
                activeTab === tab.id 
                  ? "text-primary border-b-2 border-primary -mb-px" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <tab.icon className="w-4 h-4" />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto">
          {activeTab === 'appearance' && (
            <>
              {/* Theme Toggle */}
              <div className="space-y-3">
                <label className="text-sm font-medium">Theme</label>
                <div className="flex gap-3">
                  <Button
                    variant={settings.theme === 'dark' ? 'secondary' : 'outline'}
                    className="flex-1 gap-2"
                    onClick={() => onUpdateSettings({ theme: 'dark' })}
                  >
                    <Moon className="w-4 h-4" />
                    Dark
                  </Button>
                  <Button
                    variant={settings.theme === 'light' ? 'secondary' : 'outline'}
                    className="flex-1 gap-2"
                    onClick={() => onUpdateSettings({ theme: 'light' })}
                  >
                    <Sun className="w-4 h-4" />
                    Light
                  </Button>
                </div>
              </div>

              {/* Color Scheme */}
              <div className="space-y-3">
                <label className="text-sm font-medium">Accent Color</label>
                <div className="grid grid-cols-5 gap-2">
                  {colorSchemes.map((scheme) => (
                    <button
                      key={scheme.value}
                      onClick={() => onUpdateSettings({ colorScheme: scheme.value })}
                      className={cn(
                        "aspect-square rounded-lg flex items-center justify-center transition-transform hover:scale-110",
                        scheme.color,
                        settings.colorScheme === scheme.value && "ring-2 ring-offset-2 ring-offset-background ring-foreground"
                      )}
                      title={scheme.label}
                    >
                      {settings.colorScheme === scheme.value && (
                        <Check className="w-4 h-4 text-white" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {activeTab === 'notifications' && (
            <>
              {/* Task Reminders */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">Task Reminders</p>
                  <p className="text-xs text-muted-foreground">Get notified before task deadlines</p>
                </div>
                <Switch
                  checked={settings.notifications.taskReminders}
                  onCheckedChange={(checked) => onUpdateNotifications({ taskReminders: checked })}
                />
              </div>

              {/* Calendar Alerts */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">Calendar Alerts</p>
                  <p className="text-xs text-muted-foreground">Reminders before scheduled events</p>
                </div>
                <Switch
                  checked={settings.notifications.calendarAlerts}
                  onCheckedChange={(checked) => onUpdateNotifications({ calendarAlerts: checked })}
                />
              </div>

              {/* Reminder Time */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Reminder Time</label>
                  <span className="text-sm text-muted-foreground">
                    {settings.notifications.reminderMinutesBefore} minutes before
                  </span>
                </div>
                <Slider
                  value={[settings.notifications.reminderMinutesBefore]}
                  onValueChange={([value]) => onUpdateNotifications({ reminderMinutesBefore: value })}
                  min={5}
                  max={60}
                  step={5}
                  className="w-full"
                />
              </div>
            </>
          )}

          {activeTab === 'defaults' && (
            <>
              {/* Default Task Category */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Default Task Category</label>
                <Select
                  value={settings.defaultTaskCategory}
                  onValueChange={(value: TaskCategory) => onUpdateSettings({ defaultTaskCategory: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="personal">Personal</SelectItem>
                    <SelectItem value="business">Business</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Default Task Priority */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Default Task Priority</label>
                <Select
                  value={settings.defaultTaskPriority}
                  onValueChange={(value: TaskPriority) => onUpdateSettings({ defaultTaskPriority: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
