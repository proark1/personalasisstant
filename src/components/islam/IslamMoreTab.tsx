import { useState, useEffect, useCallback, useRef } from 'react';

// iOS exposes a non-standard, already-corrected compass heading on the event.
type CompassEvent = DeviceOrientationEvent & { webkitCompassHeading?: number };
import { motion } from 'framer-motion';
import { GlassCard } from '@/components/ui/glass-card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { staggerItem, staggerContainer } from '@/components/ui/panel-shell';
import {
  Compass, MapPin, RefreshCw, Calendar, BookOpen
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, differenceInDays } from 'date-fns';
import { HadithTab } from './HadithTab';
import type { IslamicEvent } from '@/hooks/useIslamicFeatures';

interface QiblaData {
  direction: number;
  latitude: number;
  longitude: number;
}

const isIOS = (): boolean => {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
};

interface IslamMoreTabProps {
  hijriToday: { day: number; month: number; year: number; monthName: string };
  islamicEvents: IslamicEvent[];
}

type SubView = 'menu' | 'qibla' | 'hadith' | 'calendar';

export function IslamMoreTab({ hijriToday, islamicEvents }: IslamMoreTabProps) {
  const [subView, setSubView] = useState<SubView>('menu');

  // Qibla state
  const [qiblaData, setQiblaData] = useState<QiblaData | null>(null);
  const [deviceHeading, setDeviceHeading] = useState<number | null>(null);
  const [locationName, setLocationName] = useState('');
  const [compassPermission, setCompassPermission] = useState<'pending' | 'granted' | 'denied'>('pending');
  const [loading, setLoading] = useState(false);

  const upcomingEvents = islamicEvents.filter(e => e.date >= new Date());
  const nextEvent = upcomingEvents[0];

  const calculateQibla = (lat: number, lng: number): number => {
    const meccaLat = 21.4225;
    const meccaLng = 39.8262;
    const phiK = (meccaLat * Math.PI) / 180;
    const lambdaK = (meccaLng * Math.PI) / 180;
    const phi = (lat * Math.PI) / 180;
    const lambda = (lng * Math.PI) / 180;
    const qibla = (180 / Math.PI) * Math.atan2(
      Math.sin(lambdaK - lambda),
      Math.cos(phi) * Math.tan(phiK) - Math.sin(phi) * Math.cos(lambdaK - lambda)
    );
    return (qibla + 360) % 360;
  };

  const reverseGeocode = useCallback(async (lat: number, lng: number) => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=10`,
        { signal: AbortSignal.timeout(5000), headers: { 'Accept-Language': 'en' } }
      );
      if (response.ok) {
        const data = await response.json();
        const city = data.address?.city || data.address?.town || data.address?.village ||
          data.address?.municipality || data.address?.county || data.address?.state;
        if (city) { setLocationName(city); return; }
      }
    } catch { /* ignore */ }
    setLocationName('');
  }, []);

  const getLocation = useCallback(() => {
    setLoading(true);
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          setQiblaData({ direction: calculateQibla(latitude, longitude), latitude, longitude });
          reverseGeocode(latitude, longitude);
          setLoading(false);
        },
        () => {
          setQiblaData({ direction: 0, latitude: 21.4225, longitude: 39.8262 });
          setLocationName('Mecca (Default)');
          setLoading(false);
        },
        { enableHighAccuracy: true, timeout: 15000 }
      );
    } else {
      setLoading(false);
    }
  }, [reverseGeocode]);

  const requestCompassPermission = async () => {
    // iOS 13+ gates the compass behind an explicit, non-standard permission prompt.
    const orientationApi = DeviceOrientationEvent as unknown as {
      requestPermission?: () => Promise<'granted' | 'denied'>;
    };
    if (typeof orientationApi.requestPermission === 'function') {
      try {
        const permission = await orientationApi.requestPermission();
        if (permission === 'granted') {
          setCompassPermission('granted');
          startCompassListener();
        } else {
          setCompassPermission('denied');
        }
      } catch {
        setCompassPermission('denied');
      }
    } else {
      setCompassPermission('granted');
      startCompassListener();
    }
  };

  const compassHandlerRef = useRef<((event: DeviceOrientationEvent) => void) | null>(null);

  const stopCompassListener = useCallback(() => {
    if (compassHandlerRef.current) {
      window.removeEventListener('deviceorientation', compassHandlerRef.current, true);
      compassHandlerRef.current = null;
    }
  }, []);

  const startCompassListener = useCallback(() => {
    stopCompassListener(); // never stack listeners
    const handler = (event: DeviceOrientationEvent) => {
      const heading = (event as CompassEvent).webkitCompassHeading;
      if (isIOS() && heading !== undefined) {
        setDeviceHeading(heading);
      } else if (event.alpha !== null) {
        setDeviceHeading(360 - event.alpha);
      }
    };
    compassHandlerRef.current = handler;
    window.addEventListener('deviceorientation', handler, true);
  }, [stopCompassListener]);

  // Fetch location once when entering the qibla view.
  useEffect(() => {
    if (subView === 'qibla' && !qiblaData) {
      getLocation();
    }
  }, [subView, qiblaData, getLocation]);

  // Manage the compass listener for the lifetime of the qibla view — kept
  // separate from the location fetch so loading qiblaData doesn't tear the
  // listener down (and leave it stopped because !qiblaData is then false).
  useEffect(() => {
    if (subView === 'qibla') {
      if (isIOS() && typeof (DeviceOrientationEvent as unknown as { requestPermission?: unknown }).requestPermission === 'function') {
        // wait for manual trigger
      } else {
        startCompassListener();
        setCompassPermission('granted');
      }
    }
    return () => stopCompassListener();
  }, [subView, startCompassListener, stopCompassListener]);

  const getQiblaRotation = (): number => {
    if (!qiblaData) return 0;
    if (deviceHeading !== null) return qiblaData.direction - deviceHeading;
    return qiblaData.direction;
  };

  if (subView === 'hadith') {
    return (
      <div className="flex flex-col h-full">
        <div className="p-3 border-b border-border">
          <Button variant="ghost" size="sm" onClick={() => setSubView('menu')}>
            ← Back
          </Button>
        </div>
        <HadithTab />
      </div>
    );
  }

  if (subView === 'qibla') {
    return (
      <div className="flex flex-col h-full">
        <div className="p-3 border-b border-border">
          <Button variant="ghost" size="sm" onClick={() => setSubView('menu')}>
            ← Back
          </Button>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-4 flex flex-col items-center justify-center min-h-[400px]">
            {compassPermission === 'pending' && isIOS() && (
              <Button onClick={requestCompassPermission} className="mb-4">
                <Compass className="w-4 h-4 mr-2" />
                Enable Compass
              </Button>
            )}

            {/* Compass */}
            <div className="relative w-72 h-72">
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-amber-500/20 via-emerald-500/10 to-amber-500/20 p-1">
                <div className="w-full h-full rounded-full bg-background" />
              </div>
              <div className="absolute inset-2 rounded-full bg-gradient-to-br from-card via-background to-card shadow-2xl border border-border/50">
                <div className="absolute inset-4 rounded-full border border-border/30">
                  {[...Array(72)].map((_, i) => (
                    <div key={i} className="absolute top-1/2 left-1/2 origin-center"
                      style={{ transform: `translate(-50%, -50%) rotate(${i * 5}deg)` }}>
                      <div className={cn(
                        "absolute left-1/2 -translate-x-1/2",
                        i % 18 === 0 ? "w-0.5 h-3 bg-foreground/60 -top-[108px]" :
                          i % 6 === 0 ? "w-0.5 h-2 bg-foreground/40 -top-[106px]" :
                            "w-px h-1 bg-foreground/20 -top-[104px]"
                      )} />
                    </div>
                  ))}
                </div>
                {[
                  { dir: 'N', angle: 0, color: 'text-red-500 font-bold' },
                  { dir: 'E', angle: 90, color: 'text-muted-foreground' },
                  { dir: 'S', angle: 180, color: 'text-muted-foreground' },
                  { dir: 'W', angle: 270, color: 'text-muted-foreground' },
                ].map(({ dir, angle, color }) => (
                  <div key={dir} className="absolute top-1/2 left-1/2 origin-center"
                    style={{ transform: `translate(-50%, -50%) rotate(${angle}deg)` }}>
                    <span className={cn("absolute left-1/2 -translate-x-1/2 -top-[85px] text-sm font-semibold", color)}
                      style={{ transform: `rotate(-${angle}deg)` }}>{dir}</span>
                  </div>
                ))}
                <div className="absolute inset-[72px] rounded-full bg-gradient-to-br from-emerald-500/5 to-amber-500/5 border border-border/20" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-3 h-3 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-lg shadow-emerald-500/30 z-10" />
                </div>
              </div>

              <div className="absolute inset-0 flex items-center justify-center pointer-events-none"
                style={{ transform: `rotate(${getQiblaRotation()}deg)`, transition: 'transform 0.15s cubic-bezier(0.4, 0, 0.2, 1)' }}>
                <div className="absolute top-8 left-1/2 -translate-x-1/2 flex flex-col items-center">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-700 shadow-lg shadow-emerald-500/40 flex items-center justify-center border-2 border-emerald-400/50">
                    <span className="text-lg">🕋</span>
                  </div>
                  <div className="w-1 h-20 bg-gradient-to-b from-emerald-500 to-emerald-700/50 rounded-b-full shadow-lg" />
                </div>
                <div className="absolute bottom-16 left-1/2 -translate-x-1/2">
                  <div className="w-0.5 h-10 bg-gradient-to-t from-muted-foreground/20 to-transparent rounded-t-full" />
                </div>
              </div>
            </div>

            <div className="mt-8 text-center space-y-3">
              <div className="flex items-center gap-2 justify-center">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <MapPin className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium">{locationName || 'Getting location...'}</span>
              </div>
              {qiblaData && (
                <div className="space-y-1">
                  <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                    {qiblaData.direction.toFixed(1)}°
                  </p>
                  <p className="text-sm text-muted-foreground">from North</p>
                </div>
              )}
              {deviceHeading !== null && (
                <Badge variant="secondary" className="gap-1">
                  <Compass className="w-3 h-3" />
                  Compass Active: {deviceHeading.toFixed(0)}°
                </Badge>
              )}
              {!deviceHeading && (
                <p className="text-xs text-muted-foreground max-w-[250px] mx-auto">
                  Point your device and rotate to find the Qibla direction. The 🕋 icon points towards Mecca.
                </p>
              )}
              <Button variant="outline" size="sm" onClick={getLocation} disabled={loading}>
                <RefreshCw className={cn("w-4 h-4 mr-2", loading && "animate-spin")} />
                Refresh Location
              </Button>
            </div>
          </div>
        </ScrollArea>
      </div>
    );
  }

  if (subView === 'calendar') {
    return (
      <div className="flex flex-col h-full">
        <div className="p-3 border-b border-border">
          <Button variant="ghost" size="sm" onClick={() => setSubView('menu')}>
            ← Back
          </Button>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-4 space-y-4">
            {/* Next event hero */}
            {nextEvent && (
              <GlassCard variant="gradient" className="p-5">
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Next Islamic Event</p>
                    <p className="text-lg font-bold truncate">{nextEvent.name}</p>
                    <p className="text-xs text-muted-foreground">{nextEvent.hijriDate}</p>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <p className="text-3xl font-bold text-primary">
                      {differenceInDays(nextEvent.date, new Date()) === 0
                        ? '🎉'
                        : differenceInDays(nextEvent.date, new Date())}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {differenceInDays(nextEvent.date, new Date()) === 0 ? 'Today!' : 'days left'}
                    </p>
                  </div>
                </div>
              </GlassCard>
            )}

            <GlassCard className="p-4">
              <p className="text-sm text-muted-foreground">Today's Hijri Date</p>
              <p className="text-xl font-bold font-arabic">
                {hijriToday.day} {hijriToday.monthName} {hijriToday.year} هـ
              </p>
            </GlassCard>

            <div className="flex flex-wrap gap-2">
              {['major', 'fasting', 'sunnah', 'remembrance', 'historical'].map(type => {
                const colors: Record<string, string> = {
                  major: 'bg-primary/10 border-primary/30',
                  fasting: 'bg-emerald-500/10 border-emerald-500/30',
                  sunnah: 'bg-amber-500/10 border-amber-500/30',
                  remembrance: 'bg-purple-500/10 border-purple-500/30',
                  historical: 'bg-blue-500/10 border-blue-500/30',
                };
                const dotColors: Record<string, string> = {
                  major: 'bg-primary', fasting: 'bg-emerald-500', sunnah: 'bg-amber-500',
                  remembrance: 'bg-purple-500', historical: 'bg-blue-500',
                };
                return (
                  <Badge key={type} variant="outline" className={cn("text-xs capitalize", colors[type])}>
                    <span className={cn("w-2 h-2 rounded-full mr-1", dotColors[type])} />
                    {type}
                  </Badge>
                );
              })}
            </div>

            <h3 className="font-medium">Upcoming Events</h3>
            <div className="space-y-3">
              {upcomingEvents.map((event, idx) => {
                const typeColors: Record<string, string> = {
                  major: 'border-l-primary bg-primary/5',
                  fasting: 'border-l-emerald-500 bg-emerald-500/5',
                  sunnah: 'border-l-amber-500 bg-amber-500/5',
                  remembrance: 'border-l-purple-500 bg-purple-500/5',
                  historical: 'border-l-blue-500 bg-blue-500/5',
                };
                const eventType = event.type || 'major';
                return (
                  <GlassCard key={idx} className={cn("p-4 border-l-4", typeColors[eventType])}>
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <p className="font-medium">{event.name}</p>
                        <p className="text-sm text-muted-foreground">{event.description}</p>
                      </div>
                      <div className="text-right shrink-0 ml-2">
                        <Badge variant="outline">{event.hijriDate}</Badge>
                        <p className="text-xs text-muted-foreground mt-1">
                          ~{format(event.date, 'MMM d, yyyy')}
                        </p>
                      </div>
                    </div>
                    {event.actions && event.actions.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-border/50">
                        <p className="text-xs font-medium text-muted-foreground mb-2">📋 What to do:</p>
                        <ul className="text-sm space-y-1">
                          {event.actions.map((action, i) => (
                            <li key={i} className="flex items-start gap-2">
                              <span className="text-primary mt-0.5">•</span>
                              <span>{action}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {event.specialPrayer && (
                      <div className="mt-3 pt-3 border-t border-border/50">
                        <p className="text-xs font-medium text-muted-foreground mb-1">🕌 Special Prayer:</p>
                        <p className="text-sm">{event.specialPrayer}</p>
                      </div>
                    )}
                    {event.dua && (
                      <div className="mt-3 pt-3 border-t border-border/50 bg-muted/30 -mx-4 -mb-4 p-4 rounded-b-lg">
                        <p className="text-xs font-medium text-muted-foreground mb-2">🤲 Recommended Dua:</p>
                        <p className="font-arabic text-lg text-right mb-2" dir="rtl">{event.dua.arabic}</p>
                        <p className="text-sm italic text-muted-foreground mb-1">{event.dua.transliteration}</p>
                        <p className="text-sm">{event.dua.translation}</p>
                      </div>
                    )}
                  </GlassCard>
                );
              })}
            </div>
          </div>
        </ScrollArea>
      </div>
    );
  }

  // Menu view
  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="show"
      className="p-3 md:p-4 space-y-3"
    >
      <motion.div variants={staggerItem}>
        <GlassCard pressable haptic="light" onClick={() => setSubView('qibla')} className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
              <Compass className="w-5 h-5 text-emerald-500" />
            </div>
            <div>
              <p className="font-medium">Qibla Compass</p>
              <p className="text-xs text-muted-foreground">Find the direction of Mecca</p>
            </div>
          </div>
        </GlassCard>
      </motion.div>

      <motion.div variants={staggerItem}>
        <GlassCard pressable haptic="light" onClick={() => setSubView('hadith')} className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="font-medium">Hadith Collection</p>
              <p className="text-xs text-muted-foreground">Browse & favorite authentic hadiths</p>
            </div>
          </div>
        </GlassCard>
      </motion.div>

      <motion.div variants={staggerItem}>
        <GlassCard pressable haptic="light" onClick={() => setSubView('calendar')} className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-amber-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium">Islamic Calendar</p>
              <p className="text-xs text-muted-foreground truncate">
                {nextEvent ? `Next: ${nextEvent.name} (${differenceInDays(nextEvent.date, new Date())}d)` : 'View upcoming events'}
              </p>
            </div>
          </div>
        </GlassCard>
      </motion.div>
    </motion.div>
  );
}
