import { useState, useEffect, useCallback } from 'react';
import { useMealPlanning, MealPlan } from '@/hooks/useMealPlanning';
import { useShoppingLists } from '@/hooks/useShoppingLists';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChevronLeft, ChevronRight, Plus, BookOpen, ShoppingCart, Utensils, Trash2, GripVertical, Sunrise, Sun, Moon, Apple } from 'lucide-react';
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, eachDayOfInterval, isToday as isDateToday } from 'date-fns';
import { de, enUS } from 'date-fns/locale';
import { AddRecipeDialog } from './AddRecipeDialog';
import { AddMealPlanDialog } from './AddMealPlanDialog';
import { RecipesList } from './RecipesList';

import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDroppable,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const mealTypeConfig: Record<string, { icon: React.ReactNode; gradient: string; label: string }> = {
  breakfast: { 
    icon: <Sunrise className="h-3 w-3" />, 
    gradient: 'from-amber-500/20 to-orange-500/20 border-amber-500/30',
    label: 'Breakfast'
  },
  lunch: { 
    icon: <Sun className="h-3 w-3" />, 
    gradient: 'from-emerald-500/20 to-teal-500/20 border-emerald-500/30',
    label: 'Lunch'
  },
  dinner: { 
    icon: <Moon className="h-3 w-3" />, 
    gradient: 'from-indigo-500/20 to-purple-500/20 border-indigo-500/30',
    label: 'Dinner'
  },
  snack: { 
    icon: <Apple className="h-3 w-3" />, 
    gradient: 'from-pink-500/20 to-rose-500/20 border-pink-500/30',
    label: 'Snack'
  },
};

const mealTypes = ['breakfast', 'lunch', 'dinner', 'snack'] as const;

interface DraggableMealItemProps {
  meal: MealPlan;
  onDelete: (e: React.MouseEvent, mealId: string) => void;
}

function DraggableMealItem({ meal, onDelete }: DraggableMealItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: meal.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const config = mealTypeConfig[meal.meal_type];
  const mealName = meal.recipe?.name || meal.custom_meal_name || 'Unnamed';

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs",
        "bg-gradient-to-r border",
        config.gradient,
        isDragging && "opacity-50 shadow-lg ring-2 ring-primary"
      )}
    >
      <button 
        {...attributes} 
        {...listeners}
        className="cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-60 transition-opacity"
      >
        <GripVertical className="h-3 w-3" />
      </button>
      <span className="flex-1 font-medium truncate">{mealName}</span>
      <button
        onClick={(e) => onDelete(e, meal.id)}
        className="opacity-0 group-hover:opacity-100 hover:text-destructive transition-opacity"
      >
        <Trash2 className="h-3 w-3" />
      </button>
    </div>
  );
}

interface MealSlotProps {
  day: Date;
  mealType: string;
  meals: MealPlan[];
  onDelete: (e: React.MouseEvent, mealId: string) => void;
}

function MealSlot({ day, mealType, meals, onDelete }: MealSlotProps) {
  const { t } = useLanguage();
  const { setNodeRef, isOver } = useDroppable({
    id: `${format(day, 'yyyy-MM-dd')}_${mealType}`,
    data: { date: day, mealType },
  });

  const config = mealTypeConfig[mealType];
  const mealTypeTranslations: Record<string, string> = {
    breakfast: 'mealType.breakfast',
    lunch: 'mealType.lunch',
    dinner: 'mealType.dinner',
    snack: 'mealType.snack',
  };

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "min-h-[44px] rounded-lg transition-all p-1.5",
        isOver 
          ? "ring-2 ring-primary bg-primary/10 scale-[1.02]" 
          : "bg-muted/40 hover:bg-muted/60"
      )}
    >
      <div className="flex items-center gap-1 mb-1 text-[10px] font-medium text-muted-foreground">
        {config.icon}
        <span>{t(mealTypeTranslations[mealType])}</span>
      </div>
      <div className="space-y-1">
        <SortableContext
          items={meals.map(m => m.id)}
          strategy={verticalListSortingStrategy}
        >
          {meals.map((meal) => (
            <DraggableMealItem key={meal.id} meal={meal} onDelete={onDelete} />
          ))}
        </SortableContext>
        {isOver && meals.length === 0 && (
          <div className="text-[10px] text-center text-primary py-2 border border-dashed border-primary/50 rounded-md">
            {t('meals.dropHere')}
          </div>
        )}
      </div>
    </div>
  );
}

interface DayColumnProps {
  day: Date;
  meals: MealPlan[];
  onDelete: (e: React.MouseEvent, mealId: string) => void;
  onAddMeal: (day: Date) => void;
}

