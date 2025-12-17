import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ActivityItem {
  id: string;
  userId: string;
  actorId: string;
  action: 'created' | 'updated' | 'deleted' | 'completed' | 'assigned' | 'shared' | 'commented';
  itemType: 'task' | 'event';
  itemId: string;
  itemTitle?: string;
  details?: Record<string, any>;
  createdAt: Date;
  actorName?: string;
  actorAvatar?: string;
}

interface DbActivityItem {
  id: string;
  user_id: string;
  actor_id: string;
  action: string;
  item_type: string;
  item_id: string;
  item_title: string | null;
  details: Record<string, any> | null;
  created_at: string;
}

export function useActivityFeed(userId: string | undefined) {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchActivities = useCallback(async () => {
    if (!userId) {
      setActivities([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    
    // Get activities
    const { data: activityData, error } = await supabase
      .from('activity_feed')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Error fetching activities:', error);
      setLoading(false);
      return;
    }

    if (activityData && activityData.length > 0) {
      // Get unique actor IDs
      const actorIds = [...new Set(activityData.map((a: DbActivityItem) => a.actor_id))];
      
      // Fetch profiles for actors
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, display_name, avatar_url')
        .in('user_id', actorIds);

      const profileMap = new Map(
        profiles?.map(p => [p.user_id, { name: p.display_name, avatar: p.avatar_url }]) || []
      );

      const mappedActivities: ActivityItem[] = activityData.map((item: DbActivityItem) => {
        const profile = profileMap.get(item.actor_id);
        return {
          id: item.id,
          userId: item.user_id,
          actorId: item.actor_id,
          action: item.action as ActivityItem['action'],
          itemType: item.item_type as 'task' | 'event',
          itemId: item.item_id,
          itemTitle: item.item_title || undefined,
          details: item.details || undefined,
          createdAt: new Date(item.created_at),
          actorName: profile?.name || 'Unknown',
          actorAvatar: profile?.avatar || undefined,
        };
      });

      setActivities(mappedActivities);
    } else {
      setActivities([]);
    }
    
    setLoading(false);
  }, [userId]);

  const logActivity = useCallback(async (
    action: ActivityItem['action'],
    itemType: 'task' | 'event',
    itemId: string,
    itemTitle?: string,
    targetUserId?: string,
    details?: Record<string, any>
  ) => {
    if (!userId) return;

    const activityUserId = targetUserId || userId;

    const { error } = await supabase
      .from('activity_feed')
      .insert({
        user_id: activityUserId,
        actor_id: userId,
        action,
        item_type: itemType,
        item_id: itemId,
        item_title: itemTitle,
        details: details || {},
      });

    if (error) {
      console.error('Error logging activity:', error);
    }
  }, [userId]);

  // Set up realtime subscription
  useEffect(() => {
    if (!userId) return;

    fetchActivities();

    const channel = supabase
      .channel('activity-feed-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'activity_feed',
        },
        (payload) => {
          // Refresh activities when new one is added
          fetchActivities();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, fetchActivities]);

  return {
    activities,
    loading,
    logActivity,
    refetch: fetchActivities,
  };
}
