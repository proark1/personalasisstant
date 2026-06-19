import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

export interface SpecialDate {
  id: string;
  user_id: string;
  contact_id: string | null;
  date_type: string;
  occurs_on: string;
  reminder_days_before: number | null;
  notes: string | null;
}
export interface Gift {
  id: string;
  user_id: string;
  contact_id: string | null;
  occasion: string | null;
  given_on: string;
  gift_description: string;
  cost: number | null;
  reaction: string | null;
  notes: string | null;
}
export interface FriendCircle {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  color: string | null;
}
export interface FriendCircleMember {
  id: string;
  user_id: string;
  circle_id: string;
  contact_id: string;
}

export function useRelationshipsPlus() {
  const { user } = useAuth();
  const [specialDates, setSpecialDates] = useState<SpecialDate[]>([]);
  const [gifts, setGifts] = useState<Gift[]>([]);
  const [circles, setCircles] = useState<FriendCircle[]>([]);
  const [circleMembers, setCircleMembers] = useState<FriendCircleMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const [s, g, c, m] = await Promise.all([
        supabase
          .from("contact_special_dates")
          .select("*")
          .eq("user_id", user.id)
          .order("occurs_on"),
        supabase
          .from("gift_log")
          .select("*")
          .eq("user_id", user.id)
          .order("given_on", { ascending: false }),
        supabase.from("friend_circles").select("*").eq("user_id", user.id).order("name"),
        supabase.from("friend_circle_members").select("*").eq("user_id", user.id),
      ]);
      setSpecialDates((s.data as SpecialDate[]) || []);
      setGifts((g.data as Gift[]) || []);
      setCircles((c.data as FriendCircle[]) || []);
      setCircleMembers((m.data as FriendCircleMember[]) || []);
    } finally {
      setIsLoading(false);
    }
  };
  useEffect(() => {
    if (user) refresh();
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const addSpecialDate = async (p: Partial<SpecialDate>) => {
    if (!user) return;
    const { error } = await supabase.from("contact_special_dates").insert({
      ...p,
      user_id: user.id,
      date_type: p.date_type || "birthday",
      occurs_on: p.occurs_on!,
    });
    if (error) return toast.error(error.message);
    toast.success("Added");
    refresh();
  };
  const addGift = async (p: Partial<Gift>) => {
    if (!user) return;
    const { error } = await supabase.from("gift_log").insert({
      ...p,
      user_id: user.id,
      gift_description: p.gift_description!,
      given_on: p.given_on || new Date().toISOString().slice(0, 10),
    });
    if (error) return toast.error(error.message);
    toast.success("Added");
    refresh();
  };
  const addCircle = async (p: Partial<FriendCircle>) => {
    if (!user) return;
    const { error } = await supabase
      .from("friend_circles")
      .insert({ ...p, user_id: user.id, name: p.name! });
    if (error) return toast.error(error.message);
    toast.success("Added");
    refresh();
  };
  const addCircleMember = async (circle_id: string, contact_id: string) => {
    if (!user) return;
    const { error } = await supabase
      .from("friend_circle_members")
      .insert({ user_id: user.id, circle_id, contact_id });
    if (error) return toast.error(error.message);
    refresh();
  };
  const remove = async (
    table: "contact_special_dates" | "gift_log" | "friend_circles" | "friend_circle_members",
    id: string,
  ) => {
    const { error } = await supabase.from(table).delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    refresh();
  };

  return {
    specialDates,
    gifts,
    circles,
    circleMembers,
    isLoading,
    addSpecialDate,
    addGift,
    addCircle,
    addCircleMember,
    remove,
    refresh,
  };
}
