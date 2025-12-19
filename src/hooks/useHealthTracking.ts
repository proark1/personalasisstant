import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface Medication {
  id: string;
  user_id: string;
  family_member_id: string | null;
  name: string;
  dosage: string | null;
  frequency: string | null;
  start_date: string | null;
  end_date: string | null;
  prescribing_doctor: string | null;
  pharmacy: string | null;
  refill_date: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Appointment {
  id: string;
  user_id: string;
  family_member_id: string | null;
  title: string;
  appointment_type: string;
  provider_name: string | null;
  provider_phone: string | null;
  location: string | null;
  appointment_date: string;
  reminder_before: number;
  notes: string | null;
  is_completed: boolean;
  created_at: string;
}

export interface Vaccination {
  id: string;
  user_id: string;
  family_member_id: string | null;
  vaccine_name: string;
  date_administered: string;
  administered_by: string | null;
  location: string | null;
  lot_number: string | null;
  next_dose_date: string | null;
  notes: string | null;
  created_at: string;
}

export function useHealthTracking() {
  const { user } = useAuth();
  const [medications, setMedications] = useState<Medication[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [vaccinations, setVaccinations] = useState<Vaccination[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchAll = async () => {
    if (!user?.id) return;
    setIsLoading(true);
    await Promise.all([fetchMedications(), fetchAppointments(), fetchVaccinations()]);
    setIsLoading(false);
  };

  const fetchMedications = async () => {
    if (!user?.id) return;
    try {
      const { data, error } = await supabase
        .from('family_medications')
        .select('*')
        .eq('user_id', user.id)
        .order('name');
      if (error) throw error;
      setMedications(data || []);
    } catch (error) {
      console.error('Error fetching medications:', error);
    }
  };

  const fetchAppointments = async () => {
    if (!user?.id) return;
    try {
      const { data, error } = await supabase
        .from('family_appointments')
        .select('*')
        .eq('user_id', user.id)
        .order('appointment_date');
      if (error) throw error;
      setAppointments(data || []);
    } catch (error) {
      console.error('Error fetching appointments:', error);
    }
  };

  const fetchVaccinations = async () => {
    if (!user?.id) return;
    try {
      const { data, error } = await supabase
        .from('family_vaccinations')
        .select('*')
        .eq('user_id', user.id)
        .order('date_administered', { ascending: false });
      if (error) throw error;
      setVaccinations(data || []);
    } catch (error) {
      console.error('Error fetching vaccinations:', error);
    }
  };

  // Medications CRUD
  const addMedication = async (med: Omit<Medication, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
    if (!user?.id) return null;
    try {
      const { data, error } = await supabase
        .from('family_medications')
        .insert({ ...med, user_id: user.id })
        .select()
        .single();
      if (error) throw error;
      setMedications(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
      toast.success('Medication added');
      return data;
    } catch (error) {
      console.error('Error adding medication:', error);
      toast.error('Failed to add medication');
      return null;
    }
  };

  const updateMedication = async (id: string, updates: Partial<Medication>) => {
    try {
      const { data, error } = await supabase
        .from('family_medications')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      setMedications(prev => prev.map(m => m.id === id ? data : m));
      toast.success('Medication updated');
      return data;
    } catch (error) {
      console.error('Error updating medication:', error);
      toast.error('Failed to update medication');
      return null;
    }
  };

  const deleteMedication = async (id: string) => {
    try {
      const { error } = await supabase.from('family_medications').delete().eq('id', id);
      if (error) throw error;
      setMedications(prev => prev.filter(m => m.id !== id));
      toast.success('Medication deleted');
    } catch (error) {
      console.error('Error deleting medication:', error);
      toast.error('Failed to delete medication');
    }
  };

  // Appointments CRUD
  const addAppointment = async (appt: Omit<Appointment, 'id' | 'user_id' | 'created_at'>) => {
    if (!user?.id) return null;
    try {
      const { data, error } = await supabase
        .from('family_appointments')
        .insert({ ...appt, user_id: user.id })
        .select()
        .single();
      if (error) throw error;
      setAppointments(prev => [...prev, data].sort((a, b) => 
        new Date(a.appointment_date).getTime() - new Date(b.appointment_date).getTime()
      ));
      toast.success('Appointment added');
      return data;
    } catch (error) {
      console.error('Error adding appointment:', error);
      toast.error('Failed to add appointment');
      return null;
    }
  };

  const updateAppointment = async (id: string, updates: Partial<Appointment>) => {
    try {
      const { data, error } = await supabase
        .from('family_appointments')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      setAppointments(prev => prev.map(a => a.id === id ? data : a));
      toast.success('Appointment updated');
      return data;
    } catch (error) {
      console.error('Error updating appointment:', error);
      toast.error('Failed to update appointment');
      return null;
    }
  };

  const deleteAppointment = async (id: string) => {
    try {
      const { error } = await supabase.from('family_appointments').delete().eq('id', id);
      if (error) throw error;
      setAppointments(prev => prev.filter(a => a.id !== id));
      toast.success('Appointment deleted');
    } catch (error) {
      console.error('Error deleting appointment:', error);
      toast.error('Failed to delete appointment');
    }
  };

  // Vaccinations CRUD
  const addVaccination = async (vax: Omit<Vaccination, 'id' | 'user_id' | 'created_at'>) => {
    if (!user?.id) return null;
    try {
      const { data, error } = await supabase
        .from('family_vaccinations')
        .insert({ ...vax, user_id: user.id })
        .select()
        .single();
      if (error) throw error;
      setVaccinations(prev => [data, ...prev]);
      toast.success('Vaccination record added');
      return data;
    } catch (error) {
      console.error('Error adding vaccination:', error);
      toast.error('Failed to add vaccination');
      return null;
    }
  };

  const deleteVaccination = async (id: string) => {
    try {
      const { error } = await supabase.from('family_vaccinations').delete().eq('id', id);
      if (error) throw error;
      setVaccinations(prev => prev.filter(v => v.id !== id));
      toast.success('Vaccination record deleted');
    } catch (error) {
      console.error('Error deleting vaccination:', error);
      toast.error('Failed to delete vaccination');
    }
  };

  useEffect(() => {
    fetchAll();
  }, [user?.id]);

  const getUpcomingAppointments = () => appointments.filter(a => 
    !a.is_completed && new Date(a.appointment_date) >= new Date()
  );

  const getActiveMedications = () => medications.filter(m => m.is_active);

  const getMedicationsNeedingRefill = () => medications.filter(m => 
    m.is_active && m.refill_date && new Date(m.refill_date) <= new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  );

  return {
    medications,
    appointments,
    vaccinations,
    isLoading,
    addMedication,
    updateMedication,
    deleteMedication,
    addAppointment,
    updateAppointment,
    deleteAppointment,
    addVaccination,
    deleteVaccination,
    getUpcomingAppointments,
    getActiveMedications,
    getMedicationsNeedingRefill,
    refetch: fetchAll,
  };
}
