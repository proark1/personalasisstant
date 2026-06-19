import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { BellOff } from "lucide-react";

interface SnoozeReminderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contractName: string;
  onSnooze: (months: number) => void;
}

const SNOOZE_OPTIONS = [
  { value: 1, label: "1 month" },
  { value: 2, label: "2 months" },
  { value: 3, label: "3 months" },
  { value: 6, label: "6 months" },
  { value: 12, label: "1 year" },
];

export function SnoozeReminderDialog({
  open,
  onOpenChange,
  contractName,
  onSnooze,
}: SnoozeReminderDialogProps) {
  const [selectedMonths, setSelectedMonths] = useState<string>("3");

  const handleSnooze = () => {
    onSnooze(parseInt(selectedMonths));
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BellOff className="h-5 w-5" />
            Snooze Reminder
          </DialogTitle>
          <DialogDescription>
            Don't remind me about cancellation for <strong>{contractName}</strong> for the next:
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <RadioGroup value={selectedMonths} onValueChange={setSelectedMonths}>
            {SNOOZE_OPTIONS.map((option) => (
              <div key={option.value} className="flex items-center space-x-2">
                <RadioGroupItem value={option.value.toString()} id={`snooze-${option.value}`} />
                <Label htmlFor={`snooze-${option.value}`} className="cursor-pointer">
                  {option.label}
                </Label>
              </div>
            ))}
          </RadioGroup>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSnooze}>Snooze Reminders</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
