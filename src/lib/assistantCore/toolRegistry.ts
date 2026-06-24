import type {
  ApprovalMode,
  AssistantRisk,
  AssistantSensitivity,
  AssistantToolCall,
  ToolOperation,
} from "./types";

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
  {
    name: "find_time",
    domain: "calendar",
    operations: ["read", "search"],
    defaultRisk: "low",
    sensitivity: "personal",
    approval: "auto",
    undoable: false,
    description: "Find free calendar time without mutating data.",
  },
  {
    name: "schedule_event",
    domain: "calendar",
    operations: ["create"],
    defaultRisk: "medium",
    sensitivity: "personal",
    approval: "auto",
    undoable: true,
    description: "Create a calendar event.",
  },
  {
    name: "manage_event",
    domain: "calendar",
    operations: ["update", "delete"],
    defaultRisk: "medium",
    sensitivity: "personal",
    approval: "auto",
    undoable: true,
    destructiveOps: ["delete", "cancel", "remove"],
    description: "Update or delete calendar events.",
  },
  {
    name: "bulk_reschedule",
    domain: "calendar",
    operations: ["update"],
    defaultRisk: "high",
    sensitivity: "personal",
    approval: "confirm",
    undoable: true,
    description: "Move many tasks or events at once.",
  },
  {
    name: "bulk_delete_events",
    domain: "calendar",
    operations: ["delete"],
    defaultRisk: "critical",
    sensitivity: "personal",
    approval: "confirm",
    undoable: true,
    description: "Delete many calendar events.",
  },
  {
    name: "manage_task",
    domain: "productivity",
    operations: ["create", "update", "delete"],
    defaultRisk: "low",
    sensitivity: "personal",
    approval: "auto",
    undoable: true,
    destructiveOps: ["delete", "remove"],
    description: "Create, update, complete, or delete tasks.",
  },
  {
    name: "task_filter",
    domain: "productivity",
    operations: ["read", "search"],
    defaultRisk: "low",
    sensitivity: "personal",
    approval: "auto",
    undoable: false,
    description: "Filter and search tasks.",
  },
  {
    name: "task_estimate",
    domain: "productivity",
    operations: ["read"],
    defaultRisk: "low",
    sensitivity: "personal",
    approval: "auto",
    undoable: false,
    description: "Estimate task effort.",
  },
  {
    name: "task_tag",
    domain: "productivity",
    operations: ["update"],
    defaultRisk: "low",
    sensitivity: "personal",
    approval: "auto",
    undoable: true,
    description: "Add or remove tags on a task.",
  },
  {
    name: "task_complete_note",
    domain: "productivity",
    operations: ["update"],
    defaultRisk: "low",
    sensitivity: "personal",
    approval: "auto",
    undoable: true,
    description: "Attach a completion note to a task.",
  },
  {
    name: "task_duplicate",
    domain: "productivity",
    operations: ["create"],
    defaultRisk: "low",
    sensitivity: "personal",
    approval: "auto",
    undoable: true,
    description: "Duplicate an existing task.",
  },
  {
    name: "task_subtask",
    domain: "productivity",
    operations: ["create", "update"],
    defaultRisk: "low",
    sensitivity: "personal",
    approval: "auto",
    undoable: true,
    description: "Create or update subtasks.",
  },
  {
    name: "task_assign",
    domain: "productivity",
    operations: ["update"],
    defaultRisk: "medium",
    sensitivity: "personal",
    approval: "auto",
    undoable: true,
    description: "Assign a task to a workspace member.",
  },
  {
    name: "manage_note",
    domain: "productivity",
    operations: ["create", "update", "delete"],
    defaultRisk: "low",
    sensitivity: "private",
    approval: "auto",
    undoable: true,
    destructiveOps: ["delete", "remove"],
    description: "Create, update, or delete notes.",
  },
  {
    name: "create_note",
    domain: "productivity",
    operations: ["create"],
    defaultRisk: "low",
    sensitivity: "private",
    approval: "auto",
    undoable: true,
    description: "Create a note.",
  },
  {
    name: "append_note",
    domain: "productivity",
    operations: ["update"],
    defaultRisk: "low",
    sensitivity: "private",
    approval: "auto",
    undoable: true,
    description: "Append content to an existing note.",
  },
  {
    name: "set_reminder",
    domain: "productivity",
    operations: ["create"],
    defaultRisk: "low",
    sensitivity: "personal",
    approval: "auto",
    undoable: true,
    description: "Create a reminder.",
  },
  {
    name: "manage_contact",
    domain: "communication",
    operations: ["create", "update", "delete"],
    defaultRisk: "medium",
    sensitivity: "private",
    approval: "auto",
    undoable: true,
    destructiveOps: ["delete", "remove"],
    description: "Manage saved contacts.",
  },
  {
    name: "manage_family_member",
    domain: "family",
    operations: ["create", "update", "delete"],
    defaultRisk: "medium",
    sensitivity: "family",
    approval: "auto",
    undoable: true,
    destructiveOps: ["delete", "remove"],
    description: "Create, update, or remove family member records.",
  },
  {
    name: "compose_email",
    domain: "communication",
    operations: ["create"],
    defaultRisk: "low",
    sensitivity: "private",
    approval: "auto",
    undoable: true,
    description: "Draft an email without sending it.",
  },
  {
    name: "send_email",
    domain: "communication",
    operations: ["send", "external"],
    defaultRisk: "critical",
    sensitivity: "private",
    approval: "confirm",
    undoable: false,
    outwardFacing: true,
    description: "Send email to a third party.",
  },
  {
    name: "send_family_message",
    domain: "communication",
    operations: ["send", "external"],
    defaultRisk: "high",
    sensitivity: "family",
    approval: "confirm",
    undoable: false,
    outwardFacing: true,
    description: "Relay a message to a family member.",
  },
  {
    name: "email_action",
    domain: "communication",
    operations: ["read", "update", "send", "external"],
    defaultRisk: "high",
    sensitivity: "private",
    approval: "confirm",
    undoable: true,
    outwardFacing: true,
    safeOps: ["summarize", "translate"],
    destructiveOps: ["forward", "reply", "unsubscribe", "send"],
    description: "Summarize, translate, update, forward, or unsubscribe email.",
  },
  {
    name: "summarize_emails",
    domain: "communication",
    operations: ["read"],
    defaultRisk: "low",
    sensitivity: "private",
    approval: "auto",
    undoable: false,
    description: "Read and summarize email.",
  },
  {
    name: "save_memory",
    domain: "memory",
    operations: ["memory_write"],
    defaultRisk: "low",
    sensitivity: "personal",
    approval: "auto",
    undoable: true,
    description: "Persist a user preference or fact after memory policy accepts it.",
  },
  {
    name: "learn_preference",
    domain: "memory",
    operations: ["memory_write"],
    defaultRisk: "low",
    sensitivity: "personal",
    approval: "auto",
    undoable: true,
    description: "Persist a user preference.",
  },
  {
    name: "web_search",
    domain: "system",
    operations: ["read", "external"],
    defaultRisk: "low",
    sensitivity: "public",
    approval: "auto",
    undoable: false,
    description: "Search the public web.",
  },
  {
    name: "manage_contract",
    domain: "finance",
    operations: ["create", "update", "delete"],
    defaultRisk: "medium",
    sensitivity: "financial",
    approval: "auto",
    undoable: true,
    destructiveOps: ["cancel", "delete", "remove"],
    description: "Manage contracts and subscriptions.",
  },
  {
    name: "manage_property",
    domain: "finance",
    operations: ["create", "update", "delete"],
    defaultRisk: "medium",
    sensitivity: "financial",
    approval: "auto",
    undoable: true,
    destructiveOps: ["delete", "remove"],
    description: "Manage property records.",
  },
  {
    name: "manage_business",
    domain: "finance",
    operations: ["create", "update", "delete"],
    defaultRisk: "medium",
    sensitivity: "financial",
    approval: "auto",
    undoable: true,
    destructiveOps: ["delete", "remove"],
    description: "Manage business records.",
  },
  {
    name: "budget",
    domain: "finance",
    operations: ["read", "financial"],
    defaultRisk: "high",
    sensitivity: "financial",
    approval: "confirm",
    undoable: true,
    safeOps: ["check"],
    description: "Read or change budgets.",
  },
  {
    name: "zakat",
    domain: "finance",
    operations: ["financial"],
    defaultRisk: "high",
    sensitivity: "financial",
    approval: "confirm",
    undoable: false,
    description: "Compute or discuss religious/financial obligations.",
  },
  {
    name: "meds",
    domain: "health",
    operations: ["read", "medical"],
    defaultRisk: "high",
    sensitivity: "medical",
    approval: "confirm",
    undoable: true,
    safeOps: ["list"],
    description: "Read or add medications.",
  },
  {
    name: "manage_habit",
    domain: "health",
    operations: ["create", "update", "delete"],
    defaultRisk: "medium",
    sensitivity: "medical",
    approval: "auto",
    undoable: true,
    destructiveOps: ["delete", "remove"],
    description: "Manage habits.",
  },
  {
    name: "log_wellbeing",
    domain: "health",
    operations: ["create"],
    defaultRisk: "low",
    sensitivity: "medical",
    approval: "auto",
    undoable: true,
    description: "Log mood, energy, stress, or wellbeing.",
  },
  {
    name: "manage_goal",
    domain: "productivity",
    operations: ["create", "update", "delete"],
    defaultRisk: "medium",
    sensitivity: "personal",
    approval: "auto",
    undoable: true,
    destructiveOps: ["delete", "remove"],
    description: "Create, update, or delete goals.",
  },
  {
    name: "period_log",
    domain: "health",
    operations: ["create", "medical"],
    defaultRisk: "medium",
    sensitivity: "medical",
    approval: "auto",
    undoable: true,
    description: "Log menstrual cycle data.",
  },
  {
    name: "fasting_log",
    domain: "health",
    operations: ["create", "medical"],
    defaultRisk: "medium",
    sensitivity: "medical",
    approval: "auto",
    undoable: true,
    description: "Log fasting windows or fasting status.",
  },
  {
    name: "pantry",
    domain: "household",
    operations: ["create", "update", "delete"],
    defaultRisk: "low",
    sensitivity: "personal",
    approval: "auto",
    undoable: true,
    destructiveOps: ["delete", "remove"],
    description: "Manage pantry inventory.",
  },
  {
    name: "add_shopping_item",
    domain: "household",
    operations: ["create"],
    defaultRisk: "low",
    sensitivity: "personal",
    approval: "auto",
    undoable: true,
    description: "Add an item to a shopping list.",
  },
  {
    name: "flight_track",
    domain: "travel",
    operations: ["read", "search", "external"],
    defaultRisk: "low",
    sensitivity: "personal",
    approval: "auto",
    undoable: false,
    description: "Track flight status through an external source.",
  },
  {
    name: "timezone",
    domain: "system",
    operations: ["read"],
    defaultRisk: "low",
    sensitivity: "public",
    approval: "auto",
    undoable: false,
    description: "Resolve timezone information.",
  },
  {
    name: "currency",
    domain: "system",
    operations: ["read"],
    defaultRisk: "low",
    sensitivity: "public",
    approval: "auto",
    undoable: false,
    description: "Resolve currency conversion or formatting.",
  },
  {
    name: "presence",
    domain: "system",
    operations: ["read"],
    defaultRisk: "low",
    sensitivity: "personal",
    approval: "auto",
    undoable: false,
    description: "Read presence or availability.",
  },
] as const;

