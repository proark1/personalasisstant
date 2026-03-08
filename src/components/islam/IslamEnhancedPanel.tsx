import { useState, useEffect, useCallback, useRef } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { GlassCard as Card } from '@/components/ui/glass-card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Moon, BookOpen,
  RefreshCw, ChevronLeft, ChevronRight, Search, Loader2, 
  Volume2, VolumeX, Pause, Play, ZoomIn, ZoomOut, Heart, Clock, GraduationCap,
  Bookmark, BookmarkCheck, X, FileText, LayoutGrid, TrendingUp, Type, CheckCircle2,
  Home, MoreHorizontal
} from 'lucide-react';
import { useIslamicFeatures } from '@/hooks/useIslamicFeatures';
import { useQuranBookmarks } from '@/hooks/useQuranBookmarks';
import { useQuranReadingProgress } from '@/hooks/useQuranReadingProgress';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { PrayerTimesTab } from './PrayerTimesTab';
import { HifzTrackerTab } from './HifzTrackerTab';
import { QuranProgressPanel } from './QuranProgressPanel';
import { IslamOverviewTab } from './IslamOverviewTab';
import { IslamMoreTab } from './IslamMoreTab';
import { IslamDuasTab } from './IslamDuasTab';
import { PanelShell } from '@/components/ui/panel-shell';

// Arabic font options
const QURAN_FONTS = [
  { id: 'amiri', name: 'Amiri', fontFamily: 'Amiri, serif', description: 'Classic Naskh style' },
  { id: 'naskh', name: 'Noto Naskh', fontFamily: '"Noto Naskh Arabic", serif', description: 'Modern Naskh' },
  { id: 'scheherazade', name: 'Scheherazade', fontFamily: '"Scheherazade New", serif', description: 'Traditional Naskh' },
  { id: 'lateef', name: 'Lateef', fontFamily: 'Lateef, serif', description: 'Nastaliq style' },
];

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

