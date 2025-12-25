import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useUserPatterns, UserPattern } from '@/hooks/useUserPatterns';
import { useDailyCheckins } from '@/hooks/useDailyCheckins';
import { 
  Brain, 
  TrendingUp, 
  TrendingDown, 
  Sparkles, 
  RefreshCw, 
  Moon, 
  Zap, 
  Target, 
  Heart,
  Dumbbell,
  X,
  AlertCircle,
  CheckCircle,
  Info
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';

const CATEGORY_ICONS: Record<string, any> = {
  sleep: Moon,
  productivity: Target,
  mood: Heart,
  health: Heart,
  exercise: Dumbbell,
  general: Brain,
};

const CATEGORY_COLORS: Record<string, string> = {
  sleep: 'text-indigo-500',
  productivity: 'text-emerald-500',
  mood: 'text-pink-500',
  health: 'text-red-500',
  exercise: 'text-orange-500',
  general: 'text-blue-500',
};

function PatternCard({ pattern, onDismiss }: { pattern: UserPattern; onDismiss: () => void }) {
  const Icon = CATEGORY_ICONS[pattern.category] || Brain;
  const colorClass = CATEGORY_COLORS[pattern.category] || 'text-blue-500';
  
  const confidencePercent = Math.round(pattern.confidence_score * 100);
  
  return (
    <Card className="relative group">
      <button
        onClick={onDismiss}
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-full hover:bg-muted"
      >
        <X className="w-4 h-4 text-muted-foreground" />
      </button>
      
      <CardContent className="pt-4">
        <div className="flex items-start gap-3">
          <div className={cn("p-2 rounded-lg bg-muted", colorClass)}>
            <Icon className="w-5 h-5" />
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="secondary" className="text-xs">
                {pattern.category}
              </Badge>
              <Badge 
                variant={pattern.pattern_type === 'correlation' ? 'default' : 'outline'}
                className="text-xs"
              >
                {pattern.pattern_type}
              </Badge>
            </div>
            
            <h4 className="font-medium text-sm mb-1">{pattern.title}</h4>
            <p className="text-xs text-muted-foreground line-clamp-2">
              {pattern.description}
            </p>
            
            <div className="flex items-center gap-2 mt-2">
              <div className="flex-1">
                <Progress value={confidencePercent} className="h-1.5" />
              </div>
              <span className="text-xs text-muted-foreground">
                {confidencePercent}% confidence
              </span>
            </div>
            
            {pattern.times_detected > 1 && (
              <p className="text-xs text-muted-foreground mt-1">
                Detected {pattern.times_detected} times
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function WeeklyTrendChart({ data }: { data: any[] }) {
  if (!data || data.length === 0) {
    return (
      <div className="h-48 flex items-center justify-center text-muted-foreground">
        <p className="text-sm">Complete daily check-ins to see trends</p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="colorMood" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
            <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
          </linearGradient>
          <linearGradient id="colorEnergy" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.3}/>
            <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0}/>
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis 
          dataKey="date" 
          tick={{ fontSize: 10 }} 
          className="text-muted-foreground"
        />
        <YAxis 
          domain={[0, 5]} 
          tick={{ fontSize: 10 }}
          className="text-muted-foreground"
        />
        <Tooltip 
          contentStyle={{ 
            backgroundColor: 'hsl(var(--background))',
            border: '1px solid hsl(var(--border))',
            borderRadius: '8px'
          }}
        />
        <Area 
          type="monotone" 
          dataKey="mood" 
          stroke="hsl(var(--primary))" 
          fillOpacity={1}
          fill="url(#colorMood)"
          name="Mood"
        />
        <Area 
          type="monotone" 
          dataKey="energy" 
          stroke="hsl(var(--chart-2))" 
          fillOpacity={1}
          fill="url(#colorEnergy)"
          name="Energy"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function LifePatternsDashboard() {
  const { 
    patterns, 
    weeklySummaries, 
    isLoading, 
    isAnalyzing, 
    analyzePatterns,
    dismissPattern,
    getHighConfidencePatterns
  } = useUserPatterns();
  
  const { getRecentMoods, getAverageStats } = useDailyCheckins();
  const [activeTab, setActiveTab] = useState('overview');

  const recentMoods = getRecentMoods();
  const avgStats = getAverageStats(7);
  const highConfidencePatterns = getHighConfidencePatterns(0.6);
  const latestSummary = weeklySummaries[0];

  // Transform mood data for chart
  const moodChartData = recentMoods.map(item => ({
    date: new Date(item.date).toLocaleDateString('en-US', { weekday: 'short' }),
    mood: item.mood ? getMoodValue(item.mood) : null,
    energy: item.energy ? getEnergyValue(item.energy) : null,
  })).filter(d => d.mood !== null || d.energy !== null);

  return (
    <div className="space-y-6">
      {/* Header with analyze button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Brain className="w-5 h-5 text-primary" />
            Life Patterns
          </h2>
          <p className="text-sm text-muted-foreground">
            AI-detected insights from your data
          </p>
        </div>
        
        <Button 
          onClick={analyzePatterns} 
          disabled={isAnalyzing}
          variant="outline"
          size="sm"
        >
          {isAnalyzing ? (
            <>
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              Analyzing...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 mr-2" />
              Analyze Patterns
            </>
          )}
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="patterns">Patterns</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4 mt-4">
          {/* Quick Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <Moon className="w-4 h-4 text-indigo-500" />
                  <span className="text-xs text-muted-foreground">Avg Sleep</span>
                </div>
                <p className="text-2xl font-bold mt-1">
                  {avgStats.avgSleep.toFixed(1)}h
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-500" />
                  <span className="text-xs text-muted-foreground">Avg Energy</span>
                </div>
                <p className="text-2xl font-bold mt-1">
                  {avgStats.avgEnergy.toFixed(1)}/5
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <Target className="w-4 h-4 text-emerald-500" />
                  <span className="text-xs text-muted-foreground">Focus Done</span>
                </div>
                <p className="text-2xl font-bold mt-1">
                  {Math.round(avgStats.focusCompletionRate * 100)}%
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <Heart className="w-4 h-4 text-pink-500" />
                  <span className="text-xs text-muted-foreground">Avg Day</span>
                </div>
                <p className="text-2xl font-bold mt-1">
                  {avgStats.avgDayRating.toFixed(1)}/5
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Mood & Energy Chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Mood & Energy (Last 7 Days)</CardTitle>
            </CardHeader>
            <CardContent>
              <WeeklyTrendChart data={moodChartData} />
            </CardContent>
          </Card>

          {/* Top Patterns */}
          {highConfidencePatterns.length > 0 && (
            <div>
              <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                Key Insights
              </h3>
              <div className="grid gap-3 md:grid-cols-2">
                {highConfidencePatterns.slice(0, 4).map(pattern => (
                  <PatternCard 
                    key={pattern.id} 
                    pattern={pattern}
                    onDismiss={() => dismissPattern(pattern.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {patterns.length === 0 && !isLoading && (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-8 text-center">
                <Brain className="w-10 h-10 text-muted-foreground mb-3" />
                <h3 className="font-medium mb-1">No patterns detected yet</h3>
                <p className="text-sm text-muted-foreground max-w-sm">
                  Complete daily check-ins and track your habits for at least a week 
                  to start seeing personalized patterns and insights.
                </p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="mt-4"
                  onClick={analyzePatterns}
                  disabled={isAnalyzing}
                >
                  {isAnalyzing ? 'Analyzing...' : 'Run Analysis'}
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="patterns" className="mt-4">
          <ScrollArea className="h-[500px] pr-4">
            {isLoading ? (
              <div className="flex items-center justify-center h-32">
                <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : patterns.length > 0 ? (
              <div className="grid gap-3">
                {patterns.map(pattern => (
                  <PatternCard 
                    key={pattern.id} 
                    pattern={pattern}
                    onDismiss={() => dismissPattern(pattern.id)}
                  />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-32 text-center">
                <Info className="w-8 h-8 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  No patterns found. Keep tracking to unlock insights!
                </p>
              </div>
            )}
          </ScrollArea>
        </TabsContent>

        <TabsContent value="trends" className="mt-4">
          <div className="space-y-4">
            {weeklySummaries.length > 0 ? (
              weeklySummaries.slice(0, 4).map(summary => (
                <Card key={summary.id}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">
                      Week of {new Date(summary.week_start).toLocaleDateString()}
                    </CardTitle>
                    <CardDescription>
                      {summary.tasks_completed} tasks • {Math.round(summary.focus_minutes / 60)}h focus • {summary.habits_completed}/{summary.habits_possible} habits
                    </CardDescription>
                  </CardHeader>
                  {summary.ai_summary && (
                    <CardContent className="pt-0">
                      <p className="text-sm text-muted-foreground">
                        {summary.ai_summary}
                      </p>
                    </CardContent>
                  )}
                </Card>
              ))
            ) : (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-8 text-center">
                  <TrendingUp className="w-10 h-10 text-muted-foreground mb-3" />
                  <h3 className="font-medium mb-1">Weekly summaries coming soon</h3>
                  <p className="text-sm text-muted-foreground">
                    Complete a full week of tracking to see your first summary.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Helper functions
function getMoodValue(moodEmoji: string): number {
  const moodMap: Record<string, number> = {
    '😊': 5, '🙂': 4, '😐': 3, '😔': 2, '😤': 2, '😰': 1
  };
  return moodMap[moodEmoji] || 3;
}

function getEnergyValue(energy: string): number {
  const energyMap: Record<string, number> = {
    'high': 5, 'medium': 3, 'low': 1
  };
  return energyMap[energy] || 3;
}
