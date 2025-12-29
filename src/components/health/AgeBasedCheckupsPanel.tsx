import { useState, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useUserProfile } from '@/hooks/useUserProfile';
import {
  Calendar,
  CheckCircle2,
  Clock,
  Plus,
  AlertTriangle,
  Stethoscope,
  Eye,
  HeartPulse,
  Bone,
  Baby,
  User,
  UserRound,
} from 'lucide-react';
import { differenceInYears, format, addMonths } from 'date-fns';

interface Checkup {
  id: string;
  name: string;
  description: string;
  frequency: string; // 'yearly', 'every 2 years', 'every 5 years', 'once', 'monthly'
  minAge: number;
  maxAge?: number;
  gender?: 'male' | 'female' | 'all';
  icon: typeof Stethoscope;
  category: string;
  priority: 'high' | 'medium' | 'low';
}

const standardCheckups: Checkup[] = [
  // All ages
  { id: 'dental', name: 'Dental Checkup', description: 'Regular dental examination and cleaning', frequency: 'every 6 months', minAge: 3, icon: Stethoscope, category: 'General', priority: 'medium' },
  { id: 'eye', name: 'Eye Examination', description: 'Vision test and eye health check', frequency: 'yearly', minAge: 6, icon: Eye, category: 'General', priority: 'medium' },
  
  // Children (0-12)
  { id: 'pediatric', name: 'Pediatric Wellness Visit', description: 'Growth, development, and immunization check', frequency: 'yearly', minAge: 0, maxAge: 18, icon: Baby, category: 'Pediatric', priority: 'high' },
  { id: 'vaccines-child', name: 'Childhood Vaccinations', description: 'Standard childhood immunization schedule', frequency: 'as scheduled', minAge: 0, maxAge: 6, icon: Baby, category: 'Pediatric', priority: 'high' },
  
  // Teens (13-19)
  { id: 'hpv', name: 'HPV Vaccination', description: 'HPV vaccine series', frequency: 'once', minAge: 11, maxAge: 26, icon: Stethoscope, category: 'Vaccinations', priority: 'high' },
  
  // Adults (20-39)
  { id: 'physical', name: 'Annual Physical Exam', description: 'Complete health assessment with blood work', frequency: 'yearly', minAge: 18, icon: Stethoscope, category: 'General', priority: 'high' },
  { id: 'skin', name: 'Skin Cancer Screening', description: 'Full body skin examination', frequency: 'yearly', minAge: 20, icon: User, category: 'Cancer Screening', priority: 'medium' },
  { id: 'std', name: 'STI Screening', description: 'Sexually transmitted infection tests', frequency: 'yearly', minAge: 18, maxAge: 65, icon: Stethoscope, category: 'General', priority: 'medium' },
  
  // Cardiovascular - Young Adults (20-39)
  { id: 'cholesterol-young', name: 'Cholesterol Screening', description: 'Lipid panel blood test for baseline levels', frequency: 'every 5 years', minAge: 20, maxAge: 39, icon: HeartPulse, category: 'Cardiovascular', priority: 'medium' },
  { id: 'bp-young', name: 'Blood Pressure Check', description: 'Regular blood pressure monitoring', frequency: 'yearly', minAge: 18, maxAge: 39, icon: HeartPulse, category: 'Cardiovascular', priority: 'high' },
  { id: 'heart-baseline', name: 'Baseline ECG', description: 'Electrocardiogram for baseline heart rhythm assessment', frequency: 'once', minAge: 20, maxAge: 35, icon: HeartPulse, category: 'Cardiovascular', priority: 'low' },
  
  // Cardiovascular - Middle Age (40-64)
  { id: 'cholesterol-mid', name: 'Cholesterol Screening', description: 'Lipid panel including LDL, HDL, and triglycerides', frequency: 'yearly', minAge: 40, maxAge: 64, icon: HeartPulse, category: 'Cardiovascular', priority: 'high' },
  { id: 'bp-mid', name: 'Blood Pressure Monitoring', description: 'Regular BP checks for hypertension risk', frequency: 'every 6 months', minAge: 40, maxAge: 64, icon: HeartPulse, category: 'Cardiovascular', priority: 'high' },
  { id: 'cardiac-stress', name: 'Cardiac Stress Test', description: 'Exercise stress test for heart function assessment', frequency: 'every 3 years', minAge: 45, icon: HeartPulse, category: 'Cardiovascular', priority: 'medium' },
  { id: 'cac-score', name: 'Coronary Calcium Score', description: 'CT scan to measure calcium in coronary arteries', frequency: 'every 5 years', minAge: 40, icon: HeartPulse, category: 'Cardiovascular', priority: 'medium' },
  { id: 'ecg-mid', name: 'ECG/EKG', description: 'Electrocardiogram for heart rhythm check', frequency: 'yearly', minAge: 50, icon: HeartPulse, category: 'Cardiovascular', priority: 'medium' },
  { id: 'crp-test', name: 'CRP Test', description: 'C-reactive protein test for inflammation and heart risk', frequency: 'yearly', minAge: 40, icon: HeartPulse, category: 'Cardiovascular', priority: 'medium' },
  
  // Cardiovascular - Seniors (65+)
  { id: 'cholesterol-senior', name: 'Lipid Panel', description: 'Complete cholesterol and lipid screening', frequency: 'yearly', minAge: 65, icon: HeartPulse, category: 'Cardiovascular', priority: 'high' },
  { id: 'bp-senior', name: 'Blood Pressure Check', description: 'Frequent BP monitoring for heart health', frequency: 'every 3 months', minAge: 65, icon: HeartPulse, category: 'Cardiovascular', priority: 'high' },
  { id: 'echo', name: 'Echocardiogram', description: 'Ultrasound of heart for valve and function assessment', frequency: 'every 2 years', minAge: 65, icon: HeartPulse, category: 'Cardiovascular', priority: 'high' },
  { id: 'carotid-ultrasound', name: 'Carotid Ultrasound', description: 'Check for plaque in neck arteries supplying brain', frequency: 'every 2 years', minAge: 65, icon: HeartPulse, category: 'Cardiovascular', priority: 'high' },
  { id: 'ankle-brachial', name: 'Ankle-Brachial Index', description: 'Test for peripheral artery disease', frequency: 'every 2 years', minAge: 65, icon: HeartPulse, category: 'Cardiovascular', priority: 'medium' },
  { id: 'holter-monitor', name: 'Holter Monitor', description: '24-48 hour heart rhythm monitoring', frequency: 'as needed', minAge: 60, icon: HeartPulse, category: 'Cardiovascular', priority: 'medium' },
  
  // Cardiovascular - Gender Specific
  { id: 'heart-women-early', name: 'Cardiovascular Risk Assessment', description: 'Women\'s heart health screening including hormone impact', frequency: 'yearly', minAge: 40, gender: 'female', icon: HeartPulse, category: 'Cardiovascular', priority: 'high' },
  { id: 'heart-postmenopause', name: 'Post-Menopause Heart Check', description: 'Comprehensive heart screening after menopause', frequency: 'yearly', minAge: 55, gender: 'female', icon: HeartPulse, category: 'Cardiovascular', priority: 'high' },
  { id: 'heart-men-early', name: 'Early Heart Disease Screening', description: 'Men\'s comprehensive cardiovascular assessment', frequency: 'yearly', minAge: 35, gender: 'male', icon: HeartPulse, category: 'Cardiovascular', priority: 'high' },
  
  // Women specific
  { id: 'pap', name: 'Pap Smear', description: 'Cervical cancer screening', frequency: 'every 3 years', minAge: 21, maxAge: 65, gender: 'female', icon: UserRound, category: 'Women\'s Health', priority: 'high' },
  { id: 'mammogram', name: 'Mammogram', description: 'Breast cancer screening', frequency: 'yearly', minAge: 40, gender: 'female', icon: UserRound, category: 'Women\'s Health', priority: 'high' },
  { id: 'breast', name: 'Clinical Breast Exam', description: 'Physical breast examination', frequency: 'yearly', minAge: 25, gender: 'female', icon: UserRound, category: 'Women\'s Health', priority: 'medium' },
  { id: 'bone-women', name: 'Bone Density Scan', description: 'DEXA scan for osteoporosis', frequency: 'every 2 years', minAge: 65, gender: 'female', icon: Bone, category: 'Women\'s Health', priority: 'high' },
  
  // Men specific
  { id: 'prostate', name: 'Prostate Screening', description: 'PSA test and digital exam', frequency: 'yearly', minAge: 50, gender: 'male', icon: User, category: 'Men\'s Health', priority: 'high' },
  { id: 'testicular', name: 'Testicular Exam', description: 'Testicular cancer screening', frequency: 'yearly', minAge: 15, maxAge: 35, gender: 'male', icon: User, category: 'Men\'s Health', priority: 'medium' },
  { id: 'aaa', name: 'AAA Screening', description: 'Abdominal aortic aneurysm ultrasound', frequency: 'once', minAge: 65, maxAge: 75, gender: 'male', icon: HeartPulse, category: 'Men\'s Health', priority: 'high' },
  
  // Middle age (40-64)
  { id: 'diabetes', name: 'Diabetes Screening', description: 'Fasting blood glucose or A1C test', frequency: 'every 3 years', minAge: 45, icon: Stethoscope, category: 'General', priority: 'high' },
  { id: 'colonoscopy', name: 'Colonoscopy', description: 'Colorectal cancer screening', frequency: 'every 10 years', minAge: 45, icon: Stethoscope, category: 'Cancer Screening', priority: 'high' },
  
  // Seniors (65+)
  { id: 'flu', name: 'Flu Vaccine', description: 'Annual influenza vaccination', frequency: 'yearly', minAge: 65, icon: Stethoscope, category: 'Vaccinations', priority: 'high' },
  { id: 'pneumonia', name: 'Pneumonia Vaccine', description: 'Pneumococcal vaccination', frequency: 'once', minAge: 65, icon: Stethoscope, category: 'Vaccinations', priority: 'high' },
  { id: 'shingles', name: 'Shingles Vaccine', description: 'Herpes zoster vaccination', frequency: 'once', minAge: 50, icon: Stethoscope, category: 'Vaccinations', priority: 'medium' },
  { id: 'hearing', name: 'Hearing Test', description: 'Audiometry evaluation', frequency: 'every 3 years', minAge: 60, icon: User, category: 'General', priority: 'medium' },
  { id: 'bone-senior', name: 'Bone Density Scan', description: 'DEXA scan for osteoporosis', frequency: 'every 2 years', minAge: 70, gender: 'male', icon: Bone, category: 'General', priority: 'medium' },
];

