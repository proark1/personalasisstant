import { useState } from 'react';
import { Utensils, CalendarDays, BookOpen, Plus } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { PanelShell } from '@/components/ui/panel-shell';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { TodayMealsView } from './TodayMealsView';
import { WeekPlannerView } from './WeekPlannerView';
import { EnhancedRecipesList } from './EnhancedRecipesList';
import { AddRecipeDialog } from '@/components/family/AddRecipeDialog';

export function CookingPanel() {
  const { language } = useLanguage();
  const [activeTab, setActiveTab] = useState<'today' | 'week' | 'recipes'>('today');
  const [showAddRecipe, setShowAddRecipe] = useState(false);

  return (
    <PanelShell
      icon={Utensils}
      title={language === 'de' ? 'Kochen' : 'Cooking'}
      subtitle={language === 'de' ? 'Mahlzeiten planen & Rezepte' : 'Plan meals & discover recipes'}
    >
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'today' | 'week' | 'recipes')}>
        <div className="flex items-center justify-between gap-2 mb-3">
          <TabsList className="bg-muted/50 flex-1">
            <TabsTrigger value="today" className="flex-1 gap-1.5 text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Utensils className="h-3.5 w-3.5" />
              {language === 'de' ? 'Heute' : 'Today'}
            </TabsTrigger>
            <TabsTrigger value="week" className="flex-1 gap-1.5 text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <CalendarDays className="h-3.5 w-3.5" />
              {language === 'de' ? 'Woche' : 'Week'}
            </TabsTrigger>
            <TabsTrigger value="recipes" className="flex-1 gap-1.5 text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <BookOpen className="h-3.5 w-3.5" />
              {language === 'de' ? 'Rezepte' : 'Recipes'}
            </TabsTrigger>
          </TabsList>

          {activeTab === 'recipes' && (
            <Button size="sm" onClick={() => setShowAddRecipe(true)} className="gap-1.5 shrink-0">
              <Plus className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{language === 'de' ? 'Rezept' : 'Recipe'}</span>
            </Button>
          )}
        </div>

        <TabsContent value="today" className="mt-0">
          <TodayMealsView />
        </TabsContent>

        <TabsContent value="week" className="mt-0">
          <WeekPlannerView />
        </TabsContent>

        <TabsContent value="recipes" className="mt-0">
          <EnhancedRecipesList />
        </TabsContent>
      </Tabs>

      <AddRecipeDialog open={showAddRecipe} onOpenChange={setShowAddRecipe} />
    </PanelShell>
  );
}
