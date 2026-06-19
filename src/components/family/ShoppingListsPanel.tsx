import { useState } from "react";
import { useShoppingLists, ShoppingList } from "@/hooks/useShoppingLists";
import { useFamilyMembers } from "@/hooks/useFamilyMembers";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, ShoppingCart, FileText, CheckCircle2, Trash2, Copy, Calendar } from "lucide-react";
import { format } from "date-fns";
import { AddShoppingListDialog } from "./AddShoppingListDialog";
import { ShoppingListDetail } from "./ShoppingListDetail";

const categoryColors: Record<string, string> = {
  grocery: "bg-green-500/20 text-green-700 dark:text-green-400",
  household: "bg-blue-500/20 text-blue-700 dark:text-blue-400",
  pharmacy: "bg-red-500/20 text-red-700 dark:text-red-400",
  clothing: "bg-purple-500/20 text-purple-700 dark:text-purple-400",
  electronics: "bg-yellow-500/20 text-yellow-700 dark:text-yellow-400",
  other: "bg-muted text-muted-foreground",
};

export function ShoppingListsPanel() {
  const {
    isLoading,
    deleteList,
    createFromTemplate,
    getActiveLists,
    getTemplates,
    getCompletedLists,
  } = useShoppingLists();
  const { members } = useFamilyMembers();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedList, setSelectedList] = useState<ShoppingList | null>(null);
  const [activeTab, setActiveTab] = useState<"active" | "templates" | "completed">("active");

  const getMemberName = (id: string | null) => {
    if (!id) return null;
    return members.find((m) => m.id === id)?.name || "Unknown";
  };

  const handleCreateFromTemplate = async (template: ShoppingList) => {
    const newList = await createFromTemplate(
      template.id,
      `${template.name} - ${format(new Date(), "MMM d")}`,
    );
    if (newList) {
      setSelectedList(newList);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (selectedList) {
    return <ShoppingListDetail listId={selectedList.id} onBack={() => setSelectedList(null)} />;
  }

  const displayLists =
    activeTab === "active"
      ? getActiveLists()
      : activeTab === "templates"
        ? getTemplates()
        : getCompletedLists();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <Button
            variant={activeTab === "active" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTab("active")}
          >
            <ShoppingCart className="h-4 w-4 mr-2" />
            Active
          </Button>
          <Button
            variant={activeTab === "templates" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTab("templates")}
          >
            <FileText className="h-4 w-4 mr-2" />
            Templates
          </Button>
          <Button
            variant={activeTab === "completed" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTab("completed")}
          >
            <CheckCircle2 className="h-4 w-4 mr-2" />
            Completed
          </Button>
        </div>
        <Button onClick={() => setShowAddDialog(true)} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          New List
        </Button>
      </div>

      {displayLists.length === 0 ? (
        <Card className="p-8 text-center">
          <ShoppingCart className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">
            {activeTab === "active" && "No active shopping lists"}
            {activeTab === "templates" && "No templates yet"}
            {activeTab === "completed" && "No completed lists"}
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            {activeTab === "templates"
              ? "Create a template to quickly generate shopping lists"
              : "Create a new shopping list to get started"}
          </p>
          <Button onClick={() => setShowAddDialog(true)} variant="outline">
            <Plus className="h-4 w-4 mr-2" />
            Create {activeTab === "templates" ? "Template" : "List"}
          </Button>
        </Card>
      ) : (
        <div className="grid gap-3">
          {displayLists.map((list) => (
            <Card
              key={list.id}
              className="p-4 cursor-pointer hover:bg-accent/50 transition-colors"
              onClick={() => !list.is_template && setSelectedList(list)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-medium">{list.name}</h3>
                    <Badge className={categoryColors[list.category] || categoryColors.other}>
                      {list.category}
                    </Badge>
                    {list.is_template && <Badge variant="outline">Template</Badge>}
                  </div>
                  {list.description && (
                    <p className="text-sm text-muted-foreground mb-2">{list.description}</p>
                  )}
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    {list.assigned_to && (
                      <span>Assigned to: {getMemberName(list.assigned_to)}</span>
                    )}
                    {list.due_date && (
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(list.due_date), "MMM d")}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {list.is_template && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCreateFromTemplate(list);
                      }}
                    >
                      <Copy className="h-4 w-4 mr-1" />
                      Use
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteList(list.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <AddShoppingListDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        isTemplate={activeTab === "templates"}
      />
    </div>
  );
}
