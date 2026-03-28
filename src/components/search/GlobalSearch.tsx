import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Search, 
  ListTodo, 
  Calendar, 
  MessageSquare, 
  Clock, 
  X,
  ArrowRight,
  CheckCircle2,
  Circle,
  FileText,
  Users,
  FolderOpen
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { SearchResult, SearchFilters } from '@/hooks/useGlobalSearch';

interface GlobalSearchProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  results: SearchResult[];
  recentSearches: { id: string; query: string; createdAt: Date }[];
  loading: boolean;
  onSearch: (query: string, filters?: SearchFilters) => void;
  onClearResults: () => void;
  onClearRecent: () => void;
  onSelectResult: (result: SearchResult) => void;
}

const typeIcons: Record<string, React.ElementType> = {
  task: ListTodo,
  event: Calendar,
  chat: MessageSquare,
  contract: FileText,
  contact: Users,
  project: FolderOpen,
};

const priorityColors: Record<string, string> = {
  high: 'bg-red-500/20 text-red-400 border-red-500/50',
  medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50',
  low: 'bg-green-500/20 text-green-400 border-green-500/50',
};

function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query || query.length < 2) return text;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'));
  if (parts.length === 1) return text;
  return parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase()
      ? <mark key={i} className="bg-primary/20 text-foreground rounded-sm px-0.5">{part}</mark>
      : part
  );
}

export function GlobalSearch({
  open,
  onOpenChange,
  results,
  recentSearches,
  loading,
  onSearch,
  onClearResults,
  onClearRecent,
  onSelectResult,
}: GlobalSearchProps) {
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<SearchFilters>({
    types: ['task', 'event', 'chat', 'contract', 'contact', 'project'],
  });
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      setQuery('');
      onClearResults();
    }
  }, [open, onClearResults]);

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (query.trim().length >= 2) {
      debounceRef.current = setTimeout(() => {
        onSearch(query, filters);
      }, 300);
    } else {
      onClearResults();
    }

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query, filters, onSearch, onClearResults]);

  const toggleTypeFilter = (type: 'task' | 'event' | 'chat' | 'contract' | 'contact' | 'project') => {
    setFilters(prev => ({
      ...prev,
      types: prev.types.includes(type)
        ? prev.types.filter(t => t !== type)
        : [...prev.types, type],
    }));
  };

  const handleSelectRecent = (recentQuery: string) => {
    setQuery(recentQuery);
    onSearch(recentQuery, filters);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] p-0 gap-0">
        <DialogHeader className="p-4 pb-0">
          <DialogTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Global Search
          </DialogTitle>
        </DialogHeader>

        <div className="p-4 space-y-4">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search tasks, events, contracts, contacts..."
              className="pl-10 pr-10"
            />
            {query && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                onClick={() => {
                  setQuery('');
                  onClearResults();
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* Type Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-muted-foreground">Filter:</span>
            {(['task', 'event', 'chat', 'contract', 'contact', 'project'] as const).map((type) => {
              const Icon = typeIcons[type];
              const isActive = filters.types.includes(type);
              const label = type === 'contract' ? 'Contracts' : 
                           type === 'contact' ? 'Contacts' : 
                           type === 'project' ? 'Projects' :
                           type.charAt(0).toUpperCase() + type.slice(1) + 's';
              return (
                <Button
                  key={type}
                  variant={isActive ? 'default' : 'outline'}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => toggleTypeFilter(type)}
                >
                  <Icon className="h-3 w-3 mr-1" />
                  {label}
                </Button>
              );
            })}
          </div>

          {/* Results or Recent Searches */}
          <ScrollArea className="h-[300px]">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : results.length > 0 ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    {results.length} result{results.length !== 1 ? 's' : ''}
                  </span>
                </div>
                {results.map((result) => {
                  const Icon = typeIcons[result.type];
                  return (
                    <button
                      key={`${result.type}-${result.id}`}
                      onClick={() => onSelectResult(result)}
                      className="w-full text-left p-3 rounded-lg bg-card/50 border border-border/50 hover:border-primary/50 hover:bg-card transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <div className="p-2 rounded-md bg-muted">
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            {result.type === 'task' && (
                              result.completed ? (
                                <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                              ) : (
                                <Circle className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                              )
                            )}
                            <span className="font-medium text-sm truncate">
                              {highlightMatch(result.title, query)}
                            </span>
                          </div>
                          {result.description && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                              {highlightMatch(result.description, query)}
                            </p>
                          )}
                          <div className="flex items-center gap-2 mt-2 flex-wrap">
                            <Badge variant="outline" className="text-xs">
                              {result.type}
                            </Badge>
                            {result.priority && (
                              <Badge 
                                variant="outline" 
                                className={`text-xs ${priorityColors[result.priority] || ''}`}
                              >
                                {result.priority}
                              </Badge>
                            )}
                            {result.date && (
                              <span className="text-xs text-muted-foreground">
                                {formatDistanceToNow(result.date, { addSuffix: true })}
                              </span>
                            )}
                          </div>
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : query.length >= 2 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <Search className="h-12 w-12 mb-2 opacity-50" />
                <p>No results found</p>
              </div>
            ) : recentSearches.length > 0 ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Recent searches
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={onClearRecent}
                  >
                    Clear all
                  </Button>
                </div>
                {recentSearches.map((recent) => (
                  <button
                    key={recent.id}
                    onClick={() => handleSelectRecent(recent.query)}
                    className="w-full text-left p-2 rounded-lg hover:bg-muted transition-colors flex items-center gap-2"
                  >
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{recent.query}</span>
                    <span className="text-xs text-muted-foreground ml-auto">
                      {formatDistanceToNow(recent.createdAt, { addSuffix: true })}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <Search className="h-12 w-12 mb-2 opacity-50" />
                <p>Type to search...</p>
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Keyboard shortcuts hint */}
        <div className="p-3 border-t border-border bg-muted/50 text-xs text-muted-foreground flex items-center justify-between">
          <span>Press <kbd className="px-1.5 py-0.5 bg-background rounded border">⌘</kbd> + <kbd className="px-1.5 py-0.5 bg-background rounded border">K</kbd> to open search</span>
          <span>Press <kbd className="px-1.5 py-0.5 bg-background rounded border">Esc</kbd> to close</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
