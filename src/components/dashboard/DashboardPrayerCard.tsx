import { useState, useEffect, useCallback, useMemo } from "react";
import { GlassCard, GlassCardContent } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Bell, Sunrise, Sun, Sunset, Moon as MoonIcon, Check, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { useHaptics } from "@/hooks/useHaptics";
import { toast } from "sonner";
import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { motion, AnimatePresence } from "framer-motion";

interface PrayerTimeData {
  name: string;
  arabicName: string;
  time: string;
}

const PRAYERS = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"];
const ARABIC_NAMES: Record<string, string> = {
  Fajr: "الفجر",
  Dhuhr: "الظهر",
  Asr: "العصر",
  Maghrib: "المغرب",
  Isha: "العشاء",
};

function getCompletedPrayersKey(): string {
  return `completed-prayers-${format(new Date(), "yyyy-MM-dd")}`;
}

function getPrayerIcon(name: string, className = "w-4 h-4") {
  switch (name) {
    case "Fajr":
      return <Sunrise className={cn(className, "text-indigo-500")} />;
    case "Dhuhr":
      return <Sun className={cn(className, "text-orange-500")} />;
    case "Asr":
      return <Sun className={cn(className, "text-amber-600")} />;
    case "Maghrib":
      return <Sunset className={cn(className, "text-rose-500")} />;
    case "Isha":
      return <MoonIcon className={cn(className, "text-purple-500")} />;
    default:
      return null;
  }
}

interface DashboardPrayerCardProps {
  onNavigate?: (panel: string) => void;
}

