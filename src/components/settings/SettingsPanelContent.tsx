import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { UserSettings, ThemeMode, ColorScheme, TaskCategory, TaskPriority } from '@/types/flux';
import { 
  Settings, 
  Palette, 
  ListTodo, 
  Sun, 
  Moon,
  Sparkles,
  Check,
  Users,
  Globe,
  Bot,
  Brain,
  Info,
  CheckSquare,
  Calendar,
  UserCircle,
  FileText,
  Home,
  Heart,
  Target,
  MessageSquare,
  Phone,
  Bell,
  Search,
  MapPin,
  TrendingUp,
  Shield,
  Loader2,
  Keyboard,
  Fingerprint
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SpaceMembersPanel } from './SpaceMembersPanel';
import { NotificationSettingsPanel } from './NotificationSettingsPanel';
import { ProactiveSettingsPanel } from './ProactiveSettingsPanel';
import { KeyboardShortcutsPanel, useKeyboardShortcutsPanel } from './KeyboardShortcutsPanel';
import { CalendarConnectionsPanel } from './CalendarConnectionsPanel';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/contexts/LanguageContext';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useStatusBar } from '@/hooks/useStatusBar';
import { useToast } from '@/hooks/use-toast';
import { useBiometricAuth } from '@/hooks/useBiometricAuth';
import { usePrayerNotificationSettings } from '@/hooks/usePrayerNotificationSettings';

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

