import { Tag as TagIcon, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tag } from "@/hooks/useTags";

interface TagFilterProps {
  tags: Tag[];
  selectedTagIds: string[];
  onToggleTag: (tagId: string) => void;
  onClearFilters: () => void;
}

export function TagFilter({ tags, selectedTagIds, onToggleTag, onClearFilters }: TagFilterProps) {
  if (tags.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <TagIcon className="h-3 w-3" />
          <span>Filter by Tags</span>
        </div>
        {selectedTagIds.length > 0 && (
          <Button variant="ghost" size="sm" className="h-5 px-1 text-xs" onClick={onClearFilters}>
            Clear
          </Button>
        )}
      </div>
      <ScrollArea className="w-full">
        <div className="flex flex-wrap gap-1 pb-1">
          {tags.map((tag) => {
            const isSelected = selectedTagIds.includes(tag.id);
            return (
              <Badge
                key={tag.id}
                variant={isSelected ? "default" : "outline"}
                className="cursor-pointer text-xs transition-colors"
                style={{
                  borderColor: tag.color,
                  color: isSelected ? "white" : tag.color,
                  backgroundColor: isSelected ? tag.color : "transparent",
                }}
                onClick={() => onToggleTag(tag.id)}
              >
                <TagIcon className="h-3 w-3 mr-1" />
                {tag.name}
                {isSelected && <X className="h-3 w-3 ml-1" />}
              </Badge>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
