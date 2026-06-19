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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useFamilyMembers, FamilyMember, Activity, Milestone } from "@/hooks/useFamilyMembers";
import { Plus, X } from "lucide-react";
import { format } from "date-fns";

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

interface EditFamilyMemberDialogProps {
  member: FamilyMember;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditFamilyMemberDialog({
  member,
  open,
  onOpenChange,
}: EditFamilyMemberDialogProps) {
  const { updateMember } = useFamilyMembers();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState("basic");

  const [formData, setFormData] = useState({
    name: member.name,
    relationship: member.relationship,
    birth_date: member.birth_date || "",
    phone: member.phone || "",
    email: member.email || "",
    notes: member.notes || "",
    lives_with_user: member.lives_with_user,
    address: member.address || "",
    attends_kindergarten: member.attends_kindergarten || false,
    attends_school: member.attends_school || false,
    kindergarten_name: member.kindergarten_name || "",
    kindergarten_teacher_name: member.kindergarten_teacher_name || "",
    kindergarten_teacher_contact: member.kindergarten_teacher_contact || "",
    school_name: member.school_name || "",
    school_grade: member.school_grade || "",
    teacher_name: member.teacher_name || "",
    teacher_contact: member.teacher_contact || "",
    allergies: member.allergies || [],
    medical_notes: member.medical_notes || "",
    activities: member.activities || [],
    milestones: member.milestones || [],
  });

  const [newActivity, setNewActivity] = useState({ name: "", schedule: "", location: "" });
  const [newMilestone, setNewMilestone] = useState({ date: "", title: "", notes: "" });
  const [newAllergy, setNewAllergy] = useState("");

  useEffect(() => {
    setFormData({
      name: member.name,
      relationship: member.relationship,
      birth_date: member.birth_date || "",
      phone: member.phone || "",
      email: member.email || "",
      notes: member.notes || "",
      lives_with_user: member.lives_with_user,
      address: member.address || "",
      attends_kindergarten: member.attends_kindergarten || false,
      attends_school: member.attends_school || false,
      kindergarten_name: member.kindergarten_name || "",
      kindergarten_teacher_name: member.kindergarten_teacher_name || "",
      kindergarten_teacher_contact: member.kindergarten_teacher_contact || "",
      school_name: member.school_name || "",
      school_grade: member.school_grade || "",
      teacher_name: member.teacher_name || "",
      teacher_contact: member.teacher_contact || "",
      allergies: member.allergies || [],
      medical_notes: member.medical_notes || "",
      activities: member.activities || [],
      milestones: member.milestones || [],
    });
  }, [member]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    await updateMember(member.id, {
      ...formData,
      birth_date: formData.birth_date || null,
      phone: formData.phone || null,
      email: formData.email || null,
      notes: formData.notes || null,
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
      medical_notes: formData.medical_notes || null,
    });

    setIsSubmitting(false);
    onOpenChange(false);
  };

  const addActivity = () => {
    if (newActivity.name) {
      setFormData((prev) => ({
        ...prev,
        activities: [...prev.activities, newActivity as Activity],
      }));
      setNewActivity({ name: "", schedule: "", location: "" });
    }
  };

  const removeActivity = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      activities: prev.activities.filter((_, i) => i !== index),
    }));
  };

  const addMilestone = () => {
    if (newMilestone.title && newMilestone.date) {
      setFormData((prev) => ({
        ...prev,
        milestones: [...prev.milestones, newMilestone as Milestone],
      }));
      setNewMilestone({ date: "", title: "", notes: "" });
    }
  };

  const removeMilestone = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      milestones: prev.milestones.filter((_, i) => i !== index),
    }));
  };

  const addAllergy = () => {
    if (newAllergy && !formData.allergies.includes(newAllergy)) {
      setFormData((prev) => ({
        ...prev,
        allergies: [...prev.allergies, newAllergy],
      }));
      setNewAllergy("");
    }
  };

  const removeAllergy = (allergy: string) => {
    setFormData((prev) => ({
      ...prev,
      allergies: prev.allergies.filter((a) => a !== allergy),
    }));
  };

  const isChild = formData.relationship === "child" || formData.relationship === "grandchild";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit {member.name}</DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="basic">Basic</TabsTrigger>
            <TabsTrigger value="school" disabled={!isChild}>
              School
            </TabsTrigger>
            <TabsTrigger value="activities">Activities</TabsTrigger>
            <TabsTrigger value="health">Health</TabsTrigger>
          </TabsList>

          <form onSubmit={handleSubmit}>
            <TabsContent value="basic" className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="relationship">Relationship *</Label>
                  <Select
                    value={formData.relationship}
                    onValueChange={(value) =>
                      setFormData((prev) => ({ ...prev, relationship: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
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

                <div className="space-y-2">
                  <Label htmlFor="birth_date">Birth Date</Label>
                  <Input
                    id="birth_date"
                    type="date"
                    value={formData.birth_date}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, birth_date: e.target.value }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value }))}
                  />
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
                  />
                </div>
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
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                  rows={3}
                />
              </div>
            </TabsContent>

            <TabsContent value="school" className="space-y-4">
              {/* Kindergarten Section */}
              <div className="flex items-center justify-between">
                <Label htmlFor="edit_attends_kindergarten">Attends Kindergarten</Label>
                <Switch
                  id="edit_attends_kindergarten"
                  checked={formData.attends_kindergarten}
                  onCheckedChange={(checked) =>
                    setFormData((prev) => ({ ...prev, attends_kindergarten: checked }))
                  }
                />
              </div>

              {formData.attends_kindergarten && (
                <div className="grid gap-4 sm:grid-cols-2 pl-4 border-l-2 border-primary/20">
                  <div className="space-y-2">
                    <Label>Kindergarten Name</Label>
                    <Input
                      value={formData.kindergarten_name}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, kindergarten_name: e.target.value }))
                      }
                      placeholder="Kindergarten name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Teacher Name</Label>
                    <Input
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
                    <Label>Teacher Contact</Label>
                    <Input
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
              <div className="flex items-center justify-between">
                <Label htmlFor="edit_attends_school">Attends School</Label>
                <Switch
                  id="edit_attends_school"
                  checked={formData.attends_school}
                  onCheckedChange={(checked) =>
                    setFormData((prev) => ({ ...prev, attends_school: checked }))
                  }
                />
              </div>

              {formData.attends_school && (
                <div className="grid gap-4 sm:grid-cols-2 pl-4 border-l-2 border-primary/20">
                  <div className="space-y-2">
                    <Label>School Name</Label>
                    <Input
                      value={formData.school_name}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, school_name: e.target.value }))
                      }
                      placeholder="School name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Grade/Class</Label>
                    <Input
                      value={formData.school_grade}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, school_grade: e.target.value }))
                      }
                      placeholder="e.g., 3rd Grade"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Teacher Name</Label>
                    <Input
                      value={formData.teacher_name}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, teacher_name: e.target.value }))
                      }
                      placeholder="Teacher's name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Teacher Contact</Label>
                    <Input
                      value={formData.teacher_contact}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, teacher_contact: e.target.value }))
                      }
                      placeholder="Email or phone"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-3 border-t pt-4">
                <Label>Milestones</Label>
                {formData.milestones.map((milestone, index) => (
                  <div key={index} className="flex items-center gap-2 p-2 bg-muted rounded">
                    <div className="flex-1">
                      <p className="font-medium text-sm">{milestone.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(milestone.date), "MMM d, yyyy")}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeMilestone(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <div className="grid gap-2 sm:grid-cols-3">
                  <Input
                    type="date"
                    value={newMilestone.date}
                    onChange={(e) => setNewMilestone((prev) => ({ ...prev, date: e.target.value }))}
                    placeholder="Date"
                  />
                  <Input
                    value={newMilestone.title}
                    onChange={(e) =>
                      setNewMilestone((prev) => ({ ...prev, title: e.target.value }))
                    }
                    placeholder="Milestone title"
                  />
                  <Button type="button" variant="outline" onClick={addMilestone}>
                    <Plus className="h-4 w-4 mr-1" />
                    Add
                  </Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="activities" className="space-y-4">
              <div className="space-y-3">
                <Label>Activities</Label>
                {formData.activities.map((activity, index) => (
                  <div key={index} className="flex items-center gap-2 p-2 bg-muted rounded">
                    <div className="flex-1">
                      <p className="font-medium text-sm">{activity.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {activity.schedule} {activity.location && `• ${activity.location}`}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeActivity(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <div className="grid gap-2 sm:grid-cols-4">
                  <Input
                    value={newActivity.name}
                    onChange={(e) => setNewActivity((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="Activity name"
                  />
                  <Input
                    value={newActivity.schedule}
                    onChange={(e) =>
                      setNewActivity((prev) => ({ ...prev, schedule: e.target.value }))
                    }
                    placeholder="Schedule"
                  />
                  <Input
                    value={newActivity.location}
                    onChange={(e) =>
                      setNewActivity((prev) => ({ ...prev, location: e.target.value }))
                    }
                    placeholder="Location"
                  />
                  <Button type="button" variant="outline" onClick={addActivity}>
                    <Plus className="h-4 w-4 mr-1" />
                    Add
                  </Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="health" className="space-y-4">
              <div className="space-y-3">
                <Label>Allergies</Label>
                <div className="flex flex-wrap gap-2">
                  {formData.allergies.map((allergy) => (
                    <span
                      key={allergy}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-destructive/10 text-destructive text-sm rounded"
                    >
                      {allergy}
                      <button type="button" onClick={() => removeAllergy(allergy)}>
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    value={newAllergy}
                    onChange={(e) => setNewAllergy(e.target.value)}
                    placeholder="Add allergy"
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addAllergy())}
                  />
                  <Button type="button" variant="outline" onClick={addAllergy}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Medical Notes</Label>
                <Textarea
                  value={formData.medical_notes}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, medical_notes: e.target.value }))
                  }
                  placeholder="Any medical conditions, medications, or notes..."
                  rows={4}
                />
              </div>
            </TabsContent>

            <DialogFooter className="mt-6">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