// App features for Info tab
const APP_FEATURES = [
  {
    category: 'Task Management',
    icon: CheckSquare,
    features: [
      'Create, edit, and organize tasks with priorities and categories',
      'Kanban board view for visual task management',
      'Project organization with progress tracking',
      'Task templates for recurring workflows',
      'Tag system for flexible categorization',
      'Smart task parsing from natural language',
      'Recurrence support for repeating tasks',
    ]
  },
  {
    category: 'Calendar & Events',
    icon: Calendar,
    features: [
      'Full calendar with day, week, and month views',
      'Event creation with location and attendees',
      'External calendar import (ICS files)',
      'Recurrence rules for repeating events',
      'Event reminders and notifications',
      'Public holiday integration by country',
    ]
  },
  {
    category: 'Contacts & CRM',
    icon: UserCircle,
    features: [
      'Contact management with detailed profiles',
      'Company and relationship tracking',
      'Follow-up reminders and last contact dates',
      'Contact suggestions based on patterns',
      'Tags and notes for each contact',
    ]
  },
  {
    category: 'Contracts & Subscriptions',
    icon: FileText,
    features: [
      'Track all contracts and subscriptions',
      'Cost tracking (monthly/yearly)',
      'Renewal date alerts and cancellation notices',
      'Document upload and storage',
      'Auto-renewal tracking',
    ]
  },
  {
    category: 'Family Hub',
    icon: Home,
    features: [
      'Family member profiles with health info',
      'Household task management and assignments',
      'Family calendar with shared events',
      'Meal planning and recipe management',
      'Shopping lists with smart suggestions',
      'Budget tracking and expense categories',
      'Document storage (IDs, medical records)',
      'Medication and vaccination tracking',
      'Child dashboard with school info',
    ]
  },
  {
    category: 'Health & Wellness',
    icon: Heart,
    features: [
      'Apple Health integration (steps, sleep, heart rate)',
      'Manual health metric tracking',
      'Age-based health checkup reminders',
      'Daily check-ins (mood, energy, sleep)',
      'Life correlations (sleep vs productivity)',
      'Weekly wellness insights',
    ]
  },
  {
    category: 'Habits & Goals',
    icon: Target,
    features: [
      'Habit tracking with streaks',
      'Goal setting with progress visualization',
      'Daily/weekly habit reminders',
      'Gamification with XP and celebrations',
    ]
  },
  {
    category: 'Communication',
    icon: MessageSquare,
    features: [
      'Direct messaging with read receipts',
      'Group chats with admin controls',
      'Voice messages with playback',
      'Message reactions and emoji picker',
      'Typing indicators',
      'End-to-end encryption support',
    ]
  },
  {
    category: 'Voice & Video Calls',
    icon: Phone,
    features: [
      'WebRTC-based audio/video calls',
      'Call recording with cloud storage',
      'Call history and duration tracking',
      'In-call chat messaging',
      'Online presence indicators',
    ]
  },
  {
    category: 'AI Assistant (Dori)',
    icon: Sparkles,
    features: [
      'Voice-activated commands via OpenAI Realtime',
      'Gemini Live integration for conversations',
      'Natural language task creation',
      'Smart scheduling suggestions',
      'Morning briefing with personalized news',
      'Recipe assistant for meal planning',
      'Text-to-speech for hands-free use',
      'AI memory for personalized responses',
    ]
  },
  {
    category: 'Proactive Features',
    icon: Bell,
    features: [
      'Forgotten task reminders',
      'Contract renewal alerts',
      'Contact check-in suggestions',
      'Event preparation nudges',
      'Habit streak protection',
      'Daily review prompts',
      'Smart nudges based on context',
      'Quiet hours configuration',
    ]
  },
  {
    category: 'Smart Insights',
    icon: TrendingUp,
    features: [
      'Day prediction scores',
      'Weekly insights and patterns',
      'Life correlations analysis',
      'Weekly coach recommendations',
      'Activity feed tracking',
      'User pattern analysis',
    ]
  },
  {
    category: 'Search & Organization',
    icon: Search,
    features: [
      'Global search across all data',
      'Tag-based filtering',
      'Project-based organization',
      'Notes with markdown support',
      'Brain dump inbox for quick capture',
    ]
  },
  {
    category: 'Location Features',
    icon: MapPin,
    features: [
      'Location-based reminders',
      'Geofence triggers (arrive/leave)',
      'Weather integration for planning',
      'Property management tracking',
    ]
  },
  {
    category: 'Team & Sharing',
    icon: Users,
    features: [
      'Space members for data sharing',
      'Granular sharing controls by category',
      'Shared tasks, events, and contacts',
      'Real-time collaboration updates',
      'Consent-based sharing with confirmations',
    ]
  },
  {
    category: 'Security & Privacy',
    icon: Shield,
    features: [
      'Row-level security on all data',
      'Encrypted document storage',
      'Secure call recordings',
      'Time-limited signed URLs for files',
      'Consent tracking for data sharing',
    ]
  },
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
  const { profile, isLoading: profileLoading, updateProfile } = useUserProfile();
  const { toast } = useToast();
  const biometricAuth = useBiometricAuth();
  const keyboardShortcuts = useKeyboardShortcutsPanel();
  const prayerNotifications = usePrayerNotificationSettings();
  const [activeTab, setActiveTab] = useState<'general' | 'proactive' | 'team' | 'ai' | 'info'>('general');
  
  // Sync status bar color with theme
  useStatusBar(settings.theme);
  
  // Profile form state
  const [displayName, setDisplayName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Sync profile data to form
  useEffect(() => {
    if (profile) {
      setDisplayName(profile.displayName || '');
      setBirthDate(profile.birthDate || '');
    }
  }, [profile]);

  const handleSaveProfile = async () => {
    setIsSavingProfile(true);
    const result = await updateProfile({
      displayName: displayName.trim() || undefined,
      birthDate: birthDate || undefined,
    });
    setIsSavingProfile(false);
    
    if (result.success) {
      toast({ title: 'Profile saved', description: 'Your profile has been updated.' });
    } else {
      toast({ variant: 'destructive', title: 'Error', description: result.error || 'Failed to save profile' });
    }
  };

  const tabs = [
    { id: 'general' as const, label: 'General', icon: Settings },
    { id: 'proactive' as const, label: 'Proactive & Advanced', icon: Brain },
    { id: 'team' as const, label: t('settings.team'), icon: Users },
    { id: 'ai' as const, label: 'AI', icon: Bot },
    { id: 'info' as const, label: 'Info', icon: Info },
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
      <ScrollArea className="flex-1">
        <div className="p-6 space-y-6">
        {activeTab === 'general' && (
          <>
            {/* Profile Section */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Profile
              </h3>
              
              {profileLoading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Display Name */}
                  <div className="space-y-2">
                    <Label htmlFor="displayName">Display Name</Label>
                    <Input
                      id="displayName"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Enter your name"
                    />
                  </div>

                  {/* Email (read-only) */}
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      value={profile?.email || user?.email || ''}
                      disabled
                      className="bg-muted"
                    />
                    <p className="text-xs text-muted-foreground">
                      Email cannot be changed here
                    </p>
                  </div>

                  {/* Birth Date */}
                  <div className="space-y-2">
                    <Label htmlFor="birthDate">Birth Date</Label>
                    <Input
                      id="birthDate"
                      type="date"
                      value={birthDate}
                      onChange={(e) => setBirthDate(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Used for age-based health recommendations
                    </p>
                  </div>

                  {/* Save Button */}
                  <Button 
                    onClick={handleSaveProfile} 
                    disabled={isSavingProfile}
                    size="sm"
                  >
                    {isSavingProfile ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      'Save Profile'
                    )}
                  </Button>
                </div>
              )}
            </div>

            {/* Calendar Connections Section */}
            <div className="pt-4 border-t border-border">
              <CalendarConnectionsPanel />
            </div>

            {/* Appearance Section */}
            <div className="space-y-4 pt-4 border-t border-border">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                {t('settings.appearance')}
              </h3>
              
              {/* Theme Toggle */}
              <div className="space-y-3">
                <label className="text-sm font-medium">{t('settings.theme')}</label>
                <div className="grid grid-cols-3 gap-2">
                  <Button
                    variant={settings.theme === 'dark' ? 'secondary' : 'outline'}
                    className="gap-2"
                    onClick={() => onUpdateSettings({ theme: 'dark' })}
                  >
                    <Moon className="w-4 h-4" />
                    {t('settings.dark')}
                  </Button>
                  <Button
                    variant={settings.theme === 'light' ? 'secondary' : 'outline'}
                    className="gap-2"
                    onClick={() => onUpdateSettings({ theme: 'light' })}
                  >
                    <Sun className="w-4 h-4" />
                    {t('settings.light')}
                  </Button>
                  <Button
                    variant={settings.theme === 'colorful' ? 'secondary' : 'outline'}
                    className="gap-2"
                    onClick={() => onUpdateSettings({ theme: 'colorful' })}
                  >
                    <Sparkles className="w-4 h-4" />
                    Colorful
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

            {/* Islamic Settings Section */}
            <div className="space-y-4 pt-4 border-t border-border">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                <Moon className="w-4 h-4" />
                Islamic
              </h3>
              
              {/* Prayer Time Notifications */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-amber-500/10">
                    <Bell className="w-5 h-5 text-amber-500" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">Prayer Time Notifications</p>
                    <p className="text-xs text-muted-foreground">
                      Get notified before each salah
                    </p>
                  </div>
                </div>
                {prayerNotifications.notificationPermission !== 'granted' ? (
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={async () => {
                      const granted = await prayerNotifications.requestPermission();
                      if (granted) {
                        prayerNotifications.updateSettings({ enabled: true });
                        toast({ title: 'Prayer notifications enabled!' });
                      }
                    }}
                  >
                    Enable
                  </Button>
                ) : (
                  <Switch
                    checked={prayerNotifications.settings.enabled}
                    onCheckedChange={(checked) => prayerNotifications.updateSettings({ enabled: checked })}
                  />
                )}
              </div>

              {/* Adhan Audio */}
              {prayerNotifications.isEnabled && (
                <div className="flex items-center justify-between pl-11">
                  <div>
                    <p className="font-medium text-sm">Play Adhan</p>
                    <p className="text-xs text-muted-foreground">
                      Play call to prayer at salah time
                    </p>
                  </div>
                  <Switch
                    checked={prayerNotifications.settings.adhanEnabled}
                    onCheckedChange={(checked) => prayerNotifications.updateSettings({ adhanEnabled: checked })}
                  />
                </div>
              )}

              <p className="text-xs text-muted-foreground pl-11">
                Configure detailed prayer settings in the Islamic tab
              </p>
            </div>

            {/* Security Section */}
            <div className="space-y-4 pt-4 border-t border-border">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Security
              </h3>
              
              {/* Biometric Auth */}
              {biometricAuth.isAvailable && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Fingerprint className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{biometricAuth.getBiometryLabel()}</p>
                      <p className="text-xs text-muted-foreground">Require biometric to unlock app</p>
                    </div>
                  </div>
                  <Switch
                    checked={biometricAuth.isEnabled}
                    onCheckedChange={biometricAuth.setEnabled}
                  />
                </div>
              )}

              {/* Keyboard Shortcuts */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Keyboard className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">Keyboard Shortcuts</p>
                    <p className="text-xs text-muted-foreground">Press ? to see all shortcuts</p>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => keyboardShortcuts.setOpen(true)}>
                  View
                </Button>
              </div>
            </div>
            </div>

            {/* Defaults Section */}
            <div className="space-y-4 pt-4 border-t border-border">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                {t('settings.defaults')}
              </h3>
              
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

        {activeTab === 'info' && (
          <div className="space-y-6">
            {/* App Introduction */}
            <div className="space-y-2">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                Welcome to Flux
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Flux is your all-in-one personal productivity platform designed to help you manage every aspect of your life. 
                From tasks and calendar to family management, health tracking, and AI-powered assistance — everything you need 
                in one secure, private space.
              </p>
            </div>

            {/* Feature Categories */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Features & Capabilities
              </h4>
              
              <div className="grid gap-4">
                {APP_FEATURES.map((category) => (
                  <Card key={category.category} className="bg-muted/30">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <category.icon className="w-4 h-4 text-primary" />
                        {category.category}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <ul className="text-xs text-muted-foreground space-y-1">
                        {category.features.map((feature, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <span className="text-primary mt-1">•</span>
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            {/* Version & Credits */}
            <div className="pt-4 border-t border-border space-y-2">
              <p className="text-xs text-muted-foreground">
                <strong>Version:</strong> 1.0.0
              </p>
              <p className="text-xs text-muted-foreground">
                Built with React, Supabase, and AI-powered by OpenAI & Google Gemini.
              </p>
              <p className="text-xs text-muted-foreground">
                Your data is encrypted and stored securely. We never share your personal information.
              </p>
            </div>
          </div>
        )}
        </div>
      </ScrollArea>
      
      {/* Keyboard Shortcuts Dialog */}
      <KeyboardShortcutsPanel 
        open={keyboardShortcuts.open} 
        onOpenChange={keyboardShortcuts.setOpen} 
      />
    </div>
  );
}
