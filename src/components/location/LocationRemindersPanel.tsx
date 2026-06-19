import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { MapPin, Plus, Navigation, Trash2, Play, Square, AlertCircle } from "lucide-react";
import { useLocationReminders, LocationTrigger } from "@/hooks/useLocationReminders";
import { AddLocationTriggerDialog } from "./AddLocationTriggerDialog";
import { formatDistanceToNow } from "date-fns";

export function LocationRemindersPanel() {
  const {
    triggers,
    loading,
    isTracking,
    permissionStatus,
    currentPosition,
    startTracking,
    stopTracking,
    requestPermissions,
    deleteTrigger,
    updateTrigger,
  } = useLocationReminders();

  const [showAddDialog, setShowAddDialog] = useState(false);

  const handleToggleTracking = async () => {
    if (isTracking) {
      await stopTracking();
    } else {
      await startTracking();
    }
  };

  const _getTriggerTypeLabel = (type: string) => {
    switch (type) {
      case "enter":
        return "On Arrival";
      case "exit":
        return "On Departure";
      case "both":
        return "Both";
      default:
        return type;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" />
              <CardTitle>Location Reminders</CardTitle>
            </div>
            <Button size="sm" onClick={() => setShowAddDialog(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Add
            </Button>
          </div>
          <CardDescription>
            Get reminded when you arrive at or leave specific locations
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Permission & Tracking Status */}
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-3">
              <Navigation
                className={`h-5 w-5 ${isTracking ? "text-green-500 animate-pulse" : "text-muted-foreground"}`}
              />
              <div>
                <p className="text-sm font-medium">
                  {isTracking ? "Location tracking active" : "Location tracking paused"}
                </p>
                {currentPosition && isTracking && (
                  <p className="text-xs text-muted-foreground">
                    {currentPosition.coords.latitude.toFixed(4)},{" "}
                    {currentPosition.coords.longitude.toFixed(4)}
                  </p>
                )}
              </div>
            </div>

            {permissionStatus === "denied" ? (
              <Button size="sm" variant="outline" onClick={requestPermissions}>
                <AlertCircle className="h-4 w-4 mr-1 text-destructive" />
                Enable
              </Button>
            ) : (
              <Button
                size="sm"
                variant={isTracking ? "destructive" : "default"}
                onClick={handleToggleTracking}
              >
                {isTracking ? (
                  <>
                    <Square className="h-4 w-4 mr-1" />
                    Stop
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-1" />
                    Start
                  </>
                )}
              </Button>
            )}
          </div>

          {/* Trigger List */}
          {triggers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <MapPin className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No location reminders yet</p>
              <p className="text-sm">Add a location to get started</p>
            </div>
          ) : (
            <div className="space-y-3">
              {triggers.map((trigger) => (
                <TriggerItem
                  key={trigger.id}
                  trigger={trigger}
                  onToggle={(active) => updateTrigger(trigger.id, { is_active: active })}
                  onDelete={() => deleteTrigger(trigger.id)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AddLocationTriggerDialog open={showAddDialog} onOpenChange={setShowAddDialog} />
    </>
  );
}

interface TriggerItemProps {
  trigger: LocationTrigger;
  onToggle: (active: boolean) => void;
  onDelete: () => void;
}

function TriggerItem({ trigger, onToggle, onDelete }: TriggerItemProps) {
  return (
    <div className="flex items-start gap-3 p-3 border rounded-lg">
      <div className="mt-1">
        <MapPin className="h-5 w-5 text-primary" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-medium truncate">{trigger.name}</p>
          <Badge variant="secondary" className="text-xs">
            {trigger.trigger_type === "exit"
              ? "Leave"
              : trigger.trigger_type === "enter"
                ? "Arrive"
                : "Both"}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground truncate mt-0.5">{trigger.reminder_message}</p>
        <p className="text-xs text-muted-foreground mt-1">
          {trigger.radius_meters}m radius
          {trigger.last_triggered_at && (
            <>
              {" "}
              • Last triggered{" "}
              {formatDistanceToNow(new Date(trigger.last_triggered_at), { addSuffix: true })}
            </>
          )}
        </p>
      </div>

      <div className="flex items-center gap-2">
        <Switch checked={trigger.is_active} onCheckedChange={onToggle} />
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8 text-muted-foreground hover:text-destructive"
          onClick={onDelete}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