interface TranslationAyah {
  numberInSurah: number;
  text: string;
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

interface Dua {
  id: string;
  category: string;
  title: string;
  arabic: string;
  transliteration: string;
  translation: string;
}

const DUAS: Dua[] = [
  // Daily
  { id: 'morning', category: 'Daily', title: 'Morning Dua', arabic: 'أَصْبَحْنَا وَأَصْبَحَ الْمُلْكُ لِلَّهِ، وَالْحَمْدُ لِلَّهِ، لَا إِلَٰهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ', transliteration: "Asbahna wa asbahal mulku lillah, walhamdu lillah, la ilaha illallahu wahdahu la sharika lah", translation: "We have reached the morning and at this very time all sovereignty belongs to Allah. All praise is for Allah. None has the right to be worshipped except Allah, alone, without partner." },
  { id: 'evening', category: 'Daily', title: 'Evening Dua', arabic: 'أَمْسَيْنَا وَأَمْسَى الْمُلْكُ لِلَّهِ، وَالْحَمْدُ لِلَّهِ، لَا إِلَٰهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ', transliteration: "Amsayna wa amsal mulku lillah, walhamdu lillah, la ilaha illallahu wahdahu la sharika lah", translation: "We have reached the evening and at this very time all sovereignty belongs to Allah. All praise is for Allah. None has the right to be worshipped except Allah, alone, without partner." },
  { id: 'sleep', category: 'Daily', title: 'Before Sleeping', arabic: 'بِاسْمِكَ اللَّهُمَّ أَمُوتُ وَأَحْيَا', transliteration: "Bismika Allahumma amutu wa ahya", translation: "In Your name O Allah, I die and I live." },
  { id: 'waking', category: 'Daily', title: 'Upon Waking Up', arabic: 'الْحَمْدُ لِلَّهِ الَّذِي أَحْيَانَا بَعْدَ مَا أَمَاتَنَا وَإِلَيْهِ النُّشُورُ', transliteration: "Alhamdu lillahil-lathee ahyana ba'da ma amatana wa ilayhin-nushoor", translation: "Praise is to Allah Who gives us life after He has caused us to die and to Him is the return." },
  { id: 'morning-protection', category: 'Daily', title: 'Morning Protection', arabic: 'اللَّهُمَّ بِكَ أَصْبَحْنَا، وَبِكَ أَمْسَيْنَا، وَبِكَ نَحْيَا، وَبِكَ نَمُوتُ وَإِلَيْكَ النُّشُورُ', transliteration: "Allahumma bika asbahna, wa bika amsayna, wa bika nahya, wa bika namutu wa ilaykan-nushur", translation: "O Allah, by Your leave we have reached the morning, by Your leave we have reached the evening, by Your leave we live and die, and to You is the resurrection." },
  // Food
  { id: 'food-before', category: 'Food', title: 'Before Eating', arabic: 'بِسْمِ اللَّهِ وَعَلَى بَرَكَةِ اللَّهِ', transliteration: "Bismillahi wa 'ala baraka-tillah", translation: "In the name of Allah and with the blessings of Allah." },
  { id: 'food-after', category: 'Food', title: 'After Eating', arabic: 'الْحَمْدُ لِلَّهِ الَّذِي أَطْعَمَنَا وَسَقَانَا وَجَعَلَنَا مُسْلِمِينَ', transliteration: "Alhamdu lillahil-lathee at'amana wa saqana wa ja'alana muslimeen", translation: "Praise be to Allah Who has fed us and given us drink and made us Muslims." },
  { id: 'food-forget', category: 'Food', title: 'Forgot Bismillah', arabic: 'بِسْمِ اللَّهِ أَوَّلَهُ وَآخِرَهُ', transliteration: "Bismillahi awwalahu wa akhirah", translation: "In the name of Allah at the beginning and at the end." },
  { id: 'fasting-break', category: 'Food', title: 'Breaking Fast', arabic: 'ذَهَبَ الظَّمَأُ وَابْتَلَّتِ الْعُرُوقُ وَثَبَتَ الْأَجْرُ إِنْ شَاءَ اللَّهُ', transliteration: "Dhahaba-zama'u wab-tallatil-'urooqu wa thabatal-ajru in sha'Allah", translation: "The thirst has gone, the veins are moistened and the reward is confirmed, if Allah wills." },
  // Travel
  { id: 'travel', category: 'Travel', title: 'Starting a Journey', arabic: 'سُبْحَانَ الَّذِي سَخَّرَ لَنَا هَٰذَا وَمَا كُنَّا لَهُ مُقْرِنِينَ وَإِنَّا إِلَىٰ رَبِّنَا لَمُنْقَلِبُونَ', transliteration: "Subhanal-lathee sakh-khara lana hatha wa ma kunna lahu muqrineen. Wa inna ila Rabbina lamunqaliboon", translation: "Glory be to Him Who has subjected this to us, and we could never have it. And to our Lord we shall return." },
  { id: 'travel-return', category: 'Travel', title: 'Returning from Journey', arabic: 'آيِبُونَ تَائِبُونَ عَابِدُونَ لِرَبِّنَا حَامِدُونَ', transliteration: "Ayibuna, ta'ibuna, 'abiduna, li Rabbina hamidun", translation: "We return, repent, worship and praise our Lord." },
  // Home
  { id: 'home-leave', category: 'Home', title: 'Leaving Home', arabic: 'بِسْمِ اللَّهِ تَوَكَّلْتُ عَلَى اللَّهِ وَلَا حَوْلَ وَلَا قُوَّةَ إِلَّا بِاللَّهِ', transliteration: "Bismillahi tawakkaltu 'alallahi wa la hawla wa la quwwata illa billah", translation: "In the name of Allah, I place my trust in Allah, and there is no might nor power except with Allah." },
  { id: 'home-enter', category: 'Home', title: 'Entering Home', arabic: 'بِسْمِ اللَّهِ وَلَجْنَا، وَبِسْمِ اللَّهِ خَرَجْنَا، وَعَلَى اللَّهِ رَبِّنَا تَوَكَّلْنَا', transliteration: "Bismillahi walajna, wa bismillahi kharajna, wa 'ala Allahi Rabbina tawakkalna", translation: "In the name of Allah we enter, in the name of Allah we leave, and upon our Lord we place our trust." },
  // Mosque
  { id: 'mosque-enter', category: 'Mosque', title: 'Entering Mosque', arabic: 'اللَّهُمَّ افْتَحْ لِي أَبْوَابَ رَحْمَتِكَ', transliteration: "Allaahum-maf-tah lee abwaaba rahmatik", translation: "O Allah, open for me the doors of Your mercy." },
  { id: 'mosque-leave', category: 'Mosque', title: 'Leaving Mosque', arabic: 'اللَّهُمَّ إِنِّي أَسْأَلُكَ مِنْ فَضْلِكَ', transliteration: "Allaahumma innee as'aluka min fadlik", translation: "O Allah, I ask You from Your favor." },
  // Distress
  { id: 'anxiety', category: 'Distress', title: 'For Anxiety & Worry', arabic: 'اللَّهُمَّ إِنِّي أَعُوذُ بِكَ مِنَ الْهَمِّ وَالْحَزَنِ', transliteration: "Allahumma inni a'udhu bika minal-hammi wal-hazan", translation: "O Allah, I seek refuge in You from anxiety and sorrow." },
  { id: 'difficulty', category: 'Distress', title: 'In Times of Difficulty', arabic: 'لَا إِلَٰهَ إِلَّا أَنْتَ سُبْحَانَكَ إِنِّي كُنْتُ مِنَ الظَّالِمِينَ', transliteration: "La ilaha illa Anta, Subhanaka, inni kuntu minaz-zalimin", translation: "There is no deity except You; exalted are You. Indeed, I have been of the wrongdoers." },
  { id: 'fear', category: 'Distress', title: 'When Afraid', arabic: 'حَسْبِيَ اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ ۖ عَلَيْهِ تَوَكَّلْتُ ۖ وَهُوَ رَبُّ الْعَرْشِ الْعَظِيمِ', transliteration: "Hasbiyallahu la ilaha illa Huwa, 'alayhi tawakkaltu, wa Huwa Rabbul-'Arshil-'Atheem", translation: "Allah is sufficient for me; there is no deity except Him. On Him I have relied, and He is the Lord of the Great Throne." },
  // Forgiveness
  { id: 'forgiveness', category: 'Forgiveness', title: 'Seeking Forgiveness', arabic: 'أَسْتَغْفِرُ اللَّهَ الَّذِي لَا إِلَٰهَ إِلَّا هُوَ الْحَيُّ الْقَيُّومُ وَأَتُوبُ إِلَيْهِ', transliteration: "Astaghfirullaha-lathee la ilaha illa Huwal-Hayyul-Qayyoomu wa atoobu ilaih", translation: "I seek the forgiveness of Allah, there is no deity except Him, the Living, the Sustainer, and I repent to Him." },
  { id: 'sayyidul-istighfar', category: 'Forgiveness', title: 'Master of Forgiveness', arabic: 'اللَّهُمَّ أَنْتَ رَبِّي لَا إِلَهَ إِلَّا أَنْتَ، خَلَقْتَنِي وَأَنَا عَبْدُكَ، وَأَنَا عَلَى عَهْدِكَ وَوَعْدِكَ مَا اسْتَطَعْتُ', transliteration: "Allahumma Anta Rabbi, la ilaha illa Anta, khalaqtani wa ana 'abduka, wa ana 'ala 'ahdika wa wa'dika mastata't", translation: "O Allah, You are my Lord, there is no deity except You. You created me and I am Your servant, and I abide by Your covenant and promise as best I can." },
  // Family
  { id: 'parents', category: 'Family', title: 'For Parents', arabic: 'رَبِّ ارْحَمْهُمَا كَمَا رَبَّيَانِي صَغِيرًا', transliteration: "Rabbir-hamhuma kama rabbayani sagheera", translation: "My Lord, have mercy upon them as they brought me up when I was small." },
  { id: 'children', category: 'Family', title: 'For Children', arabic: 'رَبَّنَا هَبْ لَنَا مِنْ أَزْوَاجِنَا وَذُرِّيَّاتِنَا قُرَّةَ أَعْيُنٍ وَاجْعَلْنَا لِلْمُتَّقِينَ إِمَامًا', transliteration: "Rabbana hab lana min azwajina wa thurriyyatina qurrata a'yunin waj'alna lil-muttaqeena imama", translation: "Our Lord, grant us from among our wives and offspring comfort to our eyes and make us an example for the righteous." },
  // Knowledge
  { id: 'knowledge', category: 'Knowledge', title: 'For Knowledge', arabic: 'رَبِّ زِدْنِي عِلْمًا', transliteration: "Rabbi zidni 'ilma", translation: "My Lord, increase me in knowledge." },
  // Health
  { id: 'sick', category: 'Health', title: 'When Sick', arabic: 'اللَّهُمَّ رَبَّ النَّاسِ أَذْهِبِ الْبَأْسَ، اشْفِهِ وَأَنْتَ الشَّافِي، لَا شِفَاءَ إِلَّا شِفَاؤُكَ، شِفَاءً لَا يُغَادِرُ سَقَمًا', transliteration: "Allahumma Rabban-nas, adhhibil-ba's, washfihi wa Antash-Shafi, la shifa'a illa shifa'uka, shifa'an la yughadiru saqama", translation: "O Allah, Lord of mankind, remove the affliction and heal, for You are the Healer. There is no healing except Your healing, a healing that leaves no disease behind." },
  // Protection
  { id: 'evil-eye', category: 'Protection', title: 'Against Evil Eye', arabic: 'أَعُوذُ بِكَلِمَاتِ اللَّهِ التَّامَّاتِ مِنْ شَرِّ مَا خَلَقَ', transliteration: "A'udhu bikalimatillahi-tammati min sharri ma khalaq", translation: "I seek refuge in the perfect words of Allah from the evil of that which He has created." },
  { id: 'morning-evening-protection', category: 'Protection', title: 'Daily Protection', arabic: 'بِسْمِ اللَّهِ الَّذِي لَا يَضُرُّ مَعَ اسْمِهِ شَيْءٌ فِي الْأَرْضِ وَلَا فِي السَّمَاءِ وَهُوَ السَّمِيعُ الْعَلِيمُ', transliteration: "Bismillahil-lathee la yadurru ma'asmihi shay'un fil-ardi wa la fis-sama'i, wa Huwas-Samee'ul-'Aleem", translation: "In the name of Allah, with Whose name nothing on earth or in heaven can cause harm, and He is the All-Hearing, the All-Knowing." },
  // Gratitude
  { id: 'gratitude-blessing', category: 'Gratitude', title: 'For Blessings', arabic: 'الْحَمْدُ لِلَّهِ الَّذِي بِنِعْمَتِهِ تَتِمُّ الصَّالِحَاتُ', transliteration: "Alhamdu lillahil-lathee bini'matihi tatimmus-salihat", translation: "Praise is to Allah, by Whose favor good deeds are completed." },
  // Prayer
  { id: 'after-adhan', category: 'Prayer', title: 'After Adhan', arabic: 'اللَّهُمَّ رَبَّ هَذِهِ الدَّعْوَةِ التَّامَّةِ وَالصَّلَاةِ الْقَائِمَةِ آتِ مُحَمَّدًا الْوَسِيلَةَ وَالْفَضِيلَةَ', transliteration: "Allahumma Rabba hadhihid-da'watit-tammah, was-salatil-qa'imah, ati Muhammadanil-waseelata wal-fadeelah", translation: "O Allah, Lord of this perfect call and established prayer, grant Muhammad the intercession and virtue." },
  { id: 'in-sujood', category: 'Prayer', title: 'In Prostration', arabic: 'سُبْحَانَ رَبِّيَ الْأَعْلَى', transliteration: "Subhana Rabbiyal-A'la", translation: "Glory be to my Lord, the Most High." },
  // Patience
  { id: 'calamity', category: 'Patience', title: 'Upon Calamity', arabic: 'إِنَّا لِلَّهِ وَإِنَّا إِلَيْهِ رَاجِعُونَ، اللَّهُمَّ أْجُرْنِي فِي مُصِيبَتِي وَأَخْلِفْ لِي خَيْرًا مِنْهَا', transliteration: "Inna lillahi wa inna ilayhi raji'un. Allahumma'jurni fi museebati wakhluf li khayran minha", translation: "Indeed we belong to Allah, and indeed to Him we will return. O Allah, reward me in my calamity and replace it with something better." },
  // Guidance
  { id: 'istikhara', category: 'Guidance', title: 'Istikhara (Guidance)', arabic: 'اللَّهُمَّ إِنِّي أَسْتَخِيرُكَ بِعِلْمِكَ، وَأَسْتَقْدِرُكَ بِقُدْرَتِكَ، وَأَسْأَلُكَ مِنْ فَضْلِكَ الْعَظِيمِ', transliteration: "Allahumma inni astakhiruka bi'ilmika, wa astaqdiruka biqudratika, wa as'aluka min fadlikal-'atheem", translation: "O Allah, I seek Your guidance by virtue of Your knowledge, and I seek ability by virtue of Your power, and I ask You of Your great bounty." },
  { id: 'steadfastness', category: 'Guidance', title: 'For Steadfastness', arabic: 'يَا مُقَلِّبَ الْقُلُوبِ ثَبِّتْ قَلْبِي عَلَى دِينِكَ', transliteration: "Ya Muqallibal-qulubi, thabbit qalbi 'ala deenika", translation: "O Turner of the hearts, make my heart firm upon Your religion." },
  // Death
  { id: 'deceased', category: 'Death', title: 'For the Deceased', arabic: 'اللَّهُمَّ اغْفِرْ لَهُ وَارْحَمْهُ وَعَافِهِ وَاعْفُ عَنْهُ', transliteration: "Allahummaghfir lahu warhamhu wa 'afihi wa'fu 'anhu", translation: "O Allah, forgive him, have mercy on him, grant him well-being, and pardon him." },
  // Misc
  { id: 'mirror', category: 'Misc', title: 'Looking in Mirror', arabic: 'اللَّهُمَّ أَنْتَ حَسَّنْتَ خَلْقِي فَحَسِّنْ خُلُقِي', transliteration: "Allahumma Anta hassanta khalqi fahassin khuluqi", translation: "O Allah, You have made my creation good, so make my character good." },
  { id: 'sneezing', category: 'Misc', title: 'After Sneezing', arabic: 'الْحَمْدُ لِلَّهِ', transliteration: "Alhamdulillah", translation: "Praise be to Allah." },
  { id: 'bathroom-enter', category: 'Misc', title: 'Entering Bathroom', arabic: 'اللَّهُمَّ إِنِّي أَعُوذُ بِكَ مِنَ الْخُبُثِ وَالْخَبَائِثِ', transliteration: "Allahumma inni a'udhu bika minal-khubuthi wal-khaba'ith", translation: "O Allah, I seek refuge with You from male and female devils." },
];

// Helper to parse tajweed markup
function parseTajweedMarkup(text: string): string {
  return text
    .replace(/\[h\]/g, '<span class="tajweed-ham_wasl">')
    .replace(/\[\/h\]/g, '</span>')
    .replace(/\[s\]/g, '<span class="tajweed-silent">')
    .replace(/\[\/s\]/g, '</span>')
    .replace(/\[l\]/g, '<span class="tajweed-lpieces">')
    .replace(/\[\/l\]/g, '</span>')
    .replace(/\[n\]/g, '<span class="tajweed-normal">')
    .replace(/\[\/n\]/g, '</span>')
    .replace(/\[u\]/g, '<span class="tajweed-madda_permissible">')
    .replace(/\[\/u\]/g, '</span>')
    .replace(/\[i\]/g, '<span class="tajweed-ikhfaa">')
    .replace(/\[\/i\]/g, '</span>')
    .replace(/\[a\]/g, '<span class="tajweed-idghaam_no_ghunna">')
    .replace(/\[\/a\]/g, '</span>')
    .replace(/\[q\]/g, '<span class="tajweed-qalqala">')
    .replace(/\[\/q\]/g, '</span>')
    .replace(/\[m\]/g, '<span class="tajweed-madda_necessary">')
    .replace(/\[\/m\]/g, '</span>')
    .replace(/\[g\]/g, '<span class="tajweed-ghunna">')
    .replace(/\[\/g\]/g, '</span>')
    .replace(/\[o\]/g, '<span class="tajweed-madda_obligatory">')
    .replace(/\[\/o\]/g, '</span>')
    .replace(/\[d\]/g, '<span class="tajweed-idghaam_ghunna">')
    .replace(/\[\/d\]/g, '</span>')
    .replace(/\[b\]/g, '<span class="tajweed-iqlab">')
    .replace(/\[\/b\]/g, '</span>')
    .replace(/\[p\]/g, '<span class="tajweed-ikhfaa_shafawi">')
    .replace(/\[\/p\]/g, '</span>');
}

export function IslamEnhancedPanel() {
  const {
    hijriToday,
    islamicEvents,
    dhikrLogs,
    dhikrTypes,
    incrementDhikr,
    resetDhikr,
    loading: islamicLoading,
  } = useIslamicFeatures();
  
  const { bookmarks, isBookmarked, addBookmark, removeBookmarkByAyah, updateBookmarkNote, getBookmark } = useQuranBookmarks();
  const { markAyahAsRead, isAyahRead, getSurahProgress, todayAyahsRead, goal, todayGoalProgress } = useQuranReadingProgress();

  const [activeTab, setActiveTab] = useState('home');
  const [showProgressPanel, setShowProgressPanel] = useState(false);

  // Prayer countdown state (shared with overview)
  const [nextPrayerName, setNextPrayerName] = useState<string | undefined>();
  const [nextPrayerTime, setNextPrayerTime] = useState<string | undefined>();
  const [countdown, setCountdown] = useState<string | undefined>();

  // Quran state
  const [surahs, setSurahs] = useState<Surah[]>([]);
  const [selectedSurah, setSelectedSurah] = useState<SurahDetail | null>(null);
  const [currentAyahIndex, setCurrentAyahIndex] = useState(0);
  const [quranLoading, setQuranLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSurahList, setShowSurahList] = useState(true);
  const [showBookmarks, setShowBookmarks] = useState(false);
  const [fontSize, setFontSize] = useState(28);
  const [tajweedEnabled, setTajweedEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('quran-tajweed-enabled');
    return saved === 'true';
  });
  const [quranViewMode, setQuranViewMode] = useState<'cards' | 'page'>(() => {
    const saved = localStorage.getItem('quran-view-mode');
    return (saved as 'cards' | 'page') || 'cards';
  });
  const [selectedFont, setSelectedFont] = useState<string>(() => {
    return localStorage.getItem('quran-font') || 'amiri';
  });
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [currentPlayingAyah, setCurrentPlayingAyah] = useState<number | null>(null);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');
  const [showTranslation, setShowTranslation] = useState(false);
  const [translationAyahs, setTranslationAyahs] = useState<TranslationAyah[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Get current font family
  const currentFontFamily = QURAN_FONTS.find(f => f.id === selectedFont)?.fontFamily || 'Amiri, serif';

  const handleFontChange = (fontId: string) => {
    setSelectedFont(fontId);
    localStorage.setItem('quran-font', fontId);
    document.documentElement.style.setProperty('--quran-font', QURAN_FONTS.find(f => f.id === fontId)?.fontFamily.split(',')[0].replace(/"/g, '') || 'Amiri');
  };

  const fetchSurahs = async () => {
    try {
      const response = await fetch('https://api.alquran.cloud/v1/surah');
      const data = await response.json();
      if (data.code === 200) setSurahs(data.data);
    } catch { toast.error('Failed to load surahs'); }
  };

  const fetchSurah = async (surahNumber: number, useTajweed: boolean = tajweedEnabled) => {
    setQuranLoading(true);
    try {
      const audioResponse = await fetch(`https://api.alquran.cloud/v1/surah/${surahNumber}/ar.alafasy`);
      const audioData = await audioResponse.json();
      
      if (useTajweed) {
        const tajweedResponse = await fetch(`https://api.alquran.cloud/v1/surah/${surahNumber}/quran-tajweed`);
        const tajweedData = await tajweedResponse.json();
        if (tajweedData.code === 200 && audioData.code === 200) {
          const mergedAyahs = tajweedData.data.ayahs.map((ayah: Ayah, index: number) => ({
            ...ayah, text: parseTajweedMarkup(ayah.text), audio: audioData.data.ayahs[index]?.audio || undefined
          }));
          setSelectedSurah({ ...tajweedData.data, ayahs: mergedAyahs });
          setCurrentAyahIndex(0);
          setShowSurahList(false);
        }
      } else {
        if (audioData.code === 200) {
          setSelectedSurah(audioData.data);
          setCurrentAyahIndex(0);
          setShowSurahList(false);
        }
      }

      // Fetch translation if enabled
      if (showTranslation) {
        fetchTranslation(surahNumber);
      }
    } catch { toast.error('Failed to load surah'); }
    finally { setQuranLoading(false); }
  };

  const fetchTranslation = async (surahNumber: number) => {
    try {
      const res = await fetch(`https://api.alquran.cloud/v1/surah/${surahNumber}/en.sahih`);
      const data = await res.json();
      if (data.code === 200) {
        setTranslationAyahs(data.data.ayahs.map((a: any) => ({ numberInSurah: a.numberInSurah, text: a.text })));
      }
    } catch { /* silent */ }
  };

  const toggleTranslation = () => {
    const next = !showTranslation;
    setShowTranslation(next);
    if (next && selectedSurah && translationAyahs.length === 0) {
      fetchTranslation(selectedSurah.number);
    }
  };

  const toggleTajweed = async () => {
    const newValue = !tajweedEnabled;
    setTajweedEnabled(newValue);
    localStorage.setItem('quran-tajweed-enabled', newValue.toString());
    if (selectedSurah) await fetchSurah(selectedSurah.number, newValue);
  };

  const toggleViewMode = () => {
    const newMode = quranViewMode === 'cards' ? 'page' : 'cards';
    setQuranViewMode(newMode);
    localStorage.setItem('quran-view-mode', newMode);
  };

  const toArabicIndic = (num: number): string => {
    const ai = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
    return num.toString().split('').map(d => ai[parseInt(d)]).join('');
  };

  const playAyahAudio = (ayah: Ayah) => {
    if (audioRef.current) audioRef.current.pause();
    if (ayah.audio) {
      const audio = new Audio(ayah.audio);
      audioRef.current = audio;
      audio.onplay = () => { setIsPlayingAudio(true); setCurrentPlayingAyah(ayah.numberInSurah); };
      audio.onended = () => {
        setIsPlayingAudio(false); setCurrentPlayingAyah(null);
        const idx = selectedSurah?.ayahs.findIndex(a => a.numberInSurah === ayah.numberInSurah) || 0;
        const next = selectedSurah?.ayahs[idx + 1];
        if (next?.audio) playAyahAudio(next);
      };
      audio.onerror = () => { setIsPlayingAudio(false); setCurrentPlayingAyah(null); };
      audio.play().catch(console.error);
    } else {
      playArabicTTS(ayah.text, ayah.numberInSurah);
    }
  };

  const playArabicTTS = async (text: string, ayahNumber: number) => {
    setCurrentPlayingAyah(ayahNumber);
    try {
      const { data, error } = await supabase.functions.invoke('text-to-speech', { body: { text, voice: 'alloy' } });
      if (error) throw error;
      const audio = new Audio(`data:audio/mp3;base64,${data.audioContent}`);
      audioRef.current = audio;
      audio.onended = () => setCurrentPlayingAyah(null);
      await audio.play();
    } catch { setCurrentPlayingAyah(null); }
  };

  const stopAudio = () => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    setIsPlayingAudio(false);
    setCurrentPlayingAyah(null);
  };

  const stripHtml = (html: string): string => {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
  };

  const handleBookmarkToggle = async (ayah: Ayah) => {
    if (!selectedSurah) return;
    if (isBookmarked(selectedSurah.number, ayah.numberInSurah)) {
      await removeBookmarkByAyah(selectedSurah.number, ayah.numberInSurah);
    } else {
      const plainText = stripHtml(ayah.text);
      await addBookmark(selectedSurah.number, selectedSurah.name, selectedSurah.englishName, ayah.numberInSurah, plainText);
    }
  };

  const navigateToBookmark = async (bookmark: { surah_number: number; ayah_number: number }) => {
    await fetchSurah(bookmark.surah_number);
    setCurrentAyahIndex(Math.floor((bookmark.ayah_number - 1) / AYAHS_PER_PAGE) * AYAHS_PER_PAGE);
    setShowBookmarks(false);
  };

  useEffect(() => {
    if (activeTab === 'quran' && surahs.length === 0) fetchSurahs();
  }, [activeTab, surahs.length]);

  useEffect(() => {
    return () => { if (audioRef.current) audioRef.current.pause(); };
  }, []);

  const filteredSurahs = surahs.filter(s =>
    s.englishName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.name.includes(searchQuery) || s.number.toString() === searchQuery
  );

  const AYAHS_PER_PAGE = 10;
  const totalPages = selectedSurah ? Math.ceil(selectedSurah.ayahs.length / AYAHS_PER_PAGE) : 0;
  const currentPage = Math.floor(currentAyahIndex / AYAHS_PER_PAGE);
  const currentPageAyahs = selectedSurah?.ayahs.slice(currentPage * AYAHS_PER_PAGE, (currentPage + 1) * AYAHS_PER_PAGE) || [];

  const getTranslation = (ayahNum: number) => translationAyahs.find(t => t.numberInSurah === ayahNum)?.text;

  return (
    <PanelShell
      icon={Moon}
      title="Islamic Features"
      subtitle={`${hijriToday.day} ${hijriToday.monthName} ${hijriToday.year} هـ`}
      noPadding
    >
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <TabsList className="mx-3 md:mx-4 mt-2 grid grid-cols-5">
          <TabsTrigger value="home" className="gap-1 text-xs px-1">
            <Home className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Home</span>
          </TabsTrigger>
          <TabsTrigger value="prayer" className="gap-1 text-xs px-1">
            <Clock className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Prayer</span>
          </TabsTrigger>
          <TabsTrigger value="quran" className="gap-1 text-xs px-1">
            <BookOpen className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Quran</span>
          </TabsTrigger>
          <TabsTrigger value="duas" className="gap-1 text-xs px-1">
            <Heart className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Duas</span>
          </TabsTrigger>
          <TabsTrigger value="more" className="gap-1 text-xs px-1">
            <MoreHorizontal className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">More</span>
          </TabsTrigger>
        </TabsList>

        {/* Home / Overview */}
        <TabsContent value="home" className="flex-1 mt-0 overflow-y-auto">
          <IslamOverviewTab
            hijriToday={hijriToday}
            islamicEvents={islamicEvents}
            dhikrTypes={dhikrTypes}
            dhikrLogs={dhikrLogs}
            incrementDhikr={incrementDhikr}
            resetDhikr={resetDhikr}
            nextPrayerName={nextPrayerName}
            nextPrayerTime={nextPrayerTime}
            countdown={countdown}
            onNavigate={setActiveTab}
          />
        </TabsContent>

        {/* Prayer Times */}
        <TabsContent value="prayer" className="flex-1 mt-0">
          <PrayerTimesTab
            onPrayerUpdate={(name, time, cd) => {
              setNextPrayerName(name);
              setNextPrayerTime(time);
              setCountdown(cd);
            }}
          />
        </TabsContent>

        {/* Duas */}
        <TabsContent value="duas" className="flex-1 mt-0">
          <IslamDuasTab duas={DUAS} />
        </TabsContent>

        {/* More: Qibla + Hadith + Calendar */}
        <TabsContent value="more" className="flex-1 mt-0">
          <IslamMoreTab hijriToday={hijriToday} islamicEvents={islamicEvents} />
        </TabsContent>

        {/* Quran Reader */}
        <TabsContent value="quran" className="flex-1 mt-0">
          <div className="flex flex-col h-full">
            {showBookmarks ? (
              <>
                <div className="p-3 border-b border-border flex items-center justify-between">
                  <Button variant="ghost" size="sm" onClick={() => setShowBookmarks(false)}>
                    <ChevronLeft className="w-4 h-4 mr-1" /> Back
                  </Button>
                  <p className="font-medium">Bookmarks ({bookmarks.length})</p>
                  <div className="w-16" />
                </div>
                <ScrollArea className="flex-1">
                  <div className="p-4 space-y-3">
                    {bookmarks.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Bookmark className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        <p>No bookmarks yet</p>
                        <p className="text-sm">Tap the bookmark icon on any ayah to save it</p>
                      </div>
                    ) : (
                      bookmarks.map((bm) => (
                        <Card key={bm.id} className="p-4">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div>
                              <Badge variant="secondary" className="mb-1">
                                {bm.surah_english_name} · Ayah {bm.ayah_number}
                              </Badge>
                              <p className="text-xs text-muted-foreground font-arabic">{bm.surah_name}</p>
                            </div>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive"
                              onClick={() => removeBookmarkByAyah(bm.surah_number, bm.ayah_number)}>
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                          <p className="font-arabic text-lg text-right leading-loose mb-3" dir="rtl">{bm.ayah_text}</p>
                          {editingNoteId === bm.id ? (
                            <div className="space-y-2">
                              <Textarea value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="Add a note..." className="min-h-[60px]" />
                              <div className="flex gap-2">
                                <Button size="sm" onClick={() => { updateBookmarkNote(bm.id, noteText); setEditingNoteId(null); }}>Save</Button>
                                <Button size="sm" variant="outline" onClick={() => setEditingNoteId(null)}>Cancel</Button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <Button variant="outline" size="sm" onClick={() => navigateToBookmark(bm)}>
                                <BookOpen className="w-4 h-4 mr-1" /> Go to Ayah
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => { setNoteText(bm.note || ''); setEditingNoteId(bm.id); }}>
                                {bm.note ? 'Edit Note' : 'Add Note'}
                              </Button>
                            </div>
                          )}
                          {bm.note && editingNoteId !== bm.id && (
                            <p className="text-sm text-muted-foreground mt-2 italic">Note: {bm.note}</p>
                          )}
                        </Card>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </>
            ) : showProgressPanel ? (
              <>
                <div className="p-3 border-b border-border flex items-center justify-between">
                  <Button variant="ghost" size="sm" onClick={() => setShowProgressPanel(false)}>
                    <ChevronLeft className="w-4 h-4 mr-1" /> Back
                  </Button>
                  <p className="font-medium">Reading Progress</p>
                  <div className="w-16" />
                </div>
                <ScrollArea className="flex-1">
                  <QuranProgressPanel />
                </ScrollArea>
              </>
            ) : showSurahList ? (
              <>
                <div className="p-4 border-b border-border space-y-3">
                  <Card className="p-3 bg-gradient-to-r from-primary/10 to-emerald-500/10 border-primary/20 cursor-pointer hover:bg-primary/15 transition-colors"
                    onClick={() => setShowProgressPanel(true)}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-primary" />
                        <span className="text-sm font-medium">Today's Progress</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold">{todayAyahsRead}/{goal?.daily_ayahs_goal || 10}</span>
                        {goal && todayAyahsRead >= goal.daily_ayahs_goal && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      </div>
                    </div>
                  </Card>

                  {/* Resume reading card */}
                  {(() => {
                    const lastRead = localStorage.getItem('quran-last-read');
                    if (!lastRead) return null;
                    try {
                      const { surahNumber, surahName, englishName, ayah } = JSON.parse(lastRead);
                      return (
                        <Card
                          pressable
                          haptic="light"
                          className="p-3 border-primary/20"
                          onClick={() => fetchSurah(surahNumber)}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <BookOpen className="w-4 h-4 text-primary" />
                              <div>
                                <span className="text-sm font-medium">Continue Reading</span>
                                <p className="text-xs text-muted-foreground">{englishName} · Ayah {ayah}</p>
                              </div>
                            </div>
                            <ChevronRight className="w-4 h-4 text-muted-foreground" />
                          </div>
                        </Card>
                      );
                    } catch { return null; }
                  })()}

                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input placeholder="Search surahs..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
                    </div>
                    <Button variant="outline" size="icon" onClick={() => setShowBookmarks(true)} className="relative">
                      <Bookmark className="w-4 h-4" />
                      {bookmarks.length > 0 && (
                        <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary text-primary-foreground text-xs rounded-full flex items-center justify-center">{bookmarks.length}</span>
                      )}
                    </Button>
                  </div>
                  {/* Hifz quick link */}
                  <div className="flex gap-2">
                    <Select value={selectedFont} onValueChange={handleFontChange}>
                      <SelectTrigger className="flex-1 h-9">
                        <SelectValue placeholder="Select font" />
                      </SelectTrigger>
                      <SelectContent>
                        {QURAN_FONTS.map(f => (
                          <SelectItem key={f.id} value={f.id}>
                            <span style={{ fontFamily: f.fontFamily }}>{f.name}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button variant="outline" size="sm" className="gap-1 h-9" onClick={() => {
                      setActiveTab('quran');
                      setShowSurahList(false);
                      setSelectedSurah(null);
                    }}>
                      <GraduationCap className="w-4 h-4" />
                      Hifz
                    </Button>
                  </div>
                </div>
                <ScrollArea className="flex-1">
                  <div className="p-2 space-y-1">
                    {filteredSurahs.map(surah => {
                      const progress = getSurahProgress(surah.number, surah.numberOfAyahs);
                      return (
                        <Card key={surah.number} pressable haptic="light" className="p-3"
                          onClick={() => {
                            fetchSurah(surah.number);
                            // Save last read position
                            localStorage.setItem('quran-last-read', JSON.stringify({
                              surahNumber: surah.number,
                              surahName: surah.name,
                              englishName: surah.englishName,
                              ayah: 1,
                            }));
                          }}>
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "w-10 h-10 rounded-full flex items-center justify-center",
                              progress.percentage === 100 ? "bg-emerald-500/20 text-emerald-600" :
                                progress.percentage > 0 ? "bg-primary/10" : "bg-muted"
                            )}>
                              {progress.percentage === 100 ? <CheckCircle2 className="w-5 h-5" /> :
                                <span className="text-sm font-bold">{surah.number}</span>}
                            </div>
                            <div className="flex-1">
                              <p className="font-medium">{surah.englishName}</p>
                              <div className="flex items-center gap-2">
                                <p className="text-xs text-muted-foreground">{surah.englishNameTranslation} · {surah.numberOfAyahs} ayahs</p>
                                {progress.percentage > 0 && progress.percentage < 100 && (
                                  <Badge variant="secondary" className="text-xs h-5">{progress.read}/{progress.total}</Badge>
                                )}
                              </div>
                            </div>
                            <p className="text-lg" style={{ fontFamily: currentFontFamily }}>{surah.name}</p>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                </ScrollArea>
              </>
            ) : !selectedSurah ? (
              /* Hifz Tracker inline */
              <>
                <div className="p-3 border-b border-border">
                  <Button variant="ghost" size="sm" onClick={() => setShowSurahList(true)}>
                    <ChevronLeft className="w-4 h-4 mr-1" /> Surah List
                  </Button>
                </div>
                <HifzTrackerTab />
              </>
            ) : (
              <>
                <div className="p-3 border-b border-border flex items-center justify-between">
                  <Button variant="ghost" size="sm" onClick={() => { setShowSurahList(true); stopAudio(); }}>
                    <ChevronLeft className="w-4 h-4 mr-1" /> Back
                  </Button>
                  <div className="text-center">
                    <p className="font-medium">{selectedSurah?.englishName}</p>
                    <p className="text-xs text-muted-foreground font-arabic">{selectedSurah?.name}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant={quranViewMode === 'page' ? "secondary" : "ghost"} size="sm" className="text-xs h-8 px-2"
                      onClick={toggleViewMode}>
                      {quranViewMode === 'cards' ? <FileText className="w-4 h-4" /> : <LayoutGrid className="w-4 h-4" />}
                    </Button>
                    <Button variant={tajweedEnabled ? "secondary" : "ghost"} size="sm" className="text-xs h-8 px-2"
                      onClick={toggleTajweed}>Tajweed</Button>
                    <Button variant={showTranslation ? "secondary" : "ghost"} size="sm" className="text-xs h-8 px-2"
                      onClick={toggleTranslation}>EN</Button>
                    <Button variant="ghost" size="sm" className="text-xs h-8 px-2"
                      onClick={() => setFontSize(Math.min(fontSize + 4, 48))}>
                      <ZoomIn className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm" className="text-xs h-8 px-2"
                      onClick={() => setFontSize(Math.max(fontSize - 4, 16))}>
                      <ZoomOut className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {quranViewMode === 'page' ? (
                  <ScrollArea className="flex-1">
                    <div className="p-4 space-y-4">
                      <Card className="p-4 text-center">
                        <p className="font-arabic text-2xl" style={{ fontFamily: currentFontFamily }}>{selectedSurah?.name}</p>
                        <p className="text-sm text-muted-foreground mt-1">{selectedSurah?.englishName} - {selectedSurah?.englishNameTranslation}</p>
                      </Card>
                      <div className="p-6 bg-gradient-to-b from-muted/30 to-muted/10 rounded-xl border border-border/50" dir="rtl">
                        <p className="leading-[2.5] text-right" style={{ fontSize: `${fontSize}px`, fontFamily: currentFontFamily }}>
                          {selectedSurah?.ayahs.map(ayah => {
                            const ayahIsRead = selectedSurah && isAyahRead(selectedSurah.number, ayah.numberInSurah);
                            return (
                              <span key={ayah.numberInSurah}
                                className={cn("cursor-pointer hover:bg-primary/10 rounded transition-colors inline",
                                  currentPlayingAyah === ayah.numberInSurah && "bg-primary/20 text-primary",
                                  ayahIsRead && "opacity-70")}
                                onClick={() => {
                                  if (currentPlayingAyah === ayah.numberInSurah) stopAudio();
                                  else { playAyahAudio(ayah); if (selectedSurah) markAyahAsRead(selectedSurah.number, ayah.numberInSurah); }
                                }}>
                                {tajweedEnabled ? <span dangerouslySetInnerHTML={{ __html: ayah.text }} /> : ayah.text}
                                <span className={cn("inline-flex items-center justify-center mx-1", ayahIsRead ? "text-emerald-500" : "text-primary/80")}
                                  style={{ fontSize: `${fontSize * 0.6}px` }}>
                                  ﴿{toArabicIndic(ayah.numberInSurah)}﴾
                                </span>{' '}
                              </span>
                            );
                          })}
                        </p>
                      </div>
                      {/* Translation block */}
                      {showTranslation && translationAyahs.length > 0 && (
                        <div className="space-y-2 mt-4">
                          <h4 className="text-sm font-medium text-muted-foreground">English Translation (Sahih International)</h4>
                          {translationAyahs.map(t => (
                            <p key={t.numberInSurah} className="text-sm">
                              <span className="font-medium text-primary">{t.numberInSurah}.</span> {t.text}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                ) : (
                  <ScrollArea className="flex-1">
                    <div className="p-4 space-y-4">
                      {currentPageAyahs.map(ayah => {
                        const ayahIsRead = selectedSurah && isAyahRead(selectedSurah.number, ayah.numberInSurah);
                        const translation = getTranslation(ayah.numberInSurah);
                        return (
                          <Card key={ayah.numberInSurah}
                            className={cn("p-4 transition-all",
                              currentPlayingAyah === ayah.numberInSurah && "ring-2 ring-primary bg-primary/5",
                              ayahIsRead && "border-emerald-500/30 bg-emerald-500/5")}>
                            <div className="flex items-start gap-3">
                              <div className="flex flex-col items-center gap-1">
                                <Badge variant="outline" className={cn("w-8 h-8 rounded-full p-0 flex items-center justify-center",
                                  ayahIsRead && "border-emerald-500 text-emerald-600")}>
                                  {ayahIsRead ? <CheckCircle2 className="w-4 h-4" /> : ayah.numberInSurah}
                                </Badge>
                                <Button variant="ghost" size="icon" className="h-8 w-8"
                                  onClick={() => {
                                    if (currentPlayingAyah === ayah.numberInSurah) stopAudio();
                                    else { playAyahAudio(ayah); if (selectedSurah) markAyahAsRead(selectedSurah.number, ayah.numberInSurah); }
                                  }}>
                                  {currentPlayingAyah === ayah.numberInSurah ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                                </Button>
                                <Button variant="ghost" size="icon"
                                  className={cn("h-8 w-8", selectedSurah && isBookmarked(selectedSurah.number, ayah.numberInSurah) && "text-amber-500")}
                                  onClick={() => handleBookmarkToggle(ayah)}>
                                  {selectedSurah && isBookmarked(selectedSurah.number, ayah.numberInSurah) ?
                                    <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
                                </Button>
                              </div>
                              <div className="flex-1">
                                {tajweedEnabled ? (
                                  <p className="text-right leading-loose tajweed-text"
                                    style={{ fontSize: `${fontSize}px`, fontFamily: currentFontFamily }} dir="rtl"
                                    dangerouslySetInnerHTML={{ __html: ayah.text }} />
                                ) : (
                                  <p className="text-right leading-loose"
                                    style={{ fontSize: `${fontSize}px`, fontFamily: currentFontFamily }} dir="rtl">
                                    {ayah.text}
                                  </p>
                                )}
                                {showTranslation && translation && (
                                  <p className="text-sm text-muted-foreground mt-2 pt-2 border-t border-border/50">{translation}</p>
                                )}
                              </div>
                            </div>
                          </Card>
                        );
                      })}
                    </div>
                  </ScrollArea>
                )}

                {/* Pagination */}
                {selectedSurah && totalPages > 1 && quranViewMode === 'cards' && (
                  <div className="p-3 border-t border-border flex items-center justify-between">
                    <Button variant="outline" size="sm" disabled={currentPage === 0}
                      onClick={() => setCurrentAyahIndex((currentPage - 1) * AYAHS_PER_PAGE)}>
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <span className="text-sm text-muted-foreground">Page {currentPage + 1} of {totalPages}</span>
                    <Button variant="outline" size="sm" disabled={currentPage >= totalPages - 1}
                      onClick={() => setCurrentAyahIndex((currentPage + 1) * AYAHS_PER_PAGE)}>
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                )}

                {/* Floating audio indicator */}
                {currentPlayingAyah !== null && (
                  <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50">
                    <Card className="px-4 py-2 bg-primary text-primary-foreground shadow-lg flex items-center gap-2">
                      <Volume2 className="w-4 h-4 animate-pulse" />
                      <span className="text-sm font-medium">Playing Ayah {currentPlayingAyah}</span>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-primary-foreground hover:text-primary-foreground/80"
                        onClick={stopAudio}>
                        <X className="w-4 h-4" />
                      </Button>
                    </Card>
                  </div>
                )}
              </>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </PanelShell>
  );
}
