import { useState, useEffect, useCallback, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Clock, MapPin, RefreshCw, Bell, BellOff, Sun, Sunrise, Sunset, Moon as MoonIcon, Check, Volume2, ExternalLink, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

interface PrayerTime {
  name: string;
  time: string;
  arabicName: string;
  icon: React.ReactNode;
}

interface CalculationMethod {
  id: number;
  name: string;
  description: string;
}

interface PrayerNotificationSettings {
  enabled: boolean;
  prayers: Record<string, boolean>;
  minutesBefore: number;
  adhanEnabled: boolean;
  adhanStyle: 'makkah' | 'madinah' | 'alaqsa';
  adhanVolume: number;
}

// Adhan audio URLs - using Islamcan.com free Adhan audio
const ADHAN_AUDIO_URLS: Record<string, string> = {
  makkah: 'https://www.islamcan.com/audio/adhan/azan1.mp3',
  madinah: 'https://www.islamcan.com/audio/adhan/azan2.mp3',
  alaqsa: 'https://www.islamcan.com/audio/adhan/azan8.mp3',
};

const CALCULATION_METHODS: CalculationMethod[] = [
  { id: 2, name: 'ISNA', description: 'Islamic Society of North America' },
  { id: 3, name: 'MWL', description: 'Muslim World League' },
  { id: 5, name: 'Egyptian', description: 'Egyptian General Authority' },
  { id: 4, name: 'Umm Al-Qura', description: 'Umm Al-Qura University, Mecca' },
  { id: 8, name: 'Dubai', description: 'Gulf Region' },
  { id: 1, name: 'Karachi', description: 'University of Islamic Sciences, Karachi' },
  { id: 9, name: 'Kuwait', description: 'Kuwait' },
  { id: 10, name: 'Qatar', description: 'Qatar' },
  { id: 11, name: 'Singapore', description: 'Majlis Ugama Islam Singapura' },
  { id: 12, name: 'France', description: 'Union Organization Islamic de France' },
  { id: 13, name: 'Turkey', description: 'Diyanet İşleri Başkanlığı, Turkey' },
];

const DEFAULT_NOTIFICATION_SETTINGS: PrayerNotificationSettings = {
  enabled: false,
  prayers: { Fajr: true, Dhuhr: true, Asr: true, Maghrib: true, Isha: true },
  minutesBefore: 5,
  adhanEnabled: false,
  adhanStyle: 'makkah',
  adhanVolume: 70,
};

// Check if we're in a context where notifications are supported
const checkNotificationSupport = (): { supported: boolean; reason?: string } => {
  const isNative = Capacitor.isNativePlatform();
  
  // Native apps always support notifications via Capacitor
  if (isNative) {
    return { supported: true };
  }
  
  // Check if running in an iframe (e.g., Lovable preview)
  try {
    if (window.self !== window.top) {
      return { 
        supported: false, 
        reason: 'Notifications require opening the app in a new tab. The preview window has limited permissions.' 
      };
    }
  } catch (e) {
    // Cross-origin iframe check failed - we're in an iframe
    return { 
      supported: false, 
      reason: 'Notifications require opening the app in a new tab.' 
    };
  }
  
  // Check if Notification API exists
  if (!('Notification' in window)) {
    // Check for iOS Safari/PWA limitations
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    
    if (isIOS) {
      return { 
        supported: false, 
        reason: 'iOS requires installing this app as a PWA (Add to Home Screen) or native app for notifications.' 
      };
    }
    
    return { 
      supported: false, 
      reason: 'Your browser does not support notifications.' 
    };
  }
  
  return { supported: true };
};

interface PrayerTimesTabProps {
  onPrayerUpdate?: (name: string, time: string, countdown: string) => void;
}

export function PrayerTimesTab({ onPrayerUpdate }: PrayerTimesTabProps = {}) {
  const [prayerTimes, setPrayerTimes] = useState<PrayerTime[]>([]);
  const [loading, setLoading] = useState(false);
  const [locationName, setLocationName] = useState<string>('');
  const [calculationMethod, setCalculationMethod] = useState<number>(() => {
    const saved = localStorage.getItem('prayer-calculation-method');
    return saved ? parseInt(saved) : 2; // Default to ISNA
  });
  const [countdown, setCountdown] = useState<string>('');
  const [nextPrayerName, setNextPrayerName] = useState<string>('');
  const [hijriDate, setHijriDate] = useState<string>('');
  const [gregorianDate, setGregorianDate] = useState<string>('');
  const [coordinates, setCoordinates] = useState<{ lat: number; lng: number } | null>(null);
  const [notificationSettings, setNotificationSettings] = useState<PrayerNotificationSettings>(() => {
    const saved = localStorage.getItem('prayer-notifications');
    if (saved) {
      const parsed = JSON.parse(saved);
      return { ...DEFAULT_NOTIFICATION_SETTINGS, ...parsed };
    }
    return DEFAULT_NOTIFICATION_SETTINGS;
  });
  const [showNotificationSettings, setShowNotificationSettings] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');
  const [notificationSupport, setNotificationSupport] = useState<{ supported: boolean; reason?: string }>({ supported: true });
  const adhanAudioRef = useRef<HTMLAudioElement | null>(null);
  const isNative = Capacitor.isNativePlatform();

  // Check notification support and permission on mount
  useEffect(() => {
    const support = checkNotificationSupport();
    setNotificationSupport(support);
    
    if (isNative) {
      // Check Capacitor local notification permission
      LocalNotifications.checkPermissions().then(result => {
        if (result.display === 'granted') {
          setNotificationPermission('granted');
        } else if (result.display === 'denied') {
          setNotificationPermission('denied');
        } else {
          setNotificationPermission('default');
        }
      });
    } else if ('Notification' in window) {
      setNotificationPermission(Notification.permission);
    }
  }, [isNative]);

  // Save notification settings
  useEffect(() => {
    localStorage.setItem('prayer-notifications', JSON.stringify(notificationSettings));
  }, [notificationSettings]);

  // Request notification permission
  const requestNotificationPermission = async () => {
    const support = checkNotificationSupport();
    
    if (!support.supported) {
      toast.error(support.reason || 'Notifications not supported');
      return;
    }
    
    if (isNative) {
      // Use Capacitor for native apps
      const result = await LocalNotifications.requestPermissions();
      if (result.display === 'granted') {
        setNotificationPermission('granted');
        toast.success('Prayer notifications enabled!');
        setNotificationSettings(prev => ({ ...prev, enabled: true }));
      } else {
        setNotificationPermission('denied');
        toast.error('Notification permission denied');
      }
    } else {
      // Use browser API
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      
      if (permission === 'granted') {
        toast.success('Prayer notifications enabled!');
        setNotificationSettings(prev => ({ ...prev, enabled: true }));
      } else if (permission === 'denied') {
        toast.error('Notification permission denied');
      }
    }
  };

  // Play Adhan audio
  const playAdhan = useCallback((prayerName: string) => {
    if (!notificationSettings.adhanEnabled) return;
    
    // Stop any existing audio
    if (adhanAudioRef.current) {
      adhanAudioRef.current.pause();
      adhanAudioRef.current = null;
    }
    
    const adhanUrl = ADHAN_AUDIO_URLS[notificationSettings.adhanStyle];
    const audio = new Audio(adhanUrl);
    audio.volume = notificationSettings.adhanVolume / 100;
    adhanAudioRef.current = audio;
    
    audio.play().catch(error => {
      console.error('Failed to play Adhan:', error);
      // Fallback toast notification
      toast.info(`🕌 It's time for ${prayerName} prayer`);
    });
    
    audio.onended = () => {
      adhanAudioRef.current = null;
    };
  }, [notificationSettings.adhanEnabled, notificationSettings.adhanStyle, notificationSettings.adhanVolume]);

  // Stop Adhan
  const stopAdhan = useCallback(() => {
    if (adhanAudioRef.current) {
      adhanAudioRef.current.pause();
      adhanAudioRef.current = null;
    }
  }, []);

  // Listen for prayer notifications received in foreground (native) to trigger Adhan
  useEffect(() => {
    if (!isNative || !notificationSettings.adhanEnabled) return;

    const handleNotificationReceived = LocalNotifications.addListener(
      'localNotificationReceived',
      (notification) => {
        // Check if this is a prayer notification (contains "Prayer" in title)
        if (notification.title?.includes('Prayer') && !notification.title?.includes('in')) {
          // This is a "prayer time now" notification, play Adhan
          const prayerName = notification.title.replace(' Prayer', '');
          playAdhan(prayerName);
        }
      }
    );

    return () => {
      handleNotificationReceived.then(listener => listener.remove());
    };
  }, [isNative, notificationSettings.adhanEnabled, playAdhan]);

  // Schedule notifications for prayers with Adhan support
  useEffect(() => {
    if (!notificationSettings.enabled || notificationPermission !== 'granted' || prayerTimes.length === 0) {
      return;
    }

    // For native platforms, we need to also set up timers to play Adhan
    // since LocalNotifications can't play custom audio files from URLs
    const adhanTimers: NodeJS.Timeout[] = [];

    const scheduleNativeNotificationWithAdhan = async (prayer: PrayerTime, minutesBefore: number) => {
      const [hours, minutes] = prayer.time.split(':').map(Number);
      const now = new Date();
      const prayerTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes);
      const notifyTime = new Date(prayerTime.getTime() - minutesBefore * 60 * 1000);
      
      const timeUntilNotification = notifyTime.getTime() - now.getTime();
      
      if (timeUntilNotification > 0 && timeUntilNotification < 24 * 60 * 60 * 1000) {
        // Generate unique ID for this notification
        const notificationId = Date.now() + Math.floor(Math.random() * 1000);
        
        await LocalNotifications.schedule({
          notifications: [{
            id: notificationId,
            title: `${prayer.name} Prayer`,
            body: minutesBefore > 0 
              ? `${prayer.name} (${prayer.arabicName}) prayer time in ${minutesBefore} minutes at ${prayer.time}`
              : `It's time for ${prayer.name} (${prayer.arabicName}) prayer`,
            schedule: { at: notifyTime },
            sound: 'default',
            smallIcon: 'ic_stat_prayer',
            largeIcon: 'ic_launcher',
          }]
        });

        // Also schedule Adhan to play at prayer time (minutesBefore === 0)
        // This works even when app is in foreground
        if (minutesBefore === 0 && notificationSettings.adhanEnabled) {
          const adhanTimer = setTimeout(() => {
            playAdhan(prayer.name);
          }, timeUntilNotification);
          adhanTimers.push(adhanTimer);
        }
        
        return notificationId;
      }
      return null;
    };

    const scheduleBrowserNotification = (prayer: PrayerTime, minutesBefore: number) => {
      const [hours, minutes] = prayer.time.split(':').map(Number);
      const now = new Date();
      const prayerTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes);
      const notifyTime = new Date(prayerTime.getTime() - minutesBefore * 60 * 1000);
      
      const timeUntilNotification = notifyTime.getTime() - now.getTime();
      
      if (timeUntilNotification > 0 && timeUntilNotification < 24 * 60 * 60 * 1000) {
        return setTimeout(() => {
          // Show browser notification
          new Notification(`${prayer.name} Prayer`, {
            body: minutesBefore > 0 
              ? `${prayer.name} (${prayer.arabicName}) prayer time in ${minutesBefore} minutes at ${prayer.time}`
              : `It's time for ${prayer.name} (${prayer.arabicName}) prayer`,
            icon: '/icons/icon-192.png',
            tag: `prayer-${prayer.name}`,
          });
          
          // Play Adhan if enabled and it's prayer time (not a reminder before)
          if (minutesBefore === 0 && notificationSettings.adhanEnabled) {
            playAdhan(prayer.name);
          }
        }, timeUntilNotification);
      }
      return null;
    };

    const timeouts: (NodeJS.Timeout | null)[] = [];
    const scheduledNativeIds: number[] = [];
    
    prayerTimes.forEach(prayer => {
      if (prayer.name !== 'Sunrise' && notificationSettings.prayers[prayer.name]) {
        if (isNative) {
          // Use Capacitor LocalNotifications for native apps with Adhan support
          if (notificationSettings.minutesBefore > 0) {
            scheduleNativeNotificationWithAdhan(prayer, notificationSettings.minutesBefore);
          }
          scheduleNativeNotificationWithAdhan(prayer, 0);
        } else {
          // Use browser notifications for web
          if (notificationSettings.minutesBefore > 0) {
            const reminderTimeout = scheduleBrowserNotification(prayer, notificationSettings.minutesBefore);
            if (reminderTimeout) timeouts.push(reminderTimeout);
          }
          const prayerTimeout = scheduleBrowserNotification(prayer, 0);
          if (prayerTimeout) timeouts.push(prayerTimeout);
        }
      }
    });

    return () => {
      timeouts.forEach(t => t && clearTimeout(t));
      adhanTimers.forEach(t => clearTimeout(t));
      // Cancel native notifications when component unmounts or settings change
      if (isNative && scheduledNativeIds.length > 0) {
        LocalNotifications.cancel({ notifications: scheduledNativeIds.map(id => ({ id })) });
      }
      stopAdhan();
    };
  }, [prayerTimes, notificationSettings, notificationPermission, playAdhan, stopAdhan, isNative]);

  const getPrayerIcon = (name: string) => {
    switch (name) {
      case 'Fajr': return <Sunrise className="w-5 h-5 text-indigo-500" />;
      case 'Sunrise': return <Sun className="w-5 h-5 text-yellow-500" />;
      case 'Dhuhr': return <Sun className="w-5 h-5 text-orange-500" />;
      case 'Asr': return <Sun className="w-5 h-5 text-amber-600" />;
      case 'Maghrib': return <Sunset className="w-5 h-5 text-rose-500" />;
      case 'Isha': return <MoonIcon className="w-5 h-5 text-purple-500" />;
      default: return <Clock className="w-5 h-5" />;
    }
  };

  const reverseGeocode = useCallback(async (lat: number, lng: number) => {
    try {
      // Use OpenStreetMap Nominatim for reverse geocoding (free, no API key needed)
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=10`,
        { 
          signal: AbortSignal.timeout(5000),
          headers: { 'Accept-Language': 'en' }
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        // Get city, town, village, or municipality - whatever is available
        const city = data.address?.city || 
                     data.address?.town || 
                     data.address?.village || 
                     data.address?.municipality ||
                     data.address?.county ||
                     data.address?.state;
        if (city) {
          setLocationName(city);
          return;
        }
      }
    } catch (error) {
      console.error('Reverse geocoding failed:', error);
    }
    // Fallback to timezone if reverse geocoding fails
    setLocationName('');
  }, []);

  const fetchPrayerTimes = useCallback(async (lat: number, lng: number, method: number) => {
    setLoading(true);
    try {
      const date = new Date();
      const dateStr = `${date.getDate()}-${date.getMonth() + 1}-${date.getFullYear()}`;
      
      const response = await fetch(
        `https://api.aladhan.com/v1/timings/${dateStr}?latitude=${lat}&longitude=${lng}&method=${method}`,
        { signal: AbortSignal.timeout(10000) }
      );
      
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const data = await response.json();
      
      if (data.code === 200) {
        const timings = data.data.timings;
        setPrayerTimes([
          { name: 'Fajr', arabicName: 'الفجر', time: timings.Fajr, icon: getPrayerIcon('Fajr') },
          { name: 'Sunrise', arabicName: 'الشروق', time: timings.Sunrise, icon: getPrayerIcon('Sunrise') },
          { name: 'Dhuhr', arabicName: 'الظهر', time: timings.Dhuhr, icon: getPrayerIcon('Dhuhr') },
          { name: 'Asr', arabicName: 'العصر', time: timings.Asr, icon: getPrayerIcon('Asr') },
          { name: 'Maghrib', arabicName: 'المغرب', time: timings.Maghrib, icon: getPrayerIcon('Maghrib') },
          { name: 'Isha', arabicName: 'العشاء', time: timings.Isha, icon: getPrayerIcon('Isha') },
        ]);
        
        // Set Hijri date
        const hijri = data.data.date.hijri;
        setHijriDate(`${hijri.day} ${hijri.month.en} ${hijri.year}`);
        
        // Set Gregorian date
        const gregorian = data.data.date.gregorian;
        setGregorianDate(`${gregorian.weekday.en}, ${gregorian.day} ${gregorian.month.en} ${gregorian.year}`);
      }
    } catch (error) {
      console.error('Failed to fetch prayer times:', error);
      toast.error('Failed to load prayer times');
    } finally {
      setLoading(false);
    }
  }, []);

  const getLocation = useCallback(() => {
    setLoading(true);
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setCoordinates({ lat: latitude, lng: longitude });
          // Fetch prayer times and reverse geocode in parallel
          fetchPrayerTimes(latitude, longitude, calculationMethod);
          reverseGeocode(latitude, longitude);
        },
        (error) => {
          console.error('Location error:', error);
          toast.error('Unable to get location. Using default (Mecca)');
          setCoordinates({ lat: 21.4225, lng: 39.8262 });
          setLocationName('Mecca (Default)');
          fetchPrayerTimes(21.4225, 39.8262, calculationMethod);
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    } else {
      toast.error('Geolocation not supported');
      setLoading(false);
    }
  }, [calculationMethod, fetchPrayerTimes, reverseGeocode]);

  const getNextPrayer = useCallback((): { prayer: PrayerTime; minutesRemaining: number } | null => {
    if (prayerTimes.length === 0) return null;
    
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    
    for (const prayer of prayerTimes) {
      if (prayer.name === 'Sunrise') continue;
      const [hours, minutes] = prayer.time.split(':').map(Number);
      const prayerMinutes = hours * 60 + minutes;
      if (prayerMinutes > currentMinutes) {
        return { prayer, minutesRemaining: prayerMinutes - currentMinutes };
      }
    }
    
    // If all prayers have passed, next prayer is Fajr tomorrow
    const fajr = prayerTimes.find(p => p.name === 'Fajr');
    if (fajr) {
      const [hours, minutes] = fajr.time.split(':').map(Number);
      const fajrMinutes = hours * 60 + minutes;
      const minutesRemaining = (24 * 60 - currentMinutes) + fajrMinutes;
      return { prayer: fajr, minutesRemaining };
    }
    
    return null;
  }, [prayerTimes]);

  // Update countdown every second
  useEffect(() => {
    const updateCountdown = () => {
      const next = getNextPrayer();
      if (next) {
        const hours = Math.floor(next.minutesRemaining / 60);
        const mins = next.minutesRemaining % 60;
        setCountdown(hours > 0 ? `${hours}h ${mins}m` : `${mins}m`);
        setNextPrayerName(next.prayer.name);
      }
    };
    
    updateCountdown();
    const interval = setInterval(updateCountdown, 60000); // Update every minute
    return () => clearInterval(interval);
  }, [getNextPrayer]);

  // Initial load and method change
  useEffect(() => {
    if (coordinates) {
      fetchPrayerTimes(coordinates.lat, coordinates.lng, calculationMethod);
    } else {
      getLocation();
    }
  }, [calculationMethod]);

  // Save method preference
  const handleMethodChange = (value: string) => {
    const method = parseInt(value);
    setCalculationMethod(method);
    localStorage.setItem('prayer-calculation-method', value);
    if (coordinates) {
      fetchPrayerTimes(coordinates.lat, coordinates.lng, method);
    }
  };

  const currentMethod = CALCULATION_METHODS.find(m => m.id === calculationMethod);

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-4">
        {/* Header with dates */}
        <div className="text-center space-y-1">
          <p className="text-sm text-muted-foreground">{gregorianDate}</p>
          <p className="font-arabic text-lg font-medium">{hijriDate}</p>
        </div>

        {/* Next Prayer Countdown */}
        {nextPrayerName && countdown && (
          <Card className="p-6 bg-gradient-to-br from-primary/20 via-primary/10 to-background border-primary/30">
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-1">Next Prayer</p>
              <h3 className="text-2xl font-bold text-primary">{nextPrayerName}</h3>
              <div className="flex items-center justify-center gap-2 mt-2">
                <Clock className="w-5 h-5 text-primary" />
                <span className="text-3xl font-bold">{countdown}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-2">until {nextPrayerName}</p>
            </div>
          </Card>
        )}

        {/* Location and Method */}
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1 flex-1 justify-center py-1.5">
            <MapPin className="w-3 h-3" />
            {locationName || 'Loading...'}
          </Badge>
          <Button 
            variant="outline" 
            size="icon" 
            onClick={getLocation} 
            disabled={loading}
          >
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
          </Button>
        </div>

        {/* Calculation Method Selector */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Calculation Method</label>
          <Select value={calculationMethod.toString()} onValueChange={handleMethodChange}>
            <SelectTrigger>
              <SelectValue placeholder="Select method" />
            </SelectTrigger>
            <SelectContent>
              {CALCULATION_METHODS.map((method) => (
                <SelectItem key={method.id} value={method.id.toString()}>
                  <div className="flex flex-col">
                    <span className="font-medium">{method.name}</span>
                    <span className="text-xs text-muted-foreground">{method.description}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {currentMethod && (
            <p className="text-xs text-muted-foreground">{currentMethod.description}</p>
          )}
        </div>

        {/* Prayer Notifications */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              {notificationSettings.enabled && notificationPermission === 'granted' ? (
                <Bell className="w-4 h-4 text-primary" />
              ) : (
                <BellOff className="w-4 h-4 text-muted-foreground" />
              )}
              <span className="font-medium text-sm">Prayer Notifications</span>
            </div>
            {!notificationSupport.supported ? (
              <Badge variant="secondary" className="text-xs">
                Limited
              </Badge>
            ) : notificationPermission !== 'granted' ? (
              <Button size="sm" variant="outline" onClick={requestNotificationPermission}>
                Enable
              </Button>
            ) : (
              <Switch
                checked={notificationSettings.enabled}
                onCheckedChange={(checked) => 
                  setNotificationSettings(prev => ({ ...prev, enabled: checked }))
                }
              />
            )}
          </div>
          
          {/* Show guidance if notifications aren't supported in current context */}
          {!notificationSupport.supported && notificationSupport.reason && (
            <div className="mb-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                <div className="space-y-2">
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    {notificationSupport.reason}
                  </p>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="h-7 text-xs gap-1"
                    onClick={() => {
                      window.open(window.location.href, '_blank');
                    }}
                  >
                    <ExternalLink className="w-3 h-3" />
                    Open in New Tab
                  </Button>
                </div>
              </div>
            </div>
          )}
          
          {notificationSettings.enabled && notificationPermission === 'granted' && (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-between text-xs h-8 mb-2"
                onClick={() => setShowNotificationSettings(!showNotificationSettings)}
              >
                <span>Configure prayers</span>
                <Badge variant="secondary" className="text-xs">
                  {Object.values(notificationSettings.prayers).filter(Boolean).length}/5
                </Badge>
              </Button>
              
              {showNotificationSettings && (
                <div className="space-y-2 pt-2 border-t">
                  {['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'].map((prayer) => (
                    <div key={prayer} className="flex items-center justify-between">
                      <span className="text-sm">{prayer}</span>
                      <Switch
                        checked={notificationSettings.prayers[prayer] ?? true}
                        onCheckedChange={(checked) =>
                          setNotificationSettings(prev => ({
                            ...prev,
                            prayers: { ...prev.prayers, [prayer]: checked }
                          }))
                        }
                      />
                    </div>
                  ))}
                  <div className="flex items-center justify-between pt-2 border-t">
                    <span className="text-sm">Notify before</span>
                    <Select
                      value={notificationSettings.minutesBefore.toString()}
                      onValueChange={(val) =>
                        setNotificationSettings(prev => ({ ...prev, minutesBefore: parseInt(val) }))
                      }
                    >
                      <SelectTrigger className="w-24 h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">At time</SelectItem>
                        <SelectItem value="5">5 min</SelectItem>
                        <SelectItem value="10">10 min</SelectItem>
                        <SelectItem value="15">15 min</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {/* Adhan Settings */}
                  <div className="pt-3 mt-3 border-t space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Volume2 className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm font-medium">Play Adhan</span>
                      </div>
                      <Switch
                        checked={notificationSettings.adhanEnabled}
                        onCheckedChange={(checked) =>
                          setNotificationSettings(prev => ({ ...prev, adhanEnabled: checked }))
                        }
                      />
                    </div>
                    
                    {notificationSettings.adhanEnabled && (
                      <>
                        <div className="space-y-2">
                          <span className="text-xs text-muted-foreground">Adhan Style</span>
                          <Select
                            value={notificationSettings.adhanStyle}
                            onValueChange={(val: 'makkah' | 'madinah' | 'alaqsa') =>
                              setNotificationSettings(prev => ({ ...prev, adhanStyle: val }))
                            }
                          >
                            <SelectTrigger className="h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="makkah">Makkah</SelectItem>
                              <SelectItem value="madinah">Madinah</SelectItem>
                              <SelectItem value="alaqsa">Al-Aqsa</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-muted-foreground">Volume</span>
                            <span className="text-xs font-medium">{notificationSettings.adhanVolume}%</span>
                          </div>
                          <Slider
                            value={[notificationSettings.adhanVolume]}
                            onValueChange={([val]) =>
                              setNotificationSettings(prev => ({ ...prev, adhanVolume: val }))
                            }
                            min={10}
                            max={100}
                            step={10}
                          />
                        </div>
                        
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full text-xs"
                          onClick={() => playAdhan('Test')}
                        >
                          <Volume2 className="w-3 h-3 mr-1" />
                          Test Adhan
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </Card>

        {/* Prayer Times List */}
        <Card className="divide-y divide-border">
          {prayerTimes.map((prayer) => {
            const isNext = prayer.name === nextPrayerName;
            const isSunrise = prayer.name === 'Sunrise';
            const hasNotification = notificationSettings.enabled && 
                                   notificationSettings.prayers[prayer.name] && 
                                   notificationPermission === 'granted';
            return (
              <div
                key={prayer.name}
                className={cn(
                  "flex items-center justify-between p-4 transition-colors",
                  isNext && "bg-primary/10",
                  isSunrise && "opacity-60"
                )}
              >
                <div className="flex items-center gap-3">
                  {prayer.icon}
                  <div>
                    <p className={cn("font-medium", isNext && "text-primary")}>{prayer.name}</p>
                    <p className="text-sm font-arabic text-muted-foreground">{prayer.arabicName}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {hasNotification && !isSunrise && (
                    <Bell className="w-3 h-3 text-muted-foreground" />
                  )}
                  <span className={cn("text-lg font-semibold", isNext && "text-primary")}>
                    {prayer.time}
                  </span>
                  {isNext && (
                    <Badge variant="default" className="text-xs">Next</Badge>
                  )}
                </div>
              </div>
            );
          })}
        </Card>

        {/* Ramadan Suhoor/Iftar hint */}
        {prayerTimes.length > 0 && (
          <Card className="p-4 bg-amber-500/10 border-amber-500/30">
            <div className="flex items-start gap-3">
              <Bell className="w-5 h-5 text-amber-500 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-amber-700 dark:text-amber-400">During Ramadan</p>
                <p className="text-muted-foreground">
                  <span className="font-medium">Suhoor ends:</span> {prayerTimes.find(p => p.name === 'Fajr')?.time} • 
                  <span className="font-medium ml-2">Iftar:</span> {prayerTimes.find(p => p.name === 'Maghrib')?.time}
                </p>
              </div>
            </div>
          </Card>
        )}
      </div>
    </ScrollArea>
  );
}
