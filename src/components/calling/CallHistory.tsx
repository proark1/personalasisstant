import { useState } from "react";
import { useCallHistory, CallHistoryItem } from "@/hooks/useCallHistory";
import { useCall } from "./CallProvider";
import { CallRecordings } from "./CallRecordings";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Phone,
  Video,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  Clock,
  RefreshCw,
  Disc,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface CallHistoryProps {
  userId: string;
}

export function CallHistory({ userId }: CallHistoryProps) {
  const [activeTab, setActiveTab] = useState<"history" | "recordings">("history");
  const { history, loading, refetch } = useCallHistory(userId);
  const { startVideoCall, startAudioCall } = useCall();

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const getStatusIcon = (item: CallHistoryItem) => {
    if (item.status === "missed" || item.status === "declined") {
      return <PhoneMissed className="w-4 h-4 text-destructive" />;
    }
    if (item.direction === "incoming") {
      return <PhoneIncoming className="w-4 h-4 text-success" />;
    }
    return <PhoneOutgoing className="w-4 h-4 text-primary" />;
  };

  const getStatusLabel = (item: CallHistoryItem) => {
    if (item.status === "missed") {
      return item.direction === "incoming" ? "Missed" : "No answer";
    }
    if (item.status === "declined") {
      return "Declined";
    }
    return item.direction === "incoming" ? "Incoming" : "Outgoing";
  };

  const handleRedial = async (item: CallHistoryItem) => {
    const targetId = item.direction === "outgoing" ? item.calleeId : item.callerId;
    if (item.callType === "video") {
      await startVideoCall(targetId);
    } else {
      await startAudioCall(targetId);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as "history" | "recordings")}
        className="flex flex-col h-full"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <TabsList className="grid w-[200px] grid-cols-2">
            <TabsTrigger value="history" className="gap-1.5">
              <Phone className="w-3.5 h-3.5" />
              History
            </TabsTrigger>
            <TabsTrigger value="recordings" className="gap-1.5">
              <Disc className="w-3.5 h-3.5" />
              Recordings
            </TabsTrigger>
          </TabsList>
          {activeTab === "history" && (
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={refetch}>
              <RefreshCw className="w-4 h-4" />
            </Button>
          )}
        </div>

        <TabsContent value="history" className="flex-1 mt-0 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <RefreshCw className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : history.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
              <Phone className="w-8 h-8 mb-2 opacity-50" />
              <p className="text-sm">No call history yet</p>
            </div>
          ) : (
            <ScrollArea className="h-full">
              <div className="divide-y divide-border">
                {history.map((item) => {
                  const otherName =
                    item.direction === "outgoing" ? item.calleeName : item.callerName;

                  return (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors"
                    >
                      <Avatar className="h-10 w-10 shrink-0">
                        <AvatarFallback className="bg-primary/10 text-primary">
                          {getInitials(otherName)}
                        </AvatarFallback>
                      </Avatar>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-foreground truncate">{otherName}</span>
                          {item.callType === "video" ? (
                            <Video className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                          ) : (
                            <Phone className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                          )}
                        </div>

                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          {getStatusIcon(item)}
                          <span>{getStatusLabel(item)}</span>
                          {item.duration && (
                            <>
                              <span>•</span>
                              <Clock className="w-3 h-3" />
                              <span>{formatDuration(item.duration)}</span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatDistanceToNow(item.createdAt, { addSuffix: true })}
                        </span>

                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-primary hover:text-primary hover:bg-primary/10"
                          onClick={() => handleRedial(item)}
                          title="Redial"
                        >
                          {item.callType === "video" ? (
                            <Video className="w-4 h-4" />
                          ) : (
                            <Phone className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </TabsContent>

        <TabsContent value="recordings" className="flex-1 mt-0 overflow-hidden">
          <CallRecordings userId={userId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
