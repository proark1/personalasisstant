import { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { de, enUS } from 'date-fns/locale';
import { motion } from 'framer-motion';
import { GlassCard } from '@/components/ui/glass-card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sunrise, Sun, Moon, Apple, Plus, Clock, Sparkles, Loader2, ChefHat, Users } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useMealPlanning } from '@/hooks/useMealPlanning';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { describeEdgeError } from '@/lib/edgeError';
import { toast } from 'sonner';
import { RecipeDetailDialog } from '@/components/family/RecipeDetailDialog';
import { AddMealPlanDialog } from '@/components/family/AddMealPlanDialog';
import { cn } from '@/lib/utils';

const staggerContainer = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const staggerItem = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } },
};

const mealSlots = [
  { type: 'breakfast', label: 'Breakfast', labelDe: 'Frühstück', icon: Sunrise, gradient: 'from-amber-500/15 to-orange-500/10 border-amber-500/20', iconColor: 'text-amber-500' },
  { type: 'lunch', label: 'Lunch', labelDe: 'Mittagessen', icon: Sun, gradient: 'from-emerald-500/15 to-teal-500/10 border-emerald-500/20', iconColor: 'text-emerald-500' },
  { type: 'dinner', label: 'Dinner', labelDe: 'Abendessen', icon: Moon, gradient: 'from-indigo-500/15 to-purple-500/10 border-indigo-500/20', iconColor: 'text-indigo-500' },
  { type: 'snack', label: 'Snack', labelDe: 'Snack', icon: Apple, gradient: 'from-pink-500/15 to-rose-500/10 border-pink-500/20', iconColor: 'text-pink-500' },
] as const;

interface AISuggestion {
  name: string;
  description: string;
  category: string;
  prepTime?: number;
  cookTime?: number;
}

