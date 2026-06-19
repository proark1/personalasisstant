import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { CalendarIcon, Video, Phone, Users } from "lucide-react";
import { format } from "date-fns";
import { useCallFeatures } from "@/hooks/useCallFeatures";
import { useSpaceMembers } from "@/hooks/useSpaceMembers";
import { cn } from "@/lib/utils";

interface ScheduleCallDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  preselectedParticipant?: string;
}

export function ScheduleCallDialog({
  open,
  onOpenChange,
  userId,
  preselectedParticipant,
}: ScheduleCallDialogProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState<Date>();
  const [time, setTime] = useState("10:00");
  const [duration, setDuration] = useState("30");
  const [callType, setCallType] = useState<"video" | "audio">("video");
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>(
    preselectedParticipant ? [preselectedParticipant] : [],
  );
  const [scheduling, setScheduling] = useState(false);

  const { scheduleCall } = useCallFeatures();
  const { members } = useSpaceMembers(userId);

  const handleSchedule = async () => {
    if (!date || selectedParticipants.length === 0) return;

    setScheduling(true);
    const [hours, minutes] = time.split(":").map(Number);
    const scheduledFor = new Date(date);
    scheduledFor.setHours(hours, minutes, 0, 0);

    await scheduleCall(
      selectedParticipants,
      scheduledFor,
      callType,
      title || undefined,
      description || undefined,
      parseInt(duration),
    );

    setScheduling(false);
    setTitle("");
    setDescription("");
    setDate(undefined);
    setSelectedParticipants([]);
    onOpenChange(false);
  };

  const toggleParticipant = (memberId: string) => {
    setSelectedParticipants((prev) =>
      prev.includes(memberId) ? prev.filter((id) => id !== memberId) : [...prev, memberId],
    );
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarIcon className="w-5 h-5" />
            Schedule Call
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Title (optional)</Label>
            <Input
              placeholder="e.g., Weekly sync"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Description (optional)</Label>
            <Textarea
              placeholder="What's this call about?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label>Participants</Label>
            <ScrollArea className="h-[120px] border rounded-md p-2">
              {members.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No team members available
                </p>
              ) : (
                <div className="space-y-2">
                  {members.map((member) => (
                    <div
                      key={member.member_id}
                      className="flex items-center gap-2 p-2 rounded hover:bg-accent cursor-pointer"
                      onClick={() => toggleParticipant(member.member_id)}
                    >
                      <Checkbox
                        checked={selectedParticipants.includes(member.member_id)}
                        onCheckedChange={() => toggleParticipant(member.member_id)}
                      />
                      <Avatar className="h-6 w-6">
                        <AvatarFallback className="text-xs">
                          {getInitials(member.member_profile?.display_name || "U")}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm">
                        {member.member_profile?.display_name || member.member_email}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
            {selectedParticipants.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {selectedParticipants.length} participant
                {selectedParticipants.length !== 1 ? "s" : ""} selected
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !date && "text-muted-foreground",
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? format(date, "MMM d") : "Pick date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={setDate}
                    disabled={(date) => date < new Date()}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>Time</Label>
              <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Duration</Label>
              <Select value={duration} onValueChange={setDuration}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="15">15 minutes</SelectItem>
                  <SelectItem value="30">30 minutes</SelectItem>
                  <SelectItem value="45">45 minutes</SelectItem>
                  <SelectItem value="60">1 hour</SelectItem>
                  <SelectItem value="90">1.5 hours</SelectItem>
                  <SelectItem value="120">2 hours</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Call Type</Label>
              <Select value={callType} onValueChange={(v) => setCallType(v as "video" | "audio")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="video">
                    <div className="flex items-center gap-2">
                      <Video className="w-4 h-4" />
                      Video
                    </div>
                  </SelectItem>
                  <SelectItem value="audio">
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4" />
                      Audio
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button
            onClick={handleSchedule}
            disabled={!date || selectedParticipants.length === 0 || scheduling}
            className="w-full"
          >
            <Users className="w-4 h-4 mr-2" />
            {scheduling ? "Scheduling..." : "Schedule Call"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
