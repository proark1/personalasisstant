import { useState, useMemo, useRef } from 'react';
import { motion } from 'framer-motion';
import { GlassCard } from '@/components/ui/glass-card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { staggerItem, staggerContainer } from '@/components/ui/panel-shell';
import {
  Search, Volume2, VolumeX, Copy, Share2, Loader2, ChevronDown
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { describeEdgeError } from '@/lib/edgeError';

interface Dua {
  id: string;
  category: string;
  title: string;
  arabic: string;
  transliteration: string;
  translation: string;
}

interface IslamDuasTabProps {
  duas: Dua[];
}

export function IslamDuasTab({ duas }: IslamDuasTabProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [expandedDua, setExpandedDua] = useState<string | null>(null);
  const [duaLoading, setDuaLoading] = useState<string | null>(null);
  const [playingDua, setPlayingDua] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const categories = useMemo(() =>
    ['all', ...Array.from(new Set(duas.map(d => d.category)))],
    [duas]
  );

  const filtered = useMemo(() => {
    return duas.filter(d => {
      const matchesCat = selectedCategory === 'all' || d.category === selectedCategory;
      const matchesSearch = searchQuery === '' ||
        d.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.translation.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.arabic.includes(searchQuery) ||
        d.category.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCat && matchesSearch;
    });
  }, [duas, selectedCategory, searchQuery]);

  const playAudio = async (dua: Dua) => {
    if (playingDua === dua.id) {
      audioRef.current?.pause();
      setPlayingDua(null);
      return;
    }
    setDuaLoading(dua.id);
    try {
      const { data, error } = await supabase.functions.invoke('text-to-speech', {
        body: { text: dua.arabic, voice: 'onyx' }
      });
      if (error) throw error;
      const audio = new Audio(`data:audio/mp3;base64,${data.audioContent}`);
      audioRef.current = audio;
      audio.onended = () => setPlayingDua(null);
      await audio.play();
      setPlayingDua(dua.id);
    } catch (e) {
      toast.error(await describeEdgeError(e, 'Failed to play audio'));
    } finally {
      setDuaLoading(null);
    }
  };

  const copyDua = (dua: Dua) => {
    navigator.clipboard.writeText(`${dua.arabic}\n\n${dua.transliteration}\n\n${dua.translation}`);
    toast.success('Copied to clipboard');
  };

  const shareDua = async (dua: Dua) => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: dua.title,
          text: `${dua.arabic}\n\n${dua.translation}`,
        });
      } catch { copyDua(dua); }
    } else { copyDua(dua); }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-3 pb-2 space-y-3 border-b border-border">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search duas..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        {/* Category chips */}
        <ScrollArea className="w-full">
          <div className="flex gap-2 pb-1">
            {categories.map(cat => (
              <Button
                key={cat}
                variant={selectedCategory === cat ? 'default' : 'outline'}
                size="sm"
                className="whitespace-nowrap text-xs h-8"
                onClick={() => setSelectedCategory(cat)}
              >
                {cat === 'all' ? 'All' : cat}
              </Button>
            ))}
          </div>
        </ScrollArea>
      </div>

      <ScrollArea className="flex-1">
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="show"
          className="p-3 md:p-4 space-y-3"
        >
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>No duas found</p>
            </div>
          ) : (
            filtered.map(dua => {
              const isExpanded = expandedDua === dua.id;
              return (
                <motion.div key={dua.id} variants={staggerItem}>
                  <GlassCard
                    className={cn(
                      "p-4 cursor-pointer transition-all",
                      isExpanded && "ring-1 ring-primary/50"
                    )}
                    onClick={() => setExpandedDua(isExpanded ? null : dua.id)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <Badge variant="secondary" className="text-xs mb-1.5">{dua.category}</Badge>
                        <p className="font-medium text-sm">{dua.title}</p>
                        {/* Arabic preview when collapsed */}
                        {!isExpanded && (
                          <p className="font-arabic text-base text-right text-muted-foreground mt-1 line-clamp-1" dir="rtl">
                            {dua.arabic}
                          </p>
                        )}
                      </div>
                      <ChevronDown className={cn(
                        "w-4 h-4 text-muted-foreground shrink-0 transition-transform mt-1",
                        isExpanded && "rotate-180"
                      )} />
                    </div>

                    {isExpanded && (
                      <div className="mt-4 space-y-3">
                        <div className="p-3 bg-primary/5 rounded-lg">
                          <p className="font-arabic text-xl text-right leading-loose" dir="rtl">
                            {dua.arabic}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-1">Transliteration</p>
                          <p className="text-sm italic">{dua.transliteration}</p>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-1">Translation</p>
                          <p className="text-sm">{dua.translation}</p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            disabled={duaLoading === dua.id}
                            onClick={(e) => { e.stopPropagation(); playAudio(dua); }}
                          >
                            {duaLoading === dua.id ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> :
                              playingDua === dua.id ? <VolumeX className="w-4 h-4 mr-1" /> :
                                <Volume2 className="w-4 h-4 mr-1" />}
                            {playingDua === dua.id ? 'Stop' : 'Listen'}
                          </Button>
                          <Button variant="ghost" size="icon" className="h-9 w-9"
                            onClick={(e) => { e.stopPropagation(); copyDua(dua); }}>
                            <Copy className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-9 w-9"
                            onClick={(e) => { e.stopPropagation(); shareDua(dua); }}>
                            <Share2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </GlassCard>
                </motion.div>
              );
            })
          )}
        </motion.div>
      </ScrollArea>
    </div>
  );
}
