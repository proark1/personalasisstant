import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useTextToSpeech } from "./useTextToSpeech";
import { useProactiveSettings } from "./useProactiveSettings";
import { toast } from "sonner";

interface BriefingData {
  greeting: string;
  weather?: string;
  topTasks: Array<{ title: string; priority: string }>;
  upcomingEvents: Array<{ title: string; time: string }>;
  reminders: Array<{ title: string; message: string }>;
  insights?: string;
}

export function useMorningBriefing() {
  const { user } = useAuth();
  const { settings } = useProactiveSettings();
  const { speak, stop, isSpeaking } = useTextToSpeech({});
  const [briefing, setBriefing] = useState<BriefingData | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasPlayedToday, setHasPlayedToday] = useState(false);
  const [shouldAutoPlay, setShouldAutoPlay] = useState(false);

  // Check if this is first app open of the day
  useEffect(() => {
    const checkFirstOpen = async () => {
      if (!user?.id || !settings?.voice_proactive_enabled) return;

      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("last_session_at")
          .eq("user_id", user.id)
          .single();

        const now = new Date();
        const today = now.toISOString().split("T")[0];
        const lastSession = profile?.last_session_at;

        // Check if last session was before today
        const isFirstOpenToday =
          !lastSession || new Date(lastSession).toISOString().split("T")[0] !== today;

        // Check if current time is within morning briefing hours (6am - 11am)
        const currentHour = now.getHours();
        const isMorning = currentHour >= 6 && currentHour < 11;

        if (isFirstOpenToday && isMorning && !hasPlayedToday) {
          setShouldAutoPlay(true);
        }

        // Update last session
        await supabase
          .from("profiles")
          .update({ last_session_at: now.toISOString() })
          .eq("user_id", user.id);
      } catch (err) {
        console.error("Error checking first open:", err);
      }
    };

    checkFirstOpen();
  }, [user?.id, settings?.voice_proactive_enabled, hasPlayedToday]);

  // Auto-play briefing
  useEffect(() => {
    if (shouldAutoPlay && !hasPlayedToday) {
      fetchAndPlayBriefing();
      setShouldAutoPlay(false);
      setHasPlayedToday(true);
    }
    // fetchAndPlayBriefing intentionally excluded to avoid triggering re-subscriptions
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldAutoPlay, hasPlayedToday]);

  const fetchBriefing = useCallback(async () => {
    if (!user?.id) return null;

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("morning-briefing", {
        body: { user_id: user.id },
      });

      if (error) throw error;

      const briefingData: BriefingData = {
        greeting: data.greeting || getTimeBasedGreeting(),
        weather: data.weather,
        topTasks: data.topTasks || [],
        upcomingEvents: data.upcomingEvents || [],
        reminders: data.reminders || [],
        insights: data.insights,
      };

      setBriefing(briefingData);
      return briefingData;
    } catch (err) {
      console.error("Error fetching morning briefing:", err);
      return null;
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  const generateBriefingText = (data: BriefingData): string => {
    let text = data.greeting + ". ";

    if (data.weather) {
      text += data.weather + ". ";
    }

    if (data.topTasks.length > 0) {
      text += `You have ${data.topTasks.length} important task${data.topTasks.length > 1 ? "s" : ""} today. `;
      if (data.topTasks.length <= 3) {
        text += data.topTasks.map((t) => t.title).join(", ") + ". ";
      } else {
        text += `Your top priority is: ${data.topTasks[0].title}. `;
      }
    }

    if (data.upcomingEvents.length > 0) {
      text += `You have ${data.upcomingEvents.length} event${data.upcomingEvents.length > 1 ? "s" : ""} coming up. `;
      if (data.upcomingEvents.length === 1) {
        text += `${data.upcomingEvents[0].title} at ${data.upcomingEvents[0].time}. `;
      }
    }

    if (data.reminders.length > 0) {
      text += `I have ${data.reminders.length} reminder${data.reminders.length > 1 ? "s" : ""} for you. `;
    }

    if (data.insights) {
      text += data.insights;
    }

    text += " Have a great day!";
    return text;
  };

  const fetchAndPlayBriefing = useCallback(async () => {
    const data = await fetchBriefing();
    if (data) {
      const text = generateBriefingText(data);
      speak(text, "supportive");
      toast.success("Playing morning briefing");
    }
  }, [fetchBriefing, speak]);

  const playBriefing = useCallback(() => {
    if (briefing) {
      const text = generateBriefingText(briefing);
      speak(text, "supportive");
    } else {
      fetchAndPlayBriefing();
    }
  }, [briefing, speak, fetchAndPlayBriefing]);

  const stopBriefing = useCallback(() => {
    stop();
  }, [stop]);

  return {
    briefing,
    loading,
    isSpeaking,
    fetchBriefing,
    playBriefing,
    stopBriefing,
    fetchAndPlayBriefing,
  };
}

function getTimeBasedGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}
