import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, ListTodo, Calendar, Baby, ShoppingCart, Utensils, Heart, FolderOpen, Wallet } from 'lucide-react';
import { FamilyMembersList } from './FamilyMembersList';
import { HouseholdTasksList } from './HouseholdTasksList';
import { FamilyCalendarView } from './FamilyCalendarView';
import { ChildDashboard } from './ChildDashboard';
import { ShoppingListsPanel } from './ShoppingListsPanel';
import { MealPlanningPanel } from './MealPlanningPanel';
import { HealthTrackingPanel } from './HealthTrackingPanel';
import { DocumentStoragePanel } from './DocumentStoragePanel';
import { BudgetTrackingPanel } from './BudgetTrackingPanel';
import { useLanguage } from '@/contexts/LanguageContext';

export function FamilyPanel() {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState('members');

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

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <div className="mx-4 mt-4 overflow-x-auto scrollbar-hide">
          <TabsList className="inline-flex min-w-max gap-1">
            <TabsTrigger value="members" className="p-2">
              <Users className="h-5 w-5" />
            </TabsTrigger>
            <TabsTrigger value="children" className="p-2">
              <Baby className="h-5 w-5" />
            </TabsTrigger>
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
            <TabsTrigger value="calendar" className="p-2">
              <Calendar className="h-5 w-5" />
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="flex-1 overflow-auto p-4">
          <TabsContent value="members" className="mt-0 h-full">
            <FamilyMembersList />
          </TabsContent>
          <TabsContent value="children" className="mt-0 h-full">
            <ChildDashboard />
          </TabsContent>
          <TabsContent value="tasks" className="mt-0 h-full">
            <HouseholdTasksList />
          </TabsContent>
          <TabsContent value="meals" className="mt-0 h-full">
            <MealPlanningPanel />
          </TabsContent>
          <TabsContent value="shopping" className="mt-0 h-full">
            <ShoppingListsPanel />
          </TabsContent>
          <TabsContent value="budget" className="mt-0 h-full">
            <BudgetTrackingPanel />
          </TabsContent>
          <TabsContent value="health" className="mt-0 h-full">
            <HealthTrackingPanel />
          </TabsContent>
          <TabsContent value="docs" className="mt-0 h-full">
            <DocumentStoragePanel />
          </TabsContent>
          <TabsContent value="calendar" className="mt-0 h-full">
            <FamilyCalendarView />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
