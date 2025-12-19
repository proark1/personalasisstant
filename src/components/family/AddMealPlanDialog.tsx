import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useMealPlanning } from '@/hooks/useMealPlanning';
import { format } from 'date-fns';

interface AddMealPlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDate: Date;
  onSuccess?: () => void;
}

const mealTypes = [
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Dinner' },
  { value: 'snack', label: 'Snack' },
];

export function AddMealPlanDialog({ open, onOpenChange, selectedDate, onSuccess }: AddMealPlanDialogProps) {
  const { recipes, addMealPlan, refetchRecipes } = useMealPlanning();
  const [mealType, setMealType] = useState('dinner');
  const [recipeId, setRecipeId] = useState<string>('');
  const [customMealName, setCustomMealName] = useState('');
  const [servings, setServings] = useState('4');

  // Refetch recipes when dialog opens to ensure we have the latest
  useEffect(() => {
    if (open) {
      refetchRecipes();
    }
  }, [open, refetchRecipes]);

  const handleSubmit = async () => {
    if (!recipeId && !customMealName.trim()) return;

    const result = await addMealPlan({
      recipe_id: recipeId || null,
      meal_date: format(selectedDate, 'yyyy-MM-dd'),
      meal_type: mealType,
      custom_meal_name: customMealName.trim() || null,
      notes: null,
      servings: parseInt(servings) || 4,
    });

    if (result) {
      onSuccess?.();
    }
    resetForm();
    onOpenChange(false);
  };

  const resetForm = () => {
    setMealType('dinner');
    setRecipeId('');
    setCustomMealName('');
    setServings('4');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Plan Meal for {format(selectedDate, 'EEEE, MMM d')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="mealType">Meal Type</Label>
            <Select value={mealType} onValueChange={setMealType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {mealTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="recipe">Select Recipe (optional)</Label>
            <Select value={recipeId || "_none"} onValueChange={(v) => setRecipeId(v === "_none" ? "" : v)}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a recipe..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">No recipe</SelectItem>
                {recipes.map((recipe) => (
                  <SelectItem key={recipe.id} value={recipe.id}>
                    {recipe.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {!recipeId && (
            <div className="space-y-2">
              <Label htmlFor="customMeal">Or enter custom meal</Label>
              <Input
                id="customMeal"
                value={customMealName}
                onChange={(e) => setCustomMealName(e.target.value)}
                placeholder="e.g., Takeout, Leftovers..."
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="servings">Servings</Label>
            <Input
              id="servings"
              type="number"
              min="1"
              value={servings}
              onChange={(e) => setServings(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!recipeId && !customMealName.trim()}>
            Add to Plan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
