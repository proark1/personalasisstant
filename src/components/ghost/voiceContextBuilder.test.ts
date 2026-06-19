import { describe, it, expect } from "vitest";
import { buildVoiceContextData, type BuildVoiceContextInputs } from "./voiceContextBuilder";
import type { Task, CalendarEvent, Project } from "@/types/flux";
import type { Contact } from "@/hooks/useContacts";
import type { Contract } from "@/hooks/useContracts";

const NOW = new Date("2025-05-21T12:00:00Z");

// Minimal valid `FamilyContext` shape — only what the builder reads.
const familyContext = {
  members: [],
  schedule: {
    todayEvents: [],
    tomorrowEvents: [],
    upcomingBirthdays: [],
  },
  meals: { today: null, tomorrow: null },
  shopping: { urgentLists: [], totalItemsNeeded: 0 },
} as unknown as Parameters<typeof buildVoiceContextData>[0]["familyContext"];

function emptyInputs(): BuildVoiceContextInputs {
  return {
    tasks: [] as Task[],
    events: [] as CalendarEvent[],
    contacts: [] as Contact[],
    contracts: [] as Contract[],
    projects: [] as Project[],
    healthMetrics: [],
    todaySummary: null,
    weeklyData: [],
    healthConnected: false,
    habits: [],
    habitLogs: [],
    notes: [],
    conversations: [],
    startupIdeas: [],
    emailList: [],
    totalUnreadEmails: 0,
    familyMembers: [],
    familyContext,
    shoppingLists: [],
    now: NOW,
  };
}

describe("buildVoiceContextData", () => {
  it("returns a stable empty shape when every input is empty", () => {
    const ctx = buildVoiceContextData(emptyInputs());
    expect(ctx.totalPendingTasks).toBe(0);
    expect(ctx.totalOverdue).toBe(0);
    expect(ctx.totalEvents).toBe(0);
    expect(ctx.totalContacts).toBe(0);
    expect(ctx.totalContracts).toBe(0);
    expect(ctx.totalProjects).toBe(0);
    expect(ctx.totalHabits).toBe(0);
    expect(ctx.totalNotes).toBe(0);
    expect(ctx.totalUnreadEmails).toBe(0);
    expect(ctx.allTasks).toEqual([]);
    expect(ctx.unreadEmails).toEqual([]);
    expect(ctx.healthData.isConnected).toBe(false);
    expect(ctx.healthData.todaySummary).toBeNull();
  });

  it("filters trashed tasks out of allTasks and pending counts", () => {
    const inputs = emptyInputs();
    inputs.tasks = [
      {
        id: "1",
        title: "Live task",
        completed: false,
        trashed: false,
        category: "personal",
        priority: "medium",
        createdAt: new Date(),
      } as Task,
      {
        id: "2",
        title: "Trashed",
        completed: false,
        trashed: true,
        category: "personal",
        priority: "low",
        createdAt: new Date(),
      } as Task,
    ];
    const ctx = buildVoiceContextData(inputs);
    expect(ctx.allTasks).toHaveLength(1);
    expect(ctx.allTasks[0].id).toBe("1");
    expect(ctx.totalPendingTasks).toBe(1);
  });

  it("classifies overdue / today / upcoming tasks against `now`", () => {
    const inputs = emptyInputs();
    const yesterday = new Date(NOW.getTime() - 24 * 60 * 60 * 1000);
    const today = new Date(NOW.getTime());
    const inThreeDays = new Date(NOW.getTime() + 3 * 24 * 60 * 60 * 1000);
    const inTwoWeeks = new Date(NOW.getTime() + 14 * 24 * 60 * 60 * 1000);
    inputs.tasks = [
      {
        id: "o",
        title: "Overdue",
        completed: false,
        trashed: false,
        dueDate: yesterday,
        category: "personal",
        priority: "high",
        createdAt: new Date(),
      } as Task,
      {
        id: "t",
        title: "Today",
        completed: false,
        trashed: false,
        dueDate: today,
        category: "personal",
        priority: "medium",
        createdAt: new Date(),
      } as Task,
      {
        id: "u",
        title: "Upcoming",
        completed: false,
        trashed: false,
        dueDate: inThreeDays,
        category: "personal",
        priority: "low",
        createdAt: new Date(),
      } as Task,
      {
        id: "f",
        title: "Far off",
        completed: false,
        trashed: false,
        dueDate: inTwoWeeks,
        category: "personal",
        priority: "low",
        createdAt: new Date(),
      } as Task,
    ];
    const ctx = buildVoiceContextData(inputs);
    expect(ctx.totalOverdue).toBe(1);
    expect(ctx.todayTasks.map((t) => t.title)).toEqual(["Today"]);
    expect(ctx.upcomingTasks.map((t) => t.title)).toEqual(["Upcoming"]);
  });

  it("excludes inactive contracts from totals and listings", () => {
    const inputs = emptyInputs();
    inputs.contracts = [
      { id: "a", name: "Active", isActive: true, category: "subscription" } as Contract,
      { id: "b", name: "Inactive", isActive: false, category: "subscription" } as Contract,
    ];
    const ctx = buildVoiceContextData(inputs);
    expect(ctx.totalContracts).toBe(1);
    expect(ctx.allContracts.map((c) => c.id)).toEqual(["a"]);
  });

  it("only includes unread emails, capped at 10", () => {
    const inputs = emptyInputs();
    inputs.emailList = Array.from(
      { length: 15 },
      (_, i) =>
        ({
          id: String(i),
          subject: `s${i}`,
          from_email: "x@y",
          from_name: null,
          snippet: "",
          is_read: i >= 12,
          category: null,
          priority_score: 0,
          received_at: NOW.toISOString(),
          gmail_message_id: null,
          thread_id: null,
        }) as unknown as Parameters<typeof buildVoiceContextData>[0]["emailList"][number],
    );
    const ctx = buildVoiceContextData(inputs);
    // 12 unread, capped at 10
    expect(ctx.unreadEmails).toHaveLength(10);
    expect(ctx.unreadEmails.every((e) => e.subject.startsWith("s"))).toBe(true);
  });
});
