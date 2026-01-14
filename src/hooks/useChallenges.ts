import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

interface Challenge {
  id: string;
  title: string;
  description: string | null;
  challengeType: 'weekly' | 'monthly' | 'daily';
  targetValue: number;
  targetMetric: string;
  xpReward: number;
  badgeName: string | null;
  startDate: string | null;
  endDate: string | null;
  isGlobal: boolean;
}

interface UserChallenge {
  id: string;
  challengeId: string;
  challenge: Challenge;
  currentValue: number;
  isCompleted: boolean;
  completedAt: string | null;
  joinedAt: string;
  progress: number; // 0-100
}

export function useChallenges() {
  const { user } = useAuth();
  const [availableChallenges, setAvailableChallenges] = useState<Challenge[]>([]);
  const [userChallenges, setUserChallenges] = useState<UserChallenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [celebratingChallenge, setCelebratingChallenge] = useState<UserChallenge | null>(null);

  const fetchChallenges = useCallback(async () => {
    if (!user) return;

    try {
      // Fetch all global challenges
      const { data: challenges } = await supabase
        .from('challenges')
        .select('*')
        .eq('is_global', true);

      if (challenges) {
        setAvailableChallenges(challenges.map(c => ({
          id: c.id,
          title: c.title,
          description: c.description,
          challengeType: c.challenge_type as 'weekly' | 'monthly' | 'daily',
          targetValue: c.target_value,
          targetMetric: c.target_metric,
          xpReward: c.xp_reward ?? 100,
          badgeName: c.badge_name,
          startDate: c.start_date,
          endDate: c.end_date,
          isGlobal: c.is_global ?? false,
        })));
      }

      // Fetch user's joined challenges
      const { data: userChallengesData } = await supabase
        .from('user_challenges')
        .select(`
          *,
          challenges (*)
        `)
        .eq('user_id', user.id);

      if (userChallengesData) {
        setUserChallenges(userChallengesData.map(uc => {
          const challenge = uc.challenges as {
            id: string;
            title: string;
            description: string | null;
            challenge_type: string;
            target_value: number;
            target_metric: string;
            xp_reward: number | null;
            badge_name: string | null;
            start_date: string | null;
            end_date: string | null;
            is_global: boolean | null;
          };
          return {
            id: uc.id,
            challengeId: uc.challenge_id,
            challenge: {
              id: challenge.id,
              title: challenge.title,
              description: challenge.description,
              challengeType: challenge.challenge_type as 'weekly' | 'monthly' | 'daily',
              targetValue: challenge.target_value,
              targetMetric: challenge.target_metric,
              xpReward: challenge.xp_reward ?? 100,
              badgeName: challenge.badge_name,
              startDate: challenge.start_date,
              endDate: challenge.end_date,
              isGlobal: challenge.is_global ?? false,
            },
            currentValue: uc.current_value ?? 0,
            isCompleted: uc.is_completed ?? false,
            completedAt: uc.completed_at,
            joinedAt: uc.joined_at,
            progress: Math.min(100, Math.round(((uc.current_value ?? 0) / challenge.target_value) * 100)),
          };
        }));
      }
    } catch (error) {
      console.error('Error fetching challenges:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const joinChallenge = useCallback(async (challengeId: string) => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('user_challenges')
        .insert({
          user_id: user.id,
          challenge_id: challengeId,
        })
        .select(`
          *,
          challenges (*)
        `)
        .single();

      if (error) throw error;

      if (data) {
        const challenge = data.challenges as {
          id: string;
          title: string;
          description: string | null;
          challenge_type: string;
          target_value: number;
          target_metric: string;
          xp_reward: number | null;
          badge_name: string | null;
          start_date: string | null;
          end_date: string | null;
          is_global: boolean | null;
        };
        const newUserChallenge: UserChallenge = {
          id: data.id,
          challengeId: data.challenge_id,
          challenge: {
            id: challenge.id,
            title: challenge.title,
            description: challenge.description,
            challengeType: challenge.challenge_type as 'weekly' | 'monthly' | 'daily',
            targetValue: challenge.target_value,
            targetMetric: challenge.target_metric,
            xpReward: challenge.xp_reward ?? 100,
            badgeName: challenge.badge_name,
            startDate: challenge.start_date,
            endDate: challenge.end_date,
            isGlobal: challenge.is_global ?? false,
          },
          currentValue: 0,
          isCompleted: false,
          completedAt: null,
          joinedAt: data.joined_at,
          progress: 0,
        };

        setUserChallenges(prev => [...prev, newUserChallenge]);
        toast.success(`Joined challenge: ${challenge.title}!`);
      }
    } catch (error) {
      console.error('Error joining challenge:', error);
      toast.error('Failed to join challenge');
    }
  }, [user]);

  const updateProgress = useCallback(async (userChallengeId: string, increment: number = 1) => {
    if (!user) return;

    const challenge = userChallenges.find(uc => uc.id === userChallengeId);
    if (!challenge || challenge.isCompleted) return;

    const newValue = challenge.currentValue + increment;
    const isNowCompleted = newValue >= challenge.challenge.targetValue;

    try {
      const { error } = await supabase
        .from('user_challenges')
        .update({
          current_value: newValue,
          is_completed: isNowCompleted,
          completed_at: isNowCompleted ? new Date().toISOString() : null,
        })
        .eq('id', userChallengeId)
        .eq('user_id', user.id);

      if (error) throw error;

      const updatedChallenge = {
        ...challenge,
        currentValue: newValue,
        isCompleted: isNowCompleted,
        completedAt: isNowCompleted ? new Date().toISOString() : null,
        progress: Math.min(100, Math.round((newValue / challenge.challenge.targetValue) * 100)),
      };

      setUserChallenges(prev => prev.map(uc => 
        uc.id === userChallengeId ? updatedChallenge : uc
      ));

      if (isNowCompleted) {
        setCelebratingChallenge(updatedChallenge);
        toast.success(`🎉 Challenge completed: ${challenge.challenge.title}!`, {
          description: `You earned ${challenge.challenge.xpReward} XP!`,
        });
      }
    } catch (error) {
      console.error('Error updating challenge progress:', error);
    }
  }, [user, userChallenges]);

  const dismissCelebration = useCallback(() => {
    setCelebratingChallenge(null);
  }, []);

  const getActiveUserChallenges = useCallback(() => {
    return userChallenges.filter(uc => !uc.isCompleted);
  }, [userChallenges]);

  const getCompletedUserChallenges = useCallback(() => {
    return userChallenges.filter(uc => uc.isCompleted);
  }, [userChallenges]);

  const getUnjoinedChallenges = useCallback(() => {
    const joinedIds = new Set(userChallenges.map(uc => uc.challengeId));
    return availableChallenges.filter(c => !joinedIds.has(c.id));
  }, [availableChallenges, userChallenges]);

  useEffect(() => {
    fetchChallenges();
  }, [fetchChallenges]);

  return {
    availableChallenges,
    userChallenges,
    loading,
    celebratingChallenge,
    joinChallenge,
    updateProgress,
    dismissCelebration,
    getActiveUserChallenges,
    getCompletedUserChallenges,
    getUnjoinedChallenges,
    fetchChallenges,
  };
}
