export type AssistantRisk = "low" | "medium" | "high" | "critical";
export type AssistantSensitivity =
  | "public"
  | "personal"
  | "private"
  | "financial"
  | "medical"
  | "credential"
  | "family";
export type ApprovalMode = "auto" | "confirm" | "dry_run";
export type ToolOperation =
  | "read"
  | "search"
  | "create"
  | "update"
  | "delete"
  | "send"
  | "external"
  | "memory_write"
  | "medical"
  | "financial";

export interface AssistantToolCall {
  tool: string;
  operation?: string | null;
}

export interface ToolDefinition {
  name: string;
  domain:
    | "productivity"
    | "calendar"
    | "communication"
    | "memory"
    | "finance"
    | "health"
    | "travel"
    | "family"
    | "household"
    | "system";
  operations: ToolOperation[];
  defaultRisk: AssistantRisk;
  sensitivity: AssistantSensitivity;
  approval: ApprovalMode;
  undoable: boolean;
  outwardFacing?: boolean;
  destructiveOps?: string[];
  safeOps?: string[];
  description: string;
}

export interface ToolPolicy {
  known: boolean;
  tool: string;
  operation: string;
  risk: AssistantRisk;
  approval: ApprovalMode;
  sensitivity: AssistantSensitivity;
  undoable: boolean;
  outwardFacing: boolean;
  reason: string;
}

const DESTRUCTIVE_OPS = new Set([
  "archive",
  "cancel",
  "delete",
  "forward",
  "remove",
  "reply",
  "send",
  "unsubscribe",
]);
const HIGH_STAKES_DOMAINS = new Set(["finance", "health", "communication"]);

export const TOOL_REGISTRY: readonly ToolDefinition[] = [
  tool("find_time", "calendar", ["read", "search"], "low", "personal", "auto", false, "Find free calendar time."),
  tool("schedule_event", "calendar", ["create"], "medium", "personal", "auto", true, "Create a calendar event."),
  tool("manage_event", "calendar", ["update", "delete"], "medium", "personal", "auto", true, "Update or delete calendar events.", {
    destructiveOps: ["delete", "cancel", "remove"],
  }),
  tool("bulk_reschedule", "calendar", ["update"], "high", "personal", "confirm", true, "Move many tasks or events at once."),
  tool("bulk_delete_events", "calendar", ["delete"], "critical", "personal", "confirm", true, "Delete many calendar events."),
  tool("manage_task", "productivity", ["create", "update", "delete"], "low", "personal", "auto", true, "Create, update, complete, or delete tasks.", {
    destructiveOps: ["delete", "remove"],
  }),
  tool("task_filter", "productivity", ["read", "search"], "low", "personal", "auto", false, "Filter and search tasks."),
  tool("task_estimate", "productivity", ["read"], "low", "personal", "auto", false, "Estimate task effort."),
  tool("task_tag", "productivity", ["update"], "low", "personal", "auto", true, "Add or remove tags on a task."),
  tool("task_complete_note", "productivity", ["update"], "low", "personal", "auto", true, "Attach a completion note to a task."),
  tool("task_duplicate", "productivity", ["create"], "low", "personal", "auto", true, "Duplicate an existing task."),
  tool("task_subtask", "productivity", ["create", "update"], "low", "personal", "auto", true, "Create or update subtasks."),
  tool("task_assign", "productivity", ["update"], "medium", "personal", "auto", true, "Assign a task to a workspace member."),
  tool("manage_note", "productivity", ["create", "update", "delete"], "low", "private", "auto", true, "Create, update, or delete notes.", {
    destructiveOps: ["delete", "remove"],
  }),
  tool("create_note", "productivity", ["create"], "low", "private", "auto", true, "Create a note."),
  tool("append_note", "productivity", ["update"], "low", "private", "auto", true, "Append content to an existing note."),
  tool("set_reminder", "productivity", ["create"], "low", "personal", "auto", true, "Create a reminder."),
  tool("manage_goal", "productivity", ["create", "update", "delete"], "medium", "personal", "auto", true, "Create, update, or delete goals.", {
    destructiveOps: ["delete", "remove"],
  }),
  tool("manage_contact", "communication", ["create", "update", "delete"], "medium", "private", "auto", true, "Manage saved contacts.", {
    destructiveOps: ["delete", "remove"],
  }),
  tool("manage_family_member", "family", ["create", "update", "delete"], "medium", "family", "auto", true, "Manage family member records.", {
    destructiveOps: ["delete", "remove"],
  }),
  tool("compose_email", "communication", ["create"], "low", "private", "auto", true, "Draft an email."),
  tool("send_email", "communication", ["send", "external"], "critical", "private", "confirm", false, "Send email to a third party.", {
    outwardFacing: true,
  }),
  tool("send_family_message", "communication", ["send", "external"], "high", "family", "confirm", false, "Send a Telegram family message.", {
    outwardFacing: true,
  }),
  tool("email_action", "communication", ["read", "update", "send", "external"], "high", "private", "confirm", true, "Perform an email action.", {
    outwardFacing: true,
    safeOps: ["summarize", "translate"],
    destructiveOps: ["forward", "reply", "unsubscribe", "send"],
  }),
  tool("summarize_emails", "communication", ["read"], "low", "private", "auto", false, "Read and summarize email."),
  tool("save_memory", "memory", ["memory_write"], "low", "personal", "auto", true, "Persist accepted memory."),
  tool("learn_preference", "memory", ["memory_write"], "low", "personal", "auto", true, "Persist a preference."),
  tool("web_search", "system", ["read", "external"], "low", "public", "auto", false, "Search the public web."),
  tool("manage_contract", "finance", ["create", "update", "delete"], "medium", "financial", "auto", true, "Manage contracts and subscriptions.", {
    destructiveOps: ["cancel", "delete", "remove"],
  }),
  tool("manage_property", "finance", ["create", "update", "delete"], "medium", "financial", "auto", true, "Manage property records.", {
    destructiveOps: ["delete", "remove"],
  }),
  tool("manage_business", "finance", ["create", "update", "delete"], "medium", "financial", "auto", true, "Manage business records.", {
    destructiveOps: ["delete", "remove"],
  }),
  tool("budget", "finance", ["read", "financial"], "high", "financial", "confirm", true, "Read or change budgets.", {
    safeOps: ["check"],
  }),
  tool("zakat", "finance", ["financial"], "high", "financial", "confirm", false, "Compute or discuss financial obligations."),
  tool("meds", "health", ["read", "medical"], "high", "medical", "confirm", true, "Read or add medications.", {
    safeOps: ["list"],
  }),
  tool("manage_habit", "health", ["create", "update", "delete"], "medium", "medical", "auto", true, "Manage habits.", {
    destructiveOps: ["delete", "remove"],
  }),
  tool("log_wellbeing", "health", ["create"], "low", "medical", "auto", true, "Log mood, energy, stress, or wellbeing."),
  tool("period_log", "health", ["create", "medical"], "medium", "medical", "auto", true, "Log menstrual cycle data."),
  tool("fasting_log", "health", ["create", "medical"], "medium", "medical", "auto", true, "Log fasting windows or status."),
  tool("pantry", "household", ["create", "update", "delete"], "low", "personal", "auto", true, "Manage pantry inventory.", {
    destructiveOps: ["delete", "remove"],
  }),
  tool("add_shopping_item", "household", ["create"], "low", "personal", "auto", true, "Add an item to a shopping list."),
  tool("flight_track", "travel", ["read", "search", "external"], "low", "personal", "auto", false, "Track flight status."),
  tool("timezone", "system", ["read"], "low", "public", "auto", false, "Resolve timezone information."),
  tool("currency", "system", ["read"], "low", "public", "auto", false, "Resolve currency conversion or formatting."),
  tool("presence", "system", ["read"], "low", "personal", "auto", false, "Read presence or availability."),
] as const;

