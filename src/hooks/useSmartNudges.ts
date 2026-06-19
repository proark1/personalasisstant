import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Task, CalendarEvent } from "@/types/flux";
import { trackProactiveOutcome, type ProactiveOutcome } from "@/lib/telemetry";

export type NudgeType =
  | "time_blindness"
  | "break_reminder"
  | "transition"
  | "hydration"
  | "task_start"
  | "stuck_detection"
  | "pattern_insight"
  | "wellness_alert";

export interface Nudge {
  id: string;
  type: NudgeType;
  title: string;
  message: string;
  /** Plain-language explanation surfaced behind "Why am I seeing this?". */
  reason?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  dismissable?: boolean;
  priority: "low" | "medium" | "high";
  icon?: string;
}

const MUTED_TYPES_KEY = "dori.mutedNudgeTypes";

function readMutedTypes(): Set<NudgeType> {
  try {
    const raw = localStorage.getItem(MUTED_TYPES_KEY);
    return new Set(raw ? (JSON.parse(raw) as NudgeType[]) : []);
  } catch {
    return new Set();
  }
}

interface NudgeSettings {
  timeBlindnessEnabled: boolean;
  breakRemindersEnabled: boolean;
  transitionWarningsEnabled: boolean;
  hydrationRemindersEnabled: boolean;
  stuckDetectionEnabled: boolean;
  patternNudgesEnabled: boolean;
  breakIntervalMinutes: number;
  hydrationIntervalMinutes: number;
}

interface UserPattern {
  id: string;
  pattern_type: string;
  category: string;
  title: string;
  description: string;
  confidence_score: number;
  variables: string[];
}

const DEFAULT_SETTINGS: NudgeSettings = {
  timeBlindnessEnabled: true,
  breakRemindersEnabled: true,
  transitionWarningsEnabled: true,
  hydrationRemindersEnabled: true,
  stuckDetectionEnabled: true,
  patternNudgesEnabled: true,
  breakIntervalMinutes: 45,
  hydrationIntervalMinutes: 60,
};

