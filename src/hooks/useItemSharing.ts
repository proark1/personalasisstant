import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type ShareableItemType = 'task' | 'event' | 'contract' | 'contact';

export function useItemSharing(userId: string | undefined) {
  const shareItem = useCallback(async (
    itemType: ShareableItemType,
    itemId: string,
    shareWithEmail: string,
    permission: 'view' | 'edit' = 'view'
  ) => {
    if (!userId) return { error: 'Not authenticated. Please log in to share items.' };

    const normalizedEmail = shareWithEmail.trim().toLowerCase();

    // Find user by email (case-insensitive)
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('user_id, email')
      .ilike('email', normalizedEmail)
      .maybeSingle();

    if (profileError) {
      return { error: 'Failed to look up user. Please try again.' };
    }

    if (!profiles) {
      return { error: `No account found with email "${shareWithEmail}". Make sure the user has registered and the email is correct.` };
    }

    // Prevent sharing with yourself
    if (profiles.user_id === userId) {
      return { error: "You can't share an item with yourself." };
    }

    const { error } = await supabase
      .from('shared_items')
      .insert({
        item_type: itemType,
        item_id: itemId,
        owner_id: userId,
        shared_with_id: profiles.user_id,
        permission,
      });

    if (error) {
      // Check for duplicate share
      if (error.code === '23505') {
        return { error: `This ${itemType} is already shared with ${profiles.email}.` };
      }
      return { error: `Failed to share: ${error.message}` };
    }

    return { error: null };
  }, [userId]);

  const getSharedWith = useCallback(async (itemType: ShareableItemType, itemId: string) => {
    // Fetch shared items first
    const { data: sharedItems } = await supabase
      .from('shared_items')
      .select('*')
      .eq('item_type', itemType)
      .eq('item_id', itemId);

    if (!sharedItems || sharedItems.length === 0) return [];

    // Get unique user IDs
    const userIds = [...new Set(sharedItems.map(item => item.shared_with_id))];

    // Fetch profile info for these users
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, email, display_name')
      .in('user_id', userIds);

    // Map profiles to shared items
    const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

    return sharedItems.map(item => ({
      ...item,
      shared_with: profileMap.get(item.shared_with_id) || null,
    }));
  }, []);

  const removeShare = useCallback(async (shareId: string) => {
    const { error } = await supabase
      .from('shared_items')
      .delete()
      .eq('id', shareId);

    return { error };
  }, []);

  // Get unique contacts the user has shared items with before
  const getRecentContacts = useCallback(async () => {
    if (!userId) return [];

    const { data } = await supabase
      .from('shared_items')
      .select('shared_with_id')
      .eq('owner_id', userId);

    if (!data || data.length === 0) return [];

    // Get unique user IDs
    const uniqueUserIds = [...new Set(data.map(item => item.shared_with_id))];

    // Fetch profile info for these users
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, email, display_name')
      .in('user_id', uniqueUserIds);

    return profiles?.map(p => ({
      userId: p.user_id,
      email: p.email || '',
      displayName: p.display_name || undefined,
    })) || [];
  }, [userId]);

  return {
    shareItem,
    getSharedWith,
    removeShare,
    getRecentContacts,
  };
}
