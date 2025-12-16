import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { Repeat, X, CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { recurrencePresets, getRecurrenceDescription, toRRuleString, parseRRuleString } from '@/lib/recurrence';
import { RecurrenceFrequency } from '@/types/flux';

interface RecurrenceSelectorProps {
  value?: string;
  onChange: (value: string | undefined) => void;
  className?: string;
}

const WEEKDAYS = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 0, label: 'Sun' },
];

export function RecurrenceSelector({ value, onChange, className }: RecurrenceSelectorProps) {
  const [open, setOpen] = useState(false);
  const [customMode, setCustomMode] = useState(false);
  const [frequency, setFrequency] = useState<RecurrenceFrequency>('weekly');
  const [interval, setInterval] = useState(1);
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [endDate, setEndDate] = useState<Date | undefined>();

  const handlePresetSelect = (preset: string) => {
    onChange(preset);
    setOpen(false);
  };

  const handleClear = () => {
    onChange(undefined);
    setOpen(false);
  };

  const handleCustomApply = () => {
    const rule = toRRuleString({
      frequency,
      interval,
      daysOfWeek: frequency === 'weekly' ? selectedDays : undefined,
      endDate,
    });
    onChange(rule);
    setOpen(false);
  };

  const toggleDay = (day: number) => {
    setSelectedDays(prev => 
      prev.includes(day) 
        ? prev.filter(d => d !== day)
        : [...prev, day]
    );
  };

  const description = value ? getRecurrenceDescription(value) : null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant={value ? 'secondary' : 'outline'}
          size="sm"
          className={cn('gap-1.5', className)}
        >
          <Repeat className="w-3.5 h-3.5" />
          {description || 'Repeat'}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        {!customMode ? (
          <div className="p-2">
            <div className="grid gap-1">
              {value && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={handleClear}
                >
                  <X className="w-4 h-4 mr-2" />
                  Don't repeat
                </Button>
              )}
              {recurrencePresets.map((preset) => (
                <Button
                  key={preset.value}
                  variant={value === preset.value ? 'secondary' : 'ghost'}
                  size="sm"
                  className="justify-start"
                  onClick={() => handlePresetSelect(preset.value)}
                >
                  {preset.label}
                </Button>
              ))}
              <div className="border-t border-border my-1" />
              <Button
                variant="ghost"
                size="sm"
                className="justify-start"
                onClick={() => setCustomMode(true)}
              >
                Custom...
              </Button>
            </div>
          </div>
        ) : (
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-sm">Custom Recurrence</h4>
              <Button variant="ghost" size="sm" onClick={() => setCustomMode(false)}>
                Back
              </Button>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Label className="text-sm w-16">Every</Label>
                <Select 
                  value={interval.toString()} 
                  onValueChange={(v) => setInterval(parseInt(v))}
                >
                  <SelectTrigger className="w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5, 6].map(n => (
                      <SelectItem key={n} value={n.toString()}>{n}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select 
                  value={frequency} 
                  onValueChange={(v) => setFrequency(v as RecurrenceFrequency)}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Day(s)</SelectItem>
                    <SelectItem value="weekly">Week(s)</SelectItem>
                    <SelectItem value="monthly">Month(s)</SelectItem>
                    <SelectItem value="yearly">Year(s)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {frequency === 'weekly' && (
                <div>
                  <Label className="text-sm mb-2 block">On days</Label>
                  <div className="flex gap-1">
                    {WEEKDAYS.map(day => (
                      <Button
                        key={day.value}
                        variant={selectedDays.includes(day.value) ? 'default' : 'outline'}
                        size="sm"
                        className="w-9 h-9 p-0 text-xs"
                        onClick={() => toggleDay(day.value)}
                      >
                        {day.label[0]}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <Label className="text-sm mb-2 block">Ends</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start">
                      <CalendarIcon className="w-4 h-4 mr-2" />
                      {endDate ? format(endDate, 'PPP') : 'Never'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={endDate}
                      onSelect={setEndDate}
                      disabled={(date) => date < new Date()}
                      className="pointer-events-auto"
                    />
                    {endDate && (
                      <div className="p-2 border-t">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="w-full"
                          onClick={() => setEndDate(undefined)}
                        >
                          Clear end date
                        </Button>
                      </div>
                    )}
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <Button className="w-full" onClick={handleCustomApply}>
              Apply
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
