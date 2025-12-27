import { useState, useEffect, useCallback, useRef } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { 
  Calendar, Moon, Hand, RotateCcw, Check, Star, Compass, BookOpen,
  RefreshCw, MapPin, ChevronLeft, ChevronRight, Search, Loader2, 
  Volume2, VolumeX, Pause, Play, ZoomIn, ZoomOut
} from 'lucide-react';
import { useIslamicFeatures } from '@/hooks/useIslamicFeatures';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { useTextToSpeech } from '@/hooks/useTextToSpeech';

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

const isIOS = (): boolean => {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || 
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
};

const isMobile = (): boolean => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

export function IslamEnhancedPanel() {
  const {
    ramadanDays,
    toggleFasting,
    toggleTaraweeh,
    dhikrLogs,
    dhikrTypes,
    incrementDhikr,
    resetDhikr,
    hijriToday,
    islamicEvents,
    loading: islamicLoading,
  } = useIslamicFeatures();

  const [activeTab, setActiveTab] = useState('ramadan');
  
  // Qibla state
  const [qiblaData, setQiblaData] = useState<QiblaData | null>(null);
  const [deviceHeading, setDeviceHeading] = useState<number | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [locationName, setLocationName] = useState<string>('');
  const [compassPermission, setCompassPermission] = useState<'pending' | 'granted' | 'denied'>('pending');
  const [loading, setLoading] = useState(false);

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

  const { speak, stop: stopSpeech } = useTextToSpeech({
    onEnd: () => setCurrentPlayingAyah(null),
    onError: () => setCurrentPlayingAyah(null)
  });

  // Calculate Ramadan stats
  const fastingDays = ramadanDays.filter(d => d.fasting_completed).length;
  const taraweehDays = ramadanDays.filter(d => d.taraweeh_completed).length;

  const getDhikrProgress = (type: string) => {
    const log = dhikrLogs.find(d => d.dhikr_type === type);
    if (!log) return { count: 0, target: dhikrTypes.find(t => t.id === type)?.defaultTarget || 33, percentage: 0 };
    return {
      count: log.completed_count,
      target: log.target_count,
      percentage: Math.min(100, (log.completed_count / log.target_count) * 100),
    };
  };

  const upcomingEvents = islamicEvents.filter(e => e.date >= new Date()).slice(0, 5);

  // Qibla calculations
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

  const requestCompassPermission = async () => {
    if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
      try {
        const permission = await (DeviceOrientationEvent as any).requestPermission();
        if (permission === 'granted') {
          setCompassPermission('granted');
          startCompassListener();
        } else {
          setCompassPermission('denied');
          toast.error('Compass permission denied');
        }
      } catch (error) {
        setCompassPermission('denied');
      }
    } else {
      setCompassPermission('granted');
      startCompassListener();
    }
  };

  const startCompassListener = () => {
    const handleOrientation = (event: DeviceOrientationEvent) => {
      if (isIOS() && (event as any).webkitCompassHeading !== undefined) {
        setDeviceHeading((event as any).webkitCompassHeading);
      } else if (event.alpha !== null) {
        setDeviceHeading(360 - event.alpha);
      }
    };
    window.addEventListener('deviceorientation', handleOrientation, true);
    return () => window.removeEventListener('deviceorientation', handleOrientation, true);
  };

  const getLocation = useCallback(() => {
    setLocationError(null);
    setLoading(true);
    
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          const direction = calculateQibla(latitude, longitude);
          setQiblaData({ direction, latitude, longitude });
          setLocationName(`${latitude.toFixed(2)}°, ${longitude.toFixed(2)}°`);
          setLoading(false);
          toast.success('Location updated');
        },
        (error) => {
          setLocationError('Unable to get location');
          setLoading(false);
          setQiblaData({ direction: 0, latitude: 21.4225, longitude: 39.8262 });
          setLocationName('Mecca (Default)');
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    } else {
      setLocationError('Geolocation not supported');
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'qibla') {
      if (!qiblaData) getLocation();
      if (isIOS() && typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
        setCompassPermission('pending');
      } else {
        const cleanup = startCompassListener();
        setCompassPermission('granted');
        return cleanup;
      }
    }
  }, [activeTab, getLocation, qiblaData]);

  // Quran functions
  const fetchSurahs = async () => {
    try {
      const response = await fetch('https://api.alquran.cloud/v1/surah');
      const data = await response.json();
      if (data.code === 200) setSurahs(data.data);
    } catch (error) {
      console.error('Failed to fetch surahs:', error);
    }
  };

  const fetchSurah = async (surahNumber: number) => {
    setQuranLoading(true);
    try {
      const response = await fetch(`https://api.alquran.cloud/v1/surah/${surahNumber}/ar.alafasy`);
      const data = await response.json();
      if (data.code === 200) {
        setSelectedSurah(data.data);
        setCurrentAyahIndex(0);
        setShowSurahList(false);
      }
    } catch (error) {
      toast.error('Failed to load surah');
    } finally {
      setQuranLoading(false);
    }
  };

  const playAyahAudio = (ayah: Ayah) => {
    if (audioRef.current) audioRef.current.pause();

    if (ayah.audio) {
      const audio = new Audio(ayah.audio);
      audioRef.current = audio;
      audio.onplay = () => { setIsPlayingAudio(true); setCurrentPlayingAyah(ayah.numberInSurah); };
      audio.onended = () => {
        setIsPlayingAudio(false);
        setCurrentPlayingAyah(null);
        const currentIndex = selectedSurah?.ayahs.findIndex(a => a.numberInSurah === ayah.numberInSurah) || 0;
        const nextAyah = selectedSurah?.ayahs[currentIndex + 1];
        if (nextAyah?.audio) playAyahAudio(nextAyah);
      };
      audio.onerror = () => { setIsPlayingAudio(false); setCurrentPlayingAyah(null); };
      audio.play().catch(console.error);
    } else {
      speak(ayah.text);
      setCurrentPlayingAyah(ayah.numberInSurah);
    }
  };

  const stopAudio = () => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    stopSpeech();
    setIsPlayingAudio(false);
    setCurrentPlayingAyah(null);
  };

  useEffect(() => {
    if (activeTab === 'quran' && surahs.length === 0) fetchSurahs();
  }, [activeTab, surahs.length]);

  useEffect(() => {
    return () => { if (audioRef.current) audioRef.current.pause(); };
  }, []);

  const filteredSurahs = surahs.filter(surah =>
    surah.englishName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    surah.name.includes(searchQuery) ||
    surah.number.toString() === searchQuery
  );

  const AYAHS_PER_PAGE = 10;
  const totalPages = selectedSurah ? Math.ceil(selectedSurah.ayahs.length / AYAHS_PER_PAGE) : 0;
  const currentPage = Math.floor(currentAyahIndex / AYAHS_PER_PAGE);
  const currentPageAyahs = selectedSurah?.ayahs.slice(
    currentPage * AYAHS_PER_PAGE,
    (currentPage + 1) * AYAHS_PER_PAGE
  ) || [];

  const getQiblaRotation = (): number => {
    if (!qiblaData) return 0;
    if (deviceHeading !== null) return qiblaData.direction - deviceHeading;
    return qiblaData.direction;
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-border">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Moon className="w-5 h-5 text-amber-500" />
            Islamic Features
          </h2>
          <Badge variant="outline" className="font-arabic">
            {hijriToday.day} {hijriToday.monthName} {hijriToday.year}
          </Badge>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <TabsList className="mx-4 mt-3 grid grid-cols-5">
          <TabsTrigger value="ramadan" className="gap-1 text-xs px-1">
            <Star className="w-3 h-3" />
            <span className="hidden sm:inline">Ramadan</span>
          </TabsTrigger>
          <TabsTrigger value="dhikr" className="gap-1 text-xs px-1">
            <Hand className="w-3 h-3" />
            <span className="hidden sm:inline">Dhikr</span>
          </TabsTrigger>
          <TabsTrigger value="qibla" className="gap-1 text-xs px-1">
            <Compass className="w-3 h-3" />
            <span className="hidden sm:inline">Qibla</span>
          </TabsTrigger>
          <TabsTrigger value="quran" className="gap-1 text-xs px-1">
            <BookOpen className="w-3 h-3" />
            <span className="hidden sm:inline">Quran</span>
          </TabsTrigger>
          <TabsTrigger value="calendar" className="gap-1 text-xs px-1">
            <Calendar className="w-3 h-3" />
            <span className="hidden sm:inline">Calendar</span>
          </TabsTrigger>
        </TabsList>

        {/* Ramadan Tracker */}
        <TabsContent value="ramadan" className="flex-1 mt-0">
          <ScrollArea className="h-full">
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Card className="p-4 text-center bg-gradient-to-br from-emerald-500/20 to-teal-500/20">
                  <p className="text-3xl font-bold text-emerald-600">{fastingDays}/30</p>
                  <p className="text-sm text-muted-foreground">Fasting Days</p>
                </Card>
                <Card className="p-4 text-center bg-gradient-to-br from-amber-500/20 to-orange-500/20">
                  <p className="text-3xl font-bold text-amber-600">{taraweehDays}/30</p>
                  <p className="text-sm text-muted-foreground">Taraweeh Prayers</p>
                </Card>
              </div>
              <Card className="p-4">
                <h3 className="font-medium mb-3">Track Your Ramadan</h3>
                <div className="grid grid-cols-6 gap-2">
                  {Array.from({ length: 30 }, (_, i) => {
                    const day = i + 1;
                    const dayData = ramadanDays.find(d => d.day_number === day);
                    return (
                      <div key={day} className="text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          className={cn(
                            "w-full h-10 flex flex-col p-1",
                            dayData?.fasting_completed && "bg-emerald-500/20 text-emerald-600"
                          )}
                          onClick={() => toggleFasting(day)}
                        >
                          <span className="text-xs font-medium">{day}</span>
                          {dayData?.fasting_completed && <Check className="w-3 h-3" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className={cn(
                            "w-full h-6 mt-0.5",
                            dayData?.taraweeh_completed && "bg-amber-500/20 text-amber-600"
                          )}
                          onClick={() => toggleTaraweeh(day)}
                        >
                          <Moon className="w-3 h-3" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-center gap-4 mt-4 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 bg-emerald-500/30 rounded" />
                    Fasting
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 bg-amber-500/30 rounded" />
                    Taraweeh
                  </div>
                </div>
              </Card>
            </div>
          </ScrollArea>
        </TabsContent>

        {/* Dhikr Counter */}
        <TabsContent value="dhikr" className="flex-1 mt-0">
          <ScrollArea className="h-full">
            <div className="p-4 space-y-3">
              {dhikrTypes.map((dhikr) => {
                const progress = getDhikrProgress(dhikr.id);
                const isComplete = progress.count >= progress.target;
                return (
                  <Card
                    key={dhikr.id}
                    className={cn(
                      "p-4 cursor-pointer transition-all",
                      isComplete && "border-emerald-500/50 bg-emerald-500/10"
                    )}
                    onClick={() => !isComplete && incrementDhikr(dhikr.id)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="font-arabic text-xl">{dhikr.arabic}</p>
                        <p className="text-sm text-muted-foreground">{dhikr.english}</p>
                      </div>
                      <div className="text-right">
                        <p className={cn("text-2xl font-bold", isComplete && "text-emerald-600")}>
                          {progress.count}/{progress.target}
                        </p>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={(e) => { e.stopPropagation(); resetDhikr(dhikr.id); }}
                        >
                          <RotateCcw className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                    <Progress value={progress.percentage} className="h-2" />
                    {isComplete && <Badge className="mt-2 bg-emerald-500">Complete! 🤲</Badge>}
                  </Card>
                );
              })}
            </div>
          </ScrollArea>
        </TabsContent>

        {/* Qibla Compass */}
        <TabsContent value="qibla" className="flex-1 mt-0">
          <ScrollArea className="h-full">
            <div className="p-4 flex flex-col items-center justify-center min-h-[400px]">
              {locationError && (
                <Card className="p-4 mb-4 bg-destructive/10 border-destructive/20">
                  <p className="text-sm text-destructive">{locationError}</p>
                </Card>
              )}
              
              {compassPermission === 'pending' && isIOS() && (
                <Button onClick={requestCompassPermission} className="mb-4">
                  <Compass className="w-4 h-4 mr-2" />
                  Enable Compass
                </Button>
              )}

              <div className="relative w-64 h-64">
                <div className="absolute inset-0 rounded-full border-4 border-border bg-card">
                  <div className="absolute inset-4 rounded-full border-2 border-muted">
                    {['N', 'E', 'S', 'W'].map((dir, i) => (
                      <span
                        key={dir}
                        className={cn(
                          "absolute text-xs font-bold",
                          dir === 'N' && "top-1 left-1/2 -translate-x-1/2 text-red-500",
                          dir === 'S' && "bottom-1 left-1/2 -translate-x-1/2",
                          dir === 'E' && "right-1 top-1/2 -translate-y-1/2",
                          dir === 'W' && "left-1 top-1/2 -translate-y-1/2"
                        )}
                      >
                        {dir}
                      </span>
                    ))}
                  </div>
                </div>
                
                <div
                  className="absolute inset-0 flex items-center justify-center transition-transform duration-300"
                  style={{ transform: `rotate(${getQiblaRotation()}deg)` }}
                >
                  <div className="w-1 h-24 bg-gradient-to-t from-transparent via-emerald-500 to-emerald-600 rounded-full" />
                  <div className="absolute top-6 w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-xs">🕋</span>
                  </div>
                </div>
              </div>

              <div className="mt-6 text-center space-y-2">
                <div className="flex items-center gap-2 justify-center">
                  <MapPin className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">{locationName || 'Getting location...'}</span>
                </div>
                {qiblaData && (
                  <p className="text-lg font-medium">
                    Qibla: {qiblaData.direction.toFixed(1)}° from North
                  </p>
                )}
                <Button variant="outline" size="sm" onClick={getLocation} disabled={loading}>
                  <RefreshCw className={cn("w-4 h-4 mr-2", loading && "animate-spin")} />
                  Refresh Location
                </Button>
              </div>
            </div>
          </ScrollArea>
        </TabsContent>

        {/* Quran Reader */}
        <TabsContent value="quran" className="flex-1 mt-0">
          <div className="flex flex-col h-full">
            {showSurahList ? (
              <>
                <div className="p-4 border-b border-border">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Search surahs..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
                <ScrollArea className="flex-1">
                  <div className="p-2 space-y-1">
                    {filteredSurahs.map((surah) => (
                      <Card
                        key={surah.number}
                        className="p-3 cursor-pointer hover:bg-accent transition-colors"
                        onClick={() => fetchSurah(surah.number)}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <span className="text-sm font-bold">{surah.number}</span>
                          </div>
                          <div className="flex-1">
                            <p className="font-medium">{surah.englishName}</p>
                            <p className="text-xs text-muted-foreground">
                              {surah.englishNameTranslation} · {surah.numberOfAyahs} ayahs
                            </p>
                          </div>
                          <p className="font-arabic text-lg">{surah.name}</p>
                        </div>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              </>
            ) : (
              <>
                <div className="p-3 border-b border-border flex items-center justify-between">
                  <Button variant="ghost" size="sm" onClick={() => { setShowSurahList(true); stopAudio(); }}>
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    Back
                  </Button>
                  <div className="text-center">
                    <p className="font-medium">{selectedSurah?.englishName}</p>
                    <p className="text-xs text-muted-foreground font-arabic">{selectedSurah?.name}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" onClick={() => setFontSize(Math.max(18, fontSize - 2))}>
                      <ZoomOut className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setFontSize(Math.min(42, fontSize + 2))}>
                      <ZoomIn className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {quranLoading ? (
                  <div className="flex-1 flex items-center justify-center">
                    <Loader2 className="w-8 h-8 animate-spin" />
                  </div>
                ) : (
                  <ScrollArea className="flex-1">
                    <div className="p-4 space-y-4">
                      {currentPageAyahs.map((ayah) => (
                        <Card
                          key={ayah.numberInSurah}
                          className={cn(
                            "p-4 transition-all",
                            currentPlayingAyah === ayah.numberInSurah && "ring-2 ring-primary bg-primary/5"
                          )}
                        >
                          <div className="flex items-start gap-3">
                            <div className="flex flex-col items-center gap-1">
                              <Badge variant="outline" className="w-8 h-8 rounded-full p-0 flex items-center justify-center">
                                {ayah.numberInSurah}
                              </Badge>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => currentPlayingAyah === ayah.numberInSurah ? stopAudio() : playAyahAudio(ayah)}
                              >
                                {currentPlayingAyah === ayah.numberInSurah ? (
                                  <Pause className="w-4 h-4" />
                                ) : (
                                  <Play className="w-4 h-4" />
                                )}
                              </Button>
                            </div>
                            <p
                              className="flex-1 font-arabic text-right leading-loose"
                              style={{ fontSize: `${fontSize}px` }}
                              dir="rtl"
                            >
                              {ayah.text}
                            </p>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </ScrollArea>
                )}

                {selectedSurah && totalPages > 1 && (
                  <div className="p-3 border-t border-border flex items-center justify-between">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentPage === 0}
                      onClick={() => setCurrentAyahIndex((currentPage - 1) * AYAHS_PER_PAGE)}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      Page {currentPage + 1} of {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentPage >= totalPages - 1}
                      onClick={() => setCurrentAyahIndex((currentPage + 1) * AYAHS_PER_PAGE)}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </TabsContent>

        {/* Islamic Calendar */}
        <TabsContent value="calendar" className="flex-1 mt-0">
          <ScrollArea className="h-full">
            <div className="p-4 space-y-4">
              <Card className="p-4 bg-gradient-to-br from-amber-500/20 to-orange-500/20">
                <p className="text-sm text-muted-foreground">Today's Hijri Date</p>
                <p className="text-2xl font-bold font-arabic">
                  {hijriToday.day} {hijriToday.monthName} {hijriToday.year} هـ
                </p>
              </Card>
              <h3 className="font-medium">Upcoming Islamic Events</h3>
              <div className="space-y-2">
                {upcomingEvents.map((event, idx) => (
                  <Card key={idx} className="p-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium">{event.name}</p>
                        <p className="text-sm text-muted-foreground">{event.description}</p>
                      </div>
                      <div className="text-right">
                        <Badge variant="outline">{event.hijriDate}</Badge>
                        <p className="text-xs text-muted-foreground mt-1">
                          ~{format(event.date, 'MMM d, yyyy')}
                        </p>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}
