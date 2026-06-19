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
import { useFamilyMemoryHome } from "@/hooks/useFamilyMemoryHome";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function AddVehicleDialog({ open, onOpenChange }: Props) {
  const { addVehicle } = useFamilyMemoryHome();
  const [nickname, setNickname] = useState("");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState("");
  const [plate, setPlate] = useState("");
  const [mileage, setMileage] = useState("");
  const [inspection, setInspection] = useState("");
  const [insurance, setInsurance] = useState("");
  const [insuranceRenew, setInsuranceRenew] = useState("");
  const [service, setService] = useState("");
  const [tires, setTires] = useState("");
  const [notes, setNotes] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nickname) return;
    await addVehicle({
      nickname,
      make: make || null,
      model: model || null,
      year: year ? parseInt(year) : null,
      license_plate: plate || null,
      current_mileage: mileage ? parseInt(mileage) : null,
      next_inspection_date: inspection || null,
      insurance_provider: insurance || null,
      insurance_renewal_date: insuranceRenew || null,
      next_service_date: service || null,
      next_tire_change_date: tires || null,
      notes: notes || null,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Vehicle</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-2">
            <Label>Nickname *</Label>
            <Input
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="My Tesla"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Make</Label>
              <Input value={make} onChange={(e) => setMake(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Model</Label>
              <Input value={model} onChange={(e) => setModel(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Year</Label>
              <Input type="number" value={year} onChange={(e) => setYear(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Plate</Label>
              <Input value={plate} onChange={(e) => setPlate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Mileage (km)</Label>
              <Input type="number" value={mileage} onChange={(e) => setMileage(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Next inspection</Label>
              <Input
                type="date"
                value={inspection}
                onChange={(e) => setInspection(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Insurance provider</Label>
              <Input value={insurance} onChange={(e) => setInsurance(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Insurance renewal</Label>
              <Input
                type="date"
                value={insuranceRenew}
                onChange={(e) => setInsuranceRenew(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Next service</Label>
              <Input type="date" value={service} onChange={(e) => setService(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Next tire change</Label>
              <Input type="date" value={tires} onChange={(e) => setTires(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!nickname}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
