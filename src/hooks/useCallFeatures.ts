import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

export interface Voicemail {
  id: string;
  callerId: string;
  callerName?: string;
  audioUrl: string;
  durationSeconds: number;
  transcription?: string;
  isRead: boolean;
  createdAt: Date;
}

export interface ScheduledCall {
  id: string;
  organizerId: string;
  participantIds: string[];
  participants?: { id: string; name: string }[];
  title?: string;
  description?: string;
  scheduledFor: Date;
  durationMinutes: number;
  callType: "video" | "audio";
  status: "scheduled" | "completed" | "cancelled";
  createdAt: Date;
}

export interface CallNote {
  id: string;
  sessionId: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

export function useCallFeatures() {
  const { user } = useAuth();
  const [voicemails, setVoicemails] = useState<Voicemail[]>([]);
  const [scheduledCalls, setScheduledCalls] = useState<ScheduledCall[]>([]);
  const [callNotes, setCallNotes] = useState<CallNote[]>([]);
  const [loading] = useState(false);

  // Fetch voicemails
  const fetchVoicemails = useCallback(async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from("voicemails")
      .select("*")
      .eq("recipient_id", user.id)
      .order("created_at", { ascending: false });

    if (!error && data) {
      // Get caller names
      const callerIds = [...new Set(data.map((v) => v.caller_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .in("user_id", callerIds);

      const profileMap = new Map(profiles?.map((p) => [p.user_id, p.display_name]) || []);

      setVoicemails(
        data.map((v) => ({
          id: v.id,
          callerId: v.caller_id,
          callerName: profileMap.get(v.caller_id) || "Unknown",
          audioUrl: v.audio_url,
          durationSeconds: v.duration_seconds,
          transcription: v.transcription,
          isRead: v.is_read,
          createdAt: new Date(v.created_at),
        })),
      );
    }
  }, [user]);

  // Leave a voicemail
  const leaveVoicemail = useCallback(
    async (
      recipientId: string,
      audioUrl: string,
      durationSeconds: number,
      transcription?: string,
    ) => {
      if (!user) return;

      const { error } = await supabase.from("voicemails").insert({
        caller_id: user.id,
        recipient_id: recipientId,
        audio_url: audioUrl,
        duration_seconds: durationSeconds,
        transcription,
      });

      if (error) {
        toast.error("Failed to leave voicemail");
        return false;
      }

      toast.success("Voicemail sent");
      return true;
    },
    [user],
  );

  // Mark voicemail as read
  const markVoicemailRead = useCallback(async (voicemailId: string) => {
    const { error } = await supabase
      .from("voicemails")
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq("id", voicemailId);

    if (!error) {
      setVoicemails((prev) => prev.map((v) => (v.id === voicemailId ? { ...v, isRead: true } : v)));
    }
  }, []);

  // Delete voicemail
  const deleteVoicemail = useCallback(async (voicemailId: string) => {
    const { error } = await supabase.from("voicemails").delete().eq("id", voicemailId);

    if (error) {
      toast.error("Failed to delete voicemail");
      return;
    }

    setVoicemails((prev) => prev.filter((v) => v.id !== voicemailId));
    toast.success("Voicemail deleted");
  }, []);

  // Fetch scheduled calls
  const fetchScheduledCalls = useCallback(async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from("scheduled_calls")
      .select("*")
      .or(`organizer_id.eq.${user.id},participant_ids.cs.{${user.id}}`)
      .eq("status", "scheduled")
      .order("scheduled_for", { ascending: true });

    if (!error && data) {
      // Get participant names
      const allParticipantIds = [
        ...new Set(data.flatMap((c) => [c.organizer_id, ...c.participant_ids])),
      ];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .in("user_id", allParticipantIds);

      const profileMap = new Map(profiles?.map((p) => [p.user_id, p.display_name]) || []);

      setScheduledCalls(
        data.map((c) => ({
          id: c.id,
          organizerId: c.organizer_id,
          participantIds: c.participant_ids,
          participants: c.participant_ids.map((id: string) => ({
            id,
            name: profileMap.get(id) || "Unknown",
          })),
          title: c.title,
          description: c.description,
          scheduledFor: new Date(c.scheduled_for),
          durationMinutes: c.duration_minutes,
          callType: c.call_type as "video" | "audio",
          status: c.status as "scheduled" | "completed" | "cancelled",
          createdAt: new Date(c.created_at),
        })),
      );
    }
  }, [user]);

  // Schedule a call
  const scheduleCall = useCallback(
    async (
      participantIds: string[],
      scheduledFor: Date,
      callType: "video" | "audio",
      title?: string,
      description?: string,
      durationMinutes: number = 30,
    ) => {
      if (!user) return null;

      const { data, error } = await supabase
        .from("scheduled_calls")
        .insert({
          organizer_id: user.id,
          participant_ids: participantIds,
          scheduled_for: scheduledFor.toISOString(),
          call_type: callType,
          title,
          description,
          duration_minutes: durationMinutes,
        })
        .select()
        .single();

      if (error) {
        toast.error("Failed to schedule call");
        return null;
      }

      toast.success(`Call scheduled for ${scheduledFor.toLocaleString()}`);
      fetchScheduledCalls();
      return data;
    },
    [user, fetchScheduledCalls],
  );

  // Cancel scheduled call
  const cancelScheduledCall = useCallback(
    async (callId: string) => {
      const { error } = await supabase
        .from("scheduled_calls")
        .update({ status: "cancelled" })
        .eq("id", callId);

      if (error) {
        toast.error("Failed to cancel call");
        return;
      }

      toast.success("Scheduled call cancelled");
      fetchScheduledCalls();
    },
    [fetchScheduledCalls],
  );

  // Fetch call notes
  const fetchCallNotes = useCallback(
    async (sessionId: string) => {
      if (!user) return;

      const { data, error } = await supabase
        .from("call_notes")
        .select("*")
        .eq("session_id", sessionId)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (!error && data) {
        setCallNotes(
          data.map((n) => ({
            id: n.id,
            sessionId: n.session_id,
            content: n.content,
            createdAt: new Date(n.created_at),
            updatedAt: new Date(n.updated_at),
          })),
        );
      }
    },
    [user],
  );

  // Add call note
  const addCallNote = useCallback(
    async (sessionId: string, content: string) => {
      if (!user) return null;

      const { data, error } = await supabase
        .from("call_notes")
        .insert({
          session_id: sessionId,
          user_id: user.id,
          content,
        })
        .select()
        .single();

      if (error) {
        toast.error("Failed to save note");
        return null;
      }

      toast.success("Note saved");
      fetchCallNotes(sessionId);
      return data;
    },
    [user, fetchCallNotes],
  );

  // Update call note
  const updateCallNote = useCallback(
    async (noteId: string, content: string, sessionId: string) => {
      const { error } = await supabase
        .from("call_notes")
        .update({ content, updated_at: new Date().toISOString() })
        .eq("id", noteId);

      if (error) {
        toast.error("Failed to update note");
        return false;
      }

      toast.success("Note updated");
      fetchCallNotes(sessionId);
      return true;
    },
    [fetchCallNotes],
  );

  // Delete call note
  const deleteCallNote = useCallback(
    async (noteId: string, sessionId: string) => {
      const { error } = await supabase.from("call_notes").delete().eq("id", noteId);

      if (error) {
        toast.error("Failed to delete note");
        return;
      }

      toast.success("Note deleted");
      fetchCallNotes(sessionId);
    },
    [fetchCallNotes],
  );

  // Subscribe to real-time voicemails
  useEffect(() => {
    if (!user) return;

    fetchVoicemails();
    fetchScheduledCalls();

    const voicemailChannel = supabase
      .channel("voicemails-realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "voicemails",
          filter: `recipient_id=eq.${user.id}`,
        },
        () => {
          fetchVoicemails();
          toast.info("New voicemail received");
        },
      )
      .subscribe();

    const callsChannel = supabase
      .channel("scheduled-calls-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "scheduled_calls",
        },
        () => {
          fetchScheduledCalls();
        },
      )
      .subscribe();

    return () => {
      voicemailChannel.unsubscribe();
      supabase.removeChannel(voicemailChannel);
      callsChannel.unsubscribe();
      supabase.removeChannel(callsChannel);
    };
  }, [user, fetchVoicemails, fetchScheduledCalls]);

  return {
    voicemails,
    scheduledCalls,
    callNotes,
    loading,
    fetchVoicemails,
    leaveVoicemail,
    markVoicemailRead,
    deleteVoicemail,
    fetchScheduledCalls,
    scheduleCall,
    cancelScheduledCall,
    fetchCallNotes,
    addCallNote,
    updateCallNote,
    deleteCallNote,
  };
}
