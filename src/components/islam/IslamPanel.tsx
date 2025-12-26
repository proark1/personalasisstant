import { useState, useEffect, useCallback } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Compass, BookOpen, Clock, RefreshCw, MapPin, Navigation, ChevronLeft, ChevronRight, Search, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

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
}

interface SurahDetail {
  number: number;
  name: string;
  englishName: string;
  englishNameTranslation: string;
  revelationType: string;
  ayahs: Ayah[];
}

export function IslamPanel() {
  const [activeTab, setActiveTab] = useState('prayer');
  const [prayerTimes, setPrayerTimes] = useState<PrayerTime[]>([]);
  const [loading, setLoading] = useState(false);
  const [qiblaData, setQiblaData] = useState<QiblaData | null>(null);
  const [deviceHeading, setDeviceHeading] = useState<number | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [locationName, setLocationName] = useState<string>('');
  
  // Quran state
  const [surahs, setSurahs] = useState<Surah[]>([]);
  const [selectedSurah, setSelectedSurah] = useState<SurahDetail | null>(null);
  const [currentAyahIndex, setCurrentAyahIndex] = useState(0);
  const [quranLoading, setQuranLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSurahList, setShowSurahList] = useState(true);

  // Fetch prayer times based on location
  const fetchPrayerTimes = async (lat: number, lng: number) => {
    setLoading(true);
    try {
      const date = new Date();
      const dateStr = `${date.getDate()}-${date.getMonth() + 1}-${date.getFullYear()}`;
      const response = await fetch(
        `https://api.aladhan.com/v1/timings/${dateStr}?latitude=${lat}&longitude=${lng}&method=2`
      );
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
      }
    } catch (error) {
      console.error('Failed to fetch prayer times:', error);
      toast.error('Failed to fetch prayer times');
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

  // Get user location
  const getLocation = useCallback(() => {
    setLocationError(null);
    setLoading(true);
    
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
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
              errorMessage = 'Location permission denied. Please enable location access in your browser settings.';
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
          setLocationName('Mecca (Default)');
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000 // Cache for 5 minutes
        }
      );
    } else {
      setLocationError('Geolocation not supported by your browser');
      setLoading(false);
    }
  }, []);

  // Watch device orientation for compass
  useEffect(() => {
    const handleOrientation = (event: DeviceOrientationEvent) => {
      if (event.alpha !== null) {
        setDeviceHeading(event.alpha);
      }
    };

    if (window.DeviceOrientationEvent) {
      window.addEventListener('deviceorientation', handleOrientation);
    }

    return () => {
      window.removeEventListener('deviceorientation', handleOrientation);
    };
  }, []);

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

  // Fetch specific surah with Arabic text
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
      console.error('Failed to fetch surah:', error);
      toast.error('Failed to load surah');
    } finally {
      setQuranLoading(false);
    }
  };

  useEffect(() => {
    getLocation();
    fetchSurahs();
  }, [getLocation]);

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
    return prayerTimes[0]; // Return Fajr for next day
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

  // Group ayahs by page (approximately 15 ayahs per page for readability)
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
            <Card className="p-8 w-full max-w-sm bg-gradient-to-br from-amber-500/5 to-orange-500/5">
              <div className="text-center mb-6">
                <h3 className="text-lg font-semibold mb-2">Qibla Direction</h3>
                {qiblaData ? (
                  <p className="text-sm text-muted-foreground">
                    {Math.round(qiblaData.direction)}° from North
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">Calculating...</p>
                )}
              </div>

              {/* Compass */}
              <div className="relative w-52 h-52 mx-auto">
                {/* Compass Ring */}
                <div className="absolute inset-0 rounded-full border-4 border-amber-500/30" />
                <div className="absolute inset-2 rounded-full border-2 border-muted" />
                
                {/* Cardinal Directions */}
                <div className="absolute top-3 left-1/2 -translate-x-1/2 text-sm font-bold text-amber-600 dark:text-amber-400">N</div>
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 text-sm font-medium text-muted-foreground">S</div>
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">W</div>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">E</div>
                
                {/* Degree markers */}
                {[45, 135, 225, 315].map((deg) => (
                  <div 
                    key={deg}
                    className="absolute w-1 h-1 rounded-full bg-muted-foreground/50"
                    style={{
                      top: `${50 - 42 * Math.cos((deg * Math.PI) / 180)}%`,
                      left: `${50 + 42 * Math.sin((deg * Math.PI) / 180)}%`,
                    }}
                  />
                ))}
                
                {/* Qibla Arrow */}
                <div 
                  className="absolute inset-6 flex items-center justify-center transition-transform duration-500 ease-out"
                  style={{ transform: `rotate(${getQiblaRotation()}deg)` }}
                >
                  <div className="relative w-full h-full">
                    <Navigation 
                      className="absolute top-0 left-1/2 -translate-x-1/2 w-10 h-10 text-amber-600 dark:text-amber-500 fill-amber-500" 
                    />
                  </div>
                </div>

                {/* Center point */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-amber-500 shadow-lg" />
              </div>

              <div className="text-center mt-6 space-y-2">
                <div className="flex items-center justify-center gap-2">
                  <span className="text-3xl">🕋</span>
                  <span className="font-medium">Kaaba, Mecca</span>
                </div>
                {deviceHeading !== null ? (
                  <p className="text-xs text-emerald-600 dark:text-emerald-400">
                    ✓ Live compass active
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Rotate your device for live compass
                  </p>
                )}
              </div>
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
              <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <Button variant="ghost" size="sm" onClick={() => setShowSurahList(true)}>
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Surahs
                </Button>
                {selectedSurah && (
                  <div className="text-center">
                    <p className="font-semibold">{selectedSurah.englishName}</p>
                    <p className="text-xs text-muted-foreground">{selectedSurah.englishNameTranslation}</p>
                  </div>
                )}
                <Badge variant="outline">
                  {currentPage + 1} / {totalPages}
                </Badge>
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
                          <p className="text-3xl font-arabic mb-2">{selectedSurah.name}</p>
                          <p className="text-sm text-muted-foreground">{selectedSurah.revelationType}</p>
                          {/* Bismillah for surahs other than At-Tawbah */}
                          {selectedSurah.number !== 9 && selectedSurah.number !== 1 && (
                            <p className="text-2xl font-arabic mt-6 text-emerald-600 dark:text-emerald-400">
                              بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
                            </p>
                          )}
                        </div>
                      )}

                      {/* Ayahs */}
                      <div className="space-y-6">
                        {currentPageAyahs.map((ayah) => (
                          <div key={ayah.number} className="group">
                            <div className="flex items-start gap-3">
                              <div className="shrink-0 w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center text-xs font-medium text-emerald-600 dark:text-emerald-400">
                                {ayah.numberInSurah}
                              </div>
                              <p 
                                className="flex-1 text-2xl leading-loose font-arabic text-right"
                                dir="rtl"
                              >
                                {ayah.text}
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
                      onClick={() => setCurrentAyahIndex(Math.max(0, (currentPage - 1) * AYAHS_PER_PAGE))}
                      disabled={currentPage === 0}
                    >
                      <ChevronLeft className="w-4 h-4 mr-1" />
                      Previous
                    </Button>
                    
                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum = i;
                        if (totalPages > 5) {
                          if (currentPage < 3) {
                            pageNum = i;
                          } else if (currentPage > totalPages - 3) {
                            pageNum = totalPages - 5 + i;
                          } else {
                            pageNum = currentPage - 2 + i;
                          }
                        }
                        return (
                          <Button
                            key={pageNum}
                            variant={currentPage === pageNum ? 'default' : 'ghost'}
                            size="sm"
                            className="w-8 h-8 p-0"
                            onClick={() => setCurrentAyahIndex(pageNum * AYAHS_PER_PAGE)}
                          >
                            {pageNum + 1}
                          </Button>
                        );
                      })}
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentAyahIndex(Math.min((totalPages - 1) * AYAHS_PER_PAGE, (currentPage + 1) * AYAHS_PER_PAGE))}
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
