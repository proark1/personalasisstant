import { useState, useMemo, useEffect, useRef } from 'react';
import { GlassCard } from '@/components/ui/glass-card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Search, BookOpen, Check, AlertCircle, Play, Pause,
  ChevronLeft, ChevronRight, Target, Trophy, Volume2,
  Eye, EyeOff, Repeat, Star, Brain, Zap, ArrowRight
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow, differenceInDays } from 'date-fns';

interface Surah {
  number: number;
  name: string;
  englishName: string;
  numberOfAyahs: number;
}

interface Ayah {
  number: number;
  text: string;
  numberInSurah: number;
  audio?: string;
}

interface HifzProgress {
  id: string;
  surah_number: number;
  surah_name: string;
  surah_name_arabic: string;
  total_ayahs: number;
  memorized_ayahs: number;
  status: 'not_started' | 'in_progress' | 'memorized' | 'needs_revision';
  last_revised_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  notes: string | null;
  revision_count?: number;
  ease_factor?: number;
  next_review_date?: string | null;
}

// All 114 Surahs
const SURAHS: Surah[] = [
  { number: 1, name: 'الفاتحة', englishName: 'Al-Fatiha', numberOfAyahs: 7 },
  { number: 2, name: 'البقرة', englishName: 'Al-Baqarah', numberOfAyahs: 286 },
  { number: 3, name: 'آل عمران', englishName: "Ali 'Imran", numberOfAyahs: 200 },
  { number: 4, name: 'النساء', englishName: 'An-Nisa', numberOfAyahs: 176 },
  { number: 5, name: 'المائدة', englishName: "Al-Ma'idah", numberOfAyahs: 120 },
  { number: 6, name: 'الأنعام', englishName: "Al-An'am", numberOfAyahs: 165 },
  { number: 7, name: 'الأعراف', englishName: "Al-A'raf", numberOfAyahs: 206 },
  { number: 8, name: 'الأنفال', englishName: 'Al-Anfal', numberOfAyahs: 75 },
  { number: 9, name: 'التوبة', englishName: 'At-Tawbah', numberOfAyahs: 129 },
  { number: 10, name: 'يونس', englishName: 'Yunus', numberOfAyahs: 109 },
  { number: 11, name: 'هود', englishName: 'Hud', numberOfAyahs: 123 },
  { number: 12, name: 'يوسف', englishName: 'Yusuf', numberOfAyahs: 111 },
  { number: 13, name: 'الرعد', englishName: "Ar-Ra'd", numberOfAyahs: 43 },
  { number: 14, name: 'إبراهيم', englishName: 'Ibrahim', numberOfAyahs: 52 },
  { number: 15, name: 'الحجر', englishName: 'Al-Hijr', numberOfAyahs: 99 },
  { number: 16, name: 'النحل', englishName: 'An-Nahl', numberOfAyahs: 128 },
  { number: 17, name: 'الإسراء', englishName: 'Al-Isra', numberOfAyahs: 111 },
  { number: 18, name: 'الكهف', englishName: 'Al-Kahf', numberOfAyahs: 110 },
  { number: 19, name: 'مريم', englishName: 'Maryam', numberOfAyahs: 98 },
  { number: 20, name: 'طه', englishName: 'Ta-Ha', numberOfAyahs: 135 },
  { number: 21, name: 'الأنبياء', englishName: 'Al-Anbiya', numberOfAyahs: 112 },
  { number: 22, name: 'الحج', englishName: 'Al-Hajj', numberOfAyahs: 78 },
  { number: 23, name: 'المؤمنون', englishName: "Al-Mu'minun", numberOfAyahs: 118 },
  { number: 24, name: 'النور', englishName: 'An-Nur', numberOfAyahs: 64 },
  { number: 25, name: 'الفرقان', englishName: 'Al-Furqan', numberOfAyahs: 77 },
  { number: 26, name: 'الشعراء', englishName: "Ash-Shu'ara", numberOfAyahs: 227 },
  { number: 27, name: 'النمل', englishName: 'An-Naml', numberOfAyahs: 93 },
  { number: 28, name: 'القصص', englishName: 'Al-Qasas', numberOfAyahs: 88 },
  { number: 29, name: 'العنكبوت', englishName: 'Al-Ankabut', numberOfAyahs: 69 },
  { number: 30, name: 'الروم', englishName: 'Ar-Rum', numberOfAyahs: 60 },
  { number: 31, name: 'لقمان', englishName: 'Luqman', numberOfAyahs: 34 },
  { number: 32, name: 'السجدة', englishName: 'As-Sajdah', numberOfAyahs: 30 },
  { number: 33, name: 'الأحزاب', englishName: 'Al-Ahzab', numberOfAyahs: 73 },
  { number: 34, name: 'سبأ', englishName: 'Saba', numberOfAyahs: 54 },
  { number: 35, name: 'فاطر', englishName: 'Fatir', numberOfAyahs: 45 },
  { number: 36, name: 'يس', englishName: 'Ya-Sin', numberOfAyahs: 83 },
  { number: 37, name: 'الصافات', englishName: 'As-Saffat', numberOfAyahs: 182 },
  { number: 38, name: 'ص', englishName: 'Sad', numberOfAyahs: 88 },
  { number: 39, name: 'الزمر', englishName: 'Az-Zumar', numberOfAyahs: 75 },
  { number: 40, name: 'غافر', englishName: 'Ghafir', numberOfAyahs: 85 },
  { number: 41, name: 'فصلت', englishName: 'Fussilat', numberOfAyahs: 54 },
  { number: 42, name: 'الشورى', englishName: 'Ash-Shura', numberOfAyahs: 53 },
  { number: 43, name: 'الزخرف', englishName: 'Az-Zukhruf', numberOfAyahs: 89 },
  { number: 44, name: 'الدخان', englishName: 'Ad-Dukhan', numberOfAyahs: 59 },
  { number: 45, name: 'الجاثية', englishName: 'Al-Jathiyah', numberOfAyahs: 37 },
  { number: 46, name: 'الأحقاف', englishName: 'Al-Ahqaf', numberOfAyahs: 35 },
  { number: 47, name: 'محمد', englishName: 'Muhammad', numberOfAyahs: 38 },
  { number: 48, name: 'الفتح', englishName: 'Al-Fath', numberOfAyahs: 29 },
  { number: 49, name: 'الحجرات', englishName: 'Al-Hujurat', numberOfAyahs: 18 },
  { number: 50, name: 'ق', englishName: 'Qaf', numberOfAyahs: 45 },
  { number: 51, name: 'الذاريات', englishName: 'Adh-Dhariyat', numberOfAyahs: 60 },
  { number: 52, name: 'الطور', englishName: 'At-Tur', numberOfAyahs: 49 },
  { number: 53, name: 'النجم', englishName: 'An-Najm', numberOfAyahs: 62 },
  { number: 54, name: 'القمر', englishName: 'Al-Qamar', numberOfAyahs: 55 },
  { number: 55, name: 'الرحمن', englishName: 'Ar-Rahman', numberOfAyahs: 78 },
  { number: 56, name: 'الواقعة', englishName: "Al-Waqi'ah", numberOfAyahs: 96 },
  { number: 57, name: 'الحديد', englishName: 'Al-Hadid', numberOfAyahs: 29 },
  { number: 58, name: 'المجادلة', englishName: 'Al-Mujadila', numberOfAyahs: 22 },
  { number: 59, name: 'الحشر', englishName: 'Al-Hashr', numberOfAyahs: 24 },
  { number: 60, name: 'الممتحنة', englishName: 'Al-Mumtahanah', numberOfAyahs: 13 },
  { number: 61, name: 'الصف', englishName: 'As-Saf', numberOfAyahs: 14 },
  { number: 62, name: 'الجمعة', englishName: "Al-Jumu'ah", numberOfAyahs: 11 },
  { number: 63, name: 'المنافقون', englishName: 'Al-Munafiqun', numberOfAyahs: 11 },
  { number: 64, name: 'التغابن', englishName: 'At-Taghabun', numberOfAyahs: 18 },
  { number: 65, name: 'الطلاق', englishName: 'At-Talaq', numberOfAyahs: 12 },
  { number: 66, name: 'التحريم', englishName: 'At-Tahrim', numberOfAyahs: 12 },
  { number: 67, name: 'الملك', englishName: 'Al-Mulk', numberOfAyahs: 30 },
  { number: 68, name: 'القلم', englishName: 'Al-Qalam', numberOfAyahs: 52 },
  { number: 69, name: 'الحاقة', englishName: 'Al-Haqqah', numberOfAyahs: 52 },
  { number: 70, name: 'المعارج', englishName: "Al-Ma'arij", numberOfAyahs: 44 },
  { number: 71, name: 'نوح', englishName: 'Nuh', numberOfAyahs: 28 },
  { number: 72, name: 'الجن', englishName: 'Al-Jinn', numberOfAyahs: 28 },
  { number: 73, name: 'المزمل', englishName: 'Al-Muzzammil', numberOfAyahs: 20 },
  { number: 74, name: 'المدثر', englishName: 'Al-Muddaththir', numberOfAyahs: 56 },
  { number: 75, name: 'القيامة', englishName: 'Al-Qiyamah', numberOfAyahs: 40 },
  { number: 76, name: 'الإنسان', englishName: 'Al-Insan', numberOfAyahs: 31 },
  { number: 77, name: 'المرسلات', englishName: 'Al-Mursalat', numberOfAyahs: 50 },
  { number: 78, name: 'النبأ', englishName: 'An-Naba', numberOfAyahs: 40 },
  { number: 79, name: 'النازعات', englishName: "An-Nazi'at", numberOfAyahs: 46 },
  { number: 80, name: 'عبس', englishName: 'Abasa', numberOfAyahs: 42 },
  { number: 81, name: 'التكوير', englishName: 'At-Takwir', numberOfAyahs: 29 },
  { number: 82, name: 'الانفطار', englishName: 'Al-Infitar', numberOfAyahs: 19 },
  { number: 83, name: 'المطففين', englishName: 'Al-Mutaffifin', numberOfAyahs: 36 },
  { number: 84, name: 'الانشقاق', englishName: 'Al-Inshiqaq', numberOfAyahs: 25 },
  { number: 85, name: 'البروج', englishName: 'Al-Buruj', numberOfAyahs: 22 },
  { number: 86, name: 'الطارق', englishName: 'At-Tariq', numberOfAyahs: 17 },
  { number: 87, name: 'الأعلى', englishName: "Al-A'la", numberOfAyahs: 19 },
  { number: 88, name: 'الغاشية', englishName: 'Al-Ghashiyah', numberOfAyahs: 26 },
  { number: 89, name: 'الفجر', englishName: 'Al-Fajr', numberOfAyahs: 30 },
  { number: 90, name: 'البلد', englishName: 'Al-Balad', numberOfAyahs: 20 },
  { number: 91, name: 'الشمس', englishName: 'Ash-Shams', numberOfAyahs: 15 },
  { number: 92, name: 'الليل', englishName: 'Al-Layl', numberOfAyahs: 21 },
  { number: 93, name: 'الضحى', englishName: 'Ad-Duha', numberOfAyahs: 11 },
  { number: 94, name: 'الشرح', englishName: 'Ash-Sharh', numberOfAyahs: 8 },
  { number: 95, name: 'التين', englishName: 'At-Tin', numberOfAyahs: 8 },
  { number: 96, name: 'العلق', englishName: 'Al-Alaq', numberOfAyahs: 19 },
  { number: 97, name: 'القدر', englishName: 'Al-Qadr', numberOfAyahs: 5 },
  { number: 98, name: 'البينة', englishName: 'Al-Bayyinah', numberOfAyahs: 8 },
  { number: 99, name: 'الزلزلة', englishName: 'Az-Zalzalah', numberOfAyahs: 8 },
  { number: 100, name: 'العاديات', englishName: 'Al-Adiyat', numberOfAyahs: 11 },
  { number: 101, name: 'القارعة', englishName: "Al-Qari'ah", numberOfAyahs: 11 },
  { number: 102, name: 'التكاثر', englishName: 'At-Takathur', numberOfAyahs: 8 },
  { number: 103, name: 'العصر', englishName: 'Al-Asr', numberOfAyahs: 3 },
  { number: 104, name: 'الهمزة', englishName: 'Al-Humazah', numberOfAyahs: 9 },
  { number: 105, name: 'الفيل', englishName: 'Al-Fil', numberOfAyahs: 5 },
  { number: 106, name: 'قريش', englishName: 'Quraysh', numberOfAyahs: 4 },
  { number: 107, name: 'الماعون', englishName: "Al-Ma'un", numberOfAyahs: 7 },
  { number: 108, name: 'الكوثر', englishName: 'Al-Kawthar', numberOfAyahs: 3 },
  { number: 109, name: 'الكافرون', englishName: 'Al-Kafirun', numberOfAyahs: 6 },
  { number: 110, name: 'النصر', englishName: 'An-Nasr', numberOfAyahs: 3 },
  { number: 111, name: 'المسد', englishName: 'Al-Masad', numberOfAyahs: 5 },
  { number: 112, name: 'الإخلاص', englishName: 'Al-Ikhlas', numberOfAyahs: 4 },
  { number: 113, name: 'الفلق', englishName: 'Al-Falaq', numberOfAyahs: 5 },
  { number: 114, name: 'الناس', englishName: 'An-Nas', numberOfAyahs: 6 },
];

