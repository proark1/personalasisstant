import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';
import { Json } from '@/integrations/supabase/types';

export interface FamilyMember {
  id: string;
  user_id: string;
  contact_id: string | null;
  name: string;
  relationship: string;
  birth_date: string | null;
  avatar_url: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  school_name: string | null;
  school_grade: string | null;
  teacher_name: string | null;
  teacher_contact: string | null;
  allergies: string[] | null;
  medical_notes: string | null;
  clothing_sizes: Record<string, string>;
  activities: Activity[];
  milestones: Milestone[];
  preferences: Record<string, unknown>;
  lives_with_user: boolean;
  address: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Activity {
  name: string;
  schedule: string;
  location: string;
}

export interface Milestone {
  date: string;
  title: string;
  notes: string;
}

export function useFamilyMembers() {
  const { user } = useAuth();
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const parseJsonArray = <T,>(data: Json | null, defaultValue: T[]): T[] => {
    if (!data) return defaultValue;
    if (Array.isArray(data)) return data as unknown as T[];
    return defaultValue;
  };

  const parseJsonObject = <T extends Record<string, unknown>>(data: Json | null, defaultValue: T): T => {
    if (!data) return defaultValue;
    if (typeof data === 'object' && !Array.isArray(data)) return data as unknown as T;
    return defaultValue;
  };

  const fetchMembers = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('family_members')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      
      setMembers((data || []).map(m => ({
        ...m,
        clothing_sizes: parseJsonObject(m.clothing_sizes, {}),
        activities: parseJsonArray<Activity>(m.activities, []),
        milestones: parseJsonArray<Milestone>(m.milestones, []),
        preferences: parseJsonObject(m.preferences, {}),
      })));
    } catch (error) {
      console.error('Error fetching family members:', error);
      toast.error('Failed to load family members');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, [user]);

  const addMember = async (member: Omit<FamilyMember, 'id' | 'created_at' | 'updated_at' | 'user_id'>) => {
    if (!user) return null;

    try {
      const { data, error } = await supabase
        .from('family_members')
        .insert({
          ...member,
          user_id: user.id,
          contact_id: member.contact_id || null,
          activities: member.activities as unknown as Json,
          milestones: member.milestones as unknown as Json,
          clothing_sizes: member.clothing_sizes as unknown as Json,
          preferences: member.preferences as unknown as Json,
        })
        .select()
        .single();

      if (error) throw error;
      
      const newMember: FamilyMember = {
        ...data,
        clothing_sizes: parseJsonObject(data.clothing_sizes, {}),
        activities: parseJsonArray<Activity>(data.activities, []),
        milestones: parseJsonArray<Milestone>(data.milestones, []),
        preferences: parseJsonObject(data.preferences, {}),
      };
      
      setMembers(prev => [...prev, newMember]);
      toast.success('Family member added');
      return newMember;
    } catch (error) {
      console.error('Error adding family member:', error);
      toast.error('Failed to add family member');
      return null;
    }
  };

  const updateMember = async (id: string, updates: Partial<Omit<FamilyMember, 'id' | 'created_at' | 'updated_at' | 'user_id'>>) => {
    try {
      const dbUpdates: Record<string, unknown> = { ...updates };
      if (updates.activities) dbUpdates.activities = updates.activities as unknown as Json;
      if (updates.milestones) dbUpdates.milestones = updates.milestones as unknown as Json;
      if (updates.clothing_sizes) dbUpdates.clothing_sizes = updates.clothing_sizes as unknown as Json;
      if (updates.preferences) dbUpdates.preferences = updates.preferences as unknown as Json;

      const { data, error } = await supabase
        .from('family_members')
        .update(dbUpdates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      
      const updatedMember: FamilyMember = {
        ...data,
        clothing_sizes: parseJsonObject(data.clothing_sizes, {}),
        activities: parseJsonArray<Activity>(data.activities, []),
        milestones: parseJsonArray<Milestone>(data.milestones, []),
        preferences: parseJsonObject(data.preferences, {}),
      };
      
      setMembers(prev => prev.map(m => m.id === id ? updatedMember : m));
      toast.success('Family member updated');
      return updatedMember;
    } catch (error) {
      console.error('Error updating family member:', error);
      toast.error('Failed to update family member');
      return null;
    }
  };

  const deleteMember = async (id: string) => {
    try {
      const { error } = await supabase
        .from('family_members')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;
      
      setMembers(prev => prev.filter(m => m.id !== id));
      toast.success('Family member removed');
      return true;
    } catch (error) {
      console.error('Error deleting family member:', error);
      toast.error('Failed to remove family member');
      return false;
    }
  };

  const getChildren = () => members.filter(m => m.relationship === 'child');
  const getSpouse = () => members.find(m => m.relationship === 'spouse');
  const getParents = () => members.filter(m => m.relationship === 'parent');
  const getSiblings = () => members.filter(m => m.relationship === 'sibling');
  const getGrandparents = () => members.filter(m => m.relationship === 'grandparent');

  const getUpcomingBirthdays = (days: number = 30) => {
    const today = new Date();
    const endDate = new Date(today.getTime() + days * 24 * 60 * 60 * 1000);
    
    return members.filter(m => {
      if (!m.birth_date) return false;
      const birthDate = new Date(m.birth_date);
      const thisYearBirthday = new Date(today.getFullYear(), birthDate.getMonth(), birthDate.getDate());
      if (thisYearBirthday < today) thisYearBirthday.setFullYear(today.getFullYear() + 1);
      return thisYearBirthday >= today && thisYearBirthday <= endDate;
    }).map(m => {
      const birthDate = new Date(m.birth_date!);
      const thisYearBirthday = new Date(today.getFullYear(), birthDate.getMonth(), birthDate.getDate());
      if (thisYearBirthday < today) thisYearBirthday.setFullYear(today.getFullYear() + 1);
      const age = thisYearBirthday.getFullYear() - birthDate.getFullYear();
      return { ...m, upcomingAge: age, birthdayDate: thisYearBirthday };
    }).sort((a, b) => a.birthdayDate.getTime() - b.birthdayDate.getTime());
  };

  return {
    members,
    isLoading,
    addMember,
    updateMember,
    deleteMember,
    getChildren,
    getSpouse,
    getParents,
    getSiblings,
    getGrandparents,
    getUpcomingBirthdays,
    refetch: fetchMembers,
  };
}
