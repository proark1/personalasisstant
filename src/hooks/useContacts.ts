import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { moduleBus } from '@/lib/moduleEventBus';
import { moduleHealth } from '@/lib/moduleHealth';

export type ContactType = 'personal' | 'business';
export type PersonalTier = 'family' | 'close_friend' | 'friend' | 'acquaintance';
export type BusinessLevel = 'very_well' | 'well' | 'barely' | 'not_contacted';

export type FamilyRelationship = 'spouse' | 'partner' | 'mother' | 'father' | 'daughter' | 'son' | 'sister' | 'brother' | 'grandmother' | 'grandfather' | 'granddaughter' | 'grandson' | 'aunt' | 'uncle' | 'cousin' | 'niece' | 'nephew' | 'mother_in_law' | 'father_in_law' | 'other';

export interface Contact {
  id: string;
  userId: string;
  contactUserId?: string;
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  role?: string;
  country?: string;
  city?: string;
  contactType: ContactType;
  personalTier?: PersonalTier;
  businessLevel?: BusinessLevel;
  familyRelationship?: FamilyRelationship;
  contactFrequencyDays: number;
  lastContactedAt?: Date;
  nextContactDue?: Date;
  notes?: string;
  tags: string[];
  linkedinUrl?: string;
  twitterUrl?: string;
  websiteUrl?: string;
  birthDate?: string;
  birthdayReminder?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ContactInput {
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  role?: string;
  country?: string;
  city?: string;
  contactType: ContactType;
  personalTier?: PersonalTier;
  businessLevel?: BusinessLevel;
  familyRelationship?: FamilyRelationship;
  contactFrequencyDays?: number;
  notes?: string;
  tags?: string[];
  linkedinUrl?: string;
  twitterUrl?: string;
  websiteUrl?: string;
  birthDate?: string;
  birthdayReminder?: boolean;
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

  const mapDbToContact = (row: any): Contact => {
    const familyRelationshipRaw =
      typeof row.family_relationship === 'string' ? row.family_relationship.toLowerCase() : undefined;

    return {
      id: row.id,
      userId: row.user_id,
      contactUserId: row.contact_user_id || undefined,
      name: row.name,
      email: row.email || undefined,
      phone: row.phone || undefined,
      company: row.company || undefined,
      role: row.role || undefined,
      country: row.country || undefined,
      city: row.city || undefined,
      contactType: row.contact_type as ContactType,
      personalTier: row.personal_tier as PersonalTier | undefined,
      businessLevel: row.business_level as BusinessLevel | undefined,
      familyRelationship: familyRelationshipRaw as FamilyRelationship | undefined,
      contactFrequencyDays: row.contact_frequency_days || 30,
      lastContactedAt: row.last_contacted_at ? new Date(row.last_contacted_at) : undefined,
      nextContactDue: row.next_contact_due ? new Date(row.next_contact_due) : undefined,
      notes: row.notes || undefined,
      tags: row.tags || [],
      linkedinUrl: row.linkedin_url || undefined,
      twitterUrl: row.twitter_url || undefined,
      websiteUrl: row.website_url || undefined,
      birthDate: row.birth_date || undefined,
      birthdayReminder: row.birthday_reminder ?? false,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  };

  const fetchContacts = useCallback(async () => {
    if (!userId) {
      // Avoid clearing cached contacts on transient auth/session transitions.
      setLoading(false);
      return;
    }

    setLoading(true);

    // Retry a few times on transient network errors (e.g. "TypeError: Failed to fetch").
    const maxAttempts = 3;
    let succeeded = false;
    let lastErr: unknown = null;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const { data, error } = await supabase
          .from('user_contacts')
          .select('*')
          .eq('user_id', userId)
          .order('name');

        if (error) throw error;

        setContacts((data || []).map(mapDbToContact));
        succeeded = true;
        break;
      } catch (err) {
        lastErr = err;
        const isLast = attempt === maxAttempts;
        if (isLast) {
          console.error('Error fetching contacts:', err);
        } else {
          await new Promise((r) => setTimeout(r, 250 * attempt));
          continue;
        }
      }
    }

    if (succeeded) {
      moduleHealth.reportSuccess('contacts');
    } else if (lastErr) {
      moduleHealth.reportError('contacts', lastErr);
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
        country: input.country || null,
        city: input.city || null,
        contact_type: input.contactType,
        personal_tier: input.personalTier || null,
        business_level: input.businessLevel || null,
        family_relationship: input.familyRelationship || null,
        contact_frequency_days: frequencyDays,
        next_contact_due: nextContactDue.toISOString(),
        notes: input.notes || null,
        tags: input.tags || [],
        linkedin_url: input.linkedinUrl || null,
        twitter_url: input.twitterUrl || null,
        website_url: input.websiteUrl || null,
        birth_date: input.birthDate || null,
        birthday_reminder: input.birthdayReminder ?? false,
      })
      .select()
      .single();

    if (data && !error) {
      const newContact = mapDbToContact(data);
      setContacts(prev => [...prev, newContact].sort((a, b) => a.name.localeCompare(b.name)));
      moduleBus.emit('contact:created', { contactId: newContact.id }, 'useContacts');
      return newContact;
    }
    return null;
  }, [userId]);

  const updateContact = useCallback(async (
    id: string,
    updates: Partial<ContactInput>
  ): Promise<boolean> => {
    try {
      const dbUpdates: Record<string, any> = {};

      if (updates.name !== undefined) dbUpdates.name = updates.name;
      if (updates.email !== undefined) dbUpdates.email = updates.email || null;
      if (updates.phone !== undefined) dbUpdates.phone = updates.phone || null;
      if (updates.company !== undefined) dbUpdates.company = updates.company || null;
      if (updates.role !== undefined) dbUpdates.role = updates.role || null;
      if (updates.country !== undefined) dbUpdates.country = updates.country || null;
      if (updates.city !== undefined) dbUpdates.city = updates.city || null;
      if (updates.contactType !== undefined) dbUpdates.contact_type = updates.contactType;
      if (updates.personalTier !== undefined) dbUpdates.personal_tier = updates.personalTier || null;
      if (updates.businessLevel !== undefined) dbUpdates.business_level = updates.businessLevel || null;
      if (updates.familyRelationship !== undefined)
        dbUpdates.family_relationship = updates.familyRelationship || null;
      if (updates.contactFrequencyDays !== undefined)
        dbUpdates.contact_frequency_days = updates.contactFrequencyDays;
      if (updates.notes !== undefined) dbUpdates.notes = updates.notes || null;
      if (updates.tags !== undefined) dbUpdates.tags = updates.tags;
      if (updates.linkedinUrl !== undefined) dbUpdates.linkedin_url = updates.linkedinUrl || null;
      if (updates.twitterUrl !== undefined) dbUpdates.twitter_url = updates.twitterUrl || null;
      if (updates.websiteUrl !== undefined) dbUpdates.website_url = updates.websiteUrl || null;
      if (updates.birthDate !== undefined) dbUpdates.birth_date = updates.birthDate || null;
      if (updates.birthdayReminder !== undefined) dbUpdates.birthday_reminder = updates.birthdayReminder;

      const { error } = await supabase
        .from('user_contacts')
        .update(dbUpdates)
        .eq('id', id);

      if (error) {
        console.error('Error updating contact:', error);
        return false;
      }

      setContacts((prev) =>
        prev.map((c) => (c.id === id ? { ...c, ...updates, updatedAt: new Date() } : c))
      );
      moduleBus.emit('contact:updated', { contactId: id, fields: Object.keys(updates) }, 'useContacts');
      return true;
    } catch (err) {
      console.error('Error updating contact:', err);
      return false;
    }
  }, []);

  const deleteContact = useCallback(async (id: string): Promise<boolean> => {
    const { error } = await supabase
      .from('user_contacts')
      .delete()
      .eq('id', id);

    if (!error) {
      setContacts(prev => prev.filter(c => c.id !== id));
      moduleBus.emit('contact:deleted', { contactId: id }, 'useContacts');
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
      moduleBus.emit('contact:contacted', { contactId: id }, 'useContacts');
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