export function TodayMealsView() {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const { mealPlans, recipes, addMealPlan, fetchMealPlans, refetchRecipes } = useMealPlanning();
  const locale = language === 'de' ? de : enUS;
  const today = new Date();
  const todayStr = format(today, 'yyyy-MM-dd');

  const [showAddMealDialog, setShowAddMealDialog] = useState(false);
  const [selectedMealType, setSelectedMealType] = useState('dinner');
  const [recipeDetailId, setRecipeDetailId] = useState<string | null>(null);
  const [showRecipeDetail, setShowRecipeDetail] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<AISuggestion[]>([]);
  const [isLoadingAI, setIsLoadingAI] = useState(false);

  const loadToday = useCallback(() => {
    if (!user?.id) return;
    fetchMealPlans(todayStr, todayStr);
  }, [user?.id, fetchMealPlans, todayStr]);

  useEffect(() => {
    loadToday();
  }, [loadToday]);

  const todayMeals = mealPlans.filter(m => m.meal_date === todayStr);

  const getMealsForType = (type: string) => todayMeals.filter(m => m.meal_type === type);

  const getNextEmptySlot = (): string => {
    const hour = new Date().getHours();
    const order = hour < 10 ? ['breakfast', 'lunch', 'dinner', 'snack'] :
                  hour < 14 ? ['lunch', 'dinner', 'snack', 'breakfast'] :
                  hour < 18 ? ['dinner', 'snack', 'breakfast', 'lunch'] :
                  ['snack', 'breakfast', 'lunch', 'dinner'];
    return order.find(type => getMealsForType(type).length === 0) || 'dinner';
  };

  const handleAddMeal = (mealType: string) => {
    setSelectedMealType(mealType);
    setShowAddMealDialog(true);
  };

  const handleViewRecipe = (recipeId: string) => {
    setRecipeDetailId(recipeId);
    setShowRecipeDetail(true);
  };

  const handleAISuggest = async () => {
    setIsLoadingAI(true);
    try {
      const nextSlot = getNextEmptySlot();
      const { data, error } = await supabase.functions.invoke('recipe-assistant', {
        body: { type: 'explore', mealCategory: nextSlot }
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      setAiSuggestions(data.suggestions || []);
    } catch (error) {
      console.error('AI suggest error:', error);
      toast.error(await describeEdgeError(
        error,
        language === 'de' ? 'Vorschläge konnten nicht geladen werden.' : 'Could not load suggestions.'
      ));
    } finally {
      setIsLoadingAI(false);
    }
  };

  const totalMeals = todayMeals.length;

  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="show"
      className="space-y-3"
    >
      {/* Today Header */}
      <motion.div variants={staggerItem} className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-foreground">
            {format(today, 'EEEE', { locale })}
          </h3>
          <p className="text-sm text-muted-foreground">
            {format(today, 'd MMMM', { locale })} · {totalMeals} {totalMeals === 1 ? 'meal' : 'meals'} planned
          </p>
        </div>
      </motion.div>

      {/* Meal Slots */}
      {mealSlots.map((slot) => {
        const meals = getMealsForType(slot.type);
        const Icon = slot.icon;
        const isEmpty = meals.length === 0;

        return (
          <motion.div key={slot.type} variants={staggerItem}>
            <GlassCard
              className={cn(
                "p-4 border bg-gradient-to-r transition-all",
                slot.gradient,
                isEmpty && "opacity-70"
              )}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Icon className={cn("h-4 w-4", slot.iconColor)} />
                  <span className="font-semibold text-sm">
                    {language === 'de' ? slot.labelDe : slot.label}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => handleAddMeal(slot.type)}
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  {language === 'de' ? 'Hinzufügen' : 'Add'}
                </Button>
              </div>

              {isEmpty ? (
                <p className="text-xs text-muted-foreground italic pl-6">
                  {language === 'de' ? 'Noch nichts geplant' : 'Nothing planned yet'}
                </p>
              ) : (
                <div className="space-y-2 pl-6">
                  {meals.map((meal) => {
                    const name = meal.recipe?.name || meal.custom_meal_name || 'Unnamed';
                    const hasRecipe = !!meal.recipe_id;
                    const totalTime = (meal.recipe?.prep_time_minutes || 0) + (meal.recipe?.cook_time_minutes || 0);

                    return (
                      <div
                        key={meal.id}
                        className={cn(
                          "flex items-center justify-between rounded-lg p-2.5 bg-background/60 backdrop-blur-sm",
                          hasRecipe && "cursor-pointer active:scale-[0.98] transition-transform"
                        )}
                        onClick={() => hasRecipe && meal.recipe_id && handleViewRecipe(meal.recipe_id)}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{name}</p>
                          <div className="flex items-center gap-3 mt-0.5">
                            {totalTime > 0 && (
                              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Clock className="h-3 w-3" />
                                {totalTime} min
                              </span>
                            )}
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Users className="h-3 w-3" />
                              {meal.servings}
                            </span>
                          </div>
                        </div>
                        {hasRecipe && (
                          <Badge variant="secondary" className="text-[10px] px-1.5">
                            <ChefHat className="h-3 w-3 mr-0.5" />
                            Recipe
                          </Badge>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </GlassCard>
          </motion.div>
        );
      })}

      {/* AI Suggestion Button */}
      <motion.div variants={staggerItem}>
        <Button
          onClick={handleAISuggest}
          disabled={isLoadingAI}
          variant="outline"
          className="w-full h-12 gap-2 border-dashed border-primary/30 text-primary hover:bg-primary/5"
        >
          {isLoadingAI ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          {language === 'de' ? 'Was soll ich kochen?' : "What should I cook?"}
        </Button>
      </motion.div>

      {/* AI Suggestions */}
      {aiSuggestions.length > 0 && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="space-y-2"
        >
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-1">
            {language === 'de' ? 'Vorschläge' : 'Suggestions'}
          </p>
          {aiSuggestions.map((suggestion, i) => (
            <GlassCard
              key={i}
              pressable
              haptic="light"
              className="p-3"
              onClick={() => {
                // Pre-fill the add meal dialog
                setSelectedMealType(getNextEmptySlot());
                setShowAddMealDialog(true);
              }}
            >
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Sparkles className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{suggestion.name}</p>
                  <p className="text-xs text-muted-foreground line-clamp-1">{suggestion.description}</p>
                  <div className="flex gap-2 mt-1">
                    <Badge variant="secondary" className="text-[10px]">{suggestion.category}</Badge>
                    {suggestion.prepTime && (
                      <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                        <Clock className="h-2.5 w-2.5" />
                        {(suggestion.prepTime || 0) + (suggestion.cookTime || 0)} min
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </GlassCard>
          ))}
        </motion.div>
      )}

      {/* Dialogs */}
      <AddMealPlanDialog
        open={showAddMealDialog}
        onOpenChange={setShowAddMealDialog}
        selectedDate={today}
        onSuccess={loadToday}
        recipes={recipes}
        addMealPlan={addMealPlan}
        refetchRecipes={refetchRecipes}
      />

      <RecipeDetailDialog
        open={showRecipeDetail}
        onOpenChange={setShowRecipeDetail}
        recipeId={recipeDetailId}
      />
    </motion.div>
  );
}
