import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Search, ArrowUpDown, User, Activity, Bot } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface UserStats {
  user_id: string;
  display_name: string | null;
  email: string | null;
  total_events: number;
  total_ai_tokens: number;
  last_active: string;
}

interface UserAnalyticsTableProps {
  userStats: UserStats[];
}

type SortField = 'display_name' | 'total_events' | 'total_ai_tokens' | 'last_active';
type SortDirection = 'asc' | 'desc';

export function UserAnalyticsTable({ userStats }: UserAnalyticsTableProps) {
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('total_events');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const filteredAndSorted = userStats
    .filter(user => {
      const searchLower = search.toLowerCase();
      return (
        user.display_name?.toLowerCase().includes(searchLower) ||
        user.email?.toLowerCase().includes(searchLower) ||
        user.user_id.toLowerCase().includes(searchLower)
      );
    })
    .sort((a, b) => {
      let comparison = 0;
      
      switch (sortField) {
        case 'display_name':
          comparison = (a.display_name || '').localeCompare(b.display_name || '');
          break;
        case 'total_events':
          comparison = a.total_events - b.total_events;
          break;
        case 'total_ai_tokens':
          comparison = a.total_ai_tokens - b.total_ai_tokens;
          break;
        case 'last_active':
          comparison = new Date(a.last_active || 0).getTime() - new Date(b.last_active || 0).getTime();
          break;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });

  const getActivityBadge = (events: number) => {
    if (events > 1000) return { label: 'Power User', variant: 'default' as const };
    if (events > 100) return { label: 'Active', variant: 'secondary' as const };
    if (events > 10) return { label: 'Regular', variant: 'outline' as const };
    return { label: 'New', variant: 'outline' as const };
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">User Activity</CardTitle>
          <div className="relative w-64">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search users..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-9"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[250px]">
                <Button
                  variant="ghost"
                  size="sm"
                  className="-ml-3 h-8 gap-1"
                  onClick={() => handleSort('display_name')}
                >
                  <User className="h-4 w-4" />
                  User
                  <ArrowUpDown className="h-3 w-3" />
                </Button>
              </TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  size="sm"
                  className="-ml-3 h-8 gap-1"
                  onClick={() => handleSort('total_events')}
                >
                  <Activity className="h-4 w-4" />
                  Events
                  <ArrowUpDown className="h-3 w-3" />
                </Button>
              </TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  size="sm"
                  className="-ml-3 h-8 gap-1"
                  onClick={() => handleSort('total_ai_tokens')}
                >
                  <Bot className="h-4 w-4" />
                  AI Tokens
                  <ArrowUpDown className="h-3 w-3" />
                </Button>
              </TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  size="sm"
                  className="-ml-3 h-8 gap-1"
                  onClick={() => handleSort('last_active')}
                >
                  Last Active
                  <ArrowUpDown className="h-3 w-3" />
                </Button>
              </TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAndSorted.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  No users found
                </TableCell>
              </TableRow>
            ) : (
              filteredAndSorted.map(user => {
                const activityBadge = getActivityBadge(user.total_events);
                return (
                  <TableRow key={user.user_id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-xs">
                            {(user.display_name || user.email || 'U').slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-sm">
                            {user.display_name || 'Unnamed User'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {user.email || user.user_id.slice(0, 8)}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-sm">
                        {user.total_events.toLocaleString()}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-sm">
                        {user.total_ai_tokens.toLocaleString()}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {user.last_active 
                          ? formatDistanceToNow(new Date(user.last_active), { addSuffix: true })
                          : 'Never'
                        }
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={activityBadge.variant}>
                        {activityBadge.label}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
