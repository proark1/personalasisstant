import { useState } from "react";
import { useGoals } from "@/hooks/useGoals";
import { useLanguage } from "@/contexts/LanguageContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { de, enUS } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface AddGoalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
}

const GOAL_ICONS = ["🎯", "💪", "📈", "🏆", "💰", "📚", "🏃", "🎨", "💼", "🌟", "🚀", "❤️"];
const GOAL_COLORS = [
  "#10b981",
  "#3b82f6",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
  "#84cc16",
];

export function AddGoalDialog({ open, onOpenChange, userId }: AddGoalDialogProps) {
  const { t, language } = useLanguage();
  const dateLocale = language === "de" ? de : enUS;
  const { createGoal } = useGoals(userId);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("🎯");
  const [color, setColor] = useState("#10b981");
  const [targetValue, setTargetValue] = useState(100);
  const [currentValue, setCurrentValue] = useState(0);
  const [unit, setUnit] = useState("%");
  const [targetDate, setTargetDate] = useState<Date | undefined>();
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) return;

    setSaving(true);
    await createGoal({
      name: name.trim(),
      description: description.trim() || null,
      icon,
      color,
      targetValue,
      currentValue,
      unit,
      targetDate: targetDate || null,
      linkedHabits: [],
    });
    setSaving(false);

    // Reset form
    setName("");
    setDescription("");
    setIcon("🎯");
    setColor("#10b981");
    setTargetValue(100);
    setCurrentValue(0);
    setUnit("%");
    setTargetDate(undefined);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("addGoal.title")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="name">{t("addGoal.goalName")}</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("addGoal.goalNamePlaceholder")}
            />
          </div>

          <div>
            <Label htmlFor="description">{t("addGoal.description")}</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("addGoal.descriptionPlaceholder")}
              rows={2}
            />
          </div>

          <div>
            <Label>{t("addGoal.icon")}</Label>
            <div className="flex flex-wrap gap-2 mt-1">
              {GOAL_ICONS.map((i) => (
                <Button
                  key={i}
                  variant={icon === i ? "default" : "outline"}
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
            <Label>{t("addGoal.color")}</Label>
            <div className="flex flex-wrap gap-2 mt-1">
              {GOAL_COLORS.map((c) => (
                <button
                  key={c}
                  className="h-8 w-8 rounded-full border-2 transition-transform hover:scale-110"
                  style={{
                    backgroundColor: c,
                    borderColor: color === c ? "white" : "transparent",
                    boxShadow: color === c ? "0 0 0 2px hsl(var(--primary))" : "none",
                  }}
                  onClick={() => setColor(c)}
                />
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>{t("addGoal.current")}</Label>
              <Input
                type="number"
                min={0}
                value={currentValue}
                onChange={(e) => setCurrentValue(parseFloat(e.target.value) || 0)}
              />
            </div>

            <div>
              <Label>{t("addGoal.target")}</Label>
              <Input
                type="number"
                min={1}
                value={targetValue}
                onChange={(e) => setTargetValue(parseFloat(e.target.value) || 1)}
              />
            </div>

            <div>
              <Label>{t("addGoal.unit")}</Label>
              <Input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="%" />
            </div>
          </div>

          <div>
            <Label>{t("addGoal.targetDate")}</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal mt-1",
                    !targetDate && "text-muted-foreground",
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {targetDate
                    ? format(targetDate, "PPP", { locale: dateLocale })
                    : t("addGoal.pickDate")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={targetDate}
                  onSelect={setTargetDate}
                  initialFocus
                  locale={dateLocale}
                  disabled={(date) => date < new Date()}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {t("common.cancel")}
            </Button>
            <Button onClick={handleSave} disabled={!name.trim() || saving}>
              {saving ? t("addGoal.creating") : t("addGoal.createGoal")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
