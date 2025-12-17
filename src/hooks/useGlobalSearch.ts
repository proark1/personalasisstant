import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Task, CalendarEvent } from '@/types/flux';

export interface SearchResult {
  id: string;
  type: 'task' | 'event' | 'chat';
  title: string;
  description?: string;
  date?: Date;
  priority?: string;
  completed?: boolean;
  matchedField: string;
}

export interface SearchFilters {
  types: ('task' | 'event' | 'chat')[];
  dateRange?: { start: Date; end: Date };
  priority?: string[];
  completed?: boolean;
}

interface RecentSearch {
  id: string;
  query: string;
  filters: SearchFilters;
  createdAt: Date;
}

export function useGlobalSearch(userId: string | undefined) {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch recent searches on mount
  useEffect(() => {
    if (!userId) return;

    const fetchRecentSearches = async () => {
      const { data } = await supabase
        .from('search_history')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (data) {
        setRecentSearches(data.map(s => ({
          id: s.id,
          query: s.query,
          filters: (s.filters as unknown as SearchFilters) || { types: ['task', 'event', 'chat'] },
          createdAt: new Date(s.created_at),
        })));
      }
    };

    fetchRecentSearches();
  }, [userId]);

  const fuzzyMatch = (text: string, query: string): boolean => {
    const lowerText = text.toLowerCase();
    const lowerQuery = query.toLowerCase();
    
    // Direct contains
    if (lowerText.includes(lowerQuery)) return true;
    
    // Fuzzy match - all query characters appear in order
    let queryIndex = 0;
    for (const char of lowerText) {
      if (char === lowerQuery[queryIndex]) {
        queryIndex++;
        if (queryIndex === lowerQuery.length) return true;
      }
    }
    
    return false;
  };

  const search = useCallback(async (
    query: string,
    filters: SearchFilters = { types: ['task', 'event', 'chat'] }
  ) => {
    if (!userId || !query.trim()) {
      setResults([]);
      return;
    }

    setLoading(true);
    const searchResults: SearchResult[] = [];
    const trimmedQuery = query.trim();

    try {
      // Search tasks
      if (filters.types.includes('task')) {
        const { data: tasks } = await supabase
          .from('tasks')
          .select('*');

        if (tasks) {
          tasks.forEach(task => {
            let matchedField = '';
            if (fuzzyMatch(task.title, trimmedQuery)) {
              matchedField = 'title';
            } else if (task.description && fuzzyMatch(task.description, trimmedQuery)) {
              matchedField = 'description';
            }

            if (matchedField) {
              // Apply filters
              if (filters.completed !== undefined && task.completed !== filters.completed) return;
              if (filters.priority?.length && !filters.priority.includes(task.priority)) return;
              if (filters.dateRange && task.due_date) {
                const dueDate = new Date(task.due_date);
                if (dueDate < filters.dateRange.start || dueDate > filters.dateRange.end) return;
              }

              searchResults.push({
                id: task.id,
                type: 'task',
                title: task.title,
                description: task.description || undefined,
                date: task.due_date ? new Date(task.due_date) : undefined,
                priority: task.priority,
                completed: task.completed,
                matchedField,
              });
            }
          });
        }
      }

      // Search events
      if (filters.types.includes('event')) {
        const { data: events } = await supabase
          .from('events')
          .select('*');

        if (events) {
          events.forEach(event => {
            let matchedField = '';
            if (fuzzyMatch(event.title, trimmedQuery)) {
              matchedField = 'title';
            } else if (event.description && fuzzyMatch(event.description, trimmedQuery)) {
              matchedField = 'description';
            } else if (event.location && fuzzyMatch(event.location, trimmedQuery)) {
              matchedField = 'location';
            }

            if (matchedField) {
              if (filters.dateRange) {
                const startTime = new Date(event.start_time);
                if (startTime < filters.dateRange.start || startTime > filters.dateRange.end) return;
              }

              searchResults.push({
                id: event.id,
                type: 'event',
                title: event.title,
                description: event.description || undefined,
                date: new Date(event.start_time),
                matchedField,
              });
            }
          });
        }
      }

      // Search chat messages
      if (filters.types.includes('chat')) {
        const { data: messages } = await supabase
          .from('chat_messages')
          .select('*')
          .eq('user_id', userId);

        if (messages) {
          messages.forEach(msg => {
            if (fuzzyMatch(msg.content, trimmedQuery)) {
              searchResults.push({
                id: msg.id,
                type: 'chat',
                title: msg.content.substring(0, 100) + (msg.content.length > 100 ? '...' : ''),
                date: new Date(msg.created_at),
                matchedField: 'content',
              });
            }
          });
        }
      }

      // Sort by relevance (title matches first, then by date)
      searchResults.sort((a, b) => {
        if (a.matchedField === 'title' && b.matchedField !== 'title') return -1;
        if (b.matchedField === 'title' && a.matchedField !== 'title') return 1;
        if (a.date && b.date) return b.date.getTime() - a.date.getTime();
        return 0;
      });

      setResults(searchResults);

      // Save to search history
      await supabase.from('search_history').insert({
        user_id: userId,
        query: trimmedQuery,
        filters: filters as any,
      });

      // Update recent searches locally
      setRecentSearches(prev => [
        { id: crypto.randomUUID(), query: trimmedQuery, filters, createdAt: new Date() },
        ...prev.filter(s => s.query !== trimmedQuery).slice(0, 9),
      ]);

    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const clearRecentSearches = useCallback(async () => {
    if (!userId) return;

    await supabase
      .from('search_history')
      .delete()
      .eq('user_id', userId);

    setRecentSearches([]);
  }, [userId]);

  const clearResults = useCallback(() => {
    setResults([]);
  }, []);

  return {
    results,
    recentSearches,
    loading,
    search,
    clearResults,
    clearRecentSearches,
  };
}
