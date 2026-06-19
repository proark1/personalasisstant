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

export function EditSleepScheduleDialog({ open, onOpenChange }: Props) {
  const { sleepSchedules, upsertSleep } = useFamilyDailyLife();
  const { members } = useFamilyMembers();
  const [memberId, setMemberId] = useState("");
  const [bedtime, setBedtime] = useState("");
  const [wakeTime, setWakeTime] = useState("");
  const [napTime, setNapTime] = useState("");
  const [napDur, setNapDur] = useState("");
  const [screenLimit, setScreenLimit] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!memberId) return;
    const e = sleepSchedules.find((s) => s.family_member_id === memberId);
    setBedtime(e?.bedtime?.slice(0, 5) || "");
    setWakeTime(e?.wake_time?.slice(0, 5) || "");
    setNapTime(e?.nap_time?.slice(0, 5) || "");
    setNapDur(e?.nap_duration_minutes?.toString() || "");
    setScreenLimit(e?.screen_time_limit_minutes?.toString() || "");
    setNotes(e?.notes || "");
  }, [memberId, sleepSchedules]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberId) return;
    await upsertSleep({
      family_member_id: memberId,
      bedtime: bedtime || null,
      wake_time: wakeTime || null,
      nap_time: napTime || null,
      nap_duration_minutes: napDur ? parseInt(napDur) : null,
      screen_time_limit_minutes: screenLimit ? parseInt(screenLimit) : null,
      notes: notes || null,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sleep & Screen-time</DialogTitle>
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
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Bedtime</Label>
              <Input type="time" value={bedtime} onChange={(e) => setBedtime(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Wake time</Label>
              <Input type="time" value={wakeTime} onChange={(e) => setWakeTime(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Nap time</Label>
              <Input type="time" value={napTime} onChange={(e) => setNapTime(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Nap duration (min)</Label>
              <Input type="number" value={napDur} onChange={(e) => setNapDur(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Daily screen-time limit (min)</Label>
            <Input
              type="number"
              value={screenLimit}
              onChange={(e) => setScreenLimit(e.target.value)}
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
