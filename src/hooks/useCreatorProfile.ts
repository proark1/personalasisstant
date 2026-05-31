import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';
import { DEFAULT_CREATOR_PROFILE, describeContentError, type CreatorProfile } from '@/lib/content';

// `creator_profiles` is a newly added table not yet in the generated Supabase
// types, so we reach it through an untyped client handle (same approach as
// useBriefings).
const db = supabase as unknown as { from: (table: string) => any };

export type CreatorProfileDraft = Omit<
  CreatorProfile,
  'id' | 'user_id' | 'created_at' | 'updated_at' | 'last_generated_on'
>;

export function useCreatorProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<CreatorProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchProfile = useCallback(async () => {
    if (!user?.id) return;
    try {
      const { data, error } = await db
        .from('creator_profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      if (error) {
        console.error('Error fetching creator profile:', error);
      } else {
        setProfile((data as CreatorProfile) ?? null);
      }
    } catch (err) {
      console.error('Failed to fetch creator profile:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  // Seed values from the user's general profile so they don't start from a
  // blank form. Returns a draft (not yet saved).
  const prefillFromProfile = useCallback(async (): Promise<CreatorProfileDraft> => {
    const base: CreatorProfileDraft = { ...DEFAULT_CREATOR_PROFILE };
    if (!user?.id) return base;
    try {
      const { data } = await supabase
        .from('profiles')
        .select('bio, interests, businesses')
        .eq('user_id', user.id)
        .maybeSingle();
      if (data) {
        const topics = [...(data.interests || []), ...(data.businesses || [])]
          .map((t) => String(t).trim())
          .filter(Boolean);
        return {
          ...base,
          persona: data.bio || '',
          topics: Array.from(new Set(topics)).slice(0, 12),
          business_context: (data.businesses || []).join(', '),
        };
      }
    } catch (err) {
      console.error('Prefill failed:', err);
    }
    return base;
  }, [user?.id]);

  const save = useCallback(async (values: Partial<CreatorProfileDraft>): Promise<CreatorProfile | null> => {
    if (!user?.id) return null;
    setSaving(true);
    // Optimistic local merge so the form feels instant.
    setProfile((prev) => (prev ? { ...prev, ...values } as CreatorProfile : prev));
    try {
      const payload = {
        user_id: user.id,
        ...(profile ? {} : DEFAULT_CREATOR_PROFILE),
        ...values,
        updated_at: new Date().toISOString(),
      };
      const { data, error } = await db
        .from('creator_profiles')
        .upsert(payload, { onConflict: 'user_id' })
        .select()
        .single();
      if (error) throw error;
      setProfile(data as CreatorProfile);
      return data as CreatorProfile;
    } catch (err) {
      console.error('Failed to save creator profile:', err);
      toast.error(describeContentError(err, 'Failed to save profile'));
      fetchProfile(); // revert to server state
      return null;
    } finally {
      setSaving(false);
    }
  }, [user?.id, profile, fetchProfile]);

  return { profile, loading, saving, save, prefillFromProfile, refetch: fetchProfile };
}
