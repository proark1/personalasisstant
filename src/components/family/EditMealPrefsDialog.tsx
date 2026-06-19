import { useState, useEffect } from "react";
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
import { useFamilyDailyLife } from "@/hooks/useFamilyDailyLife";
import { useFamilyMembers } from "@/hooks/useFamilyMembers";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const csv = (s: string) =>
  s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

export function EditMealPrefsDialog({ open, onOpenChange }: Props) {
  const { mealPrefs, upsertMealPref } = useFamilyDailyLife();
  const { members } = useFamilyMembers();
  const [memberId, setMemberId] = useState("");
  const [loves, setLoves] = useState("");
  const [dislikes, setDislikes] = useState("");
  const [diet, setDiet] = useState("");
  const [favorites, setFavorites] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!memberId) return;
    const existing = mealPrefs.find((m) => m.family_member_id === memberId);
    setLoves(existing?.loves?.join(", ") || "");
    setDislikes(existing?.dislikes?.join(", ") || "");
    setDiet(existing?.dietary_restrictions?.join(", ") || "");
    setFavorites(existing?.favorite_meals?.join(", ") || "");
    setNotes(existing?.notes || "");
  }, [memberId, mealPrefs]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberId) return;
    await upsertMealPref({
      family_member_id: memberId,
      loves: csv(loves),
      dislikes: csv(dislikes),
      dietary_restrictions: csv(diet),
      favorite_meals: csv(favorites),
      notes: notes || null,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Meal Preferences</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-2">
            <Label>Family member *</Label>
            <Select value={memberId} onValueChange={setMemberId}>
              <SelectTrigger>
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                {members.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Loves (comma-separated)</Label>
            <Input
              value={loves}
              onChange={(e) => setLoves(e.target.value)}
              placeholder="pasta, apples, chicken"
            />
          </div>
          <div className="space-y-2">
            <Label>Dislikes</Label>
            <Input
              value={dislikes}
              onChange={(e) => setDislikes(e.target.value)}
              placeholder="mushrooms, fish"
            />
          </div>
          <div className="space-y-2">
            <Label>Dietary restrictions</Label>
            <Input
              value={diet}
              onChange={(e) => setDiet(e.target.value)}
              placeholder="halal, lactose-free"
            />
          </div>
          <div className="space-y-2">
            <Label>Favorite meals</Label>
            <Input
              value={favorites}
              onChange={(e) => setFavorites(e.target.value)}
              placeholder="biryani, pizza"
            />
          </div>
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!memberId}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
