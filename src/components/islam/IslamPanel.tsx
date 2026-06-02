import { useState, useEffect, useCallback, useRef } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { 
  Compass, BookOpen, Clock, RefreshCw, MapPin, Navigation, 
  ChevronLeft, ChevronRight, Search, Loader2, Volume2,
  Pause, Play, ZoomIn, ZoomOut, Settings
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useTextToSpeech } from '@/hooks/useTextToSpeech';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface PrayerTime {
  name: string;
  time: string;
  arabicName: string;
}

interface QiblaData {
  direction: number;
  latitude: number;
  longitude: number;
}

interface Surah {
  number: number;
  name: string;
  englishName: string;
  englishNameTranslation: string;
  numberOfAyahs: number;
  revelationType: string;
}

interface Ayah {
  number: number;
  text: string;
  numberInSurah: number;
  juz: number;
  page: number;
  audio?: string;
}

interface SurahDetail {
  number: number;
  name: string;
  englishName: string;
  englishNameTranslation: string;
  revelationType: string;
  ayahs: Ayah[];
}

// Check if running on iOS
const isIOS = (): boolean => {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || 
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
};

// Check if running on mobile
const isMobile = (): boolean => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

export function IslamPanel() {
  const [activeTab, setActiveTab] = useState('prayer');
  const [prayerTimes, setPrayerTimes] = useState<PrayerTime[]>([]);
  const [loading, setLoading] = useState(false);
  const [qiblaData, setQiblaData] = useState<QiblaData | null>(null);
  const [deviceHeading, setDeviceHeading] = useState<number | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [locationName, setLocationName] = useState<string>('');
  const [compassPermission, setCompassPermission] = useState<'pending' | 'granted' | 'denied'>('pending');
  
  // Quran state
  const [surahs, setSurahs] = useState<Surah[]>([]);
  const [selectedSurah, setSelectedSurah] = useState<SurahDetail | null>(null);
  const [currentAyahIndex, setCurrentAyahIndex] = useState(0);
  const [quranLoading, setQuranLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSurahList, setShowSurahList] = useState(true);
  const [fontSize, setFontSize] = useState(28);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [currentPlayingAyah, setCurrentPlayingAyah] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const { speak, stop: stopSpeech, isSpeaking } = useTextToSpeech({
    onEnd: () => setCurrentPlayingAyah(null),
    onError: (error) => {
      console.error('TTS Error:', error);
      setCurrentPlayingAyah(null);
    }
  });

  // Calculate approximate prayer times based on location (fallback)
  const calculateApproximatePrayerTimes = (lat: number): PrayerTime[] => {
    const now = new Date();
    const dayOfYear = Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000);
    
    const seasonOffset = Math.sin((dayOfYear - 80) * 2 * Math.PI / 365) * 1.5;
    const latOffset = (lat - 30) * 0.05;
    
    const baseHours = {
      fajr: 5 - seasonOffset + latOffset,
      sunrise: 6.5 - seasonOffset * 0.8 + latOffset,
      dhuhr: 12.25,
      asr: 15.5 + seasonOffset * 0.3,
      maghrib: 18 + seasonOffset + latOffset,
      isha: 19.5 + seasonOffset + latOffset,
    };

    const formatTime = (hours: number): string => {
      const h = Math.floor(hours);
      const m = Math.round((hours - h) * 60);
      return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    };

    return [
      { name: 'Fajr', arabicName: 'الفجر', time: formatTime(baseHours.fajr) },
      { name: 'Sunrise', arabicName: 'الشروق', time: formatTime(baseHours.sunrise) },
      { name: 'Dhuhr', arabicName: 'الظهر', time: formatTime(baseHours.dhuhr) },
      { name: 'Asr', arabicName: 'العصر', time: formatTime(baseHours.asr) },
      { name: 'Maghrib', arabicName: 'المغرب', time: formatTime(baseHours.maghrib) },
      { name: 'Isha', arabicName: 'العشاء', time: formatTime(baseHours.isha) },
    ];
  };

  // Fetch prayer times based on location
  const fetchPrayerTimes = async (lat: number, lng: number) => {
    setLoading(true);
    try {
      const date = new Date();
      const dateStr = `${date.getDate()}-${date.getMonth() + 1}-${date.getFullYear()}`;
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      const response = await fetch(
        `https://api.aladhan.com/v1/timings/${dateStr}?latitude=${lat}&longitude=${lng}&method=2`,
        { signal: controller.signal }
      );
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.code === 200) {
        const timings = data.data.timings;
        setPrayerTimes([
          { name: 'Fajr', arabicName: 'الفجر', time: timings.Fajr },
          { name: 'Sunrise', arabicName: 'الشروق', time: timings.Sunrise },
          { name: 'Dhuhr', arabicName: 'الظهر', time: timings.Dhuhr },
          { name: 'Asr', arabicName: 'العصر', time: timings.Asr },
          { name: 'Maghrib', arabicName: 'المغرب', time: timings.Maghrib },
          { name: 'Isha', arabicName: 'العشاء', time: timings.Isha },
        ]);
        
        // Get location name from timezone data
        if (data.data.meta?.timezone) {
          const tz = data.data.meta.timezone;
          setLocationName(tz.split('/').pop()?.replace(/_/g, ' ') || '');
        }
      } else {
        throw new Error('Invalid API response');
      }
    } catch (error) {
      console.error('Failed to fetch prayer times:', error);
      const approximateTimes = calculateApproximatePrayerTimes(lat);
      setPrayerTimes(approximateTimes);
      setLocationName('Calculated (offline)');
      toast.info('Using approximate prayer times');
    } finally {
      setLoading(false);
    }
  };

  // Calculate Qibla direction
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

  // Request device orientation permission (required for iOS 13+)
  const requestCompassPermission = async () => {
    type DeviceOrientationEventStatic = typeof DeviceOrientationEvent & { requestPermission?: () => Promise<string> };
    if (typeof (DeviceOrientationEvent as DeviceOrientationEventStatic).requestPermission === 'function') {
      try {
        const permission = await (DeviceOrientationEvent as DeviceOrientationEventStatic).requestPermission!();
        if (permission === 'granted') {
          setCompassPermission('granted');
          startCompassListener();
        } else {
          setCompassPermission('denied');
          toast.error('Compass permission denied');
        }
      } catch (error) {
        console.error('Error requesting compass permission:', error);
        setCompassPermission('denied');
      }
    } else {
      // Non-iOS or older browsers - no permission needed
      setCompassPermission('granted');
      startCompassListener();
    }
  };

  // Start listening to compass
  const startCompassListener = () => {
    const handleOrientation = (event: DeviceOrientationEvent) => {
      // iOS uses webkitCompassHeading, Android uses alpha
      type IOSDeviceOrientationEvent = DeviceOrientationEvent & { webkitCompassHeading?: number };
      if (isIOS() && (event as IOSDeviceOrientationEvent).webkitCompassHeading !== undefined) {
        setDeviceHeading((event as IOSDeviceOrientationEvent).webkitCompassHeading!);
      } else if (event.alpha !== null) {
        // For Android, alpha is relative to the device's initial heading
        // We need to invert it for proper compass behavior
        setDeviceHeading(360 - event.alpha);
      }
    };

    window.addEventListener('deviceorientation', handleOrientation, true);
    return () => window.removeEventListener('deviceorientation', handleOrientation, true);
  };

  // Get user location with enhanced options for mobile
  const getLocation = useCallback(() => {
    setLocationError(null);
    setLoading(true);
    
    if ('geolocation' in navigator) {
      const options: PositionOptions = {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0 // Force fresh location on mobile
      };

      // Clear any cached position for mobile
      if (isMobile()) {
        options.maximumAge = 0;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          console.log('Location obtained:', { latitude, longitude });
          fetchPrayerTimes(latitude, longitude);
          const direction = calculateQibla(latitude, longitude);
          setQiblaData({ direction, latitude, longitude });
          toast.success('Location updated');
        },
        (error) => {
          console.error('Location error:', error);
          let errorMessage = 'Unable to get location';
          
          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMessage = isIOS() 
                ? 'Location permission denied. Please go to Settings > Privacy > Location Services and enable location for your browser.'
                : 'Location permission denied. Please enable location access in your browser settings.';
              break;
            case error.POSITION_UNAVAILABLE:
              errorMessage = 'Location unavailable. Please check your GPS settings.';
              break;
            case error.TIMEOUT:
              errorMessage = 'Location request timed out. Please try again.';
              break;
          }
          
          setLocationError(errorMessage);
          setLoading(false);
          // Use default location (Mecca)
          fetchPrayerTimes(21.4225, 39.8262);
          setQiblaData({ direction: 0, latitude: 21.4225, longitude: 39.8262 });
          setLocationName('Mecca (Default)');
        },
        options
      );
    } else {
      setLocationError('Geolocation not supported by your browser');
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Initialize compass on tab change
  useEffect(() => {
    if (activeTab === 'qibla') {
      if (isIOS() && typeof (DeviceOrientationEvent as { requestPermission?: () => Promise<string> }).requestPermission === 'function') {
        // iOS 13+ - need to request permission on user interaction
        setCompassPermission('pending');
      } else {
        // Android/desktop - start listening directly
        const cleanup = startCompassListener();
        setCompassPermission('granted');
        return cleanup;
      }
    }
  }, [activeTab]);

  // Fetch Quran surahs list
  const fetchSurahs = async () => {
    try {
      const response = await fetch('https://api.alquran.cloud/v1/surah');
      const data = await response.json();
      if (data.code === 200) {
        setSurahs(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch surahs:', error);
    }
  };

  // Fetch specific surah with Arabic text and audio
  const fetchSurah = async (surahNumber: number) => {
    setQuranLoading(true);
    try {
      // Fetch with Mishary Al-Afasy recitation audio
      const response = await fetch(`https://api.alquran.cloud/v1/surah/${surahNumber}/ar.alafasy`);
      const data = await response.json();
      if (data.code === 200) {
        setSelectedSurah(data.data);
        setCurrentAyahIndex(0);
        setShowSurahList(false);
      }
    } catch (error) {
      console.error('Failed to fetch surah:', error);
      toast.error('Failed to load surah');
    } finally {
      setQuranLoading(false);
    }
  };

  // Play ayah audio
  const playAyahAudio = (ayah: Ayah) => {
    if (audioRef.current) {
      audioRef.current.pause();
    }

    if (ayah.audio) {
      const audio = new Audio(ayah.audio);
      audioRef.current = audio;
      
      audio.onplay = () => {
        setIsPlayingAudio(true);
        setCurrentPlayingAyah(ayah.numberInSurah);
      };
      
      audio.onended = () => {
        setIsPlayingAudio(false);
        setCurrentPlayingAyah(null);
        // Auto-play next ayah
        const currentIndex = selectedSurah?.ayahs.findIndex(a => a.numberInSurah === ayah.numberInSurah) || 0;
        const nextAyah = selectedSurah?.ayahs[currentIndex + 1];
        if (nextAyah?.audio) {
          playAyahAudio(nextAyah);
        }
      };
      
      audio.onerror = () => {
        setIsPlayingAudio(false);
        setCurrentPlayingAyah(null);
        toast.error('Failed to play audio');
      };
      
      audio.play().catch(console.error);
    } else {
      // Fallback to TTS if no audio URL
      speak(ayah.text);
      setCurrentPlayingAyah(ayah.numberInSurah);
    }
  };

  // Stop audio playback
  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    stopSpeech();
    setIsPlayingAudio(false);
    setCurrentPlayingAyah(null);
  };

  // Play all ayahs on current page
  const playCurrentPage = () => {
    if (currentPageAyahs.length > 0) {
      playAyahAudio(currentPageAyahs[0]);
    }
  };

  useEffect(() => {
    getLocation();
    fetchSurahs();
  }, [getLocation]);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, []);

  // Get next prayer
  const getNextPrayer = (): PrayerTime | null => {
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    
    for (const prayer of prayerTimes) {
      if (prayer.name === 'Sunrise') continue;
      const [hours, minutes] = prayer.time.split(':').map(Number);
      const prayerMinutes = hours * 60 + minutes;
      if (prayerMinutes > currentMinutes) {
        return prayer;
      }
    }
    return prayerTimes[0];
  };

  const nextPrayer = getNextPrayer();

  // Calculate compass rotation for Qibla
  const getQiblaRotation = (): number => {
    if (!qiblaData) return 0;
    if (deviceHeading !== null) {
      return qiblaData.direction - deviceHeading;
    }
    return qiblaData.direction;
  };

  // Filter surahs by search
  const filteredSurahs = surahs.filter(surah => 
    surah.englishName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    surah.name.includes(searchQuery) ||
    surah.number.toString() === searchQuery
  );

  // Pagination
  const AYAHS_PER_PAGE = 10;
  const totalPages = selectedSurah ? Math.ceil(selectedSurah.ayahs.length / AYAHS_PER_PAGE) : 0;
  const currentPage = Math.floor(currentAyahIndex / AYAHS_PER_PAGE);
  const currentPageAyahs = selectedSurah?.ayahs.slice(
    currentPage * AYAHS_PER_PAGE,
    (currentPage + 1) * AYAHS_PER_PAGE
  ) || [];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <span className="text-xl">☪️</span>
            Islam
          </h2>
          <div className="flex items-center gap-2">
            {locationName && (
              <Badge variant="outline" className="gap-1">
                <MapPin className="w-3 h-3" />
                {locationName}
              </Badge>
            )}
            <Button variant="ghost" size="icon" onClick={getLocation} disabled={loading}>
              <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
            </Button>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <TabsList className="mx-4 mt-3">
          <TabsTrigger value="prayer" className="flex-1 gap-1">
            <Clock className="w-4 h-4" />
            Prayer
          </TabsTrigger>
          <TabsTrigger value="qibla" className="flex-1 gap-1">
            <Compass className="w-4 h-4" />
            Qibla
          </TabsTrigger>
          <TabsTrigger value="quran" className="flex-1 gap-1">
            <BookOpen className="w-4 h-4" />
            Quran
          </TabsTrigger>
        </TabsList>

        {/* Prayer Times Tab */}
        <TabsContent value="prayer" className="flex-1 mt-0">
          <ScrollArea className="h-full">
            <div className="p-4 space-y-4">
              {/* Next Prayer Card */}
              {nextPrayer && (
                <Card className="p-4 bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border-emerald-500/30">
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground mb-1">Next Prayer</p>
                    <h3 className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{nextPrayer.name}</h3>
                    <p className="text-3xl font-semibold mt-2">{nextPrayer.time}</p>
                    <p className="text-lg text-muted-foreground mt-1 font-arabic">{nextPrayer.arabicName}</p>
                  </div>
                </Card>
              )}

              {/* Prayer Times List */}
              {loading && prayerTimes.length === 0 ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="space-y-2">
                  {prayerTimes.map((prayer) => {
                    const isNext = nextPrayer?.name === prayer.name;
                    return (
                      <Card 
                        key={prayer.name}
                        className={cn(
                          "p-3 flex items-center justify-between transition-all",
                          isNext && "border-emerald-500/50 bg-emerald-500/10 shadow-sm"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-10 h-10 rounded-full flex items-center justify-center",
                            isNext ? "bg-emerald-500/20" : "bg-muted"
                          )}>
                            <Clock className={cn(
                              "w-5 h-5",
                              isNext ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"
                            )} />
                          </div>
                          <div>
                            <p className={cn("font-medium", isNext && "text-emerald-600 dark:text-emerald-400")}>
                              {prayer.name}
                            </p>
                            <p className="text-sm text-muted-foreground font-arabic">{prayer.arabicName}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={cn("text-lg font-semibold", isNext && "text-emerald-600 dark:text-emerald-400")}>
                            {prayer.time}
                          </p>
                          {isNext && <Badge className="bg-emerald-500 text-xs">Next</Badge>}
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}

              {locationError && (
                <Card className="p-4 border-amber-500/30 bg-amber-500/10">
                  <div className="text-center">
                    <MapPin className="w-8 h-8 mx-auto mb-2 text-amber-500" />
                    <p className="text-sm text-muted-foreground mb-3">{locationError}</p>
                    <Button variant="outline" size="sm" onClick={getLocation}>
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Retry Location
                    </Button>
                  </div>
                </Card>
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        {/* Qibla Tab */}
        <TabsContent value="qibla" className="flex-1 mt-0">
          <div className="p-4 flex flex-col items-center justify-center h-full">
            <Card className="p-6 w-full max-w-sm">
              {/* Compass Header */}
              <div className="text-center mb-4">
                <h3 className="text-lg font-semibold mb-1">Qibla Direction</h3>
                {qiblaData ? (
                  <p className="text-sm text-muted-foreground">
                    {Math.round(qiblaData.direction)}° from North
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">Calculating...</p>
                )}
              </div>

              {/* Request permission button for iOS */}
              {compassPermission === 'pending' && isIOS() && (
                <Button 
                  className="w-full mb-4" 
                  onClick={requestCompassPermission}
                >
                  <Compass className="w-4 h-4 mr-2" />
                  Enable Compass
                </Button>
              )}

              {/* Enhanced Compass Design */}
              <div className="relative w-64 h-64 mx-auto">
                {/* Outer decorative ring */}
                <div className="absolute inset-0 rounded-full bg-gradient-to-br from-amber-500/20 to-orange-500/20" />
                
                {/* Main compass ring */}
                <div className="absolute inset-2 rounded-full border-4 border-amber-500/40 shadow-inner">
                  {/* Degree markings */}
                  {Array.from({ length: 72 }).map((_, i) => {
                    const angle = i * 5;
                    const isCardinal = angle % 90 === 0;
                    const isMajor = angle % 30 === 0;
                    return (
                      <div
                        key={i}
                        className={cn(
                          "absolute left-1/2 origin-bottom",
                          isCardinal ? "h-3 w-0.5 bg-amber-500" : 
                          isMajor ? "h-2 w-0.5 bg-amber-500/60" : 
                          "h-1.5 w-px bg-muted-foreground/30"
                        )}
                        style={{
                          top: '8px',
                          transform: `translateX(-50%) rotate(${angle}deg)`,
                          transformOrigin: `50% ${(256 - 16) / 2 - 8}px`
                        }}
                      />
                    );
                  })}
                </div>

                {/* Inner compass face */}
                <div className="absolute inset-8 rounded-full bg-background border-2 border-muted shadow-lg">
                  {/* Cardinal directions */}
                  <div className="absolute top-2 left-1/2 -translate-x-1/2 text-lg font-bold text-red-500">N</div>
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-lg font-bold text-muted-foreground">S</div>
                  <div className="absolute left-2 top-1/2 -translate-y-1/2 text-lg font-bold text-muted-foreground">W</div>
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 text-lg font-bold text-muted-foreground">E</div>
                  
                  {/* Intercardinal directions */}
                  <div className="absolute top-6 right-6 text-xs text-muted-foreground/70">NE</div>
                  <div className="absolute bottom-6 right-6 text-xs text-muted-foreground/70">SE</div>
                  <div className="absolute bottom-6 left-6 text-xs text-muted-foreground/70">SW</div>
                  <div className="absolute top-6 left-6 text-xs text-muted-foreground/70">NW</div>
                </div>

                {/* Qibla direction indicator */}
                <div 
                  className="absolute inset-10 flex items-center justify-center transition-transform duration-300 ease-out"
                  style={{ transform: `rotate(${getQiblaRotation()}deg)` }}
                >
                  <div className="relative w-full h-full">
                    {/* Arrow shaft */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-24 bg-gradient-to-t from-transparent via-amber-500 to-amber-600 rounded-full" />
                    
                    {/* Arrow head - Kaaba indicator */}
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 flex flex-col items-center">
                      <Navigation className="w-8 h-8 text-amber-600 fill-amber-500 drop-shadow-lg" />
                      <span className="text-lg mt-1">🕋</span>
                    </div>
                    
                    {/* Arrow tail */}
                    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-amber-500/50" />
                  </div>
                </div>

                {/* Center point */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 shadow-lg border-2 border-white/30" />
              </div>

              {/* Status */}
              <div className="text-center mt-6 space-y-2">
                <div className="flex items-center justify-center gap-2">
                  <span className="font-semibold">Kaaba, Mecca</span>
                </div>
                {deviceHeading !== null ? (
                  <div className="flex items-center justify-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    Live compass active
                  </div>
                ) : compassPermission === 'denied' ? (
                  <p className="text-xs text-amber-500">
                    Compass permission denied
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {isMobile() ? 'Hold device flat and point direction' : 'Static direction shown'}
                  </p>
                )}
              </div>

              {/* Location info */}
              {qiblaData && (
                <div className="mt-4 pt-4 border-t border-border text-center">
                  <p className="text-xs text-muted-foreground">
                    Your location: {qiblaData.latitude.toFixed(4)}°, {qiblaData.longitude.toFixed(4)}°
                  </p>
                </div>
              )}
            </Card>
          </div>
        </TabsContent>

        {/* Quran Tab */}
        <TabsContent value="quran" className="flex-1 mt-0 overflow-hidden">
          {showSurahList ? (
            /* Surah List View */
            <div className="flex flex-col h-full">
              {/* Search */}
              <div className="p-4 pb-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search surah..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              <ScrollArea className="flex-1">
                <div className="p-4 pt-2 space-y-1">
                  {filteredSurahs.map((surah) => (
                    <Card
                      key={surah.number}
                      className="p-3 cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => fetchSurah(surah.number)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center font-semibold text-emerald-600 dark:text-emerald-400">
                          {surah.number}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className="font-medium">{surah.englishName}</p>
                            <p className="font-arabic text-lg text-right">{surah.name}</p>
                          </div>
                          <div className="flex items-center justify-between text-sm text-muted-foreground">
                            <span>{surah.englishNameTranslation}</span>
                            <span>{surah.numberOfAyahs} verses</span>
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </div>
          ) : (
            /* Surah Reading View */
            <div className="flex flex-col h-full">
              {/* Reading Header */}
              <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-2">
                <Button variant="ghost" size="sm" onClick={() => { setShowSurahList(true); stopAudio(); }}>
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Back
                </Button>
                
                {selectedSurah && (
                  <div className="text-center flex-1 min-w-0">
                    <p className="font-semibold truncate">{selectedSurah.englishName}</p>
                  </div>
                )}
                
                <div className="flex items-center gap-1">
                  {/* Play/Stop Audio */}
                  {isPlayingAudio || isSpeaking ? (
                    <Button variant="ghost" size="icon" onClick={stopAudio}>
                      <Pause className="w-4 h-4" />
                    </Button>
                  ) : (
                    <Button variant="ghost" size="icon" onClick={playCurrentPage}>
                      <Play className="w-4 h-4" />
                    </Button>
                  )}
                  
                  {/* Settings Popover */}
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <Settings className="w-4 h-4" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-64" align="end">
                      <div className="space-y-4">
                        <div>
                          <label className="text-sm font-medium mb-2 block">
                            Text Size: {fontSize}px
                          </label>
                          <div className="flex items-center gap-2">
                            <ZoomOut className="w-4 h-4 text-muted-foreground" />
                            <Slider
                              value={[fontSize]}
                              onValueChange={(v) => setFontSize(v[0])}
                              min={18}
                              max={48}
                              step={2}
                              className="flex-1"
                            />
                            <ZoomIn className="w-4 h-4 text-muted-foreground" />
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Tap any verse to play its recitation
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {quranLoading ? (
                <div className="flex-1 flex items-center justify-center">
                  <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
                </div>
              ) : (
                <>
                  {/* Quran Content */}
                  <ScrollArea className="flex-1">
                    <div className="p-6">
                      {/* Surah Name Header */}
                      {currentPage === 0 && selectedSurah && (
                        <div className="text-center mb-8">
                          <div className="inline-block px-8 py-4 rounded-lg bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border border-emerald-500/20">
                            <p className="text-3xl font-arabic mb-2">{selectedSurah.name}</p>
                            <p className="text-sm text-muted-foreground">{selectedSurah.revelationType} • {selectedSurah.ayahs.length} verses</p>
                          </div>
                          {/* Bismillah for surahs other than At-Tawbah */}
                          {selectedSurah.number !== 9 && selectedSurah.number !== 1 && (
                            <p 
                              className="font-arabic mt-6 text-emerald-600 dark:text-emerald-400"
                              style={{ fontSize: fontSize }}
                            >
                              بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
                            </p>
                          )}
                        </div>
                      )}

                      {/* Ayahs */}
                      <div className="space-y-6">
                        {currentPageAyahs.map((ayah) => (
                          <div 
                            key={ayah.number} 
                            className={cn(
                              "group cursor-pointer rounded-lg p-3 -mx-3 transition-all",
                              currentPlayingAyah === ayah.numberInSurah 
                                ? "bg-emerald-500/10 border border-emerald-500/30" 
                                : "hover:bg-muted/50"
                            )}
                            onClick={() => playAyahAudio(ayah)}
                          >
                            <div className="flex items-start gap-3">
                              <div className={cn(
                                "shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-colors",
                                currentPlayingAyah === ayah.numberInSurah 
                                  ? "bg-emerald-500 text-white" 
                                  : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                              )}>
                                {currentPlayingAyah === ayah.numberInSurah ? (
                                  <Volume2 className="w-5 h-5 animate-pulse" />
                                ) : (
                                  ayah.numberInSurah
                                )}
                              </div>
                              <p 
                                className="flex-1 leading-loose font-arabic text-right select-text"
                                dir="rtl"
                                style={{ fontSize: fontSize }}
                              >
                                {ayah.text}
                                <span className="inline-block mx-2 text-emerald-500/70 text-sm">
                                  ﴿{ayah.numberInSurah}﴾
                                </span>
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </ScrollArea>

                  {/* Navigation Footer */}
                  <div className="px-4 py-3 border-t border-border flex items-center justify-between">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => { setCurrentAyahIndex(Math.max(0, (currentPage - 1) * AYAHS_PER_PAGE)); stopAudio(); }}
                      disabled={currentPage === 0}
                    >
                      <ChevronLeft className="w-4 h-4 mr-1" />
                      Previous
                    </Button>
                    
                    <Badge variant="outline">
                      {currentPage + 1} / {totalPages}
                    </Badge>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => { setCurrentAyahIndex(Math.min((totalPages - 1) * AYAHS_PER_PAGE, (currentPage + 1) * AYAHS_PER_PAGE)); stopAudio(); }}
                      disabled={currentPage >= totalPages - 1}
                    >
                      Next
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
