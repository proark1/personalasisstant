import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from 'sonner';
import { fetchWithRetry, TimeoutError } from '@/lib/fetchWithTimeout';

export interface RecipeIngredient {
  id: string;
  recipe_id: string;
  user_id: string;
  name: string;
  quantity: number | null;
  unit: string | null;
  category: string;
  created_at: string;
}

export interface Recipe {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  servings: number;
  prep_time_minutes: number | null;
  cook_time_minutes: number | null;
  instructions: string | null;
  image_url: string | null;
  category: string;
  tags: string[];
  created_at: string;
  updated_at: string;
  ingredients?: RecipeIngredient[];
}

export interface MealPlan {
  id: string;
  user_id: string;
  recipe_id: string | null;
  meal_date: string;
  meal_type: string;
  custom_meal_name: string | null;
  notes: string | null;
  servings: number;
  created_at: string;
  recipe?: Recipe;
}

export function useMealPlanning() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [mealPlans, setMealPlans] = useState<MealPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const fetchRecipes = useCallback(async () => {
    if (!user?.id) return;

    try {
      const { data, error } = await fetchWithRetry(
        async () => supabase
          .from('recipes')
          .select('*')
          .eq('user_id', user.id)
          .order('name'),
        { maxRetries: 2, timeoutMs: 12000 }
      );

      if (error) throw error;
      setRecipes(data || []);
    } catch (error) {
      console.error('Error fetching recipes:', error);
    }
  }, [user?.id]);

  const fetchMealPlans = useCallback(async (startDate: string, endDate: string) => {
    if (!user?.id) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setFetchError(null);
    
    try {
      const { data, error } = await fetchWithRetry(
        async () => supabase
          .from('meal_plans')
          .select('*')
          .eq('user_id', user.id)
          .gte('meal_date', startDate)
          .lte('meal_date', endDate)
          .order('meal_date'),
        { maxRetries: 2, timeoutMs: 12000 }
      );

      if (error) throw error;

      // Fetch associated recipes
      const recipeIds = data?.filter((m) => m.recipe_id).map((m) => m.recipe_id) || [];
      let recipesMap: Record<string, Recipe> = {};

      if (recipeIds.length > 0) {
        const { data: recipesData } = await supabase
          .from('recipes')
          .select('*')
          .in('id', recipeIds);

        recipesMap = (recipesData || []).reduce((acc, r) => {
          acc[r.id] = r;
          return acc;
        }, {} as Record<string, Recipe>);
      }

      const plansWithRecipes = (data || []).map((plan) => ({
        ...plan,
        recipe: plan.recipe_id ? recipesMap[plan.recipe_id] : undefined,
      }));

      setMealPlans(plansWithRecipes);
    } catch (error) {
      console.error('Error fetching meal plans:', error);
      if (error instanceof TimeoutError) {
        setFetchError('Loading took too long. Tap to retry.');
      } else {
        setFetchError('Failed to load meal plans.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  const addRecipe = async (recipe: Omit<Recipe, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
    if (!user?.id) return null;

    try {
      // `ingredients` is a separate table, not a column on recipes.
      const { ingredients: _ingredients, ...recipeFields } = recipe;
      const { data, error } = await supabase
        .from('recipes')
        .insert({ ...recipeFields, user_id: user.id })
        .select()
        .single();

      if (error) throw error;
      setRecipes(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
      toast.success(t('meals.toast.recipeAdded'));
      return data;
    } catch (error) {
      console.error('Error adding recipe:', error);
      toast.error(t('meals.toast.recipeAddFailed'));
      return null;
    }
  };

  const updateRecipe = async (id: string, updates: Partial<Recipe>) => {
    try {
      const { ingredients: _ingredients, ...updateFields } = updates;
      const { data, error } = await supabase
        .from('recipes')
        .update({ ...updateFields, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('user_id', user?.id)
        .select()
        .single();

      if (error) throw error;
      setRecipes(prev => prev.map(r => r.id === id ? data : r));
      toast.success(t('meals.toast.recipeUpdated'));
      return data;
    } catch (error) {
      console.error('Error updating recipe:', error);
      toast.error(t('meals.toast.recipeUpdateFailed'));
      return null;
    }
  };

  const deleteRecipe = async (id: string) => {
    try {
      const { error } = await supabase
        .from('recipes')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setRecipes(prev => prev.filter(r => r.id !== id));
      toast.success(t('meals.toast.recipeDeleted'));
    } catch (error) {
      console.error('Error deleting recipe:', error);
      toast.error(t('meals.toast.recipeDeleteFailed'));
    }
  };

  const getRecipeWithIngredients = async (recipeId: string): Promise<Recipe | null> => {
    try {
      const { data: recipe, error: recipeError } = await supabase
        .from('recipes')
        .select('*')
        .eq('id', recipeId)
        .single();

      if (recipeError) throw recipeError;

      const { data: ingredients, error: ingredientsError } = await supabase
        .from('recipe_ingredients')
        .select('*')
        .eq('recipe_id', recipeId);

      if (ingredientsError) throw ingredientsError;

      return { ...recipe, ingredients: ingredients || [] };
    } catch (error) {
      console.error('Error fetching recipe:', error);
      return null;
    }
  };

  const addIngredient = async (recipeId: string, ingredient: Omit<RecipeIngredient, 'id' | 'recipe_id' | 'user_id' | 'created_at'>) => {
    if (!user?.id) return null;

    try {
      const { data, error } = await supabase
        .from('recipe_ingredients')
        .insert({ ...ingredient, recipe_id: recipeId, user_id: user.id })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error adding ingredient:', error);
      toast.error(t('meals.toast.ingredientAddFailed'));
      return null;
    }
  };

  const deleteIngredient = async (ingredientId: string) => {
    try {
      const { error } = await supabase
        .from('recipe_ingredients')
        .delete()
        .eq('id', ingredientId);

      if (error) throw error;
    } catch (error) {
      console.error('Error deleting ingredient:', error);
    }
  };

  const addMealPlan = async (plan: Omit<MealPlan, 'id' | 'user_id' | 'created_at'>) => {
    if (!user?.id) return null;

    try {
      // `recipe` is the joined record, not a column on meal_plans.
      const { recipe: _recipe, ...planFields } = plan;
      const { data, error } = await supabase
        .from('meal_plans')
        .insert({ ...planFields, user_id: user.id })
        .select()
        .single();

      if (error) throw error;
      
      // Add recipe info if available
      const recipe = plan.recipe_id ? recipes.find(r => r.id === plan.recipe_id) : undefined;
      setMealPlans(prev => [...prev, { ...data, recipe }]);
      toast.success(t('meals.toast.mealPlanned'));
      return data;
    } catch (error) {
      console.error('Error adding meal plan:', error);
      toast.error(t('meals.toast.mealPlanFailed'));
      return null;
    }
  };

  const deleteMealPlan = async (id: string) => {
    try {
      const { error } = await supabase
        .from('meal_plans')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setMealPlans(prev => prev.filter(m => m.id !== id));
      toast.success(t('meals.toast.mealRemoved'));
    } catch (error) {
      console.error('Error deleting meal plan:', error);
      toast.error(t('meals.toast.mealRemoveFailed'));
    }
  };

  const updateMealPlan = async (id: string, updates: Partial<MealPlan>) => {
    try {
      const { recipe: _recipe, ...updateFields } = updates;
      const { data, error } = await supabase
        .from('meal_plans')
        .update(updateFields)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      
      setMealPlans(prev => prev.map(m => {
        if (m.id === id) {
          return { ...m, ...data, recipe: m.recipe };
        }
        return m;
      }));
      toast.success(t('meals.toast.mealMoved'));
      return data;
    } catch (error) {
      console.error('Error updating meal plan:', error);
      toast.error(t('meals.toast.mealMoveFailed'));
      return null;
    }
  };

  const generateShoppingList = async (startDate: string, endDate: string) => {
    // Get all meal plans for the date range
    const plans = mealPlans.filter(
      p => p.meal_date >= startDate && p.meal_date <= endDate && p.recipe_id
    );

    const ingredients: { name: string; quantity: number | null; unit: string | null; category: string }[] = [];

    for (const plan of plans) {
      if (plan.recipe_id) {
        const recipe = await getRecipeWithIngredients(plan.recipe_id);
        if (recipe?.ingredients) {
          const servingMultiplier = plan.servings / (recipe.servings || 4);
          recipe.ingredients.forEach(ing => {
            ingredients.push({
              name: ing.name,
              quantity: ing.quantity ? ing.quantity * servingMultiplier : null,
              unit: ing.unit,
              category: ing.category,
            });
          });
        }
      }
    }

    return ingredients;
  };

  useEffect(() => {
    fetchRecipes();
  }, [fetchRecipes]);

  return {
    recipes,
    mealPlans,
    isLoading,
    fetchError,
    addRecipe,
    updateRecipe,
    deleteRecipe,
    getRecipeWithIngredients,
    addIngredient,
    deleteIngredient,
    addMealPlan,
    updateMealPlan,
    deleteMealPlan,
    fetchMealPlans,
    generateShoppingList,
    refetchRecipes: fetchRecipes,
  };
}
