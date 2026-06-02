import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

// Single source of truth for the searchable surface — used by the hook,
// the filter pills, and any other consumer that wants to enumerate types.
export const SEARCHABLE_TYPES = [
  'task',
  'event',
  'note',
  'chat',
  'contact',
  'contract',
  'project',
  'workspace',
] as const;

export type SearchableType = (typeof SEARCHABLE_TYPES)[number];

// Narrow row shapes for the supabase queries below — keeps the executor
// honest about what it's reading and avoids `any` leaks.
interface NoteRow {
  id: string;
  title: string | null;
  content: string | null;
  tags: string[] | null;
  updated_at: string | null;
}
interface WorkspaceRow {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  archived: boolean | null;
}

export interface SearchResult {
  id: string;
  type: SearchableType;
  title: string;
  description?: string;
  date?: Date;
  priority?: string;
  completed?: boolean;
  matchedField: string;
  color?: string;
}

export interface SearchFilters {
  types: SearchableType[];
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

  // Monotonic request id. Each search() bumps it before doing async work
  // and discards results when a newer request has been issued in the
  // meantime — otherwise typing fast lets older queries clobber newer
  // ones, and the loading flag drops too early after the first resolution.
  const requestIdRef = useRef(0);

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
          filters: (s.filters as unknown as SearchFilters) || { types: ['task', 'event', 'chat', 'contract', 'contact', 'project'] },
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
    filters: SearchFilters = { types: [...SEARCHABLE_TYPES] }
  ) => {
    if (!userId || !query.trim()) {
      setResults([]);
      return;
    }

    const reqId = ++requestIdRef.current;
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

      // Search contracts
      if (filters.types.includes('contract')) {
        const { data: contracts } = await supabase
          .from('contracts')
          .select('*');

        if (contracts) {
          contracts.forEach(contract => {
            let matchedField = '';
            if (fuzzyMatch(contract.name, trimmedQuery)) {
              matchedField = 'name';
            } else if (contract.provider && fuzzyMatch(contract.provider, trimmedQuery)) {
              matchedField = 'provider';
            } else if (contract.notes && fuzzyMatch(contract.notes, trimmedQuery)) {
              matchedField = 'notes';
            } else if (contract.category && fuzzyMatch(contract.category, trimmedQuery)) {
              matchedField = 'category';
            }

            if (matchedField) {
              searchResults.push({
                id: contract.id,
                type: 'contract',
                title: contract.name,
                description: contract.provider || contract.category || undefined,
                date: contract.renewal_date ? new Date(contract.renewal_date) : undefined,
                matchedField,
              });
            }
          });
        }
      }

      // Search contacts
      if (filters.types.includes('contact')) {
        const { data: contacts } = await supabase
          .from('user_contacts')
          .select('*');

        if (contacts) {
          contacts.forEach(contact => {
            let matchedField = '';
            if (fuzzyMatch(contact.name, trimmedQuery)) {
              matchedField = 'name';
            } else if (contact.email && fuzzyMatch(contact.email, trimmedQuery)) {
              matchedField = 'email';
            } else if (contact.company && fuzzyMatch(contact.company, trimmedQuery)) {
              matchedField = 'company';
            } else if (contact.role && fuzzyMatch(contact.role, trimmedQuery)) {
              matchedField = 'role';
            } else if (contact.notes && fuzzyMatch(contact.notes, trimmedQuery)) {
              matchedField = 'notes';
            }

            if (matchedField) {
              searchResults.push({
                id: contact.id,
                type: 'contact',
                title: contact.name,
                description: [contact.company, contact.role].filter(Boolean).join(' - ') || contact.email || undefined,
                date: contact.updated_at ? new Date(contact.updated_at) : undefined,
                matchedField,
              });
            }
          });
        }
      }

      // Search projects
      if (filters.types.includes('project')) {
        const { data: projects } = await supabase
          .from('projects')
          .select('*');

        if (projects) {
          projects.forEach(project => {
            let matchedField = '';
            if (fuzzyMatch(project.name, trimmedQuery)) {
              matchedField = 'name';
            } else if (project.description && fuzzyMatch(project.description, trimmedQuery)) {
              matchedField = 'description';
            }

            if (matchedField) {
              searchResults.push({
                id: project.id,
                type: 'project',
                title: project.name,
                description: project.description || undefined,
                date: project.updated_at ? new Date(project.updated_at) : undefined,
                matchedField,
                color: project.color,
              });
            }
          });
        }
      }

      // Search notes — RLS already restricts to rows the user can see (own
      // personal + shared workspaces), so we can run a single ilike instead
      // of a fuzzy match in JS for speed.
      //
      // PostgREST splits the .or() string on commas, so a query like
      // "New York, NY" would break the filter. We wrap each ilike value in
      // double quotes and escape any internal quotes per PostgREST rules.
      if (filters.types.includes('note')) {
        const escaped = trimmedQuery.replace(/%/g, '\\%').replace(/"/g, '""');
        const like = `%${escaped}%`;
        const { data: notes } = await supabase
          .from('notes')
          .select('id, title, content, tags, updated_at')
          .or(`title.ilike."${like}",content.ilike."${like}"`)
          .eq('trashed', false)
          .limit(20);
        if (notes) {
          (notes as NoteRow[]).forEach((n) => {
            const matched = (n.title || '').toLowerCase().includes(trimmedQuery.toLowerCase()) ? 'title' : 'content';
            searchResults.push({
              id: n.id,
              type: 'note',
              title: n.title || '(untitled)',
              description: typeof n.content === 'string' ? n.content.slice(0, 120) : undefined,
              date: n.updated_at ? new Date(n.updated_at) : undefined,
              matchedField: matched,
            });
          });
        }
      }

      // Search workspaces (so users can jump to a workspace by name).
      if (filters.types.includes('workspace')) {
        const like = `%${trimmedQuery.replace(/%/g, '\\%')}%`;
        const { data: workspaces } = await supabase
          .from('workspaces')
          .select('id, name, description, icon, archived')
          .ilike('name', like)
          .eq('archived', false)
          .limit(8);
        if (workspaces) {
          (workspaces as WorkspaceRow[]).forEach((w) => {
            searchResults.push({
              id: w.id,
              type: 'workspace',
              title: `${w.icon || '📁'} ${w.name}`,
              description: w.description || undefined,
              matchedField: 'name',
            });
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

      // Race guard: if a newer search has been issued while we were
      // awaiting, drop these stale results and don't touch loading/history.
      if (reqId !== requestIdRef.current) return;

      setResults(searchResults);

      // Save to search history
      await supabase.from('search_history').insert({
        user_id: userId,
        query: trimmedQuery,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
      // Only clear the loading flag if this was the latest in-flight
      // request — otherwise a stale resolve would unset loading while a
      // newer query is still running.
      if (reqId === requestIdRef.current) setLoading(false);
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
