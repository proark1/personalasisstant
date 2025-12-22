import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Footprints,
  Flame,
  Droplets,
  Moon,
  Heart,
  Scale,
  Activity,
  Loader2,
} from 'lucide-react';

interface AddHealthMetricDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (metricType: string, value: number, unit: string, recordedAt?: Date) => Promise<any>;
}

const metricTypes = [
  { id: 'steps', label: 'Steps', unit: 'steps', icon: Footprints },
  { id: 'calories', label: 'Calories Burned', unit: 'kcal', icon: Flame },
  { id: 'water_intake', label: 'Water Intake', unit: 'glasses', icon: Droplets },
  { id: 'sleep_hours', label: 'Sleep', unit: 'hours', icon: Moon },
  { id: 'heart_rate', label: 'Heart Rate', unit: 'bpm', icon: Heart },
  { id: 'weight', label: 'Weight', unit: 'kg', icon: Scale },
  { id: 'active_minutes', label: 'Active Minutes', unit: 'min', icon: Activity },
];

export function AddHealthMetricDialog({ open, onOpenChange, onAdd }: AddHealthMetricDialogProps) {
  const [selectedType, setSelectedType] = useState('steps');
  const [value, setValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const selectedMetric = metricTypes.find(m => m.id === selectedType);
  const Icon = selectedMetric?.icon || Activity;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!value || !selectedMetric) return;

    setIsLoading(true);
    try {
      await onAdd(selectedType, parseFloat(value), selectedMetric.unit);
      setValue('');
      onOpenChange(false);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Health Data</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Metric Type</Label>
            <Select value={selectedType} onValueChange={setSelectedType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {metricTypes.map(metric => {
                  const MetricIcon = metric.icon;
                  return (
                    <SelectItem key={metric.id} value={metric.id}>
                      <div className="flex items-center gap-2">
                        <MetricIcon className="w-4 h-4" />
                        <span>{metric.label}</span>
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Value ({selectedMetric?.unit})</Label>
            <div className="relative">
              <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="number"
                step="any"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={`Enter ${selectedMetric?.label.toLowerCase()}`}
                className="pl-10"
              />
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={isLoading || !value}>
              {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Add
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
