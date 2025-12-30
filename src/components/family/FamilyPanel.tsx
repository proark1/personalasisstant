import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, ListTodo, ShoppingCart, Utensils, Heart, FolderOpen, Wallet } from 'lucide-react';
import { HouseholdTasksList } from './HouseholdTasksList';
import { ShoppingListsPanel } from './ShoppingListsPanel';
import { MealPlanningPanel } from './MealPlanningPanel';
import { HealthTrackingPanel } from './HealthTrackingPanel';
import { DocumentStoragePanel } from './DocumentStoragePanel';
import { BudgetTrackingPanel } from './BudgetTrackingPanel';
import { useLanguage } from '@/contexts/LanguageContext';

export function FamilyPanel() {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState('tasks');

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-border">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          {t('family.title')}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          {t('family.subtitle')}
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 min-h-0 flex flex-col">
        <div className="mx-4 mt-4 overflow-x-auto scrollbar-hide flex-shrink-0">
          <TabsList className="inline-flex min-w-max gap-1">
            <TabsTrigger value="tasks" className="p-2">
              <ListTodo className="h-5 w-5" />
            </TabsTrigger>
            <TabsTrigger value="meals" className="p-2">
              <Utensils className="h-5 w-5" />
            </TabsTrigger>
            <TabsTrigger value="shopping" className="p-2">
              <ShoppingCart className="h-5 w-5" />
            </TabsTrigger>
            <TabsTrigger value="budget" className="p-2">
              <Wallet className="h-5 w-5" />
            </TabsTrigger>
            <TabsTrigger value="health" className="p-2">
              <Heart className="h-5 w-5" />
            </TabsTrigger>
            <TabsTrigger value="docs" className="p-2">
              <FolderOpen className="h-5 w-5" />
            </TabsTrigger>
          </TabsList>
        </div>

        <div 
          className="flex-1 min-h-0 overflow-y-auto overscroll-contain"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          <div className="p-4 pb-8">
            <TabsContent value="tasks" className="mt-0">
              <HouseholdTasksList />
            </TabsContent>
            <TabsContent value="meals" className="mt-0">
              <MealPlanningPanel />
            </TabsContent>
            <TabsContent value="shopping" className="mt-0">
              <ShoppingListsPanel />
            </TabsContent>
            <TabsContent value="budget" className="mt-0">
              <BudgetTrackingPanel />
            </TabsContent>
            <TabsContent value="health" className="mt-0">
              <HealthTrackingPanel />
            </TabsContent>
            <TabsContent value="docs" className="mt-0">
              <DocumentStoragePanel />
            </TabsContent>
          </div>
        </div>
      </Tabs>
    </div>
  );
}
