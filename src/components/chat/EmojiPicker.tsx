import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Smile } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmojiPickerProps {
  onEmojiSelect: (emoji: string) => void;
  disabled?: boolean;
}

const EMOJI_CATEGORIES = [
  {
    name: "Smileys",
    emojis: [
      "😀",
      "😃",
      "😄",
      "😁",
      "😅",
      "😂",
      "🤣",
      "😊",
      "😇",
      "🙂",
      "😉",
      "😍",
      "🥰",
      "😘",
      "😋",
      "😜",
      "🤪",
      "😎",
      "🤩",
      "🥳",
    ],
  },
  {
    name: "Gestures",
    emojis: [
      "👍",
      "👎",
      "👌",
      "✌️",
      "🤞",
      "🤟",
      "🤘",
      "👏",
      "🙌",
      "👐",
      "🤝",
      "🙏",
      "💪",
      "🫶",
      "❤️",
      "🧡",
      "💛",
      "💚",
      "💙",
      "💜",
    ],
  },
  {
    name: "Objects",
    emojis: [
      "🎉",
      "🎊",
      "🎁",
      "🎈",
      "✨",
      "🔥",
      "💯",
      "⭐",
      "🌟",
      "💫",
      "🎯",
      "🏆",
      "🥇",
      "📌",
      "💡",
      "📝",
      "✅",
      "❌",
      "⏰",
      "📅",
    ],
  },
  {
    name: "Faces",
    emojis: [
      "😢",
      "😭",
      "😤",
      "😠",
      "🤬",
      "😈",
      "💀",
      "☠️",
      "🤡",
      "👻",
      "👽",
      "🤖",
      "😺",
      "😸",
      "😹",
      "😻",
      "🙀",
      "😿",
      "😾",
      "🐱",
    ],
  },
];

export function EmojiPicker({ onEmojiSelect, disabled }: EmojiPickerProps) {
  const [open, setOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState(0);

  const handleEmojiClick = (emoji: string) => {
    onEmojiSelect(emoji);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={disabled}
          className="flex-shrink-0 hover:bg-primary/10 hover:text-primary"
          aria-label="Add emoji"
        >
          <Smile className="w-4 h-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-2" align="start" side="top">
        <div className="flex gap-1 mb-2 border-b pb-2">
          {EMOJI_CATEGORIES.map((category, idx) => (
            <button
              key={category.name}
              onClick={() => setActiveCategory(idx)}
              className={cn(
                "text-xs px-2 py-1 rounded transition-colors",
                activeCategory === idx ? "bg-primary text-primary-foreground" : "hover:bg-muted",
              )}
            >
              {category.name}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-10 gap-1">
          {EMOJI_CATEGORIES[activeCategory].emojis.map((emoji) => (
            <button
              key={emoji}
              onClick={() => handleEmojiClick(emoji)}
              className="w-6 h-6 flex items-center justify-center text-lg hover:bg-muted rounded transition-colors"
            >
              {emoji}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
