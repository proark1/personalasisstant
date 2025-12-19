import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Clock, Users, ChefHat, List, BookOpen } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useMealPlanning, Recipe, RecipeIngredient } from '@/hooks/useMealPlanning';

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

  useEffect(() => {
    if (open && recipeId) {
      setIsLoading(true);
      getRecipeWithIngredients(recipeId).then((data) => {
        setRecipe(data);
        setIsLoading(false);
      });
    } else if (!open) {
      setRecipe(null);
    }
  }, [open, recipeId]);

  const groupedIngredients = recipe?.ingredients?.reduce((acc, ing) => {
    const category = ing.category || t('recipe.other');
    if (!acc[category]) acc[category] = [];
    acc[category].push(ing);
    return acc;
  }, {} as Record<string, RecipeIngredient[]>) || {};

  const formatInstructions = (instructions: string | null) => {
    if (!instructions) return [];
    return instructions.split('\n').filter(line => line.trim());
  };

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
                  {recipe.category && (
                    <Badge variant="secondary">{recipe.category}</Badge>
                  )}
                  {recipe.servings && (
                    <Badge variant="outline" className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {recipe.servings} {t('meals.servings')}
                    </Badge>
                  )}
                  {recipe.prep_time_minutes && (
                    <Badge variant="outline" className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {t('meals.prepTime')}: {recipe.prep_time_minutes} {t('meals.minutes')}
                    </Badge>
                  )}
                  {recipe.cook_time_minutes && (
                    <Badge variant="outline" className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {t('meals.cookTime')}: {recipe.cook_time_minutes} {t('meals.minutes')}
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

                <Separator className="my-4" />

                {/* Ingredients */}
                {recipe.ingredients && recipe.ingredients.length > 0 && (
                  <div className="mb-6">
                    <h3 className="font-semibold text-lg flex items-center gap-2 mb-3">
                      <List className="h-5 w-5 text-primary" />
                      {t('recipe.ingredients')}
                    </h3>
                    <div className="space-y-4">
                      {Object.entries(groupedIngredients).map(([category, ings]) => (
                        <div key={category}>
                          <h4 className="text-sm font-medium text-muted-foreground mb-2 capitalize">
                            {category}
                          </h4>
                          <ul className="space-y-1.5">
                            {ings.map((ing) => (
                              <li key={ing.id} className="flex items-center gap-2 text-sm">
                                <span className="w-2 h-2 rounded-full bg-primary/50" />
                                <span>
                                  {ing.quantity && (
                                    <span className="font-medium">{ing.quantity}</span>
                                  )}
                                  {ing.unit && <span className="text-muted-foreground"> {ing.unit}</span>}
                                  <span> {ing.name}</span>
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Instructions */}
                {recipe.instructions && (
                  <div>
                    <h3 className="font-semibold text-lg flex items-center gap-2 mb-3">
                      <BookOpen className="h-5 w-5 text-primary" />
                      {t('recipe.instructions')}
                    </h3>
                    <ol className="space-y-3">
                      {formatInstructions(recipe.instructions).map((step, index) => (
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

                {!recipe.instructions && (!recipe.ingredients || recipe.ingredients.length === 0) && (
                  <p className="text-muted-foreground text-center py-8">
                    {t('recipe.noDetails')}
                  </p>
                )}
              </>
            ) : (
              <p className="text-muted-foreground text-center py-8">
                {t('recipe.notFound')}
              </p>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
