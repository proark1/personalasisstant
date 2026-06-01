import React from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ActivityFeed } from './ActivityFeed';
import { DoriActivityLog } from './DoriActivityLog';
import { Activity } from 'lucide-react';
import type { ActivityItem } from '@/hooks/useActivityFeed';

interface ActivityPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activities: ActivityItem[];
  loading: boolean;
}

export function ActivityPanel({ open, onOpenChange, activities, loading }: ActivityPanelProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[400px] sm:w-[540px]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Activity Feed
          </SheetTitle>
        </SheetHeader>
        <Tabs defaultValue="activity" className="mt-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="activity">Activity</TabsTrigger>
            <TabsTrigger value="dori">Dori</TabsTrigger>
          </TabsList>
          <TabsContent value="activity" className="mt-4">
            <ActivityFeed activities={activities} loading={loading} />
          </TabsContent>
          <TabsContent value="dori" className="mt-4">
            <DoriActivityLog />
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
