import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useHouseholdTasks } from "@/hooks/useHouseholdTasks";
import { useFamilyMembers } from "@/hooks/useFamilyMembers";

const categories = [
  { value: "general", label: "General" },
  { value: "cleaning", label: "Cleaning" },
  { value: "cooking", label: "Cooking" },
  { value: "shopping", label: "Shopping" },
  { value: "childcare", label: "Childcare" },
  { value: "maintenance", label: "Maintenance" },
];

const priorities = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

interface AddHouseholdTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddHouseholdTaskDialog({ open, onOpenChange }: AddHouseholdTaskDialogProps) {
  const { addTask } = useHouseholdTasks();
  const { members } = useFamilyMembers();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    category: "general",
    assigned_to: "",
    due_date: "",
    due_time: "",
    priority: "medium",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title) return;

    setIsSubmitting(true);

    let dueDateTime = null;
    if (formData.due_date) {
      const date = new Date(formData.due_date);
      if (formData.due_time) {
        const [hours, minutes] = formData.due_time.split(":");
        date.setHours(parseInt(hours), parseInt(minutes));
      }
      dueDateTime = date.toISOString();
    }

    const result = await addTask({
      title: formData.title,
      description: formData.description || null,
      category: formData.category,
      assigned_to: formData.assigned_to || null,
      due_date: dueDateTime,
      recurrence_rule: null,
      is_completed: false,
      completed_at: null,
      priority: formData.priority,
    });

    setIsSubmitting(false);

    if (result) {
      setFormData({
        title: "",
        description: "",
        category: "general",
        assigned_to: "",
        due_date: "",
        due_time: "",
        priority: "medium",
      });
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Household Task</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Task Title *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
              placeholder="What needs to be done?"
              required
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select
                value={formData.category}
                onValueChange={(value) => setFormData((prev) => ({ ...prev, category: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Priority</Label>
              <Select
                value={formData.priority}
                onValueChange={(value) => setFormData((prev) => ({ ...prev, priority: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {priorities.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Assign To</Label>
            <Select
              value={formData.assigned_to || "_none"}
              onValueChange={(value) =>
                setFormData((prev) => ({ ...prev, assigned_to: value === "_none" ? "" : value }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select family member (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">Unassigned</SelectItem>
                {members.map((member) => (
                  <SelectItem key={member.id} value={member.id}>
                    {member.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Due Date</Label>
              <Input
                type="date"
                value={formData.due_date}
                onChange={(e) => setFormData((prev) => ({ ...prev, due_date: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Due Time</Label>
              <Input
                type="time"
                value={formData.due_time}
                onChange={(e) => setFormData((prev) => ({ ...prev, due_time: e.target.value }))}
                disabled={!formData.due_date}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
              placeholder="Any additional details..."
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !formData.title}>
              {isSubmitting ? "Adding..." : "Add Task"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
