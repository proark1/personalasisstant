import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { 
  Sparkles, 
  CheckSquare, 
  Calendar, 
  Heart, 
  Home, 
  Briefcase,
  Bell,
  Mic,
  ChevronRight,
  ChevronLeft,
  Rocket
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import confetti from 'canvas-confetti';
import doriImage from '@/assets/dori-fish.png';

interface UseCase {
  id: string;
  label: string;
  description: string;
  icon: React.ElementType;
}

const USE_CASES: UseCase[] = [
  { id: 'work', label: 'Work & Productivity', description: 'Tasks, projects, deadlines', icon: Briefcase },
  { id: 'personal', label: 'Personal Life', description: 'Habits, goals, self-care', icon: CheckSquare },
  { id: 'family', label: 'Family Management', description: 'Kids, household, meals', icon: Home },
  { id: 'health', label: 'Health & Wellness', description: 'Fitness, sleep, nutrition', icon: Heart },
  { id: 'calendar', label: 'Calendar & Events', description: 'Appointments, meetings', icon: Calendar },
];

export default function Onboarding() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [selectedUseCases, setSelectedUseCases] = useState<string[]>([]);
  const [enableNotifications, setEnableNotifications] = useState(true);
  const [enableMorningBriefing, setEnableMorningBriefing] = useState(true);
  const [isCompleting, setIsCompleting] = useState(false);

  const totalSteps = 4;

  const toggleUseCase = (id: string) => {
    setSelectedUseCases(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleComplete = async () => {
    if (!user) return;
    
    setIsCompleting(true);
    
    try {
      // Save onboarding preferences
      const { error } = await supabase
        .from('profiles')
        .update({
          onboarding_completed: true,
          onboarding_preferences: {
            useCases: selectedUseCases,
            notifications: enableNotifications,
            morningBriefing: enableMorningBriefing,
            completedAt: new Date().toISOString(),
          },
        })
        .eq('id', user.id);

      if (error) throw error;

      // Request notification permission if enabled
      if (enableNotifications && 'Notification' in window) {
        await Notification.requestPermission();
      }

      // Celebration!
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
      });

      toast({ title: 'Welcome to DarAI!', description: "You're all set up." });
      
      setTimeout(() => navigate('/'), 1500);
    } catch (error) {
      console.error('Failed to complete onboarding:', error);
      toast({ 
        title: 'Error', 
        description: 'Failed to save preferences. Please try again.',
        variant: 'destructive',
      });
      setIsCompleting(false);
    }
  };

  const canProceed = () => {
    if (step === 1) return selectedUseCases.length > 0;
    return true;
  };

  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <div className="text-center space-y-6">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', duration: 0.6 }}
              className="w-24 h-24 mx-auto rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center"
            >
              <Sparkles className="w-12 h-12 text-primary" />
            </motion.div>
            
            <div className="space-y-2">
              <h1 className="text-3xl font-bold">Welcome to DarAI</h1>
              <p className="text-muted-foreground max-w-md mx-auto">
                Your AI-powered personal assistant for life management. Let's set things up in just a few steps.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-4 pt-4">
              {[
                { icon: CheckSquare, label: 'Tasks' },
                { icon: Calendar, label: 'Calendar' },
                { icon: Heart, label: 'Health' },
              ].map((item, i) => (
                <motion.div
                  key={item.label}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 + i * 0.1 }}
                  className="flex flex-col items-center gap-2 p-4 rounded-lg bg-muted/50"
                >
                  <item.icon className="w-6 h-6 text-primary" />
                  <span className="text-sm font-medium">{item.label}</span>
                </motion.div>
              ))}
            </div>
          </div>
        );

      case 1:
        return (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold">What will you use DarAI for?</h2>
              <p className="text-muted-foreground">Select all that apply. This helps personalize your experience.</p>
            </div>

            <div className="space-y-3">
              {USE_CASES.map((useCase) => (
                <motion.div
                  key={useCase.id}
                  whileTap={{ scale: 0.98 }}
                >
                  <Card 
                    className={`cursor-pointer transition-all ${
                      selectedUseCases.includes(useCase.id) 
                        ? 'border-primary bg-primary/5' 
                        : 'hover:bg-muted/50'
                    }`}
                    onClick={() => toggleUseCase(useCase.id)}
                  >
                    <CardContent className="flex items-center gap-4 p-4">
                      <div className={`p-2 rounded-lg ${
                        selectedUseCases.includes(useCase.id) 
                          ? 'bg-primary text-primary-foreground' 
                          : 'bg-muted'
                      }`}>
                        <useCase.icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">{useCase.label}</p>
                        <p className="text-sm text-muted-foreground">{useCase.description}</p>
                      </div>
                      <Checkbox 
                        checked={selectedUseCases.includes(useCase.id)}
                        onCheckedChange={() => toggleUseCase(useCase.id)}
                      />
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold">Stay Informed</h2>
              <p className="text-muted-foreground">Configure how DarAI keeps you updated.</p>
            </div>

            <div className="space-y-4">
              <Card>
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Bell className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">Push Notifications</p>
                      <p className="text-sm text-muted-foreground">Get reminders for tasks and events</p>
                    </div>
                  </div>
                  <Switch 
                    checked={enableNotifications} 
                    onCheckedChange={setEnableNotifications}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Sparkles className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">Morning Briefing</p>
                      <p className="text-sm text-muted-foreground">Daily AI summary of your schedule</p>
                    </div>
                  </div>
                  <Switch 
                    checked={enableMorningBriefing} 
                    onCheckedChange={setEnableMorningBriefing}
                  />
                </CardContent>
              </Card>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold">Meet Dori</h2>
              <p className="text-muted-foreground">Your AI assistant is ready to help.</p>
            </div>

            <motion.div 
              className="flex justify-center"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring' }}
            >
              <img 
                src={doriImage} 
                alt="Dori AI Assistant" 
                className="w-32 h-32 rounded-full object-cover shadow-xl"
              />
            </motion.div>

            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Mic className="w-5 h-5 text-primary" />
                  <p className="font-medium">Voice Commands</p>
                </div>
                <p className="text-sm text-muted-foreground">
                  Say things like:
                </p>
                <ul className="text-sm space-y-1 text-muted-foreground">
                  <li>"Add task: buy groceries tomorrow"</li>
                  <li>"What's on my calendar today?"</li>
                  <li>"Remind me to call Mom at 5pm"</li>
                </ul>
              </CardContent>
            </Card>

            <div className="text-center pt-4">
              <p className="text-sm text-muted-foreground">
                Tap the <span className="text-primary font-medium">Dori</span> icon anytime to chat or use voice commands.
              </p>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Progress indicator */}
      <div className="fixed top-0 left-0 right-0 z-50">
        <div className="h-1 bg-muted">
          <motion.div 
            className="h-full bg-primary"
            initial={{ width: 0 }}
            animate={{ width: `${((step + 1) / totalSteps) * 100}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              {renderStep()}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Navigation */}
      <div className="p-6 border-t border-border">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={() => setStep(s => s - 1)}
            disabled={step === 0}
            className="gap-2"
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </Button>

          <div className="flex gap-1.5">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div
                key={i}
                className={`w-2 h-2 rounded-full transition-colors ${
                  i === step ? 'bg-primary' : 'bg-muted'
                }`}
              />
            ))}
          </div>

          {step < totalSteps - 1 ? (
            <Button
              onClick={() => setStep(s => s + 1)}
              disabled={!canProceed()}
              className="gap-2"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </Button>
          ) : (
            <Button
              onClick={handleComplete}
              disabled={isCompleting}
              className="gap-2"
            >
              {isCompleting ? 'Setting up...' : "Let's Go!"}
              <Rocket className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
