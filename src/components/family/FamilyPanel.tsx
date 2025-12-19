import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, ListTodo, Calendar, Baby, ShoppingCart } from 'lucide-react';
import { FamilyMembersList } from './FamilyMembersList';
import { HouseholdTasksList } from './HouseholdTasksList';
import { FamilyCalendarView } from './FamilyCalendarView';
import { ChildDashboard } from './ChildDashboard';
import { ShoppingListsPanel } from './ShoppingListsPanel';

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
        <TabsList className="mx-4 mt-4 grid grid-cols-5">
          <TabsTrigger value="members" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Members</span>
          </TabsTrigger>
          <TabsTrigger value="children" className="flex items-center gap-2">
            <Baby className="h-4 w-4" />
            <span className="hidden sm:inline">Children</span>
          </TabsTrigger>
          <TabsTrigger value="tasks" className="flex items-center gap-2">
            <ListTodo className="h-4 w-4" />
            <span className="hidden sm:inline">Tasks</span>
          </TabsTrigger>
          <TabsTrigger value="shopping" className="flex items-center gap-2">
            <ShoppingCart className="h-4 w-4" />
            <span className="hidden sm:inline">Shopping</span>
          </TabsTrigger>
          <TabsTrigger value="calendar" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            <span className="hidden sm:inline">Calendar</span>
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
          <TabsContent value="shopping" className="mt-0 h-full">
            <ShoppingListsPanel />
          </TabsContent>
          <TabsContent value="calendar" className="mt-0 h-full">
            <FamilyCalendarView />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
