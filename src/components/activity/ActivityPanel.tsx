import React from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ActivityFeed } from './ActivityFeed';
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
        <div className="mt-6">
          <ActivityFeed activities={activities} loading={loading} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
