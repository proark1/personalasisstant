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
import { useFamilySchool } from "@/hooks/useFamilySchool";
import { useFamilyMembers } from "@/hooks/useFamilyMembers";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}
const DAYS = [
  { v: 1, l: "Monday" },
  { v: 2, l: "Tuesday" },
  { v: 3, l: "Wednesday" },
  { v: 4, l: "Thursday" },
  { v: 5, l: "Friday" },
  { v: 6, l: "Saturday" },
  { v: 0, l: "Sunday" },
];

export function AddPickupRotaDialog({ open, onOpenChange }: Props) {
  const { addRotaEntry } = useFamilySchool();
  const { members } = useFamilyMembers();
  const [memberId, setMemberId] = useState("");
  const [day, setDay] = useState(1);
  const [pickupTime, setPickupTime] = useState("");
  const [dropoffTime, setDropoffTime] = useState("");
  const [person, setPerson] = useState("");
  const [location, setLocation] = useState("");

  const submit = async () => {
    if (!memberId) return;
    await addRotaEntry({
      family_member_id: memberId,
      day_of_week: day,
      pickup_time: pickupTime || null,
      dropoff_time: dropoffTime || null,
      responsible_person: person || null,
      location: location || null,
      notes: null,
      is_active: true,
    });
    setMemberId("");
    setPickupTime("");
    setDropoffTime("");
    setPerson("");
    setLocation("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Pickup/Dropoff</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Child</Label>
              <Select value={memberId} onValueChange={setMemberId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
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
            <div className="space-y-2">
              <Label>Day</Label>
              <Select value={String(day)} onValueChange={(v) => setDay(Number(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DAYS.map((d) => (
                    <SelectItem key={d.v} value={String(d.v)}>
                      {d.l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Dropoff time</Label>
              <Input
                type="time"
                value={dropoffTime}
                onChange={(e) => setDropoffTime(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Pickup time</Label>
              <Input
                type="time"
                value={pickupTime}
                onChange={(e) => setPickupTime(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Responsible person</Label>
            <Input
              value={person}
              onChange={(e) => setPerson(e.target.value)}
              placeholder="Mom, Dad, Grandma…"
            />
          </div>
          <div className="space-y-2">
            <Label>Location</Label>
            <Input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="School, kindergarten…"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!memberId}>
            Add
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
