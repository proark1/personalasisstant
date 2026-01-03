export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      activity_feed: {
        Row: {
          action: string
          actor_id: string
          created_at: string
          details: Json | null
          id: string
          item_id: string
          item_title: string | null
          item_type: string
          user_id: string
        }
        Insert: {
          action: string
          actor_id: string
          created_at?: string
          details?: Json | null
          id?: string
          item_id: string
          item_title?: string | null
          item_type: string
          user_id: string
        }
        Update: {
          action?: string
          actor_id?: string
          created_at?: string
          details?: Json | null
          id?: string
          item_id?: string
          item_title?: string | null
          item_type?: string
          user_id?: string
        }
        Relationships: []
      }
      admin_users: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_insights: {
        Row: {
          action_taken: boolean | null
          content: string
          created_at: string
          data: Json | null
          expires_at: string | null
          id: string
          insight_type: string
          is_actionable: boolean
          is_read: boolean
          title: string
          user_id: string
        }
        Insert: {
          action_taken?: boolean | null
          content: string
          created_at?: string
          data?: Json | null
          expires_at?: string | null
          id?: string
          insight_type?: string
          is_actionable?: boolean
          is_read?: boolean
          title: string
          user_id: string
        }
        Update: {
          action_taken?: boolean | null
          content?: string
          created_at?: string
          data?: Json | null
          expires_at?: string | null
          id?: string
          insight_type?: string
          is_actionable?: boolean
          is_read?: boolean
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_memory: {
        Row: {
          category: string | null
          confidence: number | null
          context: string | null
          created_at: string
          expires_at: string | null
          id: string
          is_active: boolean | null
          key: string
          last_referenced_at: string | null
          memory_type: string
          reference_count: number | null
          source: string | null
          updated_at: string
          user_id: string
          value: string
        }
        Insert: {
          category?: string | null
          confidence?: number | null
          context?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          key: string
          last_referenced_at?: string | null
          memory_type: string
          reference_count?: number | null
          source?: string | null
          updated_at?: string
          user_id: string
          value: string
        }
        Update: {
          category?: string | null
          confidence?: number | null
          context?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          key?: string
          last_referenced_at?: string | null
          memory_type?: string
          reference_count?: number | null
          source?: string | null
          updated_at?: string
          user_id?: string
          value?: string
        }
        Relationships: []
      }
      ai_usage: {
        Row: {
          completion_tokens: number | null
          cost_estimate: number | null
          created_at: string
          function_name: string
          id: string
          model: string | null
          prompt_tokens: number | null
          request_data: Json | null
          response_status: string | null
          total_tokens: number | null
          user_id: string
        }
        Insert: {
          completion_tokens?: number | null
          cost_estimate?: number | null
          created_at?: string
          function_name: string
          id?: string
          model?: string | null
          prompt_tokens?: number | null
          request_data?: Json | null
          response_status?: string | null
          total_tokens?: number | null
          user_id: string
        }
        Update: {
          completion_tokens?: number | null
          cost_estimate?: number | null
          created_at?: string
          function_name?: string
          id?: string
          model?: string | null
          prompt_tokens?: number | null
          request_data?: Json | null
          response_status?: string | null
          total_tokens?: number | null
          user_id?: string
        }
        Relationships: []
      }
      analytics_events: {
        Row: {
          created_at: string
          event_category: string
          event_data: Json | null
          event_type: string
          id: string
          page_path: string | null
          session_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          event_category: string
          event_data?: Json | null
          event_type: string
          id?: string
          page_path?: string | null
          session_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          event_category?: string
          event_data?: Json | null
          event_type?: string
          id?: string
          page_path?: string | null
          session_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      assistant_conversations: {
        Row: {
          created_at: string
          ended_at: string | null
          id: string
          is_startup_brainstorm: boolean | null
          related_startup_id: string | null
          started_at: string
          summary: string | null
          title: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          ended_at?: string | null
          id?: string
          is_startup_brainstorm?: boolean | null
          related_startup_id?: string | null
          started_at?: string
          summary?: string | null
          title?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          ended_at?: string | null
          id?: string
          is_startup_brainstorm?: boolean | null
          related_startup_id?: string | null
          started_at?: string
          summary?: string | null
          title?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_startup_idea"
            columns: ["related_startup_id"]
            isOneToOne: false
            referencedRelation: "startup_ideas"
            referencedColumns: ["id"]
          },
        ]
      }
      assistant_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
          timestamp: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          role: string
          timestamp?: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
          timestamp?: string
        }
        Relationships: [
          {
            foreignKeyName: "assistant_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "assistant_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      auto_actions_log: {
        Row: {
          action_data: Json
          action_type: string
          approved_at: string | null
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          reason: string
          rejected_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          action_data?: Json
          action_type: string
          approved_at?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          reason: string
          rejected_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          action_data?: Json
          action_type?: string
          approved_at?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          reason?: string
          rejected_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      blocked_users: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
          id: string
          reason: string | null
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
          id?: string
          reason?: string | null
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
          id?: string
          reason?: string | null
        }
        Relationships: []
      }
      brain_dumps: {
        Row: {
          ai_summary: string | null
          content: string
          converted_to_id: string | null
          converted_to_type: string | null
          created_at: string
          id: string
          is_processed: boolean
          processed_at: string | null
          suggested_category: string | null
          suggested_priority: string | null
          suggested_type: string | null
          user_id: string
          voice_url: string | null
        }
        Insert: {
          ai_summary?: string | null
          content: string
          converted_to_id?: string | null
          converted_to_type?: string | null
          created_at?: string
          id?: string
          is_processed?: boolean
          processed_at?: string | null
          suggested_category?: string | null
          suggested_priority?: string | null
          suggested_type?: string | null
          user_id: string
          voice_url?: string | null
        }
        Update: {
          ai_summary?: string | null
          content?: string
          converted_to_id?: string | null
          converted_to_type?: string | null
          created_at?: string
          id?: string
          is_processed?: boolean
          processed_at?: string | null
          suggested_category?: string | null
          suggested_priority?: string | null
          suggested_type?: string | null
          user_id?: string
          voice_url?: string | null
        }
        Relationships: []
      }
      call_notes: {
        Row: {
          content: string
          created_at: string
          id: string
          session_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          session_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          session_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_notes_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "call_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      call_recordings: {
        Row: {
          callee_id: string
          caller_id: string
          created_at: string
          duration_seconds: number
          file_path: string
          file_size_bytes: number | null
          file_url: string
          id: string
          session_id: string | null
          user_id: string
        }
        Insert: {
          callee_id: string
          caller_id: string
          created_at?: string
          duration_seconds?: number
          file_path: string
          file_size_bytes?: number | null
          file_url: string
          id?: string
          session_id?: string | null
          user_id: string
        }
        Update: {
          callee_id?: string
          caller_id?: string
          created_at?: string
          duration_seconds?: number
          file_path?: string
          file_size_bytes?: number | null
          file_url?: string
          id?: string
          session_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_recordings_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "call_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      call_sessions: {
        Row: {
          call_type: string
          callee_id: string
          caller_id: string
          created_at: string
          ended_at: string | null
          id: string
          started_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          call_type?: string
          callee_id: string
          caller_id: string
          created_at?: string
          ended_at?: string | null
          id?: string
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          call_type?: string
          callee_id?: string
          caller_id?: string
          created_at?: string
          ended_at?: string | null
          id?: string
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      chat_group_members: {
        Row: {
          group_id: string
          id: string
          joined_at: string
          role: string
          user_id: string
        }
        Insert: {
          group_id: string
          id?: string
          joined_at?: string
          role?: string
          user_id: string
        }
        Update: {
          group_id?: string
          id?: string
          joined_at?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "chat_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_groups: {
        Row: {
          avatar_url: string | null
          created_at: string
          created_by: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          is_pinned: boolean
          role: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          is_pinned?: boolean
          role: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_pinned?: boolean
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      communication_stats: {
        Row: {
          avg_response_time_seconds: number | null
          contact_id: string
          id: string
          last_interaction_at: string | null
          total_call_duration_seconds: number | null
          total_calls: number | null
          total_messages_received: number | null
          total_messages_sent: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avg_response_time_seconds?: number | null
          contact_id: string
          id?: string
          last_interaction_at?: string | null
          total_call_duration_seconds?: number | null
          total_calls?: number | null
          total_messages_received?: number | null
          total_messages_sent?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avg_response_time_seconds?: number | null
          contact_id?: string
          id?: string
          last_interaction_at?: string | null
          total_call_duration_seconds?: number | null
          total_calls?: number | null
          total_messages_received?: number | null
          total_messages_sent?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      contact_interactions: {
        Row: {
          contact_id: string
          created_at: string
          duration_minutes: number | null
          id: string
          interaction_date: string
          interaction_type: string
          notes: string | null
          user_id: string
        }
        Insert: {
          contact_id: string
          created_at?: string
          duration_minutes?: number | null
          id?: string
          interaction_date?: string
          interaction_type?: string
          notes?: string | null
          user_id: string
        }
        Update: {
          contact_id?: string
          created_at?: string
          duration_minutes?: number | null
          id?: string
          interaction_date?: string
          interaction_type?: string
          notes?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_interactions_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "user_contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      contracts: {
        Row: {
          auto_renews: boolean | null
          cancellation_notice_days: number | null
          category: string
          contact_id: string | null
          contract_number: string | null
          cost_amount: number | null
          cost_frequency: string | null
          created_at: string | null
          document_url: string | null
          end_date: string | null
          id: string
          is_active: boolean | null
          last_reminded_at: string | null
          name: string
          notes: string | null
          provider: string | null
          reminder_snoozed_until: string | null
          renewal_date: string | null
          start_date: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          auto_renews?: boolean | null
          cancellation_notice_days?: number | null
          category?: string
          contact_id?: string | null
          contract_number?: string | null
          cost_amount?: number | null
          cost_frequency?: string | null
          created_at?: string | null
          document_url?: string | null
          end_date?: string | null
          id?: string
          is_active?: boolean | null
          last_reminded_at?: string | null
          name: string
          notes?: string | null
          provider?: string | null
          reminder_snoozed_until?: string | null
          renewal_date?: string | null
          start_date?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          auto_renews?: boolean | null
          cancellation_notice_days?: number | null
          category?: string
          contact_id?: string | null
          contract_number?: string | null
          cost_amount?: number | null
          cost_frequency?: string | null
          created_at?: string | null
          document_url?: string | null
          end_date?: string | null
          id?: string
          is_active?: boolean | null
          last_reminded_at?: string | null
          name?: string
          notes?: string | null
          provider?: string | null
          reminder_snoozed_until?: string | null
          renewal_date?: string | null
          start_date?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contracts_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "user_contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_checkins: {
        Row: {
          alcohol_units: number | null
          caffeine_intake: number | null
          challenges: string | null
          checkin_date: string
          checkin_type: string
          created_at: string
          day_rating: number | null
          energy_level: string | null
          exercise_minutes: number | null
          focus_completed: boolean | null
          focus_quality: number | null
          gratitude_note: string | null
          id: string
          main_focus: string | null
          medication_taken: boolean | null
          mood: string | null
          mood_note: string | null
          physical_symptoms: string[] | null
          screen_time_minutes: number | null
          sleep_hours: number | null
          sleep_quality: number | null
          social_interactions: number | null
          stress_level: number | null
          tomorrow_priority: string | null
          updated_at: string
          user_id: string
          water_glasses: number | null
          went_well: string | null
        }
        Insert: {
          alcohol_units?: number | null
          caffeine_intake?: number | null
          challenges?: string | null
          checkin_date?: string
          checkin_type?: string
          created_at?: string
          day_rating?: number | null
          energy_level?: string | null
          exercise_minutes?: number | null
          focus_completed?: boolean | null
          focus_quality?: number | null
          gratitude_note?: string | null
          id?: string
          main_focus?: string | null
          medication_taken?: boolean | null
          mood?: string | null
          mood_note?: string | null
          physical_symptoms?: string[] | null
          screen_time_minutes?: number | null
          sleep_hours?: number | null
          sleep_quality?: number | null
          social_interactions?: number | null
          stress_level?: number | null
          tomorrow_priority?: string | null
          updated_at?: string
          user_id: string
          water_glasses?: number | null
          went_well?: string | null
        }
        Update: {
          alcohol_units?: number | null
          caffeine_intake?: number | null
          challenges?: string | null
          checkin_date?: string
          checkin_type?: string
          created_at?: string
          day_rating?: number | null
          energy_level?: string | null
          exercise_minutes?: number | null
          focus_completed?: boolean | null
          focus_quality?: number | null
          gratitude_note?: string | null
          id?: string
          main_focus?: string | null
          medication_taken?: boolean | null
          mood?: string | null
          mood_note?: string | null
          physical_symptoms?: string[] | null
          screen_time_minutes?: number | null
          sleep_hours?: number | null
          sleep_quality?: number | null
          social_interactions?: number | null
          stress_level?: number | null
          tomorrow_priority?: string | null
          updated_at?: string
          user_id?: string
          water_glasses?: number | null
          went_well?: string | null
        }
        Relationships: []
      }
      day_predictions: {
        Row: {
          accuracy_score: number | null
          actual_outcome: number | null
          created_at: string
          factors: Json
          id: string
          insight: string | null
          label: string
          prediction_date: string
          score: number
          suggestions: Json | null
          user_id: string
          weather_data: Json | null
        }
        Insert: {
          accuracy_score?: number | null
          actual_outcome?: number | null
          created_at?: string
          factors?: Json
          id?: string
          insight?: string | null
          label: string
          prediction_date: string
          score: number
          suggestions?: Json | null
          user_id: string
          weather_data?: Json | null
        }
        Update: {
          accuracy_score?: number | null
          actual_outcome?: number | null
          created_at?: string
          factors?: Json
          id?: string
          insight?: string | null
          label?: string
          prediction_date?: string
          score?: number
          suggestions?: Json | null
          user_id?: string
          weather_data?: Json | null
        }
        Relationships: []
      }
      dhikr_logs: {
        Row: {
          completed_count: number | null
          created_at: string
          dhikr_type: string
          id: string
          log_date: string
          target_count: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_count?: number | null
          created_at?: string
          dhikr_type: string
          id?: string
          log_date?: string
          target_count?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_count?: number | null
          created_at?: string
          dhikr_type?: string
          id?: string
          log_date?: string
          target_count?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      direct_messages: {
        Row: {
          attachments: Json | null
          content: string
          created_at: string
          encrypted_content: string | null
          encrypted_key: string | null
          encryption_version: number | null
          id: string
          is_read: boolean
          reactions: Json | null
          read_at: string | null
          recipient_id: string
          sender_id: string
        }
        Insert: {
          attachments?: Json | null
          content: string
          created_at?: string
          encrypted_content?: string | null
          encrypted_key?: string | null
          encryption_version?: number | null
          id?: string
          is_read?: boolean
          reactions?: Json | null
          read_at?: string | null
          recipient_id: string
          sender_id: string
        }
        Update: {
          attachments?: Json | null
          content?: string
          created_at?: string
          encrypted_content?: string | null
          encrypted_key?: string | null
          encryption_version?: number | null
          id?: string
          is_read?: boolean
          reactions?: Json | null
          read_at?: string | null
          recipient_id?: string
          sender_id?: string
        }
        Relationships: []
      }
      events: {
        Row: {
          attendees: string[] | null
          category: string | null
          created_at: string
          description: string | null
          end_time: string
          id: string
          last_reminded_at: string | null
          location: string | null
          recurrence_end: string | null
          recurrence_rule: string | null
          start_time: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          attendees?: string[] | null
          category?: string | null
          created_at?: string
          description?: string | null
          end_time: string
          id?: string
          last_reminded_at?: string | null
          location?: string | null
          recurrence_end?: string | null
          recurrence_rule?: string | null
          start_time: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          attendees?: string[] | null
          category?: string | null
          created_at?: string
          description?: string | null
          end_time?: string
          id?: string
          last_reminded_at?: string | null
          location?: string | null
          recurrence_end?: string | null
          recurrence_rule?: string | null
          start_time?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      external_calendar_connections: {
        Row: {
          calendar_id: string | null
          color: string | null
          created_at: string
          id: string
          last_synced_at: string | null
          name: string
          provider: string
          sync_enabled: boolean | null
          sync_token: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          calendar_id?: string | null
          color?: string | null
          created_at?: string
          id?: string
          last_synced_at?: string | null
          name: string
          provider?: string
          sync_enabled?: boolean | null
          sync_token?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          calendar_id?: string | null
          color?: string | null
          created_at?: string
          id?: string
          last_synced_at?: string | null
          name?: string
          provider?: string
          sync_enabled?: boolean | null
          sync_token?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      family_appointments: {
        Row: {
          appointment_date: string
          appointment_type: string | null
          created_at: string
          family_member_id: string | null
          id: string
          is_completed: boolean | null
          location: string | null
          notes: string | null
          provider_name: string | null
          provider_phone: string | null
          reminder_before: number | null
          title: string
          user_id: string
        }
        Insert: {
          appointment_date: string
          appointment_type?: string | null
          created_at?: string
          family_member_id?: string | null
          id?: string
          is_completed?: boolean | null
          location?: string | null
          notes?: string | null
          provider_name?: string | null
          provider_phone?: string | null
          reminder_before?: number | null
          title: string
          user_id: string
        }
        Update: {
          appointment_date?: string
          appointment_type?: string | null
          created_at?: string
          family_member_id?: string | null
          id?: string
          is_completed?: boolean | null
          location?: string | null
          notes?: string | null
          provider_name?: string | null
          provider_phone?: string | null
          reminder_before?: number | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_appointments_family_member_id_fkey"
            columns: ["family_member_id"]
            isOneToOne: false
            referencedRelation: "family_members"
            referencedColumns: ["id"]
          },
        ]
      }
      family_budget_categories: {
        Row: {
          color: string | null
          created_at: string
          icon: string | null
          id: string
          monthly_limit: number | null
          name: string
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          monthly_limit?: number | null
          name: string
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          monthly_limit?: number | null
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      family_documents: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          expiry_date: string | null
          family_member_id: string | null
          file_path: string
          file_size: number | null
          file_type: string | null
          file_url: string
          id: string
          is_sensitive: boolean | null
          name: string
          tags: string[] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          expiry_date?: string | null
          family_member_id?: string | null
          file_path: string
          file_size?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          is_sensitive?: boolean | null
          name: string
          tags?: string[] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          expiry_date?: string | null
          family_member_id?: string | null
          file_path?: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          is_sensitive?: boolean | null
          name?: string
          tags?: string[] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_documents_family_member_id_fkey"
            columns: ["family_member_id"]
            isOneToOne: false
            referencedRelation: "family_members"
            referencedColumns: ["id"]
          },
        ]
      }
      family_events: {
        Row: {
          created_at: string
          description: string | null
          end_time: string
          event_type: string | null
          id: string
          is_all_day: boolean | null
          location: string | null
          notes: string | null
          recurrence_rule: string | null
          related_member_id: string | null
          reminder_before: number | null
          start_time: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          end_time: string
          event_type?: string | null
          id?: string
          is_all_day?: boolean | null
          location?: string | null
          notes?: string | null
          recurrence_rule?: string | null
          related_member_id?: string | null
          reminder_before?: number | null
          start_time: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          end_time?: string
          event_type?: string | null
          id?: string
          is_all_day?: boolean | null
          location?: string | null
          notes?: string | null
          recurrence_rule?: string | null
          related_member_id?: string | null
          reminder_before?: number | null
          start_time?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_events_related_member_id_fkey"
            columns: ["related_member_id"]
            isOneToOne: false
            referencedRelation: "family_members"
            referencedColumns: ["id"]
          },
        ]
      }
      family_expenses: {
        Row: {
          amount: number
          category_id: string | null
          created_at: string
          description: string | null
          expense_date: string
          family_member_id: string | null
          id: string
          receipt_url: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          category_id?: string | null
          created_at?: string
          description?: string | null
          expense_date?: string
          family_member_id?: string | null
          id?: string
          receipt_url?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          category_id?: string | null
          created_at?: string
          description?: string | null
          expense_date?: string
          family_member_id?: string | null
          id?: string
          receipt_url?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_expenses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "family_budget_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "family_expenses_family_member_id_fkey"
            columns: ["family_member_id"]
            isOneToOne: false
            referencedRelation: "family_members"
            referencedColumns: ["id"]
          },
        ]
      }
      family_medications: {
        Row: {
          created_at: string
          dosage: string | null
          end_date: string | null
          family_member_id: string | null
          frequency: string | null
          id: string
          is_active: boolean | null
          name: string
          notes: string | null
          pharmacy: string | null
          prescribing_doctor: string | null
          refill_date: string | null
          start_date: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          dosage?: string | null
          end_date?: string | null
          family_member_id?: string | null
          frequency?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          notes?: string | null
          pharmacy?: string | null
          prescribing_doctor?: string | null
          refill_date?: string | null
          start_date?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          dosage?: string | null
          end_date?: string | null
          family_member_id?: string | null
          frequency?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          notes?: string | null
          pharmacy?: string | null
          prescribing_doctor?: string | null
          refill_date?: string | null
          start_date?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_medications_family_member_id_fkey"
            columns: ["family_member_id"]
            isOneToOne: false
            referencedRelation: "family_members"
            referencedColumns: ["id"]
          },
        ]
      }
      family_members: {
        Row: {
          activities: Json | null
          address: string | null
          allergies: string[] | null
          attends_kindergarten: boolean | null
          attends_school: boolean | null
          avatar_url: string | null
          birth_date: string | null
          clothing_sizes: Json | null
          contact_id: string | null
          created_at: string
          email: string | null
          id: string
          is_active: boolean | null
          kindergarten_name: string | null
          kindergarten_teacher_contact: string | null
          kindergarten_teacher_name: string | null
          lives_with_user: boolean | null
          medical_notes: string | null
          milestones: Json | null
          name: string
          notes: string | null
          phone: string | null
          preferences: Json | null
          relationship: string
          school_grade: string | null
          school_name: string | null
          teacher_contact: string | null
          teacher_name: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          activities?: Json | null
          address?: string | null
          allergies?: string[] | null
          attends_kindergarten?: boolean | null
          attends_school?: boolean | null
          avatar_url?: string | null
          birth_date?: string | null
          clothing_sizes?: Json | null
          contact_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean | null
          kindergarten_name?: string | null
          kindergarten_teacher_contact?: string | null
          kindergarten_teacher_name?: string | null
          lives_with_user?: boolean | null
          medical_notes?: string | null
          milestones?: Json | null
          name: string
          notes?: string | null
          phone?: string | null
          preferences?: Json | null
          relationship: string
          school_grade?: string | null
          school_name?: string | null
          teacher_contact?: string | null
          teacher_name?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          activities?: Json | null
          address?: string | null
          allergies?: string[] | null
          attends_kindergarten?: boolean | null
          attends_school?: boolean | null
          avatar_url?: string | null
          birth_date?: string | null
          clothing_sizes?: Json | null
          contact_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean | null
          kindergarten_name?: string | null
          kindergarten_teacher_contact?: string | null
          kindergarten_teacher_name?: string | null
          lives_with_user?: boolean | null
          medical_notes?: string | null
          milestones?: Json | null
          name?: string
          notes?: string | null
          phone?: string | null
          preferences?: Json | null
          relationship?: string
          school_grade?: string | null
          school_name?: string | null
          teacher_contact?: string | null
          teacher_name?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_members_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "user_contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      family_vaccinations: {
        Row: {
          administered_by: string | null
          created_at: string
          date_administered: string
          family_member_id: string | null
          id: string
          location: string | null
          lot_number: string | null
          next_dose_date: string | null
          notes: string | null
          user_id: string
          vaccine_name: string
        }
        Insert: {
          administered_by?: string | null
          created_at?: string
          date_administered: string
          family_member_id?: string | null
          id?: string
          location?: string | null
          lot_number?: string | null
          next_dose_date?: string | null
          notes?: string | null
          user_id: string
          vaccine_name: string
        }
        Update: {
          administered_by?: string | null
          created_at?: string
          date_administered?: string
          family_member_id?: string | null
          id?: string
          location?: string | null
          lot_number?: string | null
          next_dose_date?: string | null
          notes?: string | null
          user_id?: string
          vaccine_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_vaccinations_family_member_id_fkey"
            columns: ["family_member_id"]
            isOneToOne: false
            referencedRelation: "family_members"
            referencedColumns: ["id"]
          },
        ]
      }
      focus_sessions: {
        Row: {
          completed_at: string | null
          duration_minutes: number
          id: string
          is_completed: boolean
          started_at: string
          task_id: string | null
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          duration_minutes: number
          id?: string
          is_completed?: boolean
          started_at?: string
          task_id?: string | null
          user_id: string
        }
        Update: {
          completed_at?: string | null
          duration_minutes?: number
          id?: string
          is_completed?: boolean
          started_at?: string
          task_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "focus_sessions_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      follow_up_queue: {
        Row: {
          check_at: string
          completed_at: string | null
          context: Json | null
          created_at: string
          entity_id: string
          entity_type: string
          follow_up_type: string
          id: string
          message_template: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          check_at: string
          completed_at?: string | null
          context?: Json | null
          created_at?: string
          entity_id: string
          entity_type: string
          follow_up_type: string
          id?: string
          message_template?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          check_at?: string
          completed_at?: string | null
          context?: Json | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          follow_up_type?: string
          id?: string
          message_template?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      goals: {
        Row: {
          color: string | null
          completed_at: string | null
          created_at: string
          current_value: number
          description: string | null
          icon: string | null
          id: string
          is_completed: boolean
          linked_habits: string[] | null
          name: string
          target_date: string | null
          target_value: number
          unit: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          color?: string | null
          completed_at?: string | null
          created_at?: string
          current_value?: number
          description?: string | null
          icon?: string | null
          id?: string
          is_completed?: boolean
          linked_habits?: string[] | null
          name: string
          target_date?: string | null
          target_value?: number
          unit?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          color?: string | null
          completed_at?: string | null
          created_at?: string
          current_value?: number
          description?: string | null
          icon?: string | null
          id?: string
          is_completed?: boolean
          linked_habits?: string[] | null
          name?: string
          target_date?: string | null
          target_value?: number
          unit?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      group_encryption_keys: {
        Row: {
          created_at: string | null
          encrypted_group_key: string
          group_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          encrypted_group_key: string
          group_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          encrypted_group_key?: string
          group_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_encryption_keys_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "chat_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      group_message_reads: {
        Row: {
          id: string
          message_id: string
          read_at: string
          user_id: string
        }
        Insert: {
          id?: string
          message_id: string
          read_at?: string
          user_id: string
        }
        Update: {
          id?: string
          message_id?: string
          read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_message_reads_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "group_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      group_messages: {
        Row: {
          attachments: Json | null
          content: string
          created_at: string
          encrypted_content: string | null
          encrypted_keys: Json | null
          encryption_version: number | null
          group_id: string
          id: string
          reactions: Json | null
          sender_id: string
        }
        Insert: {
          attachments?: Json | null
          content?: string
          created_at?: string
          encrypted_content?: string | null
          encrypted_keys?: Json | null
          encryption_version?: number | null
          group_id: string
          id?: string
          reactions?: Json | null
          sender_id: string
        }
        Update: {
          attachments?: Json | null
          content?: string
          created_at?: string
          encrypted_content?: string | null
          encrypted_keys?: Json | null
          encryption_version?: number | null
          group_id?: string
          id?: string
          reactions?: Json | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_messages_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "chat_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      habit_logs: {
        Row: {
          completed_count: number
          created_at: string
          habit_id: string
          id: string
          log_date: string
          notes: string | null
          user_id: string
        }
        Insert: {
          completed_count?: number
          created_at?: string
          habit_id: string
          id?: string
          log_date: string
          notes?: string | null
          user_id: string
        }
        Update: {
          completed_count?: number
          created_at?: string
          habit_id?: string
          id?: string
          log_date?: string
          notes?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "habit_logs_habit_id_fkey"
            columns: ["habit_id"]
            isOneToOne: false
            referencedRelation: "habits"
            referencedColumns: ["id"]
          },
        ]
      }
      habits: {
        Row: {
          color: string | null
          created_at: string
          days_of_week: number[] | null
          description: string | null
          frequency: string
          icon: string | null
          id: string
          is_active: boolean
          last_reminded_at: string | null
          name: string
          reminder_time: string | null
          target_count: number
          updated_at: string
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          days_of_week?: number[] | null
          description?: string | null
          frequency?: string
          icon?: string | null
          id?: string
          is_active?: boolean
          last_reminded_at?: string | null
          name: string
          reminder_time?: string | null
          target_count?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          days_of_week?: number[] | null
          description?: string | null
          frequency?: string
          icon?: string | null
          id?: string
          is_active?: boolean
          last_reminded_at?: string | null
          name?: string
          reminder_time?: string | null
          target_count?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      hadith_favorites: {
        Row: {
          arabic_text: string
          chapter: string | null
          created_at: string
          english_text: string
          hadith_collection: string
          hadith_number: number
          id: string
          narrator: string | null
          user_id: string
        }
        Insert: {
          arabic_text: string
          chapter?: string | null
          created_at?: string
          english_text: string
          hadith_collection: string
          hadith_number: number
          id?: string
          narrator?: string | null
          user_id: string
        }
        Update: {
          arabic_text?: string
          chapter?: string | null
          created_at?: string
          english_text?: string
          hadith_collection?: string
          hadith_number?: number
          id?: string
          narrator?: string | null
          user_id?: string
        }
        Relationships: []
      }
      health_metrics: {
        Row: {
          created_at: string
          id: string
          metric_type: string
          notes: string | null
          recorded_at: string
          source: string
          unit: string
          user_id: string
          value: number
        }
        Insert: {
          created_at?: string
          id?: string
          metric_type: string
          notes?: string | null
          recorded_at?: string
          source?: string
          unit: string
          user_id: string
          value: number
        }
        Update: {
          created_at?: string
          id?: string
          metric_type?: string
          notes?: string | null
          recorded_at?: string
          source?: string
          unit?: string
          user_id?: string
          value?: number
        }
        Relationships: []
      }
      household_tasks: {
        Row: {
          assigned_to: string | null
          category: string | null
          completed_at: string | null
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          is_completed: boolean | null
          priority: string | null
          recurrence_rule: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assigned_to?: string | null
          category?: string | null
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          is_completed?: boolean | null
          priority?: string | null
          recurrence_rule?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          assigned_to?: string | null
          category?: string | null
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          is_completed?: boolean | null
          priority?: string | null
          recurrence_rule?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "household_tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "family_members"
            referencedColumns: ["id"]
          },
        ]
      }
      life_correlations: {
        Row: {
          confidence_score: number
          correlation_strength: number
          correlation_type: string
          created_at: string
          data_points: number
          domain_a: string
          domain_b: string
          id: string
          insight_text: string | null
          is_dismissed: boolean | null
          last_updated_at: string | null
          pattern_description: string
          sample_data: Json | null
          user_id: string
        }
        Insert: {
          confidence_score?: number
          correlation_strength?: number
          correlation_type: string
          created_at?: string
          data_points?: number
          domain_a: string
          domain_b: string
          id?: string
          insight_text?: string | null
          is_dismissed?: boolean | null
          last_updated_at?: string | null
          pattern_description: string
          sample_data?: Json | null
          user_id: string
        }
        Update: {
          confidence_score?: number
          correlation_strength?: number
          correlation_type?: string
          created_at?: string
          data_points?: number
          domain_a?: string
          domain_b?: string
          id?: string
          insight_text?: string | null
          is_dismissed?: boolean | null
          last_updated_at?: string | null
          pattern_description?: string
          sample_data?: Json | null
          user_id?: string
        }
        Relationships: []
      }
      location_triggers: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          last_triggered_at: string | null
          latitude: number
          longitude: number
          name: string
          radius_meters: number
          reminder_message: string
          trigger_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          last_triggered_at?: string | null
          latitude: number
          longitude: number
          name: string
          radius_meters?: number
          reminder_message: string
          trigger_type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          last_triggered_at?: string | null
          latitude?: number
          longitude?: number
          name?: string
          radius_meters?: number
          reminder_message?: string
          trigger_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      meal_plans: {
        Row: {
          created_at: string
          custom_meal_name: string | null
          id: string
          meal_date: string
          meal_type: string
          notes: string | null
          recipe_id: string | null
          servings: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          custom_meal_name?: string | null
          id?: string
          meal_date: string
          meal_type?: string
          notes?: string | null
          recipe_id?: string | null
          servings?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          custom_meal_name?: string | null
          id?: string
          meal_date?: string
          meal_type?: string
          notes?: string | null
          recipe_id?: string | null
          servings?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meal_plans_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      message_read_receipts: {
        Row: {
          id: string
          message_id: string
          message_type: string
          read_at: string
          user_id: string
        }
        Insert: {
          id?: string
          message_id: string
          message_type: string
          read_at?: string
          user_id: string
        }
        Update: {
          id?: string
          message_id?: string
          message_type?: string
          read_at?: string
          user_id?: string
        }
        Relationships: []
      }
      news_preferences: {
        Row: {
          created_at: string
          id: string
          include_in_briefing: boolean | null
          sources: string[] | null
          topics: string[] | null
          update_frequency: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          include_in_briefing?: boolean | null
          sources?: string[] | null
          topics?: string[] | null
          update_frequency?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          include_in_briefing?: boolean | null
          sources?: string[] | null
          topics?: string[] | null
          update_frequency?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notes: {
        Row: {
          content: string
          created_at: string
          id: string
          is_pinned: boolean
          linked_items: Json | null
          tags: string[] | null
          title: string
          trashed: boolean
          trashed_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          content?: string
          created_at?: string
          id?: string
          is_pinned?: boolean
          linked_items?: Json | null
          tags?: string[] | null
          title?: string
          trashed?: boolean
          trashed_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_pinned?: boolean
          linked_items?: Json | null
          tags?: string[] | null
          title?: string
          trashed?: boolean
          trashed_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          adhd_mode: boolean
          created_at: string
          default_reminder_minutes: number
          event_notifications: boolean
          id: string
          quiet_hours_enabled: boolean
          quiet_hours_end: string | null
          quiet_hours_start: string | null
          shared_item_notifications: boolean
          sound_enabled: boolean
          sound_type: string
          task_notifications: boolean
          updated_at: string
          user_id: string
          vibration_enabled: boolean
        }
        Insert: {
          adhd_mode?: boolean
          created_at?: string
          default_reminder_minutes?: number
          event_notifications?: boolean
          id?: string
          quiet_hours_enabled?: boolean
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          shared_item_notifications?: boolean
          sound_enabled?: boolean
          sound_type?: string
          task_notifications?: boolean
          updated_at?: string
          user_id: string
          vibration_enabled?: boolean
        }
        Update: {
          adhd_mode?: boolean
          created_at?: string
          default_reminder_minutes?: number
          event_notifications?: boolean
          id?: string
          quiet_hours_enabled?: boolean
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          shared_item_notifications?: boolean
          sound_enabled?: boolean
          sound_type?: string
          task_notifications?: boolean
          updated_at?: string
          user_id?: string
          vibration_enabled?: boolean
        }
        Relationships: []
      }
      nudge_rules: {
        Row: {
          action_config: Json
          action_type: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          last_triggered_at: string | null
          name: string
          priority: number
          times_triggered: number
          trigger_conditions: Json
          trigger_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          action_config?: Json
          action_type: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          last_triggered_at?: string | null
          name: string
          priority?: number
          times_triggered?: number
          trigger_conditions?: Json
          trigger_type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          action_config?: Json
          action_type?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          last_triggered_at?: string | null
          name?: string
          priority?: number
          times_triggered?: number
          trigger_conditions?: Json
          trigger_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      offline_sync_queue: {
        Row: {
          created_at: string
          id: string
          operation: string
          payload: Json
          record_id: string
          synced: boolean
          synced_at: string | null
          table_name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          operation: string
          payload: Json
          record_id: string
          synced?: boolean
          synced_at?: string | null
          table_name: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          operation?: string
          payload?: Json
          record_id?: string
          synced?: boolean
          synced_at?: string | null
          table_name?: string
          user_id?: string
        }
        Relationships: []
      }
      pinned_messages: {
        Row: {
          chat_id: string
          created_at: string
          id: string
          message_id: string
          message_type: string
          pinned_by: string
        }
        Insert: {
          chat_id: string
          created_at?: string
          id?: string
          message_id: string
          message_type: string
          pinned_by: string
        }
        Update: {
          chat_id?: string
          created_at?: string
          id?: string
          message_id?: string
          message_type?: string
          pinned_by?: string
        }
        Relationships: []
      }
      proactive_reminders: {
        Row: {
          action_taken: boolean | null
          action_type: string | null
          created_at: string
          delivered_at: string | null
          id: string
          is_active: boolean | null
          message: string
          metadata: Json | null
          priority: string
          read_at: string | null
          reminder_type: string
          scheduled_for: string
          snooze_until: string | null
          title: string
          trigger_entity_id: string | null
          trigger_entity_type: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          action_taken?: boolean | null
          action_type?: string | null
          created_at?: string
          delivered_at?: string | null
          id?: string
          is_active?: boolean | null
          message: string
          metadata?: Json | null
          priority?: string
          read_at?: string | null
          reminder_type: string
          scheduled_for: string
          snooze_until?: string | null
          title: string
          trigger_entity_id?: string | null
          trigger_entity_type?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          action_taken?: boolean | null
          action_type?: string | null
          created_at?: string
          delivered_at?: string | null
          id?: string
          is_active?: boolean | null
          message?: string
          metadata?: Json | null
          priority?: string
          read_at?: string | null
          reminder_type?: string
          scheduled_for?: string
          snooze_until?: string | null
          title?: string
          trigger_entity_id?: string | null
          trigger_entity_type?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      proactive_settings: {
        Row: {
          calendar_overload_enabled: boolean | null
          calendar_overload_threshold: number | null
          contact_checkin_days: number | null
          contact_checkins_enabled: boolean | null
          contract_reminder_days: number[] | null
          contract_renewals_enabled: boolean | null
          created_at: string
          daily_review_enabled: boolean | null
          enabled: boolean | null
          evening_review_time: string | null
          event_prep_enabled: boolean | null
          forgotten_task_days: number | null
          forgotten_tasks_enabled: boolean | null
          habit_streak_warning_hours: number | null
          habit_streaks_enabled: boolean | null
          id: string
          in_app_notifications_enabled: boolean | null
          morning_briefing_time: string | null
          push_notifications_enabled: boolean | null
          quiet_hours_enabled: boolean | null
          quiet_hours_end: string | null
          quiet_hours_start: string | null
          updated_at: string
          user_id: string
          voice_alerts_enabled: boolean | null
          voice_proactive_enabled: boolean | null
          weekly_planning_day: number | null
          weekly_planning_enabled: boolean | null
        }
        Insert: {
          calendar_overload_enabled?: boolean | null
          calendar_overload_threshold?: number | null
          contact_checkin_days?: number | null
          contact_checkins_enabled?: boolean | null
          contract_reminder_days?: number[] | null
          contract_renewals_enabled?: boolean | null
          created_at?: string
          daily_review_enabled?: boolean | null
          enabled?: boolean | null
          evening_review_time?: string | null
          event_prep_enabled?: boolean | null
          forgotten_task_days?: number | null
          forgotten_tasks_enabled?: boolean | null
          habit_streak_warning_hours?: number | null
          habit_streaks_enabled?: boolean | null
          id?: string
          in_app_notifications_enabled?: boolean | null
          morning_briefing_time?: string | null
          push_notifications_enabled?: boolean | null
          quiet_hours_enabled?: boolean | null
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          updated_at?: string
          user_id: string
          voice_alerts_enabled?: boolean | null
          voice_proactive_enabled?: boolean | null
          weekly_planning_day?: number | null
          weekly_planning_enabled?: boolean | null
        }
        Update: {
          calendar_overload_enabled?: boolean | null
          calendar_overload_threshold?: number | null
          contact_checkin_days?: number | null
          contact_checkins_enabled?: boolean | null
          contract_reminder_days?: number[] | null
          contract_renewals_enabled?: boolean | null
          created_at?: string
          daily_review_enabled?: boolean | null
          enabled?: boolean | null
          evening_review_time?: string | null
          event_prep_enabled?: boolean | null
          forgotten_task_days?: number | null
          forgotten_tasks_enabled?: boolean | null
          habit_streak_warning_hours?: number | null
          habit_streaks_enabled?: boolean | null
          id?: string
          in_app_notifications_enabled?: boolean | null
          morning_briefing_time?: string | null
          push_notifications_enabled?: boolean | null
          quiet_hours_enabled?: boolean | null
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          updated_at?: string
          user_id?: string
          voice_alerts_enabled?: boolean | null
          voice_proactive_enabled?: boolean | null
          weekly_planning_day?: number | null
          weekly_planning_enabled?: boolean | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          birth_date: string | null
          businesses: string[] | null
          created_at: string
          display_name: string | null
          email: string | null
          goals: string | null
          id: string
          interests: string[] | null
          last_session_at: string | null
          location_city: string | null
          location_country: string | null
          onboarding_completed: boolean | null
          onboarding_preferences: Json | null
          preferred_work_hours: string | null
          public_key: string | null
          role: string | null
          skills: string[] | null
          timezone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          birth_date?: string | null
          businesses?: string[] | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          goals?: string | null
          id?: string
          interests?: string[] | null
          last_session_at?: string | null
          location_city?: string | null
          location_country?: string | null
          onboarding_completed?: boolean | null
          onboarding_preferences?: Json | null
          preferred_work_hours?: string | null
          public_key?: string | null
          role?: string | null
          skills?: string[] | null
          timezone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          birth_date?: string | null
          businesses?: string[] | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          goals?: string | null
          id?: string
          interests?: string[] | null
          last_session_at?: string | null
          location_city?: string | null
          location_country?: string | null
          onboarding_completed?: boolean | null
          onboarding_preferences?: Json | null
          preferred_work_hours?: string | null
          public_key?: string | null
          role?: string | null
          skills?: string[] | null
          timezone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          color: string
          created_at: string
          description: string | null
          id: string
          is_archived: boolean
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          description?: string | null
          id?: string
          is_archived?: boolean
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string
          description?: string | null
          id?: string
          is_archived?: boolean
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      properties: {
        Row: {
          address: string | null
          city: string | null
          country: string | null
          created_at: string
          current_value: number | null
          id: string
          image_url: string | null
          is_active: boolean | null
          name: string
          notes: string | null
          property_type: string
          purchase_date: string | null
          purchase_price: number | null
          size_sqm: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          current_value?: number | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name: string
          notes?: string | null
          property_type: string
          purchase_date?: string | null
          purchase_price?: number | null
          size_sqm?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          current_value?: number | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name?: string
          notes?: string | null
          property_type?: string
          purchase_date?: string | null
          purchase_price?: number | null
          size_sqm?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      property_checklists: {
        Row: {
          checklist_type: string | null
          created_at: string
          id: string
          items: Json | null
          name: string
          property_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          checklist_type?: string | null
          created_at?: string
          id?: string
          items?: Json | null
          name: string
          property_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          checklist_type?: string | null
          created_at?: string
          id?: string
          items?: Json | null
          name?: string
          property_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_checklists_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_documents: {
        Row: {
          created_at: string
          document_type: string | null
          expiry_date: string | null
          file_path: string
          file_url: string
          id: string
          name: string
          notes: string | null
          property_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          document_type?: string | null
          expiry_date?: string | null
          file_path: string
          file_url: string
          id?: string
          name: string
          notes?: string | null
          property_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          document_type?: string | null
          expiry_date?: string | null
          file_path?: string
          file_url?: string
          id?: string
          name?: string
          notes?: string | null
          property_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_documents_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_maintenance: {
        Row: {
          category: string | null
          completed_date: string | null
          cost: number | null
          created_at: string
          description: string | null
          id: string
          is_recurring: boolean | null
          property_id: string
          recurrence_rule: string | null
          scheduled_date: string | null
          status: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string | null
          completed_date?: string | null
          cost?: number | null
          created_at?: string
          description?: string | null
          id?: string
          is_recurring?: boolean | null
          property_id: string
          recurrence_rule?: string | null
          scheduled_date?: string | null
          status?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string | null
          completed_date?: string | null
          cost?: number | null
          created_at?: string
          description?: string | null
          id?: string
          is_recurring?: boolean | null
          property_id?: string
          recurrence_rule?: string | null
          scheduled_date?: string | null
          status?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_maintenance_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      public_holidays: {
        Row: {
          country_code: string
          country_name: string
          created_at: string
          date: string
          id: string
          is_fixed: boolean | null
          local_name: string | null
          name: string
        }
        Insert: {
          country_code: string
          country_name: string
          created_at?: string
          date: string
          id?: string
          is_fixed?: boolean | null
          local_name?: string | null
          name: string
        }
        Update: {
          country_code?: string
          country_name?: string
          created_at?: string
          date?: string
          id?: string
          is_fixed?: boolean | null
          local_name?: string | null
          name?: string
        }
        Relationships: []
      }
      push_tokens: {
        Row: {
          created_at: string
          device_id: string | null
          expo_push_token: string | null
          id: string
          platform: string
          token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          device_id?: string | null
          expo_push_token?: string | null
          id?: string
          platform: string
          token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          device_id?: string | null
          expo_push_token?: string | null
          id?: string
          platform?: string
          token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      quran_bookmarks: {
        Row: {
          ayah_number: number
          ayah_text: string
          created_at: string
          id: string
          note: string | null
          surah_english_name: string
          surah_name: string
          surah_number: number
          user_id: string
        }
        Insert: {
          ayah_number: number
          ayah_text: string
          created_at?: string
          id?: string
          note?: string | null
          surah_english_name: string
          surah_name: string
          surah_number: number
          user_id: string
        }
        Update: {
          ayah_number?: number
          ayah_text?: string
          created_at?: string
          id?: string
          note?: string | null
          surah_english_name?: string
          surah_name?: string
          surah_number?: number
          user_id?: string
        }
        Relationships: []
      }
      quran_hifz_progress: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          last_revised_at: string | null
          memorized_ayahs: number
          notes: string | null
          started_at: string | null
          status: string
          surah_name: string
          surah_name_arabic: string
          surah_number: number
          total_ayahs: number
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          last_revised_at?: string | null
          memorized_ayahs?: number
          notes?: string | null
          started_at?: string | null
          status?: string
          surah_name: string
          surah_name_arabic: string
          surah_number: number
          total_ayahs: number
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          last_revised_at?: string | null
          memorized_ayahs?: number
          notes?: string | null
          started_at?: string | null
          status?: string
          surah_name?: string
          surah_name_arabic?: string
          surah_number?: number
          total_ayahs?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      quran_reading_goals: {
        Row: {
          created_at: string
          daily_ayahs_goal: number
          daily_pages_goal: number | null
          daily_surahs_goal: number | null
          id: string
          reminder_enabled: boolean | null
          reminder_time: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          daily_ayahs_goal?: number
          daily_pages_goal?: number | null
          daily_surahs_goal?: number | null
          id?: string
          reminder_enabled?: boolean | null
          reminder_time?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          daily_ayahs_goal?: number
          daily_pages_goal?: number | null
          daily_surahs_goal?: number | null
          id?: string
          reminder_enabled?: boolean | null
          reminder_time?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      quran_reading_progress: {
        Row: {
          ayah_number: number
          created_at: string
          id: string
          read_at: string
          session_id: string | null
          surah_number: number
          user_id: string
        }
        Insert: {
          ayah_number: number
          created_at?: string
          id?: string
          read_at?: string
          session_id?: string | null
          surah_number: number
          user_id: string
        }
        Update: {
          ayah_number?: number
          created_at?: string
          id?: string
          read_at?: string
          session_id?: string | null
          surah_number?: number
          user_id?: string
        }
        Relationships: []
      }
      ramadan_tracker: {
        Row: {
          created_at: string
          day_number: number
          fasting_completed: boolean | null
          id: string
          iftar_time: string | null
          notes: string | null
          suhoor_time: string | null
          taraweeh_completed: boolean | null
          updated_at: string
          user_id: string
          year: number
        }
        Insert: {
          created_at?: string
          day_number: number
          fasting_completed?: boolean | null
          id?: string
          iftar_time?: string | null
          notes?: string | null
          suhoor_time?: string | null
          taraweeh_completed?: boolean | null
          updated_at?: string
          user_id: string
          year: number
        }
        Update: {
          created_at?: string
          day_number?: number
          fasting_completed?: boolean | null
          id?: string
          iftar_time?: string | null
          notes?: string | null
          suhoor_time?: string | null
          taraweeh_completed?: boolean | null
          updated_at?: string
          user_id?: string
          year?: number
        }
        Relationships: []
      }
      recipe_ingredients: {
        Row: {
          category: string | null
          created_at: string
          id: string
          name: string
          quantity: number | null
          recipe_id: string
          unit: string | null
          user_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          id?: string
          name: string
          quantity?: number | null
          recipe_id: string
          unit?: string | null
          user_id: string
        }
        Update: {
          category?: string | null
          created_at?: string
          id?: string
          name?: string
          quantity?: number | null
          recipe_id?: string
          unit?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipe_ingredients_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      recipes: {
        Row: {
          category: string | null
          cook_time_minutes: number | null
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          instructions: string | null
          name: string
          prep_time_minutes: number | null
          servings: number | null
          tags: string[] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string | null
          cook_time_minutes?: number | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          instructions?: string | null
          name: string
          prep_time_minutes?: number | null
          servings?: number | null
          tags?: string[] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string | null
          cook_time_minutes?: number | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          instructions?: string | null
          name?: string
          prep_time_minutes?: number | null
          servings?: number | null
          tags?: string[] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      reminder_delivery_log: {
        Row: {
          clicked_at: string | null
          created_at: string
          delivered_at: string | null
          delivery_channel: string
          delivery_status: string
          error_message: string | null
          expo_push_receipt: string | null
          expo_push_ticket: string | null
          id: string
          reminder_id: string | null
          sent_at: string | null
          user_id: string
        }
        Insert: {
          clicked_at?: string | null
          created_at?: string
          delivered_at?: string | null
          delivery_channel: string
          delivery_status?: string
          error_message?: string | null
          expo_push_receipt?: string | null
          expo_push_ticket?: string | null
          id?: string
          reminder_id?: string | null
          sent_at?: string | null
          user_id: string
        }
        Update: {
          clicked_at?: string | null
          created_at?: string
          delivered_at?: string | null
          delivery_channel?: string
          delivery_status?: string
          error_message?: string | null
          expo_push_receipt?: string | null
          expo_push_ticket?: string | null
          id?: string
          reminder_id?: string | null
          sent_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reminder_delivery_log_reminder_id_fkey"
            columns: ["reminder_id"]
            isOneToOne: false
            referencedRelation: "proactive_reminders"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_articles: {
        Row: {
          category: string | null
          id: string
          image_url: string | null
          is_bookmarked: boolean | null
          is_read: boolean | null
          read_at: string | null
          saved_at: string
          source: string | null
          summary: string | null
          title: string
          url: string
          user_id: string
        }
        Insert: {
          category?: string | null
          id?: string
          image_url?: string | null
          is_bookmarked?: boolean | null
          is_read?: boolean | null
          read_at?: string | null
          saved_at?: string
          source?: string | null
          summary?: string | null
          title: string
          url: string
          user_id: string
        }
        Update: {
          category?: string | null
          id?: string
          image_url?: string | null
          is_bookmarked?: boolean | null
          is_read?: boolean | null
          read_at?: string | null
          saved_at?: string
          source?: string | null
          summary?: string | null
          title?: string
          url?: string
          user_id?: string
        }
        Relationships: []
      }
      scheduled_calls: {
        Row: {
          call_type: string
          created_at: string
          description: string | null
          duration_minutes: number | null
          id: string
          organizer_id: string
          participant_ids: string[]
          reminder_sent: boolean | null
          scheduled_for: string
          status: string
          title: string | null
        }
        Insert: {
          call_type?: string
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          id?: string
          organizer_id: string
          participant_ids: string[]
          reminder_sent?: boolean | null
          scheduled_for: string
          status?: string
          title?: string | null
        }
        Update: {
          call_type?: string
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          id?: string
          organizer_id?: string
          participant_ids?: string[]
          reminder_sent?: boolean | null
          scheduled_for?: string
          status?: string
          title?: string | null
        }
        Relationships: []
      }
      scheduled_messages: {
        Row: {
          attachments: Json | null
          content: string
          created_at: string
          group_id: string | null
          id: string
          recipient_id: string | null
          scheduled_for: string
          sender_id: string
          sent_at: string | null
          status: string
        }
        Insert: {
          attachments?: Json | null
          content: string
          created_at?: string
          group_id?: string | null
          id?: string
          recipient_id?: string | null
          scheduled_for: string
          sender_id: string
          sent_at?: string | null
          status?: string
        }
        Update: {
          attachments?: Json | null
          content?: string
          created_at?: string
          group_id?: string | null
          id?: string
          recipient_id?: string | null
          scheduled_for?: string
          sender_id?: string
          sent_at?: string | null
          status?: string
        }
        Relationships: []
      }
      search_history: {
        Row: {
          created_at: string
          filters: Json | null
          id: string
          query: string
          user_id: string
        }
        Insert: {
          created_at?: string
          filters?: Json | null
          id?: string
          query: string
          user_id: string
        }
        Update: {
          created_at?: string
          filters?: Json | null
          id?: string
          query?: string
          user_id?: string
        }
        Relationships: []
      }
      shared_items: {
        Row: {
          created_at: string
          id: string
          item_id: string
          item_type: string
          owner_id: string
          permission: string
          shared_with_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: string
          item_type: string
          owner_id: string
          permission?: string
          shared_with_id: string
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          item_type?: string
          owner_id?: string
          permission?: string
          shared_with_id?: string
        }
        Relationships: []
      }
      shared_project_members: {
        Row: {
          created_at: string
          id: string
          owner_id: string
          project_id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          owner_id: string
          project_id: string
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          owner_id?: string
          project_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shared_project_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      shopping_list_items: {
        Row: {
          added_by: string | null
          category: string | null
          created_at: string
          id: string
          is_checked: boolean | null
          list_id: string
          name: string
          notes: string | null
          quantity: number | null
          unit: string | null
          user_id: string
        }
        Insert: {
          added_by?: string | null
          category?: string | null
          created_at?: string
          id?: string
          is_checked?: boolean | null
          list_id: string
          name: string
          notes?: string | null
          quantity?: number | null
          unit?: string | null
          user_id: string
        }
        Update: {
          added_by?: string | null
          category?: string | null
          created_at?: string
          id?: string
          is_checked?: boolean | null
          list_id?: string
          name?: string
          notes?: string | null
          quantity?: number | null
          unit?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shopping_list_items_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "family_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shopping_list_items_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "shopping_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      shopping_lists: {
        Row: {
          assigned_to: string | null
          category: string | null
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          is_completed: boolean | null
          is_template: boolean | null
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assigned_to?: string | null
          category?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          is_completed?: boolean | null
          is_template?: boolean | null
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          assigned_to?: string | null
          category?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          is_completed?: boolean | null
          is_template?: boolean | null
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shopping_lists_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "family_members"
            referencedColumns: ["id"]
          },
        ]
      }
      space_members: {
        Row: {
          created_at: string
          id: string
          member_email: string
          member_id: string
          owner_id: string
          role: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          member_email: string
          member_id: string
          owner_id: string
          role?: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          member_email?: string
          member_id?: string
          owner_id?: string
          role?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      space_share_settings: {
        Row: {
          confirmed_at: string | null
          consent_message: string | null
          created_at: string
          id: string
          share_business_events: boolean
          share_business_tasks: boolean
          share_contacts: boolean
          share_contracts: boolean
          share_family_events: boolean
          share_family_tasks: boolean
          share_personal_events: boolean
          share_personal_tasks: boolean
          share_work_events: boolean
          share_work_tasks: boolean
          sharing_confirmed: boolean | null
          space_member_id: string
          updated_at: string
        }
        Insert: {
          confirmed_at?: string | null
          consent_message?: string | null
          created_at?: string
          id?: string
          share_business_events?: boolean
          share_business_tasks?: boolean
          share_contacts?: boolean
          share_contracts?: boolean
          share_family_events?: boolean
          share_family_tasks?: boolean
          share_personal_events?: boolean
          share_personal_tasks?: boolean
          share_work_events?: boolean
          share_work_tasks?: boolean
          sharing_confirmed?: boolean | null
          space_member_id: string
          updated_at?: string
        }
        Update: {
          confirmed_at?: string | null
          consent_message?: string | null
          created_at?: string
          id?: string
          share_business_events?: boolean
          share_business_tasks?: boolean
          share_contacts?: boolean
          share_contracts?: boolean
          share_family_events?: boolean
          share_family_tasks?: boolean
          share_personal_events?: boolean
          share_personal_tasks?: boolean
          share_work_events?: boolean
          share_work_tasks?: boolean
          sharing_confirmed?: boolean | null
          space_member_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "space_share_settings_space_member_id_fkey"
            columns: ["space_member_id"]
            isOneToOne: true
            referencedRelation: "space_members"
            referencedColumns: ["id"]
          },
        ]
      }
      starred_messages: {
        Row: {
          created_at: string
          id: string
          message_id: string
          message_type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message_id: string
          message_type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message_id?: string
          message_type?: string
          user_id?: string
        }
        Relationships: []
      }
      startup_ideas: {
        Row: {
          ai_insights: Json | null
          business_model: string | null
          competitive_advantage: string | null
          created_at: string
          description: string | null
          id: string
          key_features: Json | null
          name: string
          notes: string | null
          problem_statement: string | null
          status: string | null
          tags: string[] | null
          target_audience: string | null
          unique_value_proposition: string | null
          updated_at: string
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          ai_insights?: Json | null
          business_model?: string | null
          competitive_advantage?: string | null
          created_at?: string
          description?: string | null
          id?: string
          key_features?: Json | null
          name: string
          notes?: string | null
          problem_statement?: string | null
          status?: string | null
          tags?: string[] | null
          target_audience?: string | null
          unique_value_proposition?: string | null
          updated_at?: string
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          ai_insights?: Json | null
          business_model?: string | null
          competitive_advantage?: string | null
          created_at?: string
          description?: string | null
          id?: string
          key_features?: Json | null
          name?: string
          notes?: string | null
          problem_statement?: string | null
          status?: string | null
          tags?: string[] | null
          target_audience?: string | null
          unique_value_proposition?: string | null
          updated_at?: string
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "startup_ideas_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "startup_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      startup_metrics: {
        Row: {
          created_at: string
          id: string
          metric_date: string
          metric_name: string
          metric_value: number | null
          notes: string | null
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          metric_date?: string
          metric_name: string
          metric_value?: number | null
          notes?: string | null
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          metric_date?: string
          metric_name?: string
          metric_value?: number | null
          notes?: string | null
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "startup_metrics_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "startup_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      startup_workspaces: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          icon: string | null
          id: string
          is_active: boolean | null
          name: string
          updated_at: string
          user_id: string
          workspace_type: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          updated_at?: string
          user_id: string
          workspace_type: string
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string
          user_id?: string
          workspace_type?: string
        }
        Relationships: []
      }
      tags: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
          user_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          name: string
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      task_tags: {
        Row: {
          created_at: string
          id: string
          tag_id: string
          task_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          tag_id: string
          task_id: string
        }
        Update: {
          created_at?: string
          id?: string
          tag_id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_tags_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_templates: {
        Row: {
          category: string
          created_at: string
          description: string | null
          id: string
          name: string
          priority: string
          recurrence_rule: string | null
          reminder_before: number | null
          title: string
          user_id: string
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          priority?: string
          recurrence_rule?: string | null
          reminder_before?: number | null
          title: string
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          priority?: string
          recurrence_rule?: string | null
          reminder_before?: number | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          attachments: Json | null
          category: string
          checklist: Json | null
          comments: Json | null
          completed: boolean
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          last_reminded_at: string | null
          main_responsible_id: string | null
          parent_id: string | null
          priority: string
          project_id: string | null
          recurrence_end: string | null
          recurrence_rule: string | null
          reminder_before: number | null
          secondary_responsible_id: string | null
          sort_order: number | null
          status: string
          title: string
          trashed: boolean
          trashed_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          attachments?: Json | null
          category?: string
          checklist?: Json | null
          comments?: Json | null
          completed?: boolean
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          last_reminded_at?: string | null
          main_responsible_id?: string | null
          parent_id?: string | null
          priority?: string
          project_id?: string | null
          recurrence_end?: string | null
          recurrence_rule?: string | null
          reminder_before?: number | null
          secondary_responsible_id?: string | null
          sort_order?: number | null
          status?: string
          title: string
          trashed?: boolean
          trashed_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          attachments?: Json | null
          category?: string
          checklist?: Json | null
          comments?: Json | null
          completed?: boolean
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          last_reminded_at?: string | null
          main_responsible_id?: string | null
          parent_id?: string | null
          priority?: string
          project_id?: string | null
          recurrence_end?: string | null
          recurrence_rule?: string | null
          reminder_before?: number | null
          secondary_responsible_id?: string | null
          sort_order?: number | null
          status?: string
          title?: string
          trashed?: boolean
          trashed_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_main_responsible_id_fkey"
            columns: ["main_responsible_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_secondary_responsible_id_fkey"
            columns: ["secondary_responsible_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_chat_settings: {
        Row: {
          created_at: string
          disappearing_messages_default: number | null
          dnd_days: number[] | null
          dnd_enabled: boolean | null
          dnd_end: string | null
          dnd_start: string | null
          id: string
          priority_contacts: string[] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          disappearing_messages_default?: number | null
          dnd_days?: number[] | null
          dnd_enabled?: boolean | null
          dnd_end?: string | null
          dnd_start?: string | null
          id?: string
          priority_contacts?: string[] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          disappearing_messages_default?: number | null
          dnd_days?: number[] | null
          dnd_enabled?: boolean | null
          dnd_end?: string | null
          dnd_start?: string | null
          id?: string
          priority_contacts?: string[] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_contacts: {
        Row: {
          avatar_url: string | null
          birth_date: string | null
          birthday_reminder: boolean | null
          business_level: string | null
          city: string | null
          company: string | null
          contact_frequency_days: number | null
          contact_type: string
          contact_user_id: string | null
          country: string | null
          created_at: string
          email: string | null
          family_relationship: string | null
          id: string
          interaction_count: number | null
          is_favorite: boolean | null
          last_contacted_at: string | null
          last_reminded_at: string | null
          linkedin_url: string | null
          name: string
          next_contact_due: string | null
          notes: string | null
          personal_tier: string | null
          phone: string | null
          role: string | null
          tags: string[] | null
          twitter_url: string | null
          updated_at: string
          user_id: string
          website_url: string | null
        }
        Insert: {
          avatar_url?: string | null
          birth_date?: string | null
          birthday_reminder?: boolean | null
          business_level?: string | null
          city?: string | null
          company?: string | null
          contact_frequency_days?: number | null
          contact_type?: string
          contact_user_id?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          family_relationship?: string | null
          id?: string
          interaction_count?: number | null
          is_favorite?: boolean | null
          last_contacted_at?: string | null
          last_reminded_at?: string | null
          linkedin_url?: string | null
          name: string
          next_contact_due?: string | null
          notes?: string | null
          personal_tier?: string | null
          phone?: string | null
          role?: string | null
          tags?: string[] | null
          twitter_url?: string | null
          updated_at?: string
          user_id: string
          website_url?: string | null
        }
        Update: {
          avatar_url?: string | null
          birth_date?: string | null
          birthday_reminder?: boolean | null
          business_level?: string | null
          city?: string | null
          company?: string | null
          contact_frequency_days?: number | null
          contact_type?: string
          contact_user_id?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          family_relationship?: string | null
          id?: string
          interaction_count?: number | null
          is_favorite?: boolean | null
          last_contacted_at?: string | null
          last_reminded_at?: string | null
          linkedin_url?: string | null
          name?: string
          next_contact_due?: string | null
          notes?: string | null
          personal_tier?: string | null
          phone?: string | null
          role?: string | null
          tags?: string[] | null
          twitter_url?: string | null
          updated_at?: string
          user_id?: string
          website_url?: string | null
        }
        Relationships: []
      }
      user_notifications: {
        Row: {
          action_url: string | null
          created_at: string
          data: Json | null
          id: string
          message: string
          read: boolean
          title: string
          type: string
          user_id: string
        }
        Insert: {
          action_url?: string | null
          created_at?: string
          data?: Json | null
          id?: string
          message: string
          read?: boolean
          title: string
          type?: string
          user_id: string
        }
        Update: {
          action_url?: string | null
          created_at?: string
          data?: Json | null
          id?: string
          message?: string
          read?: boolean
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      user_patterns: {
        Row: {
          category: string
          confidence_score: number
          correlation_strength: number | null
          created_at: string
          data_points: Json | null
          description: string
          first_detected_at: string
          id: string
          is_active: boolean | null
          last_detected_at: string
          pattern_type: string
          times_detected: number | null
          title: string
          updated_at: string
          user_id: string
          variables: string[] | null
        }
        Insert: {
          category?: string
          confidence_score?: number
          correlation_strength?: number | null
          created_at?: string
          data_points?: Json | null
          description: string
          first_detected_at?: string
          id?: string
          is_active?: boolean | null
          last_detected_at?: string
          pattern_type?: string
          times_detected?: number | null
          title: string
          updated_at?: string
          user_id: string
          variables?: string[] | null
        }
        Update: {
          category?: string
          confidence_score?: number
          correlation_strength?: number | null
          created_at?: string
          data_points?: Json | null
          description?: string
          first_detected_at?: string
          id?: string
          is_active?: boolean | null
          last_detected_at?: string
          pattern_type?: string
          times_detected?: number | null
          title?: string
          updated_at?: string
          user_id?: string
          variables?: string[] | null
        }
        Relationships: []
      }
      user_xp: {
        Row: {
          badges: Json
          created_at: string
          current_level: number
          current_streak: number
          id: string
          last_activity_date: string | null
          longest_streak: number
          total_xp: number
          updated_at: string
          user_id: string
          week_start_date: string | null
          weekly_focus_minutes: number
          weekly_habits_logged: number
          weekly_tasks_completed: number
          weekly_xp: number
        }
        Insert: {
          badges?: Json
          created_at?: string
          current_level?: number
          current_streak?: number
          id?: string
          last_activity_date?: string | null
          longest_streak?: number
          total_xp?: number
          updated_at?: string
          user_id: string
          week_start_date?: string | null
          weekly_focus_minutes?: number
          weekly_habits_logged?: number
          weekly_tasks_completed?: number
          weekly_xp?: number
        }
        Update: {
          badges?: Json
          created_at?: string
          current_level?: number
          current_streak?: number
          id?: string
          last_activity_date?: string | null
          longest_streak?: number
          total_xp?: number
          updated_at?: string
          user_id?: string
          week_start_date?: string | null
          weekly_focus_minutes?: number
          weekly_habits_logged?: number
          weekly_tasks_completed?: number
          weekly_xp?: number
        }
        Relationships: []
      }
      voicemails: {
        Row: {
          audio_url: string
          caller_id: string
          created_at: string
          duration_seconds: number
          id: string
          is_read: boolean | null
          read_at: string | null
          recipient_id: string
          transcription: string | null
        }
        Insert: {
          audio_url: string
          caller_id: string
          created_at?: string
          duration_seconds?: number
          id?: string
          is_read?: boolean | null
          read_at?: string | null
          recipient_id: string
          transcription?: string | null
        }
        Update: {
          audio_url?: string
          caller_id?: string
          created_at?: string
          duration_seconds?: number
          id?: string
          is_read?: boolean | null
          read_at?: string | null
          recipient_id?: string
          transcription?: string | null
        }
        Relationships: []
      }
      weekly_coach_reports: {
        Row: {
          average_energy: number | null
          average_mood: number | null
          average_sleep: number | null
          balance_score: number | null
          correlations_found: Json | null
          created_at: string
          focus_minutes: number | null
          goal_progress: Json | null
          habits_completed: number | null
          habits_missed: number | null
          id: string
          improvements: Json | null
          is_read: boolean | null
          productivity_score: number | null
          recommendations: Json | null
          summary_text: string | null
          tasks_completed: number | null
          tasks_created: number | null
          user_id: string
          week_end: string
          week_start: string
          wellbeing_score: number | null
          wins: Json | null
        }
        Insert: {
          average_energy?: number | null
          average_mood?: number | null
          average_sleep?: number | null
          balance_score?: number | null
          correlations_found?: Json | null
          created_at?: string
          focus_minutes?: number | null
          goal_progress?: Json | null
          habits_completed?: number | null
          habits_missed?: number | null
          id?: string
          improvements?: Json | null
          is_read?: boolean | null
          productivity_score?: number | null
          recommendations?: Json | null
          summary_text?: string | null
          tasks_completed?: number | null
          tasks_created?: number | null
          user_id: string
          week_end: string
          week_start: string
          wellbeing_score?: number | null
          wins?: Json | null
        }
        Update: {
          average_energy?: number | null
          average_mood?: number | null
          average_sleep?: number | null
          balance_score?: number | null
          correlations_found?: Json | null
          created_at?: string
          focus_minutes?: number | null
          goal_progress?: Json | null
          habits_completed?: number | null
          habits_missed?: number | null
          id?: string
          improvements?: Json | null
          is_read?: boolean | null
          productivity_score?: number | null
          recommendations?: Json | null
          summary_text?: string | null
          tasks_completed?: number | null
          tasks_created?: number | null
          user_id?: string
          week_end?: string
          week_start?: string
          wellbeing_score?: number | null
          wins?: Json | null
        }
        Relationships: []
      }
      weekly_reviews: {
        Row: {
          celebrations: string | null
          completed_tasks_count: number | null
          created_at: string
          id: string
          incomplete_tasks_reviewed: string[] | null
          intentions: string | null
          updated_at: string
          user_id: string
          week_start: string
        }
        Insert: {
          celebrations?: string | null
          completed_tasks_count?: number | null
          created_at?: string
          id?: string
          incomplete_tasks_reviewed?: string[] | null
          intentions?: string | null
          updated_at?: string
          user_id: string
          week_start: string
        }
        Update: {
          celebrations?: string | null
          completed_tasks_count?: number | null
          created_at?: string
          id?: string
          incomplete_tasks_reviewed?: string[] | null
          intentions?: string | null
          updated_at?: string
          user_id?: string
          week_start?: string
        }
        Relationships: []
      }
      weekly_summaries: {
        Row: {
          ai_summary: string | null
          avg_energy: number | null
          avg_focus_quality: number | null
          avg_mood: number | null
          avg_sleep_hours: number | null
          avg_sleep_quality: number | null
          avg_stress_level: number | null
          created_at: string
          exercise_minutes: number | null
          focus_minutes: number | null
          habits_completed: number | null
          habits_possible: number | null
          id: string
          patterns_detected: Json | null
          tasks_completed: number | null
          tasks_created: number | null
          updated_at: string
          user_id: string
          week_end: string
          week_start: string
        }
        Insert: {
          ai_summary?: string | null
          avg_energy?: number | null
          avg_focus_quality?: number | null
          avg_mood?: number | null
          avg_sleep_hours?: number | null
          avg_sleep_quality?: number | null
          avg_stress_level?: number | null
          created_at?: string
          exercise_minutes?: number | null
          focus_minutes?: number | null
          habits_completed?: number | null
          habits_possible?: number | null
          id?: string
          patterns_detected?: Json | null
          tasks_completed?: number | null
          tasks_created?: number | null
          updated_at?: string
          user_id: string
          week_end: string
          week_start: string
        }
        Update: {
          ai_summary?: string | null
          avg_energy?: number | null
          avg_focus_quality?: number | null
          avg_mood?: number | null
          avg_sleep_hours?: number | null
          avg_sleep_quality?: number | null
          avg_stress_level?: number | null
          created_at?: string
          exercise_minutes?: number | null
          focus_minutes?: number | null
          habits_completed?: number | null
          habits_possible?: number | null
          id?: string
          patterns_detected?: Json | null
          tasks_completed?: number | null
          tasks_created?: number | null
          updated_at?: string
          user_id?: string
          week_end?: string
          week_start?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_view_shared_contacts: {
        Args: { owner_user_id: string }
        Returns: boolean
      }
      can_view_shared_contracts: {
        Args: { owner_user_id: string }
        Returns: boolean
      }
      can_view_shared_event: {
        Args: { event_row: Database["public"]["Tables"]["events"]["Row"] }
        Returns: boolean
      }
      can_view_shared_task: {
        Args: { task_row: Database["public"]["Tables"]["tasks"]["Row"] }
        Returns: boolean
      }
      is_admin: { Args: { check_user_id: string }; Returns: boolean }
      is_group_admin: {
        Args: { _group_id: string; _user_id: string }
        Returns: boolean
      }
      is_group_creator: {
        Args: { _group_id: string; _user_id: string }
        Returns: boolean
      }
      is_group_member: {
        Args: { _group_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
