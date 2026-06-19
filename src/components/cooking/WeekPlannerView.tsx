import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { useMealPlanning } from "@/hooks/useMealPlanning";
import { useShoppingLists } from "@/hooks/useShoppingLists";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GlassCard } from "@/components/ui/glass-card";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  ShoppingCart,
  Sunrise,
  Sun,
  Moon,
  Apple,
  Trash2,
} from "lucide-react";
import {
  format,
  startOfWeek,
  endOfWeek,
  addWeeks,
  subWeeks,
  eachDayOfInterval,
  isToday as isDateToday,
} from "date-fns";
import { de, enUS } from "date-fns/locale";
import { AddMealPlanDialog } from "@/components/family/AddMealPlanDialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const staggerItem = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } },
};

const mealTypeConfig: Record<
  string,
  { icon: React.ReactNode; gradient: string; label: string; labelDe: string }
> = {
  breakfast: {
    icon: <Sunrise className="h-3.5 w-3.5" />,
    gradient: "from-amber-500/15 to-orange-500/10 border-amber-500/20",
    label: "Breakfast",
    labelDe: "Frühstück",
  },
  lunch: {
    icon: <Sun className="h-3.5 w-3.5" />,
    gradient: "from-emerald-500/15 to-teal-500/10 border-emerald-500/20",
    label: "Lunch",
    labelDe: "Mittagessen",
  },
  dinner: {
    icon: <Moon className="h-3.5 w-3.5" />,
    gradient: "from-indigo-500/15 to-purple-500/10 border-indigo-500/20",
    label: "Dinner",
    labelDe: "Abendessen",
  },
  snack: {
    icon: <Apple className="h-3.5 w-3.5" />,
    gradient: "from-pink-500/15 to-rose-500/10 border-pink-500/20",
    label: "Snack",
    labelDe: "Snack",
  },
};

const mealTypes = ["breakfast", "lunch", "dinner", "snack"] as const;

