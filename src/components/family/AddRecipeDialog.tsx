import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useMealPlanning } from '@/hooks/useMealPlanning';
import { Plus, X, Sparkles, Loader2, ChefHat, Search, Lightbulb } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

interface AddRecipeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface RecipeSuggestion {
  name: string;
  description: string;
  category: string;
  prepTime?: number;
  cookTime?: number;
  cuisine?: string;
}

const categories = [
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'main', label: 'Main Course' },
  { value: 'side', label: 'Side Dish' },
  { value: 'soup', label: 'Soup' },
  { value: 'salad', label: 'Salad' },
  { value: 'dessert', label: 'Dessert' },
  { value: 'snack', label: 'Snack' },
  { value: 'drink', label: 'Drink' },
];

const ingredientCategories = [
  { value: 'produce', label: 'Produce' },
  { value: 'dairy', label: 'Dairy' },
  { value: 'meat', label: 'Meat' },
  { value: 'pantry', label: 'Pantry' },
  { value: 'frozen', label: 'Frozen' },
  { value: 'other', label: 'Other' },
];

const dietTypes = [
  { value: 'any', label: 'Any Diet' },
  { value: 'vegan', label: 'Vegan' },
  { value: 'vegetarian', label: 'Vegetarian' },
  { value: 'pescetarian', label: 'Pescetarian' },
];

const mealCategories = [
  { value: 'any', label: 'Any Category' },
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Dinner' },
  { value: 'dessert', label: 'Dessert' },
];

