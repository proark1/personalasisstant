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
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Users } from "lucide-react";
import { SpaceMember } from "@/hooks/useSpaceMembers";

interface CreateGroupDialogProps {
  isOpen: boolean;
  onClose: () => void;
  members: SpaceMember[];
  onCreateGroup: (name: string, memberIds: string[], description?: string) => Promise<unknown>;
}

export function CreateGroupDialog({
  isOpen,
  onClose,
  members,
  onCreateGroup,
}: CreateGroupDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [isCreating, setIsCreating] = useState(false);

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const toggleMember = (memberId: string) => {
    setSelectedMembers((prev) =>
      prev.includes(memberId) ? prev.filter((id) => id !== memberId) : [...prev, memberId],
    );
  };

  const handleCreate = async () => {
    if (!name.trim() || selectedMembers.length === 0) return;

    setIsCreating(true);
    const result = await onCreateGroup(name, selectedMembers, description);
    setIsCreating(false);

    if (result) {
      setName("");
      setDescription("");
      setSelectedMembers([]);
      onClose();
    }
  };

  const acceptedMembers = members.filter((m) => m.status === "accepted");

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Create Group Chat
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Group Name</Label>
            <Input
              id="name"
              placeholder="Enter group name..."
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea
              id="description"
              placeholder="What's this group about?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label>Select Members ({selectedMembers.length} selected)</Label>
            <ScrollArea className="h-48 border rounded-md p-2">
              <div className="space-y-2">
                {acceptedMembers.map((member) => (
                  <label
                    key={member.id}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer"
                  >
                    <Checkbox
                      checked={selectedMembers.includes(member.member_id)}
                      onCheckedChange={() => toggleMember(member.member_id)}
                    />
                    <Avatar className="w-8 h-8">
                      <AvatarFallback className="text-xs bg-primary/20">
                        {getInitials(member.member_profile?.display_name || member.member_email)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm">
                      {member.member_profile?.display_name || member.member_email}
                    </span>
                  </label>
                ))}
                {acceptedMembers.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No team members available
                  </p>
                )}
              </div>
            </ScrollArea>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={!name.trim() || selectedMembers.length === 0 || isCreating}
          >
            {isCreating ? "Creating..." : "Create Group"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