export function WeekPlannerView() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const {
    mealPlans,
    recipes,
    addMealPlan,
    deleteMealPlan,
    fetchMealPlans,
    generateShoppingList,
    refetchRecipes,
  } = useMealPlanning();
  const { addList, addItem } = useShoppingLists();
  const locale = language === "de" ? de : enUS;

  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [selectedDayIndex, setSelectedDayIndex] = useState(() => {
    const today = new Date();
    const start = startOfWeek(today, { weekStartsOn: 1 });
    const diff = Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    return Math.min(Math.max(diff, 0), 6);
  });
  const [showAddMealDialog, setShowAddMealDialog] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd });
  const weekStartTime = weekStart.getTime();
  const weekEndTime = weekEnd.getTime();

  const loadMeals = useCallback(() => {
    if (!user?.id) return;
    fetchMealPlans(
      format(new Date(weekStartTime), "yyyy-MM-dd"),
      format(new Date(weekEndTime), "yyyy-MM-dd"),
    );
  }, [user?.id, fetchMealPlans, weekStartTime, weekEndTime]);

  useEffect(() => {
    loadMeals();
  }, [loadMeals]);

  const getMealsForDay = (date: Date) =>
    mealPlans.filter((m) => m.meal_date === format(date, "yyyy-MM-dd"));

  const handleAddMeal = (date: Date) => {
    setSelectedDate(date);
    setShowAddMealDialog(true);
  };

  const handleDeleteMeal = async (mealId: string) => {
    await deleteMealPlan(mealId);
  };

  const handleGenerateShoppingList = async () => {
    const ingredients = await generateShoppingList(
      format(weekStart, "yyyy-MM-dd"),
      format(weekEnd, "yyyy-MM-dd"),
    );
    if (ingredients.length === 0) {
      toast.error(
        language === "de"
          ? "Keine Zutaten. Planen Sie zuerst Mahlzeiten mit Rezepten!"
          : "No ingredients. Plan meals with recipes first!",
      );
      return;
    }
    const list = await addList({
      name:
        language === "de"
          ? `Einkaufsliste ${format(weekStart, "d. MMM", { locale })} - ${format(weekEnd, "d. MMM", { locale })}`
          : `Groceries ${format(weekStart, "MMM d")} - ${format(weekEnd, "MMM d")}`,
      description: language === "de" ? "Automatisch erstellt" : "Auto-generated from meal plan",
      category: "grocery",
      assigned_to: null,
      is_template: false,
      is_completed: false,
      due_date: null,
    });
    if (list) {
      let count = 0;
      for (const ing of ingredients) {
        const result = await addItem(
          list.id,
          {
            name: ing.name,
            quantity: Math.ceil(ing.quantity || 1),
            unit: ing.unit,
            category: ing.category || "other",
            is_checked: false,
            notes: null,
            added_by: null,
          },
          true,
        );
        if (result) count++;
      }
      toast.success(
        language === "de"
          ? `Einkaufsliste mit ${count} Artikeln erstellt!`
          : `Shopping list created with ${count} items!`,
      );
    }
  };

  const selectedDay = days[selectedDayIndex];
  const selectedDayMeals = getMealsForDay(selectedDay);

  const handlePrevDay = () => {
    if (selectedDayIndex > 0) {
      setSelectedDayIndex(selectedDayIndex - 1);
    } else {
      setCurrentWeek(subWeeks(currentWeek, 1));
      setSelectedDayIndex(6);
    }
  };

  const handleNextDay = () => {
    if (selectedDayIndex < 6) {
      setSelectedDayIndex(selectedDayIndex + 1);
    } else {
      setCurrentWeek(addWeeks(currentWeek, 1));
      setSelectedDayIndex(0);
    }
  };

  return (
    <div className="space-y-3">
      {/* Week Navigation */}
      <GlassCard className="p-3">
        <div className="flex items-center justify-between mb-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setCurrentWeek(subWeeks(currentWeek, 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="text-center">
            <p className="text-sm font-bold">
              {format(weekStart, "d MMM", { locale })} — {format(weekEnd, "d MMM", { locale })}
            </p>
            <p className="text-xs text-muted-foreground">
              {mealPlans.length} {language === "de" ? "Mahlzeiten" : "meals"}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setCurrentWeek(addWeeks(currentWeek, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Day Pills */}
        <div className="flex gap-1">
          {days.map((day, i) => {
            const isToday = isDateToday(day);
            const isSelected = i === selectedDayIndex;
            const dayMealCount = getMealsForDay(day).length;

            return (
              <button
                key={i}
                onClick={() => setSelectedDayIndex(i)}
                className={cn(
                  "flex-1 flex flex-col items-center gap-0.5 py-2 rounded-lg text-xs transition-all",
                  isSelected
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : isToday
                      ? "bg-primary/10 text-primary"
                      : "hover:bg-muted",
                )}
              >
                <span className="text-[10px] font-medium uppercase">
                  {format(day, "EEE", { locale }).slice(0, 2)}
                </span>
                <span className="font-bold">{format(day, "d")}</span>
                {dayMealCount > 0 && (
                  <div
                    className={cn(
                      "w-1.5 h-1.5 rounded-full",
                      isSelected ? "bg-primary-foreground" : "bg-primary",
                    )}
                  />
                )}
              </button>
            );
          })}
        </div>
      </GlassCard>

      {/* Selected Day View (Mobile) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handlePrevDay}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h3 className="font-semibold text-sm">
              {format(selectedDay, "EEEE, d MMM", { locale })}
              {isDateToday(selectedDay) && (
                <Badge variant="default" className="ml-2 text-[10px] px-1.5 py-0">
                  {language === "de" ? "Heute" : "Today"}
                </Badge>
              )}
            </h3>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleNextDay}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={() => handleAddMeal(selectedDay)}
          >
            <Plus className="h-3.5 w-3.5" />
            {language === "de" ? "Mahlzeit" : "Meal"}
          </Button>
        </div>

        {mealTypes.map((type) => {
          const config = mealTypeConfig[type];
          const meals = selectedDayMeals.filter((m) => m.meal_type === type);

          return (
            <motion.div key={type} variants={staggerItem} initial="hidden" animate="show">
              <GlassCard className={cn("p-3 bg-gradient-to-r border", config.gradient)}>
                <div className="flex items-center gap-2 mb-1.5">
                  {config.icon}
                  <span className="text-xs font-semibold">
                    {language === "de" ? config.labelDe : config.label}
                  </span>
                </div>
                {meals.length === 0 ? (
                  <button
                    onClick={() => handleAddMeal(selectedDay)}
                    className="w-full py-3 border border-dashed rounded-lg text-xs text-muted-foreground hover:bg-background/50 transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5 inline mr-1" />
                    {language === "de" ? "Mahlzeit hinzufügen" : "Add meal"}
                  </button>
                ) : (
                  <div className="space-y-1.5">
                    {meals.map((meal) => (
                      <div
                        key={meal.id}
                        className="flex items-center justify-between bg-background/60 rounded-lg p-2.5"
                      >
                        <span className="text-sm font-medium truncate flex-1">
                          {meal.recipe?.name || meal.custom_meal_name || "Unnamed"}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 shrink-0"
                          onClick={() => handleDeleteMeal(meal.id)}
                        >
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </GlassCard>
            </motion.div>
          );
        })}
      </div>

      {/* Shopping List Button */}
      <Button variant="outline" className="w-full gap-2" onClick={handleGenerateShoppingList}>
        <ShoppingCart className="h-4 w-4" />
        {language === "de" ? "Einkaufsliste erstellen" : "Generate Shopping List"}
      </Button>

      {/* Dialogs */}
      {selectedDate && (
        <AddMealPlanDialog
          open={showAddMealDialog}
          onOpenChange={setShowAddMealDialog}
          selectedDate={selectedDate}
          onSuccess={loadMeals}
          recipes={recipes}
          addMealPlan={addMealPlan}
          refetchRecipes={refetchRecipes}
        />
      )}
    </div>
  );
}
