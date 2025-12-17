import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type ContactType = 'personal' | 'business';
export type PersonalTier = 'family' | 'close_friend' | 'friend' | 'acquaintance';
export type BusinessLevel = 'very_well' | 'well' | 'barely' | 'not_contacted';

export interface Contact {
  id: string;
  userId: string;
  contactUserId?: string;
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  role?: string;
  contactType: ContactType;
  personalTier?: PersonalTier;
  businessLevel?: BusinessLevel;
  contactFrequencyDays: number;
  lastContactedAt?: Date;
  nextContactDue?: Date;
  notes?: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ContactInput {
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  role?: string;
  contactType: ContactType;
  personalTier?: PersonalTier;
  businessLevel?: BusinessLevel;
  contactFrequencyDays?: number;
  notes?: string;
  tags?: string[];
}

// Default contact frequencies based on relationship
export const DEFAULT_FREQUENCIES: Record<PersonalTier | BusinessLevel, number> = {
  family: 14,
  close_friend: 30,
  friend: 60,
  acquaintance: 90,
  very_well: 30,
  well: 60,
  barely: 90,
  not_contacted: 0,
};

export function useContacts(userId: string | undefined) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);

  const mapDbToContact = (row: any): Contact => ({
    id: row.id,
    userId: row.user_id,
    contactUserId: row.contact_user_id || undefined,
    name: row.name,
    email: row.email || undefined,
    phone: row.phone || undefined,
    company: row.company || undefined,
    role: row.role || undefined,
    contactType: row.contact_type as ContactType,
    personalTier: row.personal_tier as PersonalTier | undefined,
    businessLevel: row.business_level as BusinessLevel | undefined,
    contactFrequencyDays: row.contact_frequency_days || 30,
    lastContactedAt: row.last_contacted_at ? new Date(row.last_contacted_at) : undefined,
    nextContactDue: row.next_contact_due ? new Date(row.next_contact_due) : undefined,
    notes: row.notes || undefined,
    tags: row.tags || [],
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  });

  const fetchContacts = useCallback(async () => {
    if (!userId) {
      setContacts([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data, error } = await supabase
      .from('user_contacts')
      .select('*')
      .eq('user_id', userId)
      .order('name');

    if (data && !error) {
      setContacts(data.map(mapDbToContact));
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  const addContact = useCallback(async (input: ContactInput): Promise<Contact | null> => {
    if (!userId) return null;

    // Calculate next contact due based on frequency
    const frequencyDays = input.contactFrequencyDays || 
      (input.personalTier ? DEFAULT_FREQUENCIES[input.personalTier] : 
       input.businessLevel ? DEFAULT_FREQUENCIES[input.businessLevel] : 30);
    
    const nextContactDue = new Date();
    nextContactDue.setDate(nextContactDue.getDate() + frequencyDays);

    const { data, error } = await supabase
      .from('user_contacts')
      .insert({
        user_id: userId,
        name: input.name,
        email: input.email || null,
        phone: input.phone || null,
        company: input.company || null,
        role: input.role || null,
        contact_type: input.contactType,
        personal_tier: input.personalTier || null,
        business_level: input.businessLevel || null,
        contact_frequency_days: frequencyDays,
        next_contact_due: nextContactDue.toISOString(),
        notes: input.notes || null,
        tags: input.tags || [],
      })
      .select()
      .single();

    if (data && !error) {
      const newContact = mapDbToContact(data);
      setContacts(prev => [...prev, newContact].sort((a, b) => a.name.localeCompare(b.name)));
      return newContact;
    }
    return null;
  }, [userId]);

  const updateContact = useCallback(async (
    id: string, 
    updates: Partial<ContactInput>
  ): Promise<boolean> => {
    const dbUpdates: Record<string, any> = {};
    
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.email !== undefined) dbUpdates.email = updates.email || null;
    if (updates.phone !== undefined) dbUpdates.phone = updates.phone || null;
    if (updates.company !== undefined) dbUpdates.company = updates.company || null;
    if (updates.role !== undefined) dbUpdates.role = updates.role || null;
    if (updates.contactType !== undefined) dbUpdates.contact_type = updates.contactType;
    if (updates.personalTier !== undefined) dbUpdates.personal_tier = updates.personalTier || null;
    if (updates.businessLevel !== undefined) dbUpdates.business_level = updates.businessLevel || null;
    if (updates.contactFrequencyDays !== undefined) dbUpdates.contact_frequency_days = updates.contactFrequencyDays;
    if (updates.notes !== undefined) dbUpdates.notes = updates.notes || null;
    if (updates.tags !== undefined) dbUpdates.tags = updates.tags;

    const { error } = await supabase
      .from('user_contacts')
      .update(dbUpdates)
      .eq('id', id);

    if (!error) {
      setContacts(prev => prev.map(c => 
        c.id === id ? { ...c, ...updates, updatedAt: new Date() } : c
      ));
      return true;
    }
    return false;
  }, []);

  const deleteContact = useCallback(async (id: string): Promise<boolean> => {
    const { error } = await supabase
      .from('user_contacts')
      .delete()
      .eq('id', id);

    if (!error) {
      setContacts(prev => prev.filter(c => c.id !== id));
      return true;
    }
    return false;
  }, []);

  const markContacted = useCallback(async (id: string): Promise<boolean> => {
    const contact = contacts.find(c => c.id === id);
    if (!contact) return false;

    const now = new Date();
    const nextDue = new Date();
    nextDue.setDate(nextDue.getDate() + contact.contactFrequencyDays);

    const { error } = await supabase
      .from('user_contacts')
      .update({
        last_contacted_at: now.toISOString(),
        next_contact_due: nextDue.toISOString(),
      })
      .eq('id', id);

    if (!error) {
      setContacts(prev => prev.map(c => 
        c.id === id ? { ...c, lastContactedAt: now, nextContactDue: nextDue } : c
      ));
      return true;
    }
    return false;
  }, [contacts]);

  // Get contacts due for follow-up
  const getContactsDue = useCallback(() => {
    const now = new Date();
    return contacts.filter(c => c.nextContactDue && c.nextContactDue <= now);
  }, [contacts]);

  // Search contacts by notes/tags for AI suggestions
  const searchByContext = useCallback((query: string): Contact[] => {
    const lowerQuery = query.toLowerCase();
    return contacts.filter(c => 
      c.notes?.toLowerCase().includes(lowerQuery) ||
      c.tags.some(tag => tag.toLowerCase().includes(lowerQuery)) ||
      c.name.toLowerCase().includes(lowerQuery) ||
      c.company?.toLowerCase().includes(lowerQuery) ||
      c.role?.toLowerCase().includes(lowerQuery)
    );
  }, [contacts]);

  // Get contacts by type
  const personalContacts = contacts.filter(c => c.contactType === 'personal');
  const businessContacts = contacts.filter(c => c.contactType === 'business');

  return {
    contacts,
    personalContacts,
    businessContacts,
    loading,
    addContact,
    updateContact,
    deleteContact,
    markContacted,
    getContactsDue,
    searchByContext,
    refetch: fetchContacts,
  };
}
