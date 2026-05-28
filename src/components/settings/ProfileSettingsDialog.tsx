import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { UserSettings, ColorScheme, TaskCategory, TaskPriority, personalityConfigs } from '@/types/flux';
import { 
  X, 
  User, 
  Save, 
  Loader2, 
  Palette, 
  Bell, 
  ListTodo,
  Sun,
  Moon,
  Check,
  Brain,
  Briefcase,
  Users
} from 'lucide-react';
import { EnhancedProfileSettings } from './EnhancedProfileSettings';
import { SpaceMembersPanel } from './SpaceMembersPanel';

interface ProfileSettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  settings: UserSettings;
  onUpdateSettings: (updates: Partial<UserSettings>) => void;
  onUpdateNotifications: (updates: Partial<UserSettings['notifications']>) => void;
}

interface Profile {
  id: string;
  user_id: string;
  display_name: string | null;
  email: string | null;
  avatar_url: string | null;
}

const colorSchemes: { value: ColorScheme; label: string; color: string }[] = [
  { value: 'cyan', label: 'Electric Cyan', color: 'bg-cyan-500' },
  { value: 'purple', label: 'Violet', color: 'bg-purple-500' },
  { value: 'green', label: 'Emerald', color: 'bg-green-500' },
  { value: 'orange', label: 'Sunset', color: 'bg-orange-500' },
  { value: 'pink', label: 'Rose', color: 'bg-pink-500' },
];

export function ProfileSettingsDialog({ 
  isOpen, 
  onClose, 
  settings, 
  onUpdateSettings, 
  onUpdateNotifications 
}: ProfileSettingsDialogProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'profile' | 'aiprofile' | 'appearance' | 'notifications' | 'defaults' | 'assistant' | 'team'>('profile');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadProfile();
    }
  }, [isOpen]);

  const loadProfile = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error) throw error;

      setProfile(data);
      setDisplayName(data.display_name || '');
      setEmail(data.email || '');
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!profile) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          display_name: displayName.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', profile.id);

      if (error) throw error;

      toast({
        title: 'Profile Updated',
        description: 'Your profile has been saved.',
      });
    } catch (error) {
      console.error('Error saving profile:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to save profile',
      });
    } finally {
      setSaving(false);
    }
  };

  const tabs = [
    { id: 'profile' as const, label: 'Profile', icon: User },
    { id: 'aiprofile' as const, label: 'AI Profile', icon: Briefcase },
    { id: 'team' as const, label: 'Team', icon: Users },
    { id: 'appearance' as const, label: 'Appearance', icon: Palette },
    { id: 'assistant' as const, label: 'Assistant', icon: Brain },
    { id: 'notifications' as const, label: 'Notifications', icon: Bell },
    { id: 'defaults' as const, label: 'Defaults', icon: ListTodo },
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="glass-panel-solid w-full max-w-lg animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <User className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold">Profile & Settings</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-3 text-sm transition-colors whitespace-nowrap px-2",
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
          {activeTab === 'aiprofile' && (
            <EnhancedProfileSettings />
          )}

          {activeTab === 'team' && profile && (
            <SpaceMembersPanel userId={profile.user_id} />
          )}

          {activeTab === 'profile' && (
            <>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : (
                <>
                  {/* Avatar */}
                  <div className="flex flex-col items-center gap-4">
                    <Avatar className="w-20 h-20">
                      <AvatarImage src={profile?.avatar_url || undefined} />
                      <AvatarFallback className="text-2xl bg-primary/20 text-primary">
                        {displayName?.charAt(0)?.toUpperCase() || email?.charAt(0)?.toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                  </div>

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
                      value={email}
                      disabled
                      className="bg-muted"
                    />
                    <p className="text-xs text-muted-foreground">
                      Email cannot be changed here
                    </p>
                  </div>

                  {/* Save Button */}
                  <Button 
                    onClick={handleSaveProfile} 
                    disabled={saving}
                    className="w-full"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        Save Profile
                      </>
                    )}
                  </Button>
                </>
              )}
            </>
          )}

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

          {activeTab === 'assistant' && (
            <div className="space-y-3">
              <label className="text-sm font-medium">Assistant Personality</label>
              <p className="text-xs text-muted-foreground">
                Choose how your AI assistant communicates with you
              </p>
              <div className="space-y-2">
                {personalityConfigs.map((personality) => (
                  <button
                    key={personality.id}
                    onClick={() => onUpdateSettings({ assistantPersonality: personality.id })}
                    className={cn(
                      "w-full p-3 rounded-lg border text-left transition-colors",
                      settings.assistantPersonality === personality.id
                        ? "border-primary bg-primary/10"
                        : "border-border hover:bg-muted"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{personality.name}</span>
                      {settings.assistantPersonality === personality.id && (
                        <Check className="w-4 h-4 text-primary" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {personality.description}
                    </p>
                  </button>
                ))}
              </div>
            </div>
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

              {/* ADHD Mode */}
              <div className="flex items-center justify-between pt-2 border-t border-border">
                <div>
                  <p className="font-medium text-sm">ADHD Focus Mode</p>
                  <p className="text-xs text-muted-foreground">
                    Multiple gentle reminders (15min, 5min, now) + nagging for overdue tasks
                  </p>
                </div>
                <Switch
                  checked={settings.notifications.adhdMode}
                  onCheckedChange={(checked) => onUpdateNotifications({ adhdMode: checked })}
                />
              </div>

              {/* Contact Reminders */}
              <div className="flex items-center justify-between pt-2 border-t border-border">
                <div>
                  <p className="font-medium text-sm">Contact Reminders</p>
                  <p className="text-xs text-muted-foreground">
                    Auto-create tasks when it's time to reach out to contacts
                  </p>
                </div>
                <Switch
                  checked={settings.notifications.contactReminders}
                  onCheckedChange={(checked) => onUpdateNotifications({ contactReminders: checked })}
                />
              </div>

              {/* Contract Reminders */}
              <div className="flex items-center justify-between pt-2 border-t border-border">
                <div>
                  <p className="font-medium text-sm">Contract Reminders</p>
                  <p className="text-xs text-muted-foreground">
                    Auto-create tasks for contract renewals and cancellation deadlines
                  </p>
                </div>
                <Switch
                  checked={settings.notifications.contractReminders}
                  onCheckedChange={(checked) => onUpdateNotifications({ contractReminders: checked })}
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
