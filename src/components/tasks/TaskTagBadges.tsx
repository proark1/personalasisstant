import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface Tag {
  id: string;
  name: string;
  color: string;
}

interface TaskTagBadgesProps {
  tags: Tag[];
  onRemove?: (tagId: string) => void;
  size?: "sm" | "md";
  className?: string;
}

export function TaskTagBadges({ tags, onRemove, size = "sm", className }: TaskTagBadgesProps) {
  if (tags.length === 0) return null;

  return (
    <div className={cn("flex items-center gap-1 flex-wrap", className)}>
      {tags.map((tag) => (
        <span
          key={tag.id}
          className={cn(
            "inline-flex items-center gap-1 rounded-full font-medium",
            size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-1 text-xs",
          )}
          style={{
            backgroundColor: `${tag.color}20`,
            color: tag.color,
            borderColor: `${tag.color}40`,
            borderWidth: 1,
          }}
        >
          {tag.name}
          {onRemove && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRemove(tag.id);
              }}
              className="hover:opacity-70"
            >
              <X className={size === "sm" ? "w-2.5 h-2.5" : "w-3 h-3"} />
            </button>
          )}
        </span>
      ))}
    </div>
  );
}
