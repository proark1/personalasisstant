import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Task, CalendarEvent } from '@/types/flux';

export interface Nudge {
  id: string;
  type: 'time_blindness' | 'break_reminder' | 'transition' | 'hydration' | 'task_start' | 'stuck_detection';
  title: string;
  message: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  dismissable?: boolean;
  priority: 'low' | 'medium' | 'high';
  icon?: string;
}

interface NudgeSettings {
  timeBlindnessEnabled: boolean;
  breakRemindersEnabled: boolean;
  transitionWarningsEnabled: boolean;
  hydrationRemindersEnabled: boolean;
  stuckDetectionEnabled: boolean;
  breakIntervalMinutes: number;
  hydrationIntervalMinutes: number;
}

const DEFAULT_SETTINGS: NudgeSettings = {
  timeBlindnessEnabled: true,
  breakRemindersEnabled: true,
  transitionWarningsEnabled: true,
  hydrationRemindersEnabled: true,
  stuckDetectionEnabled: true,
  breakIntervalMinutes: 45,
  hydrationIntervalMinutes: 60,
};

export function useSmartNudges(
  tasks: Task[],
  events: CalendarEvent[],
  activeTaskId?: string | null
) {
  const { user } = useAuth();
  const [activeNudge, setActiveNudge] = useState<Nudge | null>(null);
  const [settings, setSettings] = useState<NudgeSettings>(DEFAULT_SETTINGS);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  
  // Timers
  const lastBreakRef = useRef<Date>(new Date());
  const lastHydrationRef = useRef<Date>(new Date());
  const taskStartTimeRef = useRef<Date | null>(null);
  const focusStartRef = useRef<Date | null>(null);

  // Reset timers when starting a task
  useEffect(() => {
    if (activeTaskId) {
      taskStartTimeRef.current = new Date();
      focusStartRef.current = new Date();
    } else {
      taskStartTimeRef.current = null;
    }
  }, [activeTaskId]);

  const dismissNudge = useCallback((nudgeId?: string) => {
    if (nudgeId) {
      setDismissed(prev => new Set([...prev, nudgeId]));
    }
    setActiveNudge(null);
  }, []);

  const showNudge = useCallback((nudge: Nudge) => {
    if (dismissed.has(nudge.id)) return;
    setActiveNudge(nudge);
  }, [dismissed]);

  const takeBreak = useCallback(() => {
    lastBreakRef.current = new Date();
    dismissNudge('break_reminder');
  }, [dismissNudge]);

  const drinkWater = useCallback(() => {
    lastHydrationRef.current = new Date();
    dismissNudge('hydration_reminder');
  }, [dismissNudge]);

  // Check for upcoming events (transition warnings)
  const checkTransitions = useCallback(() => {
    if (!settings.transitionWarningsEnabled) return null;
    
    const now = new Date();
    const soon = new Date(now.getTime() + 10 * 60 * 1000); // 10 minutes
    
    const upcomingEvent = events.find(event => {
      const eventStart = new Date(event.startTime);
      return eventStart > now && eventStart <= soon;
    });

    if (upcomingEvent) {
      const minutesUntil = Math.round(
        (new Date(upcomingEvent.startTime).getTime() - now.getTime()) / 60000
      );
      
      return {
        id: `transition_${upcomingEvent.id}`,
        type: 'transition' as const,
        title: '⏰ Upcoming Event',
        message: `"${upcomingEvent.title}" starts in ${minutesUntil} minutes. Time to wrap up!`,
        priority: 'high' as const,
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
        id: 'break_reminder',
        type: 'break_reminder' as const,
        title: '🧘 Time for a Break',
        message: `You've been focused for ${Math.round(timeSinceBreak)} minutes. Your brain needs a quick reset!`,
        action: {
          label: 'Take 5 min break',
          onClick: takeBreak,
        },
        priority: 'medium' as const,
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
        id: 'hydration_reminder',
        type: 'hydration' as const,
        title: '💧 Hydration Check',
        message: "Your brain works better when hydrated. Time for some water!",
        action: {
          label: 'Done!',
          onClick: drinkWater,
        },
        priority: 'low' as const,
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
    const activeTask = tasks.find(t => t.id === activeTaskId);
    
    // Nudge at 30, 60, 90 minute intervals
    if (minutesOnTask >= 30 && minutesOnTask < 35) {
      return {
        id: `time_blindness_30_${activeTaskId}`,
        type: 'time_blindness' as const,
        title: '⏱️ Time Check',
        message: `You've been on "${activeTask?.title || 'this task'}" for 30 minutes. Still on track?`,
        priority: 'medium' as const,
        dismissable: true,
      };
    }
    
    if (minutesOnTask >= 60 && minutesOnTask < 65) {
      return {
        id: `time_blindness_60_${activeTaskId}`,
        type: 'time_blindness' as const,
        title: '🕐 Hour Mark',
        message: `One hour on "${activeTask?.title || 'this task'}". Consider breaking it into smaller pieces?`,
        priority: 'high' as const,
        dismissable: true,
      };
    }
    
    return null;
  }, [settings.timeBlindnessEnabled, activeTaskId, tasks]);

  // Check for stuck detection (no task activity)
  const checkStuckDetection = useCallback(() => {
    if (!settings.stuckDetectionEnabled) return null;
    
    const now = new Date();
    const incompleteTasks = tasks.filter(t => !t.completed);
    
    // If there are incomplete tasks and no active task for 15+ minutes
    if (incompleteTasks.length > 0 && !activeTaskId && focusStartRef.current) {
      const timeSinceFocus = (now.getTime() - focusStartRef.current.getTime()) / 60000;
      
      if (timeSinceFocus >= 15) {
        const topTask = incompleteTasks[0];
        return {
          id: 'stuck_detection',
          type: 'stuck_detection' as const,
          title: '🤔 Feeling Stuck?',
          message: `How about starting with just 2 minutes on "${topTask.title}"?`,
          priority: 'medium' as const,
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
      // Priority order: transitions > time blindness > breaks > stuck > hydration
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
    checkBreakNeeded,
    checkStuckDetection,
    checkHydration,
    showNudge,
  ]);

  // Reset dismissed nudges periodically
  useEffect(() => {
    const resetInterval = setInterval(() => {
      setDismissed(new Set());
    }, 30 * 60 * 1000); // Reset every 30 minutes

    return () => clearInterval(resetInterval);
  }, []);

  return {
    activeNudge,
    dismissNudge,
    settings,
    setSettings,
    takeBreak,
    drinkWater,
    resetBreakTimer: () => { lastBreakRef.current = new Date(); },
    resetHydrationTimer: () => { lastHydrationRef.current = new Date(); },
  };
}