export function useSmartNudges(
  tasks: Task[],
  events: CalendarEvent[],
  activeTaskId?: string | null,
) {
  const { user } = useAuth();
  const [activeNudge, setActiveNudge] = useState<Nudge | null>(null);
  const [settings, setSettings] = useState<NudgeSettings>(DEFAULT_SETTINGS);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [mutedTypes, setMutedTypes] = useState<Set<NudgeType>>(readMutedTypes);
  const [patterns, setPatterns] = useState<UserPattern[]>([]);

  // Timers
  const lastBreakRef = useRef<Date>(new Date());
  const lastHydrationRef = useRef<Date>(new Date());
  const taskStartTimeRef = useRef<Date | null>(null);
  const focusStartRef = useRef<Date | null>(null);
  const lastPatternNudgeRef = useRef<Date>(new Date(0));

  // Fetch user patterns for pattern-aware nudges
  useEffect(() => {
    if (!user || !settings.patternNudgesEnabled) return;

    const fetchPatterns = async () => {
      const { data, error } = await supabase
        .from("user_patterns")
        .select("id, pattern_type, category, title, description, confidence_score, variables")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .gte("confidence_score", 0.6)
        .order("confidence_score", { ascending: false })
        .limit(10);

      if (!error && data) {
        setPatterns(data as UserPattern[]);
      }
    };

    fetchPatterns();
    // Refresh patterns every hour
    const interval = setInterval(fetchPatterns, 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, [user, settings.patternNudgesEnabled]);

  // Reset timers when starting a task
  useEffect(() => {
    if (activeTaskId) {
      taskStartTimeRef.current = new Date();
      focusStartRef.current = new Date();
    } else {
      taskStartTimeRef.current = null;
    }
  }, [activeTaskId]);

  // Record how the user responded to a nudge so proactivity can be tuned and
  // measured (feeds the proactivity north-star metric).
  const recordFeedback = useCallback((nudge: Nudge, outcome: ProactiveOutcome) => {
    trackProactiveOutcome("smart_nudge", outcome, { nudgeType: nudge.type, nudgeId: nudge.id });
  }, []);

  const dismissNudge = useCallback((nudgeId?: string) => {
    if (nudgeId) {
      setDismissed((prev) => new Set([...prev, nudgeId]));
    }
    setActiveNudge(null);
  }, []);

  // "Don't show these" — mute a whole nudge type for good (persisted locally)
  // and record the signal.
  const muteNudgeType = useCallback(
    (nudge: Nudge) => {
      recordFeedback(nudge, "muted");
      setMutedTypes((prev) => {
        const next = new Set(prev).add(nudge.type);
        try {
          localStorage.setItem(MUTED_TYPES_KEY, JSON.stringify([...next]));
        } catch {
          /* ignore */
        }
        return next;
      });
      setActiveNudge(null);
    },
    [recordFeedback],
  );

  const showNudge = useCallback(
    (nudge: Nudge) => {
      if (dismissed.has(nudge.id) || mutedTypes.has(nudge.type)) return;
      setActiveNudge(nudge);
    },
    [dismissed, mutedTypes],
  );

  const takeBreak = useCallback(() => {
    lastBreakRef.current = new Date();
    dismissNudge("break_reminder");
  }, [dismissNudge]);

  const drinkWater = useCallback(() => {
    lastHydrationRef.current = new Date();
    dismissNudge("hydration_reminder");
  }, [dismissNudge]);

  // Check for pattern-based nudges
  const checkPatternNudges = useCallback(() => {
    if (!settings.patternNudgesEnabled || patterns.length === 0) return null;

    const now = new Date();
    const hour = now.getHours();

    // Only show pattern nudges once every 2 hours max
    const timeSinceLastPatternNudge =
      (now.getTime() - lastPatternNudgeRef.current.getTime()) / 60000;
    if (timeSinceLastPatternNudge < 120) return null;

    // Find relevant pattern based on time/context
    for (const pattern of patterns) {
      // Sleep-productivity pattern: nudge in morning if relevant
      if (pattern.category === "sleep" && hour >= 6 && hour <= 9) {
        lastPatternNudgeRef.current = new Date();
        return {
          id: `pattern_${pattern.id}_${now.toDateString()}`,
          type: "pattern_insight" as const,
          title: "💡 Pattern Insight",
          message: pattern.description,
          reason: `Based on a detected pattern in your data (confidence ${Math.round(pattern.confidence_score * 100)}%).`,
          priority: "medium" as const,
          dismissable: true,
        };
      }

      // Productivity patterns: nudge during work hours
      if (pattern.category === "productivity" && hour >= 9 && hour <= 17) {
        lastPatternNudgeRef.current = new Date();
        return {
          id: `pattern_${pattern.id}_${now.toDateString()}`,
          type: "pattern_insight" as const,
          title: "📊 Productivity Insight",
          message: pattern.description,
          reason: `Based on a detected pattern in your data (confidence ${Math.round(pattern.confidence_score * 100)}%).`,
          priority: "low" as const,
          dismissable: true,
        };
      }

      // Mood/energy patterns: nudge in afternoon
      if (
        (pattern.category === "mood" || pattern.category === "health") &&
        hour >= 14 &&
        hour <= 16
      ) {
        lastPatternNudgeRef.current = new Date();
        return {
          id: `pattern_${pattern.id}_${now.toDateString()}`,
          type: "wellness_alert" as const,
          title: "🌟 Wellness Tip",
          message: pattern.description,
          reason: `Based on a detected pattern in your data (confidence ${Math.round(pattern.confidence_score * 100)}%).`,
          priority: "low" as const,
          dismissable: true,
        };
      }

      // Exercise patterns: nudge in late afternoon/evening
      if (pattern.category === "exercise" && hour >= 16 && hour <= 19) {
        lastPatternNudgeRef.current = new Date();
        return {
          id: `pattern_${pattern.id}_${now.toDateString()}`,
          type: "wellness_alert" as const,
          title: "🏃 Activity Reminder",
          message: pattern.description,
          reason: `Based on a detected pattern in your data (confidence ${Math.round(pattern.confidence_score * 100)}%).`,
          priority: "medium" as const,
          dismissable: true,
        };
      }
    }

    return null;
  }, [settings.patternNudgesEnabled, patterns]);

  // Check for upcoming events (transition warnings)
  const checkTransitions = useCallback(() => {
    if (!settings.transitionWarningsEnabled) return null;

    const now = new Date();
    const soon = new Date(now.getTime() + 10 * 60 * 1000); // 10 minutes

    const upcomingEvent = events.find((event) => {
      const eventStart = new Date(event.startTime);
      return eventStart > now && eventStart <= soon;
    });

    if (upcomingEvent) {
      const minutesUntil = Math.round(
        (new Date(upcomingEvent.startTime).getTime() - now.getTime()) / 60000,
      );

      return {
        id: `transition_${upcomingEvent.id}`,
        type: "transition" as const,
        title: "⏰ Upcoming Event",
        message: `"${upcomingEvent.title}" starts in ${minutesUntil} minutes. Time to wrap up!`,
        reason: "You have a calendar event starting within the next 10 minutes.",
        priority: "high" as const,
        dismissable: true,
      };
    }
    return null;
  }, [events, settings.transitionWarningsEnabled]);

  // Check for break reminders
  const checkBreakNeeded = useCallback(() => {
    if (!settings.breakRemindersEnabled) return null;

    const now = new Date();
    const timeSinceBreak = (now.getTime() - lastBreakRef.current.getTime()) / 60000;

    if (timeSinceBreak >= settings.breakIntervalMinutes) {
      return {
        id: "break_reminder",
        type: "break_reminder" as const,
        title: "🧘 Time for a Break",
        message: `You've been focused for ${Math.round(timeSinceBreak)} minutes. Your brain needs a quick reset!`,
        reason: `You've been active for ${Math.round(timeSinceBreak)} min without a break (reminder set to every ${settings.breakIntervalMinutes} min).`,
        action: {
          label: "Take 5 min break",
          onClick: takeBreak,
        },
        priority: "medium" as const,
        dismissable: true,
      };
    }
    return null;
  }, [settings.breakRemindersEnabled, settings.breakIntervalMinutes, takeBreak]);

  // Check for hydration reminders
  const checkHydration = useCallback(() => {
    if (!settings.hydrationRemindersEnabled) return null;

    const now = new Date();
    const timeSinceHydration = (now.getTime() - lastHydrationRef.current.getTime()) / 60000;

    if (timeSinceHydration >= settings.hydrationIntervalMinutes) {
      return {
        id: "hydration_reminder",
        type: "hydration" as const,
        title: "💧 Hydration Check",
        message: "Your brain works better when hydrated. Time for some water!",
        reason: `It's been about ${settings.hydrationIntervalMinutes} min since your last hydration reminder.`,
        action: {
          label: "Done!",
          onClick: drinkWater,
        },
        priority: "low" as const,
        dismissable: true,
      };
    }
    return null;
  }, [settings.hydrationRemindersEnabled, settings.hydrationIntervalMinutes, drinkWater]);

  // Check for time blindness (task taking too long)
  const checkTimeBlindness = useCallback(() => {
    if (!settings.timeBlindnessEnabled || !taskStartTimeRef.current || !activeTaskId) {
      return null;
    }

    const now = new Date();
    const minutesOnTask = (now.getTime() - taskStartTimeRef.current.getTime()) / 60000;
    const activeTask = tasks.find((t) => t.id === activeTaskId);

    // Nudge at 30, 60, 90 minute intervals
    if (minutesOnTask >= 30 && minutesOnTask < 35) {
      return {
        id: `time_blindness_30_${activeTaskId}`,
        type: "time_blindness" as const,
        title: "⏱️ Time Check",
        message: `You've been on "${activeTask?.title || "this task"}" for 30 minutes. Still on track?`,
        reason: "You started this task about 30 minutes ago — a gentle time check.",
        priority: "medium" as const,
        dismissable: true,
      };
    }

    if (minutesOnTask >= 60 && minutesOnTask < 65) {
      return {
        id: `time_blindness_60_${activeTaskId}`,
        type: "time_blindness" as const,
        title: "🕐 Hour Mark",
        message: `One hour on "${activeTask?.title || "this task"}". Consider breaking it into smaller pieces?`,
        reason:
          "You've been on this task for an hour — long stretches are easier in smaller pieces.",
        priority: "high" as const,
        dismissable: true,
      };
    }

    return null;
  }, [settings.timeBlindnessEnabled, activeTaskId, tasks]);

  // Check for stuck detection (no task activity)
  const checkStuckDetection = useCallback(() => {
    if (!settings.stuckDetectionEnabled) return null;

    const now = new Date();
    const incompleteTasks = tasks.filter((t) => !t.completed);

    // If there are incomplete tasks and no active task for 15+ minutes
    if (incompleteTasks.length > 0 && !activeTaskId && focusStartRef.current) {
      const timeSinceFocus = (now.getTime() - focusStartRef.current.getTime()) / 60000;

      if (timeSinceFocus >= 15) {
        const topTask = incompleteTasks[0];
        return {
          id: "stuck_detection",
          type: "stuck_detection" as const,
          title: "🤔 Feeling Stuck?",
          message: `How about starting with just 2 minutes on "${topTask.title}"?`,
          reason: "You have open tasks but none active for 15+ minutes.",
          priority: "medium" as const,
          dismissable: true,
        };
      }
    }
    return null;
  }, [settings.stuckDetectionEnabled, tasks, activeTaskId]);

  // Main check loop
  useEffect(() => {
    if (!user) return;

    const checkNudges = () => {
      // Priority order: transitions > time blindness > pattern insights > breaks > stuck > hydration
      const transition = checkTransitions();
      if (transition) {
        showNudge(transition);
        return;
      }

      const timeBlindness = checkTimeBlindness();
      if (timeBlindness) {
        showNudge(timeBlindness);
        return;
      }

      // Pattern-based nudges (new!)
      const patternNudge = checkPatternNudges();
      if (patternNudge) {
        showNudge(patternNudge);
        return;
      }

      const breakReminder = checkBreakNeeded();
      if (breakReminder) {
        showNudge(breakReminder);
        return;
      }

      const stuck = checkStuckDetection();
      if (stuck) {
        showNudge(stuck);
        return;
      }

      const hydration = checkHydration();
      if (hydration) {
        showNudge(hydration);
        return;
      }
    };

    // Check every 30 seconds
    const interval = setInterval(checkNudges, 30000);

    // Initial check after 5 seconds
    const initialTimeout = setTimeout(checkNudges, 5000);

    return () => {
      clearInterval(interval);
      clearTimeout(initialTimeout);
    };
  }, [
    user,
    checkTransitions,
    checkTimeBlindness,
    checkPatternNudges,
    checkBreakNeeded,
    checkStuckDetection,
    checkHydration,
    showNudge,
  ]);

  // Reset dismissed nudges periodically
  useEffect(() => {
    const resetInterval = setInterval(
      () => {
        setDismissed(new Set());
      },
      30 * 60 * 1000,
    ); // Reset every 30 minutes

    return () => clearInterval(resetInterval);
  }, []);

  return {
    activeNudge,
    dismissNudge,
    muteNudgeType,
    recordFeedback,
    settings,
    setSettings,
    takeBreak,
    drinkWater,
    patterns,
    resetBreakTimer: () => {
      lastBreakRef.current = new Date();
    },
    resetHydrationTimer: () => {
      lastHydrationRef.current = new Date();
    },
  };
}
