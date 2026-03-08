import { Utensils } from 'lucide-react';
import { MealPlanningPanel } from '@/components/family/MealPlanningPanel';
import { useLanguage } from '@/contexts/LanguageContext';
import { PanelShell } from '@/components/ui/panel-shell';

export function CookingPanel() {
  const { t } = useLanguage();

  return (
    <PanelShell
      icon={Utensils}
      title={t('cooking.title')}
      subtitle={t('cooking.subtitle')}
    >
      <MealPlanningPanel />
    </PanelShell>
  );
}
