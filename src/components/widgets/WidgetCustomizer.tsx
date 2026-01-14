import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Widget } from '@/hooks/useWidgetLayout';
import { useLanguage } from '@/contexts/LanguageContext';
import { Settings2, GripVertical, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface WidgetCustomizerProps {
  widgets: Widget[];
  onToggle: (widgetId: string) => void;
  onReset: () => void;
}

const WIDGET_ICONS: Record<Widget['type'], string> = {
  weather: '🌤️',
  prayer_times: '🕌',
  tasks_today: '✅',
  streak: '🔥',
  quick_add: '➕',
  upcoming_events: '📅',
  focus_stats: '🎯',
  ai_suggestion: '✨',
  week_glance: '📊',
};

const getWidgetDescriptions = (t: (key: string) => string): Record<Widget['type'], string> => ({
  weather: t('widgets.weather'),
  prayer_times: t('widgets.prayerTimes'),
  tasks_today: t('widgets.tasksToday'),
  streak: t('widgets.streak'),
  quick_add: t('widgets.quickAdd'),
  upcoming_events: t('widgets.upcomingEvents'),
  focus_stats: t('widgets.focusStats'),
  ai_suggestion: t('widgets.aiSuggestion'),
  week_glance: t('widgets.weekGlance'),
});

export function WidgetCustomizer({ widgets, onToggle, onReset }: WidgetCustomizerProps) {
  const [open, setOpen] = useState(false);
  const { t } = useLanguage();
  const WIDGET_DESCRIPTIONS = getWidgetDescriptions(t);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2">
          <Settings2 className="w-4 h-4" />
          {t('widgets.customize')}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            {t('widgets.customizeWidgets')}
            <Button variant="ghost" size="sm" onClick={onReset} className="text-muted-foreground">
              <RotateCcw className="w-4 h-4 mr-1" />
              {t('widgets.reset')}
            </Button>
          </DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-3 pr-4">
            {widgets.map(widget => (
              <div 
                key={widget.id}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-lg border transition-colors",
                  widget.enabled ? "bg-muted/50" : "bg-transparent opacity-60"
                )}
              >
                <GripVertical className="w-4 h-4 text-muted-foreground cursor-move" />
                <span className="text-xl">{WIDGET_ICONS[widget.type]}</span>
                <div className="flex-1 min-w-0">
                  <Label htmlFor={widget.id} className="font-medium cursor-pointer">
                    {widget.title}
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {WIDGET_DESCRIPTIONS[widget.type]}
                  </p>
                </div>
                <Switch 
                  id={widget.id}
                  checked={widget.enabled}
                  onCheckedChange={() => onToggle(widget.id)}
                />
              </div>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
