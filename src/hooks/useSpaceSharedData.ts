import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Task, CalendarEvent } from "@/types/flux";

export interface SpaceSharedTask extends Task {
  sharedByOwner?: {
    id: string;
    display_name: string | null;
    email: string | null;
    avatar_url: string | null;
  };
}

export interface SpaceSharedEvent extends CalendarEvent {
  sharedByOwner?: {
    id: string;
    display_name: string | null;
    email: string | null;
    avatar_url: string | null;
  };
}

export interface SpaceSharedContract {
  id: string;
  name: string;
  category: string;
  provider: string | null;
  cost_amount: number | null;
  cost_frequency: string | null;
  start_date: string | null;
  end_date: string | null;
  renewal_date: string | null;
  is_active: boolean;
  sharedByOwner?: {
    id: string;
    display_name: string | null;
    email: string | null;
  };
}

export interface SpaceSharedContact {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  role: string | null;
  contact_type: string;
  sharedByOwner?: {
    id: string;
    display_name: string | null;
    email: string | null;
  };
}

export function useSpaceSharedData(userId: string | undefined) {
  const [sharedTasks, setSharedTasks] = useState<SpaceSharedTask[]>([]);
  const [sharedEvents, setSharedEvents] = useState<SpaceSharedEvent[]>([]);
  const [sharedContracts, setSharedContracts] = useState<SpaceSharedContract[]>([]);
  const [sharedContacts, setSharedContacts] = useState<SpaceSharedContact[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchSpaceSharedData = useCallback(async () => {
    if (!userId) return;

    setLoading(true);
    try {
      // First, get all space memberships where user is a member with accepted status
      const { data: memberships, error: membershipError } = await supabase
        .from("space_members")
        .select("id, owner_id, space_share_settings(*)")
        .eq("member_id", userId)
        .eq("status", "accepted");

      if (membershipError) throw membershipError;

      if (!memberships || memberships.length === 0) {
        setSharedTasks([]);
        setSharedEvents([]);
        setSharedContracts([]);
        setSharedContacts([]);
        setLoading(false);
        return;
      }

      const allTasks: SpaceSharedTask[] = [];
      const allEvents: SpaceSharedEvent[] = [];
      const allContracts: SpaceSharedContract[] = [];
      const allContacts: SpaceSharedContact[] = [];

      for (const membership of memberships) {
        // Supabase types the embedded join as a single row, but the
        // runtime returns an array — index into it via an array cast.
        const shareSettings = membership.space_share_settings as unknown;
        const settings = (Array.isArray(shareSettings) ? shareSettings[0] : shareSettings) as
          | Record<string, unknown>
          | undefined;
        if (!settings) continue;

        // Get owner profile
        const { data: ownerProfile } = await supabase
          .from("profiles")
          .select("user_id, display_name, email, avatar_url")
          .eq("user_id", membership.owner_id)
          .maybeSingle();

        const ownerInfo = ownerProfile
          ? {
              id: ownerProfile.user_id,
              display_name: ownerProfile.display_name,
              email: ownerProfile.email,
              avatar_url: ownerProfile.avatar_url,
            }
          : undefined;

        // Fetch tasks based on category settings
        const taskCategories: string[] = [];
        if (settings.share_business_tasks) taskCategories.push("business");
        if (settings.share_personal_tasks) taskCategories.push("personal");
        if (settings.share_family_tasks) taskCategories.push("family");
        if (settings.share_work_tasks) taskCategories.push("work");

        if (taskCategories.length > 0) {
          const { data: tasks } = await supabase
            .from("tasks")
            .select("*")
            .eq("user_id", membership.owner_id)
            .eq("trashed", false)
            .in("category", taskCategories);

          if (tasks) {
            allTasks.push(
              ...tasks.map((task) => ({
                id: task.id,
                title: task.title,
                description: task.description,
                category: task.category as Task["category"],
                priority: task.priority as Task["priority"],
                completed: task.completed,
                dueDate: task.due_date ? new Date(task.due_date) : undefined,
                createdAt: new Date(task.created_at),
                recurrenceRule: task.recurrence_rule,
                recurrenceEnd: task.recurrence_end ? new Date(task.recurrence_end) : undefined,
                projectId: task.project_id,
                parentId: task.parent_id,
                sortOrder: task.sort_order,
                sharedByOwner: ownerInfo,
              })),
            );
          }
        }

        // Fetch events based on category settings
        const eventCategories: string[] = [];
        if (settings.share_business_events) eventCategories.push("business");
        if (settings.share_personal_events) eventCategories.push("personal");
        if (settings.share_family_events) eventCategories.push("family");
        if (settings.share_work_events) eventCategories.push("work");

        if (eventCategories.length > 0) {
          const { data: events } = await supabase
            .from("events")
            .select("*")
            .eq("user_id", membership.owner_id)
            .in("category", eventCategories);

          if (events) {
            allEvents.push(
              ...events.map(
                (event) =>
                  ({
                    id: event.id,
                    title: event.title,
                    description: event.description,
                    startTime: new Date(event.start_time),
                    endTime: new Date(event.end_time),
                    location: event.location,
                    category: (event.category || "personal") as CalendarEvent["category"],
                    attendees: event.attendees,
                    recurrenceRule: event.recurrence_rule,
                    recurrenceEnd: event.recurrence_end
                      ? new Date(event.recurrence_end)
                      : undefined,
                    sharedByOwner: ownerInfo,
                  }) as SpaceSharedEvent,
              ),
            );
          }
        }

        // Fetch contracts if shared
        if (settings.share_contracts) {
          const { data: contracts } = await supabase
            .from("contracts")
            .select("*")
            .eq("user_id", membership.owner_id);

          if (contracts) {
            allContracts.push(
              ...contracts.map((c) => ({
                ...c,
                is_active: c.is_active ?? true,
                sharedByOwner: ownerInfo,
              })),
            );
          }
        }

        // Fetch contacts if shared
        if (settings.share_contacts) {
          const { data: contacts } = await supabase
            .from("user_contacts")
            .select("*")
            .eq("user_id", membership.owner_id);

          if (contacts) {
            allContacts.push(
              ...contacts.map((c) => ({
                id: c.id,
                name: c.name,
                email: c.email,
                phone: c.phone,
                company: c.company,
                role: c.role,
                contact_type: c.contact_type,
                sharedByOwner: ownerInfo,
              })),
            );
          }
        }
      }

      setSharedTasks(allTasks);
      setSharedEvents(allEvents);
      setSharedContracts(allContracts);
      setSharedContacts(allContacts);
    } catch (error) {
      console.error("Error fetching space shared data:", error);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchSpaceSharedData();
  }, [fetchSpaceSharedData]);

  // Subscribe to realtime updates
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel("space-shared-data")
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, () =>
        fetchSpaceSharedData(),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "events" }, () =>
        fetchSpaceSharedData(),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "space_members" }, () =>
        fetchSpaceSharedData(),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "space_share_settings" }, () =>
        fetchSpaceSharedData(),
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
      supabase.removeChannel(channel);
    };
  }, [userId, fetchSpaceSharedData]);

  return {
    sharedTasks,
    sharedEvents,
    sharedContracts,
    sharedContacts,
    loading,
    refetch: fetchSpaceSharedData,
  };
}
