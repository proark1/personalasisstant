import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import {
  Clock,
  Users,
  ChefHat,
  List,
  BookOpen,
  Play,
  ChevronLeft,
  ChevronRight,
  X,
  Check,
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useMealPlanning, Recipe, RecipeIngredient } from "@/hooks/useMealPlanning";

interface RecipeDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipeId: string | null;
}

export function RecipeDetailDialog({ open, onOpenChange, recipeId }: RecipeDetailDialogProps) {
  const { t } = useLanguage();
  const { getRecipeWithIngredients } = useMealPlanning();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [cookingMode, setCookingMode] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [checkedIngredients, setCheckedIngredients] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (open && recipeId) {
      setIsLoading(true);
      getRecipeWithIngredients(recipeId).then((data) => {
        setRecipe(data);
        setIsLoading(false);
      });
    } else if (!open) {
      setRecipe(null);
      setCookingMode(false);
      setCurrentStep(0);
      setCheckedIngredients(new Set());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, recipeId]);

  const groupedIngredients =
    recipe?.ingredients?.reduce(
      (acc, ing) => {
        const category = ing.category || t("recipe.other");
        if (!acc[category]) acc[category] = [];
        acc[category].push(ing);
        return acc;
      },
      {} as Record<string, RecipeIngredient[]>,
    ) || {};

  const formatInstructions = (instructions: string | null) => {
    if (!instructions) return [];
    return instructions.split("\n").filter((line) => line.trim());
  };

  const instructions = formatInstructions(recipe?.instructions || null);
  const totalSteps = instructions.length;

  const handlePrevStep = () => {
    setCurrentStep((prev) => Math.max(0, prev - 1));
  };

  const handleNextStep = () => {
    setCurrentStep((prev) => Math.min(totalSteps - 1, prev + 1));
  };

  const exitCookingMode = () => {
    setCookingMode(false);
    setCurrentStep(0);
  };

  // Cooking Mode View
  if (cookingMode && recipe) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl h-[90vh] p-0 flex flex-col">
          {/* Header */}
          <div className="p-4 border-b bg-primary/5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ChefHat className="h-6 w-6 text-primary" />
              <div>
                <h2 className="font-semibold text-lg">{recipe.name}</h2>
                <p className="text-sm text-muted-foreground">
                  {t("recipe.cookingMode")} • {t("recipe.step")} {currentStep + 1} {t("recipe.of")}{" "}
                  {totalSteps}
                </p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={exitCookingMode}>
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Progress Bar */}
          <div className="h-2 bg-muted">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${((currentStep + 1) / totalSteps) * 100}%` }}
            />
          </div>

          {/* Main Content */}
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 text-primary text-2xl font-bold flex items-center justify-center mb-6">
              {currentStep + 1}
            </div>
            <p className="text-2xl md:text-3xl leading-relaxed max-w-2xl">
              {instructions[currentStep]}
            </p>
          </div>

          {/* Navigation */}
          <div className="p-6 border-t bg-background flex items-center justify-between gap-4">
            <Button
              variant="outline"
              size="lg"
              onClick={handlePrevStep}
              disabled={currentStep === 0}
              className="flex-1 max-w-[200px]"
            >
              <ChevronLeft className="h-5 w-5 mr-2" />
              {t("recipe.previous")}
            </Button>

            <div className="flex gap-1">
              {instructions.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentStep(idx)}
                  className={`w-2.5 h-2.5 rounded-full transition-colors ${
                    idx === currentStep ? "bg-primary" : "bg-muted-foreground/30"
                  }`}
                />
              ))}
            </div>

            {currentStep === totalSteps - 1 ? (
              <Button size="lg" onClick={exitCookingMode} className="flex-1 max-w-[200px]">
                <Check className="h-5 w-5 mr-2" />
                {t("recipe.done")}
              </Button>
            ) : (
              <Button size="lg" onClick={handleNextStep} className="flex-1 max-w-[200px]">
                {t("recipe.next")}
                <ChevronRight className="h-5 w-5 ml-2" />
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Normal Recipe View
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] p-0">
        <ScrollArea className="max-h-[85vh]">
          <div className="p-6">
            {isLoading ? (
              <div className="flex items-center justify-center h-48">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              </div>
            ) : recipe ? (
              <>
                <DialogHeader>
                  <DialogTitle className="text-2xl flex items-center gap-3">
                    <ChefHat className="h-6 w-6 text-primary" />
                    {recipe.name}
                  </DialogTitle>
                  {recipe.description && (
                    <p className="text-muted-foreground mt-2">{recipe.description}</p>
                  )}
                </DialogHeader>

                {/* Quick Info */}
                <div className="flex flex-wrap gap-3 mt-4">
                  {recipe.category && <Badge variant="secondary">{recipe.category}</Badge>}
                  {recipe.servings && (
                    <Badge variant="outline" className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {recipe.servings} {t("meals.servings")}
                    </Badge>
                  )}
                  {recipe.prep_time_minutes && (
                    <Badge variant="outline" className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {t("meals.prepTime")}: {recipe.prep_time_minutes} {t("meals.minutes")}
                    </Badge>
                  )}
                  {recipe.cook_time_minutes && (
                    <Badge variant="outline" className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {t("meals.cookTime")}: {recipe.cook_time_minutes} {t("meals.minutes")}
                    </Badge>
                  )}
                </div>

                {recipe.tags && recipe.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-3">
                    {recipe.tags.map((tag, i) => (
                      <Badge key={i} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}

                {/* Start Cooking Mode Button */}
                {instructions.length > 0 && (
                  <Button onClick={() => setCookingMode(true)} className="w-full mt-4" size="lg">
                    <Play className="h-5 w-5 mr-2" />
                    {t("recipe.startCooking")}
                  </Button>
                )}

                <Separator className="my-4" />

                {/* Ingredients */}
                {recipe.ingredients && recipe.ingredients.length > 0 && (
                  <div className="mb-6">
                    <h3 className="font-semibold text-lg flex items-center gap-2 mb-3">
                      <List className="h-5 w-5 text-primary" />
                      {t("recipe.ingredients")}
                    </h3>
                    <div className="space-y-4">
                      {Object.entries(groupedIngredients).map(([category, ings]) => (
                        <div key={category}>
                          <h4 className="text-sm font-medium text-muted-foreground mb-2 capitalize">
                            {category}
                          </h4>
                          <ul className="space-y-1.5">
                            {ings.map((ing) => {
                              const isChecked = checkedIngredients.has(ing.id);
                              return (
                                <li
                                  key={ing.id}
                                  className="flex items-center gap-2.5 text-sm cursor-pointer select-none active:scale-[0.98] transition-transform"
                                  onClick={() => {
                                    setCheckedIngredients((prev) => {
                                      const next = new Set(prev);
                                      if (next.has(ing.id)) next.delete(ing.id);
                                      else next.add(ing.id);
                                      return next;
                                    });
                                  }}
                                >
                                  <span
                                    className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${isChecked ? "bg-primary border-primary" : "border-muted-foreground/40"}`}
                                  >
                                    {isChecked && (
                                      <Check className="h-3 w-3 text-primary-foreground" />
                                    )}
                                  </span>
                                  <span
                                    className={
                                      isChecked ? "line-through text-muted-foreground" : ""
                                    }
                                  >
                                    {ing.quantity && (
                                      <span className="font-medium">{ing.quantity}</span>
                                    )}
                                    {ing.unit && (
                                      <span className="text-muted-foreground"> {ing.unit}</span>
                                    )}
                                    <span> {ing.name}</span>
                                  </span>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Instructions */}
                {instructions.length > 0 && (
                  <div>
                    <h3 className="font-semibold text-lg flex items-center gap-2 mb-3">
                      <BookOpen className="h-5 w-5 text-primary" />
                      {t("recipe.instructions")}
                    </h3>
                    <ol className="space-y-3">
                      {instructions.map((step, index) => (
                        <li key={index} className="flex gap-3">
                          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-sm font-medium flex items-center justify-center">
                            {index + 1}
                          </span>
                          <p className="text-sm leading-relaxed pt-0.5">{step}</p>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}

                {!recipe.instructions &&
                  (!recipe.ingredients || recipe.ingredients.length === 0) && (
                    <p className="text-muted-foreground text-center py-8">
                      {t("recipe.noDetails")}
                    </p>
                  )}
              </>
            ) : (
              <p className="text-muted-foreground text-center py-8">{t("recipe.notFound")}</p>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
