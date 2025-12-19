import { useState, useEffect, useCallback } from 'react';
import { useMealPlanning, MealPlan } from '@/hooks/useMealPlanning';
import { useShoppingLists } from '@/hooks/useShoppingLists';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChevronLeft, ChevronRight, Plus, BookOpen, ShoppingCart, Utensils } from 'lucide-react';
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, eachDayOfInterval, isSameDay } from 'date-fns';
import { de, enUS } from 'date-fns/locale';
import { AddRecipeDialog } from './AddRecipeDialog';
import { AddMealPlanDialog } from './AddMealPlanDialog';
import { RecipesList } from './RecipesList';
import { MealCard } from './MealCard';
import { LanguageSwitcher } from '@/components/settings/LanguageSwitcher';
import { toast } from 'sonner';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';

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

interface DroppableDayProps {
  day: Date;
  children: React.ReactNode;
  isToday: boolean;
  isPast: boolean;
}

function DroppableDay({ day, children, isToday, isPast }: DroppableDayProps) {
  const { t, language } = useLanguage();
  const { isOver, setNodeRef } = useDroppable({
    id: format(day, 'yyyy-MM-dd'),
    data: { date: day },
  });

  const locale = language === 'de' ? de : enUS;

  return (
    <Card
      ref={setNodeRef}
      className={`p-3 min-h-[180px] transition-all ${
        isToday 
          ? 'ring-2 ring-primary bg-primary/5' 
          : isPast 
            ? 'opacity-60' 
            : 'hover:shadow-md'
      } ${isOver ? 'ring-2 ring-accent bg-accent/10' : ''}`}
    >
      <div className="text-center mb-3 pb-2 border-b">
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {format(day, 'EEE', { locale })}
        </div>
        <div className={`text-xl font-bold ${isToday ? 'text-primary' : ''}`}>
          {format(day, 'd')}
        </div>
      </div>
      {children}
    </Card>
  );
}

export function MealPlanningPanel() {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const { mealPlans, recipes, addMealPlan, updateMealPlan, refetchRecipes, deleteMealPlan, fetchMealPlans, generateShoppingList, isLoading } = useMealPlanning();
  const { addList, addItem } = useShoppingLists();
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [showAddRecipeDialog, setShowAddRecipeDialog] = useState(false);
  const [showAddMealDialog, setShowAddMealDialog] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [activeTab, setActiveTab] = useState<'planner' | 'recipes'>('planner');
  const [activeDragMeal, setActiveDragMeal] = useState<MealPlan | null>(null);

  const locale = language === 'de' ? de : enUS;
  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

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

  const handleDragStart = (event: DragStartEvent) => {
    const meal = mealPlans.find(m => m.id === event.active.id);
    setActiveDragMeal(meal || null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveDragMeal(null);
    
    const { active, over } = event;
    if (!over || !active) return;

    const meal = mealPlans.find(m => m.id === active.id);
    if (!meal) return;

    const newDate = over.id as string;
    if (meal.meal_date === newDate) return;

    await updateMealPlan(meal.id, { meal_date: newDate });
  };

  const handleGenerateShoppingList = async () => {
    const ingredients = await generateShoppingList(
      format(weekStart, 'yyyy-MM-dd'),
      format(weekEnd, 'yyyy-MM-dd')
    );

    if (ingredients.length === 0) {
      toast.error(language === 'de' 
        ? 'Keine Zutaten zum Hinzufügen. Planen Sie zuerst Mahlzeiten mit Rezepten!'
        : 'No ingredients to add. Plan some meals with recipes first!');
      return;
    }

    const list = await addList({
      name: language === 'de' 
        ? `Einkaufsliste ${format(weekStart, 'd. MMM', { locale })} - ${format(weekEnd, 'd. MMM', { locale })}`
        : `Groceries for ${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d')}`,
      description: language === 'de' ? 'Automatisch aus Mahlzeitenplan erstellt' : 'Auto-generated from meal plan',
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
      toast.success(language === 'de'
        ? `Einkaufsliste mit ${addedCount} Artikeln erstellt!`
        : `Shopping list created with ${addedCount} items!`);
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
              {t('nav.weekPlanner')}
            </TabsTrigger>
            <TabsTrigger value="recipes" className="flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              {t('nav.recipes')}
            </TabsTrigger>
          </TabsList>
          
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            {activeTab === 'planner' && (
              <Button onClick={handleGenerateShoppingList} variant="outline" size="sm">
                <ShoppingCart className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">{t('meals.generateShoppingList')}</span>
              </Button>
            )}
            {activeTab === 'recipes' && (
              <Button onClick={() => setShowAddRecipeDialog(true)} size="sm">
                <Plus className="h-4 w-4 mr-2" />
                {t('meals.addRecipe')}
              </Button>
            )}
          </div>
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
                  {format(weekStart, 'd. MMM', { locale })} - {format(weekEnd, 'd. MMM yyyy', { locale })}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {totalMealsThisWeek} {totalMealsThisWeek !== 1 ? t('meals.mealsPlanned') : t('meals.mealPlanned')}
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setCurrentWeek(addWeeks(currentWeek, 1))}>
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>
          </Card>

          {/* Week Grid with DnD */}
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <div className="grid grid-cols-7 gap-2">
                {days.map((day) => {
                  const meals = getMealsForDay(day);
                  const isToday = isSameDay(day, new Date());
                  const isPast = day < new Date() && !isToday;
                  
                  return (
                    <DroppableDay
                      key={day.toISOString()}
                      day={day}
                      isToday={isToday}
                      isPast={isPast}
                    >
                      <div className="space-y-2">
                        <SortableContext
                          items={meals.map(m => m.id)}
                          strategy={verticalListSortingStrategy}
                        >
                          {meals.length === 0 ? (
                            <p className="text-xs text-muted-foreground text-center py-2">
                              {t('meals.noMeals')}
                            </p>
                          ) : (
                            meals.map((meal) => (
                              <MealCard
                                key={meal.id}
                                meal={meal}
                                onDelete={handleDeleteMeal}
                                mealTypeColors={mealTypeColors}
                                mealTypeIcons={mealTypeIcons}
                              />
                            ))
                          )}
                        </SortableContext>
                        
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full h-7 text-xs border-dashed border hover:bg-accent"
                          onClick={() => handleAddMeal(day)}
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          {t('meals.addMeal')}
                        </Button>
                      </div>
                    </DroppableDay>
                  );
                })}
              </div>

              <DragOverlay>
                {activeDragMeal && (
                  <div className={`text-xs p-2 rounded-lg border ${mealTypeColors[activeDragMeal.meal_type]} shadow-lg opacity-90`}>
                    <div className="flex items-center gap-1 mb-1">
                      <span>{mealTypeIcons[activeDragMeal.meal_type]}</span>
                      <span className="font-medium capitalize">{activeDragMeal.meal_type}</span>
                    </div>
                    <div className="font-medium truncate">
                      {activeDragMeal.recipe?.name || activeDragMeal.custom_meal_name || 'Unnamed'}
                    </div>
                  </div>
                )}
              </DragOverlay>
            </DndContext>
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
