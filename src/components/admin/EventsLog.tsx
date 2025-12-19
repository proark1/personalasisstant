import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Clock, User, MousePointer } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';

interface AnalyticsEvent {
  id: string;
  user_id: string;
  event_type: string;
  event_category: string;
  event_data: Record<string, unknown>;
  page_path: string | null;
  session_id: string | null;
  created_at: string;
}

interface EventsLogProps {
  events: AnalyticsEvent[];
}

const CATEGORY_COLORS: Record<string, string> = {
  navigation: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  task: 'bg-green-500/10 text-green-500 border-green-500/20',
  event: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  habit: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
  ai: 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20',
  contact: 'bg-pink-500/10 text-pink-500 border-pink-500/20',
  contract: 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20',
  call: 'bg-red-500/10 text-red-500 border-red-500/20',
  chat: 'bg-teal-500/10 text-teal-500 border-teal-500/20',
  search: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
  auth: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  settings: 'bg-slate-500/10 text-slate-500 border-slate-500/20',
  project: 'bg-violet-500/10 text-violet-500 border-violet-500/20',
};

export function EventsLog({ events }: EventsLogProps) {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  const categories = [...new Set(events.map(e => e.event_category))].sort();
  const types = [...new Set(events.map(e => e.event_type))].sort();

  const filteredEvents = events.filter(event => {
    const matchesSearch = 
      search === '' ||
      event.event_type.toLowerCase().includes(search.toLowerCase()) ||
      event.event_category.toLowerCase().includes(search.toLowerCase()) ||
      event.user_id.toLowerCase().includes(search.toLowerCase()) ||
      event.page_path?.toLowerCase().includes(search.toLowerCase());
    
    const matchesCategory = categoryFilter === 'all' || event.event_category === categoryFilter;
    const matchesType = typeFilter === 'all' || event.event_type === typeFilter;

    return matchesSearch && matchesCategory && matchesType;
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <CardTitle className="text-lg">Events Log</CardTitle>
          <div className="flex items-center gap-2">
            <div className="relative w-48">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search events..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-9"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-36 h-9">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map(cat => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-36 h-9">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {types.map(type => (
                  <SelectItem key={type} value={type}>{type}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[500px]">
          <div className="space-y-2">
            {filteredEvents.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                No events found matching your filters.
              </div>
            ) : (
              filteredEvents.map(event => (
                <div 
                  key={event.id}
                  className="flex items-start gap-3 p-3 rounded-lg border border-border/50 bg-card/30 hover:bg-card/50 transition-colors"
                >
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <MousePointer className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge 
                        variant="outline" 
                        className={CATEGORY_COLORS[event.event_category] || 'bg-muted text-muted-foreground'}
                      >
                        {event.event_category}
                      </Badge>
                      <span className="font-medium text-sm">{event.event_type}</span>
                      {event.page_path && (
                        <span className="text-xs text-muted-foreground">
                          on {event.page_path}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {event.user_id.slice(0, 8)}...
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDistanceToNow(new Date(event.created_at), { addSuffix: true })}
                      </span>
                      <span className="text-muted-foreground/60">
                        {format(new Date(event.created_at), 'MMM d, HH:mm:ss')}
                      </span>
                    </div>
                    {event.event_data && Object.keys(event.event_data).length > 0 && (
                      <div className="mt-2 text-xs font-mono bg-muted/50 rounded p-2 overflow-x-auto">
                        {JSON.stringify(event.event_data, null, 2)}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
