import { GlassCard, GlassCardContent, GlassCardHeader, GlassCardTitle } from '@/components/ui/glass-card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useDayPrediction } from '@/hooks/useDayPrediction';
import { useLanguage } from '@/contexts/LanguageContext';
import { 
  Sun, 
  Cloud, 
  CloudRain, 
  Sparkles,
  TrendingUp,
  TrendingDown,
  Lightbulb
} from 'lucide-react';
import { cn } from '@/lib/utils';

const getPredictionConfig = (t: (key: string) => string) => ({
  excellent: {
    icon: Sparkles,
    color: 'text-success',
    bgColor: 'bg-success/10',
    label: t('dayPrediction.excellent'),
  },
  good: {
    icon: Sun,
    color: 'text-primary',
    bgColor: 'bg-primary/10',
    label: t('dayPrediction.good'),
  },
  moderate: {
    icon: Cloud,
    color: 'text-warning',
    bgColor: 'bg-warning/10',
    label: t('dayPrediction.moderate'),
  },
  challenging: {
    icon: CloudRain,
    color: 'text-destructive',
    bgColor: 'bg-destructive/10',
    label: t('dayPrediction.challenging'),
  },
});

export function DayPredictionCard() {
  const { prediction, loading } = useDayPrediction();
  const { t } = useLanguage();
  const PREDICTION_CONFIG = getPredictionConfig(t);

  if (loading) {
    return (
      <GlassCard>
        <GlassCardContent className="p-4">
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-muted rounded w-1/3" />
            <div className="h-8 bg-muted rounded" />
          </div>
        </GlassCardContent>
      </GlassCard>
    );
  }

  if (!prediction) {
    return null;
  }

  const config = PREDICTION_CONFIG[prediction.label];
  const Icon = config.icon;

  return (
    <GlassCard className={config.bgColor}>
      <GlassCardHeader className="pb-2">
        <div className="flex items-center justify-between text-sm font-semibold">
          <div className="flex items-center gap-2">
            <Icon className={cn("w-4 h-4", config.color)} />
            <span>{config.label}</span>
          </div>
          <Badge variant="outline" className={config.color}>
            {prediction.score}/10
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Score progress */}
        <Progress value={prediction.score * 10} className="h-2" />
        
        {/* Insight */}
        <p className="text-sm text-muted-foreground">{prediction.insight}</p>

        {/* Factors */}
        <div className="grid grid-cols-2 gap-2">
          {prediction.factors.positive.slice(0, 2).map((factor, i) => (
            <div key={`pos-${i}`} className="flex items-start gap-1.5 text-xs">
              <TrendingUp className="w-3 h-3 text-success shrink-0 mt-0.5" />
              <span className="text-muted-foreground">{factor}</span>
            </div>
          ))}
          {prediction.factors.negative.slice(0, 2).map((factor, i) => (
            <div key={`neg-${i}`} className="flex items-start gap-1.5 text-xs">
              <TrendingDown className="w-3 h-3 text-destructive shrink-0 mt-0.5" />
              <span className="text-muted-foreground">{factor}</span>
            </div>
          ))}
        </div>

        {/* Suggestions */}
        {prediction.suggestions.length > 0 && (
          <div className="pt-2 border-t">
            <div className="flex items-start gap-2">
              <Lightbulb className="w-3.5 h-3.5 text-warning shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground">
                {prediction.suggestions[0]}
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
