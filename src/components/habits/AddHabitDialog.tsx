import { useState } from 'react';
import { useHabits } from '@/hooks/useHabits';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

interface AddHabitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
}

const HABIT_ICONS = ['✓', '💪', '📚', '🏃', '🧘', '💊', '💧', '🍎', '😴', '🎯', '✨', '🌟'];
const HABIT_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

export function AddHabitDialog({ open, onOpenChange, userId }: AddHabitDialogProps) {
  const { t } = useLanguage();
  const { createHabit } = useHabits(userId);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('✓');
  const [color, setColor] = useState('#3b82f6');
  const [frequency, setFrequency] = useState<'daily' | 'weekly' | 'custom'>('daily');
  const [targetCount, setTargetCount] = useState(1);
  const [daysOfWeek, setDaysOfWeek] = useState<string[]>(['0', '1', '2', '3', '4', '5', '6']);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) return;

    setSaving(true);
    await createHabit({
      name: name.trim(),
      description: description.trim() || null,
      icon,
      color,
      frequency,
      targetCount,
      daysOfWeek: daysOfWeek.map(Number),
      reminderTime: null,
      isActive: true,
    });
    setSaving(false);
    
    // Reset form
    setName('');
    setDescription('');
    setIcon('✓');
    setColor('#3b82f6');
    setFrequency('daily');
    setTargetCount(1);
    setDaysOfWeek(['0', '1', '2', '3', '4', '5', '6']);
    onOpenChange(false);
  };

  const DAYS = [
    t('weekday.sun'), t('weekday.mon'), t('weekday.tue'), t('weekday.wed'),
    t('weekday.thu'), t('weekday.fri'), t('weekday.sat')
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('addHabit.title')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="name">{t('addHabit.habitName')}</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('addHabit.habitNamePlaceholder')}
            />
          </div>

          <div>
            <Label htmlFor="description">{t('addHabit.description')}</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('addHabit.descriptionPlaceholder')}
              rows={2}
            />
          </div>

          <div>
            <Label>{t('addHabit.icon')}</Label>
            <div className="flex flex-wrap gap-2 mt-1">
              {HABIT_ICONS.map((i) => (
                <Button
                  key={i}
                  variant={icon === i ? 'default' : 'outline'}
                  size="icon"
                  className="h-9 w-9 text-lg"
                  onClick={() => setIcon(i)}
                >
                  {i}
                </Button>
              ))}
            </div>
          </div>

          <div>
            <Label>{t('addHabit.color')}</Label>
            <div className="flex flex-wrap gap-2 mt-1">
              {HABIT_COLORS.map((c) => (
                <button
                  key={c}
                  className="h-8 w-8 rounded-full border-2 transition-transform hover:scale-110"
                  style={{ 
                    backgroundColor: c,
                    borderColor: color === c ? 'white' : 'transparent',
                    boxShadow: color === c ? '0 0 0 2px hsl(var(--primary))' : 'none'
                  }}
                  onClick={() => setColor(c)}
                />
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>{t('addHabit.frequency')}</Label>
              <Select value={frequency} onValueChange={(v) => setFrequency(v as 'daily' | 'weekly' | 'custom')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">{t('addHabit.daily')}</SelectItem>
                  <SelectItem value="weekly">{t('addHabit.weekly')}</SelectItem>
                  <SelectItem value="custom">{t('addHabit.custom')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>{t('addHabit.targetPerDay')}</Label>
              <Input
                type="number"
                min={1}
                max={100}
                value={targetCount}
                onChange={(e) => setTargetCount(parseInt(e.target.value) || 1)}
              />
            </div>
          </div>

          {frequency === 'custom' && (
            <div>
              <Label>{t('addHabit.daysOfWeek')}</Label>
              <ToggleGroup 
                type="multiple" 
                value={daysOfWeek}
                onValueChange={setDaysOfWeek}
                className="justify-start mt-1"
              >
                {DAYS.map((day, i) => (
                  <ToggleGroupItem key={i} value={String(i)} size="sm">
                    {day}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleSave} disabled={!name.trim() || saving}>
              {saving ? t('addHabit.creating') : t('addHabit.createHabit')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
