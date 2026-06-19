import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface SpaceMember {
  id: string;
  owner_id: string;
  member_id: string;
  member_email: string;
  role: "member" | "admin";
  status: "pending" | "accepted" | "declined";
  created_at: string;
  updated_at: string;
  member_profile?: {
    id: string;
    display_name: string | null;
    email: string | null;
    avatar_url: string | null;
  };
}

export interface SpaceShareSettings {
  id: string;
  space_member_id: string;
  share_business_tasks: boolean;
  share_personal_tasks: boolean;
  share_family_tasks: boolean;
  share_work_tasks: boolean;
  share_contracts: boolean;
  share_contacts: boolean;
  share_business_events: boolean;
  share_personal_events: boolean;
  share_family_events: boolean;
  share_work_events: boolean;
  sharing_confirmed: boolean;
  confirmed_at: string | null;
  consent_message: string | null;
}

export function useSpaceMembers(userId: string | undefined) {
  const [members, setMembers] = useState<SpaceMember[]>([]);
  const [invitations, setInvitations] = useState<SpaceMember[]>([]);
  const [shareSettings, setShareSettings] = useState<Record<string, SpaceShareSettings>>({});
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  // Fetch members I've invited to my space
  const fetchMySpaceMembers = useCallback(async () => {
    if (!userId) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("space_members")
        .select("*")
        .eq("owner_id", userId);

      if (error) throw error;

      // Fetch profile info for all members in one query.
      const memberIds = Array.from(new Set((data || []).map((m) => m.member_id).filter(Boolean)));
      const profileMap = new Map<string, NonNullable<SpaceMember["member_profile"]>>();
      if (memberIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, id, display_name, email, avatar_url")
          .in("user_id", memberIds);
        for (const p of profiles || []) {
          profileMap.set(p.user_id, {
            id: p.id,
            display_name: p.display_name,
            email: p.email,
            avatar_url: p.avatar_url,
          });
        }
      }

      const membersWithProfiles = (data || []).map(
        (member) =>
          ({
            ...member,
            member_profile: profileMap.get(member.member_id),
          }) as SpaceMember,
      );

      setMembers(membersWithProfiles);

      // Fetch share settings for all members in one query.
      const settingsMap: Record<string, SpaceShareSettings> = {};
      const memberRowIds = (data || []).map((m) => m.id);
      if (memberRowIds.length > 0) {
        const { data: settingsRows } = await supabase
          .from("space_share_settings")
          .select("*")
          .in("space_member_id", memberRowIds);
        for (const settings of settingsRows || []) {
          settingsMap[settings.space_member_id] = settings as SpaceShareSettings;
        }
      }
      setShareSettings(settingsMap);
    } catch (error) {
      console.error("Error fetching space members:", error);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Fetch invitations sent to me
  const fetchInvitations = useCallback(async () => {
    if (!userId) return;

    try {
      const { data, error } = await supabase
        .from("space_members")
        .select("*")
        .eq("member_id", userId)
        .eq("status", "pending");

      if (error) throw error;

      // Fetch owner profile info for all invitations in one query.
      const ownerIds = Array.from(new Set((data || []).map((inv) => inv.owner_id).filter(Boolean)));
      const profileMap = new Map<string, NonNullable<SpaceMember["member_profile"]>>();
      if (ownerIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, id, display_name, email, avatar_url")
          .in("user_id", ownerIds);
        for (const p of profiles || []) {
          profileMap.set(p.user_id, {
            id: p.id,
            display_name: p.display_name,
            email: p.email,
            avatar_url: p.avatar_url,
          });
        }
      }

      const invitationsWithProfiles = (data || []).map(
        (inv) =>
          ({
            ...inv,
            member_profile: profileMap.get(inv.owner_id),
          }) as SpaceMember,
      );

      setInvitations(invitationsWithProfiles);
    } catch (error) {
      console.error("Error fetching invitations:", error);
    }
  }, [userId]);

  // Invite a new member by email
  const inviteMember = useCallback(
    async (email: string, role: "member" | "admin" = "member") => {
      if (!userId) return null;

      try {
        // Find user by email
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("user_id, email")
          .eq("email", email.toLowerCase())
          .maybeSingle();

        if (profileError) throw profileError;

        if (!profile) {
          toast({
            title: "User not found",
            description: "No user found with that email address",
            variant: "destructive",
          });
          return null;
        }

        if (profile.user_id === userId) {
          toast({
            title: "Cannot invite yourself",
            description: "You cannot add yourself as a space member",
            variant: "destructive",
          });
          return null;
        }

        // Check if already a member
        const { data: existing } = await supabase
          .from("space_members")
          .select("id")
          .eq("owner_id", userId)
          .eq("member_id", profile.user_id)
          .maybeSingle();

        if (existing) {
          toast({
            title: "Already a member",
            description: "This user is already in your space",
            variant: "destructive",
          });
          return null;
        }

        // Create space member
        const { data: member, error: memberError } = await supabase
          .from("space_members")
          .insert({
            owner_id: userId,
            member_id: profile.user_id,
            member_email: email.toLowerCase(),
            role,
            status: "pending",
          })
          .select()
          .single();

        if (memberError) throw memberError;

        // Create default share settings
        await supabase.from("space_share_settings").insert({
          space_member_id: member.id,
        });

        // Create notification for the invited user
        await supabase.from("user_notifications").insert({
          user_id: profile.user_id,
          type: "invitation",
          title: "Space Invitation",
          message: "You have been invited to join a shared space",
          data: { space_member_id: member.id, owner_id: userId },
        });

        toast({
          title: "Invitation sent",
          description: `Invitation sent to ${email}`,
        });

        await fetchMySpaceMembers();
        return member;
      } catch (error) {
        console.error("Error inviting member:", error);
        toast({
          title: "Error",
          description: "Failed to send invitation",
          variant: "destructive",
        });
        return null;
      }
    },
    [userId, toast, fetchMySpaceMembers],
  );

  // Accept an invitation
  const acceptInvitation = useCallback(
    async (memberId: string) => {
      try {
        const { error } = await supabase
          .from("space_members")
          .update({ status: "accepted" })
          .eq("id", memberId);

        if (error) throw error;

        toast({
          title: "Invitation accepted",
          description: "You can now see shared items from this space",
        });

        await fetchInvitations();
      } catch (error) {
        console.error("Error accepting invitation:", error);
        toast({
          title: "Error",
          description: "Failed to accept invitation",
          variant: "destructive",
        });
      }
    },
    [toast, fetchInvitations],
  );

  // Decline an invitation
  const declineInvitation = useCallback(
    async (memberId: string) => {
      try {
        const { error } = await supabase
          .from("space_members")
          .update({ status: "declined" })
          .eq("id", memberId);

        if (error) throw error;

        toast({
          title: "Invitation declined",
        });

        await fetchInvitations();
      } catch (error) {
        console.error("Error declining invitation:", error);
      }
    },
    [toast, fetchInvitations],
  );

  // Remove a member from space
  const removeMember = useCallback(
    async (memberId: string) => {
      try {
        const { error } = await supabase.from("space_members").delete().eq("id", memberId);

        if (error) throw error;

        toast({
          title: "Member removed",
          description: "Member has been removed from your space",
        });

        await fetchMySpaceMembers();
      } catch (error) {
        console.error("Error removing member:", error);
        toast({
          title: "Error",
          description: "Failed to remove member",
          variant: "destructive",
        });
      }
    },
    [toast, fetchMySpaceMembers],
  );

  // Update share settings for a member
  const updateShareSettings = useCallback(
    async (
      memberId: string,
      settings: Partial<Omit<SpaceShareSettings, "id" | "space_member_id">>,
    ) => {
      try {
        const { error } = await supabase
          .from("space_share_settings")
          .update(settings)
          .eq("space_member_id", memberId);

        if (error) throw error;

        // Update local state
        setShareSettings((prev) => ({
          ...prev,
          [memberId]: {
            ...prev[memberId],
            ...settings,
          } as SpaceShareSettings,
        }));

        toast({
          title: "Settings updated",
          description: "Share settings have been updated",
        });
      } catch (error) {
        console.error("Error updating share settings:", error);
        toast({
          title: "Error",
          description: "Failed to update settings",
          variant: "destructive",
        });
      }
    },
    [toast],
  );

  useEffect(() => {
    if (userId) {
      fetchMySpaceMembers();
      fetchInvitations();
    }
  }, [userId, fetchMySpaceMembers, fetchInvitations]);

  return {
    members,
    invitations,
    shareSettings,
    loading,
    inviteMember,
    acceptInvitation,
    declineInvitation,
    removeMember,
    updateShareSettings,
    refetch: fetchMySpaceMembers,
  };
}
