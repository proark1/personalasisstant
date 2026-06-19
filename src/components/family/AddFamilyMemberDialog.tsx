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
import { Switch } from "@/components/ui/switch";
import { useFamilyMembers } from "@/hooks/useFamilyMembers";

const relationships = [
  { value: "spouse", label: "Spouse/Partner" },
  { value: "child", label: "Child" },
  { value: "parent", label: "Parent" },
  { value: "sibling", label: "Sibling" },
  { value: "grandparent", label: "Grandparent" },
  { value: "grandchild", label: "Grandchild" },
  { value: "aunt", label: "Aunt" },
  { value: "uncle", label: "Uncle" },
  { value: "cousin", label: "Cousin" },
  { value: "in-law", label: "In-Law" },
  { value: "other", label: "Other" },
];

interface AddFamilyMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddFamilyMemberDialog({ open, onOpenChange }: AddFamilyMemberDialogProps) {
  const { addMember } = useFamilyMembers();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    relationship: "",
    birth_date: "",
    phone: "",
    email: "",
    notes: "",
    lives_with_user: true,
    address: "",
    // Child-specific fields
    attends_kindergarten: false,
    attends_school: false,
    kindergarten_name: "",
    kindergarten_teacher_name: "",
    kindergarten_teacher_contact: "",
    school_name: "",
    school_grade: "",
    teacher_name: "",
    teacher_contact: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.relationship) return;

    setIsSubmitting(true);

    const result = await addMember({
      name: formData.name,
      relationship: formData.relationship,
      birth_date: formData.birth_date || null,
      phone: formData.phone || null,
      email: formData.email || null,
      notes: formData.notes || null,
      lives_with_user: formData.lives_with_user,
      address: formData.address || null,
      attends_kindergarten: formData.attends_kindergarten,
      attends_school: formData.attends_school,
      kindergarten_name: formData.kindergarten_name || null,
      kindergarten_teacher_name: formData.kindergarten_teacher_name || null,
      kindergarten_teacher_contact: formData.kindergarten_teacher_contact || null,
      school_name: formData.school_name || null,
      school_grade: formData.school_grade || null,
      teacher_name: formData.teacher_name || null,
      teacher_contact: formData.teacher_contact || null,
      avatar_url: null,
      allergies: [],
      medical_notes: null,
      clothing_sizes: {},
      activities: [],
      milestones: [],
      preferences: {},
      is_active: true,
      contact_id: null,
    });

    setIsSubmitting(false);

    if (result) {
      setFormData({
        name: "",
        relationship: "",
        birth_date: "",
        phone: "",
        email: "",
        notes: "",
        lives_with_user: true,
        address: "",
        attends_kindergarten: false,
        attends_school: false,
        kindergarten_name: "",
        kindergarten_teacher_name: "",
        kindergarten_teacher_contact: "",
        school_name: "",
        school_grade: "",
        teacher_name: "",
        teacher_contact: "",
      });
      onOpenChange(false);
    }
  };

  const isChild = formData.relationship === "child" || formData.relationship === "grandchild";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Family Member</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Enter name"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="relationship">Relationship *</Label>
              <Select
                value={formData.relationship}
                onValueChange={(value) => setFormData((prev) => ({ ...prev, relationship: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select relationship" />
                </SelectTrigger>
                <SelectContent>
                  {relationships.map((rel) => (
                    <SelectItem key={rel.value} value={rel.value}>
                      {rel.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="birth_date">Birth Date</Label>
              <Input
                id="birth_date"
                type="date"
                value={formData.birth_date}
                onChange={(e) => setFormData((prev) => ({ ...prev, birth_date: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value }))}
                placeholder="Phone number"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
              placeholder="Email address"
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="lives_with_user">Lives with you</Label>
            <Switch
              id="lives_with_user"
              checked={formData.lives_with_user}
              onCheckedChange={(checked) =>
                setFormData((prev) => ({ ...prev, lives_with_user: checked }))
              }
            />
          </div>

          {!formData.lives_with_user && (
            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => setFormData((prev) => ({ ...prev, address: e.target.value }))}
                placeholder="Their address"
              />
            </div>
          )}

          {isChild && (
            <>
              <div className="border-t pt-4">
                <h4 className="font-medium mb-3">Education</h4>

                {/* Kindergarten Section */}
                <div className="flex items-center justify-between mb-3">
                  <Label htmlFor="attends_kindergarten">Attends Kindergarten</Label>
                  <Switch
                    id="attends_kindergarten"
                    checked={formData.attends_kindergarten}
                    onCheckedChange={(checked) =>
                      setFormData((prev) => ({ ...prev, attends_kindergarten: checked }))
                    }
                  />
                </div>

                {formData.attends_kindergarten && (
                  <div className="grid gap-4 sm:grid-cols-2 mb-4 pl-4 border-l-2 border-primary/20">
                    <div className="space-y-2">
                      <Label htmlFor="kindergarten_name">Kindergarten Name</Label>
                      <Input
                        id="kindergarten_name"
                        value={formData.kindergarten_name}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, kindergarten_name: e.target.value }))
                        }
                        placeholder="Kindergarten name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="kindergarten_teacher_name">Teacher Name</Label>
                      <Input
                        id="kindergarten_teacher_name"
                        value={formData.kindergarten_teacher_name}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            kindergarten_teacher_name: e.target.value,
                          }))
                        }
                        placeholder="Teacher's name"
                      />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="kindergarten_teacher_contact">Teacher Contact</Label>
                      <Input
                        id="kindergarten_teacher_contact"
                        value={formData.kindergarten_teacher_contact}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            kindergarten_teacher_contact: e.target.value,
                          }))
                        }
                        placeholder="Email or phone"
                      />
                    </div>
                  </div>
                )}

                {/* School Section */}
                <div className="flex items-center justify-between mb-3">
                  <Label htmlFor="attends_school">Attends School</Label>
                  <Switch
                    id="attends_school"
                    checked={formData.attends_school}
                    onCheckedChange={(checked) =>
                      setFormData((prev) => ({ ...prev, attends_school: checked }))
                    }
                  />
                </div>

                {formData.attends_school && (
                  <div className="grid gap-4 sm:grid-cols-2 pl-4 border-l-2 border-primary/20">
                    <div className="space-y-2">
                      <Label htmlFor="school_name">School Name</Label>
                      <Input
                        id="school_name"
                        value={formData.school_name}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, school_name: e.target.value }))
                        }
                        placeholder="School name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="school_grade">Grade/Class</Label>
                      <Input
                        id="school_grade"
                        value={formData.school_grade}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, school_grade: e.target.value }))
                        }
                        placeholder="e.g., 3rd Grade"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="teacher_name">Teacher Name</Label>
                      <Input
                        id="teacher_name"
                        value={formData.teacher_name}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, teacher_name: e.target.value }))
                        }
                        placeholder="Teacher's name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="teacher_contact">Teacher Contact</Label>
                      <Input
                        id="teacher_contact"
                        value={formData.teacher_contact}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, teacher_contact: e.target.value }))
                        }
                        placeholder="Email or phone"
                      />
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
              placeholder="Any additional notes..."
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !formData.name || !formData.relationship}
            >
              {isSubmitting ? "Adding..." : "Add Member"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