const TOTAL_AYAHS = SURAHS.reduce((sum, s) => sum + s.numberOfAyahs, 0);

// Spaced repetition intervals (in days) based on SM-2 algorithm
const getNextReviewInterval = (revisionCount: number, easeFactor: number = 2.5): number => {
  if (revisionCount === 0) return 1;
  if (revisionCount === 1) return 3;
  return Math.round(getNextReviewInterval(revisionCount - 1, easeFactor) * easeFactor);
};

type ViewMode = 'overview' | 'practice' | 'review';
type FilterStatus = 'all' | 'not_started' | 'in_progress' | 'memorized' | 'due_review';

export function HifzTrackerTab() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('overview');
  const [selectedSurah, setSelectedSurah] = useState<Surah | null>(null);
  const [practiceDialogOpen, setPracticeDialogOpen] = useState(false);
  
  // Practice mode state
  const [practiceAyahs, setPracticeAyahs] = useState<Ayah[]>([]);
  const [currentAyahIndex, setCurrentAyahIndex] = useState(0);
  const [showAyah, setShowAyah] = useState(false);
  const [practiceLoading, setPracticeLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [repeatCount, setRepeatCount] = useState(0);
  const [targetRepeatCount, setTargetRepeatCount] = useState(1);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Fetch progress data
  const { data: progressData = [], isLoading } = useQuery({
    queryKey: ['hifz-progress', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('quran_hifz_progress')
        .select('*')
        .eq('user_id', user.id);
      if (error) throw error;
      return data as HifzProgress[];
    },
    enabled: !!user?.id,
  });

  // Upsert progress mutation
  const updateProgress = useMutation({
    mutationFn: async ({ surah, updates }: { surah: Surah; updates: Partial<HifzProgress> }) => {
      if (!user?.id) throw new Error('Not authenticated');
      
      const existing = progressData.find(p => p.surah_number === surah.number);
      const now = new Date().toISOString();
      
      const { error } = await supabase
        .from('quran_hifz_progress')
        .upsert({
          user_id: user.id,
          surah_number: surah.number,
          surah_name: surah.englishName,
          surah_name_arabic: surah.name,
          total_ayahs: surah.numberOfAyahs,
          memorized_ayahs: updates.memorized_ayahs ?? existing?.memorized_ayahs ?? 0,
          status: updates.status ?? existing?.status ?? 'not_started',
          started_at: updates.started_at ?? existing?.started_at ?? (updates.memorized_ayahs ? now : null),
          completed_at: updates.completed_at ?? existing?.completed_at,
          last_revised_at: updates.last_revised_at ?? existing?.last_revised_at,
          notes: updates.notes ?? existing?.notes,
        }, { onConflict: 'user_id,surah_number' });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hifz-progress'] });
    },
    onError: () => toast.error('Failed to update progress'),
  });

  // Calculate statistics
  const stats = useMemo(() => {
    const memorizedAyahs = progressData.reduce((sum, p) => sum + p.memorized_ayahs, 0);
    const memorizedSurahs = progressData.filter(p => p.status === 'memorized').length;
    const inProgress = progressData.filter(p => p.status === 'in_progress').length;
    
    // Calculate surahs due for review (spaced repetition)
    const dueForReview = progressData.filter(p => {
      if (p.status !== 'memorized' || !p.last_revised_at) return false;
      const daysSinceRevision = differenceInDays(new Date(), new Date(p.last_revised_at));
      const interval = getNextReviewInterval(p.revision_count || 1, p.ease_factor || 2.5);
      return daysSinceRevision >= interval;
    });
    
    // Today's streak calculation
    const todayProgress = progressData.filter(p => {
      if (!p.last_revised_at) return false;
      const today = new Date();
      const lastRevised = new Date(p.last_revised_at);
      return today.toDateString() === lastRevised.toDateString();
    }).length;
    
    return {
      memorizedAyahs,
      memorizedSurahs,
      inProgress,
      dueForReview: dueForReview.length,
      todayProgress,
      totalPercentage: ((memorizedAyahs / TOTAL_AYAHS) * 100).toFixed(1),
      juzCompleted: Math.floor(memorizedAyahs / 200), // Approximate juz calculation
    };
  }, [progressData]);

  const getProgress = (surahNumber: number): HifzProgress | undefined => {
    return progressData.find(p => p.surah_number === surahNumber);
  };

  // Filter surahs
  const filteredSurahs = useMemo(() => {
    return SURAHS.filter(surah => {
      const matchesSearch = searchQuery === '' ||
        surah.englishName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        surah.name.includes(searchQuery) ||
        surah.number.toString() === searchQuery;
      
      if (filterStatus === 'all') return matchesSearch;
      
      const progress = getProgress(surah.number);
      if (filterStatus === 'not_started') return matchesSearch && !progress;
      if (filterStatus === 'due_review') {
        if (!progress || progress.status !== 'memorized' || !progress.last_revised_at) return false;
        const daysSinceRevision = differenceInDays(new Date(), new Date(progress.last_revised_at));
        return matchesSearch && daysSinceRevision >= 7;
      }
      return matchesSearch && progress?.status === filterStatus;
    });
  }, [searchQuery, filterStatus, progressData]);

  // Surahs recommended for beginner (short surahs from Juz Amma)
  const recommendedSurahs = SURAHS.filter(s => s.number >= 103).reverse();

  // Fetch surah ayahs for practice
  const fetchSurahAyahs = async (surahNumber: number) => {
    setPracticeLoading(true);
    try {
      const response = await fetch(`https://api.alquran.cloud/v1/surah/${surahNumber}/ar.alafasy`);
      const data = await response.json();
      if (data.code === 200) {
        setPracticeAyahs(data.data.ayahs);
        setCurrentAyahIndex(0);
        setShowAyah(false);
      }
    } catch (error) {
      toast.error('Failed to load surah');
    } finally {
      setPracticeLoading(false);
    }
  };

  const startPractice = (surah: Surah) => {
    setSelectedSurah(surah);
    fetchSurahAyahs(surah.number);
    setPracticeDialogOpen(true);
    setRepeatCount(0);
  };

  const playCurrentAyah = () => {
    const ayah = practiceAyahs[currentAyahIndex];
    if (!ayah?.audio) return;
    
    if (audioRef.current) {
      audioRef.current.pause();
    }
    
    const audio = new Audio(ayah.audio);
    audioRef.current = audio;
    
    audio.onplay = () => setIsPlaying(true);
    audio.onended = () => {
      setIsPlaying(false);
      setRepeatCount(prev => {
        const newCount = prev + 1;
        // Auto-repeat if we haven't reached target
        if (newCount < targetRepeatCount) {
          setTimeout(() => {
            if (audioRef.current) {
              audioRef.current.currentTime = 0;
              audioRef.current.play().catch(console.error);
            } else {
              // Recreate audio if needed
              const newAudio = new Audio(ayah.audio);
              audioRef.current = newAudio;
              newAudio.onplay = () => setIsPlaying(true);
              newAudio.onended = audio.onended;
              newAudio.onerror = () => setIsPlaying(false);
              newAudio.play().catch(console.error);
            }
          }, 500);
        }
        return newCount;
      });
    };
    audio.onerror = () => setIsPlaying(false);
    
    audio.play().catch(console.error);
  };

  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setIsPlaying(false);
  };

  const nextAyah = () => {
    if (currentAyahIndex < practiceAyahs.length - 1) {
      setCurrentAyahIndex(prev => prev + 1);
      setShowAyah(false);
      setRepeatCount(0);
    }
  };

  const prevAyah = () => {
    if (currentAyahIndex > 0) {
      setCurrentAyahIndex(prev => prev - 1);
      setShowAyah(false);
      setRepeatCount(0);
    }
  };

  const markSurahMemorized = async () => {
    if (!selectedSurah) return;
    
    await updateProgress.mutateAsync({
      surah: selectedSurah,
      updates: {
        memorized_ayahs: selectedSurah.numberOfAyahs,
        status: 'memorized',
        completed_at: new Date().toISOString(),
        last_revised_at: new Date().toISOString(),
      }
    });
    
    toast.success(`🎉 ${selectedSurah.englishName} marked as memorized!`);
    setPracticeDialogOpen(false);
  };

  const markAsRevised = async (surah: Surah) => {
    const progress = getProgress(surah.number);
    
    await updateProgress.mutateAsync({
      surah,
      updates: {
        last_revised_at: new Date().toISOString(),
        status: 'memorized',
      }
    });
    
    toast.success(`✓ ${surah.englishName} revised`);
  };

  const getStatusBadge = (surah: Surah) => {
    const progress = getProgress(surah.number);
    if (!progress) return <Badge variant="outline" className="text-xs">Start</Badge>;
    
    if (progress.status === 'memorized') {
      const daysSinceRevision = progress.last_revised_at 
        ? differenceInDays(new Date(), new Date(progress.last_revised_at))
        : 999;
      
      if (daysSinceRevision >= 7) {
        return <Badge variant="destructive" className="text-xs gap-1"><AlertCircle className="w-3 h-3" />Review</Badge>;
      }
      return <Badge className="text-xs bg-emerald-500 gap-1"><Check className="w-3 h-3" />Done</Badge>;
    }
    
    if (progress.status === 'in_progress') {
      const pct = Math.round((progress.memorized_ayahs / progress.total_ayahs) * 100);
      return <Badge variant="secondary" className="text-xs">{pct}%</Badge>;
    }
    
    return <Badge variant="outline" className="text-xs">Start</Badge>;
  };

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) audioRef.current.pause();
    };
  }, []);

  return (
    <div className="flex flex-col h-full">
      {/* Statistics Header */}
      <div className="p-4 border-b border-border space-y-4">
        <div className="grid grid-cols-3 gap-2">
          <GlassCard className="p-3 text-center bg-gradient-to-br from-emerald-500/20 to-teal-500/20">
            <Trophy className="w-5 h-5 mx-auto text-emerald-600 mb-1" />
            <p className="text-xl font-bold text-emerald-600">{stats.memorizedSurahs}</p>
            <p className="text-[10px] text-muted-foreground">Surahs</p>
          </GlassCard>
          <GlassCard className="p-3 text-center bg-gradient-to-br from-primary/20 to-primary/10">
            <Target className="w-5 h-5 mx-auto text-primary mb-1" />
            <p className="text-xl font-bold text-primary">{stats.totalPercentage}%</p>
            <p className="text-[10px] text-muted-foreground">{stats.memorizedAyahs} Ayahs</p>
          </GlassCard>
          <GlassCard className="p-3 text-center bg-gradient-to-br from-amber-500/20 to-orange-500/20">
            <Repeat className="w-5 h-5 mx-auto text-amber-600 mb-1" />
            <p className="text-xl font-bold text-amber-600">{stats.dueForReview}</p>
            <p className="text-[10px] text-muted-foreground">Due Review</p>
          </GlassCard>
        </div>

        {/* Quick Actions */}
        {stats.dueForReview > 0 && (
          <Button 
            className="w-full gap-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:opacity-90"
            onClick={() => setViewMode('review')}
          >
            <Brain className="w-4 h-4" />
            Review {stats.dueForReview} Surah{stats.dueForReview > 1 ? 's' : ''} Now
          </Button>
        )}
      </div>

      {/* Tabs */}
      <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)} className="flex-1 flex flex-col">
        <TabsList className="mx-4 mt-3 grid grid-cols-3">
          <TabsTrigger value="overview" className="text-xs gap-1">
            <BookOpen className="w-3 h-3" />
            Surahs
          </TabsTrigger>
          <TabsTrigger value="practice" className="text-xs gap-1">
            <Zap className="w-3 h-3" />
            Quick Start
          </TabsTrigger>
          <TabsTrigger value="review" className="text-xs gap-1">
            <Brain className="w-3 h-3" />
            Review
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="flex-1 mt-0 flex flex-col">
          <div className="px-4 py-3 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search surahs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            
            <div className="flex gap-1 overflow-x-auto pb-1">
              {(['all', 'in_progress', 'memorized', 'due_review', 'not_started'] as FilterStatus[]).map(status => (
                <Button
                  key={status}
                  variant={filterStatus === status ? 'default' : 'outline'}
                  size="sm"
                  className="text-xs whitespace-nowrap"
                  onClick={() => setFilterStatus(status)}
                >
                  {status === 'all' && 'All'}
                  {status === 'in_progress' && `Learning (${stats.inProgress})`}
                  {status === 'memorized' && `Done (${stats.memorizedSurahs})`}
                  {status === 'due_review' && `Review (${stats.dueForReview})`}
                  {status === 'not_started' && 'New'}
                </Button>
              ))}
            </div>
          </div>

          <ScrollArea className="flex-1">
            <div className="px-4 pb-20 space-y-2">
              {filteredSurahs.map(surah => {
                const progress = getProgress(surah.number);
                const isMemorized = progress?.status === 'memorized';
                const needsReview = isMemorized && progress?.last_revised_at && 
                  differenceInDays(new Date(), new Date(progress.last_revised_at)) >= 7;
                
                return (
                  <GlassCard 
                    key={surah.number}
                    pressable
                    haptic="light"
                    className={cn(
                      "p-3",
                      isMemorized && !needsReview && "border-emerald-500/30 bg-emerald-500/5",
                      needsReview && "border-amber-500/50 bg-amber-500/10"
                    )}
                    onClick={() => startPractice(surah)}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold",
                        isMemorized ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground"
                      )}>
                        {surah.number}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{surah.englishName}</span>
                          <span className="font-arabic text-muted-foreground">{surah.name}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{surah.numberOfAyahs} ayahs</span>
                          {progress?.last_revised_at && (
                            <span>• Revised {formatDistanceToNow(new Date(progress.last_revised_at), { addSuffix: true })}</span>
                          )}
                        </div>
                        {progress && progress.status === 'in_progress' && (
                          <Progress 
                            value={(progress.memorized_ayahs / progress.total_ayahs) * 100} 
                            className="h-1 mt-1"
                          />
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {getStatusBadge(surah)}
                        <ArrowRight className="w-4 h-4 text-muted-foreground" />
                      </div>
                    </div>
                  </GlassCard>
                );
              })}
            </div>
          </ScrollArea>
        </TabsContent>

        {/* Quick Start Tab - Beginner Friendly */}
        <TabsContent value="practice" className="flex-1 mt-0">
          <ScrollArea className="h-full">
            <div className="p-4 space-y-4">
              <GlassCard className="p-4 bg-gradient-to-br from-primary/10 to-primary/5">
                <h3 className="font-semibold flex items-center gap-2 mb-2">
                  <Star className="w-4 h-4 text-amber-500" />
                  Recommended for Beginners
                </h3>
                <p className="text-sm text-muted-foreground mb-3">
                  Start with these short surahs from Juz Amma. They're perfect for building your foundation.
                </p>
                <div className="space-y-2">
                  {recommendedSurahs.slice(0, 5).map(surah => {
                    const progress = getProgress(surah.number);
                    const isMemorized = progress?.status === 'memorized';
                    
                    return (
                      <Button
                        key={surah.number}
                        variant={isMemorized ? "secondary" : "outline"}
                        className="w-full justify-between h-auto py-3"
                        onClick={() => startPractice(surah)}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-lg font-arabic">{surah.name}</span>
                          <span className="text-sm">{surah.englishName}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">{surah.numberOfAyahs} ayahs</span>
                          {isMemorized ? (
                            <Check className="w-4 h-4 text-emerald-500" />
                          ) : (
                            <Play className="w-4 h-4" />
                          )}
                        </div>
                      </Button>
                    );
                  })}
                </div>
              </GlassCard>

              <GlassCard className="p-4">
                <h3 className="font-semibold flex items-center gap-2 mb-3">
                  <Brain className="w-4 h-4 text-primary" />
                  Memorization Tips
                </h3>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>• <strong>Listen first:</strong> Play each ayah 3-5 times before reading</p>
                  <p>• <strong>Repeat aloud:</strong> Recite along with the audio</p>
                  <p>• <strong>Small chunks:</strong> Learn 1-3 ayahs at a time</p>
                  <p>• <strong>Daily review:</strong> Revise what you memorized yesterday</p>
                  <p>• <strong>Pray with it:</strong> Use memorized surahs in your prayers</p>
                </div>
              </GlassCard>
            </div>
          </ScrollArea>
        </TabsContent>

        {/* Review Tab */}
        <TabsContent value="review" className="flex-1 mt-0">
          <ScrollArea className="h-full">
            <div className="p-4 space-y-4">
              {stats.dueForReview > 0 ? (
                <>
                  <GlassCard className="p-4 bg-amber-500/10 border-amber-500/30">
                    <h3 className="font-semibold flex items-center gap-2 mb-2">
                      <AlertCircle className="w-4 h-4 text-amber-600" />
                      {stats.dueForReview} Surah{stats.dueForReview > 1 ? 's' : ''} Due for Review
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Review these surahs to strengthen your memorization using spaced repetition.
                    </p>
                  </GlassCard>
                  
                  {progressData
                    .filter(p => {
                      if (p.status !== 'memorized' || !p.last_revised_at) return false;
                      return differenceInDays(new Date(), new Date(p.last_revised_at)) >= 7;
                    })
                    .map(p => {
                      const surah = SURAHS.find(s => s.number === p.surah_number)!;
                      const daysSince = differenceInDays(new Date(), new Date(p.last_revised_at!));
                      
                      return (
                        <GlassCard key={p.id} className="p-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{p.surah_name}</span>
                                <span className="font-arabic text-muted-foreground">{p.surah_name_arabic}</span>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                Last reviewed {daysSince} days ago
                              </p>
                            </div>
                            <div className="flex gap-2">
                              <Button size="sm" variant="outline" onClick={() => startPractice(surah)}>
                                <Play className="w-3 h-3 mr-1" />
                                Practice
                              </Button>
                              <Button size="sm" onClick={() => markAsRevised(surah)}>
                                <Check className="w-3 h-3 mr-1" />
                                Done
                              </Button>
                            </div>
                          </div>
                        </GlassCard>
                      );
                    })}
                </>
              ) : (
                <GlassCard className="p-8 text-center">
                  <Check className="w-12 h-12 mx-auto text-emerald-500 mb-3" />
                  <h3 className="font-semibold mb-1">All Caught Up!</h3>
                  <p className="text-sm text-muted-foreground">
                    No surahs need reviewing right now. Keep memorizing!
                  </p>
                </GlassCard>
              )}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>

      {/* Practice Dialog */}
      <Dialog open={practiceDialogOpen} onOpenChange={setPracticeDialogOpen}>
        <DialogContent className="max-w-lg h-[90vh] flex flex-col p-0">
          <DialogHeader className="p-4 pb-2 border-b border-border shrink-0">
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2">
                <span>{selectedSurah?.englishName}</span>
                <span className="font-arabic text-muted-foreground">{selectedSurah?.name}</span>
              </DialogTitle>
            </div>
            {practiceAyahs.length > 0 && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Ayah {currentAyahIndex + 1} of {practiceAyahs.length}</span>
                <Progress 
                  value={((currentAyahIndex + 1) / practiceAyahs.length) * 100} 
                  className="h-1 flex-1"
                />
              </div>
            )}
          </DialogHeader>

          {practiceLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : practiceAyahs.length > 0 ? (
            <div className="flex-1 flex flex-col p-4 overflow-hidden">
              {/* Ayah Display */}
              <div className="flex-1 flex items-center justify-center">
                <div 
                  className={cn(
                    "text-center transition-all duration-300 cursor-pointer p-6 rounded-xl",
                    showAyah ? "bg-muted/50" : "bg-primary/10 hover:bg-primary/20"
                  )}
                  onClick={() => setShowAyah(!showAyah)}
                >
                  {showAyah ? (
                    <p className="font-arabic text-3xl leading-loose" dir="rtl">
                      {practiceAyahs[currentAyahIndex]?.text}
                    </p>
                  ) : (
                    <div className="space-y-3">
                      <EyeOff className="w-12 h-12 mx-auto text-primary" />
                      <p className="text-muted-foreground">Tap to reveal ayah</p>
                      <p className="text-xs text-muted-foreground">
                        Try to recite from memory first!
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Repeat Counter */}
              <div className="text-center py-2">
                <Badge variant="secondary">
                  <Repeat className="w-3 h-3 mr-1" />
                  {repeatCount}/{targetRepeatCount} repeats
                </Badge>
              </div>

              {/* Controls */}
              <div className="space-y-3 pt-4 border-t border-border">
                <div className="flex items-center justify-center gap-4">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={prevAyah}
                    disabled={currentAyahIndex === 0}
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </Button>
                  
                  <Button
                    size="lg"
                    className="w-16 h-16 rounded-full"
                    onClick={isPlaying ? stopAudio : playCurrentAyah}
                  >
                    {isPlaying ? (
                      <Pause className="w-6 h-6" />
                    ) : (
                      <Volume2 className="w-6 h-6" />
                    )}
                  </Button>
                  
                  {/* Repeat selector */}
                  <Select
                    value={targetRepeatCount.toString()}
                    onValueChange={(v) => setTargetRepeatCount(parseInt(v))}
                  >
                    <SelectTrigger className="w-20">
                      <Repeat className="w-3 h-3 mr-1" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1x</SelectItem>
                      <SelectItem value="3">3x</SelectItem>
                      <SelectItem value="5">5x</SelectItem>
                      <SelectItem value="10">10x</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={nextAyah}
                    disabled={currentAyahIndex === practiceAyahs.length - 1}
                  >
                    <ChevronRight className="w-5 h-5" />
                  </Button>
                </div>
                
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setShowAyah(!showAyah)}
                  >
                    {showAyah ? <EyeOff className="w-4 h-4 mr-2" /> : <Eye className="w-4 h-4 mr-2" />}
                    {showAyah ? 'Hide' : 'Show'}
                  </Button>
                  
                  {currentAyahIndex === practiceAyahs.length - 1 && (
                    <Button 
                      className="flex-1 bg-emerald-500 hover:bg-emerald-600"
                      onClick={markSurahMemorized}
                    >
                      <Check className="w-4 h-4 mr-2" />
                      Mark Complete
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center p-4">
              <p className="text-muted-foreground">No ayahs loaded</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}