export function DashboardPrayerCard({ onNavigate }: DashboardPrayerCardProps) {
  const [prayerTimes, setPrayerTimes] = useState<PrayerTimeData[]>([]);
  const [loading, setLoading] = useState(true);
  const [countdown, setCountdown] = useState("");
  const [nextPrayer, setNextPrayer] = useState("");
  const [nextPrayerTime, setNextPrayerTime] = useState("");
  const { vibrate } = useHaptics();

  // Completed prayers
  const [completedPrayers, setCompletedPrayers] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem(getCompletedPrayersKey());
      return saved ? JSON.parse(saved) : {};
    } catch (error) {
      console.warn("Failed to load completed prayers from localStorage", error);
      return {};
    }
  });

  // Notification state
  const [notifEnabled, setNotifEnabled] = useState(() => {
    try {
      const saved = localStorage.getItem("prayer-notifications");
      if (saved) return JSON.parse(saved).enabled === true;
    } catch {
      /* ignore */
    }
    return false;
  });
  const [notifDismissed, setNotifDismissed] = useState(() => {
    return localStorage.getItem("prayer-notif-prompt-dismissed") === "true";
  });

  const completedCount = useMemo(
    () => PRAYERS.filter((p) => completedPrayers[p]).length,
    [completedPrayers],
  );

  const togglePrayer = useCallback(
    (name: string) => {
      vibrate("light");
      setCompletedPrayers((prev) => {
        const next = { ...prev, [name]: !prev[name] };
        localStorage.setItem(getCompletedPrayersKey(), JSON.stringify(next));
        return next;
      });
    },
    [vibrate],
  );

  // Fetch prayer times
  useEffect(() => {
    const fetchTimes = async (lat: number, lng: number) => {
      try {
        const method = localStorage.getItem("prayer-calculation-method") || "2";
        const date = new Date();
        const dateStr = `${date.getDate()}-${date.getMonth() + 1}-${date.getFullYear()}`;
        const res = await fetch(
          `https://api.aladhan.com/v1/timings/${dateStr}?latitude=${lat}&longitude=${lng}&method=${method}`,
          { signal: AbortSignal.timeout(10000) },
        );
        if (!res.ok) throw new Error("Failed");
        const data = await res.json();
        if (data.code === 200) {
          const t = data.data.timings;
          setPrayerTimes(
            PRAYERS.map((name) => ({ name, arabicName: ARABIC_NAMES[name], time: t[name] })),
          );
        }
      } catch (e) {
        console.error("Prayer times fetch error:", e);
      } finally {
        setLoading(false);
      }
    };

    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => fetchTimes(pos.coords.latitude, pos.coords.longitude),
        () => {
          fetchTimes(21.4225, 39.8262);
        }, // Default to Mecca
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
      );
    } else {
      fetchTimes(21.4225, 39.8262);
    }
  }, []);

  // Countdown timer
  useEffect(() => {
    if (prayerTimes.length === 0) return;
    const update = () => {
      const now = new Date();
      const currentMin = now.getHours() * 60 + now.getMinutes();
      for (const prayer of prayerTimes) {
        const [h, m] = prayer.time.split(":").map(Number);
        const prayerMin = h * 60 + m;
        if (prayerMin > currentMin) {
          const diff = prayerMin - currentMin;
          const hrs = Math.floor(diff / 60);
          const mins = diff % 60;
          setCountdown(hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`);
          setNextPrayer(prayer.name);
          setNextPrayerTime(prayer.time);
          return;
        }
      }
      // All passed, next is Fajr tomorrow
      const fajr = prayerTimes[0];
      const [h, m] = fajr.time.split(":").map(Number);
      const diff = 24 * 60 - currentMin + h * 60 + m;
      const hrs = Math.floor(diff / 60);
      const mins = diff % 60;
      setCountdown(hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`);
      setNextPrayer(fajr.name);
      setNextPrayerTime(fajr.time);
    };
    update();
    const interval = setInterval(update, 30000);
    return () => clearInterval(interval);
  }, [prayerTimes]);

  // Enable notifications handler
  const enableNotifications = async () => {
    const isNative = Capacitor.isNativePlatform();
    let granted = false;

    if (isNative) {
      const result = await LocalNotifications.requestPermissions();
      granted = result.display === "granted";
    } else {
      try {
        if (window.self !== window.top) {
          toast.info("Open the app in a new tab for notifications");
          setNotifDismissed(true);
          localStorage.setItem("prayer-notif-prompt-dismissed", "true");
          return;
        }
      } catch {
        /* ignore */
      }
      if (!("Notification" in window)) {
        toast.error("Notifications not supported in this browser");
        return;
      }
      const perm = await Notification.requestPermission();
      granted = perm === "granted";
    }

    if (granted) {
      const settings = {
        enabled: true,
        prayers: { Fajr: true, Dhuhr: true, Asr: true, Maghrib: true, Isha: true },
        minutesBefore: 5,
        adhanEnabled: false,
        adhanStyle: "makkah",
        adhanVolume: 70,
      };
      localStorage.setItem("prayer-notifications", JSON.stringify(settings));
      setNotifEnabled(true);
      toast.success("Prayer reminders enabled! 🕌");
    } else {
      toast.error("Permission denied");
    }
  };

  if (loading) {
    return (
      <GlassCard>
        <GlassCardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-muted animate-pulse" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-24 bg-muted animate-pulse rounded" />
              <div className="h-3 w-32 bg-muted animate-pulse rounded" />
            </div>
          </div>
        </GlassCardContent>
      </GlassCard>
    );
  }

  const showNotifPrompt = !notifEnabled && !notifDismissed;

  return (
    <GlassCard className="overflow-hidden">
      <GlassCardContent className="p-0">
        {/* Main prayer info */}
        <button
          type="button"
          className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/30 transition-colors text-left w-full"
          onClick={() => onNavigate?.("islam")}
        >
          {/* Next prayer icon + countdown */}
          <div className="relative shrink-0">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              {getPrayerIcon(nextPrayer, "w-5 h-5")}
            </div>
            {/* Mini progress ring using SVG */}
            <svg className="absolute inset-0 w-12 h-12 -rotate-90" viewBox="0 0 48 48">
              <circle
                cx="24"
                cy="24"
                r="21"
                fill="none"
                stroke="hsl(var(--muted))"
                strokeWidth="2"
              />
              <circle
                cx="24"
                cy="24"
                r="21"
                fill="none"
                stroke="hsl(var(--primary))"
                strokeWidth="2"
                strokeDasharray={`${(completedCount / 5) * 132} 132`}
                strokeLinecap="round"
                className="transition-all duration-500"
              />
            </svg>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-semibold">{nextPrayer}</span>
              <span className="text-xs text-muted-foreground">in {countdown}</span>
            </div>
            <span className="text-xs text-muted-foreground">at {nextPrayerTime}</span>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <span className="text-xs font-medium text-primary">{completedCount}/5</span>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </div>
        </button>

        {/* Prayer completion row */}
        <div className="flex items-center justify-between px-3 pb-3 gap-1">
          {PRAYERS.map((name) => {
            const done = completedPrayers[name];
            const isNext = name === nextPrayer;
            // Check if prayer time has passed
            const prayerData = prayerTimes.find((p) => p.name === name);
            let isPast = false;
            if (prayerData) {
              const [h, m] = prayerData.time.split(":").map(Number);
              const now = new Date();
              isPast = now.getHours() * 60 + now.getMinutes() > h * 60 + m;
            }

            return (
              <motion.button
                key={name}
                whileTap={{ scale: 0.9 }}
                onClick={(e) => {
                  e.stopPropagation();
                  togglePrayer(name);
                }}
                className={cn(
                  "flex flex-col items-center gap-1 flex-1 py-1.5 rounded-lg transition-colors",
                  "hover:bg-muted/50 active:bg-muted/70",
                  isNext && !done && "bg-primary/5",
                )}
              >
                <div
                  className={cn(
                    "w-7 h-7 rounded-full flex items-center justify-center transition-all",
                    done
                      ? "bg-primary text-primary-foreground"
                      : isPast && !done
                        ? "bg-destructive/10 text-destructive border border-destructive/30"
                        : "bg-muted/60 text-muted-foreground",
                  )}
                >
                  <AnimatePresence mode="wait">
                    {done ? (
                      <motion.div
                        key="check"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        exit={{ scale: 0 }}
                      >
                        <Check className="w-3.5 h-3.5" />
                      </motion.div>
                    ) : (
                      <motion.div key="icon">{getPrayerIcon(name, "w-3.5 h-3.5")}</motion.div>
                    )}
                  </AnimatePresence>
                </div>
                <span
                  className={cn(
                    "text-[10px] leading-none",
                    done ? "text-primary font-medium" : "text-muted-foreground",
                    isNext && !done && "font-medium text-foreground",
                  )}
                >
                  {name}
                </span>
              </motion.button>
            );
          })}
        </div>

        {/* Progress bar */}
        <div className="px-3 pb-3">
          <Progress value={(completedCount / 5) * 100} className="h-1.5" />
        </div>

        {/* Notification prompt */}
        {showNotifPrompt && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            className="border-t border-border/40"
          >
            <div className="flex items-center justify-between px-3 py-2.5 bg-primary/5">
              <div className="flex items-center gap-2">
                <Bell className="w-3.5 h-3.5 text-primary" />
                <span className="text-xs text-foreground">Never miss a prayer</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs text-muted-foreground"
                  onClick={() => {
                    setNotifDismissed(true);
                    localStorage.setItem("prayer-notif-prompt-dismissed", "true");
                  }}
                >
                  Later
                </Button>
                <Button size="sm" className="h-6 px-3 text-xs" onClick={enableNotifications}>
                  Enable
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </GlassCardContent>
    </GlassCard>
  );
}

// Export prayer times fetcher for TodayTimeline integration
// eslint-disable-next-line react-refresh/only-export-components
export async function fetchPrayerTimesForTimeline(): Promise<{ name: string; time: string }[]> {
  return new Promise((resolve) => {
    const method = localStorage.getItem("prayer-calculation-method") || "2";
    const date = new Date();
    const dateStr = `${date.getDate()}-${date.getMonth() + 1}-${date.getFullYear()}`;

    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          try {
            const res = await fetch(
              `https://api.aladhan.com/v1/timings/${dateStr}?latitude=${pos.coords.latitude}&longitude=${pos.coords.longitude}&method=${method}`,
              { signal: AbortSignal.timeout(10000) },
            );
            const data = await res.json();
            if (data.code === 200) {
              const t = data.data.timings;
              resolve(PRAYERS.map((name) => ({ name, time: t[name] })));
              return;
            }
          } catch {
            /* ignore */
          }
          resolve([]);
        },
        () => resolve([]),
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
      );
    } else {
      resolve([]);
    }
  });
}
