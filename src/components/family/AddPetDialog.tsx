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

export function AddPetDialog({ open, onOpenChange }: Props) {
  const { addPet } = useFamilyMemoryHome();
  const [name, setName] = useState("");
  const [species, setSpecies] = useState("");
  const [breed, setBreed] = useState("");
  const [vetName, setVetName] = useState("");
  const [vetPhone, setVetPhone] = useState("");
  const [food, setFood] = useState("");
  const [nextVacc, setNextVacc] = useState("");
  const [nextCheckup, setNextCheckup] = useState("");
  const [notes, setNotes] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;
    await addPet({
      name,
      species: species || null,
      breed: breed || null,
      vet_name: vetName || null,
      vet_phone: vetPhone || null,
      food_brand: food || null,
      next_vaccination_date: nextVacc || null,
      next_vet_checkup: nextCheckup || null,
      notes: notes || null,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Pet</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Species</Label>
              <Input
                value={species}
                onChange={(e) => setSpecies(e.target.value)}
                placeholder="Dog, Cat…"
              />
            </div>
            <div className="space-y-2">
              <Label>Breed</Label>
              <Input value={breed} onChange={(e) => setBreed(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Food brand</Label>
              <Input value={food} onChange={(e) => setFood(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Vet name</Label>
              <Input value={vetName} onChange={(e) => setVetName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Vet phone</Label>
              <Input value={vetPhone} onChange={(e) => setVetPhone(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Next vaccination</Label>
              <Input type="date" value={nextVacc} onChange={(e) => setNextVacc(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Next vet checkup</Label>
              <Input
                type="date"
                value={nextCheckup}
                onChange={(e) => setNextCheckup(e.target.value)}
              />
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
            <Button type="submit" disabled={!name}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
