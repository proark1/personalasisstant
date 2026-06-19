import { Wifi, WifiOff, Signal, SignalLow, SignalMedium, SignalHigh } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { CallQualityStats } from "@/hooks/useCallQuality";
import { cn } from "@/lib/utils";

interface CallQualityIndicatorProps {
  stats: CallQualityStats;
  className?: string;
}

export function CallQualityIndicator({ stats, className }: CallQualityIndicatorProps) {
  const getSignalIcon = () => {
    switch (stats.signalStrength) {
      case "excellent":
        return <SignalHigh className="w-5 h-5 text-success" />;
      case "good":
        return <SignalMedium className="w-5 h-5 text-success" />;
      case "fair":
        return <SignalLow className="w-5 h-5 text-warning" />;
      case "poor":
        return <Signal className="w-5 h-5 text-destructive" />;
      default:
        return <Signal className="w-5 h-5 text-muted-foreground" />;
    }
  };

  const getConnectionIcon = () => {
    if (stats.connectionState === "connected" && stats.iceConnectionState === "connected") {
      return <Wifi className="w-4 h-4 text-success" />;
    }
    if (stats.connectionState === "connecting" || stats.iceConnectionState === "checking") {
      return <Wifi className="w-4 h-4 text-warning animate-pulse" />;
    }
    if (stats.connectionState === "failed" || stats.connectionState === "disconnected") {
      return <WifiOff className="w-4 h-4 text-destructive" />;
    }
    return <Wifi className="w-4 h-4 text-muted-foreground" />;
  };

  const getQualityLabel = () => {
    switch (stats.signalStrength) {
      case "excellent":
        return "Excellent";
      case "good":
        return "Good";
      case "fair":
        return "Fair";
      case "poor":
        return "Poor";
      default:
        return "Checking...";
    }
  };

  const getQualityColor = () => {
    switch (stats.signalStrength) {
      case "excellent":
        return "bg-success/20 text-success border-success/30";
      case "good":
        return "bg-success/15 text-success border-success/25";
      case "fair":
        return "bg-warning/20 text-warning border-warning/30";
      case "poor":
        return "bg-destructive/20 text-destructive border-destructive/30";
      default:
        return "bg-muted text-muted-foreground border-border";
    }
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-full border backdrop-blur-sm cursor-default",
            getQualityColor(),
            className,
          )}
        >
          {getConnectionIcon()}
          {getSignalIcon()}
          <span className="text-xs font-medium">{getQualityLabel()}</span>
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="w-64">
        <div className="space-y-2">
          <p className="font-medium text-sm">Call Quality Details</p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="text-muted-foreground">Connection:</div>
            <div className="capitalize">{stats.connectionState}</div>

            {stats.latency !== null && (
              <>
                <div className="text-muted-foreground">Latency:</div>
                <div>{stats.latency} ms</div>
              </>
            )}

            {stats.packetLoss !== null && (
              <>
                <div className="text-muted-foreground">Packet Loss:</div>
                <div>{stats.packetLoss}%</div>
              </>
            )}

            {stats.jitter !== null && (
              <>
                <div className="text-muted-foreground">Jitter:</div>
                <div>{stats.jitter} ms</div>
              </>
            )}

            {stats.bitrate !== null && (
              <>
                <div className="text-muted-foreground">Bitrate:</div>
                <div>{stats.bitrate} kbps</div>
              </>
            )}

            {stats.resolution && (
              <>
                <div className="text-muted-foreground">Resolution:</div>
                <div>
                  {stats.resolution.width}x{stats.resolution.height}
                </div>
              </>
            )}

            {stats.frameRate !== null && (
              <>
                <div className="text-muted-foreground">Frame Rate:</div>
                <div>{stats.frameRate} fps</div>
              </>
            )}
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
