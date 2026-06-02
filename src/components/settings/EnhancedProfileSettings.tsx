import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useToast } from '@/hooks/use-toast';
import { X, Plus, MapPin, Target, Sparkles, User, Building, Brain, Calendar } from 'lucide-react';

interface EnhancedProfileSettingsProps {
  onClose?: () => void;
}

export function EnhancedProfileSettings({ onClose }: EnhancedProfileSettingsProps) {
  const { profile, isLoading, updateProfile } = useUserProfile();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  
  // Form state
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [role, setRole] = useState('');
  const [businesses, setBusinesses] = useState<string[]>([]);
  const [newBusiness, setNewBusiness] = useState('');
  const [interests, setInterests] = useState<string[]>([]);
  const [newInterest, setNewInterest] = useState('');
  const [skills, setSkills] = useState<string[]>([]);
  const [newSkill, setNewSkill] = useState('');
  const [goals, setGoals] = useState('');
  const [locationCity, setLocationCity] = useState('');
  const [locationCountry, setLocationCountry] = useState('');
  const [preferredWorkHours, setPreferredWorkHours] = useState('');
  const [timezone, setTimezone] = useState('');

  // Load profile data into form
  useEffect(() => {
    if (profile) {
      setDisplayName(profile.displayName || '');
      setBio(profile.bio || '');
      setBirthDate(profile.birthDate || '');
      setRole(profile.role || '');
      setBusinesses(profile.businesses || []);
      setInterests(profile.interests || []);
      setSkills(profile.skills || []);
      setGoals(profile.goals || '');
      setLocationCity(profile.locationCity || '');
      setLocationCountry(profile.locationCountry || '');
      setPreferredWorkHours(profile.preferredWorkHours || '');
      setTimezone(profile.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone);
    }
  }, [profile]);

  const handleAddItem = (
    value: string,
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    inputSetter: React.Dispatch<React.SetStateAction<string>>
  ) => {
    if (value.trim()) {
      setter(prev => [...prev, value.trim()]);
      inputSetter('');
    }
  };

  const handleRemoveItem = (
    index: number,
    setter: React.Dispatch<React.SetStateAction<string[]>>
  ) => {
    setter(prev => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const result = await updateProfile({
        displayName,
        bio,
        birthDate: birthDate || undefined,
        role,
        businesses,
        interests,
        skills,
        goals,
        locationCity,
        locationCountry,
        preferredWorkHours,
        timezone,
      });

      if (result.success) {
        toast({
          title: 'Profile updated',
          description: 'Your profile has been saved. The AI assistant now knows you better!',
        });
        onClose?.();
      } else {
        throw new Error(result.error);
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to save profile. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-2">
      {/* Header info */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="pt-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-primary/20">
              <Sparkles className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="font-medium text-sm">Help your AI assistant know you better</p>
              <p className="text-xs text-muted-foreground mt-1">
                This information helps DarAI give you personalized suggestions, recommend contacts when you travel, and understand your business context.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Basic Info */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <User className="w-4 h-4" />
            Basic Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="displayName">Display Name</Label>
              <Input
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="birthDate" className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                Birth Date
              </Label>
              <Input
                id="birthDate"
                type="date"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="role">Role / Title</Label>
              <Input
                id="role"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="e.g., Founder, CEO, Developer"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="bio">Bio</Label>
            <Textarea
              id="bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell DarAI about yourself - your background, what you do, what drives you..."
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* Businesses */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Building className="w-4 h-4" />
            Your Businesses / Ventures
          </CardTitle>
          <CardDescription>
            Add your companies, startups, or projects
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {businesses.map((business, index) => (
              <Badge key={index} variant="secondary" className="gap-1 pr-1">
                {business}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-4 w-4 hover:bg-transparent"
                  onClick={() => handleRemoveItem(index, setBusinesses)}
                >
                  <X className="w-3 h-3" />
                </Button>
              </Badge>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              value={newBusiness}
              onChange={(e) => setNewBusiness(e.target.value)}
              placeholder="e.g., Startup A - Crypto Exchange"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddItem(newBusiness, setBusinesses, setNewBusiness);
                }
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => handleAddItem(newBusiness, setBusinesses, setNewBusiness)}
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Interests & Skills */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Brain className="w-4 h-4" />
            Interests & Skills
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Interests / Focus Areas</Label>
            <div className="flex flex-wrap gap-2 mb-2">
              {interests.map((interest, index) => (
                <Badge key={index} variant="outline" className="gap-1 pr-1">
                  {interest}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-4 w-4 hover:bg-transparent"
                    onClick={() => handleRemoveItem(index, setInterests)}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={newInterest}
                onChange={(e) => setNewInterest(e.target.value)}
                placeholder="e.g., crypto, AI, real estate"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddItem(newInterest, setInterests, setNewInterest);
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => handleAddItem(newInterest, setInterests, setNewInterest)}
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label>Skills / Expertise</Label>
            <div className="flex flex-wrap gap-2 mb-2">
              {skills.map((skill, index) => (
                <Badge key={index} variant="secondary" className="gap-1 pr-1">
                  {skill}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-4 w-4 hover:bg-transparent"
                    onClick={() => handleRemoveItem(index, setSkills)}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={newSkill}
                onChange={(e) => setNewSkill(e.target.value)}
                placeholder="e.g., product management, fundraising"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddItem(newSkill, setSkills, setNewSkill);
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => handleAddItem(newSkill, setSkills, setNewSkill)}
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Goals */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="w-4 h-4" />
            Current Goals
          </CardTitle>
          <CardDescription>
            What are you currently working towards?
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={goals}
            onChange={(e) => setGoals(e.target.value)}
            placeholder="e.g., Raise Series A, launch MVP, expand to new markets..."
            rows={3}
          />
        </CardContent>
      </Card>

      {/* Location & Preferences */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <MapPin className="w-4 h-4" />
            Location & Preferences
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="locationCity">City</Label>
              <Input
                id="locationCity"
                value={locationCity}
                onChange={(e) => setLocationCity(e.target.value)}
                placeholder="e.g., Vienna"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="locationCountry">Country</Label>
              <Input
                id="locationCountry"
                value={locationCountry}
                onChange={(e) => setLocationCountry(e.target.value)}
                placeholder="e.g., Austria"
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="preferredWorkHours">Preferred Work Hours</Label>
              <Input
                id="preferredWorkHours"
                value={preferredWorkHours}
                onChange={(e) => setPreferredWorkHours(e.target.value)}
                placeholder="e.g., 9am-6pm"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="timezone">Timezone</Label>
              <Input
                id="timezone"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                placeholder="e.g., Europe/Vienna"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end gap-2 pt-4">
        {onClose && (
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
        )}
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? 'Saving...' : 'Save Profile'}
        </Button>
      </div>
    </div>
  );
}
