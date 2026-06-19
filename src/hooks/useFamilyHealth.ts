import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

export interface ImportantDocument {
  id: string;
  user_id: string;
  family_member_id: string | null;
  document_type: string;
  document_number: string | null;
  issuing_country: string | null;
  issuing_authority: string | null;
  issue_date: string | null;
  expiry_date: string | null;
  file_url: string | null;
  reminder_days_before: number | null;
  notes: string | null;
}

export interface EmergencyContact {
  id: string;
  user_id: string;
  family_member_id: string | null;
  name: string;
  relationship: string | null;
  phone: string;
  alt_phone: string | null;
  email: string | null;
  priority: number;
  notes: string | null;
}

export interface InsurancePolicy {
  id: string;
  user_id: string;
  family_member_id: string | null;
  insurance_type: string;
  provider: string;
  policy_number: string | null;
  start_date: string | null;
  end_date: string | null;
  premium_amount: number | null;
  premium_frequency: string | null;
  is_active: boolean;
  notes: string | null;
}

export function useFamilyHealth() {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<ImportantDocument[]>([]);
  const [emergencyContacts, setEmergencyContacts] = useState<EmergencyContact[]>([]);
  const [insurance, setInsurance] = useState<InsurancePolicy[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const [docs, emer, ins] = await Promise.all([
        supabase
          .from("family_important_documents")
          .select("*")
          .eq("user_id", user.id)
          .order("expiry_date", { ascending: true, nullsFirst: false }),
        supabase
          .from("family_emergency_contacts")
          .select("*")
          .eq("user_id", user.id)
          .order("priority"),
        supabase.from("family_insurance").select("*").eq("user_id", user.id).eq("is_active", true),
      ]);
      setDocuments((docs.data || []) as ImportantDocument[]);
      setEmergencyContacts((emer.data || []) as EmergencyContact[]);
      setInsurance((ins.data || []) as InsurancePolicy[]);
    } catch (e) {
      console.error("useFamilyHealth fetch error", e);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const addDocument = async (doc: Omit<ImportantDocument, "id" | "user_id">) => {
    if (!user) return null;
    const { data, error } = await supabase
      .from("family_important_documents")
      .insert({ ...doc, user_id: user.id })
      .select()
      .single();
    if (error) {
      toast.error("Failed to add document");
      return null;
    }
    setDocuments((prev) => [...prev, data as ImportantDocument]);
    toast.success("Document added");
    return data;
  };

  const addEmergencyContact = async (c: Omit<EmergencyContact, "id" | "user_id">) => {
    if (!user) return null;
    const { data, error } = await supabase
      .from("family_emergency_contacts")
      .insert({ ...c, user_id: user.id })
      .select()
      .single();
    if (error) {
      toast.error("Failed to add contact");
      return null;
    }
    setEmergencyContacts((prev) =>
      [...prev, data as EmergencyContact].sort((a, b) => a.priority - b.priority),
    );
    toast.success("Emergency contact added");
    return data;
  };

  const addInsurance = async (i: Omit<InsurancePolicy, "id" | "user_id">) => {
    if (!user) return null;
    const { data, error } = await supabase
      .from("family_insurance")
      .insert({ ...i, user_id: user.id })
      .select()
      .single();
    if (error) {
      toast.error("Failed to add insurance");
      return null;
    }
    setInsurance((prev) => [...prev, data as InsurancePolicy]);
    toast.success("Insurance added");
    return data;
  };

  const expiringDocuments = documents.filter((d) => {
    if (!d.expiry_date) return false;
    const days = Math.floor((new Date(d.expiry_date).getTime() - Date.now()) / 86400000);
    return days <= (d.reminder_days_before ?? 180);
  });

  return {
    documents,
    emergencyContacts,
    insurance,
    expiringDocuments,
    isLoading,
    addDocument,
    addEmergencyContact,
    addInsurance,
    refetch: fetchAll,
  };
}
