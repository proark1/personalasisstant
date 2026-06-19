import { useMemo, useRef } from "react";
import { useContacts, Contact } from "./useContacts";
import { useFamilyMembers, FamilyMember } from "./useFamilyMembers";

export interface FamilyContactWithDetails {
  contact: Contact;
  familyMember?: FamilyMember;
  isLinked: boolean;
}

export function useFamilyContacts(userId: string | undefined) {
  const { contacts, personalContacts, loading: contactsLoading } = useContacts(userId);
  const { members, isLoading: membersLoading } = useFamilyMembers();

  // Cache previous good results to prevent flickering on transient network errors
  const cachedFamilyContacts = useRef<Contact[]>([]);
  const cachedFamilyContactsWithDetails = useRef<FamilyContactWithDetails[]>([]);
  const cachedLinkedMembers = useRef<FamilyMember[]>([]);
  const cachedUnlinkedMembers = useRef<FamilyMember[]>([]);
  const cachedContactsWithoutDetails = useRef<Contact[]>([]);

  // Get contacts that are marked as family (either by tier or tag)
  const familyContacts = useMemo(() => {
    const result = personalContacts.filter(
      (c) => c.personalTier === "family" || c.tags.some((tag) => tag.toLowerCase() === "family"),
    );
    // Only update cache if we actually have data (prevents flickering to empty)
    if (result.length > 0 || personalContacts.length > 0) {
      cachedFamilyContacts.current = result;
    }
    return result.length > 0 ? result : cachedFamilyContacts.current;
  }, [personalContacts]);

  // Map family contacts with their linked family member details
  const familyContactsWithDetails = useMemo((): FamilyContactWithDetails[] => {
    const result = familyContacts.map((contact) => {
      const linkedMember = members.find((m) => m.contact_id === contact.id);
      return {
        contact,
        familyMember: linkedMember,
        isLinked: !!linkedMember,
      };
    });
    if (result.length > 0 || familyContacts.length > 0) {
      cachedFamilyContactsWithDetails.current = result;
    }
    return result.length > 0 ? result : cachedFamilyContactsWithDetails.current;
  }, [familyContacts, members]);

  // Get family members that are linked to contacts
  const linkedMembers = useMemo(() => {
    const result = members.filter((m) => m.contact_id !== null);
    if (result.length > 0 || members.length > 0) {
      cachedLinkedMembers.current = result;
    }
    return result.length > 0 ? result : cachedLinkedMembers.current;
  }, [members]);

  // Get family members without contact links
  const unlinkedMembers = useMemo(() => {
    const result = members.filter((m) => m.contact_id === null);
    if (members.length > 0) {
      cachedUnlinkedMembers.current = result;
    }
    return members.length > 0 ? result : cachedUnlinkedMembers.current;
  }, [members]);

  // Get family contacts without family member details
  const contactsWithoutDetails = useMemo(() => {
    const linkedContactIds = new Set(members.map((m) => m.contact_id).filter(Boolean));
    const result = familyContacts.filter((c) => !linkedContactIds.has(c.id));
    if (familyContacts.length > 0 || members.length > 0) {
      cachedContactsWithoutDetails.current = result;
    }
    return familyContacts.length > 0 || members.length > 0
      ? result
      : cachedContactsWithoutDetails.current;
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
