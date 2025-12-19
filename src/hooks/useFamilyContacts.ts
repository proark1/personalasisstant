import { useMemo } from 'react';
import { useContacts, Contact } from './useContacts';
import { useFamilyMembers, FamilyMember } from './useFamilyMembers';

export interface FamilyContactWithDetails {
  contact: Contact;
  familyMember?: FamilyMember;
  isLinked: boolean;
}

export function useFamilyContacts(userId: string | undefined) {
  const { contacts, personalContacts, loading: contactsLoading } = useContacts(userId);
  const { members, isLoading: membersLoading } = useFamilyMembers();

  // Get contacts that are marked as family (either by tier or tag)
  const familyContacts = useMemo(() => {
    return personalContacts.filter(c => 
      c.personalTier === 'family' || 
      c.tags.some(tag => tag.toLowerCase() === 'family')
    );
  }, [personalContacts]);

  // Map family contacts with their linked family member details
  const familyContactsWithDetails = useMemo((): FamilyContactWithDetails[] => {
    return familyContacts.map(contact => {
      const linkedMember = members.find(m => m.contact_id === contact.id);
      return {
        contact,
        familyMember: linkedMember,
        isLinked: !!linkedMember,
      };
    });
  }, [familyContacts, members]);

  // Get family members that are linked to contacts
  const linkedMembers = useMemo(() => {
    return members.filter(m => m.contact_id !== null);
  }, [members]);

  // Get family members without contact links
  const unlinkedMembers = useMemo(() => {
    return members.filter(m => m.contact_id === null);
  }, [members]);

  // Get family contacts without family member details
  const contactsWithoutDetails = useMemo(() => {
    const linkedContactIds = new Set(members.map(m => m.contact_id).filter(Boolean));
    return familyContacts.filter(c => !linkedContactIds.has(c.id));
  }, [familyContacts, members]);

  return {
    familyContacts,
    familyContactsWithDetails,
    linkedMembers,
    unlinkedMembers,
    contactsWithoutDetails,
    allContacts: contacts,
    isLoading: contactsLoading || membersLoading,
  };
}
