import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { GlassCard } from '@/components/ui/glass-card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  Newspaper, Bookmark, ExternalLink, RefreshCw, Check, Search,
  Trash2, BookmarkCheck, Settings2, X,
  Sparkles,
} from 'lucide-react';
import { useTechNews } from '@/hooks/useTechNews';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { PanelShell } from '@/components/ui/panel-shell';
import { EmptyState } from '@/components/ui/empty-state';
import { staggerItem, staggerContainer } from '@/components/ui/panel-shell';
import { NewsItem } from '@/hooks/usePersonalizedNews';

const STATUS_COLORS: Record<string, string> = {
  'AI': 'bg-primary/15 text-primary border-primary/30',
  'Technology': 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  'Startups': 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  'Machine Learning': 'bg-purple-500/15 text-purple-400 border-purple-500/30',
  'SaaS': 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  'Gaming': 'bg-pink-500/15 text-pink-400 border-pink-500/30',
  'Science': 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
  'Business': 'bg-orange-500/15 text-orange-400 border-orange-500/30',
};

function getCategoryStyle(cat: string) {
  return STATUS_COLORS[cat] || 'bg-muted text-muted-foreground border-border';
}

export function TechNewsPanel() {
  const {
    liveNews,
    newsLoading,
    refetchNews,
    savedArticles,
    saveArticle,
    markAsRead,
    deleteArticle,
    unreadCount,
    preferences,
    updatePreferences,
    defaultTopics,
    loading,
  } = useTechNews();

  const [activeTab, setActiveTab] = useState('live');
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [editTopics, setEditTopics] = useState<string[]>([]);
  const [newTopic, setNewTopic] = useState('');
  const [savedFilter, setSavedFilter] = useState<'all' | 'unread' | 'read'>('all');

  // Derive categories from live news
  const categories = useMemo(() => {
    const cats = new Set(liveNews.map(n => n.category));
    return Array.from(cats).sort();
  }, [liveNews]);

  // Filter live news
  const filteredNews = useMemo(() => {
    let items = liveNews;
    if (selectedCategory) items = items.filter(n => n.category === selectedCategory);
    if (search) {
      const q = search.toLowerCase();
      items = items.filter(n => n.headline.toLowerCase().includes(q) || n.summary.toLowerCase().includes(q));
    }
    return items;
  }, [liveNews, selectedCategory, search]);

  // Filter saved articles
  const filteredSaved = useMemo(() => {
    let items = savedArticles;
    if (savedFilter === 'unread') items = items.filter(a => !a.is_read);
    if (savedFilter === 'read') items = items.filter(a => a.is_read);
    if (search) {
      const q = search.toLowerCase();
      items = items.filter(a => a.title.toLowerCase().includes(q) || (a.summary || '').toLowerCase().includes(q));
    }
    return items;
  }, [savedArticles, savedFilter, search]);

  const openPrefs = () => {
    setEditTopics(preferences?.topics || defaultTopics);
    setNewTopic('');
    setPrefsOpen(true);
  };

  const addTopic = () => {
    const t = newTopic.trim();
    if (t && !editTopics.includes(t)) {
      setEditTopics(prev => [...prev, t]);
    }
    setNewTopic('');
  };

  const removeTopic = (t: string) => setEditTopics(prev => prev.filter(x => x !== t));

  const savePrefs = () => {
    updatePreferences({ topics: editTopics });
    setPrefsOpen(false);
  };

  const isAlreadySaved = (article: NewsItem) => savedArticles.some(a => a.url === article.url);

  return (
    <PanelShell
      icon={Newspaper}
      title="AI & Tech News"
      subtitle={newsLoading ? 'Updating…' : `${liveNews.length} stories`}
      loading={loading && !liveNews.length}
      loadingVariant="list"
      actions={
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={openPrefs} className="h-8 w-8">
            <Settings2 className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={refetchNews} disabled={newsLoading} className="h-8 w-8">
            <RefreshCw className={cn("w-4 h-4", newsLoading && "animate-spin")} />
          </Button>
        </div>
      }
      noPadding
    >
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
        <TabsList className="mx-3 mt-2 sm:mx-4 sm:mt-3 grid grid-cols-2">
          <TabsTrigger value="live" className="gap-1.5 text-xs sm:text-sm">
            <Sparkles className="w-3.5 h-3.5" />
            Live Feed
          </TabsTrigger>
          <TabsTrigger value="saved" className="gap-1.5 text-xs sm:text-sm">
            <BookmarkCheck className="w-3.5 h-3.5" />
            Saved
            {unreadCount > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">{unreadCount}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Search bar */}
        <div className="px-3 pt-2 sm:px-4 sm:pt-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search articles…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 h-9 text-sm bg-muted/50"
            />
            {search && (
              <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7" onClick={() => setSearch('')}>
                <X className="w-3 h-3" />
              </Button>
            )}
          </div>
        </div>

        {/* Live News */}
        <TabsContent value="live" className="flex-1 mt-0 flex flex-col min-h-0">
          {/* Category filter chips */}
          {categories.length > 0 && (
            <div className="px-3 pt-2 sm:px-4 flex gap-1.5 overflow-x-auto no-scrollbar">
              <Badge
                variant={selectedCategory === null ? 'default' : 'outline'}
                className="cursor-pointer shrink-0 text-xs"
                onClick={() => setSelectedCategory(null)}
              >
                All
              </Badge>
              {categories.map(cat => (
                <Badge
                  key={cat}
                  variant={selectedCategory === cat ? 'default' : 'outline'}
                  className={cn("cursor-pointer shrink-0 text-xs", selectedCategory !== cat && getCategoryStyle(cat))}
                  onClick={() => setSelectedCategory(prev => prev === cat ? null : cat)}
                >
                  {cat}
                </Badge>
              ))}
            </div>
          )}

          <ScrollArea className="flex-1">
            <motion.div
              variants={staggerContainer}
              initial="hidden"
              animate="show"
              className="p-3 sm:p-4 space-y-2.5"
            >
              {newsLoading && !liveNews.length ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <RefreshCw className="w-6 h-6 text-muted-foreground animate-spin" />
                  <p className="text-sm text-muted-foreground">Fetching personalized news…</p>
                </div>
              ) : filteredNews.length === 0 ? (
                <EmptyState
                  icon={Newspaper}
                  title={search || selectedCategory ? 'No matching articles' : 'No news available'}
                  description={search || selectedCategory ? 'Try adjusting your search or filters' : 'Pull to refresh or check your topic preferences'}
                  action={
                    (search || selectedCategory) ? (
                      <Button variant="outline" size="sm" onClick={() => { setSearch(''); setSelectedCategory(null); }}>
                        Clear Filters
                      </Button>
                    ) : (
                      <Button variant="outline" size="sm" onClick={refetchNews}>
                        <RefreshCw className="w-3.5 h-3.5 mr-1.5" />Refresh
                      </Button>
                    )
                  }
                />
              ) : (
                filteredNews.map((article, idx) => (
                  <motion.div key={idx} variants={staggerItem}>
                    <GlassCard pressable haptic="light" className="p-3 sm:p-4">
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                            <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", getCategoryStyle(article.category))}>
                              {article.category}
                            </Badge>
                          </div>
                          <h3 className="font-semibold text-sm leading-snug line-clamp-2 text-foreground">{article.headline}</h3>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">{article.summary}</p>
                        </div>
                        <div className="flex flex-col gap-0.5 shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            className={cn("h-8 w-8", isAlreadySaved(article) && "text-primary")}
                            onClick={() => saveArticle(article)}
                          >
                            {isAlreadySaved(article) ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
                          </Button>
                          {article.url && (
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => window.open(article.url, '_blank')}>
                              <ExternalLink className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </GlassCard>
                  </motion.div>
                ))
              )}
            </motion.div>
          </ScrollArea>
        </TabsContent>

        {/* Saved Articles */}
        <TabsContent value="saved" className="flex-1 mt-0 flex flex-col min-h-0">
          {/* Saved filter chips */}
          <div className="px-3 pt-2 sm:px-4 flex gap-1.5">
            {(['all', 'unread', 'read'] as const).map(f => (
              <Badge
                key={f}
                variant={savedFilter === f ? 'default' : 'outline'}
                className="cursor-pointer text-xs capitalize"
                onClick={() => setSavedFilter(f)}
              >
                {f}{f === 'unread' && unreadCount > 0 ? ` (${unreadCount})` : ''}
              </Badge>
            ))}
          </div>

          <ScrollArea className="flex-1">
            <motion.div
              variants={staggerContainer}
              initial="hidden"
              animate="show"
              className="p-3 sm:p-4 space-y-2.5"
            >
              {filteredSaved.length === 0 ? (
                <EmptyState
                  icon={Bookmark}
                  title={savedFilter !== 'all' || search ? 'No matching saved articles' : 'No saved articles yet'}
                  description={savedFilter !== 'all' || search ? 'Try adjusting your filters' : 'Bookmark articles from the Live Feed to read later'}
                  action={
                    savedFilter !== 'all' ? (
                      <Button variant="outline" size="sm" onClick={() => setSavedFilter('all')}>Show All</Button>
                    ) : undefined
                  }
                />
              ) : (
                filteredSaved.map((article) => (
                  <motion.div key={article.id} variants={staggerItem}>
                    <GlassCard
                      pressable
                      haptic="light"
                      className={cn(
                        "p-3 sm:p-4",
                        !article.is_read && "border-primary/20 bg-primary/5"
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                            <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", getCategoryStyle(article.category || 'Tech'))}>
                              {article.category || 'Tech'}
                            </Badge>
                            {!article.is_read && (
                              <Badge className="text-[10px] px-1.5 py-0 bg-primary/20 text-primary border-primary/30">New</Badge>
                            )}
                          </div>
                          <h3 className="font-semibold text-sm leading-snug line-clamp-2 text-foreground">{article.title}</h3>
                          {article.summary && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">{article.summary}</p>
                          )}
                          <p className="text-[10px] text-muted-foreground/70 mt-2">
                            Saved {format(new Date(article.saved_at), 'MMM d, yyyy')}
                          </p>
                        </div>
                        <div className="flex flex-col gap-0.5 shrink-0">
                          {!article.is_read && (
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={() => markAsRead(article.id)} title="Mark as read">
                              <Check className="w-4 h-4" />
                            </Button>
                          )}
                          {article.url && (
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => window.open(article.url, '_blank')} title="Open article">
                              <ExternalLink className="w-4 h-4" />
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive/70 hover:text-destructive" onClick={() => deleteArticle(article.id)} title="Remove">
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    </GlassCard>
                  </motion.div>
                ))
              )}
            </motion.div>
          </ScrollArea>
        </TabsContent>
      </Tabs>

      {/* Preferences Dialog */}
      <Dialog open={prefsOpen} onOpenChange={setPrefsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings2 className="w-5 h-5 text-primary" />
              News Preferences
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">Topics you follow</label>
              <div className="flex flex-wrap gap-1.5 mb-3">
                {editTopics.map(t => (
                  <Badge key={t} variant="secondary" className="gap-1 pr-1">
                    {t}
                    <button onClick={() => removeTopic(t)} className="ml-0.5 hover:text-destructive">
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="Add a topic…"
                  value={newTopic}
                  onChange={e => setNewTopic(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addTopic())}
                  className="h-9 text-sm"
                />
                <Button variant="outline" size="sm" onClick={addTopic} disabled={!newTopic.trim()}>Add</Button>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">Suggested topics</label>
              <div className="flex flex-wrap gap-1.5">
                {['Crypto', 'Cybersecurity', 'Cloud', 'Robotics', 'Biotech', 'Web3', 'Finance', 'Design'].filter(t => !editTopics.includes(t)).map(t => (
                  <Badge
                    key={t}
                    variant="outline"
                    className="cursor-pointer hover:bg-primary/10 text-xs"
                    onClick={() => setEditTopics(prev => [...prev, t])}
                  >
                    + {t}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPrefsOpen(false)}>Cancel</Button>
            <Button onClick={savePrefs}>Save Preferences</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PanelShell>
  );
}
