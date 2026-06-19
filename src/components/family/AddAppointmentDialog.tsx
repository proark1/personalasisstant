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
import { useHealthTracking } from "@/hooks/useHealthTracking";
import { useFamilyMembers } from "@/hooks/useFamilyMembers";

interface AddAppointmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const appointmentTypes = [
  { value: "checkup", label: "Check-up" },
  { value: "dental", label: "Dental" },
  { value: "specialist", label: "Specialist" },
  { value: "therapy", label: "Therapy" },
  { value: "vaccination", label: "Vaccination" },
  { value: "other", label: "Other" },
];

export function AddAppointmentDialog({ open, onOpenChange }: AddAppointmentDialogProps) {
  const { addAppointment } = useHealthTracking();
  const { members } = useFamilyMembers();
  const [title, setTitle] = useState("");
  const [appointmentType, setAppointmentType] = useState("checkup");
  const [memberId, setMemberId] = useState<string>("");
  const [providerName, setProviderName] = useState("");
  const [providerPhone, setProviderPhone] = useState("");
  const [location, setLocation] = useState("");
  const [appointmentDate, setAppointmentDate] = useState("");
  const [appointmentTime, setAppointmentTime] = useState("");
  const [notes, setNotes] = useState("");

  const handleSubmit = async () => {
    if (!title.trim() || !appointmentDate || !appointmentTime) return;

    const dateTime = new Date(`${appointmentDate}T${appointmentTime}`);

    await addAppointment({
      title: title.trim(),
      appointment_type: appointmentType,
      family_member_id: memberId || null,
      provider_name: providerName.trim() || null,
      provider_phone: providerPhone.trim() || null,
      location: location.trim() || null,
      appointment_date: dateTime.toISOString(),
      reminder_before: 60,
      notes: notes.trim() || null,
      is_completed: false,
    });

    resetForm();
    onOpenChange(false);
  };

  const resetForm = () => {
    setTitle("");
    setAppointmentType("checkup");
    setMemberId("");
    setProviderName("");
    setProviderPhone("");
    setLocation("");
    setAppointmentDate("");
    setAppointmentTime("");
    setNotes("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Schedule Appointment</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="title">Appointment Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Annual check-up"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="type">Type</Label>
              <Select value={appointmentType} onValueChange={setAppointmentType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {appointmentTypes.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="member">For</Label>
            <Select value={memberId} onValueChange={setMemberId}>
              <SelectTrigger>
                <SelectValue placeholder="Select person" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Me</SelectItem>
                {members.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="date"
                value={appointmentDate}
                onChange={(e) => setAppointmentDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="time">Time</Label>
              <Input
                id="time"
                type="time"
                value={appointmentTime}
                onChange={(e) => setAppointmentTime(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="provider">Provider/Doctor</Label>
              <Input
                id="provider"
                value={providerName}
                onChange={(e) => setProviderName(e.target.value)}
                placeholder="Doctor name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={providerPhone}
                onChange={(e) => setProviderPhone(e.target.value)}
                placeholder="Contact number"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="location">Location</Label>
            <Input
              id="location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Clinic or hospital address"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional notes..."
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!title.trim() || !appointmentDate || !appointmentTime}
          >
            Schedule
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