const REGISTRY_BY_NAME = new Map(TOOL_REGISTRY.map((tool) => [tool.name, tool]));

function norm(value?: string | null): string {
  return (value ?? "").trim().toLowerCase();
}

function escalateRisk(base: AssistantRisk, operation: string, tool: ToolDefinition): AssistantRisk {
  if (tool.approval === "confirm") return tool.defaultRisk;
  if (tool.destructiveOps?.includes(operation) || DESTRUCTIVE_OPS.has(operation)) return "high";
  if (tool.outwardFacing) return "high";
  if (HIGH_STAKES_DOMAINS.has(tool.domain) && operation !== "read" && operation !== "search") {
    return base === "low" ? "medium" : base;
  }
  return base;
}

function approvalFor(tool: ToolDefinition, operation: string, risk: AssistantRisk): ApprovalMode {
  if (tool.safeOps?.includes(operation)) return "auto";
  if (tool.approval === "confirm") return "confirm";
  if (tool.destructiveOps?.includes(operation) || DESTRUCTIVE_OPS.has(operation)) return "confirm";
  if (risk === "critical" || risk === "high") return "confirm";
  return tool.approval;
}

export function getToolDefinition(name: string): ToolDefinition | undefined {
  return REGISTRY_BY_NAME.get(norm(name));
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

export function requiresToolApproval(call: AssistantToolCall): boolean {
  return classifyToolCall(call).approval !== "auto";
}

export function listToolNames(): string[] {
  return TOOL_REGISTRY.map((tool) => tool.name);
}
