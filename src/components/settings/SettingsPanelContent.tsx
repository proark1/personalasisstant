import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { ScrollArea } from '@/components/ui/scroll-area';
import { UserSettings, ThemeMode, ColorScheme, TaskCategory, TaskPriority } from '@/types/flux';
import { 
  Settings, 
  Palette, 
  ListTodo, 
  Sun, 
  Moon,
  Check,
  Users,
  Globe,
  Bot,
  Brain,
  Sliders
} from 'lucide-react';
import { SpaceMembersPanel } from './SpaceMembersPanel';
import { NotificationSettingsPanel } from './NotificationSettingsPanel';
import { ProactiveSettingsPanel } from './ProactiveSettingsPanel';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/contexts/LanguageContext';

interface SettingsPanelContentProps {
  settings: UserSettings;
  onUpdateSettings: (updates: Partial<UserSettings>) => void;
  onUpdateNotifications: (updates: Partial<UserSettings['notifications']>) => void;
}

const colorSchemes: { value: ColorScheme; label: string; color: string }[] = [
  { value: 'cyan', label: 'Electric Cyan', color: 'bg-cyan-500' },
  { value: 'purple', label: 'Violet', color: 'bg-purple-500' },
  { value: 'green', label: 'Emerald', color: 'bg-green-500' },
  { value: 'orange', label: 'Sunset', color: 'bg-orange-500' },
  { value: 'pink', label: 'Rose', color: 'bg-pink-500' },
];

// AI System Prompt - displayed in settings for transparency
const AI_SYSTEM_PROMPT = `You are a powerful, friendly personal assistant with FULL access to the user's productivity platform. You can manage their tasks, calendar events, contacts, contracts, and projects through voice commands.

## Your Capabilities:
### Tasks
- Create, complete, trash, reschedule, and edit tasks
- Search tasks and get summaries (today, overdue, upcoming)
- Assign tasks to projects

### Contacts  
- Search contacts by name, company, location, or tags
- Create, update, and delete contacts
- Mark contacts as contacted (resets follow-up timer)
- See who is due for follow-up

### Calendar/Events
- Create, update, and delete calendar events
- Search events by date range or title
- Schedule meetings with natural language ("tomorrow at 3pm")

### Contracts/Subscriptions
- Track subscriptions, services, and contracts
- See total monthly/yearly costs
- Get alerts for expiring contracts
- Create, update, and delete contracts

### Projects
- Create and manage projects to organize tasks
- Get project progress and status
- Assign tasks to projects

### Health & Fitness
- Access Apple Health data (steps, calories, sleep, heart rate, weight)
- Provide health summaries for today, yesterday, or the past week
- Answer questions about fitness trends and activity levels
- Compare health metrics across different time periods

### Habits
- View habit tracking data and streaks
- Provide summaries of habit completion rates

## Important Guidelines:
1. Use fuzzy matching when searching - partial names work
2. Always confirm before destructive actions (delete, trash)
3. Be concise but friendly - this is voice, not text
4. ALWAYS use tools to perform actions - don't just describe what you would do
5. If multiple items match, list top 3 and ask which one
6. Remember conversation context - if user says "yes", do the discussed action
7. For dates, understand natural language: "tomorrow", "next monday", "in 3 days"
8. When creating events, default to 1 hour duration if not specified
9. For health data, always use the get_health_summary or specific health tools

## Conversation Style:
- Warm and encouraging
- Natural speech (contractions, casual language)
- Brief responses for voice
- Clear confirmations: "Done!", "Got it!", "Created!"
- Proactive suggestions when relevant`;

