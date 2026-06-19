import { useMealPlanning } from "@/hooks/useMealPlanning";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, Users, Trash2, BookOpen } from "lucide-react";

const categoryColors: Record<string, string> = {
  breakfast: "bg-yellow-500/20 text-yellow-700 dark:text-yellow-400",
  main: "bg-blue-500/20 text-blue-700 dark:text-blue-400",
  side: "bg-green-500/20 text-green-700 dark:text-green-400",
  soup: "bg-orange-500/20 text-orange-700 dark:text-orange-400",
  salad: "bg-emerald-500/20 text-emerald-700 dark:text-emerald-400",
  dessert: "bg-pink-500/20 text-pink-700 dark:text-pink-400",
  snack: "bg-purple-500/20 text-purple-700 dark:text-purple-400",
  drink: "bg-cyan-500/20 text-cyan-700 dark:text-cyan-400",
};

export function RecipesList() {
  const { recipes, deleteRecipe } = useMealPlanning();

  if (recipes.length === 0) {
    return (
      <Card className="p-8 text-center">
        <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium mb-2">No recipes yet</h3>
        <p className="text-sm text-muted-foreground">
          Add your favorite recipes to easily plan meals for the week
        </p>
      </Card>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {recipes.map((recipe) => (
        <Card key={recipe.id} className="p-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-medium">{recipe.name}</h3>
                <Badge className={categoryColors[recipe.category] || "bg-muted"}>
                  {recipe.category}
                </Badge>
              </div>
              {recipe.description && (
                <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                  {recipe.description}
                </p>
              )}
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  {recipe.servings} servings
                </span>
                {(recipe.prep_time_minutes || recipe.cook_time_minutes) && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {(recipe.prep_time_minutes || 0) + (recipe.cook_time_minutes || 0)} min
                  </span>
                )}
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={() => deleteRecipe(recipe.id)}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
}
