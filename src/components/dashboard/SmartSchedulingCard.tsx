import { GlassCard, GlassCardContent, GlassCardHeader, GlassCardTitle } from '@/components/ui/glass-card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useSmartScheduling, SchedulingSuggestion } from '@/hooks/useSmartScheduling';
import { useLanguage } from '@/contexts/LanguageContext';
import { 
  Lightbulb, 
  Clock, 
  AlertTriangle,
  Calendar,
  ArrowRight,
  Sparkles
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

const SUGGESTION_ICONS: Record<string, React.ReactNode> = {
  best_time: <Clock className="w-4 h-4 text-primary" />,
  avoid_time: <AlertTriangle className="w-4 h-4 text-warning" />,
  reschedule: <Calendar className="w-4 h-4 text-muted-foreground" />,
  batch: <Sparkles className="w-4 h-4 text-accent" />,
};

const CONFIDENCE_COLORS: Record<string, string> = {
  high: 'bg-success/20 text-success',
  medium: 'bg-warning/20 text-warning',
  low: 'bg-muted text-muted-foreground',
};

function getConfidenceLevel(confidence: number): string {
  if (confidence >= 0.8) return 'high';
  if (confidence >= 0.6) return 'medium';
  return 'low';
}

export function SmartSchedulingCard() {
  const { suggestions, patterns, loading } = useSmartScheduling();
  const { t, language } = useLanguage();

  if (loading) {
    return (
      <GlassCard>
        <GlassCardContent className="p-4">
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-muted rounded w-1/3" />
            <div className="h-16 bg-muted rounded" />
          </div>
        </GlassCardContent>
      </GlassCard>
    );
  }

  if (suggestions.length === 0 && !patterns) {
    return null;
  }

  const dayNames = language === 'de' 
    ? ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa']
    : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <GlassCard className="border-accent/20">
      <GlassCardHeader className="pb-2">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Lightbulb className="w-4 h-4 text-accent" />
          {t('smartScheduling.title')}
          {suggestions.length > 0 && (
            <Badge variant="outline" className="ml-auto text-xs">
              {suggestions.length} {t('smartScheduling.tips')}
            </Badge>
          )}
        </div>
      </GlassCardHeader>
      <GlassCardContent className="space-y-3">
        {/* Pattern Summary */}
        {patterns && patterns.peakHours.length > 0 && (
          <div className="p-3 rounded-lg bg-muted/50 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium">{t('smartScheduling.productivityProfile')}</span>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-muted-foreground">{t('smartScheduling.peakHours')}</span>
                <div className="font-medium text-primary">
                  {patterns.peakHours.slice(0, 2).map(h => `${h}:00`).join(', ')}
                </div>
              </div>
              <div>
                <span className="text-muted-foreground">{t('smartScheduling.bestDays')}</span>
                <div className="font-medium text-primary">
                  {patterns.bestDays.slice(0, 2).map(d => dayNames[d]).join(', ')}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Suggestions */}
        {suggestions.slice(0, 3).map((suggestion, index) => (
          <div
            key={index}
            className={cn(
              "p-3 rounded-lg transition-all",
              suggestion.type === 'avoid_time' ? 'bg-warning/10' : 'bg-muted/50'
            )}
          >
            <div className="flex items-start gap-3">
              {SUGGESTION_ICONS[suggestion.type] || <Lightbulb className="w-4 h-4" />}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{suggestion.title}</span>
                  <Badge 
                    variant="secondary" 
                    className={cn(
                      "text-[10px] px-1.5",
                      CONFIDENCE_COLORS[getConfidenceLevel(suggestion.confidence)]
                    )}
                  >
                    {Math.round(suggestion.confidence * 100)}%
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {suggestion.description}
                </p>
                {suggestion.suggestedTime && (
                  <div className="flex items-center gap-1 mt-2 text-xs text-primary">
                    <ArrowRight className="w-3 h-3" />
                    <span>{format(suggestion.suggestedTime, 'h:mm a')}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}

        {suggestions.length === 0 && patterns && (
          <p className="text-xs text-muted-foreground text-center py-2">
            {t('smartScheduling.keepCompleting')}
          </p>
        )}
      </CardContent>
    </Card>
  );
}