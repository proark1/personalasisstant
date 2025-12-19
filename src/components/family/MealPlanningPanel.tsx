import { useState, useEffect } from 'react';
import { useMealPlanning, MealPlan } from '@/hooks/useMealPlanning';
import { useShoppingLists } from '@/hooks/useShoppingLists';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChevronLeft, ChevronRight, Plus, BookOpen, ShoppingCart, Utensils } from 'lucide-react';
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, eachDayOfInterval, isSameDay } from 'date-fns';
import { AddRecipeDialog } from './AddRecipeDialog';
import { AddMealPlanDialog } from './AddMealPlanDialog';
import { RecipesList } from './RecipesList';
import { toast } from 'sonner';

const mealTypes = ['breakfast', 'lunch', 'dinner', 'snack'];
const mealTypeColors: Record<string, string> = {
  breakfast: 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-400',
  lunch: 'bg-green-500/20 text-green-700 dark:text-green-400',
  dinner: 'bg-blue-500/20 text-blue-700 dark:text-blue-400',
  snack: 'bg-purple-500/20 text-purple-700 dark:text-purple-400',
};

export function MealPlanningPanel() {
  const { mealPlans, recipes, deleteMealPlan, fetchMealPlans, generateShoppingList } = useMealPlanning();
  const { addList, addItem } = useShoppingLists();
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [showAddRecipeDialog, setShowAddRecipeDialog] = useState(false);
  const [showAddMealDialog, setShowAddMealDialog] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [activeTab, setActiveTab] = useState<'planner' | 'recipes'>('planner');

  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd });

  useEffect(() => {
    fetchMealPlans(format(weekStart, 'yyyy-MM-dd'), format(weekEnd, 'yyyy-MM-dd'));
  }, [currentWeek]);

  const getMealsForDay = (date: Date) => {
    return mealPlans.filter(m => m.meal_date === format(date, 'yyyy-MM-dd'));
  };

  const handleAddMeal = (date: Date) => {
    setSelectedDate(date);
    setShowAddMealDialog(true);
  };

  const handleMealAdded = () => {
    fetchMealPlans(format(weekStart, 'yyyy-MM-dd'), format(weekEnd, 'yyyy-MM-dd'));
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
      for (const ing of ingredients) {
        await addItem(list.id, {
          name: ing.name,
          quantity: Math.ceil(ing.quantity || 1),
          unit: ing.unit,
          category: ing.category,
          is_checked: false,
          notes: null,
          added_by: null,
        });
      }
      toast.success(`Shopping list created with ${ingredients.length} items!`);
    }
  };

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <div className="flex items-center justify-between">
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
          <div className="flex items-center justify-between mb-4">
            <Button variant="outline" size="icon" onClick={() => setCurrentWeek(subWeeks(currentWeek, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h3 className="font-medium">
              {format(weekStart, 'MMM d')} - {format(weekEnd, 'MMM d, yyyy')}
            </h3>
            <Button variant="outline" size="icon" onClick={() => setCurrentWeek(addWeeks(currentWeek, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Week Grid */}
          <div className="grid grid-cols-7 gap-2">
            {days.map((day) => {
              const meals = getMealsForDay(day);
              const isToday = isSameDay(day, new Date());
              
              return (
                <Card
                  key={day.toISOString()}
                  className={`p-2 min-h-[140px] ${isToday ? 'ring-2 ring-primary' : ''}`}
                >
                  <div className="text-center mb-2">
                    <div className="text-xs text-muted-foreground">{format(day, 'EEE')}</div>
                    <div className={`text-sm font-medium ${isToday ? 'text-primary' : ''}`}>
                      {format(day, 'd')}
                    </div>
                  </div>
                  
                  <div className="space-y-1">
                    {meals.map((meal) => (
                      <div
                        key={meal.id}
                        className="text-xs p-1 rounded bg-accent/50 truncate cursor-pointer hover:bg-accent"
                        onClick={() => deleteMealPlan(meal.id)}
                        title="Click to remove"
                      >
                        <Badge className={`${mealTypeColors[meal.meal_type]} text-[10px] px-1 py-0 mb-0.5`}>
                          {meal.meal_type}
                        </Badge>
                        <div className="truncate">
                          {meal.recipe?.name || meal.custom_meal_name || 'Unnamed meal'}
                        </div>
                      </div>
                    ))}
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full h-6 text-xs"
                      onClick={() => handleAddMeal(day)}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
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
        />
      )}
    </div>
  );
}