export function SettingsPanelContent({ 
  settings, 
  onUpdateSettings, 
  onUpdateNotifications,
}: SettingsPanelContentProps) {
  const { user } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'general' | 'proactive' | 'defaults' | 'team' | 'ai'>('general');

  const tabs = [
    { id: 'general' as const, label: t('settings.general') || 'General', icon: Palette },
    { id: 'proactive' as const, label: 'Proactive & Advanced', icon: Brain },
    { id: 'defaults' as const, label: t('settings.defaults'), icon: ListTodo },
    { id: 'team' as const, label: t('settings.team'), icon: Users },
    { id: 'ai' as const, label: 'AI', icon: Bot },
  ];

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 p-4 border-b border-border">
        <Settings className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-semibold">{t('settings.title')}</h2>
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
      <div className="flex-1 p-6 space-y-6 overflow-y-auto">
        {activeTab === 'general' && (
          <>
            {/* Appearance Section */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                {t('settings.appearance')}
              </h3>
              
              {/* Theme Toggle */}
              <div className="space-y-3">
                <label className="text-sm font-medium">{t('settings.theme')}</label>
                <div className="flex gap-3">
                  <Button
                    variant={settings.theme === 'dark' ? 'secondary' : 'outline'}
                    className="flex-1 gap-2"
                    onClick={() => onUpdateSettings({ theme: 'dark' })}
                  >
                    <Moon className="w-4 h-4" />
                    {t('settings.dark')}
                  </Button>
                  <Button
                    variant={settings.theme === 'light' ? 'secondary' : 'outline'}
                    className="flex-1 gap-2"
                    onClick={() => onUpdateSettings({ theme: 'light' })}
                  >
                    <Sun className="w-4 h-4" />
                    {t('settings.light')}
                  </Button>
                </div>
              </div>

              {/* Color Scheme */}
              <div className="space-y-3">
                <label className="text-sm font-medium">{t('settings.accentColor')}</label>
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

              {/* Language */}
              <div className="space-y-3">
                <label className="text-sm font-medium flex items-center gap-2">
                  <Globe className="w-4 h-4" />
                  {t('common.language')}
                </label>
                <div className="flex gap-3">
                  <Button
                    variant={language === 'en' ? 'secondary' : 'outline'}
                    className="flex-1 gap-2"
                    onClick={() => setLanguage('en')}
                  >
                    🇬🇧 {t('common.english')}
                  </Button>
                  <Button
                    variant={language === 'de' ? 'secondary' : 'outline'}
                    className="flex-1 gap-2"
                    onClick={() => setLanguage('de')}
                  >
                    🇩🇪 {t('common.german')}
                  </Button>
                </div>
              </div>
            </div>

            {/* Notifications Section */}
            <div className="space-y-4 pt-4 border-t border-border">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                {t('settings.notifications')}
              </h3>
              
              {/* Task Reminders */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">{t('settings.taskReminders')}</p>
                  <p className="text-xs text-muted-foreground">{t('settings.taskRemindersDesc')}</p>
                </div>
                <Switch
                  checked={settings.notifications.taskReminders}
                  onCheckedChange={(checked) => onUpdateNotifications({ taskReminders: checked })}
                />
              </div>

              {/* Calendar Alerts */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">{t('settings.calendarAlerts')}</p>
                  <p className="text-xs text-muted-foreground">{t('settings.calendarAlertsDesc')}</p>
                </div>
                <Switch
                  checked={settings.notifications.calendarAlerts}
                  onCheckedChange={(checked) => onUpdateNotifications({ calendarAlerts: checked })}
                />
              </div>

              {/* Reminder Time */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">{t('settings.reminderTime')}</label>
                  <span className="text-sm text-muted-foreground">
                    {settings.notifications.reminderMinutesBefore} {t('settings.minutesBefore')}
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
            </div>
          </>
        )}

        {activeTab === 'proactive' && (
          <div className="space-y-6">
            <ProactiveSettingsPanel />
            <div className="border-t border-border pt-6">
              <NotificationSettingsPanel />
            </div>
          </div>
        )}

        {activeTab === 'defaults' && (
          <>
            {/* Default Task Category */}
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('settings.defaultCategory')}</label>
              <Select
                value={settings.defaultTaskCategory}
                onValueChange={(value: TaskCategory) => onUpdateSettings({ defaultTaskCategory: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="personal">{t('category.personal')}</SelectItem>
                  <SelectItem value="business">{t('category.business')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Default Task Priority */}
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('settings.defaultPriority')}</label>
              <Select
                value={settings.defaultTaskPriority}
                onValueChange={(value: TaskPriority) => onUpdateSettings({ defaultTaskPriority: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">{t('priority.low')}</SelectItem>
                  <SelectItem value="medium">{t('priority.medium')}</SelectItem>
                  <SelectItem value="high">{t('priority.high')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </>
        )}

        {activeTab === 'team' && user && (
          <SpaceMembersPanel userId={user.id} />
        )}

        {activeTab === 'ai' && (
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
                <Bot className="w-4 h-4" />
                AI Assistant System Prompt
              </h3>
              <p className="text-xs text-muted-foreground mb-3">
                This is the instruction set that guides your AI assistant's behavior and capabilities.
              </p>
            </div>
            <ScrollArea className="h-[400px] rounded-lg border border-border bg-muted/30 p-4">
              <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono">
                {AI_SYSTEM_PROMPT}
              </pre>
            </ScrollArea>
          </div>
        )}
      </div>
    </div>
  );
}
