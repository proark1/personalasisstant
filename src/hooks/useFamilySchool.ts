import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

export interface SchoolEvent {
  id: string;
  user_id: string;
  family_member_id: string | null;
  event_type: string;
  title: string;
  start_date: string;
  end_date: string | null;
  description: string | null;
}

export interface PickupRota {
  id: string;
  user_id: string;
  family_member_id: string;
  day_of_week: number;
  pickup_time: string | null;
  dropoff_time: string | null;
  responsible_person: string | null;
  location: string | null;
  notes: string | null;
  is_active: boolean;
}

export interface Classmate {
  id: string;
  user_id: string;
  family_member_id: string;
  child_name: string;
  parent_name: string | null;
  parent_phone: string | null;
  parent_email: string | null;
  relationship_type: string | null;
  birthday: string | null;
  notes: string | null;
}

export interface Equipment {
  id: string;
  user_id: string;
  family_member_id: string | null;
  item_name: string;
  category: string | null;
  size: string | null;
  brand: string | null;
  condition: string | null;
  needs_replacement: boolean;
  replacement_reason: string | null;
}

export interface HomeworkSlot {
  id: string;
  user_id: string;
  family_member_id: string;
  day_of_week: number;
  subject: string;
  estimated_minutes: number | null;
  notes: string | null;
}

export function useFamilySchool() {
  const { user } = useAuth();
  const [schoolEvents, setSchoolEvents] = useState<SchoolEvent[]>([]);
  const [rota, setRota] = useState<PickupRota[]>([]);
  const [classmates, setClassmates] = useState<Classmate[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [homework, setHomework] = useState<HomeworkSlot[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const [se, r, cm, eq, hw] = await Promise.all([
        supabase
          .from("family_school_calendar")
          .select("*")
          .eq("user_id", user.id)
          .gte("start_date", new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10))
          .order("start_date"),
        supabase
          .from("family_pickup_rota")
          .select("*")
          .eq("user_id", user.id)
          .eq("is_active", true)
          .order("day_of_week"),
        supabase.from("family_classmates").select("*").eq("user_id", user.id).order("child_name"),
        supabase
          .from("family_equipment")
          .select("*")
          .eq("user_id", user.id)
          .order("updated_at", { ascending: false }),
        supabase
          .from("family_homework_schedule")
          .select("*")
          .eq("user_id", user.id)
          .order("day_of_week"),
      ]);
      setSchoolEvents((se.data || []) as SchoolEvent[]);
      setRota((r.data || []) as PickupRota[]);
      setClassmates((cm.data || []) as Classmate[]);
      setEquipment((eq.data || []) as Equipment[]);
      setHomework((hw.data || []) as HomeworkSlot[]);
    } catch (e) {
      console.error("useFamilySchool fetch error", e);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const addSchoolEvent = async (e: Omit<SchoolEvent, "id" | "user_id">) => {
    if (!user) return null;
    const { data, error } = await supabase
      .from("family_school_calendar")
      .insert({ ...e, user_id: user.id })
      .select()
      .single();
    if (error) {
      toast.error("Failed to add");
      return null;
    }
    setSchoolEvents((prev) =>
      [...prev, data as SchoolEvent].sort((a, b) => a.start_date.localeCompare(b.start_date)),
    );
    toast.success("Added to school calendar");
    return data;
  };

  const addRotaEntry = async (r: Omit<PickupRota, "id" | "user_id">) => {
    if (!user) return null;
    const { data, error } = await supabase
      .from("family_pickup_rota")
      .insert({ ...r, user_id: user.id })
      .select()
      .single();
    if (error) {
      toast.error("Failed to add");
      return null;
    }
    setRota((prev) => [...prev, data as PickupRota].sort((a, b) => a.day_of_week - b.day_of_week));
    toast.success("Pickup rota updated");
    return data;
  };

  const addClassmate = async (c: Omit<Classmate, "id" | "user_id">) => {
    if (!user) return null;
    const { data, error } = await supabase
      .from("family_classmates")
      .insert({ ...c, user_id: user.id })
      .select()
      .single();
    if (error) {
      toast.error("Failed to add");
      return null;
    }
    setClassmates((prev) => [...prev, data as Classmate]);
    toast.success("Classmate added");
    return data;
  };

  const addEquipment = async (e: Omit<Equipment, "id" | "user_id">) => {
    if (!user) return null;
    const { data, error } = await supabase
      .from("family_equipment")
      .insert({ ...e, user_id: user.id })
      .select()
      .single();
    if (error) {
      toast.error("Failed to add");
      return null;
    }
    setEquipment((prev) => [data as Equipment, ...prev]);
    toast.success("Equipment added");
    return data;
  };

  const flagEquipment = async (id: string, needs: boolean, reason?: string) => {
    const { error } = await supabase
      .from("family_equipment")
      .update({ needs_replacement: needs, replacement_reason: reason || null })
      .eq("id", id);
    if (error) {
      toast.error("Failed to update");
      return;
    }
    setEquipment((prev) =>
      prev.map((e) =>
        e.id === id ? { ...e, needs_replacement: needs, replacement_reason: reason || null } : e,
      ),
    );
    toast.success(needs ? "Flagged for replacement" : "Cleared");
  };

  const upcomingSchoolEvents = schoolEvents.filter((e) => {
    const days = Math.floor((new Date(e.start_date).getTime() - Date.now()) / 86400000);
    return days >= -1 && days <= 30;
  });

  const equipmentNeedingReplacement = equipment.filter((e) => e.needs_replacement);

  const todaysRota = rota.filter((r) => r.day_of_week === new Date().getDay());

  return {
    schoolEvents,
    upcomingSchoolEvents,
    rota,
    todaysRota,
    classmates,
    equipment,
    equipmentNeedingReplacement,
    homework,
    isLoading,
    addSchoolEvent,
    addRotaEntry,
    addClassmate,
    addEquipment,
    flagEquipment,
    refetch: fetchAll,
  };
}
