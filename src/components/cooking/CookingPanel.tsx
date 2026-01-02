import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Utensils, BookOpen } from 'lucide-react';
import { MealPlanningPanel } from '@/components/family/MealPlanningPanel';
import { useLanguage } from '@/contexts/LanguageContext';

export function CookingPanel() {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState('planner');

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-border">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Utensils className="h-5 w-5 text-primary" />
          Cooking & Food
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Plan your meals and manage recipes
        </p>
      </div>

      <div 
        className="flex-1 min-h-0 overflow-y-auto overscroll-contain"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        <div className="p-4 pb-8">
          <MealPlanningPanel />
        </div>
      </div>
    </div>
  );
}