function tool(
  name: ToolDefinition["name"],
  domain: ToolDefinition["domain"],
  operations: ToolOperation[],
  defaultRisk: AssistantRisk,
  sensitivity: AssistantSensitivity,
  approval: ApprovalMode,
  undoable: boolean,
  description: string,
  extra: Partial<Pick<ToolDefinition, "outwardFacing" | "destructiveOps" | "safeOps">> = {},
): ToolDefinition {
  return { name, domain, operations, defaultRisk, sensitivity, approval, undoable, description, ...extra };
}

const REGISTRY_BY_NAME = new Map(TOOL_REGISTRY.map((entry) => [entry.name, entry]));

function norm(value?: string | null): string {
  return (value ?? "").trim().toLowerCase();
}

function escalateRisk(base: AssistantRisk, operation: string, toolDef: ToolDefinition): AssistantRisk {
  if (toolDef.approval === "confirm") return toolDef.defaultRisk;
  if (toolDef.destructiveOps?.includes(operation) || DESTRUCTIVE_OPS.has(operation)) return "high";
  if (toolDef.outwardFacing) return "high";
  if (HIGH_STAKES_DOMAINS.has(toolDef.domain) && operation !== "read" && operation !== "search") {
    return base === "low" ? "medium" : base;
  }
  return base;
}

function approvalFor(toolDef: ToolDefinition, operation: string, risk: AssistantRisk): ApprovalMode {
  if (toolDef.safeOps?.includes(operation)) return "auto";
  if (toolDef.approval === "confirm") return "confirm";
  if (toolDef.destructiveOps?.includes(operation) || DESTRUCTIVE_OPS.has(operation)) return "confirm";
  if (risk === "critical" || risk === "high") return "confirm";
  return toolDef.approval;
}

export function classifyToolCall(call: AssistantToolCall): ToolPolicy {
  const toolName = norm(call.tool);
  const operation = norm(call.operation) || "default";
  const definition = REGISTRY_BY_NAME.get(toolName);

  if (!definition) {
    return {
      known: false,
      tool: toolName,
      operation,
      risk: "high",
      approval: "confirm",
      sensitivity: "private",
      undoable: false,
      outwardFacing: false,
      reason: "Unknown assistant tool. New tools must be explicitly registered before auto-run.",
    };
  }

  const risk = escalateRisk(definition.defaultRisk, operation, definition);
  const approval = approvalFor(definition, operation, risk);
  const destructive = definition.destructiveOps?.includes(operation) || DESTRUCTIVE_OPS.has(operation);

  return {
    known: true,
    tool: definition.name,
    operation,
    risk,
    approval,
    sensitivity: definition.sensitivity,
    undoable: definition.undoable,
    outwardFacing: !!definition.outwardFacing,
    reason:
      approval === "confirm"
        ? destructive
          ? "Destructive or outward-facing operation requires confirmation."
          : "High-stakes domain requires confirmation."
        : "Known reversible operation can auto-run.",
  };
}
