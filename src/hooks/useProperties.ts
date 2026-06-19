import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface Property {
  id: string;
  name: string;
  property_type: string;
  address?: string;
  city?: string;
  country?: string;
  purchase_date?: string;
  purchase_price?: number;
  current_value?: number;
  size_sqm?: number;
  notes?: string;
  image_url?: string;
  is_active: boolean;
  created_at: string;
}

export interface PropertyDocument {
  id: string;
  property_id: string;
  name: string;
  document_type?: string;
  file_path: string;
  file_url: string;
  expiry_date?: string;
  notes?: string;
  created_at: string;
}

export interface PropertyMaintenance {
  id: string;
  property_id: string;
  title: string;
  description?: string;
  category?: string;
  cost?: number;
  scheduled_date?: string;
  completed_date?: string;
  is_recurring: boolean;
  recurrence_rule?: string;
  status: string;
  created_at: string;
}

export interface PropertyChecklist {
  id: string;
  property_id: string;
  name: string;
  checklist_type?: string;
  items: { id: string; text: string; completed: boolean }[];
  created_at: string;
}

export function useProperties() {
  const { user } = useAuth();
  const [properties, setProperties] = useState<Property[]>([]);
  const [documents, setDocuments] = useState<PropertyDocument[]>([]);
  const [maintenance, setMaintenance] = useState<PropertyMaintenance[]>([]);
  const [checklists, setChecklists] = useState<PropertyChecklist[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch all properties
  const fetchProperties = useCallback(async () => {
    if (!user?.id) return;

    try {
      const { data, error } = await supabase
        .from("properties")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setProperties((data || []) as Property[]);
    } catch (error) {
      console.error("Error fetching properties:", error);
    }
  }, [user?.id]);

  // Fetch documents for a property
  const fetchDocuments = useCallback(
    async (propertyId?: string) => {
      if (!user?.id) return;

      try {
        let query = supabase
          .from("property_documents")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });

        if (propertyId) {
          query = query.eq("property_id", propertyId);
        }

        const { data, error } = await query;
        if (error) throw error;
        setDocuments((data || []) as PropertyDocument[]);
      } catch (error) {
        console.error("Error fetching documents:", error);
      }
    },
    [user?.id],
  );

  // Fetch maintenance for a property
  const fetchMaintenance = useCallback(
    async (propertyId?: string) => {
      if (!user?.id) return;

      try {
        let query = supabase
          .from("property_maintenance")
          .select("*")
          .eq("user_id", user.id)
          .order("scheduled_date", { ascending: true });

        if (propertyId) {
          query = query.eq("property_id", propertyId);
        }

        const { data, error } = await query;
        if (error) throw error;
        setMaintenance((data || []) as PropertyMaintenance[]);
      } catch (error) {
        console.error("Error fetching maintenance:", error);
      }
    },
    [user?.id],
  );

  // Fetch checklists for a property
  const fetchChecklists = useCallback(
    async (propertyId?: string) => {
      if (!user?.id) return;

      try {
        let query = supabase
          .from("property_checklists")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });

        if (propertyId) {
          query = query.eq("property_id", propertyId);
        }

        const { data, error } = await query;
        if (error) throw error;

        const parsed = (data || []).map((c) => {
          let parsedItems: { id: string; text: string; completed: boolean }[] = [];
          if (Array.isArray(c.items)) {
            parsedItems = c.items as { id: string; text: string; completed: boolean }[];
          } else if (typeof c.items === "string") {
            parsedItems = JSON.parse(c.items);
          }
          return {
            id: c.id,
            property_id: c.property_id,
            name: c.name,
            checklist_type: c.checklist_type || undefined,
            items: parsedItems,
            created_at: c.created_at,
          };
        });
        setChecklists(parsed);
      } catch (error) {
        console.error("Error fetching checklists:", error);
      }
    },
    [user?.id],
  );

  // Add property
  const addProperty = async (property: Omit<Property, "id" | "created_at" | "is_active">) => {
    if (!user?.id) return null;

    try {
      const { data, error } = await supabase
        .from("properties")
        .insert({ ...property, user_id: user.id, is_active: true })
        .select()
        .single();

      if (error) throw error;
      await fetchProperties();
      toast.success("Property added");
      return data as Property;
    } catch (error) {
      console.error("Error adding property:", error);
      toast.error("Failed to add property");
      return null;
    }
  };

  // Update property
  const updateProperty = async (id: string, updates: Partial<Property>) => {
    try {
      const { error } = await supabase.from("properties").update(updates).eq("id", id);

      if (error) throw error;
      await fetchProperties();
      toast.success("Property updated");
    } catch (error) {
      console.error("Error updating property:", error);
      toast.error("Failed to update property");
    }
  };

  // Delete property
  const deleteProperty = async (id: string) => {
    try {
      const { error } = await supabase.from("properties").delete().eq("id", id);

      if (error) throw error;
      await fetchProperties();
      toast.success("Property deleted");
    } catch (error) {
      console.error("Error deleting property:", error);
      toast.error("Failed to delete property");
    }
  };

  // Add maintenance task
  const addMaintenance = async (
    task: Omit<PropertyMaintenance, "id" | "created_at" | "status">,
  ) => {
    if (!user?.id) return null;

    try {
      const { data, error } = await supabase
        .from("property_maintenance")
        .insert({ ...task, user_id: user.id, status: "pending" })
        .select()
        .single();

      if (error) throw error;
      await fetchMaintenance();
      toast.success("Maintenance task added");
      return data as PropertyMaintenance;
    } catch (error) {
      console.error("Error adding maintenance:", error);
      toast.error("Failed to add maintenance task");
      return null;
    }
  };

  // Update maintenance task
  const updateMaintenance = async (id: string, updates: Partial<PropertyMaintenance>) => {
    try {
      const { error } = await supabase.from("property_maintenance").update(updates).eq("id", id);

      if (error) throw error;
      await fetchMaintenance();
    } catch (error) {
      console.error("Error updating maintenance:", error);
      toast.error("Failed to update maintenance task");
    }
  };

  // Add checklist
  const addChecklist = async (checklist: Omit<PropertyChecklist, "id" | "created_at">) => {
    if (!user?.id) return null;

    try {
      const { data, error } = await supabase
        .from("property_checklists")
        .insert({ ...checklist, user_id: user.id, items: JSON.stringify(checklist.items) })
        .select()
        .single();

      if (error) throw error;
      await fetchChecklists();
      toast.success("Checklist added");
      return { ...data, items: checklist.items } as PropertyChecklist;
    } catch (error) {
      console.error("Error adding checklist:", error);
      toast.error("Failed to add checklist");
      return null;
    }
  };

  // Update checklist
  const updateChecklist = async (id: string, updates: Partial<PropertyChecklist>) => {
    try {
      const updateData = { ...updates };
      if (updates.items) {
        (updateData as Record<string, unknown>).items = JSON.stringify(updates.items);
      }

      const { error } = await supabase.from("property_checklists").update(updateData).eq("id", id);

      if (error) throw error;
      await fetchChecklists();
    } catch (error) {
      console.error("Error updating checklist:", error);
      toast.error("Failed to update checklist");
    }
  };

  // Toggle checklist item
  const toggleChecklistItem = async (checklistId: string, itemId: string) => {
    const checklist = checklists.find((c) => c.id === checklistId);
    if (!checklist) return;

    const updatedItems = checklist.items.map((item) =>
      item.id === itemId ? { ...item, completed: !item.completed } : item,
    );

    await updateChecklist(checklistId, { items: updatedItems });
  };

  useEffect(() => {
    if (user?.id) {
      setLoading(true);
      Promise.all([
        fetchProperties(),
        fetchDocuments(),
        fetchMaintenance(),
        fetchChecklists(),
      ]).finally(() => setLoading(false));
    }
  }, [user?.id, fetchProperties, fetchDocuments, fetchMaintenance, fetchChecklists]);

  return {
    properties,
    documents,
    maintenance,
    checklists,
    loading,
    addProperty,
    updateProperty,
    deleteProperty,
    addMaintenance,
    updateMaintenance,
    addChecklist,
    updateChecklist,
    toggleChecklistItem,
    fetchDocuments,
    fetchMaintenance,
    fetchChecklists,
    refetch: fetchProperties,
  };
}