export function AgeBasedCheckupsPanel() {
  const { user } = useAuth();
  const { profile, updateProfile } = useUserProfile();
  const [birthDate, setBirthDate] = useState<string>('');
  const [gender, setGender] = useState<'male' | 'female' | 'all'>('all');
  const [addingCheckup, setAddingCheckup] = useState<string | null>(null);

  // Load birth date from profile
  useEffect(() => {
    if (profile?.birthDate && !birthDate) {
      setBirthDate(profile.birthDate);
    }
  }, [profile?.birthDate]);

  // Save birth date to profile when changed
  const handleBirthDateChange = async (newDate: string) => {
    setBirthDate(newDate);
    if (newDate && user) {
      await updateProfile({ birthDate: newDate });
    }
  };

  const age = useMemo(() => {
    if (!birthDate) return null;
    return differenceInYears(new Date(), new Date(birthDate));
  }, [birthDate]);

  const recommendedCheckups = useMemo(() => {
    if (age === null) return [];
    
    return standardCheckups.filter(checkup => {
      // Check age range
      if (age < checkup.minAge) return false;
      if (checkup.maxAge && age > checkup.maxAge) return false;
      
      // Check gender
      if (checkup.gender && checkup.gender !== 'all' && checkup.gender !== gender && gender !== 'all') return false;
      
      return true;
    }).sort((a, b) => {
      // Sort by priority
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }, [age, gender]);

  const groupedCheckups = useMemo(() => {
    const groups: Record<string, Checkup[]> = {};
    recommendedCheckups.forEach(checkup => {
      if (!groups[checkup.category]) {
        groups[checkup.category] = [];
      }
      groups[checkup.category].push(checkup);
    });
    return groups;
  }, [recommendedCheckups]);

  const addToCalendar = async (checkup: Checkup) => {
    if (!user) {
      toast.error('Please sign in to add events');
      return;
    }

    setAddingCheckup(checkup.id);
    
    try {
      // Add as calendar event (schedule for next month)
      const eventDate = addMonths(new Date(), 1);
      const startTime = new Date(eventDate);
      startTime.setHours(9, 0, 0, 0);
      const endTime = new Date(eventDate);
      endTime.setHours(10, 0, 0, 0);

      const { error } = await supabase.from('events').insert({
        user_id: user.id,
        title: checkup.name,
        description: checkup.description,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        category: 'personal',
      });

      if (error) throw error;
      toast.success(`${checkup.name} added to calendar for ${format(eventDate, 'MMM d, yyyy')}`);
    } catch (error) {
      console.error('Error adding to calendar:', error);
      toast.error('Failed to add to calendar');
    } finally {
      setAddingCheckup(null);
    }
  };

  const addAsTask = async (checkup: Checkup) => {
    if (!user) {
      toast.error('Please sign in to add tasks');
      return;
    }

    setAddingCheckup(checkup.id);
    
    try {
      const { error } = await supabase.from('tasks').insert({
        user_id: user.id,
        title: `Schedule ${checkup.name}`,
        description: checkup.description,
        category: 'personal',
        priority: checkup.priority === 'high' ? 'high' : 'medium',
        completed: false,
      });

      if (error) throw error;
      toast.success(`Task created: Schedule ${checkup.name}`);
    } catch (error) {
      console.error('Error adding task:', error);
      toast.error('Failed to add task');
    } finally {
      setAddingCheckup(null);
    }
  };

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-4 pb-20">
        {/* Age Input */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <User className="w-4 h-4 text-primary" />
              Your Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label htmlFor="birthDate" className="text-xs">Date of Birth</Label>
              <Input
                id="birthDate"
                type="date"
                value={birthDate}
                onChange={(e) => handleBirthDateChange(e.target.value)}
                className="mt-1"
              />
              {profile?.birthDate && (
                <p className="text-xs text-muted-foreground mt-1">Saved to your profile</p>
              )}
            </div>
            <div>
              <Label className="text-xs">Gender (for screening recommendations)</Label>
              <div className="flex gap-2 mt-1">
                <Button
                  variant={gender === 'male' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setGender('male')}
                  className="flex-1"
                >
                  Male
                </Button>
                <Button
                  variant={gender === 'female' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setGender('female')}
                  className="flex-1"
                >
                  Female
                </Button>
              </div>
            </div>
            {age !== null && (
              <p className="text-sm text-muted-foreground">
                Age: <span className="font-medium text-foreground">{age} years old</span>
              </p>
            )}
          </CardContent>
        </Card>

        {/* Recommendations */}
        {age === null ? (
          <Card className="border-dashed">
            <CardContent className="p-6 text-center">
              <Stethoscope className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
              <h3 className="font-medium mb-1">Enter Your Birth Date</h3>
              <p className="text-sm text-muted-foreground">
                Get personalized health screening recommendations based on your age
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Recommended Checkups</h2>
              <Badge variant="outline">{recommendedCheckups.length} screenings</Badge>
            </div>

            {Object.entries(groupedCheckups).map(([category, checkups]) => (
              <div key={category} className="space-y-2">
                <h3 className="text-sm font-medium text-muted-foreground">{category}</h3>
                {checkups.map((checkup) => (
                  <Card key={checkup.id}>
                    <CardContent className="p-3">
                      <div className="flex items-start gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                          checkup.priority === 'high' 
                            ? 'bg-destructive/10 text-destructive'
                            : checkup.priority === 'medium'
                            ? 'bg-warning/10 text-warning'
                            : 'bg-muted text-muted-foreground'
                        }`}>
                          <checkup.icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium text-sm">{checkup.name}</h4>
                            {checkup.priority === 'high' && (
                              <AlertTriangle className="w-3 h-3 text-destructive" />
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-1">
                            {checkup.description}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="secondary" className="text-[10px] py-0">
                              <Clock className="w-2.5 h-2.5 mr-1" />
                              {checkup.frequency}
                            </Badge>
                          </div>
                        </div>
                        <div className="flex flex-col gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={() => addToCalendar(checkup)}
                            disabled={addingCheckup === checkup.id}
                          >
                            <Calendar className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={() => addAsTask(checkup)}
                            disabled={addingCheckup === checkup.id}
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ))}

            {recommendedCheckups.length === 0 && (
              <Card className="border-dashed">
                <CardContent className="p-6 text-center">
                  <CheckCircle2 className="w-10 h-10 mx-auto text-green-500 mb-3" />
                  <h3 className="font-medium mb-1">No Checkups Found</h3>
                  <p className="text-sm text-muted-foreground">
                    No standard screenings match your current criteria
                  </p>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </ScrollArea>
  );
}
