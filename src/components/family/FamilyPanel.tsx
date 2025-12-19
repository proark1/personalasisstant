import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, ListTodo, Calendar, Baby, ShoppingCart, Utensils, Heart } from 'lucide-react';
import { FamilyMembersList } from './FamilyMembersList';
import { HouseholdTasksList } from './HouseholdTasksList';
import { FamilyCalendarView } from './FamilyCalendarView';
import { ChildDashboard } from './ChildDashboard';
import { ShoppingListsPanel } from './ShoppingListsPanel';
import { MealPlanningPanel } from './MealPlanningPanel';
import { HealthTrackingPanel } from './HealthTrackingPanel';

export function FamilyPanel() {
  const [activeTab, setActiveTab] = useState('members');

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-border">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          Family Hub
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your family, household tasks, and events
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <TabsList className="mx-4 mt-4 grid grid-cols-7">
          <TabsTrigger value="members" className="flex items-center gap-1">
            <Users className="h-4 w-4" />
            <span className="hidden xl:inline">Members</span>
          </TabsTrigger>
          <TabsTrigger value="children" className="flex items-center gap-1">
            <Baby className="h-4 w-4" />
            <span className="hidden xl:inline">Children</span>
          </TabsTrigger>
          <TabsTrigger value="tasks" className="flex items-center gap-1">
            <ListTodo className="h-4 w-4" />
            <span className="hidden xl:inline">Tasks</span>
          </TabsTrigger>
          <TabsTrigger value="meals" className="flex items-center gap-1">
            <Utensils className="h-4 w-4" />
            <span className="hidden xl:inline">Meals</span>
          </TabsTrigger>
          <TabsTrigger value="shopping" className="flex items-center gap-1">
            <ShoppingCart className="h-4 w-4" />
            <span className="hidden xl:inline">Shopping</span>
          </TabsTrigger>
          <TabsTrigger value="health" className="flex items-center gap-1">
            <Heart className="h-4 w-4" />
            <span className="hidden xl:inline">Health</span>
          </TabsTrigger>
          <TabsTrigger value="calendar" className="flex items-center gap-1">
            <Calendar className="h-4 w-4" />
            <span className="hidden xl:inline">Calendar</span>
          </TabsTrigger>
        </TabsList>

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
          <TabsContent value="health" className="mt-0 h-full">
            <HealthTrackingPanel />
          </TabsContent>
          <TabsContent value="calendar" className="mt-0 h-full">
            <FamilyCalendarView />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
