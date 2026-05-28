import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Bot, Zap, DollarSign, AlertCircle, CheckCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface AIUsage {
  id: string;
  user_id: string;
  function_name: string;
  model: string | null;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  cost_estimate: number;
  response_status: string;
  created_at: string;
}

interface AIUsagePanelProps {
  aiUsage: AIUsage[];
}

export function AIUsagePanel({ aiUsage }: AIUsagePanelProps) {
  const [search, setSearch] = useState('');
  const [functionFilter, setFunctionFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const functions = [...new Set(aiUsage.map(a => a.function_name))].sort();
  const statuses = [...new Set(aiUsage.map(a => a.response_status))].sort();

  const filteredUsage = aiUsage.filter(usage => {
    const matchesSearch = 
      search === '' ||
      usage.function_name.toLowerCase().includes(search.toLowerCase()) ||
      usage.user_id.toLowerCase().includes(search.toLowerCase()) ||
      usage.model?.toLowerCase().includes(search.toLowerCase());
    
    const matchesFunction = functionFilter === 'all' || usage.function_name === functionFilter;
    const matchesStatus = statusFilter === 'all' || usage.response_status === statusFilter;

    return matchesSearch && matchesFunction && matchesStatus;
  });

  // Calculate totals
  const totals = filteredUsage.reduce(
    (acc, usage) => ({
      promptTokens: acc.promptTokens + usage.prompt_tokens,
      completionTokens: acc.completionTokens + usage.completion_tokens,
      totalTokens: acc.totalTokens + usage.total_tokens,
      cost: acc.cost + Number(usage.cost_estimate),
    }),
    { promptTokens: 0, completionTokens: 0, totalTokens: 0, cost: 0 }
  );

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-card/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Zap className="h-4 w-4 text-yellow-500" />
              <span className="text-xs">Prompt Tokens</span>
            </div>
            <p className="text-xl font-bold mt-1 font-mono">
              {totals.promptTokens.toLocaleString()}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-card/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Bot className="h-4 w-4 text-cyan-500" />
              <span className="text-xs">Completion Tokens</span>
            </div>
            <p className="text-xl font-bold mt-1 font-mono">
              {totals.completionTokens.toLocaleString()}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-card/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Zap className="h-4 w-4 text-purple-500" />
              <span className="text-xs">Total Tokens</span>
            </div>
            <p className="text-xl font-bold mt-1 font-mono">
              {totals.totalTokens.toLocaleString()}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-card/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <DollarSign className="h-4 w-4 text-emerald-500" />
              <span className="text-xs">Estimated Cost</span>
            </div>
            <p className="text-xl font-bold mt-1 font-mono">
              ${totals.cost.toFixed(4)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Usage Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <CardTitle className="text-lg">AI Requests</CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative w-48">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 h-9"
                />
              </div>
              <Select value={functionFilter} onValueChange={setFunctionFilter}>
                <SelectTrigger className="w-36 h-9">
                  <SelectValue placeholder="Function" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Functions</SelectItem>
                  {functions.map(fn => (
                    <SelectItem key={fn} value={fn}>{fn}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-28 h-9">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {statuses.map(status => (
                    <SelectItem key={status} value={status}>{status}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Function</TableHead>
                <TableHead>Model</TableHead>
                <TableHead className="text-right">Tokens</TableHead>
                <TableHead className="text-right">Cost</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsage.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No AI usage found matching your filters.
                  </TableCell>
                </TableRow>
              ) : (
                filteredUsage.map(usage => (
                  <TableRow key={usage.id}>
                    <TableCell>
                      <Badge variant="outline" className="font-mono text-xs">
                        {usage.function_name}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {usage.model || 'N/A'}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="font-mono text-sm">
                        {usage.total_tokens.toLocaleString()}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {usage.prompt_tokens} / {usage.completion_tokens}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      ${Number(usage.cost_estimate).toFixed(6)}
                    </TableCell>
                    <TableCell>
                      {usage.response_status === 'success' ? (
                        <Badge variant="outline" className="gap-1 text-emerald-500 border-emerald-500/30">
                          <CheckCircle className="h-3 w-3" />
                          Success
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="gap-1 text-red-500 border-red-500/30">
                          <AlertCircle className="h-3 w-3" />
                          {usage.response_status}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(usage.created_at), { addSuffix: true })}
                      </span>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
