import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
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
  Rocket,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import confetti from "canvas-confetti";
import doriImage from "@/assets/dori-fish.png";

interface UseCase {
  id: string;
  label: string;
  description: string;
  icon: React.ElementType;
}

const USE_CASES: UseCase[] = [
  {
    id: "work",
    label: "Work & Productivity",
    description: "Tasks, projects, deadlines",
    icon: Briefcase,
  },
  {
    id: "personal",
    label: "Personal Life",
    description: "Habits, goals, self-care",
    icon: CheckSquare,
  },
  { id: "family", label: "Family Management", description: "Kids, household, meals", icon: Home },
  {
    id: "health",
    label: "Health & Wellness",
    description: "Fitness, sleep, nutrition",
    icon: Heart,
  },
  {
    id: "calendar",
    label: "Calendar & Events",
    description: "Appointments, meetings",
    icon: Calendar,
  },
];

export default function Onboarding() {
  const navigate = useNavigate();
  const { user, refreshProfile } = useAuth();
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [selectedUseCases, setSelectedUseCases] = useState<string[]>([]);
  const [enableNotifications, setEnableNotifications] = useState(true);
  const [enableMorningBriefing, setEnableMorningBriefing] = useState(true);
  const [isCompleting, setIsCompleting] = useState(false);

  const totalSteps = 4;

  // First-value seeding: based on the use-cases a new user picks, drop a few
  // real, actionable starter tasks into their plan so the dashboard isn't empty
  // when they arrive. Best-effort — failures never block onboarding.
  const STARTER_TASKS: Record<
    string,
    {
      title: string;
      category: "business" | "personal" | "family";
      priority: "high" | "medium" | "low";
    }[]
  > = {
    work: [
      { title: "Plan my top 3 priorities for this week", category: "business", priority: "high" },
    ],
    personal: [
      { title: "Set one personal goal for this month", category: "personal", priority: "medium" },
    ],
    family: [
      {
        title: "Add an upcoming family event to the calendar",
        category: "family",
        priority: "medium",
      },
    ],
    health: [
      { title: "Schedule a 20-minute walk today", category: "personal", priority: "medium" },
    ],
    calendar: [
      { title: "Connect Google Calendar from Settings", category: "personal", priority: "medium" },
    ],
  };

  const seedStarterTasks = async () => {
    if (!user) return;
    // Don't clutter the plan of anyone who already has tasks (e.g. existing
    // users passing back through onboarding) — only seed for a truly empty plan.
    const { count } = await supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id);
    if (count && count > 0) return;

    const seen = new Set<string>();
    const rows = [
      // A universal first task that teaches the core interaction.
      {
        user_id: user.id,
        title: "Tap the circle to mark this task done ✅",
        category: "personal",
        priority: "low",
        completed: false,
        status: "backlog",
        sort_order: 0,
      },
    ];
    let order = 1;
    for (const useCase of selectedUseCases) {
      for (const t of STARTER_TASKS[useCase] ?? []) {
        if (seen.has(t.title)) continue;
        seen.add(t.title);
        rows.push({
          user_id: user.id,
          title: t.title,
          category: t.category,
          priority: t.priority,
          completed: false,
          status: "backlog",
          sort_order: order++,
        });
      }
    }
    try {
      await supabase.from("tasks").insert(rows as never);
    } catch (err) {
      console.error("Failed to seed starter tasks:", err);
    }
  };

  const toggleUseCase = (id: string) => {
    setSelectedUseCases((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const handleComplete = async () => {
    if (!user) return;

    setIsCompleting(true);

    try {
      // Match on user_id — that's how the rest of the app (AuthContext) reads
      // the profile row. Using `id` here previously updated the wrong row, so
      // onboarding_completed never persisted and the wizard could re-trigger.
      const { error } = await supabase
        .from("profiles")
        .update({
          onboarding_completed: true,
          onboarding_preferences: {
            useCases: selectedUseCases,
            notifications: enableNotifications,
            morningBriefing: enableMorningBriefing,
            completedAt: new Date().toISOString(),
          },
        })
        .eq("user_id", user.id);

      if (error) throw error;

      // Seed a starter plan so the dashboard has real content on first arrival.
      await seedStarterTasks();

      // Refresh the cached profile so the route guard sees onboarding as done
      // and lets the user into the app instead of bouncing back here.
      await refreshProfile();

      if (enableNotifications && "Notification" in window) {
        await Notification.requestPermission();
      }

      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
      });

      toast({ title: "Welcome to DarAI!", description: "You're all set up." });

      setTimeout(() => navigate("/"), 1500);
    } catch (error) {
      console.error("Failed to complete onboarding:", error);
      toast({
        title: "Error",
        description: "Failed to save preferences. Please try again.",
        variant: "destructive",
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
              transition={{ type: "spring", duration: 0.6 }}
              className="w-24 h-24 mx-auto rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center"
            >
              <Sparkles className="w-12 h-12 text-primary" />
            </motion.div>

            <div className="space-y-2">
              <h1 className="text-3xl font-bold text-foreground">Welcome to DarAI</h1>
              <p className="text-muted-foreground max-w-md mx-auto">
                Your AI-powered personal assistant for life management. Let's set things up in just
                a few steps.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-4 pt-4">
              {[
                { icon: CheckSquare, label: "Tasks" },
                { icon: Calendar, label: "Calendar" },
                { icon: Heart, label: "Health" },
              ].map((item, i) => (
                <motion.div
                  key={item.label}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 + i * 0.1 }}
                  className="flex flex-col items-center gap-2 p-4 rounded-xl glass-card"
                >
                  <item.icon className="w-6 h-6 text-primary" />
                  <span className="text-sm font-medium text-foreground">{item.label}</span>
                </motion.div>
              ))}
            </div>
          </div>
        );

      case 1:
        return (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold text-foreground">What will you use DarAI for?</h2>
              <p className="text-muted-foreground">
                Select all that apply. This helps personalize your experience.
              </p>
            </div>

            <div className="space-y-3">
              {USE_CASES.map((useCase, i) => (
                <motion.div
                  key={useCase.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <div
                    className={`cursor-pointer transition-all rounded-xl glass-card p-4 flex items-center gap-4 ${
                      selectedUseCases.includes(useCase.id)
                        ? "border-primary bg-primary/5 shadow-[0_0_0_1px_hsl(var(--primary)/0.3)]"
                        : "hover:bg-muted/50"
                    }`}
                    onClick={() => toggleUseCase(useCase.id)}
                  >
                    <div
                      className={`p-2 rounded-lg ${
                        selectedUseCases.includes(useCase.id)
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      }`}
                    >
                      <useCase.icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-foreground">{useCase.label}</p>
                      <p className="text-sm text-muted-foreground">{useCase.description}</p>
                    </div>
                    <Checkbox
                      checked={selectedUseCases.includes(useCase.id)}
                      onCheckedChange={() => toggleUseCase(useCase.id)}
                    />
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold text-foreground">Stay Informed</h2>
              <p className="text-muted-foreground">Configure how DarAI keeps you updated.</p>
            </div>

            <div className="space-y-4">
              <div className="glass-card rounded-xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Bell className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Push Notifications</p>
                    <p className="text-sm text-muted-foreground">
                      Get reminders for tasks and events
                    </p>
                  </div>
                </div>
                <Switch checked={enableNotifications} onCheckedChange={setEnableNotifications} />
              </div>

              <div className="glass-card rounded-xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Sparkles className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Morning Briefing</p>
                    <p className="text-sm text-muted-foreground">
                      Daily AI summary of your schedule
                    </p>
                  </div>
                </div>
                <Switch
                  checked={enableMorningBriefing}
                  onCheckedChange={setEnableMorningBriefing}
                />
              </div>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold text-foreground">Meet Dori</h2>
              <p className="text-muted-foreground">Your AI assistant is ready to help.</p>
            </div>

            <motion.div
              className="flex justify-center"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring" }}
            >
              <img
                src={doriImage}
                alt="Dori AI Assistant"
                className="w-32 h-32 rounded-full object-cover shadow-xl"
              />
            </motion.div>

            <div className="glass-card rounded-xl p-4 space-y-3 border-primary/20">
              <div className="flex items-center gap-2">
                <Mic className="w-5 h-5 text-primary" />
                <p className="font-medium text-foreground">Voice Commands</p>
              </div>
              <p className="text-sm text-muted-foreground">Say things like:</p>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>"Add task: buy groceries tomorrow"</li>
                <li>"What's on my calendar today?"</li>
                <li>"Remind me to call Mom at 5pm"</li>
              </ul>
            </div>

            <div className="text-center pt-4">
              <p className="text-sm text-muted-foreground">
                Tap the <span className="text-primary font-medium">Dori</span> icon anytime to chat
                or use voice commands.
              </p>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col relative overflow-hidden">
      {/* Floating orbs */}
      <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-primary/5 rounded-full blur-3xl animate-pulse pointer-events-none" />
      <div
        className="absolute bottom-1/3 right-1/4 w-48 h-48 bg-primary/8 rounded-full blur-3xl animate-pulse pointer-events-none"
        style={{ animationDelay: "1s" }}
      />

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
      <div className="flex-1 flex items-center justify-center p-6 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md glass-card rounded-2xl p-6"
        >
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
        </motion.div>
      </div>

      {/* Navigation */}
      <div className="p-6 border-t border-border relative z-10">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={() => setStep((s) => s - 1)}
            disabled={step === 0}
            className="gap-2"
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </Button>

          <div className="flex gap-1.5">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <motion.div
                key={i}
                className={`w-2 h-2 rounded-full transition-colors ${
                  i === step ? "bg-primary" : "bg-muted"
                }`}
                animate={{ scale: i === step ? 1.2 : 1 }}
                transition={{ type: "spring", stiffness: 500 }}
              />
            ))}
          </div>

          {step < totalSteps - 1 ? (
            <Button
              onClick={() => setStep((s) => s + 1)}
              disabled={!canProceed()}
              className="gap-2"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </Button>
          ) : (
            <Button onClick={handleComplete} disabled={isCompleting} className="gap-2">
              {isCompleting ? "Setting up..." : "Let's Go!"}
              <Rocket className="w-4 h-4" />
            </Button>
          )}
        </div>
        {step < totalSteps - 1 && (
          <button
            type="button"
            onClick={handleComplete}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors mt-3 mx-auto block"
          >
            Skip for now
          </button>
        )}
      </div>
    </div>
  );
}
