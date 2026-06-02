import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from 'sonner';
import { fetchWithRetry, TimeoutError } from '@/lib/fetchWithTimeout';

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
  const { t } = useLanguage();
  const [lists, setLists] = useState<ShoppingList[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const fetchLists = useCallback(async () => {
    if (!user?.id) {
      setIsLoading(false);
      return;
    }

    setFetchError(null);

    try {
      const { data, error } = await fetchWithRetry(
        async () => supabase
          .from('shopping_lists')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false }),
        { maxRetries: 2, timeoutMs: 12000 }
      );

      if (error) throw error;
      setLists(data || []);
    } catch (error) {
      console.error('Error fetching shopping lists:', error);
      if (error instanceof TimeoutError) {
        setFetchError('Loading took too long. Tap to retry.');
      } else {
        setFetchError('Failed to load shopping lists.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

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
    } catch (error) {
      console.error('Error fetching list with items:', error);
      return null;
    }
  };

  const addList = async (list: Omit<ShoppingList, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
    if (!user?.id) return null;

    try {
      // `items` is a client-only relation, not a column on shopping_lists.
      const { items: _items, ...listFields } = list;
      const { data, error } = await supabase
        .from('shopping_lists')
        .insert({ ...listFields, user_id: user.id })
        .select()
        .single();

      if (error) throw error;
      setLists(prev => [data, ...prev]);
      toast.success(t('shopping.toast.listCreated'));
      return data;
    } catch (error) {
      console.error('Error adding shopping list:', error);
      toast.error(t('shopping.toast.listCreateFailed'));
      return null;
    }
  };

  const updateList = async (id: string, updates: Partial<ShoppingList>) => {
    try {
      // Strip the client-only `items` relation before persisting.
      const { items: _items, ...updateFields } = updates;
      const { data, error } = await supabase
        .from('shopping_lists')
        .update({ ...updateFields, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('user_id', user?.id)
        .select()
        .single();

      if (error) throw error;
      setLists(prev => prev.map(l => l.id === id ? data : l));
      toast.success(t('shopping.toast.listUpdated'));
      return data;
    } catch (error) {
      console.error('Error updating shopping list:', error);
      toast.error(t('shopping.toast.listUpdateFailed'));
      return null;
    }
  };

  const deleteList = async (id: string) => {
    try {
      const { error } = await supabase
        .from('shopping_lists')
        .delete()
        .eq('id', id)
        .eq('user_id', user?.id);

      if (error) throw error;
      setLists(prev => prev.filter(l => l.id !== id));
      toast.success(t('shopping.toast.listDeleted'));
    } catch (error) {
      console.error('Error deleting shopping list:', error);
      toast.error(t('shopping.toast.listDeleteFailed'));
    }
  };

  const addItem = async (listId: string, item: Omit<ShoppingListItem, 'id' | 'list_id' | 'user_id' | 'created_at'>, silent = false) => {
    if (!user?.id) return null;

    try {
      const { data, error } = await supabase
        .from('shopping_list_items')
        .insert({ ...item, list_id: listId, user_id: user.id })
        .select()
        .single();

      if (error) throw error;
      if (!silent) toast.success(t('shopping.toast.itemAdded'));
      return data;
    } catch (error) {
      console.error('Error adding item:', error);
      if (!silent) toast.error(t('shopping.toast.itemAddFailed'));
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
    } catch (error) {
      console.error('Error updating item:', error);
      toast.error(t('shopping.toast.itemUpdateFailed'));
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
      toast.success(t('shopping.toast.itemRemoved'));
    } catch (error) {
      console.error('Error deleting item:', error);
      toast.error(t('shopping.toast.itemRemoveFailed'));
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

  useEffect(() => { fetchLists(); }, [fetchLists]);

  const getActiveLists = () => lists.filter(l => !l.is_template && !l.is_completed);
  const getTemplates = () => lists.filter(l => l.is_template);
  const getCompletedLists = () => lists.filter(l => l.is_completed && !l.is_template);

  return {
    lists,
    isLoading,
    fetchError,
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
