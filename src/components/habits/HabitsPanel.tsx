import { useState } from 'react';
import { useHabits } from '@/hooks/useHabits';
import { useGoals } from '@/hooks/useGoals';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { AddHabitDialog } from './AddHabitDialog';
import { AddGoalDialog } from './AddGoalDialog';
import { StreakDisplay } from './StreakDisplay';
import { 
  Plus, 
  Check, 
  Flame, 
  Target,
  Trophy,
  RefreshCw,
  Trash2,
  TrendingUp,
  Lightbulb
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from 'sonner';

// Suggested habits for wellbeing
const SUGGESTED_HABITS = [
  { name: 'Drink Water', icon: '💧', color: '#06b6d4', description: 'Stay hydrated with 8 glasses daily', targetCount: 8 },
  { name: 'Morning Walk', icon: '🚶', color: '#10b981', description: '15-30 minutes of walking', targetCount: 1 },
  { name: 'Meditate', icon: '🧘', color: '#8b5cf6', description: '10 minutes of mindfulness', targetCount: 1 },
  { name: 'Read', icon: '📚', color: '#f59e0b', description: 'Read for at least 20 minutes', targetCount: 1 },
  { name: 'Exercise', icon: '💪', color: '#ef4444', description: '30 minutes of physical activity', targetCount: 1 },
  { name: 'Sleep 8 Hours', icon: '😴', color: '#6366f1', description: 'Get quality rest', targetCount: 1 },
  { name: 'Eat Vegetables', icon: '🥗', color: '#84cc16', description: 'Include veggies in meals', targetCount: 3 },
  { name: 'No Phone Before Bed', icon: '📵', color: '#ec4899', description: 'Screen-free hour before sleep', targetCount: 1 },
  { name: 'Gratitude Journal', icon: '✨', color: '#f97316', description: 'Write 3 things you\'re grateful for', targetCount: 1 },
  { name: 'Stretch', icon: '🤸', color: '#14b8a6', description: '5-10 minutes of stretching', targetCount: 1 },
  { name: 'Take Vitamins', icon: '💊', color: '#3b82f6', description: 'Daily supplements', targetCount: 1 },
  { name: 'Deep Breathing', icon: '🌬️', color: '#a855f7', description: '5 minutes of breathing exercises', targetCount: 1 },
];

interface HabitsPanelProps {
  userId: string;
}

export function HabitsPanel({ userId }: HabitsPanelProps) {
  const { todayHabits, loading: habitsLoading, logHabit, deleteHabit, refetch: refetchHabits } = useHabits(userId);
  const { goals, loading: goalsLoading, updateGoalProgress, deleteGoal, refetch: refetchGoals } = useGoals(userId);
  const [showAddHabit, setShowAddHabit] = useState(false);
  const [showAddGoal, setShowAddGoal] = useState(false);
  const { t } = useLanguage();

  const completedHabits = todayHabits.filter(h => h.isCompleted).length;
  const totalHabits = todayHabits.length;
  const habitProgress = totalHabits > 0 ? (completedHabits / totalHabits) * 100 : 0;

  const activeGoals = goals.filter(g => !g.isCompleted);
  const completedGoals = goals.filter(g => g.isCompleted);

  const loading = habitsLoading || goalsLoading;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Target className="w-5 h-5" />
            {t('habits.habitsAndGoals')}
          </h2>
          <Button variant="ghost" size="icon" onClick={() => { refetchHabits(); refetchGoals(); }}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
        
        {/* Today's Progress */}
        {totalHabits > 0 && (
          <div className="mt-3">
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="text-muted-foreground">{t('habits.todaysProgress')}</span>
              <span className="font-medium">{completedHabits}/{totalHabits}</span>
            </div>
            <Progress value={habitProgress} className="h-2" />
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <RefreshCw className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <Tabs defaultValue="habits" className="flex-1 flex flex-col">
          <TabsList className="mx-4 mt-3">
            <TabsTrigger value="habits" className="flex-1 gap-1">
              <Flame className="w-4 h-4" />
              {t('nav.habits')}
            </TabsTrigger>
            <TabsTrigger value="goals" className="flex-1 gap-1">
              <Trophy className="w-4 h-4" />
              {t('habits.goals')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="habits" className="flex-1 mt-0">
            <ScrollArea className="h-full">
              <div className="p-4 space-y-3">
                {/* Add Habit Button */}
                <Button 
                  variant="outline" 
                  className="w-full justify-start gap-2 border-dashed"
                  onClick={() => setShowAddHabit(true)}
                >
                  <Plus className="w-4 h-4" />
                  {t('habits.addNewHabit')}
                </Button>

                {/* Suggested Habits Section */}
                {todayHabits.length < 5 && (
                  <HabitSuggestions 
                    userId={userId} 
                    existingHabitNames={todayHabits.map(h => h.name.toLowerCase())}
                    onHabitAdded={refetchHabits}
                  />
                )}

                {todayHabits.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Flame className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">{t('habits.noHabitsYet')}</p>
                    <p className="text-xs">{t('habits.createFirstHabit')}</p>
                  </div>
                ) : (
                  todayHabits.map(habit => (
                    <Card 
                      key={habit.id}
                      className={cn(
                        "p-3 transition-colors",
                        habit.isCompleted && "bg-success/10 border-success/30"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <Button
                          variant={habit.isCompleted ? "default" : "outline"}
                          size="icon"
                          className={cn(
                            "h-10 w-10 shrink-0 rounded-full",
                            habit.isCompleted && "bg-success hover:bg-success/90"
                          )}
                          style={{ borderColor: habit.color }}
                          onClick={() => !habit.isCompleted && logHabit(habit.id)}
                        >
                          {habit.isCompleted ? (
                            <Check className="w-5 h-5" />
                          ) : (
                            <span className="text-lg">{habit.icon}</span>
                          )}
                        </Button>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={cn(
                              "font-medium",
                              habit.isCompleted && "line-through text-muted-foreground"
                            )}>
                              {habit.name}
                            </span>
                            {habit.streak > 0 && (
                              <Badge variant="secondary" className="gap-1">
                                <Flame className="w-3 h-3 text-orange-500" />
                                {habit.streak}
                              </Badge>
                            )}
                          </div>
                          {habit.targetCount > 1 && (
                            <div className="flex items-center gap-2 mt-1">
                              <Progress 
                                value={(habit.completedCount / habit.targetCount) * 100} 
                                className="h-1.5 flex-1"
                              />
                              <span className="text-xs text-muted-foreground">
                                {habit.completedCount}/{habit.targetCount}
                              </span>
                            </div>
                          )}
                        </div>

                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => deleteHabit(habit.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </Card>
                  ))
                )}

                {/* Streak Display */}
                {todayHabits.length > 0 && (
                  <>
                    <Separator className="my-4" />
                    <StreakDisplay habits={todayHabits} />
                  </>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="goals" className="flex-1 mt-0">
            <ScrollArea className="h-full">
              <div className="p-4 space-y-3">
                {/* Add Goal Button */}
                <Button 
                  variant="outline" 
                  className="w-full justify-start gap-2 border-dashed"
                  onClick={() => setShowAddGoal(true)}
                >
                  <Plus className="w-4 h-4" />
                  {t('habits.addNewGoal')}
                </Button>

                {activeGoals.length === 0 && completedGoals.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Trophy className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">{t('habits.noGoalsYet')}</p>
                    <p className="text-xs">{t('habits.setGoal')}</p>
                  </div>
                ) : (
                  <>
                    {/* Active Goals */}
                    {activeGoals.map(goal => {
                      const progress = (goal.currentValue / goal.targetValue) * 100;
                      return (
                        <Card key={goal.id} className="p-3">
                          <div className="flex items-start gap-3">
                            <div 
                              className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                              style={{ backgroundColor: `${goal.color}20`, color: goal.color }}
                            >
                              <span className="text-lg">{goal.icon}</span>
                            </div>
                            
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <span className="font-medium">{goal.name}</span>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 text-destructive"
                                  onClick={() => deleteGoal(goal.id)}
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </div>
                              
                              <div className="mt-2">
                                <div className="flex items-center justify-between text-sm mb-1">
                                  <span className="text-muted-foreground">
                                    {goal.currentValue} / {goal.targetValue} {goal.unit}
                                  </span>
                                  <span className="font-medium">{Math.round(progress)}%</span>
                                </div>
                                <Progress value={progress} className="h-2" />
                              </div>

                              {goal.targetDate && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  {t('habits.target')}: {goal.targetDate.toLocaleDateString()}
                                </p>
                              )}

                              {/* Quick update buttons */}
                              <div className="flex gap-2 mt-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => updateGoalProgress(goal.id, goal.currentValue + 1)}
                                >
                                  <TrendingUp className="w-3 h-3 mr-1" />
                                  +1
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => updateGoalProgress(goal.id, goal.currentValue + 10)}
                                >
                                  +10
                                </Button>
                              </div>
                            </div>
                          </div>
                        </Card>
                      );
                    })}

                    {/* Completed Goals */}
                    {completedGoals.length > 0 && (
                      <>
                        <Separator className="my-4" />
                        <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                          <Trophy className="w-4 h-4" />
                          {t('habits.completedGoals')}
                        </h3>
                        {completedGoals.map(goal => (
                          <Card key={goal.id} className="p-3 bg-success/10 border-success/30">
                            <div className="flex items-center gap-3">
                              <div 
                                className="w-8 h-8 rounded-full flex items-center justify-center"
                                style={{ backgroundColor: `${goal.color}20`, color: goal.color }}
                              >
                                <Check className="w-4 h-4" />
                              </div>
                              <div className="flex-1">
                                <span className="font-medium">{goal.name}</span>
                                <p className="text-xs text-muted-foreground">
                                  {t('habits.completedOn')} {goal.completedAt?.toLocaleDateString()}
                                </p>
                              </div>
                            </div>
                          </Card>
                        ))}
                      </>
                    )}
                  </>
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      )}

      <AddHabitDialog open={showAddHabit} onOpenChange={setShowAddHabit} userId={userId} />
      <AddGoalDialog open={showAddGoal} onOpenChange={setShowAddGoal} userId={userId} />
    </div>
  );
}

// Habit Suggestions Component
interface HabitSuggestionsProps {
  userId: string;
  existingHabitNames: string[];
  onHabitAdded: () => void;
}

function HabitSuggestions({ userId, existingHabitNames, onHabitAdded }: HabitSuggestionsProps) {
  const { createHabit } = useHabits(userId);
  const [adding, setAdding] = useState<string | null>(null);
  const { t } = useLanguage();

  // Filter out habits that user already has
  const availableSuggestions = SUGGESTED_HABITS.filter(
    h => !existingHabitNames.includes(h.name.toLowerCase())
  ).slice(0, 6);

  if (availableSuggestions.length === 0) return null;

  const handleAddSuggested = async (suggestion: typeof SUGGESTED_HABITS[0]) => {
    setAdding(suggestion.name);
    try {
      await createHabit({
        name: suggestion.name,
        description: suggestion.description,
        icon: suggestion.icon,
        color: suggestion.color,
        frequency: 'daily',
        targetCount: suggestion.targetCount,
        daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
        reminderTime: null,
        isActive: true,
      });
      toast.success(`Added "${suggestion.name}" to your habits!`);
      onHabitAdded();
    } catch (error) {
      toast.error('Failed to add habit');
    } finally {
      setAdding(null);
    }
  };

  return (
    <Card className="p-3 bg-muted/30 border-dashed">
      <div className="flex items-center gap-2 mb-3">
        <Lightbulb className="w-4 h-4 text-amber-500" />
        <span className="text-sm font-medium">{t('habits.suggestions') || 'Suggested Habits'}</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {availableSuggestions.map((suggestion) => (
          <Button
            key={suggestion.name}
            variant="outline"
            size="sm"
            className="justify-start gap-2 h-auto py-2 px-3 text-left"
            disabled={adding === suggestion.name}
            onClick={() => handleAddSuggested(suggestion)}
          >
            <span className="text-base">{suggestion.icon}</span>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium truncate">{suggestion.name}</div>
            </div>
            {adding === suggestion.name ? (
              <RefreshCw className="w-3 h-3 animate-spin" />
            ) : (
              <Plus className="w-3 h-3 opacity-50" />
            )}
          </Button>
        ))}
      </div>
    </Card>
  );
}
