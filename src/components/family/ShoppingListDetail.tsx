import { useState, useEffect } from "react";
import { useShoppingLists, ShoppingList, ShoppingListItem } from "@/hooks/useShoppingLists";
import { useAuth } from "@/hooks/useAuth";
import { useFamilyMembers } from "@/hooks/useFamilyMembers";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Plus, Trash2, CheckCircle2 } from "lucide-react";

interface ShoppingListDetailProps {
  listId: string;
  onBack: () => void;
}

const itemCategories = [
  { value: "produce", label: "🥬 Produce" },
  { value: "dairy", label: "🥛 Dairy" },
  { value: "meat", label: "🥩 Meat" },
  { value: "bakery", label: "🍞 Bakery" },
  { value: "frozen", label: "🧊 Frozen" },
  { value: "pantry", label: "🥫 Pantry" },
  { value: "beverages", label: "🥤 Beverages" },
  { value: "snacks", label: "🍿 Snacks" },
  { value: "household", label: "🧹 Household" },
  { value: "personal", label: "🧴 Personal Care" },
  { value: "other", label: "📦 Other" },
];

export function ShoppingListDetail({ listId, onBack }: ShoppingListDetailProps) {
  const { fetchListWithItems, addItem, toggleItem, deleteItem, updateList } = useShoppingLists();
  const { members } = useFamilyMembers();
  const [list, setList] = useState<ShoppingList | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [newItemName, setNewItemName] = useState("");
  const [newItemCategory, setNewItemCategory] = useState("other");
  const [newItemQuantity, setNewItemQuantity] = useState("1");

  const { user } = useAuth();

  const loadList = async () => {
    if (!user?.id) return;
    setIsLoading(true);
    const data = await fetchListWithItems(listId);
    setList(data);
    setIsLoading(false);
  };

  useEffect(() => {
    loadList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listId, user?.id]);

  const handleAddItem = async () => {
    if (!newItemName.trim()) return;

    await addItem(listId, {
      name: newItemName.trim(),
      quantity: parseInt(newItemQuantity) || 1,
      unit: null,
      category: newItemCategory,
      is_checked: false,
      notes: null,
      added_by: null,
    });

    setNewItemName("");
    setNewItemQuantity("1");
    setNewItemCategory("other");
    loadList();
  };

  const handleToggleItem = async (item: ShoppingListItem) => {
    await toggleItem(item.id, !item.is_checked);
    loadList();
  };

  const handleDeleteItem = async (itemId: string) => {
    await deleteItem(itemId);
    loadList();
  };

  const handleMarkComplete = async () => {
    if (list) {
      await updateList(list.id, { is_completed: true });
      onBack();
    }
  };

  const getMemberName = (id: string | null) => {
    if (!id) return null;
    return members.find((m) => m.id === id)?.name || "Unknown";
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!list) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">List not found</p>
        <Button onClick={onBack} variant="outline" className="mt-4">
          Go Back
        </Button>
      </div>
    );
  }

  const groupedItems = (list.items || []).reduce(
    (acc, item) => {
      const cat = item.category || "other";
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(item);
      return acc;
    },
    {} as Record<string, ShoppingListItem[]>,
  );

  const checkedCount = (list.items || []).filter((i) => i.is_checked).length;
  const totalCount = (list.items || []).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h2 className="text-xl font-semibold">{list.name}</h2>
            {list.assigned_to && (
              <p className="text-sm text-muted-foreground">
                Assigned to {getMemberName(list.assigned_to)}
              </p>
            )}
          </div>
        </div>
        {totalCount > 0 && (
          <div className="flex items-center gap-3">
            <Badge variant="outline">
              {checkedCount}/{totalCount} items
            </Badge>
            {checkedCount === totalCount && (
              <Button onClick={handleMarkComplete} size="sm">
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Mark Complete
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Add Item Form */}
      <Card className="p-4">
        <div className="flex gap-2">
          <Input
            placeholder="Add item..."
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddItem()}
            className="flex-1"
          />
          <Input
            type="number"
            min="1"
            value={newItemQuantity}
            onChange={(e) => setNewItemQuantity(e.target.value)}
            className="w-16"
          />
          <Select value={newItemCategory} onValueChange={setNewItemCategory}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {itemCategories.map((cat) => (
                <SelectItem key={cat.value} value={cat.value}>
                  {cat.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={handleAddItem} disabled={!newItemName.trim()}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </Card>

      {/* Items List by Category */}
      {Object.keys(groupedItems).length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">No items yet. Add your first item above!</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {itemCategories.map((cat) => {
            const items = groupedItems[cat.value];
            if (!items || items.length === 0) return null;

            return (
              <div key={cat.value}>
                <h3 className="text-sm font-medium text-muted-foreground mb-2">{cat.label}</h3>
                <Card className="divide-y divide-border">
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 p-3 hover:bg-accent/50 transition-colors"
                    >
                      <Checkbox
                        checked={item.is_checked}
                        onCheckedChange={() => handleToggleItem(item)}
                      />
                      <span
                        className={`flex-1 ${
                          item.is_checked ? "line-through text-muted-foreground" : ""
                        }`}
                      >
                        {item.quantity > 1 && (
                          <span className="text-muted-foreground mr-1">{item.quantity}x</span>
                        )}
                        {item.name}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteItem(item.id)}
                        className="h-8 w-8"
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                      </Button>
                    </div>
                  ))}
                </Card>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
