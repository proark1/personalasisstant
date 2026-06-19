import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { useMealPlanning, Recipe } from "@/hooks/useMealPlanning";
import { GlassCard } from "@/components/ui/glass-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { Clock, Users, Trash2, BookOpen, Search } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { RecipeDetailDialog } from "@/components/family/RecipeDetailDialog";
import { cn } from "@/lib/utils";

const staggerContainer = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const staggerItem = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } },
};

const categories = [
  { value: "all", label: "All", labelDe: "Alle" },
  { value: "breakfast", label: "Breakfast", labelDe: "Frühstück" },
  { value: "main", label: "Main", labelDe: "Hauptgericht" },
  { value: "side", label: "Side", labelDe: "Beilage" },
  { value: "soup", label: "Soup", labelDe: "Suppe" },
  { value: "salad", label: "Salad", labelDe: "Salat" },
  { value: "dessert", label: "Dessert", labelDe: "Dessert" },
  { value: "snack", label: "Snack", labelDe: "Snack" },
  { value: "drink", label: "Drink", labelDe: "Getränk" },
];

const categoryColors: Record<string, string> = {
  breakfast: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/20",
  main: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/20",
  side: "bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/20",
  soup: "bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/20",
  salad: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
  dessert: "bg-pink-500/15 text-pink-700 dark:text-pink-400 border-pink-500/20",
  snack: "bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/20",
  drink: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-400 border-cyan-500/20",
};

export function EnhancedRecipesList() {
  const { language } = useLanguage();
  const { recipes, deleteRecipe } = useMealPlanning();
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [viewRecipeId, setViewRecipeId] = useState<string | null>(null);
  const [showRecipeDetail, setShowRecipeDetail] = useState(false);

  const filtered = useMemo(() => {
    return recipes.filter((r) => {
      const matchesCategory = activeCategory === "all" || r.category === activeCategory;
      const matchesSearch =
        !search ||
        r.name.toLowerCase().includes(search.toLowerCase()) ||
        r.description?.toLowerCase().includes(search.toLowerCase()) ||
        r.category.toLowerCase().includes(search.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [recipes, search, activeCategory]);

  const handleView = (recipe: Recipe) => {
    setViewRecipeId(recipe.id);
    setShowRecipeDetail(true);
  };

  if (recipes.length === 0) {
    return (
      <EmptyState
        icon={BookOpen}
        title={language === "de" ? "Keine Rezepte" : "No recipes yet"}
        description={
          language === "de"
            ? "Füge Rezepte hinzu, um Mahlzeiten zu planen"
            : "Add recipes to start planning meals"
        }
      />
    );
  }

  return (
    <div className="space-y-3">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={language === "de" ? "Rezepte suchen..." : "Search recipes..."}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 h-10"
        />
      </div>

      {/* Category Chips */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
        {categories.map((cat) => (
          <button
            key={cat.value}
            onClick={() => setActiveCategory(cat.value)}
            className={cn(
              "shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all",
              activeCategory === cat.value
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-muted/60 text-muted-foreground hover:bg-muted",
            )}
          >
            {language === "de" ? cat.labelDe : cat.label}
          </button>
        ))}
      </div>

      {/* Recipe List */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={Search}
          title={language === "de" ? "Keine Treffer" : "No matches"}
          description={
            language === "de" ? "Versuche andere Suchbegriffe" : "Try different search terms"
          }
        />
      ) : (
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="show"
          className="space-y-2"
        >
          {filtered.map((recipe) => {
            const totalTime = (recipe.prep_time_minutes || 0) + (recipe.cook_time_minutes || 0);

            return (
              <motion.div key={recipe.id} variants={staggerItem}>
                <GlassCard
                  pressable
                  haptic="light"
                  className="p-3.5"
                  onClick={() => handleView(recipe)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-sm truncate">{recipe.name}</h3>
                        <Badge
                          className={cn(
                            "text-[10px] px-1.5 border",
                            categoryColors[recipe.category] || "bg-muted",
                          )}
                        >
                          {recipe.category}
                        </Badge>
                      </div>
                      {recipe.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2 mb-1.5">
                          {recipe.description}
                        </p>
                      )}
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {recipe.servings}
                        </span>
                        {totalTime > 0 && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {totalTime} min
                          </span>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteRecipe(recipe.id);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </GlassCard>
              </motion.div>
            );
          })}
        </motion.div>
      )}

      <RecipeDetailDialog
        open={showRecipeDetail}
        onOpenChange={setShowRecipeDetail}
        recipeId={viewRecipeId}
      />
    </div>
  );
}
