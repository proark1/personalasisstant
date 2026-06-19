import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  ShoppingCart,
  Plus,
  Users,
  Apple,
  Milk,
  Beef,
  Croissant,
  Sparkles,
  Check,
} from "lucide-react";
import { Project } from "@/types/flux";

interface Contact {
  userId: string;
  email?: string;
  displayName?: string;
}

interface FamilyShoppingTemplateProps {
  onCreateProject: (
    project: Omit<Project, "id" | "createdAt" | "updatedAt">,
  ) => Promise<Project | null>;
  onShareProject: (projectId: string, email: string) => Promise<{ error: string | null }>;
  onAddTask: (task: {
    title: string;
    projectId: string;
    category: "personal";
    priority: "medium";
  }) => void;
  contacts: Contact[];
}

// Common shopping categories with preset items
const SHOPPING_CATEGORIES = [
  {
    name: "Produce",
    icon: Apple,
    color: "text-green-500",
    items: ["Bananas", "Apples", "Oranges", "Lettuce", "Tomatoes", "Onions", "Potatoes", "Carrots"],
  },
  {
    name: "Dairy",
    icon: Milk,
    color: "text-blue-400",
    items: ["Milk", "Eggs", "Butter", "Cheese", "Yogurt", "Cream"],
  },
  {
    name: "Meat",
    icon: Beef,
    color: "text-red-400",
    items: ["Chicken breast", "Ground beef", "Bacon", "Pork chops", "Salmon"],
  },
  {
    name: "Bakery",
    icon: Croissant,
    color: "text-amber-500",
    items: ["Bread", "Bagels", "Croissants", "Tortillas", "Muffins"],
  },
];

