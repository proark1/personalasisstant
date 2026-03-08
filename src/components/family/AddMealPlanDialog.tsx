import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { de, enUS } from 'date-fns/locale';
import { useLanguage } from '@/contexts/LanguageContext';
import type { MealPlan, Recipe } from '@/hooks/useMealPlanning';

interface AddMealPlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDate: Date;
  onSuccess?: () => void;
  recipes: Recipe[];
  addMealPlan: (plan: Omit<MealPlan, 'id' | 'user_id' | 'created_at'>) => Promise<MealPlan | null>;
  refetchRecipes: () => void;
}

export function AddMealPlanDialog({
  open,
  onOpenChange,
  selectedDate,
  onSuccess,
  recipes,
  addMealPlan,
  refetchRecipes,
}: AddMealPlanDialogProps) {
  const { t, language } = useLanguage();
  const [mealType, setMealType] = useState(() => {
    const hour = new Date().getHours();
    if (hour < 10) return 'breakfast';
    if (hour < 14) return 'lunch';
    if (hour < 18) return 'dinner';
    return 'snack';
  });
  const [recipeId, setRecipeId] = useState<string>('');
  const [customMealName, setCustomMealName] = useState('');
  const [servings, setServings] = useState('4');
  const [notes, setNotes] = useState('');

  const locale = language === 'de' ? de : enUS;

  const mealTypes = [
    { value: 'breakfast', label: t('mealType.breakfast') },
    { value: 'lunch', label: t('mealType.lunch') },
    { value: 'dinner', label: t('mealType.dinner') },
    { value: 'snack', label: t('mealType.snack') },
  ];

  useEffect(() => {
    if (open) {
      refetchRecipes();
    }
  }, [open, refetchRecipes]);

  const handleSubmit = async () => {
    if (!recipeId && !customMealName.trim()) return;

    console.log('Adding meal plan:', {
      recipe_id: recipeId || null,
      meal_date: format(selectedDate, 'yyyy-MM-dd'),
      meal_type: mealType,
      custom_meal_name: customMealName.trim() || null,
      notes: notes.trim() || null,
      servings: parseInt(servings) || 4,
    });

    try {
      const result = await addMealPlan({
        recipe_id: recipeId || null,
        meal_date: format(selectedDate, 'yyyy-MM-dd'),
        meal_type: mealType,
        custom_meal_name: customMealName.trim() || null,
        notes: notes.trim() || null,
        servings: parseInt(servings) || 4,
      });

      console.log('Add meal result:', result);

      if (result) {
        onSuccess?.();
      }
    } catch (error) {
      console.error('Error in handleSubmit:', error);
    }
    
    resetForm();
    onOpenChange(false);
  };

  const resetForm = () => {
    const hour = new Date().getHours();
    setMealType(hour < 10 ? 'breakfast' : hour < 14 ? 'lunch' : hour < 18 ? 'dinner' : 'snack');
    setRecipeId('');
    setCustomMealName('');
    setServings('4');
    setNotes('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t('addMeal.title')} - {format(selectedDate, 'EEEE, d. MMM', { locale })}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="mealType">{t('addMeal.mealType')}</Label>
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
            <Label htmlFor="recipe">{t('addMeal.selectRecipe')}</Label>
            <Select value={recipeId || "_none"} onValueChange={(v) => setRecipeId(v === "_none" ? "" : v)}>
              <SelectTrigger>
                <SelectValue placeholder={t('addMeal.selectRecipe')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">{language === 'de' ? 'Kein Rezept' : 'No recipe'}</SelectItem>
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
              <Label htmlFor="customMeal">{t('addMeal.orCustomMeal')}</Label>
              <Input
                id="customMeal"
                value={customMealName}
                onChange={(e) => setCustomMealName(e.target.value)}
                placeholder={language === 'de' ? 'z.B. Bestellen, Reste...' : 'e.g., Takeout, Leftovers...'}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="servings">{t('addMeal.servings')}</Label>
            <Input
              id="servings"
              type="number"
              min="1"
              value={servings}
              onChange={(e) => setServings(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">{t('addMeal.notes')}</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={language === 'de' ? 'Notizen hinzufügen...' : 'Add notes...'}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={!recipeId && !customMealName.trim()}>
            {t('common.add')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
