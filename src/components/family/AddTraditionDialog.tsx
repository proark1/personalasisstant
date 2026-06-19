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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useFamilyMemoryHome } from "@/hooks/useFamilyMemoryHome";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function AddTraditionDialog({ open, onOpenChange }: Props) {
  const { addTradition } = useFamilyMemoryHome();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [cadence, setCadence] = useState("annual");
  const [nextOccurrence, setNextOccurrence] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title) return;
    await addTradition({
      title,
      description: description || null,
      cadence,
      next_occurrence: nextOccurrence || null,
      is_active: true,
    });
    setTitle("");
    setDescription("");
    setNextOccurrence("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Family Tradition</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-2">
            <Label>Title *</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Friday pizza night"
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Cadence</Label>
            <Select value={cadence} onValueChange={setCadence}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="annual">Annual</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Next occurrence</Label>
            <Input
              type="date"
              value={nextOccurrence}
              onChange={(e) => setNextOccurrence(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!title}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
