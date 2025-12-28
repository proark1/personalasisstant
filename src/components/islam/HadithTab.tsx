import { useState, useMemo, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { 
  Search, Heart, Copy, Share2, BookOpen, RefreshCw,
  ChevronDown, ChevronUp, Volume2
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTextToSpeech } from '@/hooks/useTextToSpeech';

interface Hadith {
  id: number;
  collection: string;
  chapter: string;
  arabic: string;
  english: string;
  narrator: string;
  grade?: string;
}

// Curated collection of authentic hadiths
const HADITH_COLLECTION: Hadith[] = [
  // Sahih Bukhari - Faith
  { id: 1, collection: 'Bukhari', chapter: 'Faith', narrator: "Umar ibn Al-Khattab", grade: 'Sahih',
    arabic: 'إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ، وَإِنَّمَا لِكُلِّ امْرِئٍ مَا نَوَى',
    english: 'Actions are judged by intentions, and everyone will get what was intended.' },
  { id: 2, collection: 'Bukhari', chapter: 'Faith', narrator: "Abu Hurairah", grade: 'Sahih',
    arabic: 'الإِيمَانُ بِضْعٌ وَسِتُّونَ شُعْبَةً، وَالْحَيَاءُ شُعْبَةٌ مِنَ الإِيمَانِ',
    english: 'Faith has over sixty branches, and modesty is a branch of faith.' },
  { id: 3, collection: 'Bukhari', chapter: 'Faith', narrator: "Abdullah ibn Amr", grade: 'Sahih',
    arabic: 'الْمُسْلِمُ مَنْ سَلِمَ الْمُسْلِمُونَ مِنْ لِسَانِهِ وَيَدِهِ',
    english: 'A Muslim is one from whose tongue and hand other Muslims are safe.' },
  { id: 4, collection: 'Bukhari', chapter: 'Faith', narrator: "Anas ibn Malik", grade: 'Sahih',
    arabic: 'لاَ يُؤْمِنُ أَحَدُكُمْ حَتَّى يُحِبَّ لأَخِيهِ مَا يُحِبُّ لِنَفْسِهِ',
    english: 'None of you truly believes until he loves for his brother what he loves for himself.' },
  
  // Sahih Bukhari - Prayer
  { id: 5, collection: 'Bukhari', chapter: 'Prayer', narrator: "Abu Hurairah", grade: 'Sahih',
    arabic: 'أَرَأَيْتُمْ لَوْ أَنَّ نَهَرًا بِبَابِ أَحَدِكُمْ يَغْتَسِلُ مِنْهُ كُلَّ يَوْمٍ خَمْسَ مَرَّاتٍ، هَلْ يَبْقَى مِنْ دَرَنِهِ شَيْءٌ',
    english: 'If there was a river at your door and you bathed in it five times a day, would any dirt remain on you?' },
  { id: 6, collection: 'Bukhari', chapter: 'Prayer', narrator: "Ibn Mas'ud", grade: 'Sahih',
    arabic: 'أَفْضَلُ الأَعْمَالِ الصَّلاَةُ عَلَى وَقْتِهَا',
    english: 'The best deed is prayer performed on time.' },

  // Sahih Bukhari - Character
  { id: 7, collection: 'Bukhari', chapter: 'Character', narrator: "Abu Hurairah", grade: 'Sahih',
    arabic: 'مَنْ كَانَ يُؤْمِنُ بِاللَّهِ وَالْيَوْمِ الآخِرِ فَلْيَقُلْ خَيْرًا أَوْ لِيَصْمُتْ',
    english: 'Whoever believes in Allah and the Last Day should speak good or remain silent.' },
  { id: 8, collection: 'Bukhari', chapter: 'Character', narrator: "Abu Hurairah", grade: 'Sahih',
    arabic: 'مَنْ كَانَ يُؤْمِنُ بِاللَّهِ وَالْيَوْمِ الآخِرِ فَلْيُكْرِمْ جَارَهُ',
    english: 'Whoever believes in Allah and the Last Day should honor his neighbor.' },
  { id: 9, collection: 'Bukhari', chapter: 'Character', narrator: "Abu Hurairah", grade: 'Sahih',
    arabic: 'مَنْ كَانَ يُؤْمِنُ بِاللَّهِ وَالْيَوْمِ الآخِرِ فَلْيُكْرِمْ ضَيْفَهُ',
    english: 'Whoever believes in Allah and the Last Day should honor his guest.' },

  // Sahih Muslim - Faith
  { id: 10, collection: 'Muslim', chapter: 'Faith', narrator: "Abu Dharr", grade: 'Sahih',
    arabic: 'اتَّقِ اللَّهَ حَيْثُمَا كُنْتَ وَأَتْبِعِ السَّيِّئَةَ الْحَسَنَةَ تَمْحُهَا وَخَالِقِ النَّاسَ بِخُلُقٍ حَسَنٍ',
    english: 'Fear Allah wherever you are, follow a bad deed with a good deed to erase it, and treat people with good character.' },
  { id: 11, collection: 'Muslim', chapter: 'Faith', narrator: "Abu Hurairah", grade: 'Sahih',
    arabic: 'الْمُؤْمِنُ الْقَوِيُّ خَيْرٌ وَأَحَبُّ إِلَى اللَّهِ مِنَ الْمُؤْمِنِ الضَّعِيفِ وَفِي كُلٍّ خَيْرٌ',
    english: 'The strong believer is better and more beloved to Allah than the weak believer, and in each there is good.' },

  // Sahih Muslim - Charity
  { id: 12, collection: 'Muslim', chapter: 'Charity', narrator: "Abu Hurairah", grade: 'Sahih',
    arabic: 'مَا نَقَصَتْ صَدَقَةٌ مِنْ مَالٍ',
    english: 'Charity does not decrease wealth.' },
  { id: 13, collection: 'Muslim', chapter: 'Charity', narrator: "Abu Hurairah", grade: 'Sahih',
    arabic: 'تَبَسُّمُكَ فِي وَجْهِ أَخِيكَ لَكَ صَدَقَةٌ',
    english: 'Your smile for your brother is charity.' },

  // Sahih Muslim - Kindness
  { id: 14, collection: 'Muslim', chapter: 'Kindness', narrator: "Aisha", grade: 'Sahih',
    arabic: 'إِنَّ اللَّهَ رَفِيقٌ يُحِبُّ الرِّفْقَ فِي الأَمْرِ كُلِّهِ',
    english: 'Allah is gentle and loves gentleness in all matters.' },
  { id: 15, collection: 'Muslim', chapter: 'Kindness', narrator: "Jabir", grade: 'Sahih',
    arabic: 'إِنَّ اللَّهَ لاَ يَنْظُرُ إِلَى صُوَرِكُمْ وَأَمْوَالِكُمْ وَلَكِنْ يَنْظُرُ إِلَى قُلُوبِكُمْ وَأَعْمَالِكُمْ',
    english: 'Allah does not look at your appearance or wealth, but rather at your hearts and deeds.' },

  // Tirmidhi - Various
  { id: 16, collection: 'Tirmidhi', chapter: 'Character', narrator: "Abu Hurairah", grade: 'Hasan',
    arabic: 'أَكْمَلُ الْمُؤْمِنِينَ إِيمَانًا أَحْسَنُهُمْ خُلُقًا',
    english: 'The most complete believers in faith are those with the best character.' },
  { id: 17, collection: 'Tirmidhi', chapter: 'Family', narrator: "Abu Hurairah", grade: 'Hasan',
    arabic: 'خَيْرُكُمْ خَيْرُكُمْ لأَهْلِهِ وَأَنَا خَيْرُكُمْ لأَهْلِي',
    english: 'The best of you are those who are best to their families, and I am the best of you to my family.' },
  { id: 18, collection: 'Tirmidhi', chapter: 'Knowledge', narrator: "Abu Hurairah", grade: 'Sahih',
    arabic: 'مَنْ سَلَكَ طَرِيقًا يَلْتَمِسُ فِيهِ عِلْمًا سَهَّلَ اللَّهُ لَهُ طَرِيقًا إِلَى الْجَنَّةِ',
    english: 'Whoever takes a path in search of knowledge, Allah will make easy for him a path to Paradise.' },

  // Abu Dawud
  { id: 19, collection: 'Abu Dawud', chapter: 'Prayer', narrator: "Abu Malik Al-Ash'ari", grade: 'Sahih',
    arabic: 'الطُّهُورُ شَطْرُ الإِيمَانِ',
    english: 'Purity is half of faith.' },
  { id: 20, collection: 'Abu Dawud', chapter: 'Character', narrator: "Abdullah ibn Mas'ud", grade: 'Sahih',
    arabic: 'إِنَّ الصِّدْقَ يَهْدِي إِلَى الْبِرِّ وَإِنَّ الْبِرَّ يَهْدِي إِلَى الْجَنَّةِ',
    english: 'Truthfulness leads to righteousness, and righteousness leads to Paradise.' },

  // 40 Hadith Nawawi selections
  { id: 21, collection: 'Nawawi 40', chapter: 'Fundamentals', narrator: "Abu Ruqayya Tamim", grade: 'Sahih',
    arabic: 'الدِّينُ النَّصِيحَةُ',
    english: 'The religion is sincerity (sincere advice).' },
  { id: 22, collection: 'Nawawi 40', chapter: 'Fundamentals', narrator: "Ibn Umar", grade: 'Sahih',
    arabic: 'بُنِيَ الإِسْلاَمُ عَلَى خَمْسٍ: شَهَادَةِ أَنْ لاَ إِلَهَ إِلاَّ اللَّهُ',
    english: 'Islam is built upon five pillars: The testimony that there is no god but Allah...' },
  { id: 23, collection: 'Nawawi 40', chapter: 'Piety', narrator: "An-Nawwas ibn Sam'an", grade: 'Sahih',
    arabic: 'الْبِرُّ حُسْنُ الْخُلُقِ وَالإِثْمُ مَا حَاكَ فِي صَدْرِكَ',
    english: 'Righteousness is good character, and sin is what troubles your heart.' },
  { id: 24, collection: 'Nawawi 40', chapter: 'Worship', narrator: "Abu Hurairah", grade: 'Sahih',
    arabic: 'مِنْ حُسْنِ إِسْلاَمِ الْمَرْءِ تَرْكُهُ مَا لاَ يَعْنِيهِ',
    english: 'Part of a person\'s good practice of Islam is to leave what does not concern him.' },

  // More Bukhari
  { id: 25, collection: 'Bukhari', chapter: 'Mercy', narrator: "Abu Hurairah", grade: 'Sahih',
    arabic: 'الرَّاحِمُونَ يَرْحَمُهُمُ الرَّحْمَنُ ارْحَمُوا مَنْ فِي الأَرْضِ يَرْحَمْكُمْ مَنْ فِي السَّمَاءِ',
    english: 'The merciful will be shown mercy by the Most Merciful. Be merciful to those on earth, and the One in heaven will be merciful to you.' },
  { id: 26, collection: 'Bukhari', chapter: 'Parents', narrator: "Abdullah ibn Mas'ud", grade: 'Sahih',
    arabic: 'أَحَبُّ الأَعْمَالِ إِلَى اللَّهِ الصَّلاَةُ عَلَى وَقْتِهَا ثُمَّ بِرُّ الْوَالِدَيْنِ',
    english: 'The most beloved deeds to Allah are prayer at its proper time, then kindness to parents.' },
  { id: 27, collection: 'Bukhari', chapter: 'Patience', narrator: "Anas ibn Malik", grade: 'Sahih',
    arabic: 'إِنَّ عِظَمَ الْجَزَاءِ مَعَ عِظَمِ الْبَلاَءِ',
    english: 'The greatness of reward comes with the greatness of trial.' },

  // More Muslim
  { id: 28, collection: 'Muslim', chapter: 'Brotherhood', narrator: "Abu Hurairah", grade: 'Sahih',
    arabic: 'لاَ تَحَاسَدُوا وَلاَ تَنَاجَشُوا وَلاَ تَبَاغَضُوا وَلاَ تَدَابَرُوا',
    english: 'Do not envy one another, do not hate one another, do not turn away from one another.' },
  { id: 29, collection: 'Muslim', chapter: 'Supplication', narrator: "Abu Hurairah", grade: 'Sahih',
    arabic: 'يُسْتَجَابُ لأَحَدِكُمْ مَا لَمْ يَعْجَلْ',
    english: 'The supplication of any one of you is answered so long as he is not hasty.' },
  { id: 30, collection: 'Muslim', chapter: 'Fasting', narrator: "Abu Hurairah", grade: 'Sahih',
    arabic: 'مَنْ صَامَ رَمَضَانَ إِيمَانًا وَاحْتِسَابًا غُفِرَ لَهُ مَا تَقَدَّمَ مِنْ ذَنْبِهِ',
    english: 'Whoever fasts Ramadan out of faith and seeking reward, his past sins will be forgiven.' },
];

const COLLECTIONS = ['All', 'Bukhari', 'Muslim', 'Tirmidhi', 'Abu Dawud', 'Nawawi 40'];
const CHAPTERS = ['All', 'Faith', 'Prayer', 'Character', 'Charity', 'Kindness', 'Family', 'Knowledge', 'Fundamentals', 'Piety', 'Worship', 'Mercy', 'Parents', 'Patience', 'Brotherhood', 'Supplication', 'Fasting'];

export function HadithTab() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCollection, setSelectedCollection] = useState('All');
  const [selectedChapter, setSelectedChapter] = useState('All');
  const [expandedHadith, setExpandedHadith] = useState<number | null>(null);
  const { speak, stop: stopSpeech, isSpeaking } = useTextToSpeech();

  // Fetch favorites
  const { data: favorites = [] } = useQuery({
    queryKey: ['hadith-favorites', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('hadith_favorites')
        .select('*')
        .eq('user_id', user.id);
      if (error) throw error;
      return data.map(f => f.hadith_number);
    },
    enabled: !!user?.id,
  });

  // Add to favorites mutation
  const addFavorite = useMutation({
    mutationFn: async (hadith: Hadith) => {
      if (!user?.id) throw new Error('Not authenticated');
      const { error } = await supabase.from('hadith_favorites').insert({
        user_id: user.id,
        hadith_collection: hadith.collection,
        hadith_number: hadith.id,
        arabic_text: hadith.arabic,
        english_text: hadith.english,
        narrator: hadith.narrator,
        chapter: hadith.chapter,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hadith-favorites'] });
      toast.success('Added to favorites');
    },
    onError: () => toast.error('Failed to add to favorites'),
  });

  // Remove from favorites mutation
  const removeFavorite = useMutation({
    mutationFn: async (hadithId: number) => {
      if (!user?.id) throw new Error('Not authenticated');
      const { error } = await supabase
        .from('hadith_favorites')
        .delete()
        .eq('user_id', user.id)
        .eq('hadith_number', hadithId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hadith-favorites'] });
      toast.success('Removed from favorites');
    },
    onError: () => toast.error('Failed to remove from favorites'),
  });

  // Get daily hadith based on date
  const dailyHadith = useMemo(() => {
    const today = new Date();
    const dayOfYear = Math.floor((today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / 86400000);
    const index = dayOfYear % HADITH_COLLECTION.length;
    return HADITH_COLLECTION[index];
  }, []);

  // Filter hadiths
  const filteredHadiths = useMemo(() => {
    return HADITH_COLLECTION.filter(hadith => {
      const matchesSearch = searchQuery === '' || 
        hadith.english.toLowerCase().includes(searchQuery.toLowerCase()) ||
        hadith.arabic.includes(searchQuery) ||
        hadith.narrator.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCollection = selectedCollection === 'All' || hadith.collection === selectedCollection;
      const matchesChapter = selectedChapter === 'All' || hadith.chapter === selectedChapter;
      return matchesSearch && matchesCollection && matchesChapter;
    });
  }, [searchQuery, selectedCollection, selectedChapter]);

  const toggleFavorite = (hadith: Hadith) => {
    if (favorites.includes(hadith.id)) {
      removeFavorite.mutate(hadith.id);
    } else {
      addFavorite.mutate(hadith);
    }
  };

  const copyHadith = (hadith: Hadith) => {
    const text = `${hadith.arabic}\n\n${hadith.english}\n\n- ${hadith.narrator} (${hadith.collection})`;
    navigator.clipboard.writeText(text);
    toast.success('Hadith copied to clipboard');
  };

  const shareHadith = async (hadith: Hadith) => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Hadith from ${hadith.collection}`,
          text: `${hadith.arabic}\n\n${hadith.english}\n\n- ${hadith.narrator}`,
        });
      } catch {
        copyHadith(hadith);
      }
    } else {
      copyHadith(hadith);
    }
  };

  const playArabic = (text: string) => {
    if (isSpeaking) {
      stopSpeech();
    } else {
      speak(text);
    }
  };

  const getCollectionColor = (collection: string) => {
    switch (collection) {
      case 'Bukhari': return 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-400';
      case 'Muslim': return 'bg-blue-500/20 text-blue-700 dark:text-blue-400';
      case 'Tirmidhi': return 'bg-purple-500/20 text-purple-700 dark:text-purple-400';
      case 'Abu Dawud': return 'bg-amber-500/20 text-amber-700 dark:text-amber-400';
      case 'Nawawi 40': return 'bg-rose-500/20 text-rose-700 dark:text-rose-400';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Daily Hadith */}
      <div className="p-4 border-b border-border">
        <Card className="p-4 bg-gradient-to-br from-primary/20 via-primary/10 to-background border-primary/30">
          <div className="flex items-center gap-2 mb-2">
            <BookOpen className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-primary">Hadith of the Day</span>
            <Badge className={cn("ml-auto text-xs", getCollectionColor(dailyHadith.collection))}>
              {dailyHadith.collection}
            </Badge>
          </div>
          <p className="font-arabic text-lg text-right leading-relaxed mb-2" dir="rtl">
            {dailyHadith.arabic}
          </p>
          <p className="text-sm text-muted-foreground italic">"{dailyHadith.english}"</p>
          <p className="text-xs text-muted-foreground mt-2">— {dailyHadith.narrator}</p>
        </Card>
      </div>

      {/* Search and Filters */}
      <div className="p-4 space-y-3 border-b border-border">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search hadiths..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          <div className="flex gap-2">
            {COLLECTIONS.map((col) => (
              <Button
                key={col}
                variant={selectedCollection === col ? "default" : "outline"}
                size="sm"
                className="whitespace-nowrap"
                onClick={() => setSelectedCollection(col)}
              >
                {col}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Hadith List */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-3">
          {filteredHadiths.map((hadith) => {
            const isExpanded = expandedHadith === hadith.id;
            const isFavorite = favorites.includes(hadith.id);
            return (
              <Card
                key={hadith.id}
                className={cn(
                  "p-4 cursor-pointer transition-all",
                  isExpanded && "ring-2 ring-primary"
                )}
                onClick={() => setExpandedHadith(isExpanded ? null : hadith.id)}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge className={cn("text-xs", getCollectionColor(hadith.collection))}>
                      {hadith.collection}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {hadith.chapter}
                    </Badge>
                    {hadith.grade && (
                      <Badge variant="secondary" className="text-xs">
                        {hadith.grade}
                      </Badge>
                    )}
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  )}
                </div>

                <p className="font-arabic text-lg text-right leading-relaxed mb-2" dir="rtl">
                  {hadith.arabic}
                </p>
                
                <p className={cn(
                  "text-sm text-muted-foreground",
                  !isExpanded && "line-clamp-2"
                )}>
                  {hadith.english}
                </p>

                {isExpanded && (
                  <div className="mt-4 space-y-3">
                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium">Narrator:</span> {hadith.narrator}
                    </p>
                    
                    <div className="flex items-center gap-2 flex-wrap">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          playArabic(hadith.arabic);
                        }}
                      >
                        <Volume2 className="w-4 h-4 mr-1" />
                        {isSpeaking ? 'Stop' : 'Listen'}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          copyHadith(hadith);
                        }}
                      >
                        <Copy className="w-4 h-4 mr-1" />
                        Copy
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          shareHadith(hadith);
                        }}
                      >
                        <Share2 className="w-4 h-4 mr-1" />
                        Share
                      </Button>
                      <Button
                        variant={isFavorite ? "default" : "outline"}
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFavorite(hadith);
                        }}
                      >
                        <Heart className={cn("w-4 h-4 mr-1", isFavorite && "fill-current")} />
                        {isFavorite ? 'Saved' : 'Save'}
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}

          {filteredHadiths.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <BookOpen className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No hadiths found</p>
              <p className="text-sm">Try adjusting your search or filters</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
