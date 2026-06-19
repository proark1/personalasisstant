import { useState } from "react";
import { Plus, X, Tag as TagIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tag } from "@/hooks/useTags";

interface TagManagerProps {
  tags: Tag[];
  selectedTags: Tag[];
  onCreateTag: (name: string, color: string) => Promise<Tag | null>;
  onDeleteTag: (tagId: string) => Promise<boolean>;
  onAddTag: (tagId: string) => void;
  onRemoveTag: (tagId: string) => void;
}

const TAG_COLORS = [
  "#3b82f6", // blue
  "#10b981", // green
  "#f59e0b", // amber
  "#ef4444", // red
  "#8b5cf6", // purple
  "#ec4899", // pink
  "#06b6d4", // cyan
  "#f97316", // orange
];

export function TagManager({
  tags,
  selectedTags,
  onCreateTag,
  onDeleteTag: _onDeleteTag,
  onAddTag,
  onRemoveTag,
}: TagManagerProps) {
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState(TAG_COLORS[0]);
  const [isCreating, setIsCreating] = useState(false);

  const availableTags = tags.filter((t) => !selectedTags.some((st) => st.id === t.id));

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return;

    setIsCreating(true);
    const tag = await onCreateTag(newTagName.trim(), newTagColor);
    if (tag) {
      onAddTag(tag.id);
      setNewTagName("");
    }
    setIsCreating(false);
  };

  return (
    <div className="space-y-2">
      {/* Selected Tags */}
      <div className="flex flex-wrap gap-1">
        {selectedTags.map((tag) => (
          <Badge
            key={tag.id}
            variant="outline"
            className="flex items-center gap-1 text-xs"
            style={{ borderColor: tag.color, color: tag.color }}
          >
            <TagIcon className="h-3 w-3" />
            {tag.name}
            <button onClick={() => onRemoveTag(tag.id)} className="ml-1 hover:opacity-70">
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}

        {/* Add Tag Popover */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="h-6 px-2 text-xs">
              <Plus className="h-3 w-3 mr-1" />
              Add Tag
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-3" align="start">
            <div className="space-y-3">
              {/* Existing Tags */}
              {availableTags.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Existing Tags</p>
                  <div className="flex flex-wrap gap-1">
                    {availableTags.map((tag) => (
                      <Badge
                        key={tag.id}
                        variant="outline"
                        className="cursor-pointer hover:opacity-80 text-xs"
                        style={{ borderColor: tag.color, color: tag.color }}
                        onClick={() => onAddTag(tag.id)}
                      >
                        <TagIcon className="h-3 w-3 mr-1" />
                        {tag.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Create New Tag */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Create New</p>
                <div className="flex gap-2">
                  <Input
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                    placeholder="Tag name"
                    className="h-8 text-sm"
                    onKeyDown={(e) => e.key === "Enter" && handleCreateTag()}
                  />
                </div>
                <div className="flex gap-1">
                  {TAG_COLORS.map((color) => (
                    <button
                      key={color}
                      className={`w-5 h-5 rounded-full border-2 ${
                        newTagColor === color ? "border-foreground" : "border-transparent"
                      }`}
                      style={{ backgroundColor: color }}
                      onClick={() => setNewTagColor(color)}
                    />
                  ))}
                </div>
                <Button
                  size="sm"
                  className="w-full h-7 text-xs"
                  onClick={handleCreateTag}
                  disabled={!newTagName.trim() || isCreating}
                >
                  Create Tag
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