export function FamilyShoppingTemplate({
  onCreateProject,
  onShareProject,
  onAddTask,
  contacts,
}: FamilyShoppingTemplateProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"name" | "items" | "share">("name");
  const [projectName, setProjectName] = useState("Family Shopping");
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [customItem, setCustomItem] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [createdProjectId, setCreatedProjectId] = useState<string | null>(null);

  const handleToggleItem = (item: string) => {
    setSelectedItems((prev) =>
      prev.includes(item) ? prev.filter((i) => i !== item) : [...prev, item],
    );
  };

  const handleAddCustomItem = () => {
    if (customItem.trim() && !selectedItems.includes(customItem.trim())) {
      setSelectedItems((prev) => [...prev, customItem.trim()]);
      setCustomItem("");
    }
  };

  const handleToggleContact = (userId: string) => {
    setSelectedContacts((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
    );
  };

  const handleCreateProject = async () => {
    setIsCreating(true);

    // Create the project
    const project = await onCreateProject({
      name: projectName,
      description: "Shared family shopping list",
      color: "#22c55e", // Green for shopping
      isArchived: false,
    });

    if (!project) {
      toast.error("Failed to create shopping list");
      setIsCreating(false);
      return;
    }

    setCreatedProjectId(project.id);

    // Add selected items as tasks
    for (const item of selectedItems) {
      onAddTask({
        title: item,
        projectId: project.id,
        category: "personal",
        priority: "medium",
      });
    }

    setStep("share");
    setIsCreating(false);
  };

  const handleShareWithFamily = async () => {
    if (!createdProjectId) return;

    setIsCreating(true);
    let sharedCount = 0;

    for (const contactId of selectedContacts) {
      const contact = contacts.find((c) => c.userId === contactId);
      if (contact?.email) {
        const { error } = await onShareProject(createdProjectId, contact.email);
        if (!error) sharedCount++;
      }
    }

    if (sharedCount > 0) {
      toast.success(
        `Shopping list shared with ${sharedCount} family member${sharedCount > 1 ? "s" : ""}!`,
      );
    }

    setIsCreating(false);
    handleClose();
  };

  const handleClose = () => {
    setOpen(false);
    setStep("name");
    setProjectName("Family Shopping");
    setSelectedItems([]);
    setSelectedContacts([]);
    setCustomItem("");
    setCreatedProjectId(null);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : handleClose())}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <ShoppingCart className="w-4 h-4" />
          Family Shopping
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-green-500" />
            {step === "name" && "Create Shopping List"}
            {step === "items" && "Add Items"}
            {step === "share" && "Share with Family"}
          </DialogTitle>
          <DialogDescription>
            {step === "name" && "Name your shared shopping list"}
            {step === "items" && "Select items to add to your list"}
            {step === "share" && "Invite family members to collaborate"}
          </DialogDescription>
        </DialogHeader>

        {step === "name" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>List Name</Label>
              <Input
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="e.g., Weekly Groceries"
              />
            </div>
            <Button
              onClick={() => setStep("items")}
              className="w-full"
              disabled={!projectName.trim()}
            >
              Next: Add Items
            </Button>
          </div>
        )}

        {step === "items" && (
          <div className="space-y-4">
            <ScrollArea className="h-[300px] pr-4">
              <div className="space-y-4">
                {SHOPPING_CATEGORIES.map((category) => (
                  <div key={category.name} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <category.icon className={`w-4 h-4 ${category.color}`} />
                      <span className="font-medium text-sm">{category.name}</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {category.items.map((item) => (
                        <Badge
                          key={item}
                          variant={selectedItems.includes(item) ? "default" : "outline"}
                          className="cursor-pointer transition-all"
                          onClick={() => handleToggleItem(item)}
                        >
                          {selectedItems.includes(item) && <Check className="w-3 h-3 mr-1" />}
                          {item}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}

                {/* Custom items */}
                {selectedItems.filter(
                  (item) => !SHOPPING_CATEGORIES.flatMap((c) => c.items).includes(item),
                ).length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-purple-500" />
                      <span className="font-medium text-sm">Custom Items</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {selectedItems
                        .filter(
                          (item) => !SHOPPING_CATEGORIES.flatMap((c) => c.items).includes(item),
                        )
                        .map((item) => (
                          <Badge
                            key={item}
                            variant="default"
                            className="cursor-pointer"
                            onClick={() => handleToggleItem(item)}
                          >
                            <Check className="w-3 h-3 mr-1" />
                            {item}
                          </Badge>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>

            <div className="flex gap-2">
              <Input
                value={customItem}
                onChange={(e) => setCustomItem(e.target.value)}
                placeholder="Add custom item..."
                onKeyDown={(e) => e.key === "Enter" && handleAddCustomItem()}
              />
              <Button variant="outline" size="icon" onClick={handleAddCustomItem}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>

            <div className="text-sm text-muted-foreground">
              {selectedItems.length} items selected
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep("name")} className="flex-1">
                Back
              </Button>
              <Button onClick={handleCreateProject} className="flex-1" disabled={isCreating}>
                {isCreating ? "Creating..." : "Create List"}
              </Button>
            </div>
          </div>
        )}

        {step === "share" && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 p-3 bg-green-500/10 rounded-lg border border-green-500/20">
              <Check className="w-5 h-5 text-green-500" />
              <span className="text-sm">
                Shopping list created with {selectedItems.length} items!
              </span>
            </div>

            {contacts.length > 0 ? (
              <>
                <div className="space-y-2">
                  <Label>Select family members to share with</Label>
                  <div className="space-y-2">
                    {contacts.map((contact) => (
                      <Card
                        key={contact.userId}
                        className={`cursor-pointer transition-all ${
                          selectedContacts.includes(contact.userId)
                            ? "border-primary bg-primary/5"
                            : ""
                        }`}
                        onClick={() => handleToggleContact(contact.userId)}
                      >
                        <CardContent className="p-3 flex items-center gap-3">
                          <Checkbox
                            checked={selectedContacts.includes(contact.userId)}
                            onCheckedChange={() => handleToggleContact(contact.userId)}
                          />
                          <Users className="w-4 h-4 text-muted-foreground" />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">
                              {contact.displayName || contact.email}
                            </p>
                            {contact.displayName && contact.email && (
                              <p className="text-xs text-muted-foreground truncate">
                                {contact.email}
                              </p>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" onClick={handleClose} className="flex-1">
                    Skip
                  </Button>
                  <Button
                    onClick={handleShareWithFamily}
                    className="flex-1"
                    disabled={selectedContacts.length === 0 || isCreating}
                  >
                    {isCreating ? "Sharing..." : `Share with ${selectedContacts.length}`}
                  </Button>
                </div>
              </>
            ) : (
              <div className="text-center py-4 space-y-3">
                <Users className="w-8 h-8 text-muted-foreground mx-auto" />
                <p className="text-sm text-muted-foreground">
                  No contacts yet. Add family members in Contacts to share lists with them.
                </p>
                <Button onClick={handleClose} className="w-full">
                  Done
                </Button>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
