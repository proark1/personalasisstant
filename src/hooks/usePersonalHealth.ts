import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

export interface Medication {
  id: string;
  user_id: string;
  name: string;
  dose: string | null;
  frequency: string | null;
  schedule: string | null;
  start_date: string | null;
  end_date: string | null;
  refill_date: string | null;
  prescriber: string | null;
  reason: string | null;
  is_active: boolean | null;
  notes: string | null;
}
export interface Doctor {
  id: string;
  user_id: string;
  name: string;
  specialty: string | null;
  clinic: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  last_visit: string | null;
  next_visit: string | null;
  notes: string | null;
}
export interface LabResult {
  id: string;
  user_id: string;
  test_name: string;
  test_date: string;
  value: number | null;
  unit: string | null;
  reference_low: number | null;
  reference_high: number | null;
  status: string | null;
  doctor_id: string | null;
  notes: string | null;
}
export interface Workout {
  id: string;
  user_id: string;
  workout_date: string;
  workout_type: string | null;
  duration_minutes: number | null;
  exercises: unknown;
  notes: string | null;
  felt_rating: number | null;
}

export function usePersonalHealth() {
  const { user } = useAuth();
  const [medications, setMedications] = useState<Medication[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [labResults, setLabResults] = useState<LabResult[]>([]);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const [m, d, l, w] = await Promise.all([
        supabase
          .from("personal_medications")
          .select("*")
          .eq("user_id", user.id)
          .order("is_active", { ascending: false })
          .order("name"),
        supabase.from("personal_doctors").select("*").eq("user_id", user.id).order("name"),
        supabase
          .from("lab_results")
          .select("*")
          .eq("user_id", user.id)
          .order("test_date", { ascending: false })
          .limit(200),
        supabase
          .from("workouts")
          .select("*")
          .eq("user_id", user.id)
          .order("workout_date", { ascending: false })
          .limit(100),
      ]);
      setMedications((m.data as Medication[]) || []);
      setDoctors((d.data as Doctor[]) || []);
      setLabResults((l.data as LabResult[]) || []);
      setWorkouts((w.data as Workout[]) || []);
    } finally {
      setIsLoading(false);
    }
  };
  useEffect(() => {
    if (user) refresh();
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const addMedication = async (p: Partial<Medication>) => {
    if (!user) return;
    const { error } = await supabase
      .from("personal_medications")
      .insert({ ...p, user_id: user.id, name: p.name! });
    if (error) return toast.error(error.message);
    toast.success("Added");
    refresh();
  };
  const addDoctor = async (p: Partial<Doctor>) => {
    if (!user) return;
    const { error } = await supabase
      .from("personal_doctors")
      .insert({ ...p, user_id: user.id, name: p.name! });
    if (error) return toast.error(error.message);
    toast.success("Added");
    refresh();
  };
  const addLabResult = async (p: Partial<LabResult>) => {
    if (!user) return;
    const { error } = await supabase.from("lab_results").insert({
      ...p,
      user_id: user.id,
      test_name: p.test_name!,
      test_date: p.test_date || new Date().toISOString().slice(0, 10),
    });
    if (error) return toast.error(error.message);
    toast.success("Added");
    refresh();
  };

  const addWorkout = async (p: Partial<Workout>) => {
    if (!user) return;
    const { error } = await supabase.from("workouts").insert({
      ...(p as any),
      user_id: user.id,
      workout_date: p.workout_date || new Date().toISOString().slice(0, 10),
    });
    if (error) return toast.error(error.message);
    toast.success("Logged");
    refresh();
  };
  const remove = async (
    table: "personal_medications" | "personal_doctors" | "lab_results" | "workouts",
    id: string,
  ) => {
    const { error } = await supabase.from(table).delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    refresh();
  };

  return {
    medications,
    doctors,
    labResults,
    workouts,
    isLoading,
    addMedication,
    addDoctor,
    addLabResult,
    addWorkout,
    remove,
    refresh,
  };
}
