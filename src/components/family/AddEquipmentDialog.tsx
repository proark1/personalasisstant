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
import { Switch } from "@/components/ui/switch";
import { useFamilySchool } from "@/hooks/useFamilySchool";
import { useFamilyMembers } from "@/hooks/useFamilyMembers";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}
const CATEGORIES = ["clothing", "shoes", "sports", "school", "electronics", "toys", "other"];

export function AddEquipmentDialog({ open, onOpenChange }: Props) {
  const { addEquipment } = useFamilySchool();
  const { members } = useFamilyMembers();
  const [name, setName] = useState("");
  const [category, setCategory] = useState("clothing");
  const [size, setSize] = useState("");
  const [brand, setBrand] = useState("");
  const [memberId, setMemberId] = useState("");
  const [needs, setNeeds] = useState(false);
  const [reason, setReason] = useState("");

  const submit = async () => {
    if (!name.trim()) return;
    await addEquipment({
      item_name: name.trim(),
      category,
      size: size || null,
      brand: brand || null,
      family_member_id: memberId || null,
      needs_replacement: needs,
      replacement_reason: needs ? reason || "outgrown" : null,
      condition: "good",
    });
    setName("");
    setSize("");
    setBrand("");
    setMemberId("");
    setNeeds(false);
    setReason("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Equipment</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Item</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Football boots, winter jacket…"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>For</Label>
              <Select
                value={memberId || "_me"}
                onValueChange={(v) => setMemberId(v === "_me" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_me">Me</SelectItem>
                  {members.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Size</Label>
              <Input
                value={size}
                onChange={(e) => setSize(e.target.value)}
                placeholder="32, M, EU 38…"
              />
            </div>
            <div className="space-y-2">
              <Label>Brand</Label>
              <Input value={brand} onChange={(e) => setBrand(e.target.value)} />
            </div>
          </div>
          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <Label>Needs replacement</Label>
              <p className="text-xs text-muted-foreground">Outgrown / worn out</p>
            </div>
            <Switch checked={needs} onCheckedChange={setNeeds} />
          </div>
          {needs && (
            <div className="space-y-2">
              <Label>Reason</Label>
              <Input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Outgrown, worn out…"
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!name.trim()}>
            Add
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
