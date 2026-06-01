import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { describeEdgeError } from '@/lib/edgeError';
import { toast } from 'sonner';
import {
  Sparkles,
  AlertTriangle, 
  CheckCircle2, 
  Lightbulb, 
  Info,
  RefreshCw,
  Loader2 
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface HealthInsight {
  type: 'warning' | 'recommendation' | 'success' | 'info';
  title: string;
  message: string;
}

interface HealthMetric {
  metric_type: string;
  value: number;
  unit: string;
  recorded_at: string;
}

interface HealthInsightsCardProps {
  metrics: HealthMetric[];
  goals: {
    steps: number;
    calories: number;
    sleepHours: number;
    waterIntake: number;
    activeMinutes: number;
  };
}

export function HealthInsightsCard({ metrics, goals }: HealthInsightsCardProps) {
  const [insights, setInsights] = useState<HealthInsight[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);

  const fetchInsights = async () => {
    setIsLoading(true);
    try {
      // Filter to last 24 hours
      const now = new Date();
      const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const recentMetrics = metrics.filter(m => 
        new Date(m.recorded_at) >= dayAgo
      );

      const { data, error } = await supabase.functions.invoke('health-insights', {
        body: { metrics: recentMetrics, goals }
      });

      if (error) throw error;
      
      setInsights(data.insights || []);
      setLastFetched(new Date());
    } catch (error) {
      console.error('Error fetching health insights:', error);
      toast.error(await describeEdgeError(error, 'Could not load health insights.'));
      setInsights([{
        type: 'info',
        title: 'Track Your Health',
        message: 'Add more health data to receive AI-powered insights and recommendations.'
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Auto-fetch on mount if we have metrics
    if (metrics.length > 0 && !lastFetched) {
      fetchInsights();
    }
  }, [metrics.length]);

  const getInsightIcon = (type: HealthInsight['type']) => {
    switch (type) {
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-warning" />;
      case 'recommendation':
        return <Lightbulb className="w-4 h-4 text-primary" />;
      case 'success':
        return <CheckCircle2 className="w-4 h-4 text-success" />;
      default:
        return <Info className="w-4 h-4 text-info" />;
    }
  };

  const getInsightBadge = (type: HealthInsight['type']) => {
    switch (type) {
      case 'warning':
        return <Badge variant="outline" className="text-warning border-warning/50 text-[10px]">Warning</Badge>;
      case 'recommendation':
        return <Badge variant="outline" className="text-primary border-primary/50 text-[10px]">Tip</Badge>;
      case 'success':
        return <Badge variant="outline" className="text-success border-success/50 text-[10px]">Great!</Badge>;
      default:
        return <Badge variant="outline" className="text-info border-info/50 text-[10px]">Info</Badge>;
    }
  };

  return (
    <Card className="bg-gradient-to-br from-primary/5 via-background to-accent/5 border-primary/20">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            AI Health Insights
          </CardTitle>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={fetchInsights}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
          </Button>
        </div>
        {lastFetched && (
          <p className="text-[10px] text-muted-foreground">
            Based on last 24 hours • Updated {lastFetched.toLocaleTimeString()}
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading && insights.length === 0 ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : insights.length === 0 ? (
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground mb-2">
              No insights yet
            </p>
            <Button size="sm" variant="outline" onClick={fetchInsights}>
              Generate Insights
            </Button>
          </div>
        ) : (
          insights.map((insight, index) => (
            <div 
              key={index}
              className={cn(
                "flex gap-3 p-3 rounded-lg",
                insight.type === 'warning' && "bg-warning/10 border border-warning/20",
                insight.type === 'success' && "bg-success/10 border border-success/20",
                insight.type === 'recommendation' && "bg-primary/10 border border-primary/20",
                insight.type === 'info' && "bg-muted/50 border border-border"
              )}
            >
              <div className="shrink-0 mt-0.5">
                {getInsightIcon(insight.type)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-sm">{insight.title}</span>
                  {getInsightBadge(insight.type)}
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {insight.message}
                </p>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
