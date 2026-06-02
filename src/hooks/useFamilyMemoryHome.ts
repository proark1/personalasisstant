import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface FamilyTradition {
  id: string;
  title: string;
  description: string | null;
  cadence: string;
  next_occurrence: string | null;
  is_active: boolean;
  last_celebrated_at: string | null;
}

export interface Pet {
  id: string;
  name: string;
  species: string | null;
  breed: string | null;
  date_of_birth: string | null;
  weight_kg: number | null;
  vet_name: string | null;
  vet_phone: string | null;
  food_brand: string | null;
  next_vaccination_date: string | null;
  next_vet_checkup: string | null;
  notes: string | null;
}

export interface HouseholdMaintenanceItem {
  id: string;
  task_name: string;
  category: string | null;
  frequency_months: number | null;
  last_done_date: string | null;
  next_due_date: string | null;
  provider_name: string | null;
  provider_phone: string | null;
  cost_estimate: number | null;
  is_active: boolean;
  notes: string | null;
}

export interface VehicleRecord {
  id: string;
  nickname: string;
  make: string | null;
  model: string | null;
  year: number | null;
  license_plate: string | null;
  current_mileage: number | null;
  next_inspection_date: string | null;
  insurance_provider: string | null;
  insurance_renewal_date: string | null;
  next_service_date: string | null;
  next_tire_change_date: string | null;
  notes: string | null;
}

export function useFamilyMemoryHome() {
  const { user } = useAuth();
  const [traditions, setTraditions] = useState<FamilyTradition[]>([]);
  const [pets, setPets] = useState<Pet[]>([]);
  const [maintenance, setMaintenance] = useState<HouseholdMaintenanceItem[]>([]);
  const [vehicles, setVehicles] = useState<VehicleRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [t, p, m, v] = await Promise.all([
      supabase.from('family_traditions').select('*').eq('user_id', user.id).order('next_occurrence', { ascending: true, nullsFirst: false }),
      supabase.from('pets').select('*').eq('user_id', user.id).order('name'),
      supabase.from('household_maintenance').select('*').eq('user_id', user.id).order('next_due_date', { ascending: true, nullsFirst: false }),
      supabase.from('vehicle_records').select('*').eq('user_id', user.id).order('nickname'),
    ]);
    setTraditions((t.data as unknown as FamilyTradition[]) || []);
    setPets((p.data as unknown as Pet[]) || []);
    setMaintenance((m.data as unknown as HouseholdMaintenanceItem[]) || []);
    setVehicles((v.data as unknown as VehicleRecord[]) || []);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const addTradition = async (data: Partial<FamilyTradition>) => {
    if (!user) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const traditionPayload = { ...data, user_id: user.id, title: data.title!, cadence: data.cadence || 'annual', is_active: true } as any;
    const { error } = await supabase.from('family_traditions').insert(traditionPayload);
    if (error) { toast.error(error.message); return; }
    toast.success('Tradition saved'); fetchAll();
  };

  const addPet = async (data: Partial<Pet>) => {
    if (!user) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await supabase.from('pets').insert({ ...data, user_id: user.id, name: data.name! } as any);
    if (error) { toast.error(error.message); return; }
    toast.success('Pet added'); fetchAll();
  };

  const addMaintenance = async (data: Partial<HouseholdMaintenanceItem>) => {
    if (!user) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const maintenancePayload = { ...data, user_id: user.id, task_name: data.task_name!, is_active: true } as any;
    const { error } = await supabase.from('household_maintenance').insert(maintenancePayload);
    if (error) { toast.error(error.message); return; }
    toast.success('Maintenance task added'); fetchAll();
  };

  const addVehicle = async (data: Partial<VehicleRecord>) => {
    if (!user) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await supabase.from('vehicle_records').insert({ ...data, user_id: user.id, nickname: data.nickname! } as any);
    if (error) { toast.error(error.message); return; }
    toast.success('Vehicle added'); fetchAll();
  };

  return { traditions, pets, maintenance, vehicles, loading, addTradition, addPet, addMaintenance, addVehicle, refresh: fetchAll };
}
