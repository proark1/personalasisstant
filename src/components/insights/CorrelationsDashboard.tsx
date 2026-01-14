import { useLifeCorrelations } from '@/hooks/useLifeCorrelations';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Brain, 
  TrendingUp, 
  TrendingDown, 
  Sparkles, 
  RefreshCw, 
  X,
  Moon,
  Dumbbell,
  Calendar,
  Target,
  Wallet,
  Clock
} from 'lucide-react';
import { cn } from '@/lib/utils';

const DOMAIN_ICONS: Record<string, typeof Brain> = {
  health: Moon,
  tasks: Target,
  calendar: Calendar,
  habits: Dumbbell,
  finances: Wallet,
  time: Clock,
};

const CORRELATION_COLORS: Record<string, string> = {
  sleep_productivity: 'from-blue-500/20 to-purple-500/20',
  exercise_mood: 'from-green-500/20 to-emerald-500/20',
  calendar_stress: 'from-orange-500/20 to-red-500/20',
  habits_focus: 'from-violet-500/20 to-indigo-500/20',
  spending_mood: 'from-amber-500/20 to-yellow-500/20',
  weekday_productivity: 'from-cyan-500/20 to-blue-500/20',
};

export function CorrelationsDashboard() {
  const { t } = useLanguage();
  const { 
    correlations, 
    loading, 
    analyzing, 
    analyzeCorrelations, 
    dismissCorrelation 
  } = useLifeCorrelations();

  if (loading) {
    return (
      <Card className="glass-panel-solid">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Brain className="w-4 h-4 text-primary" />
            {t('correlations.title')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass-panel-solid">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Brain className="w-4 h-4 text-primary" />
            {t('correlations.title')}
          </CardTitle>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => analyzeCorrelations()}
            disabled={analyzing}
          >
            <RefreshCw className={cn("w-4 h-4", analyzing && "animate-spin")} />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {t('correlations.description')}
        </p>
      </CardHeader>
      <CardContent>
        {correlations.length === 0 ? (
          <div className="text-center py-6">
            <Sparkles className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground mb-3">
              {t('correlations.noFound')}
            </p>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => analyzeCorrelations()}
              disabled={analyzing}
            >
              {analyzing ? t('correlations.analyzing') : t('correlations.analyze')}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {correlations.map((correlation) => {
              const DomainIconA = DOMAIN_ICONS[correlation.domainA] || Brain;
              const DomainIconB = DOMAIN_ICONS[correlation.domainB] || Brain;
              const isPositive = correlation.correlationStrength > 0;
              const gradientClass = CORRELATION_COLORS[correlation.correlationType] || 'from-primary/20 to-accent/20';
              
              return (
                <div
                  key={correlation.id}
                  className={cn(
                    "relative p-3 rounded-lg bg-gradient-to-r",
                    gradientClass,
                    "border border-border/50"
                  )}
                >
                  <button
                    onClick={() => dismissCorrelation(correlation.id)}
                    className="absolute top-2 right-2 p-1 rounded-full hover:bg-background/50 transition-colors"
                  >
                    <X className="w-3 h-3 text-muted-foreground" />
                  </button>
                  
                  <div className="flex items-start gap-3">
                    <div className="flex items-center gap-1 shrink-0">
                      <div className="p-1.5 rounded-full bg-background/50">
                        <DomainIconA className="w-3 h-3" />
                      </div>
                      {isPositive ? (
                        <TrendingUp className="w-3 h-3 text-green-500" />
                      ) : (
                        <TrendingDown className="w-3 h-3 text-red-500" />
                      )}
                      <div className="p-1.5 rounded-full bg-background/50">
                        <DomainIconB className="w-3 h-3" />
                      </div>
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium leading-tight">
                        {correlation.patternDescription}
                      </p>
                      {correlation.insightText && (
                        <p className="text-xs text-muted-foreground mt-1">
                          💡 {correlation.insightText}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                          {Math.round(correlation.confidenceScore * 100)}% {t('correlations.confident')}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">
                          {correlation.dataPoints} {t('correlations.dataPoints')}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
