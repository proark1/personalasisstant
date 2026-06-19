import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { useAutomationRules, TriggerType, ActionType } from "@/hooks/useAutomationRules";
import { Zap, Plus, Trash2, Play, Pause, Settings2 } from "lucide-react";

const TRIGGERS: { value: TriggerType; label: string; description: string }[] = [
  { value: "task_completed", label: "Task Completed", description: "When you complete a task" },
  { value: "habit_logged", label: "Habit Logged", description: "When you log a habit" },
  {
    value: "focus_session_ended",
    label: "Focus Session Ended",
    description: "When a focus session completes",
  },
  { value: "prayer_logged", label: "Prayer Logged", description: "When you log a prayer" },
  {
    value: "checkin_completed",
    label: "Check-in Completed",
    description: "When you complete a daily check-in",
  },
  {
    value: "goal_progress",
    label: "Goal Progress",
    description: "When you make progress on a goal",
  },
];

const ACTIONS: { value: ActionType; label: string; description: string }[] = [
  { value: "add_xp", label: "Add XP", description: "Award bonus XP points" },
  {
    value: "show_notification",
    label: "Show Notification",
    description: "Display a notification message",
  },
  {
    value: "create_reminder",
    label: "Create Reminder",
    description: "Create a follow-up reminder",
  },
  { value: "log_activity", label: "Log Activity", description: "Log to activity feed" },
];

export function AutomationRulesPanel() {
  const { rules, loading, createRule, deleteRule, toggleRule } = useAutomationRules();
  const [isCreating, setIsCreating] = useState(false);
  const [newRule, setNewRule] = useState({
    name: "",
    triggerType: "" as TriggerType,
    actionType: "" as ActionType,
    actionConfig: {} as Record<string, unknown>,
  });

  const handleCreate = async () => {
    if (!newRule.name || !newRule.triggerType || !newRule.actionType) return;

    await createRule({
      name: newRule.name,
      triggerType: newRule.triggerType,
      actionType: newRule.actionType,
      actionConfig: newRule.actionConfig,
    });

    setNewRule({
      name: "",
      triggerType: "" as TriggerType,
      actionType: "" as ActionType,
      actionConfig: {},
    });
    setIsCreating(false);
  };

  if (loading) {
    return (
      <Card className="animate-pulse">
        <CardHeader className="pb-2">
          <div className="h-5 w-40 bg-muted rounded" />
        </CardHeader>
        <CardContent>
          <div className="h-32 bg-muted rounded" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-500" />
            Automation Rules
          </CardTitle>
          <Dialog open={isCreating} onOpenChange={setIsCreating}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="w-4 h-4 mr-1" />
                New Rule
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Automation Rule</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Rule Name</Label>
                  <Input
                    placeholder="e.g., Reward Focus Sessions"
                    value={newRule.name}
                    onChange={(e) => setNewRule((prev) => ({ ...prev, name: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label>When this happens...</Label>
                  <Select
                    value={newRule.triggerType}
                    onValueChange={(v) =>
                      setNewRule((prev) => ({ ...prev, triggerType: v as TriggerType }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select trigger" />
                    </SelectTrigger>
                    <SelectContent>
                      {TRIGGERS.map((trigger) => (
                        <SelectItem key={trigger.value} value={trigger.value}>
                          <div>
                            <p className="font-medium">{trigger.label}</p>
                            <p className="text-xs text-muted-foreground">{trigger.description}</p>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Do this action...</Label>
                  <Select
                    value={newRule.actionType}
                    onValueChange={(v) =>
                      setNewRule((prev) => ({ ...prev, actionType: v as ActionType }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select action" />
                    </SelectTrigger>
                    <SelectContent>
                      {ACTIONS.map((action) => (
                        <SelectItem key={action.value} value={action.value}>
                          <div>
                            <p className="font-medium">{action.label}</p>
                            <p className="text-xs text-muted-foreground">{action.description}</p>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {newRule.actionType === "add_xp" && (
                  <div className="space-y-2">
                    <Label>XP Amount</Label>
                    <Input
                      type="number"
                      placeholder="10"
                      value={(newRule.actionConfig.amount as number) || ""}
                      onChange={(e) =>
                        setNewRule((prev) => ({
                          ...prev,
                          actionConfig: {
                            ...prev.actionConfig,
                            amount: parseInt(e.target.value) || 10,
                          },
                        }))
                      }
                    />
                  </div>
                )}

                {newRule.actionType === "show_notification" && (
                  <div className="space-y-2">
                    <Label>Notification Message</Label>
                    <Input
                      placeholder="Great job!"
                      value={(newRule.actionConfig.message as string) || ""}
                      onChange={(e) =>
                        setNewRule((prev) => ({
                          ...prev,
                          actionConfig: { ...prev.actionConfig, message: e.target.value },
                        }))
                      }
                    />
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreating(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleCreate}
                  disabled={!newRule.name || !newRule.triggerType || !newRule.actionType}
                >
                  Create Rule
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {rules.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Settings2 className="w-10 h-10 mx-auto mb-3 opacity-50" />
            <p className="text-sm">No automation rules yet</p>
            <p className="text-xs">Create rules to automate repetitive actions</p>
          </div>
        ) : (
          <div className="space-y-3">
            {rules.map((rule) => {
              const trigger = TRIGGERS.find((t) => t.value === rule.triggerType);
              const action = ACTIONS.find((a) => a.value === rule.actionType);

              return (
                <div
                  key={rule.id}
                  className="p-3 rounded-lg border bg-card flex items-center gap-3"
                >
                  <Switch checked={rule.isActive} onCheckedChange={() => toggleRule(rule.id)} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-sm truncate">{rule.name}</h4>
                      {rule.isActive ? (
                        <Badge variant="outline" className="text-green-600 border-green-600">
                          <Play className="w-2 h-2 mr-1" />
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">
                          <Pause className="w-2 h-2 mr-1" />
                          Paused
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      When <span className="font-medium">{trigger?.label.toLowerCase()}</span> →{" "}
                      <span className="font-medium">{action?.label.toLowerCase()}</span>
                    </p>
                    {rule.executionCount > 0 && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Executed {rule.executionCount} times
                      </p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteRule(rule.id)}
                    className="shrink-0 text-destructive hover:text-destructive"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