function DayColumn({ day, meals, onDelete, onAddMeal }: DayColumnProps) {
  const { language } = useLanguage();
  const { isOver, setNodeRef } = useDroppable({
    id: format(day, 'yyyy-MM-dd'),
    data: { date: day },
  });

  const locale = language === 'de' ? de : enUS;
  const isToday = isDateToday(day);
  const isPast = day < new Date() && !isToday;

  const getMealsForType = (mealType: string) => {
    return meals.filter(m => m.meal_type === mealType);
  };

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex flex-col rounded-xl border transition-all overflow-hidden",
        isToday && "ring-2 ring-primary border-primary/50",
        isPast && "opacity-50",
        isOver && "ring-2 ring-accent",
        !isToday && !isPast && "hover:border-primary/30 hover:shadow-md"
      )}
    >
      {/* Day Header */}
      <div className={cn(
        "px-3 py-2 text-center border-b",
        isToday 
          ? "bg-primary/10" 
          : "bg-muted/30"
      )}>
        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {format(day, 'EEE', { locale })}
        </div>
        <div className={cn(
          "text-xl font-bold",
          isToday ? "text-primary" : "text-foreground"
        )}>
          {format(day, 'd')}
        </div>
        {isToday && (
          <Badge variant="default" className="text-[9px] px-1.5 py-0 mt-0.5">
            Today
          </Badge>
        )}
      </div>

      {/* Meal Slots */}
      <div className="flex-1 p-2 space-y-1.5 bg-background">
        {mealTypes.map((mealType) => (
          <MealSlot
            key={mealType}
            day={day}
            mealType={mealType}
            meals={getMealsForType(mealType)}
            onDelete={onDelete}
          />
        ))}
      </div>

      {/* Add Button */}
      <div className="p-2 pt-0">
        <Button
          variant="ghost"
          size="sm"
          className="w-full h-7 text-xs border border-dashed hover:bg-primary/5 hover:border-primary/50 hover:text-primary"
          onClick={() => onAddMeal(day)}
        >
          <Plus className="h-3 w-3 mr-1" />
          Add
        </Button>
      </div>
    </div>
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
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const loadMeals = useCallback(() => {
    if (!user?.id) return;
    fetchMealPlans(format(weekStart, 'yyyy-MM-dd'), format(weekEnd, 'yyyy-MM-dd'));
  }, [user?.id, fetchMealPlans, weekStart.getTime(), weekEnd.getTime()]);

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

    const overId = over.id as string;
    
    if (overId.includes('_')) {
      const [newDate, newMealType] = overId.split('_');
      const hasChanges = meal.meal_date !== newDate || meal.meal_type !== newMealType;
      
      if (hasChanges) {
        await updateMealPlan(meal.id, { 
          meal_date: newDate, 
          meal_type: newMealType 
        });
      }
    } else {
      if (meal.meal_date === overId) return;
      await updateMealPlan(meal.id, { meal_date: overId });
    }
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
          <TabsList className="bg-muted/50">
            <TabsTrigger value="planner" className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Utensils className="h-4 w-4" />
              {t('nav.weekPlanner')}
            </TabsTrigger>
            <TabsTrigger value="recipes" className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <BookOpen className="h-4 w-4" />
              {t('nav.recipes')}
            </TabsTrigger>
          </TabsList>
          
          <div className="flex items-center gap-2">
            {activeTab === 'planner' && (
              <Button onClick={handleGenerateShoppingList} variant="outline" size="sm" className="gap-2">
                <ShoppingCart className="h-4 w-4" />
                <span className="hidden sm:inline">{t('meals.generateShoppingList')}</span>
              </Button>
            )}
            {activeTab === 'recipes' && (
              <Button onClick={() => setShowAddRecipeDialog(true)} size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                {t('meals.addRecipe')}
              </Button>
            )}
          </div>
        </div>

        <TabsContent value="planner" className="mt-4 space-y-4">
          {/* Week Navigation */}
          <Card className="p-4 bg-gradient-to-r from-primary/5 via-transparent to-primary/5 border-primary/20">
            <div className="flex items-center justify-between">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setCurrentWeek(subWeeks(currentWeek, 1))}
                className="hover:bg-primary/10"
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <div className="text-center">
                <h3 className="text-lg font-bold tracking-tight">
                  {format(weekStart, 'd MMM', { locale })} — {format(weekEnd, 'd MMM yyyy', { locale })}
                </h3>
                <div className="flex items-center justify-center gap-2 mt-1">
                  <Badge variant="secondary" className="text-xs">
                    {totalMealsThisWeek} {totalMealsThisWeek !== 1 ? t('meals.mealsPlanned') : t('meals.mealPlanned')}
                  </Badge>
                </div>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setCurrentWeek(addWeeks(currentWeek, 1))}
                className="hover:bg-primary/10"
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>
          </Card>

          {/* Week Grid */}
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="flex flex-col items-center gap-3">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
                <span className="text-sm text-muted-foreground">Loading meals...</span>
              </div>
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
                {days.map((day) => (
                  <DayColumn
                    key={day.toISOString()}
                    day={day}
                    meals={getMealsForDay(day)}
                    onDelete={handleDeleteMeal}
                    onAddMeal={handleAddMeal}
                  />
                ))}
              </div>

              <DragOverlay>
                {activeDragMeal && (
                  <div className={cn(
                    "px-3 py-2 rounded-lg border shadow-xl",
                    "bg-gradient-to-r",
                    mealTypeConfig[activeDragMeal.meal_type].gradient
                  )}>
                    <div className="flex items-center gap-2 text-sm font-medium">
                      {mealTypeConfig[activeDragMeal.meal_type].icon}
                      <span>{activeDragMeal.recipe?.name || activeDragMeal.custom_meal_name || 'Unnamed'}</span>
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
