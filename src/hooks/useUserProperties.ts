import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

export interface UserProperty {
  id: string;
  user_id: string;
  name: string;
  property_type: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  current_value: number | null;
  mortgage_amount: number | null;
  mortgage_provider: string | null;
  insurance_provider: string | null;
  insurance_renewal: string | null;
  notes: string | null;
}
export interface Vehicle {
  id: string;
  user_id: string;
  name: string;
  make: string | null;
  model: string | null;
  year: number | null;
  license_plate: string | null;
  insurance_provider: string | null;
  insurance_renewal: string | null;
  next_service_date: string | null;
  next_inspection_date: string | null;
  current_mileage: number | null;
  notes: string | null;
}
export interface MaintenanceEntry {
  id: string;
  user_id: string;
  property_id: string | null;
  vehicle_id: string | null;
  title: string;
  description: string | null;
  performed_on: string;
  next_due_date: string | null;
  cost: number | null;
  provider: string | null;
}
export interface InventoryItem {
  id: string;
  user_id: string;
  property_id: string | null;
  name: string;
  category: string | null;
  brand: string | null;
  serial_number: string | null;
  purchase_date: string | null;
  purchase_price: number | null;
  current_value: number | null;
  warranty_until: string | null;
  notes: string | null;
}

export function useUserProperties() {
  const { user } = useAuth();
  const [properties, setProperties] = useState<UserProperty[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [maintenance, setMaintenance] = useState<MaintenanceEntry[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const [p, v, m, i] = await Promise.all([
        supabase.from("user_properties").select("*").eq("user_id", user.id).order("name"),
        supabase.from("vehicles").select("*").eq("user_id", user.id).order("name"),
        supabase
          .from("maintenance_log")
          .select("*")
          .eq("user_id", user.id)
          .order("performed_on", { ascending: false }),
        supabase.from("inventory_items").select("*").eq("user_id", user.id).order("name"),
      ]);
      setProperties((p.data as UserProperty[]) || []);
      setVehicles((v.data as Vehicle[]) || []);
      setMaintenance((m.data as MaintenanceEntry[]) || []);
      setInventory((i.data as InventoryItem[]) || []);
    } finally {
      setIsLoading(false);
    }
  };
  useEffect(() => {
    if (user) refresh();
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const addProperty = async (p: Partial<UserProperty>) => {
    if (!user) return;
    const { error } = await supabase
      .from("user_properties")
      .insert({ ...p, user_id: user.id, name: p.name! });
    if (error) return toast.error(error.message);
    toast.success("Added");
    refresh();
  };
  const addVehicle = async (p: Partial<Vehicle>) => {
    if (!user) return;
    const { error } = await supabase
      .from("vehicles")
      .insert({ ...p, user_id: user.id, name: p.name! });
    if (error) return toast.error(error.message);
    toast.success("Added");
    refresh();
  };
  const addMaintenance = async (p: Partial<MaintenanceEntry>) => {
    if (!user) return;
    const { error } = await supabase.from("maintenance_log").insert({
      ...p,
      user_id: user.id,
      title: p.title!,
      performed_on: p.performed_on || new Date().toISOString().slice(0, 10),
    });
    if (error) return toast.error(error.message);
    toast.success("Logged");
    refresh();
  };
  const addInventory = async (p: Partial<InventoryItem>) => {
    if (!user) return;
    const { error } = await supabase
      .from("inventory_items")
      .insert({ ...p, user_id: user.id, name: p.name! });
    if (error) return toast.error(error.message);
    toast.success("Added");
    refresh();
  };
  const remove = async (
    table: "user_properties" | "vehicles" | "maintenance_log" | "inventory_items",
    id: string,
  ) => {
    const { error } = await supabase.from(table).delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    refresh();
  };

  return {
    properties,
    vehicles,
    maintenance,
    inventory,
    isLoading,
    addProperty,
    addVehicle,
    addMaintenance,
    addInventory,
    remove,
    refresh,
  };
}
