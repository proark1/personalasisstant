import { RecurrenceRule, RecurrenceFrequency } from "@/types/flux";

// Convert RecurrenceRule to RRULE string
export function toRRuleString(rule: RecurrenceRule): string {
  const parts: string[] = [`FREQ=${rule.frequency.toUpperCase()}`];

  if (rule.interval > 1) {
    parts.push(`INTERVAL=${rule.interval}`);
  }

  if (rule.frequency === "weekly" && rule.daysOfWeek?.length) {
    const dayMap = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
    const days = rule.daysOfWeek.map((d) => dayMap[d]).join(",");
    parts.push(`BYDAY=${days}`);
  }

  if (rule.endDate) {
    const dateStr = rule.endDate.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    parts.push(`UNTIL=${dateStr}`);
  }

  return parts.join(";");
}

// Parse RRULE string to RecurrenceRule
export function parseRRuleString(rrule: string): RecurrenceRule | null {
  if (!rrule) return null;

  const parts = rrule.split(";");
  const rule: RecurrenceRule = {
    frequency: "daily",
    interval: 1,
  };

  const dayMap: Record<string, number> = {
    SU: 0,
    MO: 1,
    TU: 2,
    WE: 3,
    TH: 4,
    FR: 5,
    SA: 6,
  };

  for (const part of parts) {
    const [key, value] = part.split("=");
    switch (key) {
      case "FREQ":
        rule.frequency = value.toLowerCase() as RecurrenceFrequency;
        break;
      case "INTERVAL":
        rule.interval = parseInt(value, 10);
        break;
      case "BYDAY":
        rule.daysOfWeek = value
          .split(",")
          .map((d) => dayMap[d])
          .filter((d): d is number => d !== undefined);
        break;
      case "UNTIL": {
        // Parse RRULE date format: YYYYMMDDTHHMMSSZ
        const year = value.slice(0, 4);
        const month = value.slice(4, 6);
        const day = value.slice(6, 8);
        const parsed = new Date(`${year}-${month}-${day}`);
        if (!isNaN(parsed.getTime())) {
          rule.endDate = parsed;
        }
        break;
      }
    }
  }

  return rule;
}

// Get human-readable description of recurrence
export function getRecurrenceDescription(rrule: string | undefined): string {
  if (!rrule) return "";

  const rule = parseRRuleString(rrule);
  if (!rule) return "";

  const frequencyLabels: Record<RecurrenceFrequency, string> = {
    daily: "day",
    weekly: "week",
    monthly: "month",
    yearly: "year",
  };

  let desc = "";

  if (rule.interval === 1) {
    desc = `Every ${frequencyLabels[rule.frequency]}`;
  } else {
    desc = `Every ${rule.interval} ${frequencyLabels[rule.frequency]}s`;
  }

  if (rule.frequency === "weekly" && rule.daysOfWeek?.length) {
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const days = rule.daysOfWeek.map((d) => dayNames[d]).join(", ");
    desc += ` on ${days}`;
  }

  return desc;
}

// Preset recurrence options for quick selection
export const recurrencePresets = [
  { label: "Daily", value: "FREQ=DAILY" },
  { label: "Weekdays", value: "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR" },
  { label: "Weekly", value: "FREQ=WEEKLY" },
  { label: "Bi-weekly", value: "FREQ=WEEKLY;INTERVAL=2" },
  { label: "Monthly", value: "FREQ=MONTHLY" },
  { label: "Yearly", value: "FREQ=YEARLY" },
];
