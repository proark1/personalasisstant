import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Trash2, Clock, BookOpen } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/contexts/LanguageContext";
import { RecipeDetailDialog } from "./RecipeDetailDialog";
import type { MealPlan } from "@/hooks/useMealPlanning";

interface MealCardProps {
  meal: MealPlan;
  onDelete: (e: React.MouseEvent, mealId: string) => void;
  mealTypeColors: Record<string, string>;
  mealTypeIcons: Record<string, string>;
}

const mealTypeTranslations: Record<string, string> = {
  breakfast: "mealType.breakfast",
  lunch: "mealType.lunch",
  dinner: "mealType.dinner",
  snack: "mealType.snack",
};

export function MealCard({ meal, onDelete, mealTypeColors, mealTypeIcons }: MealCardProps) {
  const { t } = useLanguage();
  const [showRecipeDialog, setShowRecipeDialog] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: meal.id,
    data: {
      type: "meal",
      meal,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleViewRecipe = (e: React.MouseEvent) => {
    e.stopPropagation();
    setPopoverOpen(false);
    setShowRecipeDialog(true);
  };

  return (
    <>
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger asChild>
          <div
            ref={setNodeRef}
            style={style}
            role="button"
            tabIndex={0}
            aria-label={meal.recipe?.name || meal.custom_meal_name || "Unnamed"}
            className={`text-xs p-2 rounded-lg border ${mealTypeColors[meal.meal_type]} group relative cursor-pointer hover:shadow-md transition-shadow`}
          >
            <div
              {...attributes}
              {...listeners}
              className="absolute left-0 top-0 bottom-0 w-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
              onClick={(e) => e.stopPropagation()}
            >
              <GripVertical className="h-3 w-3" />
            </div>

            <div className="pl-3">
              <div className="flex items-center gap-1 mb-1">
                <span>{mealTypeIcons[meal.meal_type]}</span>
                <span className="font-medium">{t(mealTypeTranslations[meal.meal_type])}</span>
              </div>
              <div className="font-medium truncate pr-5">
                {meal.recipe?.name || meal.custom_meal_name || "Unnamed"}
              </div>
              {meal.servings && (
                <div className="flex items-center gap-1 text-[10px] opacity-70 mt-1">
                  <Clock className="h-2.5 w-2.5" />
                  {meal.servings} {t("meals.servings")}
                </div>
              )}
            </div>

            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(e, meal.id);
              }}
              className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-destructive/20"
              title={t("meals.removeMeal")}
            >
              <Trash2 className="h-3 w-3 text-destructive" />
            </button>
          </div>
        </PopoverTrigger>

        <PopoverContent className="w-72" align="start">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-xl">{mealTypeIcons[meal.meal_type]}</span>
              <div>
                <h4 className="font-semibold">
                  {meal.recipe?.name || meal.custom_meal_name || "Unnamed"}
                </h4>
                <p className="text-xs text-muted-foreground">
                  {t(mealTypeTranslations[meal.meal_type])}
                </p>
              </div>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">{t("meals.servings")}:</span>
                <Badge variant="secondary">{meal.servings || 1}</Badge>
              </div>

              {meal.recipe && (
                <>
                  {meal.recipe.prep_time_minutes && (
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">{t("meals.prepTime")}:</span>
                      <span>
                        {meal.recipe.prep_time_minutes} {t("meals.minutes")}
                      </span>
                    </div>
                  )}
                  {meal.recipe.cook_time_minutes && (
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">{t("meals.cookTime")}:</span>
                      <span>
                        {meal.recipe.cook_time_minutes} {t("meals.minutes")}
                      </span>
                    </div>
                  )}
                </>
              )}

              {meal.notes && (
                <div className="pt-2 border-t">
                  <p className="text-xs text-muted-foreground mb-1">{t("meals.notes")}:</p>
                  <p className="text-sm">{meal.notes}</p>
                </div>
              )}

              {!meal.notes && (
                <div className="pt-2 border-t">
                  <p className="text-xs text-muted-foreground italic">{t("meals.noNotes")}</p>
                </div>
              )}

              {meal.recipe && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full mt-2"
                  onClick={handleViewRecipe}
                >
                  <BookOpen className="h-3 w-3 mr-2" />
                  {t("meals.viewRecipe")}
                </Button>
              )}
            </div>
          </div>
        </PopoverContent>
      </Popover>

      <RecipeDetailDialog
        open={showRecipeDialog}
        onOpenChange={setShowRecipeDialog}
        recipeId={meal.recipe_id}
      />
    </>
  );
}
