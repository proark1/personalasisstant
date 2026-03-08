import { useGamification } from '@/hooks/useGamification';
import { useLanguage } from '@/contexts/LanguageContext';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { Flame, Star, Trophy, Zap } from 'lucide-react';

interface XPDisplayProps {
  variant?: 'compact' | 'full';
  className?: string;
}

export function XPDisplay({ variant = 'compact', className }: XPDisplayProps) {
  const { t } = useLanguage();
  const { userXP, getXPToNextLevel } = useGamification();

  if (!userXP) return null;

  const progress = getXPToNextLevel(userXP.total_xp);

  if (variant === 'compact') {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <div className="flex items-center gap-1.5 bg-primary/10 px-2.5 py-1 rounded-full">
          <Star className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs font-bold text-primary">{t('xp.level')} {userXP.current_level}</span>
        </div>
        <span className="text-xs text-muted-foreground">{userXP.total_xp} XP</span>
      </div>
    );
  }

  return (
    <div className={cn("bg-card border rounded-xl p-4 space-y-4", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
            <span className="text-xl font-bold text-primary-foreground">{userXP.current_level}</span>
          </div>
          <div>
            <p className="font-semibold">{t('xp.level')} {userXP.current_level}</p>
            <p className="text-sm text-muted-foreground">{userXP.total_xp} {t('xp.totalXp')}</p>
          </div>
        </div>
        
        {userXP.current_streak > 0 && (
          <div className="flex items-center gap-2 bg-orange-500/10 px-3 py-2 rounded-lg">
            <Flame className="w-5 h-5 text-orange-500" />
            <div>
              <p className="text-lg font-bold text-orange-500">{userXP.current_streak}</p>
              <p className="text-xs text-muted-foreground">{t('xp.dayStreak')}</p>
            </div>
          </div>
        )}
      </div>

      {/* XP Progress */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">{t('xp.progressTo')} {userXP.current_level + 1}</span>
          <span className="font-medium">{progress.current}/{progress.needed} XP</span>
        </div>
        <Progress value={progress.percentage} className="h-2" />
      </div>

      {/* Weekly Stats */}
      <div className="grid grid-cols-4 gap-2 pt-2 border-t">
        <div className="text-center">
          <Zap className="w-4 h-4 mx-auto text-yellow-500 mb-1" />
          <p className="text-lg font-bold">{userXP.weekly_xp}</p>
          <p className="text-xs text-muted-foreground">{t('xp.xpThisWeek')}</p>
        </div>
        <div className="text-center">
          <span className="text-lg">✓</span>
          <p className="text-lg font-bold">{userXP.weekly_tasks_completed}</p>
          <p className="text-xs text-muted-foreground">{t('xp.tasks')}</p>
        </div>
        <div className="text-center">
          <span className="text-lg">🧘</span>
          <p className="text-lg font-bold">{userXP.weekly_focus_minutes}</p>
          <p className="text-xs text-muted-foreground">{t('xp.focusMin')}</p>
        </div>
        <div className="text-center">
          <span className="text-lg">💪</span>
          <p className="text-lg font-bold">{userXP.weekly_habits_logged}</p>
          <p className="text-xs text-muted-foreground">{t('xp.habits')}</p>
        </div>
      </div>

      {/* Badges */}
      {userXP.badges.length > 0 && (
        <div className="pt-2 border-t">
          <p className="text-sm font-medium mb-2 flex items-center gap-2">
            <Trophy className="w-4 h-4" />
            {t('xp.badges')} ({userXP.badges.length})
          </p>
          <div className="flex flex-wrap gap-2">
            {userXP.badges.map(badge => (
              <div
                key={badge.id}
                className="flex items-center gap-1.5 bg-muted px-2 py-1 rounded-full"
                title={badge.description}
              >
                <span>{badge.icon}</span>
                <span className="text-xs font-medium">{badge.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