export function AddRecipeDialog({ open, onOpenChange }: AddRecipeDialogProps) {
  const { toast } = useToast();
  const { addRecipe, addIngredient } = useMealPlanning();
  const [activeTab, setActiveTab] = useState<'manual' | 'ai'>('ai');
  
  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('main');
  const [servings, setServings] = useState('4');
  const [prepTime, setPrepTime] = useState('');
  const [cookTime, setCookTime] = useState('');
  const [instructions, setInstructions] = useState('');
  const [ingredients, setIngredients] = useState<{ name: string; quantity: string; unit: string; category: string }[]>([]);
  const [newIngredient, setNewIngredient] = useState({ name: '', quantity: '', unit: '', category: 'other' });
  
  // AI state
  const [aiQuery, setAiQuery] = useState('');
  const [selectedDiet, setSelectedDiet] = useState('any');
  const [selectedMealCategory, setSelectedMealCategory] = useState('any');
  const [suggestions, setSuggestions] = useState<RecipeSuggestion[]>([]);
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [isFillingRecipe, setIsFillingRecipe] = useState(false);

  const handleAddIngredient = () => {
    if (!newIngredient.name.trim()) return;
    setIngredients([...ingredients, newIngredient]);
    setNewIngredient({ name: '', quantity: '', unit: '', category: 'other' });
  };

  const handleRemoveIngredient = (index: number) => {
    setIngredients(ingredients.filter((_, i) => i !== index));
  };

  const handleAIExplore = async () => {
    setIsLoadingAI(true);
    try {
      // Build filter string for AI
      const filters: string[] = [];
      if (selectedDiet !== 'any') filters.push(selectedDiet);
      if (selectedMealCategory !== 'any') filters.push(selectedMealCategory);
      const filterQuery = filters.length > 0 ? filters.join(' ') + ' recipes' : '';
      
      const { data, error } = await supabase.functions.invoke('recipe-assistant', {
        body: { 
          type: 'explore', 
          query: filterQuery,
          diet: selectedDiet !== 'any' ? selectedDiet : undefined,
          mealCategory: selectedMealCategory !== 'any' ? selectedMealCategory : undefined
        }
      });
      
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      
      setSuggestions(data.suggestions || []);
    } catch (error) {
      console.error('AI explore error:', error);
      toast({
        title: "AI Error",
        description: error instanceof Error ? error.message : "Failed to get suggestions",
        variant: "destructive"
      });
    } finally {
      setIsLoadingAI(false);
    }
  };

  const handleAISearch = async () => {
    if (!aiQuery.trim()) return;
    setIsLoadingAI(true);
    try {
      const { data, error } = await supabase.functions.invoke('recipe-assistant', {
        body: { type: 'suggest', query: aiQuery }
      });
      
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      
      setSuggestions(data.suggestions || []);
    } catch (error) {
      console.error('AI search error:', error);
      toast({
        title: "AI Error",
        description: error instanceof Error ? error.message : "Failed to search recipes",
        variant: "destructive"
      });
    } finally {
      setIsLoadingAI(false);
    }
  };

  const handleSelectSuggestion = async (suggestion: RecipeSuggestion) => {
    setIsFillingRecipe(true);
    try {
      const { data, error } = await supabase.functions.invoke('recipe-assistant', {
        body: { type: 'fill', recipeName: suggestion.name }
      });
      
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      
      const recipe = data.recipe;
      if (recipe) {
        setName(recipe.name || suggestion.name);
        setDescription(recipe.description || suggestion.description);
        setCategory(recipe.category || suggestion.category || 'main');
        setServings(String(recipe.servings || 4));
        setPrepTime(String(recipe.prepTime || suggestion.prepTime || ''));
        setCookTime(String(recipe.cookTime || suggestion.cookTime || ''));
        setInstructions(recipe.instructions || '');
        setIngredients(
          (recipe.ingredients || []).map((ing: any) => ({
            name: ing.name,
            quantity: String(ing.quantity || ''),
            unit: ing.unit || '',
            category: ing.category || 'other'
          }))
        );
        setActiveTab('manual');
        toast({
          title: "Recipe Loaded",
          description: "AI has filled in the recipe details. Review and save!",
        });
      }
    } catch (error) {
      console.error('AI fill error:', error);
      toast({
        title: "AI Error",
        description: error instanceof Error ? error.message : "Failed to fill recipe",
        variant: "destructive"
      });
    } finally {
      setIsFillingRecipe(false);
    }
  };

  const handleAIFillFromName = async () => {
    if (!name.trim()) {
      toast({ title: "Enter a recipe name first", variant: "destructive" });
      return;
    }
    setIsFillingRecipe(true);
    try {
      const { data, error } = await supabase.functions.invoke('recipe-assistant', {
        body: { type: 'fill', recipeName: name }
      });
      
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      
      const recipe = data.recipe;
      if (recipe) {
        setDescription(recipe.description || '');
        setCategory(recipe.category || 'main');
        setServings(String(recipe.servings || 4));
        setPrepTime(String(recipe.prepTime || ''));
        setCookTime(String(recipe.cookTime || ''));
        setInstructions(recipe.instructions || '');
        setIngredients(
          (recipe.ingredients || []).map((ing: any) => ({
            name: ing.name,
            quantity: String(ing.quantity || ''),
            unit: ing.unit || '',
            category: ing.category || 'other'
          }))
        );
        toast({
          title: "Recipe Filled",
          description: "AI has filled in the details. Review and adjust as needed!",
        });
      }
    } catch (error) {
      console.error('AI fill error:', error);
      toast({
        title: "AI Error",
        description: error instanceof Error ? error.message : "Failed to fill recipe",
        variant: "destructive"
      });
    } finally {
      setIsFillingRecipe(false);
    }
  };

  const handleSubmit = async () => {
    if (!name.trim()) return;

    const recipe = await addRecipe({
      name: name.trim(),
      description: description.trim() || null,
      category,
      servings: parseInt(servings) || 4,
      prep_time_minutes: prepTime ? parseInt(prepTime) : null,
      cook_time_minutes: cookTime ? parseInt(cookTime) : null,
      instructions: instructions.trim() || null,
      image_url: null,
      tags: [],
    });

    if (recipe) {
      for (const ing of ingredients) {
        await addIngredient(recipe.id, {
          name: ing.name,
          quantity: ing.quantity ? parseFloat(ing.quantity) : null,
          unit: ing.unit || null,
          category: ing.category,
        });
      }
      toast({ title: "Recipe added successfully!" });
    }

    resetForm();
    onOpenChange(false);
  };

  const resetForm = () => {
    setName('');
    setDescription('');
    setCategory('main');
    setServings('4');
    setPrepTime('');
    setCookTime('');
    setInstructions('');
    setIngredients([]);
    setSuggestions([]);
    setAiQuery('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ChefHat className="h-5 w-5" />
            Add Recipe
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'manual' | 'ai')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="ai" className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              AI Assist
            </TabsTrigger>
            <TabsTrigger value="manual">Manual Entry</TabsTrigger>
          </TabsList>

          <TabsContent value="ai" className="space-y-4 mt-4">
            <div className="space-y-3">
              {/* Filters for Explore */}
              <div className="grid grid-cols-2 gap-2">
                <Select value={selectedDiet} onValueChange={setSelectedDiet}>
                  <SelectTrigger>
                    <SelectValue placeholder="Diet Type" />
                  </SelectTrigger>
                  <SelectContent>
                    {dietTypes.map((diet) => (
                      <SelectItem key={diet.value} value={diet.value}>
                        {diet.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <Select value={selectedMealCategory} onValueChange={setSelectedMealCategory}>
                  <SelectTrigger>
                    <SelectValue placeholder="Meal Category" />
                  </SelectTrigger>
                  <SelectContent>
                    {mealCategories.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <Button 
                variant="outline" 
                onClick={handleAIExplore} 
                disabled={isLoadingAI}
                className="w-full"
              >
                {isLoadingAI ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Lightbulb className="h-4 w-4 mr-2" />
                )}
                Explore Recipe Ideas
              </Button>
              
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">or search</span>
                </div>
              </div>
              
              <div className="flex gap-2">
                <Input
                  placeholder="Search for recipes... (e.g., 'quick weeknight pasta')"
                  value={aiQuery}
                  onChange={(e) => setAiQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAISearch()}
                  className="flex-1"
                />
                <Button onClick={handleAISearch} disabled={isLoadingAI || !aiQuery.trim()}>
                  {isLoadingAI ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            {isFillingRecipe && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="ml-2">AI is preparing your recipe...</span>
              </div>
            )}

            {suggestions.length > 0 && !isFillingRecipe && (
              <ScrollArea className="h-[300px]">
                <div className="space-y-2">
                  {suggestions.map((suggestion, index) => (
                    <Card 
                      key={index} 
                      className="cursor-pointer hover:bg-accent/50 transition-colors"
                      onClick={() => handleSelectSuggestion(suggestion)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h4 className="font-medium">{suggestion.name}</h4>
                            <p className="text-sm text-muted-foreground line-clamp-2">
                              {suggestion.description}
                            </p>
                            <div className="flex gap-2 mt-2 flex-wrap">
                              <Badge variant="secondary">{suggestion.category}</Badge>
                              {suggestion.cuisine && (
                                <Badge variant="outline">{suggestion.cuisine}</Badge>
                              )}
                              {suggestion.prepTime && (
                                <Badge variant="outline">Prep: {suggestion.prepTime}min</Badge>
                              )}
                              {suggestion.cookTime && (
                                <Badge variant="outline">Cook: {suggestion.cookTime}min</Badge>
                              )}
                            </div>
                          </div>
                          <Sparkles className="h-4 w-4 text-primary shrink-0 ml-2" />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            )}

            {suggestions.length === 0 && !isLoadingAI && !isFillingRecipe && (
              <div className="text-center py-8 text-muted-foreground">
                <ChefHat className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Search for recipes or explore ideas</p>
                <p className="text-sm">AI will help you discover and create recipes</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="manual" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Recipe Name</Label>
                <div className="flex gap-2">
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., Chicken Stir Fry"
                    className="flex-1"
                  />
                  <Button 
                    variant="outline" 
                    size="icon" 
                    onClick={handleAIFillFromName}
                    disabled={isFillingRecipe || !name.trim()}
                    title="AI Auto-fill"
                  >
                    {isFillingRecipe ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description..."
                rows={2}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
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
              <div className="space-y-2">
                <Label htmlFor="prepTime">Prep Time (min)</Label>
                <Input
                  id="prepTime"
                  type="number"
                  min="0"
                  value={prepTime}
                  onChange={(e) => setPrepTime(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cookTime">Cook Time (min)</Label>
                <Input
                  id="cookTime"
                  type="number"
                  min="0"
                  value={cookTime}
                  onChange={(e) => setCookTime(e.target.value)}
                />
              </div>
            </div>

            {/* Ingredients Section */}
            <div className="space-y-2">
              <Label>Ingredients ({ingredients.length})</Label>
              <div className="space-y-2">
                {ingredients.length > 0 && (
                  <ScrollArea className="h-[120px]">
                    <div className="space-y-1">
                      {ingredients.map((ing, index) => (
                        <div key={index} className="flex items-center gap-2 p-2 bg-accent/50 rounded text-sm">
                          <span className="flex-1">
                            {ing.quantity && `${ing.quantity} `}
                            {ing.unit && `${ing.unit} `}
                            {ing.name}
                          </span>
                          <Badge variant="outline" className="text-xs">{ing.category}</Badge>
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleRemoveIngredient(index)}>
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
                
                <div className="flex gap-2">
                  <Input
                    placeholder="Qty"
                    value={newIngredient.quantity}
                    onChange={(e) => setNewIngredient({ ...newIngredient, quantity: e.target.value })}
                    className="w-16"
                  />
                  <Input
                    placeholder="Unit"
                    value={newIngredient.unit}
                    onChange={(e) => setNewIngredient({ ...newIngredient, unit: e.target.value })}
                    className="w-16"
                  />
                  <Input
                    placeholder="Ingredient name"
                    value={newIngredient.name}
                    onChange={(e) => setNewIngredient({ ...newIngredient, name: e.target.value })}
                    className="flex-1"
                    onKeyDown={(e) => e.key === 'Enter' && handleAddIngredient()}
                  />
                  <Select
                    value={newIngredient.category}
                    onValueChange={(v) => setNewIngredient({ ...newIngredient, category: v })}
                  >
                    <SelectTrigger className="w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ingredientCategories.map((cat) => (
                        <SelectItem key={cat.value} value={cat.value}>
                          {cat.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button onClick={handleAddIngredient} size="icon">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="instructions">Instructions</Label>
              <Textarea
                id="instructions"
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="Step by step instructions..."
                rows={4}
              />
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!name.trim()}>
            Add Recipe
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
