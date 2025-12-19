import { useState, useEffect, useCallback } from 'react';
import { useMealPlanning, MealPlan } from '@/hooks/useMealPlanning';
import { useShoppingLists } from '@/hooks/useShoppingLists';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChevronLeft, ChevronRight, Plus, BookOpen, ShoppingCart, Utensils, Trash2, Clock } from 'lucide-react';
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, eachDayOfInterval, isSameDay } from 'date-fns';
import { AddRecipeDialog } from './AddRecipeDialog';
import { AddMealPlanDialog } from './AddMealPlanDialog';
import { RecipesList } from './RecipesList';
import { toast } from 'sonner';

const mealTypeIcons: Record<string, string> = {
  breakfast: '🌅',
  lunch: '☀️',
  dinner: '🌙',
  snack: '🍎',
};

const mealTypeColors: Record<string, string> = {
  breakfast: 'bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-500/30',
  lunch: 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
  dinner: 'bg-indigo-500/20 text-indigo-700 dark:text-indigo-400 border-indigo-500/30',
  snack: 'bg-pink-500/20 text-pink-700 dark:text-pink-400 border-pink-500/30',
};

export function MealPlanningPanel() {
  const { user } = useAuth();
  const { mealPlans, recipes, addMealPlan, refetchRecipes, deleteMealPlan, fetchMealPlans, generateShoppingList, isLoading } = useMealPlanning();
  const { addList, addItem } = useShoppingLists();
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [showAddRecipeDialog, setShowAddRecipeDialog] = useState(false);
  const [showAddMealDialog, setShowAddMealDialog] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [activeTab, setActiveTab] = useState<'planner' | 'recipes'>('planner');

  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const loadMeals = useCallback(() => {
    if (user?.id) {
      fetchMealPlans(format(weekStart, 'yyyy-MM-dd'), format(weekEnd, 'yyyy-MM-dd'));
    }
  }, [user?.id, weekStart.getTime(), weekEnd.getTime()]);

  useEffect(() => {
    loadMeals();
  }, [loadMeals]);

  const getMealsForDay = (date: Date) => {
    return mealPlans.filter(m => m.meal_date === format(date, 'yyyy-MM-dd'));
  };

  const handleAddMeal = (date: Date) => {
    setSelectedDate(date);
    setShowAddMealDialog(true);
  };

  const handleMealAdded = () => {
    loadMeals();
  };

  const handleDeleteMeal = async (e: React.MouseEvent, mealId: string) => {
    e.stopPropagation();
    await deleteMealPlan(mealId);
  };

  const handleGenerateShoppingList = async () => {
    const ingredients = await generateShoppingList(
      format(weekStart, 'yyyy-MM-dd'),
      format(weekEnd, 'yyyy-MM-dd')
    );

    if (ingredients.length === 0) {
      toast.error('No ingredients to add. Plan some meals with recipes first!');
      return;
    }

    const list = await addList({
      name: `Groceries for ${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d')}`,
      description: 'Auto-generated from meal plan',
      category: 'grocery',
      assigned_to: null,
      is_template: false,
      is_completed: false,
      due_date: null,
    });

    if (list) {
      let addedCount = 0;
      for (const ing of ingredients) {
        const result = await addItem(list.id, {
          name: ing.name,
          quantity: Math.ceil(ing.quantity || 1),
          unit: ing.unit,
          category: ing.category || 'other',
          is_checked: false,
          notes: null,
          added_by: null,
        }, true);
        if (result) addedCount++;
      }
      toast.success(`Shopping list created with ${addedCount} items!`);
    }
  };

  const totalMealsThisWeek = mealPlans.length;

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <TabsList>
            <TabsTrigger value="planner" className="flex items-center gap-2">
              <Utensils className="h-4 w-4" />
              Week Planner
            </TabsTrigger>
            <TabsTrigger value="recipes" className="flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              Recipes
            </TabsTrigger>
          </TabsList>
          
          {activeTab === 'planner' && (
            <Button onClick={handleGenerateShoppingList} variant="outline" size="sm">
              <ShoppingCart className="h-4 w-4 mr-2" />
              Generate Shopping List
            </Button>
          )}
          {activeTab === 'recipes' && (
            <Button onClick={() => setShowAddRecipeDialog(true)} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Recipe
            </Button>
          )}
        </div>

        <TabsContent value="planner" className="mt-4">
          {/* Week Navigation */}
          <Card className="p-4 mb-4">
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="icon" onClick={() => setCurrentWeek(subWeeks(currentWeek, 1))}>
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <div className="text-center">
                <h3 className="text-lg font-semibold">
                  {format(weekStart, 'MMM d')} - {format(weekEnd, 'MMM d, yyyy')}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {totalMealsThisWeek} meal{totalMealsThisWeek !== 1 ? 's' : ''} planned
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setCurrentWeek(addWeeks(currentWeek, 1))}>
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>
          </Card>

          {/* Week Grid */}
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : (
            <div className="grid grid-cols-7 gap-2">
              {days.map((day) => {
                const meals = getMealsForDay(day);
                const isToday = isSameDay(day, new Date());
                const isPast = day < new Date() && !isToday;
                
                return (
                  <Card
                    key={day.toISOString()}
                    className={`p-3 min-h-[180px] transition-all ${
                      isToday 
                        ? 'ring-2 ring-primary bg-primary/5' 
                        : isPast 
                          ? 'opacity-60' 
                          : 'hover:shadow-md'
                    }`}
                  >
                    <div className="text-center mb-3 pb-2 border-b">
                      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        {format(day, 'EEE')}
                      </div>
                      <div className={`text-xl font-bold ${isToday ? 'text-primary' : ''}`}>
                        {format(day, 'd')}
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      {meals.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-2">
                          No meals
                        </p>
                      ) : (
                        meals.map((meal) => (
                          <div
                            key={meal.id}
                            className={`text-xs p-2 rounded-lg border ${mealTypeColors[meal.meal_type]} group relative`}
                          >
                            <div className="flex items-center gap-1 mb-1">
                              <span>{mealTypeIcons[meal.meal_type]}</span>
                              <span className="font-medium capitalize">{meal.meal_type}</span>
                            </div>
                            <div className="font-medium truncate pr-5">
                              {meal.recipe?.name || meal.custom_meal_name || 'Unnamed'}
                            </div>
                            {meal.recipe && (
                              <div className="flex items-center gap-1 text-[10px] opacity-70 mt-1">
                                <Clock className="h-2.5 w-2.5" />
                                {meal.servings} servings
                              </div>
                            )}
                            <button
                              onClick={(e) => handleDeleteMeal(e, meal.id)}
                              className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-destructive/20"
                              title="Remove meal"
                            >
                              <Trash2 className="h-3 w-3 text-destructive" />
                            </button>
                          </div>
                        ))
                      )}
                      
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full h-7 text-xs border-dashed border hover:bg-accent"
                        onClick={() => handleAddMeal(day)}
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Add
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="recipes" className="mt-4">
          <RecipesList />
        </TabsContent>
      </Tabs>

      <AddRecipeDialog open={showAddRecipeDialog} onOpenChange={setShowAddRecipeDialog} />
      
      {selectedDate && (
        <AddMealPlanDialog
          open={showAddMealDialog}
          onOpenChange={setShowAddMealDialog}
          selectedDate={selectedDate}
          onSuccess={handleMealAdded}
          recipes={recipes}
          addMealPlan={addMealPlan}
          refetchRecipes={refetchRecipes}
        />
      )}
    </div>
  );
}
