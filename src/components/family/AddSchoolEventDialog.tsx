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
import { useFamilySchool } from "@/hooks/useFamilySchool";
import { useFamilyMembers } from "@/hooks/useFamilyMembers";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const TYPES = [
  "term_start",
  "term_end",
  "holiday",
  "exam",
  "parent_teacher",
  "school_trip",
  "closure",
  "other",
];

export function AddSchoolEventDialog({ open, onOpenChange }: Props) {
  const { addSchoolEvent } = useFamilySchool();
  const { members } = useFamilyMembers();
  const [type, setType] = useState("exam");
  const [title, setTitle] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [memberId, setMemberId] = useState("");
  const [description, setDescription] = useState("");

  const submit = async () => {
    if (!title.trim() || !startDate) return;
    await addSchoolEvent({
      event_type: type,
      title: title.trim(),
      start_date: startDate,
      end_date: endDate || null,
      family_member_id: memberId || null,
      description: description.trim() || null,
    });
    setTitle("");
    setStartDate("");
    setEndDate("");
    setMemberId("");
    setDescription("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add School Event</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t.replace("_", " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>For</Label>
              <Select
                value={memberId || "_all"}
                onValueChange={(v) => setMemberId(v === "_all" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all">All children</SelectItem>
                  {members
                    .filter((m) => m.relationship === "child")
                    .map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Title</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Math exam, Spring break…"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Start date</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>End date (optional)</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!title.trim() || !startDate}>
            Add Event
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
