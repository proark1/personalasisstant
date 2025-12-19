import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface ShoppingListItem {
  id: string;
  list_id: string;
  user_id: string;
  name: string;
  quantity: number;
  unit: string | null;
  category: string;
  is_checked: boolean;
  notes: string | null;
  added_by: string | null;
  created_at: string;
}

export interface ShoppingList {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  category: string;
  assigned_to: string | null;
  is_template: boolean;
  is_completed: boolean;
  due_date: string | null;
  created_at: string;
  updated_at: string;
  items?: ShoppingListItem[];
}

export function useShoppingLists() {
  const { user } = useAuth();
  const [lists, setLists] = useState<ShoppingList[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchLists = async () => {
    if (!user?.id) return;
    
    try {
      const { data, error } = await supabase
        .from('shopping_lists')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLists(data || []);
    } catch (error: any) {
      console.error('Error fetching shopping lists:', error);
      toast.error('Failed to load shopping lists');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchListWithItems = async (listId: string): Promise<ShoppingList | null> => {
    if (!user?.id) return null;
    
    try {
      const { data: listData, error: listError } = await supabase
        .from('shopping_lists')
        .select('*')
        .eq('id', listId)
        .single();

      if (listError) throw listError;

      const { data: itemsData, error: itemsError } = await supabase
        .from('shopping_list_items')
        .select('*')
        .eq('list_id', listId)
        .order('created_at', { ascending: true });

      if (itemsError) throw itemsError;

      return { ...listData, items: itemsData || [] };
    } catch (error: any) {
      console.error('Error fetching list with items:', error);
      return null;
    }
  };

  const addList = async (list: Omit<ShoppingList, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
    if (!user?.id) return null;

    try {
      const { data, error } = await supabase
        .from('shopping_lists')
        .insert({ ...list, user_id: user.id })
        .select()
        .single();

      if (error) throw error;
      setLists(prev => [data, ...prev]);
      toast.success('Shopping list created');
      return data;
    } catch (error: any) {
      console.error('Error adding shopping list:', error);
      toast.error('Failed to create shopping list');
      return null;
    }
  };

  const updateList = async (id: string, updates: Partial<ShoppingList>) => {
    try {
      const { data, error } = await supabase
        .from('shopping_lists')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      setLists(prev => prev.map(l => l.id === id ? data : l));
      toast.success('Shopping list updated');
      return data;
    } catch (error: any) {
      console.error('Error updating shopping list:', error);
      toast.error('Failed to update shopping list');
      return null;
    }
  };

  const deleteList = async (id: string) => {
    try {
      const { error } = await supabase
        .from('shopping_lists')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setLists(prev => prev.filter(l => l.id !== id));
      toast.success('Shopping list deleted');
    } catch (error: any) {
      console.error('Error deleting shopping list:', error);
      toast.error('Failed to delete shopping list');
    }
  };

  const addItem = async (listId: string, item: Omit<ShoppingListItem, 'id' | 'list_id' | 'user_id' | 'created_at'>) => {
    if (!user?.id) return null;

    try {
      const { data, error } = await supabase
        .from('shopping_list_items')
        .insert({ ...item, list_id: listId, user_id: user.id })
        .select()
        .single();

      if (error) throw error;
      toast.success('Item added');
      return data;
    } catch (error: any) {
      console.error('Error adding item:', error);
      toast.error('Failed to add item');
      return null;
    }
  };

  const updateItem = async (itemId: string, updates: Partial<ShoppingListItem>) => {
    try {
      const { data, error } = await supabase
        .from('shopping_list_items')
        .update(updates)
        .eq('id', itemId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error: any) {
      console.error('Error updating item:', error);
      toast.error('Failed to update item');
      return null;
    }
  };

  const toggleItem = async (itemId: string, isChecked: boolean) => {
    return updateItem(itemId, { is_checked: isChecked });
  };

  const deleteItem = async (itemId: string) => {
    try {
      const { error } = await supabase
        .from('shopping_list_items')
        .delete()
        .eq('id', itemId);

      if (error) throw error;
      toast.success('Item removed');
    } catch (error: any) {
      console.error('Error deleting item:', error);
      toast.error('Failed to remove item');
    }
  };

  const createFromTemplate = async (templateId: string, name: string) => {
    const template = await fetchListWithItems(templateId);
    if (!template) return null;

    const newList = await addList({
      name,
      description: template.description,
      category: template.category,
      assigned_to: null,
      is_template: false,
      is_completed: false,
      due_date: null,
    });

    if (newList && template.items) {
      for (const item of template.items) {
        await addItem(newList.id, {
          name: item.name,
          quantity: item.quantity,
          unit: item.unit,
          category: item.category,
          is_checked: false,
          notes: item.notes,
          added_by: item.added_by,
        });
      }
    }

    return newList;
  };

  useEffect(() => {
    fetchLists();
  }, [user?.id]);

  const getActiveLists = () => lists.filter(l => !l.is_template && !l.is_completed);
  const getTemplates = () => lists.filter(l => l.is_template);
  const getCompletedLists = () => lists.filter(l => l.is_completed && !l.is_template);

  return {
    lists,
    isLoading,
    addList,
    updateList,
    deleteList,
    addItem,
    updateItem,
    toggleItem,
    deleteItem,
    fetchListWithItems,
    createFromTemplate,
    getActiveLists,
    getTemplates,
    getCompletedLists,
    refetch: fetchLists,
  };
}
