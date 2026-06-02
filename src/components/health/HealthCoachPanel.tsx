import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Brain, 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  Sparkles, 
  Send,
  RefreshCw,
  Target,
  Lightbulb,
  Activity,
  Moon,
  Heart,
  Footprints
} from 'lucide-react';
import { useHealthCoach, TrendData, Correlation } from '@/hooks/useHealthCoach';
import { cn } from '@/lib/utils';

const metricIcons: Record<string, React.ReactNode> = {
  steps: <Footprints className="h-4 w-4" />,
  sleep_hours: <Moon className="h-4 w-4" />,
  heart_rate: <Heart className="h-4 w-4" />,
  resting_heart_rate: <Heart className="h-4 w-4" />,
  hrv: <Activity className="h-4 w-4" />,
  exercise_minutes: <Activity className="h-4 w-4" />,
};

const metricLabels: Record<string, string> = {
  steps: 'Steps',
  sleep_hours: 'Sleep',
  heart_rate: 'Heart Rate',
  resting_heart_rate: 'Resting HR',
  hrv: 'HRV',
  exercise_minutes: 'Exercise',
  calories: 'Calories',
  blood_oxygen: 'Blood Oxygen',
  weight: 'Weight',
  stress_level: 'Stress',
  water_glasses: 'Hydration',
};

function TrendCard({ trend }: { trend: TrendData }) {
  const TrendIcon = trend.trend === 'improving' ? TrendingUp : 
                   trend.trend === 'declining' ? TrendingDown : Minus;
  
  const trendColor = trend.trend === 'improving' ? 'text-green-500' : 
                     trend.trend === 'declining' ? 'text-red-500' : 'text-muted-foreground';

  return (
    <Card className="p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {metricIcons[trend.metric] || <Activity className="h-4 w-4" />}
          <span className="font-medium text-sm">
            {metricLabels[trend.metric] || trend.metric}
          </span>
        </div>
        <TrendIcon className={cn("h-4 w-4", trendColor)} />
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold">{trend.thisWeekAvg}</span>
        <span className={cn("text-sm", trendColor)}>
          {trend.percentChange > 0 ? '+' : ''}{trend.percentChange}%
        </span>
      </div>
      <p className="text-xs text-muted-foreground mt-1">
        vs {trend.lastWeekAvg} last week
      </p>
    </Card>
  );
}

function CorrelationCard({ correlation }: { correlation: Correlation }) {
  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <div className="p-2 bg-primary/10 rounded-full">
          <Lightbulb className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <p className="font-medium text-sm">{correlation.finding}</p>
            <Badge variant={correlation.confidence === 'high' ? 'default' : 'secondary'} className="text-xs">
              {correlation.confidence}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">{correlation.suggestion}</p>
        </div>
      </div>
    </Card>
  );
}

function WeeklyScoreCard({ score, highlights, improvements }: { 
  score: number; 
  highlights: string[]; 
  improvements: string[] 
}) {
  const scoreColor = score >= 70 ? 'text-green-500' : score >= 50 ? 'text-yellow-500' : 'text-red-500';
  const scoreBg = score >= 70 ? 'bg-green-500/10' : score >= 50 ? 'bg-yellow-500/10' : 'bg-red-500/10';

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold flex items-center gap-2">
          <Target className="h-5 w-5" />
          Weekly Health Score
        </h3>
        <div className={cn("px-3 py-1 rounded-full font-bold text-lg", scoreBg, scoreColor)}>
          {score}/100
        </div>
      </div>

      {highlights.length > 0 && (
        <div className="mb-3">
          <p className="text-xs font-medium text-green-600 mb-1">✓ Highlights</p>
          <ul className="space-y-1">
            {highlights.slice(0, 3).map((h, i) => (
              <li key={i} className="text-sm text-muted-foreground">• {h}</li>
            ))}
          </ul>
        </div>
      )}

      {improvements.length > 0 && (
        <div>
          <p className="text-xs font-medium text-amber-600 mb-1">↑ Room to Improve</p>
          <ul className="space-y-1">
            {improvements.slice(0, 3).map((imp, i) => (
              <li key={i} className="text-sm text-muted-foreground">• {imp}</li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

export function HealthCoachPanel() {
  const { loading, response, error, getCoaching, askQuestion } = useHealthCoach();
  const [question, setQuestion] = useState('');
  const [isAsking, setIsAsking] = useState(false);

  useEffect(() => {
    getCoaching();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAskQuestion = async () => {
    if (!question.trim()) return;
    setIsAsking(true);
    await askQuestion(question);
    setQuestion('');
    setIsAsking(false);
  };

  const handleRefresh = () => {
    getCoaching();
  };

  if (loading && !response) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-32 w-full" />
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-48" />
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="space-y-4 p-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            <h2 className="font-semibold">AI Health Coach</h2>
          </div>
          <Button variant="ghost" size="sm" onClick={handleRefresh} disabled={loading}>
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </Button>
        </div>

        {error && (
          <Card className="p-4 border-destructive">
            <p className="text-sm text-destructive">{error}</p>
          </Card>
        )}

        {/* Weekly Score */}
        {response && (
          <WeeklyScoreCard 
            score={response.weeklyScore} 
            highlights={response.highlights}
            improvements={response.improvements}
          />
        )}

        {/* AI Coaching Advice */}
        {response?.advice && (
          <Card className="p-4 bg-gradient-to-br from-primary/5 to-primary/10">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">Today's Coaching</h3>
            </div>
            <div className="prose prose-sm dark:prose-invert max-w-none">
              {response.advice.split('\n').map((line, i) => (
                <p key={i} className="text-sm text-muted-foreground mb-2 last:mb-0">
                  {line}
                </p>
              ))}
            </div>
          </Card>
        )}

        {/* Ask AI */}
        <Card className="p-4">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <Brain className="h-4 w-4" />
            Ask About Your Health
          </h3>
          <div className="flex gap-2">
            <Input
              placeholder="Why am I tired? How can I sleep better?"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAskQuestion()}
              disabled={isAsking}
            />
            <Button onClick={handleAskQuestion} disabled={isAsking || !question.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex flex-wrap gap-2 mt-3">
            {['Why am I tired?', 'How can I improve my sleep?', 'Am I exercising enough?'].map((q) => (
              <Button 
                key={q} 
                variant="outline" 
                size="sm" 
                className="text-xs"
                onClick={() => {
                  setQuestion(q);
                }}
              >
                {q}
              </Button>
            ))}
          </div>
        </Card>

        {/* Trends */}
        {response?.trends && response.trends.length > 0 && (
          <div>
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              This Week's Trends
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {response.trends.slice(0, 6).map((trend, i) => (
                <TrendCard key={i} trend={trend} />
              ))}
            </div>
          </div>
        )}

        {/* Correlations */}
        {response?.correlations && response.correlations.length > 0 && (
          <div>
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Lightbulb className="h-4 w-4" />
              Patterns Discovered
            </h3>
            <div className="space-y-3">
              {response.correlations.map((corr, i) => (
                <CorrelationCard key={i} correlation={corr} />
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {!response && !loading && !error && (
          <Card className="p-8 text-center">
            <Brain className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-semibold mb-2">No Health Data Yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Start logging your health data or sync with Apple Health to get personalized coaching.
            </p>
            <Button onClick={handleRefresh}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
          </Card>
        )}
      </div>
    </ScrollArea>
  );
}
