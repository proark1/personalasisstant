import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Newspaper, Bookmark, ExternalLink, RefreshCw, Check, Loader2 } from 'lucide-react';
import { useTechNews } from '@/hooks/useTechNews';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

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
    loading,
  } = useTechNews();

  const [activeTab, setActiveTab] = useState('live');

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Newspaper className="w-5 h-5 text-primary" />
          AI & Tech News
        </h2>
        <Button variant="ghost" size="icon" onClick={refetchNews} disabled={newsLoading}>
          <RefreshCw className={cn("w-4 h-4", newsLoading && "animate-spin")} />
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <TabsList className="mx-4 mt-3 grid grid-cols-2">
          <TabsTrigger value="live" className="gap-1">
            <Newspaper className="w-4 h-4" />
            Live Feed
          </TabsTrigger>
          <TabsTrigger value="saved" className="gap-1">
            <Bookmark className="w-4 h-4" />
            Saved
            {unreadCount > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5">{unreadCount}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Live News */}
        <TabsContent value="live" className="flex-1 mt-0">
          <ScrollArea className="h-full">
            <div className="p-4 space-y-3">
              {newsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : liveNews.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No news available. Try refreshing.
                </p>
              ) : (
                liveNews.map((article, idx) => (
                  <Card key={idx} className="p-4 hover:border-primary/50 transition-all">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className="text-xs">{article.category}</Badge>
                        </div>
                        <h3 className="font-medium line-clamp-2">{article.headline}</h3>
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{article.summary}</p>
                      </div>
                      <div className="flex flex-col gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => saveArticle(article)}
                        >
                          <Bookmark className="w-4 h-4" />
                        </Button>
                        {article.url && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => window.open(article.url, '_blank')}
                          >
                            <ExternalLink className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </Card>
                ))
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        {/* Saved Articles */}
        <TabsContent value="saved" className="flex-1 mt-0">
          <ScrollArea className="h-full">
            <div className="p-4 space-y-3">
              {savedArticles.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No saved articles yet. Save articles from the Live Feed.
                </p>
              ) : (
                savedArticles.map((article) => (
                  <Card
                    key={article.id}
                    className={cn(
                      "p-4 transition-all",
                      !article.is_read && "border-primary/30 bg-primary/5"
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className="text-xs">{article.category || 'Tech'}</Badge>
                          {!article.is_read && <Badge className="text-xs">New</Badge>}
                        </div>
                        <h3 className="font-medium line-clamp-2">{article.title}</h3>
                        {article.summary && (
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{article.summary}</p>
                        )}
                        <p className="text-xs text-muted-foreground mt-2">
                          Saved {format(new Date(article.saved_at), 'MMM d, yyyy')}
                        </p>
                      </div>
                      <div className="flex flex-col gap-1">
                        {!article.is_read && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => markAsRead(article.id)}
                          >
                            <Check className="w-4 h-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => window.open(article.url, '_blank')}
                        >
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))
              )}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}
