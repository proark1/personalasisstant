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
import { MapPin, Navigation, Loader2 } from "lucide-react";
import { useLocationReminders, CreateLocationTrigger } from "@/hooks/useLocationReminders";

interface AddLocationTriggerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
}

export function AddLocationTriggerDialog({
  open,
  onOpenChange,
  onCreated,
}: AddLocationTriggerDialogProps) {
  const { createTrigger, getCurrentPosition, permissionStatus, requestPermissions } =
    useLocationReminders();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGettingLocation, setIsGettingLocation] = useState(false);

  const [formData, setFormData] = useState<CreateLocationTrigger>({
    name: "",
    latitude: 0,
    longitude: 0,
    radius_meters: 100,
    trigger_type: "exit",
    reminder_message: "",
  });

  const handleUseCurrentLocation = async () => {
    if (permissionStatus !== "granted") {
      await requestPermissions();
    }

    setIsGettingLocation(true);
    const position = await getCurrentPosition();
    setIsGettingLocation(false);

    if (position) {
      setFormData((prev) => ({
        ...prev,
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.reminder_message || formData.latitude === 0) return;

    setIsSubmitting(true);
    const result = await createTrigger(formData);
    setIsSubmitting(false);

    if (result) {
      onOpenChange(false);
      onCreated?.();
      // Reset form
      setFormData({
        name: "",
        latitude: 0,
        longitude: 0,
        radius_meters: 100,
        trigger_type: "exit",
        reminder_message: "",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            Add Location Reminder
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Location Name</Label>
            <Input
              id="name"
              placeholder="e.g., Work, Home, Gym"
              value={formData.name}
              onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Coordinates</Label>
            <div className="flex gap-2">
              <Input
                type="number"
                step="any"
                placeholder="Latitude"
                value={formData.latitude || ""}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, latitude: parseFloat(e.target.value) || 0 }))
                }
                className="flex-1"
              />
              <Input
                type="number"
                step="any"
                placeholder="Longitude"
                value={formData.longitude || ""}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, longitude: parseFloat(e.target.value) || 0 }))
                }
                className="flex-1"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleUseCurrentLocation}
              disabled={isGettingLocation}
              className="w-full mt-2"
            >
              {isGettingLocation ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Navigation className="h-4 w-4 mr-2" />
              )}
              Use Current Location
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="radius">Radius (meters)</Label>
              <Input
                id="radius"
                type="number"
                min={50}
                max={5000}
                value={formData.radius_meters}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    radius_meters: parseInt(e.target.value) || 100,
                  }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="trigger_type">Trigger When</Label>
              <Select
                value={formData.trigger_type}
                onValueChange={(value: "enter" | "exit" | "both") =>
                  setFormData((prev) => ({ ...prev, trigger_type: value }))
                }
              >
                <SelectTrigger id="trigger_type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="exit">I Leave</SelectItem>
                  <SelectItem value="enter">I Arrive</SelectItem>
                  <SelectItem value="both">Both</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">Reminder Message</Label>
            <Textarea
              id="message"
              placeholder="What should I remind you about?"
              value={formData.reminder_message}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, reminder_message: e.target.value }))
              }
              required
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                isSubmitting ||
                !formData.name ||
                !formData.reminder_message ||
                formData.latitude === 0
              }
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Create Reminder
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
