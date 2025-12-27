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
  Volume2, VolumeX, Pause, Play, ZoomIn, ZoomOut, Heart
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
  {
    id: 'morning',
    category: 'Daily',
    title: 'Morning Dua',
    arabic: 'أَصْبَحْنَا وَأَصْبَحَ الْمُلْكُ لِلَّهِ، وَالْحَمْدُ لِلَّهِ، لَا إِلَٰهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ',
    transliteration: "Asbahna wa asbahal mulku lillah, walhamdu lillah, la ilaha illallahu wahdahu la sharika lah",
    translation: "We have reached the morning and at this very time all sovereignty belongs to Allah. All praise is for Allah. None has the right to be worshipped except Allah, alone, without partner."
  },
  {
    id: 'evening',
    category: 'Daily',
    title: 'Evening Dua',
    arabic: 'أَمْسَيْنَا وَأَمْسَى الْمُلْكُ لِلَّهِ، وَالْحَمْدُ لِلَّهِ، لَا إِلَٰهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ',
    transliteration: "Amsayna wa amsal mulku lillah, walhamdu lillah, la ilaha illallahu wahdahu la sharika lah",
    translation: "We have reached the evening and at this very time all sovereignty belongs to Allah. All praise is for Allah. None has the right to be worshipped except Allah, alone, without partner."
  },
  {
    id: 'sleep',
    category: 'Daily',
    title: 'Before Sleeping',
    arabic: 'بِاسْمِكَ اللَّهُمَّ أَمُوتُ وَأَحْيَا',
    transliteration: "Bismika Allahumma amutu wa ahya",
    translation: "In Your name O Allah, I die and I live."
  },
  {
    id: 'waking',
    category: 'Daily',
    title: 'Upon Waking Up',
    arabic: 'الْحَمْدُ لِلَّهِ الَّذِي أَحْيَانَا بَعْدَ مَا أَمَاتَنَا وَإِلَيْهِ النُّشُورُ',
    transliteration: "Alhamdu lillahil-lathee ahyana ba'da ma amatana wa ilayhin-nushoor",
    translation: "Praise is to Allah Who gives us life after He has caused us to die and to Him is the return."
  },
  {
    id: 'morning-protection',
    category: 'Daily',
    title: 'Morning Protection',
    arabic: 'اللَّهُمَّ بِكَ أَصْبَحْنَا، وَبِكَ أَمْسَيْنَا، وَبِكَ نَحْيَا، وَبِكَ نَمُوتُ وَإِلَيْكَ النُّشُورُ',
    transliteration: "Allahumma bika asbahna, wa bika amsayna, wa bika nahya, wa bika namutu wa ilaykan-nushur",
    translation: "O Allah, by Your leave we have reached the morning, by Your leave we have reached the evening, by Your leave we live and die, and to You is the resurrection."
  },
  // Food
  {
    id: 'food-before',
    category: 'Food',
    title: 'Before Eating',
    arabic: 'بِسْمِ اللَّهِ وَعَلَى بَرَكَةِ اللَّهِ',
    transliteration: "Bismillahi wa 'ala baraka-tillah",
    translation: "In the name of Allah and with the blessings of Allah."
  },
  {
    id: 'food-after',
    category: 'Food',
    title: 'After Eating',
    arabic: 'الْحَمْدُ لِلَّهِ الَّذِي أَطْعَمَنَا وَسَقَانَا وَجَعَلَنَا مُسْلِمِينَ',
    transliteration: "Alhamdu lillahil-lathee at'amana wa saqana wa ja'alana muslimeen",
    translation: "Praise be to Allah Who has fed us and given us drink and made us Muslims."
  },
  {
    id: 'food-forget',
    category: 'Food',
    title: 'Forgot Bismillah',
    arabic: 'بِسْمِ اللَّهِ أَوَّلَهُ وَآخِرَهُ',
    transliteration: "Bismillahi awwalahu wa akhirah",
    translation: "In the name of Allah at the beginning and at the end."
  },
  {
    id: 'fasting-break',
    category: 'Food',
    title: 'Breaking Fast',
    arabic: 'ذَهَبَ الظَّمَأُ وَابْتَلَّتِ الْعُرُوقُ وَثَبَتَ الْأَجْرُ إِنْ شَاءَ اللَّهُ',
    transliteration: "Dhahaba-zama'u wab-tallatil-'urooqu wa thabatal-ajru in sha'Allah",
    translation: "The thirst has gone, the veins are moistened and the reward is confirmed, if Allah wills."
  },
  // Travel
  {
    id: 'travel',
    category: 'Travel',
    title: 'Starting a Journey',
    arabic: 'سُبْحَانَ الَّذِي سَخَّرَ لَنَا هَٰذَا وَمَا كُنَّا لَهُ مُقْرِنِينَ وَإِنَّا إِلَىٰ رَبِّنَا لَمُنْقَلِبُونَ',
    transliteration: "Subhanal-lathee sakh-khara lana hatha wa ma kunna lahu muqrineen. Wa inna ila Rabbina lamunqaliboon",
    translation: "Glory be to Him Who has subjected this to us, and we could never have it. And to our Lord we shall return."
  },
  {
    id: 'travel-return',
    category: 'Travel',
    title: 'Returning from Journey',
    arabic: 'آيِبُونَ تَائِبُونَ عَابِدُونَ لِرَبِّنَا حَامِدُونَ',
    transliteration: "Ayibuna, ta'ibuna, 'abiduna, li Rabbina hamidun",
    translation: "We return, repent, worship and praise our Lord."
  },
  // Home
  {
    id: 'home-leave',
    category: 'Home',
    title: 'Leaving Home',
    arabic: 'بِسْمِ اللَّهِ تَوَكَّلْتُ عَلَى اللَّهِ وَلَا حَوْلَ وَلَا قُوَّةَ إِلَّا بِاللَّهِ',
    transliteration: "Bismillahi tawakkaltu 'alallahi wa la hawla wa la quwwata illa billah",
    translation: "In the name of Allah, I place my trust in Allah, and there is no might nor power except with Allah."
  },
  {
    id: 'home-enter',
    category: 'Home',
    title: 'Entering Home',
    arabic: 'بِسْمِ اللَّهِ وَلَجْنَا، وَبِسْمِ اللَّهِ خَرَجْنَا، وَعَلَى اللَّهِ رَبِّنَا تَوَكَّلْنَا',
    transliteration: "Bismillahi walajna, wa bismillahi kharajna, wa 'ala Allahi Rabbina tawakkalna",
    translation: "In the name of Allah we enter, in the name of Allah we leave, and upon our Lord we place our trust."
  },
  {
    id: 'new-home',
    category: 'Home',
    title: 'New Home',
    arabic: 'اللَّهُمَّ إِنِّي أَسْأَلُكَ خَيْرَهَا وَخَيْرَ أَهْلِهَا وَخَيْرَ مَا فِيهَا، وَأَعُوذُ بِكَ مِنْ شَرِّهَا وَشَرِّ أَهْلِهَا وَشَرِّ مَا فِيهَا',
    transliteration: "Allahumma inni as'aluka khayraha wa khayra ahlliha wa khayra ma fiha, wa a'udhu bika min sharriha wa sharri ahliha wa sharri ma fiha",
    translation: "O Allah, I ask You for the good of it, the good of its people, and the good of what is in it. And I seek refuge with You from its evil, the evil of its people, and the evil of what is in it."
  },
  // Mosque
  {
    id: 'mosque-enter',
    category: 'Mosque',
    title: 'Entering Mosque',
    arabic: 'اللَّهُمَّ افْتَحْ لِي أَبْوَابَ رَحْمَتِكَ',
    transliteration: "Allaahum-maf-tah lee abwaaba rahmatik",
    translation: "O Allah, open for me the doors of Your mercy."
  },
  {
    id: 'mosque-leave',
    category: 'Mosque',
    title: 'Leaving Mosque',
    arabic: 'اللَّهُمَّ إِنِّي أَسْأَلُكَ مِنْ فَضْلِكَ',
    transliteration: "Allaahumma innee as'aluka min fadlik",
    translation: "O Allah, I ask You from Your favor."
  },
  // Distress
  {
    id: 'anxiety',
    category: 'Distress',
    title: 'For Anxiety & Worry',
    arabic: 'اللَّهُمَّ إِنِّي أَعُوذُ بِكَ مِنَ الْهَمِّ وَالْحَزَنِ',
    transliteration: "Allahumma inni a'udhu bika minal-hammi wal-hazan",
    translation: "O Allah, I seek refuge in You from anxiety and sorrow."
  },
  {
    id: 'difficulty',
    category: 'Distress',
    title: 'In Times of Difficulty',
    arabic: 'لَا إِلَٰهَ إِلَّا أَنْتَ سُبْحَانَكَ إِنِّي كُنْتُ مِنَ الظَّالِمِينَ',
    transliteration: "La ilaha illa Anta, Subhanaka, inni kuntu minaz-zalimin",
    translation: "There is no deity except You; exalted are You. Indeed, I have been of the wrongdoers."
  },
  {
    id: 'distress-relief',
    category: 'Distress',
    title: 'For Relief from Distress',
    arabic: 'لَا إِلَهَ إِلَّا اللَّهُ الْعَظِيمُ الْحَلِيمُ، لَا إِلَهَ إِلَّا اللَّهُ رَبُّ الْعَرْشِ الْعَظِيمِ',
    transliteration: "La ilaha illallahul-'Atheemul-Haleem. La ilaha illallahu Rabbul-'Arshil-'Atheem",
    translation: "There is no deity except Allah, the Magnificent, the Forbearing. There is no deity except Allah, Lord of the Magnificent Throne."
  },
  {
    id: 'fear',
    category: 'Distress',
    title: 'When Afraid',
    arabic: 'حَسْبِيَ اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ ۖ عَلَيْهِ تَوَكَّلْتُ ۖ وَهُوَ رَبُّ الْعَرْشِ الْعَظِيمِ',
    transliteration: "Hasbiyallahu la ilaha illa Huwa, 'alayhi tawakkaltu, wa Huwa Rabbul-'Arshil-'Atheem",
    translation: "Allah is sufficient for me; there is no deity except Him. On Him I have relied, and He is the Lord of the Great Throne."
  },
  {
    id: 'anger',
    category: 'Distress',
    title: 'When Angry',
    arabic: 'أَعُوذُ بِاللَّهِ مِنَ الشَّيْطَانِ الرَّجِيمِ',
    transliteration: "A'udhu billahi minash-shaytanir-rajeem",
    translation: "I seek refuge with Allah from Satan, the accursed."
  },
  // Forgiveness
  {
    id: 'forgiveness',
    category: 'Forgiveness',
    title: 'Seeking Forgiveness',
    arabic: 'أَسْتَغْفِرُ اللَّهَ الَّذِي لَا إِلَٰهَ إِلَّا هُوَ الْحَيُّ الْقَيُّومُ وَأَتُوبُ إِلَيْهِ',
    transliteration: "Astaghfirullaha-lathee la ilaha illa Huwal-Hayyul-Qayyoomu wa atoobu ilaih",
    translation: "I seek the forgiveness of Allah, there is no deity except Him, the Living, the Sustainer, and I repent to Him."
  },
  {
    id: 'sayyidul-istighfar',
    category: 'Forgiveness',
    title: 'Master of Forgiveness',
    arabic: 'اللَّهُمَّ أَنْتَ رَبِّي لَا إِلَهَ إِلَّا أَنْتَ، خَلَقْتَنِي وَأَنَا عَبْدُكَ، وَأَنَا عَلَى عَهْدِكَ وَوَعْدِكَ مَا اسْتَطَعْتُ',
    transliteration: "Allahumma Anta Rabbi, la ilaha illa Anta, khalaqtani wa ana 'abduka, wa ana 'ala 'ahdika wa wa'dika mastata't",
    translation: "O Allah, You are my Lord, there is no deity except You. You created me and I am Your servant, and I abide by Your covenant and promise as best I can."
  },
  // Family
  {
    id: 'parents',
    category: 'Family',
    title: 'For Parents',
    arabic: 'رَبِّ ارْحَمْهُمَا كَمَا رَبَّيَانِي صَغِيرًا',
    transliteration: "Rabbir-hamhuma kama rabbayani sagheera",
    translation: "My Lord, have mercy upon them as they brought me up when I was small."
  },
  {
    id: 'children',
    category: 'Family',
    title: 'For Children',
    arabic: 'رَبَّنَا هَبْ لَنَا مِنْ أَزْوَاجِنَا وَذُرِّيَّاتِنَا قُرَّةَ أَعْيُنٍ وَاجْعَلْنَا لِلْمُتَّقِينَ إِمَامًا',
    transliteration: "Rabbana hab lana min azwajina wa thurriyyatina qurrata a'yunin waj'alna lil-muttaqeena imama",
    translation: "Our Lord, grant us from among our wives and offspring comfort to our eyes and make us an example for the righteous."
  },
  {
    id: 'spouse',
    category: 'Family',
    title: 'For Spouse',
    arabic: 'رَبَّنَا آتِنَا فِي الدُّنْيَا حَسَنَةً وَفِي الْآخِرَةِ حَسَنَةً وَقِنَا عَذَابَ النَّارِ',
    transliteration: "Rabbana atina fid-dunya hasanatan wa fil-akhirati hasanatan wa qina 'adhaban-nar",
    translation: "Our Lord, give us good in this world and good in the Hereafter, and protect us from the torment of the Fire."
  },
  {
    id: 'newborn',
    category: 'Family',
    title: 'For Newborn',
    arabic: 'أُعِيذُكَ بِكَلِمَاتِ اللَّهِ التَّامَّةِ مِنْ كُلِّ شَيْطَانٍ وَهَامَّةٍ، وَمِنْ كُلِّ عَيْنٍ لَامَّةٍ',
    transliteration: "U'idhuka bikalimatillahi-tammati min kulli shaytanin wa hammah, wa min kulli 'aynin lammah",
    translation: "I seek protection for you in the perfect words of Allah from every devil and every poisonous reptile, and from every evil eye."
  },
  // Knowledge
  {
    id: 'knowledge',
    category: 'Knowledge',
    title: 'For Knowledge',
    arabic: 'رَبِّ زِدْنِي عِلْمًا',
    transliteration: "Rabbi zidni 'ilma",
    translation: "My Lord, increase me in knowledge."
  },
  {
    id: 'understanding',
    category: 'Knowledge',
    title: 'For Understanding',
    arabic: 'اللَّهُمَّ انْفَعْنِي بِمَا عَلَّمْتَنِي وَعَلِّمْنِي مَا يَنْفَعُنِي وَزِدْنِي عِلْمًا',
    transliteration: "Allahum-manfa'ni bima 'allamtani wa 'allimni ma yanfa'uni wa zidni 'ilma",
    translation: "O Allah, benefit me with what You have taught me, teach me what will benefit me, and increase me in knowledge."
  },
  {
    id: 'studying',
    category: 'Knowledge',
    title: 'Before Studying',
    arabic: 'اللَّهُمَّ افْتَحْ عَلَيْنَا حِكْمَتَكَ، وَانْشُرْ عَلَيْنَا رَحْمَتَكَ، يَا ذَا الْجَلَالِ وَالْإِكْرَامِ',
    transliteration: "Allahumma-ftah 'alayna hikmataka, wanshur 'alayna rahmataka, ya Dhal-Jalali wal-Ikram",
    translation: "O Allah, open to us Your wisdom and spread upon us Your mercy, O Possessor of Majesty and Honor."
  },
  // Weather
  {
    id: 'rain',
    category: 'Weather',
    title: 'When It Rains',
    arabic: 'اللَّهُمَّ صَيِّبًا نَافِعًا',
    transliteration: "Allahumma sayyiban nafi'an",
    translation: "O Allah, may it be a beneficial rain."
  },
  {
    id: 'thunder',
    category: 'Weather',
    title: 'Hearing Thunder',
    arabic: 'سُبْحَانَ الَّذِي يُسَبِّحُ الرَّعْدُ بِحَمْدِهِ وَالْمَلَائِكَةُ مِنْ خِيفَتِهِ',
    transliteration: "Subhanal-lathee yusabbihur-ra'du bihamdihi, wal-malaa'ikatu min kheefatih",
    translation: "Glory be to Him Whom the thunder glorifies with His praise, and the angels from fear of Him."
  },
  {
    id: 'wind',
    category: 'Weather',
    title: 'When Wind Blows',
    arabic: 'اللَّهُمَّ إِنِّي أَسْأَلُكَ خَيْرَهَا وَخَيْرَ مَا فِيهَا وَخَيْرَ مَا أُرْسِلَتْ بِهِ، وَأَعُوذُ بِكَ مِنْ شَرِّهَا وَشَرِّ مَا فِيهَا وَشَرِّ مَا أُرْسِلَتْ بِهِ',
    transliteration: "Allahumma inni as'aluka khayraha wa khayra ma fiha wa khayra ma ursilat bih, wa a'udhu bika min sharriha wa sharri ma fiha wa sharri ma ursilat bih",
    translation: "O Allah, I ask You for its good, the good within it, and the good it was sent with. And I seek refuge with You from its evil, the evil within it, and the evil it was sent with."
  },
  // Health
  {
    id: 'sick',
    category: 'Health',
    title: 'When Sick',
    arabic: 'اللَّهُمَّ رَبَّ النَّاسِ أَذْهِبِ الْبَأْسَ، اشْفِهِ وَأَنْتَ الشَّافِي، لَا شِفَاءَ إِلَّا شِفَاؤُكَ، شِفَاءً لَا يُغَادِرُ سَقَمًا',
    transliteration: "Allahumma Rabban-nas, adhhibil-ba's, washfihi wa Antash-Shafi, la shifa'a illa shifa'uka, shifa'an la yughadiru saqama",
    translation: "O Allah, Lord of mankind, remove the affliction and heal, for You are the Healer. There is no healing except Your healing, a healing that leaves no disease behind."
  },
  {
    id: 'visiting-sick',
    category: 'Health',
    title: 'Visiting the Sick',
    arabic: 'لَا بَأْسَ طَهُورٌ إِنْ شَاءَ اللَّهُ',
    transliteration: "La ba'sa, tahoorun in sha'Allah",
    translation: "No harm, it will be a purification (for you), if Allah wills."
  },
  {
    id: 'pain',
    category: 'Health',
    title: 'When in Pain',
    arabic: 'أَعُوذُ بِعِزَّةِ اللَّهِ وَقُدْرَتِهِ مِنْ شَرِّ مَا أَجِدُ وَأُحَاذِرُ',
    transliteration: "A'udhu bi'izzatillahi wa qudratihi min sharri ma ajidu wa uhadhir",
    translation: "I seek refuge in Allah's might and power from the evil of what I feel and fear."
  },
  // Protection
  {
    id: 'evil-eye',
    category: 'Protection',
    title: 'Against Evil Eye',
    arabic: 'أَعُوذُ بِكَلِمَاتِ اللَّهِ التَّامَّاتِ مِنْ شَرِّ مَا خَلَقَ',
    transliteration: "A'udhu bikalimatillahi-tammati min sharri ma khalaq",
    translation: "I seek refuge in the perfect words of Allah from the evil of that which He has created."
  },
  {
    id: 'morning-evening-protection',
    category: 'Protection',
    title: 'Daily Protection',
    arabic: 'بِسْمِ اللَّهِ الَّذِي لَا يَضُرُّ مَعَ اسْمِهِ شَيْءٌ فِي الْأَرْضِ وَلَا فِي السَّمَاءِ وَهُوَ السَّمِيعُ الْعَلِيمُ',
    transliteration: "Bismillahil-lathee la yadurru ma'asmihi shay'un fil-ardi wa la fis-sama'i, wa Huwas-Samee'ul-'Aleem",
    translation: "In the name of Allah, with Whose name nothing on earth or in heaven can cause harm, and He is the All-Hearing, the All-Knowing."
  },
  {
    id: 'nightmares',
    category: 'Protection',
    title: 'After Bad Dream',
    arabic: 'أَعُوذُ بِاللَّهِ مِنَ الشَّيْطَانِ الرَّجِيمِ، أَعُوذُ بِكَلِمَاتِ اللَّهِ التَّامَّاتِ مِنْ غَضَبِهِ وَعِقَابِهِ وَشَرِّ عِبَادِهِ',
    transliteration: "A'udhu billahi minash-shaytanir-rajeem. A'udhu bikalimatillahit-tammati min ghadabihi wa 'iqabihi wa sharri 'ibadihi",
    translation: "I seek refuge with Allah from Satan the accursed. I seek refuge in the perfect words of Allah from His anger, His punishment, and the evil of His servants."
  },
  // Gratitude
  {
    id: 'gratitude-blessing',
    category: 'Gratitude',
    title: 'For Blessings',
    arabic: 'الْحَمْدُ لِلَّهِ الَّذِي بِنِعْمَتِهِ تَتِمُّ الصَّالِحَاتُ',
    transliteration: "Alhamdu lillahil-lathee bini'matihi tatimmus-salihat",
    translation: "Praise is to Allah, by Whose favor good deeds are completed."
  },
  {
    id: 'see-something-liked',
    category: 'Gratitude',
    title: 'Seeing Something Liked',
    arabic: 'الْحَمْدُ لِلَّهِ الَّذِي بِنِعْمَتِهِ تَتِمُّ الصَّالِحَاتُ',
    transliteration: "Alhamdu lillahil-lathee bini'matihi tatimmus-salihat",
    translation: "Praise is to Allah, by Whose favor good things are accomplished."
  },
  {
    id: 'see-something-disliked',
    category: 'Gratitude',
    title: 'Seeing Something Disliked',
    arabic: 'الْحَمْدُ لِلَّهِ عَلَى كُلِّ حَالٍ',
    transliteration: "Alhamdu lillahi 'ala kulli hal",
    translation: "Praise is to Allah in all circumstances."
  },
  // Prayer
  {
    id: 'after-adhan',
    category: 'Prayer',
    title: 'After Adhan',
    arabic: 'اللَّهُمَّ رَبَّ هَذِهِ الدَّعْوَةِ التَّامَّةِ وَالصَّلَاةِ الْقَائِمَةِ آتِ مُحَمَّدًا الْوَسِيلَةَ وَالْفَضِيلَةَ',
    transliteration: "Allahumma Rabba hadhihid-da'watit-tammah, was-salatil-qa'imah, ati Muhammadanil-waseelata wal-fadeelah",
    translation: "O Allah, Lord of this perfect call and established prayer, grant Muhammad the intercession and virtue."
  },
  {
    id: 'between-sujood',
    category: 'Prayer',
    title: 'Between Prostrations',
    arabic: 'رَبِّ اغْفِرْ لِي، رَبِّ اغْفِرْ لِي',
    transliteration: "Rabbighfir li, Rabbighfir li",
    translation: "My Lord, forgive me. My Lord, forgive me."
  },
  {
    id: 'in-sujood',
    category: 'Prayer',
    title: 'In Prostration',
    arabic: 'سُبْحَانَ رَبِّيَ الْأَعْلَى',
    transliteration: "Subhana Rabbiyal-A'la",
    translation: "Glory be to my Lord, the Most High."
  },
  {
    id: 'after-tashahud',
    category: 'Prayer',
    title: 'After Tashahud',
    arabic: 'اللَّهُمَّ إِنِّي أَعُوذُ بِكَ مِنْ عَذَابِ جَهَنَّمَ، وَمِنْ عَذَابِ الْقَبْرِ، وَمِنْ فِتْنَةِ الْمَحْيَا وَالْمَمَاتِ، وَمِنْ شَرِّ فِتْنَةِ الْمَسِيحِ الدَّجَّالِ',
    transliteration: "Allahumma inni a'udhu bika min 'adhabi jahannam, wa min 'adhabil-qabr, wa min fitnatil-mahya wal-mamat, wa min sharri fitnatil-masihid-dajjal",
    translation: "O Allah, I seek refuge with You from the torment of Hell, from the torment of the grave, from the trials of life and death, and from the evil of the trial of the False Messiah."
  },
  // Patience
  {
    id: 'patience',
    category: 'Patience',
    title: 'For Patience',
    arabic: 'رَبَّنَا أَفْرِغْ عَلَيْنَا صَبْرًا وَثَبِّتْ أَقْدَامَنَا وَانْصُرْنَا عَلَى الْقَوْمِ الْكَافِرِينَ',
    transliteration: "Rabbana afrigh 'alayna sabran wa thabbit aqdamana wansurna 'alal-qawmil-kafireen",
    translation: "Our Lord, pour upon us patience and plant firmly our feet and give us victory over the disbelieving people."
  },
  {
    id: 'calamity',
    category: 'Patience',
    title: 'Upon Calamity',
    arabic: 'إِنَّا لِلَّهِ وَإِنَّا إِلَيْهِ رَاجِعُونَ، اللَّهُمَّ أْجُرْنِي فِي مُصِيبَتِي وَأَخْلِفْ لِي خَيْرًا مِنْهَا',
    transliteration: "Inna lillahi wa inna ilayhi raji'un. Allahumma'jurni fi museebati wakhluf li khayran minha",
    translation: "Indeed we belong to Allah, and indeed to Him we will return. O Allah, reward me in my calamity and replace it with something better."
  },
  // Misc
  {
    id: 'mirror',
    category: 'Misc',
    title: 'Looking in Mirror',
    arabic: 'اللَّهُمَّ أَنْتَ حَسَّنْتَ خَلْقِي فَحَسِّنْ خُلُقِي',
    transliteration: "Allahumma Anta hassanta khalqi fahassin khuluqi",
    translation: "O Allah, You have made my creation good, so make my character good."
  },
  {
    id: 'new-clothes',
    category: 'Misc',
    title: 'Wearing New Clothes',
    arabic: 'الْحَمْدُ لِلَّهِ الَّذِي كَسَانِي هَذَا وَرَزَقَنِيهِ مِنْ غَيْرِ حَوْلٍ مِنِّي وَلَا قُوَّةٍ',
    transliteration: "Alhamdulillahil-lathee kasani hadha wa razaqaneehi min ghayri hawlin minni wa la quwwah",
    translation: "Praise is to Allah Who has clothed me with this and provided it for me, with no power or might from myself."
  },
  {
    id: 'sneezing',
    category: 'Misc',
    title: 'After Sneezing',
    arabic: 'الْحَمْدُ لِلَّهِ',
    transliteration: "Alhamdulillah",
    translation: "Praise be to Allah."
  },
  {
    id: 'sneezing-response',
    category: 'Misc',
    title: 'Response to Sneezer',
    arabic: 'يَرْحَمُكَ اللَّهُ',
    transliteration: "Yarhamukallah",
    translation: "May Allah have mercy on you."
  },
  {
    id: 'bathroom-enter',
    category: 'Misc',
    title: 'Entering Bathroom',
    arabic: 'اللَّهُمَّ إِنِّي أَعُوذُ بِكَ مِنَ الْخُبُثِ وَالْخَبَائِثِ',
    transliteration: "Allahumma inni a'udhu bika minal-khubuthi wal-khaba'ith",
    translation: "O Allah, I seek refuge with You from male and female devils."
  },
  {
    id: 'bathroom-exit',
    category: 'Misc',
    title: 'Leaving Bathroom',
    arabic: 'غُفْرَانَكَ',
    transliteration: "Ghufranaka",
    translation: "I seek Your forgiveness."
  },
  {
    id: 'istikhara',
    category: 'Guidance',
    title: 'Istikhara (Guidance)',
    arabic: 'اللَّهُمَّ إِنِّي أَسْتَخِيرُكَ بِعِلْمِكَ، وَأَسْتَقْدِرُكَ بِقُدْرَتِكَ، وَأَسْأَلُكَ مِنْ فَضْلِكَ الْعَظِيمِ',
    transliteration: "Allahumma inni astakhiruka bi'ilmika, wa astaqdiruka biqudratika, wa as'aluka min fadlikal-'atheem",
    translation: "O Allah, I seek Your guidance by virtue of Your knowledge, and I seek ability by virtue of Your power, and I ask You of Your great bounty."
  },
  {
    id: 'steadfastness',
    category: 'Guidance',
    title: 'For Steadfastness',
    arabic: 'يَا مُقَلِّبَ الْقُلُوبِ ثَبِّتْ قَلْبِي عَلَى دِينِكَ',
    transliteration: "Ya Muqallibal-qulubi, thabbit qalbi 'ala deenika",
    translation: "O Turner of the hearts, make my heart firm upon Your religion."
  },
  {
    id: 'good-end',
    category: 'Guidance',
    title: 'For Good Ending',
    arabic: 'اللَّهُمَّ أَحْسِنْ عَاقِبَتَنَا فِي الْأُمُورِ كُلِّهَا، وَأَجِرْنَا مِنْ خِزْيِ الدُّنْيَا وَعَذَابِ الْآخِرَةِ',
    transliteration: "Allahumma ahsin 'aqibatana fil-umuri kulliha, wa ajirna min khizyid-dunya wa 'adhaabil-akhirah",
    translation: "O Allah, make our end good in all affairs, and protect us from the disgrace of this world and the punishment of the Hereafter."
  },
  {
    id: 'deceased',
    category: 'Death',
    title: 'For the Deceased',
    arabic: 'اللَّهُمَّ اغْفِرْ لَهُ وَارْحَمْهُ وَعَافِهِ وَاعْفُ عَنْهُ',
    transliteration: "Allahummaghfir lahu warhamhu wa 'afihi wa'fu 'anhu",
    translation: "O Allah, forgive him, have mercy on him, grant him well-being, and pardon him."
  },
  {
    id: 'condolence',
    category: 'Death',
    title: 'Offering Condolence',
    arabic: 'إِنَّ لِلَّهِ مَا أَخَذَ، وَلَهُ مَا أَعْطَى، وَكُلُّ شَيْءٍ عِنْدَهُ بِأَجَلٍ مُسَمًّى',
    transliteration: "Inna lillahi ma akhadh, wa lahu ma a'ta, wa kullu shay'in 'indahu bi ajalin musamma",
    translation: "To Allah belongs what He has taken, and to Him belongs what He has given. Everything with Him has an appointed time."
  },
];

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
  const [duaCategory, setDuaCategory] = useState<string>('all');
  const [expandedDua, setExpandedDua] = useState<string | null>(null);

  const duaCategories = ['all', ...Array.from(new Set(DUAS.map(d => d.category)))];
  const filteredDuas = duaCategory === 'all' ? DUAS : DUAS.filter(d => d.category === duaCategory);
  
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
        <TabsList className="mx-4 mt-3 grid grid-cols-6">
          <TabsTrigger value="ramadan" className="gap-1 text-xs px-1">
            <Star className="w-3 h-3" />
            <span className="hidden sm:inline">Ramadan</span>
          </TabsTrigger>
          <TabsTrigger value="dhikr" className="gap-1 text-xs px-1">
            <Hand className="w-3 h-3" />
            <span className="hidden sm:inline">Dhikr</span>
          </TabsTrigger>
          <TabsTrigger value="duas" className="gap-1 text-xs px-1">
            <Heart className="w-3 h-3" />
            <span className="hidden sm:inline">Duas</span>
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

        {/* Duas */}
        <TabsContent value="duas" className="flex-1 mt-0">
          <div className="flex flex-col h-full">
            <div className="px-4 pt-3 pb-2">
              <ScrollArea className="w-full">
                <div className="flex gap-2 pb-2">
                  {duaCategories.map((cat) => (
                    <Button
                      key={cat}
                      variant={duaCategory === cat ? "default" : "outline"}
                      size="sm"
                      className="whitespace-nowrap"
                      onClick={() => setDuaCategory(cat)}
                    >
                      {cat === 'all' ? 'All' : cat}
                    </Button>
                  ))}
                </div>
              </ScrollArea>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-4 pt-2 space-y-3">
                {filteredDuas.map((dua) => (
                  <Card
                    key={dua.id}
                    className={cn(
                      "p-4 cursor-pointer transition-all",
                      expandedDua === dua.id && "ring-2 ring-primary"
                    )}
                    onClick={() => setExpandedDua(expandedDua === dua.id ? null : dua.id)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <Badge variant="secondary" className="mb-2 text-xs">
                          {dua.category}
                        </Badge>
                        <p className="font-medium">{dua.title}</p>
                      </div>
                      <ChevronRight className={cn(
                        "w-4 h-4 text-muted-foreground transition-transform",
                        expandedDua === dua.id && "rotate-90"
                      )} />
                    </div>
                    
                    {expandedDua === dua.id && (
                      <div className="mt-4 space-y-3">
                        <div className="p-3 bg-primary/5 rounded-lg">
                          <p className="font-arabic text-xl text-right leading-loose" dir="rtl">
                            {dua.arabic}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-muted-foreground mb-1">Transliteration</p>
                          <p className="text-sm italic">{dua.transliteration}</p>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-muted-foreground mb-1">Translation</p>
                          <p className="text-sm">{dua.translation}</p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full"
                          onClick={(e) => {
                            e.stopPropagation();
                            speak(dua.arabic);
                          }}
                        >
                          <Volume2 className="w-4 h-4 mr-2" />
                          Listen
                        </Button>
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </div>
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
