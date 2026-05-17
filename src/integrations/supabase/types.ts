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
      automation_rules: {
        Row: {
          action_config: Json | null
          action_type: string
          condition_config: Json | null
          condition_type: string | null
          created_at: string
          description: string | null
          execution_count: number | null
          id: string
          is_active: boolean | null
          last_executed_at: string | null
          name: string
          trigger_config: Json | null
          trigger_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          action_config?: Json | null
          action_type: string
          condition_config?: Json | null
          condition_type?: string | null
          created_at?: string
          description?: string | null
          execution_count?: number | null
          id?: string
          is_active?: boolean | null
          last_executed_at?: string | null
          name: string
          trigger_config?: Json | null
          trigger_type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          action_config?: Json | null
          action_type?: string
          condition_config?: Json | null
          condition_type?: string | null
          created_at?: string
          description?: string | null
          execution_count?: number | null
          id?: string
          is_active?: boolean | null
          last_executed_at?: string | null
          name?: string
          trigger_config?: Json | null
          trigger_type?: string
          updated_at?: string
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
      books: {
        Row: {
          author: string | null
          cover_url: string | null
          created_at: string
          finished_on: string | null
          id: string
          notes: string | null
          rating: number | null
          started_on: string | null
          status: string | null
          tags: string[] | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          author?: string | null
          cover_url?: string | null
          created_at?: string
          finished_on?: string | null
          id?: string
          notes?: string | null
          rating?: number | null
          started_on?: string | null
          status?: string | null
          tags?: string[] | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          author?: string | null
          cover_url?: string | null
          created_at?: string
          finished_on?: string | null
          id?: string
          notes?: string | null
          rating?: number | null
          started_on?: string | null
          status?: string | null
          tags?: string[] | null
          title?: string
          updated_at?: string
          user_id?: string
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
      bucket_list: {
        Row: {
          achieved_on: string | null
          category: string | null
          created_at: string
          description: string | null
          id: string
          notes: string | null
          status: string | null
          target_year: number | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          achieved_on?: string | null
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          notes?: string | null
          status?: string | null
          target_year?: number | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          achieved_on?: string | null
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          notes?: string | null
          status?: string | null
          target_year?: number | null
          title?: string
          updated_at?: string
          user_id?: string
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
      challenges: {
        Row: {
          badge_name: string | null
          challenge_type: string
          created_at: string
          description: string | null
          end_date: string | null
          id: string
          is_global: boolean | null
          start_date: string | null
          target_metric: string
          target_value: number
          title: string
          xp_reward: number | null
        }
        Insert: {
          badge_name?: string | null
          challenge_type?: string
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          is_global?: boolean | null
          start_date?: string | null
          target_metric: string
          target_value?: number
          title: string
          xp_reward?: number | null
        }
        Update: {
          badge_name?: string | null
          challenge_type?: string
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          is_global?: boolean | null
          start_date?: string | null
          target_metric?: string
          target_value?: number
          title?: string
          xp_reward?: number | null
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
      contact_special_dates: {
        Row: {
          contact_id: string | null
          created_at: string
          date_type: string
          id: string
          notes: string | null
          occurs_on: string
          reminder_days_before: number | null
          user_id: string
        }
        Insert: {
          contact_id?: string | null
          created_at?: string
          date_type?: string
          id?: string
          notes?: string | null
          occurs_on: string
          reminder_days_before?: number | null
          user_id: string
        }
        Update: {
          contact_id?: string | null
          created_at?: string
          date_type?: string
          id?: string
          notes?: string | null
          occurs_on?: string
          reminder_days_before?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_special_dates_contact_id_fkey"
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
      country_essentials: {
        Row: {
          country: string
          created_at: string
          currency: string | null
          embassy_address: string | null
          embassy_phone: string | null
          emergency_number: string | null
          id: string
          language: string | null
          notes: string | null
          plug_type: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          country: string
          created_at?: string
          currency?: string | null
          embassy_address?: string | null
          embassy_phone?: string | null
          emergency_number?: string | null
          id?: string
          language?: string | null
          notes?: string | null
          plug_type?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          country?: string
          created_at?: string
          currency?: string | null
          embassy_address?: string | null
          embassy_phone?: string | null
          emergency_number?: string | null
          id?: string
          language?: string | null
          notes?: string | null
          plug_type?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      courses: {
        Row: {
          certificate_url: string | null
          completed_on: string | null
          created_at: string
          id: string
          notes: string | null
          progress_percent: number | null
          provider: string | null
          started_on: string | null
          status: string | null
          title: string
          updated_at: string
          url: string | null
          user_id: string
        }
        Insert: {
          certificate_url?: string | null
          completed_on?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          progress_percent?: number | null
          provider?: string | null
          started_on?: string | null
          status?: string | null
          title: string
          updated_at?: string
          url?: string | null
          user_id: string
        }
        Update: {
          certificate_url?: string | null
          completed_on?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          progress_percent?: number | null
          provider?: string | null
          started_on?: string | null
          status?: string | null
          title?: string
          updated_at?: string
          url?: string | null
          user_id?: string
        }
        Relationships: []
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
      detected_conflicts: {
        Row: {
          conflict_type: string
          description: string | null
          detected_at: string
          entities: Json
          fingerprint: string
          id: string
          resolved_at: string | null
          severity: string
          status: string
          suggested_resolution: string | null
          title: string
          user_id: string
        }
        Insert: {
          conflict_type: string
          description?: string | null
          detected_at?: string
          entities?: Json
          fingerprint: string
          id?: string
          resolved_at?: string | null
          severity?: string
          status?: string
          suggested_resolution?: string | null
          title: string
          user_id: string
        }
        Update: {
          conflict_type?: string
          description?: string | null
          detected_at?: string
          entities?: Json
          fingerprint?: string
          id?: string
          resolved_at?: string | null
          severity?: string
          status?: string
          suggested_resolution?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      detected_trips: {
        Row: {
          contacts_in_destination: Json | null
          created_at: string
          destination: string
          destination_country: string | null
          end_date: string
          fingerprint: string
          id: string
          notes: string | null
          packing_reminder_sent: boolean | null
          source: string
          source_ref: string | null
          start_date: string
          status: string
          travel_blocks_added: boolean | null
          user_id: string
        }
        Insert: {
          contacts_in_destination?: Json | null
          created_at?: string
          destination: string
          destination_country?: string | null
          end_date: string
          fingerprint: string
          id?: string
          notes?: string | null
          packing_reminder_sent?: boolean | null
          source?: string
          source_ref?: string | null
          start_date: string
          status?: string
          travel_blocks_added?: boolean | null
          user_id: string
        }
        Update: {
          contacts_in_destination?: Json | null
          created_at?: string
          destination?: string
          destination_country?: string | null
          end_date?: string
          fingerprint?: string
          id?: string
          notes?: string | null
          packing_reminder_sent?: boolean | null
          source?: string
          source_ref?: string | null
          start_date?: string
          status?: string
          travel_blocks_added?: boolean | null
          user_id?: string
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
      dori_conversations: {
        Row: {
          channel: string
          channel_ref: string | null
          content: string
          created_at: string
          id: string
          metadata: Json | null
          role: string
          user_id: string
        }
        Insert: {
          channel: string
          channel_ref?: string | null
          content: string
          created_at?: string
          id?: string
          metadata?: Json | null
          role: string
          user_id: string
        }
        Update: {
          channel?: string
          channel_ref?: string | null
          content?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      dori_learned_preferences: {
        Row: {
          confidence: number
          created_at: string
          id: string
          key: string
          last_seen_at: string
          source: string | null
          times_seen: number
          updated_at: string
          user_id: string
          value: string
        }
        Insert: {
          confidence?: number
          created_at?: string
          id?: string
          key: string
          last_seen_at?: string
          source?: string | null
          times_seen?: number
          updated_at?: string
          user_id: string
          value: string
        }
        Update: {
          confidence?: number
          created_at?: string
          id?: string
          key?: string
          last_seen_at?: string
          source?: string | null
          times_seen?: number
          updated_at?: string
          user_id?: string
          value?: string
        }
        Relationships: []
      }
      dori_proactive_log: {
        Row: {
          channel: string
          channel_ref: string | null
          id: string
          message: string | null
          sent_at: string
          trigger_key: string
          trigger_type: string
          user_id: string
        }
        Insert: {
          channel?: string
          channel_ref?: string | null
          id?: string
          message?: string | null
          sent_at?: string
          trigger_key: string
          trigger_type: string
          user_id: string
        }
        Update: {
          channel?: string
          channel_ref?: string | null
          id?: string
          message?: string | null
          sent_at?: string
          trigger_key?: string
          trigger_type?: string
          user_id?: string
        }
        Relationships: []
      }
      dori_undo_log: {
        Row: {
          action: string
          created_at: string
          id: string
          payload: Json
          undone: boolean
          undone_at: string | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          payload?: Json
          undone?: boolean
          undone_at?: string | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          payload?: Json
          undone?: boolean
          undone_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      email_classifications: {
        Row: {
          applied_at: string | null
          category: string
          confidence: number | null
          created_at: string
          dismissed_at: string | null
          email_id: string
          id: string
          reasoning: string | null
          status: string
          suggested_action: string | null
          suggested_payload: Json | null
          user_id: string
        }
        Insert: {
          applied_at?: string | null
          category: string
          confidence?: number | null
          created_at?: string
          dismissed_at?: string | null
          email_id: string
          id?: string
          reasoning?: string | null
          status?: string
          suggested_action?: string | null
          suggested_payload?: Json | null
          user_id: string
        }
        Update: {
          applied_at?: string | null
          category?: string
          confidence?: number | null
          created_at?: string
          dismissed_at?: string | null
          email_id?: string
          id?: string
          reasoning?: string | null
          status?: string
          suggested_action?: string | null
          suggested_payload?: Json | null
          user_id?: string
        }
        Relationships: []
      }
      email_sender_rules: {
        Row: {
          auto_archive: boolean | null
          created_at: string
          default_category: string | null
          default_priority: number | null
          id: string
          learned_from_count: number | null
          sender_pattern: string
          updated_at: string
          user_id: string
        }
        Insert: {
          auto_archive?: boolean | null
          created_at?: string
          default_category?: string | null
          default_priority?: number | null
          id?: string
          learned_from_count?: number | null
          sender_pattern: string
          updated_at?: string
          user_id: string
        }
        Update: {
          auto_archive?: boolean | null
          created_at?: string
          default_category?: string | null
          default_priority?: number | null
          id?: string
          learned_from_count?: number | null
          sender_pattern?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      email_snoozed: {
        Row: {
          created_at: string
          external_id: string
          id: string
          provider: string
          resurfaced: boolean
          snooze_until: string
          subject: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          external_id: string
          id?: string
          provider?: string
          resurfaced?: boolean
          snooze_until: string
          subject?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          external_id?: string
          id?: string
          provider?: string
          resurfaced?: boolean
          snooze_until?: string
          subject?: string | null
          user_id?: string
        }
        Relationships: []
      }
      episodic_memories: {
        Row: {
          created_at: string
          embedding_vector: Json | null
          id: string
          importance: number | null
          location: string | null
          location_country: string | null
          occurred_end: string | null
          occurred_on: string
          people: Json | null
          source: string | null
          source_ref: string | null
          summary: string | null
          tags: string[] | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          embedding_vector?: Json | null
          id?: string
          importance?: number | null
          location?: string | null
          location_country?: string | null
          occurred_end?: string | null
          occurred_on: string
          people?: Json | null
          source?: string | null
          source_ref?: string | null
          summary?: string | null
          tags?: string[] | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          embedding_vector?: Json | null
          id?: string
          importance?: number | null
          location?: string | null
          location_country?: string | null
          occurred_end?: string | null
          occurred_on?: string
          people?: Json | null
          source?: string | null
          source_ref?: string | null
          summary?: string | null
          tags?: string[] | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      events: {
        Row: {
          attendees: string[] | null
          category: string | null
          connection_id: string | null
          created_at: string
          created_by_telegram_user_id: number | null
          created_via: string | null
          description: string | null
          end_time: string
          external_etag: string | null
          external_id: string | null
          external_source: string | null
          id: string
          last_pushed_at: string | null
          last_reminded_at: string | null
          location: string | null
          recurrence_end: string | null
          recurrence_rule: string | null
          start_time: string
          sync_status: string
          title: string
          updated_at: string
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          attendees?: string[] | null
          category?: string | null
          connection_id?: string | null
          created_at?: string
          created_by_telegram_user_id?: number | null
          created_via?: string | null
          description?: string | null
          end_time: string
          external_etag?: string | null
          external_id?: string | null
          external_source?: string | null
          id?: string
          last_pushed_at?: string | null
          last_reminded_at?: string | null
          location?: string | null
          recurrence_end?: string | null
          recurrence_rule?: string | null
          start_time: string
          sync_status?: string
          title: string
          updated_at?: string
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          attendees?: string[] | null
          category?: string | null
          connection_id?: string | null
          created_at?: string
          created_by_telegram_user_id?: number | null
          created_via?: string | null
          description?: string | null
          end_time?: string
          external_etag?: string | null
          external_id?: string | null
          external_source?: string | null
          id?: string
          last_pushed_at?: string | null
          last_reminded_at?: string | null
          location?: string | null
          recurrence_end?: string | null
          recurrence_rule?: string | null
          start_time?: string
          sync_status?: string
          title?: string
          updated_at?: string
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "external_calendar_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      external_calendar_connections: {
        Row: {
          access_token: string | null
          auth_type: string
          caldav_password_encrypted: string | null
          caldav_url: string | null
          caldav_username: string | null
          calendar_id: string | null
          color: string | null
          created_at: string
          external_calendar_id: string | null
          family_member_id: string | null
          gmail_history_id: string | null
          id: string
          last_sync_error: string | null
          last_synced_at: string | null
          name: string
          provider: string
          refresh_token: string | null
          sync_direction: string
          sync_enabled: boolean | null
          sync_token: string | null
          token_expires_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token?: string | null
          auth_type?: string
          caldav_password_encrypted?: string | null
          caldav_url?: string | null
          caldav_username?: string | null
          calendar_id?: string | null
          color?: string | null
          created_at?: string
          external_calendar_id?: string | null
          family_member_id?: string | null
          gmail_history_id?: string | null
          id?: string
          last_sync_error?: string | null
          last_synced_at?: string | null
          name: string
          provider?: string
          refresh_token?: string | null
          sync_direction?: string
          sync_enabled?: boolean | null
          sync_token?: string | null
          token_expires_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string | null
          auth_type?: string
          caldav_password_encrypted?: string | null
          caldav_url?: string | null
          caldav_username?: string | null
          calendar_id?: string | null
          color?: string | null
          created_at?: string
          external_calendar_id?: string | null
          family_member_id?: string | null
          gmail_history_id?: string | null
          id?: string
          last_sync_error?: string | null
          last_synced_at?: string | null
          name?: string
          provider?: string
          refresh_token?: string | null
          sync_direction?: string
          sync_enabled?: boolean | null
          sync_token?: string | null
          token_expires_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "external_calendar_connections_family_member_id_fkey"
            columns: ["family_member_id"]
            isOneToOne: false
            referencedRelation: "family_members"
            referencedColumns: ["id"]
          },
        ]
      }
      family_agent_groups: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_id: string
          shared_calendar_enabled: boolean | null
          shared_shopping_enabled: boolean | null
          shared_tasks_enabled: boolean | null
          telegram_chat_id: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_id: string
          shared_calendar_enabled?: boolean | null
          shared_shopping_enabled?: boolean | null
          shared_tasks_enabled?: boolean | null
          telegram_chat_id?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          shared_calendar_enabled?: boolean | null
          shared_shopping_enabled?: boolean | null
          shared_tasks_enabled?: boolean | null
          telegram_chat_id?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      family_agent_members: {
        Row: {
          accepted_at: string | null
          group_id: string
          id: string
          invited_at: string
          role: string
          status: string
          user_id: string
        }
        Insert: {
          accepted_at?: string | null
          group_id: string
          id?: string
          invited_at?: string
          role?: string
          status?: string
          user_id: string
        }
        Update: {
          accepted_at?: string | null
          group_id?: string
          id?: string
          invited_at?: string
          role?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_agent_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "family_agent_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      family_allowance: {
        Row: {
          amount: number
          created_at: string
          entry_date: string
          entry_type: string
          family_member_id: string
          id: string
          reason: string | null
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          entry_date?: string
          entry_type?: string
          family_member_id: string
          id?: string
          reason?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          entry_date?: string
          entry_type?: string
          family_member_id?: string
          id?: string
          reason?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_allowance_family_member_id_fkey"
            columns: ["family_member_id"]
            isOneToOne: false
            referencedRelation: "family_members"
            referencedColumns: ["id"]
          },
        ]
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
      family_chore_completions: {
        Row: {
          chore_id: string
          completed_at: string
          created_at: string
          family_member_id: string | null
          id: string
          notes: string | null
          points_awarded: number | null
          user_id: string
        }
        Insert: {
          chore_id: string
          completed_at?: string
          created_at?: string
          family_member_id?: string | null
          id?: string
          notes?: string | null
          points_awarded?: number | null
          user_id: string
        }
        Update: {
          chore_id?: string
          completed_at?: string
          created_at?: string
          family_member_id?: string | null
          id?: string
          notes?: string | null
          points_awarded?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_chore_completions_chore_id_fkey"
            columns: ["chore_id"]
            isOneToOne: false
            referencedRelation: "family_chores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "family_chore_completions_family_member_id_fkey"
            columns: ["family_member_id"]
            isOneToOne: false
            referencedRelation: "family_members"
            referencedColumns: ["id"]
          },
        ]
      }
      family_chores: {
        Row: {
          created_at: string
          day_of_week: number | null
          description: string | null
          family_member_id: string | null
          frequency: string | null
          id: string
          is_active: boolean | null
          last_completed_at: string | null
          next_due_date: string | null
          points: number | null
          rotation_members: string[] | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          day_of_week?: number | null
          description?: string | null
          family_member_id?: string | null
          frequency?: string | null
          id?: string
          is_active?: boolean | null
          last_completed_at?: string | null
          next_due_date?: string | null
          points?: number | null
          rotation_members?: string[] | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          day_of_week?: number | null
          description?: string | null
          family_member_id?: string | null
          frequency?: string | null
          id?: string
          is_active?: boolean | null
          last_completed_at?: string | null
          next_due_date?: string | null
          points?: number | null
          rotation_members?: string[] | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_chores_family_member_id_fkey"
            columns: ["family_member_id"]
            isOneToOne: false
            referencedRelation: "family_members"
            referencedColumns: ["id"]
          },
        ]
      }
      family_classmates: {
        Row: {
          birthday: string | null
          child_name: string
          created_at: string
          family_member_id: string
          id: string
          last_playdate: string | null
          notes: string | null
          parent_email: string | null
          parent_name: string | null
          parent_phone: string | null
          relationship_type: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          birthday?: string | null
          child_name: string
          created_at?: string
          family_member_id: string
          id?: string
          last_playdate?: string | null
          notes?: string | null
          parent_email?: string | null
          parent_name?: string | null
          parent_phone?: string | null
          relationship_type?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          birthday?: string | null
          child_name?: string
          created_at?: string
          family_member_id?: string
          id?: string
          last_playdate?: string | null
          notes?: string | null
          parent_email?: string | null
          parent_name?: string | null
          parent_phone?: string | null
          relationship_type?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_classmates_family_member_id_fkey"
            columns: ["family_member_id"]
            isOneToOne: false
            referencedRelation: "family_members"
            referencedColumns: ["id"]
          },
        ]
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
      family_emergency_contacts: {
        Row: {
          alt_phone: string | null
          created_at: string
          email: string | null
          family_member_id: string | null
          id: string
          name: string
          notes: string | null
          phone: string
          priority: number
          relationship: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          alt_phone?: string | null
          created_at?: string
          email?: string | null
          family_member_id?: string | null
          id?: string
          name: string
          notes?: string | null
          phone: string
          priority?: number
          relationship?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          alt_phone?: string | null
          created_at?: string
          email?: string | null
          family_member_id?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string
          priority?: number
          relationship?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_emergency_contacts_family_member_id_fkey"
            columns: ["family_member_id"]
            isOneToOne: false
            referencedRelation: "family_members"
            referencedColumns: ["id"]
          },
        ]
      }
      family_equipment: {
        Row: {
          brand: string | null
          category: string | null
          condition: string | null
          created_at: string
          family_member_id: string | null
          id: string
          item_name: string
          needs_replacement: boolean | null
          notes: string | null
          purchase_date: string | null
          replacement_reason: string | null
          size: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          brand?: string | null
          category?: string | null
          condition?: string | null
          created_at?: string
          family_member_id?: string | null
          id?: string
          item_name: string
          needs_replacement?: boolean | null
          notes?: string | null
          purchase_date?: string | null
          replacement_reason?: string | null
          size?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          brand?: string | null
          category?: string | null
          condition?: string | null
          created_at?: string
          family_member_id?: string | null
          id?: string
          item_name?: string
          needs_replacement?: boolean | null
          notes?: string | null
          purchase_date?: string | null
          replacement_reason?: string | null
          size?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_equipment_family_member_id_fkey"
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
      family_growth_log: {
        Row: {
          created_at: string
          family_member_id: string
          head_circumference_cm: number | null
          height_cm: number | null
          id: string
          measured_on: string
          notes: string | null
          user_id: string
          weight_kg: number | null
        }
        Insert: {
          created_at?: string
          family_member_id: string
          head_circumference_cm?: number | null
          height_cm?: number | null
          id?: string
          measured_on?: string
          notes?: string | null
          user_id: string
          weight_kg?: number | null
        }
        Update: {
          created_at?: string
          family_member_id?: string
          head_circumference_cm?: number | null
          height_cm?: number | null
          id?: string
          measured_on?: string
          notes?: string | null
          user_id?: string
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "family_growth_log_family_member_id_fkey"
            columns: ["family_member_id"]
            isOneToOne: false
            referencedRelation: "family_members"
            referencedColumns: ["id"]
          },
        ]
      }
      family_health_records: {
        Row: {
          blood_type: string | null
          conditions: string[] | null
          created_at: string
          dentist_name: string | null
          dentist_phone: string | null
          family_member_id: string | null
          id: string
          last_checkup_date: string | null
          next_checkup_date: string | null
          notes: string | null
          primary_doctor_address: string | null
          primary_doctor_name: string | null
          primary_doctor_phone: string | null
          specialists: Json | null
          surgeries: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          blood_type?: string | null
          conditions?: string[] | null
          created_at?: string
          dentist_name?: string | null
          dentist_phone?: string | null
          family_member_id?: string | null
          id?: string
          last_checkup_date?: string | null
          next_checkup_date?: string | null
          notes?: string | null
          primary_doctor_address?: string | null
          primary_doctor_name?: string | null
          primary_doctor_phone?: string | null
          specialists?: Json | null
          surgeries?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          blood_type?: string | null
          conditions?: string[] | null
          created_at?: string
          dentist_name?: string | null
          dentist_phone?: string | null
          family_member_id?: string | null
          id?: string
          last_checkup_date?: string | null
          next_checkup_date?: string | null
          notes?: string | null
          primary_doctor_address?: string | null
          primary_doctor_name?: string | null
          primary_doctor_phone?: string | null
          specialists?: Json | null
          surgeries?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_health_records_family_member_id_fkey"
            columns: ["family_member_id"]
            isOneToOne: false
            referencedRelation: "family_members"
            referencedColumns: ["id"]
          },
        ]
      }
      family_homework_schedule: {
        Row: {
          created_at: string
          day_of_week: number
          estimated_minutes: number | null
          family_member_id: string
          id: string
          notes: string | null
          subject: string
          user_id: string
        }
        Insert: {
          created_at?: string
          day_of_week: number
          estimated_minutes?: number | null
          family_member_id: string
          id?: string
          notes?: string | null
          subject: string
          user_id: string
        }
        Update: {
          created_at?: string
          day_of_week?: number
          estimated_minutes?: number | null
          family_member_id?: string
          id?: string
          notes?: string | null
          subject?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_homework_schedule_family_member_id_fkey"
            columns: ["family_member_id"]
            isOneToOne: false
            referencedRelation: "family_members"
            referencedColumns: ["id"]
          },
        ]
      }
      family_important_documents: {
        Row: {
          created_at: string
          document_number: string | null
          document_type: string
          expiry_date: string | null
          family_member_id: string | null
          file_path: string | null
          file_url: string | null
          id: string
          issue_date: string | null
          issuing_authority: string | null
          issuing_country: string | null
          last_reminded_at: string | null
          notes: string | null
          reminder_days_before: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          document_number?: string | null
          document_type: string
          expiry_date?: string | null
          family_member_id?: string | null
          file_path?: string | null
          file_url?: string | null
          id?: string
          issue_date?: string | null
          issuing_authority?: string | null
          issuing_country?: string | null
          last_reminded_at?: string | null
          notes?: string | null
          reminder_days_before?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          document_number?: string | null
          document_type?: string
          expiry_date?: string | null
          family_member_id?: string | null
          file_path?: string | null
          file_url?: string | null
          id?: string
          issue_date?: string | null
          issuing_authority?: string | null
          issuing_country?: string | null
          last_reminded_at?: string | null
          notes?: string | null
          reminder_days_before?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_important_documents_family_member_id_fkey"
            columns: ["family_member_id"]
            isOneToOne: false
            referencedRelation: "family_members"
            referencedColumns: ["id"]
          },
        ]
      }
      family_insurance: {
        Row: {
          card_image_url: string | null
          contact_phone: string | null
          created_at: string
          end_date: string | null
          family_member_id: string | null
          group_number: string | null
          id: string
          insurance_type: string
          is_active: boolean | null
          notes: string | null
          policy_number: string | null
          premium_amount: number | null
          premium_frequency: string | null
          provider: string
          start_date: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          card_image_url?: string | null
          contact_phone?: string | null
          created_at?: string
          end_date?: string | null
          family_member_id?: string | null
          group_number?: string | null
          id?: string
          insurance_type: string
          is_active?: boolean | null
          notes?: string | null
          policy_number?: string | null
          premium_amount?: number | null
          premium_frequency?: string | null
          provider: string
          start_date?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          card_image_url?: string | null
          contact_phone?: string | null
          created_at?: string
          end_date?: string | null
          family_member_id?: string | null
          group_number?: string | null
          id?: string
          insurance_type?: string
          is_active?: boolean | null
          notes?: string | null
          policy_number?: string | null
          premium_amount?: number | null
          premium_frequency?: string | null
          provider?: string
          start_date?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_insurance_family_member_id_fkey"
            columns: ["family_member_id"]
            isOneToOne: false
            referencedRelation: "family_members"
            referencedColumns: ["id"]
          },
        ]
      }
      family_meal_preferences: {
        Row: {
          created_at: string
          dietary_restrictions: string[] | null
          dislikes: string[] | null
          family_member_id: string
          favorite_meals: string[] | null
          id: string
          loves: string[] | null
          notes: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          dietary_restrictions?: string[] | null
          dislikes?: string[] | null
          family_member_id: string
          favorite_meals?: string[] | null
          id?: string
          loves?: string[] | null
          notes?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          dietary_restrictions?: string[] | null
          dislikes?: string[] | null
          family_member_id?: string
          favorite_meals?: string[] | null
          id?: string
          loves?: string[] | null
          notes?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_meal_preferences_family_member_id_fkey"
            columns: ["family_member_id"]
            isOneToOne: true
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
      family_pickup_rota: {
        Row: {
          created_at: string
          day_of_week: number
          dropoff_time: string | null
          family_member_id: string
          id: string
          is_active: boolean | null
          location: string | null
          notes: string | null
          pickup_time: string | null
          responsible_person: string | null
          responsible_user_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          day_of_week: number
          dropoff_time?: string | null
          family_member_id: string
          id?: string
          is_active?: boolean | null
          location?: string | null
          notes?: string | null
          pickup_time?: string | null
          responsible_person?: string | null
          responsible_user_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          day_of_week?: number
          dropoff_time?: string | null
          family_member_id?: string
          id?: string
          is_active?: boolean | null
          location?: string | null
          notes?: string | null
          pickup_time?: string | null
          responsible_person?: string | null
          responsible_user_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_pickup_rota_family_member_id_fkey"
            columns: ["family_member_id"]
            isOneToOne: false
            referencedRelation: "family_members"
            referencedColumns: ["id"]
          },
        ]
      }
      family_school_calendar: {
        Row: {
          created_at: string
          description: string | null
          end_date: string | null
          event_type: string
          family_member_id: string | null
          id: string
          last_reminded_at: string | null
          reminder_days_before: number | null
          start_date: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          end_date?: string | null
          event_type: string
          family_member_id?: string | null
          id?: string
          last_reminded_at?: string | null
          reminder_days_before?: number | null
          start_date: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          end_date?: string | null
          event_type?: string
          family_member_id?: string | null
          id?: string
          last_reminded_at?: string | null
          reminder_days_before?: number | null
          start_date?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_school_calendar_family_member_id_fkey"
            columns: ["family_member_id"]
            isOneToOne: false
            referencedRelation: "family_members"
            referencedColumns: ["id"]
          },
        ]
      }
      family_sick_log: {
        Row: {
          created_at: string
          diagnosis: string | null
          doctor_visited: boolean | null
          family_member_id: string
          id: string
          notes: string | null
          recovery_date: string | null
          sick_date: string
          symptoms: string[] | null
          treatment: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          diagnosis?: string | null
          doctor_visited?: boolean | null
          family_member_id: string
          id?: string
          notes?: string | null
          recovery_date?: string | null
          sick_date?: string
          symptoms?: string[] | null
          treatment?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          diagnosis?: string | null
          doctor_visited?: boolean | null
          family_member_id?: string
          id?: string
          notes?: string | null
          recovery_date?: string | null
          sick_date?: string
          symptoms?: string[] | null
          treatment?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_sick_log_family_member_id_fkey"
            columns: ["family_member_id"]
            isOneToOne: false
            referencedRelation: "family_members"
            referencedColumns: ["id"]
          },
        ]
      }
      family_sleep_schedule: {
        Row: {
          bedtime: string | null
          created_at: string
          family_member_id: string
          id: string
          nap_duration_minutes: number | null
          nap_time: string | null
          notes: string | null
          screen_time_limit_minutes: number | null
          updated_at: string
          user_id: string
          wake_time: string | null
        }
        Insert: {
          bedtime?: string | null
          created_at?: string
          family_member_id: string
          id?: string
          nap_duration_minutes?: number | null
          nap_time?: string | null
          notes?: string | null
          screen_time_limit_minutes?: number | null
          updated_at?: string
          user_id: string
          wake_time?: string | null
        }
        Update: {
          bedtime?: string | null
          created_at?: string
          family_member_id?: string
          id?: string
          nap_duration_minutes?: number | null
          nap_time?: string | null
          notes?: string | null
          screen_time_limit_minutes?: number | null
          updated_at?: string
          user_id?: string
          wake_time?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "family_sleep_schedule_family_member_id_fkey"
            columns: ["family_member_id"]
            isOneToOne: true
            referencedRelation: "family_members"
            referencedColumns: ["id"]
          },
        ]
      }
      family_traditions: {
        Row: {
          cadence: string
          created_at: string
          day_of_month: number | null
          day_of_week: number | null
          description: string | null
          id: string
          is_active: boolean | null
          last_celebrated_at: string | null
          last_reminded_at: string | null
          month_of_year: number | null
          next_occurrence: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cadence?: string
          created_at?: string
          day_of_month?: number | null
          day_of_week?: number | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          last_celebrated_at?: string | null
          last_reminded_at?: string | null
          month_of_year?: number | null
          next_occurrence?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cadence?: string
          created_at?: string
          day_of_month?: number | null
          day_of_week?: number | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          last_celebrated_at?: string | null
          last_reminded_at?: string | null
          month_of_year?: number | null
          next_occurrence?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
      fasting_logs: {
        Row: {
          completed: boolean
          created_at: string
          fast_date: string
          fast_type: string
          id: string
          notes: string | null
          user_id: string
        }
        Insert: {
          completed?: boolean
          created_at?: string
          fast_date: string
          fast_type?: string
          id?: string
          notes?: string | null
          user_id: string
        }
        Update: {
          completed?: boolean
          created_at?: string
          fast_date?: string
          fast_type?: string
          id?: string
          notes?: string | null
          user_id?: string
        }
        Relationships: []
      }
      financial_accounts: {
        Row: {
          account_type: string
          created_at: string
          currency: string | null
          current_balance: number | null
          id: string
          institution: string | null
          is_active: boolean | null
          name: string
          notes: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_type?: string
          created_at?: string
          currency?: string | null
          current_balance?: number | null
          id?: string
          institution?: string | null
          is_active?: boolean | null
          name: string
          notes?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account_type?: string
          created_at?: string
          currency?: string | null
          current_balance?: number | null
          id?: string
          institution?: string | null
          is_active?: boolean | null
          name?: string
          notes?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      financial_budgets: {
        Row: {
          category: string
          created_at: string
          currency: string | null
          id: string
          monthly_limit: number
          updated_at: string
          user_id: string
        }
        Insert: {
          category: string
          created_at?: string
          currency?: string | null
          id?: string
          monthly_limit?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          currency?: string | null
          id?: string
          monthly_limit?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      financial_goals: {
        Row: {
          category: string | null
          created_at: string
          currency: string | null
          current_amount: number | null
          id: string
          is_achieved: boolean | null
          notes: string | null
          target_amount: number
          target_date: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          currency?: string | null
          current_amount?: number | null
          id?: string
          is_achieved?: boolean | null
          notes?: string | null
          target_amount: number
          target_date?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string | null
          created_at?: string
          currency?: string | null
          current_amount?: number | null
          id?: string
          is_achieved?: boolean | null
          notes?: string | null
          target_amount?: number
          target_date?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      financial_transactions: {
        Row: {
          account_id: string | null
          amount: number
          category: string | null
          created_at: string
          description: string | null
          direction: string
          id: string
          merchant: string | null
          occurred_on: string
          receipt_id: string | null
          tags: string[] | null
          user_id: string
        }
        Insert: {
          account_id?: string | null
          amount: number
          category?: string | null
          created_at?: string
          description?: string | null
          direction?: string
          id?: string
          merchant?: string | null
          occurred_on?: string
          receipt_id?: string | null
          tags?: string[] | null
          user_id: string
        }
        Update: {
          account_id?: string | null
          amount?: number
          category?: string | null
          created_at?: string
          description?: string | null
          direction?: string
          id?: string
          merchant?: string | null
          occurred_on?: string
          receipt_id?: string | null
          tags?: string[] | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "financial_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      flight_tracking: {
        Row: {
          airline: string | null
          checkin_reminder_at: string | null
          created_at: string
          depart_at: string
          destination: string | null
          flight_number: string
          id: string
          notes: string | null
          origin: string | null
          status: string | null
          trip_event_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          airline?: string | null
          checkin_reminder_at?: string | null
          created_at?: string
          depart_at: string
          destination?: string | null
          flight_number: string
          id?: string
          notes?: string | null
          origin?: string | null
          status?: string | null
          trip_event_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          airline?: string | null
          checkin_reminder_at?: string | null
          created_at?: string
          depart_at?: string
          destination?: string | null
          flight_number?: string
          id?: string
          notes?: string | null
          origin?: string | null
          status?: string | null
          trip_event_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
      friend_circle_members: {
        Row: {
          circle_id: string | null
          contact_id: string | null
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          circle_id?: string | null
          contact_id?: string | null
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          circle_id?: string | null
          contact_id?: string | null
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "friend_circle_members_circle_id_fkey"
            columns: ["circle_id"]
            isOneToOne: false
            referencedRelation: "friend_circles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friend_circle_members_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "user_contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      friend_circles: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      gift_log: {
        Row: {
          contact_id: string | null
          cost: number | null
          created_at: string
          gift_description: string
          given_on: string
          id: string
          notes: string | null
          occasion: string | null
          reaction: string | null
          user_id: string
        }
        Insert: {
          contact_id?: string | null
          cost?: number | null
          created_at?: string
          gift_description: string
          given_on?: string
          id?: string
          notes?: string | null
          occasion?: string | null
          reaction?: string | null
          user_id: string
        }
        Update: {
          contact_id?: string | null
          cost?: number | null
          created_at?: string
          gift_description?: string
          given_on?: string
          id?: string
          notes?: string | null
          occasion?: string | null
          reaction?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gift_log_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "user_contacts"
            referencedColumns: ["id"]
          },
        ]
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
      household_maintenance: {
        Row: {
          category: string | null
          cost_estimate: number | null
          created_at: string
          frequency_months: number | null
          id: string
          is_active: boolean | null
          last_done_date: string | null
          last_reminded_at: string | null
          next_due_date: string | null
          notes: string | null
          provider_name: string | null
          provider_phone: string | null
          reminder_days_before: number | null
          task_name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string | null
          cost_estimate?: number | null
          created_at?: string
          frequency_months?: number | null
          id?: string
          is_active?: boolean | null
          last_done_date?: string | null
          last_reminded_at?: string | null
          next_due_date?: string | null
          notes?: string | null
          provider_name?: string | null
          provider_phone?: string | null
          reminder_days_before?: number | null
          task_name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string | null
          cost_estimate?: number | null
          created_at?: string
          frequency_months?: number | null
          id?: string
          is_active?: boolean | null
          last_done_date?: string | null
          last_reminded_at?: string | null
          next_due_date?: string | null
          notes?: string | null
          provider_name?: string | null
          provider_phone?: string | null
          reminder_days_before?: number | null
          task_name?: string
          updated_at?: string
          user_id?: string
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
      inventory_items: {
        Row: {
          brand: string | null
          category: string | null
          created_at: string
          current_value: number | null
          id: string
          name: string
          notes: string | null
          photo_url: string | null
          property_id: string | null
          purchase_date: string | null
          purchase_price: number | null
          serial_number: string | null
          updated_at: string
          user_id: string
          warranty_until: string | null
        }
        Insert: {
          brand?: string | null
          category?: string | null
          created_at?: string
          current_value?: number | null
          id?: string
          name: string
          notes?: string | null
          photo_url?: string | null
          property_id?: string | null
          purchase_date?: string | null
          purchase_price?: number | null
          serial_number?: string | null
          updated_at?: string
          user_id: string
          warranty_until?: string | null
        }
        Update: {
          brand?: string | null
          category?: string | null
          created_at?: string
          current_value?: number | null
          id?: string
          name?: string
          notes?: string | null
          photo_url?: string | null
          property_id?: string | null
          purchase_date?: string | null
          purchase_price?: number | null
          serial_number?: string | null
          updated_at?: string
          user_id?: string
          warranty_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_items_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "user_properties"
            referencedColumns: ["id"]
          },
        ]
      }
      islamic_notification_settings: {
        Row: {
          created_at: string
          daily_hadith_enabled: boolean
          daily_hadith_time: string
          events_enabled: boolean
          events_hours_before: number
          events_send_time: string
          hadith_source_preference: string
          id: string
          notification_language: string
          prayer_reminder_minutes_before: number
          prayer_reminders_enabled: boolean
          prayer_reminders_for_all_five: boolean
          prayer_reminders_selected: string[]
          timezone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          daily_hadith_enabled?: boolean
          daily_hadith_time?: string
          events_enabled?: boolean
          events_hours_before?: number
          events_send_time?: string
          hadith_source_preference?: string
          id?: string
          notification_language?: string
          prayer_reminder_minutes_before?: number
          prayer_reminders_enabled?: boolean
          prayer_reminders_for_all_five?: boolean
          prayer_reminders_selected?: string[]
          timezone?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          daily_hadith_enabled?: boolean
          daily_hadith_time?: string
          events_enabled?: boolean
          events_hours_before?: number
          events_send_time?: string
          hadith_source_preference?: string
          id?: string
          notification_language?: string
          prayer_reminder_minutes_before?: number
          prayer_reminders_enabled?: boolean
          prayer_reminders_for_all_five?: boolean
          prayer_reminders_selected?: string[]
          timezone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      journal_entries: {
        Row: {
          content: string
          created_at: string
          entry_date: string
          id: string
          is_private: boolean | null
          mood: string | null
          prompt: string | null
          tags: string[] | null
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          entry_date?: string
          id?: string
          is_private?: boolean | null
          mood?: string | null
          prompt?: string | null
          tags?: string[] | null
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          entry_date?: string
          id?: string
          is_private?: boolean | null
          mood?: string | null
          prompt?: string | null
          tags?: string[] | null
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      lab_results: {
        Row: {
          created_at: string
          doctor_id: string | null
          document_url: string | null
          id: string
          notes: string | null
          reference_high: number | null
          reference_low: number | null
          status: string | null
          test_date: string
          test_name: string
          unit: string | null
          user_id: string
          value: number | null
        }
        Insert: {
          created_at?: string
          doctor_id?: string | null
          document_url?: string | null
          id?: string
          notes?: string | null
          reference_high?: number | null
          reference_low?: number | null
          status?: string | null
          test_date?: string
          test_name: string
          unit?: string | null
          user_id: string
          value?: number | null
        }
        Update: {
          created_at?: string
          doctor_id?: string | null
          document_url?: string | null
          id?: string
          notes?: string | null
          reference_high?: number | null
          reference_low?: number | null
          status?: string | null
          test_date?: string
          test_name?: string
          unit?: string | null
          user_id?: string
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "lab_results_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "personal_doctors"
            referencedColumns: ["id"]
          },
        ]
      }
      learned_routines: {
        Row: {
          automation_rule_id: string | null
          confidence: number | null
          created_at: string
          description: string | null
          fingerprint: string
          frequency: string | null
          id: string
          last_occurred_at: string | null
          next_expected_at: string | null
          occurrences: number | null
          pattern: Json
          proposed_at: string
          responded_at: string | null
          routine_type: string
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          automation_rule_id?: string | null
          confidence?: number | null
          created_at?: string
          description?: string | null
          fingerprint: string
          frequency?: string | null
          id?: string
          last_occurred_at?: string | null
          next_expected_at?: string | null
          occurrences?: number | null
          pattern?: Json
          proposed_at?: string
          responded_at?: string | null
          routine_type: string
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          automation_rule_id?: string | null
          confidence?: number | null
          created_at?: string
          description?: string | null
          fingerprint?: string
          frequency?: string | null
          id?: string
          last_occurred_at?: string | null
          next_expected_at?: string | null
          occurrences?: number | null
          pattern?: Json
          proposed_at?: string
          responded_at?: string | null
          routine_type?: string
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
      life_milestones: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          id: string
          occurred_on: string
          photo_url: string | null
          related_people: Json | null
          title: string
          user_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          occurred_on: string
          photo_url?: string | null
          related_people?: Json | null
          title: string
          user_id: string
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          occurred_on?: string
          photo_url?: string | null
          related_people?: Json | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      life_score_commentary: {
        Row: {
          commentary: string
          contributing_factors: Json | null
          created_at: string
          current_score: number | null
          delta: number | null
          headline: string
          id: string
          is_read: boolean | null
          observation_date: string
          previous_score: number | null
          pushed_to_telegram: boolean | null
          suggestions: Json | null
          trend: string | null
          user_id: string
        }
        Insert: {
          commentary: string
          contributing_factors?: Json | null
          created_at?: string
          current_score?: number | null
          delta?: number | null
          headline: string
          id?: string
          is_read?: boolean | null
          observation_date: string
          previous_score?: number | null
          pushed_to_telegram?: boolean | null
          suggestions?: Json | null
          trend?: string | null
          user_id: string
        }
        Update: {
          commentary?: string
          contributing_factors?: Json | null
          created_at?: string
          current_score?: number | null
          delta?: number | null
          headline?: string
          id?: string
          is_read?: boolean | null
          observation_date?: string
          previous_score?: number | null
          pushed_to_telegram?: boolean | null
          suggestions?: Json | null
          trend?: string | null
          user_id?: string
        }
        Relationships: []
      }
      life_scores: {
        Row: {
          created_at: string
          family_score: number | null
          focus_minutes: number | null
          habits_logged: number | null
          health_score: number | null
          id: string
          overall_score: number
          productivity_score: number | null
          relationships_score: number | null
          score_date: string
          spiritual_score: number | null
          tasks_completed: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          family_score?: number | null
          focus_minutes?: number | null
          habits_logged?: number | null
          health_score?: number | null
          id?: string
          overall_score?: number
          productivity_score?: number | null
          relationships_score?: number | null
          score_date?: string
          spiritual_score?: number | null
          tasks_completed?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          family_score?: number | null
          focus_minutes?: number | null
          habits_logged?: number | null
          health_score?: number | null
          id?: string
          overall_score?: number
          productivity_score?: number | null
          relationships_score?: number | null
          score_date?: string
          spiritual_score?: number | null
          tasks_completed?: number | null
          updated_at?: string
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
      loyalty_programs: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          membership_number: string | null
          notes: string | null
          points_balance: number | null
          program_name: string
          program_type: string | null
          tier: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          membership_number?: string | null
          notes?: string | null
          points_balance?: number | null
          program_name: string
          program_type?: string | null
          tier?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          membership_number?: string | null
          notes?: string | null
          points_balance?: number | null
          program_name?: string
          program_type?: string | null
          tier?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      maintenance_log: {
        Row: {
          cost: number | null
          created_at: string
          description: string | null
          document_url: string | null
          id: string
          next_due_date: string | null
          performed_on: string
          property_id: string | null
          provider: string | null
          title: string
          user_id: string
          vehicle_id: string | null
        }
        Insert: {
          cost?: number | null
          created_at?: string
          description?: string | null
          document_url?: string | null
          id?: string
          next_due_date?: string | null
          performed_on?: string
          property_id?: string | null
          provider?: string | null
          title: string
          user_id: string
          vehicle_id?: string | null
        }
        Update: {
          cost?: number | null
          created_at?: string
          description?: string | null
          document_url?: string | null
          id?: string
          next_due_date?: string | null
          performed_on?: string
          property_id?: string | null
          provider?: string | null
          title?: string
          user_id?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_log_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "user_properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_log_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
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
      meeting_briefs: {
        Row: {
          attendees: Json | null
          brief_text: string
          created_at: string
          delivered_at: string | null
          delivered_channel: string | null
          event_id: string
          id: string
          related_contacts: Json | null
          related_contracts: Json | null
          related_emails: Json | null
          user_id: string
        }
        Insert: {
          attendees?: Json | null
          brief_text: string
          created_at?: string
          delivered_at?: string | null
          delivered_channel?: string | null
          event_id: string
          id?: string
          related_contacts?: Json | null
          related_contracts?: Json | null
          related_emails?: Json | null
          user_id: string
        }
        Update: {
          attendees?: Json | null
          brief_text?: string
          created_at?: string
          delivered_at?: string | null
          delivered_channel?: string | null
          event_id?: string
          id?: string
          related_contacts?: Json | null
          related_contracts?: Json | null
          related_emails?: Json | null
          user_id?: string
        }
        Relationships: []
      }
      meeting_reminders_sent: {
        Row: {
          event_id: string
          id: string
          reminder_type: string
          sent_at: string
          user_id: string
        }
        Insert: {
          event_id: string
          id?: string
          reminder_type: string
          sent_at?: string
          user_id: string
        }
        Update: {
          event_id?: string
          id?: string
          reminder_type?: string
          sent_at?: string
          user_id?: string
        }
        Relationships: []
      }
      mental_load_log: {
        Row: {
          category: string
          created_at: string
          description: string
          group_id: string
          handled_by: string
          id: string
          occurred_at: string
          source: string | null
          source_ref: string | null
          weight: number | null
        }
        Insert: {
          category: string
          created_at?: string
          description: string
          group_id: string
          handled_by: string
          id?: string
          occurred_at?: string
          source?: string | null
          source_ref?: string | null
          weight?: number | null
        }
        Update: {
          category?: string
          created_at?: string
          description?: string
          group_id?: string
          handled_by?: string
          id?: string
          occurred_at?: string
          source?: string | null
          source_ref?: string | null
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "mental_load_log_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "family_agent_groups"
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
      mood_logs: {
        Row: {
          context_tags: string[] | null
          created_at: string
          energy_score: number
          id: string
          logged_at: string
          mood_score: number
          notes: string | null
          user_id: string
        }
        Insert: {
          context_tags?: string[] | null
          created_at?: string
          energy_score: number
          id?: string
          logged_at?: string
          mood_score: number
          notes?: string | null
          user_id: string
        }
        Update: {
          context_tags?: string[] | null
          created_at?: string
          energy_score?: number
          id?: string
          logged_at?: string
          mood_score?: number
          notes?: string | null
          user_id?: string
        }
        Relationships: []
      }
      morning_thread_items: {
        Row: {
          action_label: string | null
          action_payload: Json | null
          body: string | null
          created_at: string
          id: string
          is_dismissed: boolean | null
          item_type: string
          pushed_at: string | null
          pushed_to_telegram: boolean | null
          rank: number
          source_ref: string | null
          thread_date: string
          title: string
          user_id: string
        }
        Insert: {
          action_label?: string | null
          action_payload?: Json | null
          body?: string | null
          created_at?: string
          id?: string
          is_dismissed?: boolean | null
          item_type: string
          pushed_at?: string | null
          pushed_to_telegram?: boolean | null
          rank?: number
          source_ref?: string | null
          thread_date: string
          title: string
          user_id: string
        }
        Update: {
          action_label?: string | null
          action_payload?: Json | null
          body?: string | null
          created_at?: string
          id?: string
          is_dismissed?: boolean | null
          item_type?: string
          pushed_at?: string | null
          pushed_to_telegram?: boolean | null
          rank?: number
          source_ref?: string | null
          thread_date?: string
          title?: string
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
          created_by_telegram_user_id: number | null
          created_via: string | null
          id: string
          is_pinned: boolean
          linked_items: Json | null
          tags: string[] | null
          title: string
          trashed: boolean
          trashed_at: string | null
          updated_at: string
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          content?: string
          created_at?: string
          created_by_telegram_user_id?: number | null
          created_via?: string | null
          id?: string
          is_pinned?: boolean
          linked_items?: Json | null
          tags?: string[] | null
          title?: string
          trashed?: boolean
          trashed_at?: string | null
          updated_at?: string
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          created_by_telegram_user_id?: number | null
          created_via?: string | null
          id?: string
          is_pinned?: boolean
          linked_items?: Json | null
          tags?: string[] | null
          title?: string
          trashed?: boolean
          trashed_at?: string | null
          updated_at?: string
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notes_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
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
      notifications: {
        Row: {
          created_at: string
          data: Json | null
          id: string
          is_read: boolean | null
          message: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          data?: Json | null
          id?: string
          is_read?: boolean | null
          message?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          data?: Json | null
          id?: string
          is_read?: boolean | null
          message?: string | null
          title?: string
          type?: string
          user_id?: string
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
      packing_lists: {
        Row: {
          created_at: string
          id: string
          items: Json | null
          name: string
          trip_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          items?: Json | null
          name?: string
          trip_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          items?: Json | null
          name?: string
          trip_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "packing_lists_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      pantry_items: {
        Row: {
          category: string | null
          created_at: string
          expires_on: string | null
          id: string
          item: string
          notes: string | null
          quantity: number | null
          unit: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          expires_on?: string | null
          id?: string
          item: string
          notes?: string | null
          quantity?: number | null
          unit?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string | null
          created_at?: string
          expires_on?: string | null
          id?: string
          item?: string
          notes?: string | null
          quantity?: number | null
          unit?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      period_logs: {
        Row: {
          created_at: string
          end_date: string | null
          flow: string | null
          id: string
          notes: string | null
          start_date: string
          symptoms: string[] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          end_date?: string | null
          flow?: string | null
          id?: string
          notes?: string | null
          start_date: string
          symptoms?: string[] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          end_date?: string | null
          flow?: string | null
          id?: string
          notes?: string | null
          start_date?: string
          symptoms?: string[] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      personal_doctors: {
        Row: {
          address: string | null
          clinic: string | null
          created_at: string
          email: string | null
          id: string
          last_visit: string | null
          name: string
          next_visit: string | null
          notes: string | null
          phone: string | null
          specialty: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          clinic?: string | null
          created_at?: string
          email?: string | null
          id?: string
          last_visit?: string | null
          name: string
          next_visit?: string | null
          notes?: string | null
          phone?: string | null
          specialty?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          clinic?: string | null
          created_at?: string
          email?: string | null
          id?: string
          last_visit?: string | null
          name?: string
          next_visit?: string | null
          notes?: string | null
          phone?: string | null
          specialty?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      personal_medications: {
        Row: {
          created_at: string
          dose: string | null
          end_date: string | null
          frequency: string | null
          id: string
          is_active: boolean | null
          name: string
          notes: string | null
          prescriber: string | null
          reason: string | null
          refill_date: string | null
          schedule: string | null
          start_date: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          dose?: string | null
          end_date?: string | null
          frequency?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          notes?: string | null
          prescriber?: string | null
          reason?: string | null
          refill_date?: string | null
          schedule?: string | null
          start_date?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          dose?: string | null
          end_date?: string | null
          frequency?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          notes?: string | null
          prescriber?: string | null
          reason?: string | null
          refill_date?: string | null
          schedule?: string | null
          start_date?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      pets: {
        Row: {
          breed: string | null
          created_at: string
          date_of_birth: string | null
          food_brand: string | null
          food_notes: string | null
          id: string
          insurance_policy_number: string | null
          insurance_provider: string | null
          last_reminded_at: string | null
          microchip_number: string | null
          name: string
          next_vaccination_date: string | null
          next_vet_checkup: string | null
          notes: string | null
          photo_url: string | null
          species: string | null
          updated_at: string
          user_id: string
          vet_name: string | null
          vet_phone: string | null
          weight_kg: number | null
        }
        Insert: {
          breed?: string | null
          created_at?: string
          date_of_birth?: string | null
          food_brand?: string | null
          food_notes?: string | null
          id?: string
          insurance_policy_number?: string | null
          insurance_provider?: string | null
          last_reminded_at?: string | null
          microchip_number?: string | null
          name: string
          next_vaccination_date?: string | null
          next_vet_checkup?: string | null
          notes?: string | null
          photo_url?: string | null
          species?: string | null
          updated_at?: string
          user_id: string
          vet_name?: string | null
          vet_phone?: string | null
          weight_kg?: number | null
        }
        Update: {
          breed?: string | null
          created_at?: string
          date_of_birth?: string | null
          food_brand?: string | null
          food_notes?: string | null
          id?: string
          insurance_policy_number?: string | null
          insurance_provider?: string | null
          last_reminded_at?: string | null
          microchip_number?: string | null
          name?: string
          next_vaccination_date?: string | null
          next_vet_checkup?: string | null
          notes?: string | null
          photo_url?: string | null
          species?: string | null
          updated_at?: string
          user_id?: string
          vet_name?: string | null
          vet_phone?: string | null
          weight_kg?: number | null
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
      presence_status: {
        Row: {
          expires_at: string | null
          message: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          expires_at?: string | null
          message?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          expires_at?: string | null
          message?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      proactive_feedback: {
        Row: {
          channel: string
          context: Json | null
          created_at: string
          id: string
          message_excerpt: string | null
          rating: number
          trigger_key: string | null
          trigger_type: string
          user_id: string
        }
        Insert: {
          channel?: string
          context?: Json | null
          created_at?: string
          id?: string
          message_excerpt?: string | null
          rating: number
          trigger_key?: string | null
          trigger_type: string
          user_id: string
        }
        Update: {
          channel?: string
          context?: Json | null
          created_at?: string
          id?: string
          message_excerpt?: string | null
          rating?: number
          trigger_key?: string | null
          trigger_type?: string
          user_id?: string
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
          birthday_reminder_days: number[]
          birthday_reminders_enabled: boolean
          calendar_overload_enabled: boolean | null
          calendar_overload_threshold: number | null
          contact_checkin_days: number | null
          contact_checkins_enabled: boolean | null
          contract_reminder_days: number[] | null
          contract_renewals_enabled: boolean | null
          created_at: string
          daily_review_enabled: boolean | null
          email_action_alerts_enabled: boolean
          email_autoarchive_categories: string[]
          email_autopilot: boolean
          enabled: boolean | null
          evening_dua_enabled: boolean
          evening_review_time: string | null
          event_prep_enabled: boolean | null
          forgotten_task_days: number | null
          forgotten_tasks_enabled: boolean | null
          habit_streak_warning_hours: number | null
          habit_streaks_enabled: boolean | null
          id: string
          in_app_notifications_enabled: boolean | null
          meeting_briefing_enabled: boolean | null
          meeting_briefing_minutes: number[] | null
          meeting_followup_enabled: boolean | null
          meeting_prep_enabled: boolean | null
          morning_briefing_time: string | null
          onboarding_checklist_dismissed: boolean
          prayer_reminder_minutes: number
          prayer_reminders_enabled: boolean
          prefer_voice_replies: boolean | null
          push_notifications_enabled: boolean | null
          quiet_hours_enabled: boolean | null
          quiet_hours_end: string | null
          quiet_hours_start: string | null
          stale_contact_days: number | null
          telegram_group_enabled: boolean
          telegram_proactive_enabled: boolean | null
          timezone: string | null
          updated_at: string
          user_id: string
          voice_alerts_enabled: boolean | null
          voice_proactive_enabled: boolean | null
          weekly_planning_day: number | null
          weekly_planning_enabled: boolean | null
        }
        Insert: {
          birthday_reminder_days?: number[]
          birthday_reminders_enabled?: boolean
          calendar_overload_enabled?: boolean | null
          calendar_overload_threshold?: number | null
          contact_checkin_days?: number | null
          contact_checkins_enabled?: boolean | null
          contract_reminder_days?: number[] | null
          contract_renewals_enabled?: boolean | null
          created_at?: string
          daily_review_enabled?: boolean | null
          email_action_alerts_enabled?: boolean
          email_autoarchive_categories?: string[]
          email_autopilot?: boolean
          enabled?: boolean | null
          evening_dua_enabled?: boolean
          evening_review_time?: string | null
          event_prep_enabled?: boolean | null
          forgotten_task_days?: number | null
          forgotten_tasks_enabled?: boolean | null
          habit_streak_warning_hours?: number | null
          habit_streaks_enabled?: boolean | null
          id?: string
          in_app_notifications_enabled?: boolean | null
          meeting_briefing_enabled?: boolean | null
          meeting_briefing_minutes?: number[] | null
          meeting_followup_enabled?: boolean | null
          meeting_prep_enabled?: boolean | null
          morning_briefing_time?: string | null
          onboarding_checklist_dismissed?: boolean
          prayer_reminder_minutes?: number
          prayer_reminders_enabled?: boolean
          prefer_voice_replies?: boolean | null
          push_notifications_enabled?: boolean | null
          quiet_hours_enabled?: boolean | null
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          stale_contact_days?: number | null
          telegram_group_enabled?: boolean
          telegram_proactive_enabled?: boolean | null
          timezone?: string | null
          updated_at?: string
          user_id: string
          voice_alerts_enabled?: boolean | null
          voice_proactive_enabled?: boolean | null
          weekly_planning_day?: number | null
          weekly_planning_enabled?: boolean | null
        }
        Update: {
          birthday_reminder_days?: number[]
          birthday_reminders_enabled?: boolean
          calendar_overload_enabled?: boolean | null
          calendar_overload_threshold?: number | null
          contact_checkin_days?: number | null
          contact_checkins_enabled?: boolean | null
          contract_reminder_days?: number[] | null
          contract_renewals_enabled?: boolean | null
          created_at?: string
          daily_review_enabled?: boolean | null
          email_action_alerts_enabled?: boolean
          email_autoarchive_categories?: string[]
          email_autopilot?: boolean
          enabled?: boolean | null
          evening_dua_enabled?: boolean
          evening_review_time?: string | null
          event_prep_enabled?: boolean | null
          forgotten_task_days?: number | null
          forgotten_tasks_enabled?: boolean | null
          habit_streak_warning_hours?: number | null
          habit_streaks_enabled?: boolean | null
          id?: string
          in_app_notifications_enabled?: boolean | null
          meeting_briefing_enabled?: boolean | null
          meeting_briefing_minutes?: number[] | null
          meeting_followup_enabled?: boolean | null
          meeting_prep_enabled?: boolean | null
          morning_briefing_time?: string | null
          onboarding_checklist_dismissed?: boolean
          prayer_reminder_minutes?: number
          prayer_reminders_enabled?: boolean
          prefer_voice_replies?: boolean | null
          push_notifications_enabled?: boolean | null
          quiet_hours_enabled?: boolean | null
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          stale_contact_days?: number | null
          telegram_group_enabled?: boolean
          telegram_proactive_enabled?: boolean | null
          timezone?: string | null
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
          locale: string | null
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
          locale?: string | null
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
          locale?: string | null
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
          workspace_id: string | null
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
          workspace_id?: string | null
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
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
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
      receipts: {
        Row: {
          amount: number | null
          created_at: string
          file_path: string | null
          file_url: string | null
          id: string
          merchant: string | null
          ocr_text: string | null
          receipt_date: string | null
          transaction_id: string | null
          user_id: string
        }
        Insert: {
          amount?: number | null
          created_at?: string
          file_path?: string | null
          file_url?: string | null
          id?: string
          merchant?: string | null
          ocr_text?: string | null
          receipt_date?: string | null
          transaction_id?: string | null
          user_id: string
        }
        Update: {
          amount?: number | null
          created_at?: string
          file_path?: string | null
          file_url?: string | null
          id?: string
          merchant?: string | null
          ocr_text?: string | null
          receipt_date?: string | null
          transaction_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "receipts_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "financial_transactions"
            referencedColumns: ["id"]
          },
        ]
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
          created_by_telegram_user_id: number | null
          created_via: string | null
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
          created_by_telegram_user_id?: number | null
          created_via?: string | null
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
          created_by_telegram_user_id?: number | null
          created_via?: string | null
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
      skills: {
        Row: {
          category: string | null
          created_at: string
          current_level: string | null
          id: string
          last_practiced: string | null
          name: string
          notes: string | null
          practice_frequency: string | null
          target_level: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          current_level?: string | null
          id?: string
          last_practiced?: string | null
          name: string
          notes?: string | null
          practice_frequency?: string | null
          target_level?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string | null
          created_at?: string
          current_level?: string | null
          id?: string
          last_practiced?: string | null
          name?: string
          notes?: string | null
          practice_frequency?: string | null
          target_level?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
      task_comments: {
        Row: {
          author_id: string | null
          body: string
          created_at: string
          id: string
          source: string
          task_id: string
        }
        Insert: {
          author_id?: string | null
          body: string
          created_at?: string
          id?: string
          source?: string
          task_id: string
        }
        Update: {
          author_id?: string | null
          body?: string
          created_at?: string
          id?: string
          source?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_comments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
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
          completion_note: string | null
          created_at: string
          created_by_telegram_user_id: number | null
          created_via: string | null
          description: string | null
          due_date: string | null
          estimate_minutes: number | null
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
          tags: string[] | null
          title: string
          trashed: boolean
          trashed_at: string | null
          updated_at: string
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          attachments?: Json | null
          category?: string
          checklist?: Json | null
          comments?: Json | null
          completed?: boolean
          completion_note?: string | null
          created_at?: string
          created_by_telegram_user_id?: number | null
          created_via?: string | null
          description?: string | null
          due_date?: string | null
          estimate_minutes?: number | null
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
          tags?: string[] | null
          title: string
          trashed?: boolean
          trashed_at?: string | null
          updated_at?: string
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          attachments?: Json | null
          category?: string
          checklist?: Json | null
          comments?: Json | null
          completed?: boolean
          completion_note?: string | null
          created_at?: string
          created_by_telegram_user_id?: number | null
          created_via?: string | null
          description?: string | null
          due_date?: string | null
          estimate_minutes?: number | null
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
          tags?: string[] | null
          title?: string
          trashed?: boolean
          trashed_at?: string | null
          updated_at?: string
          user_id?: string
          workspace_id?: string | null
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
          {
            foreignKeyName: "tasks_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      telegram_assistant_replies: {
        Row: {
          chat_id: number
          created_at: string
          id: number
          in_response_to_update_id: number | null
          reply: string
        }
        Insert: {
          chat_id: number
          created_at?: string
          id?: number
          in_response_to_update_id?: number | null
          reply: string
        }
        Update: {
          chat_id?: number
          created_at?: string
          id?: number
          in_response_to_update_id?: number | null
          reply?: string
        }
        Relationships: []
      }
      telegram_bot_state: {
        Row: {
          id: number
          update_offset: number
          updated_at: string
        }
        Insert: {
          id: number
          update_offset?: number
          updated_at?: string
        }
        Update: {
          id?: number
          update_offset?: number
          updated_at?: string
        }
        Relationships: []
      }
      telegram_group_links: {
        Row: {
          chat_id: number | null
          created_at: string
          id: string
          is_active: boolean
          link_code: string | null
          link_code_expires_at: string | null
          linked_at: string | null
          morning_digest_enabled: boolean
          morning_digest_hour: number
          morning_digest_last_sent_on: string | null
          owner_user_id: string
          partner_user_id: string | null
          space_member_id: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          chat_id?: number | null
          created_at?: string
          id?: string
          is_active?: boolean
          link_code?: string | null
          link_code_expires_at?: string | null
          linked_at?: string | null
          morning_digest_enabled?: boolean
          morning_digest_hour?: number
          morning_digest_last_sent_on?: string | null
          owner_user_id: string
          partner_user_id?: string | null
          space_member_id?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          chat_id?: number | null
          created_at?: string
          id?: string
          is_active?: boolean
          link_code?: string | null
          link_code_expires_at?: string | null
          linked_at?: string | null
          morning_digest_enabled?: boolean
          morning_digest_hour?: number
          morning_digest_last_sent_on?: string | null
          owner_user_id?: string
          partner_user_id?: string | null
          space_member_id?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      telegram_links: {
        Row: {
          chat_id: number | null
          created_at: string
          id: string
          is_active: boolean
          link_code: string | null
          link_code_expires_at: string | null
          linked_at: string | null
          telegram_first_name: string | null
          telegram_username: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          chat_id?: number | null
          created_at?: string
          id?: string
          is_active?: boolean
          link_code?: string | null
          link_code_expires_at?: string | null
          linked_at?: string | null
          telegram_first_name?: string | null
          telegram_username?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          chat_id?: number | null
          created_at?: string
          id?: string
          is_active?: boolean
          link_code?: string | null
          link_code_expires_at?: string | null
          linked_at?: string | null
          telegram_first_name?: string | null
          telegram_username?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      telegram_messages: {
        Row: {
          chat_id: number
          created_at: string
          processed: boolean
          raw_update: Json
          text: string | null
          update_id: number
        }
        Insert: {
          chat_id: number
          created_at?: string
          processed?: boolean
          raw_update: Json
          text?: string | null
          update_id: number
        }
        Update: {
          chat_id?: number
          created_at?: string
          processed?: boolean
          raw_update?: Json
          text?: string | null
          update_id?: number
        }
        Relationships: []
      }
      telegram_user_map: {
        Row: {
          created_at: string
          id: string
          telegram_first_name: string | null
          telegram_user_id: number
          telegram_username: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          telegram_first_name?: string | null
          telegram_user_id: number
          telegram_username?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          telegram_first_name?: string | null
          telegram_user_id?: number
          telegram_username?: string | null
          user_id?: string
        }
        Relationships: []
      }
      trip_bookings: {
        Row: {
          booking_type: string
          confirmation_number: string | null
          cost: number | null
          created_at: string
          currency: string | null
          destination: string | null
          document_url: string | null
          end_time: string | null
          id: string
          notes: string | null
          origin: string | null
          provider: string | null
          start_time: string | null
          trip_id: string | null
          user_id: string
        }
        Insert: {
          booking_type: string
          confirmation_number?: string | null
          cost?: number | null
          created_at?: string
          currency?: string | null
          destination?: string | null
          document_url?: string | null
          end_time?: string | null
          id?: string
          notes?: string | null
          origin?: string | null
          provider?: string | null
          start_time?: string | null
          trip_id?: string | null
          user_id: string
        }
        Update: {
          booking_type?: string
          confirmation_number?: string | null
          cost?: number | null
          created_at?: string
          currency?: string | null
          destination?: string | null
          document_url?: string | null
          end_time?: string | null
          id?: string
          notes?: string | null
          origin?: string | null
          provider?: string | null
          start_time?: string | null
          trip_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_bookings_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trips: {
        Row: {
          companions: Json | null
          created_at: string
          destination: string
          destination_country: string | null
          end_date: string
          id: string
          notes: string | null
          purpose: string | null
          start_date: string
          status: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          companions?: Json | null
          created_at?: string
          destination: string
          destination_country?: string | null
          end_date: string
          id?: string
          notes?: string | null
          purpose?: string | null
          start_date: string
          status?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          companions?: Json | null
          created_at?: string
          destination?: string
          destination_country?: string | null
          end_date?: string
          id?: string
          notes?: string | null
          purpose?: string | null
          start_date?: string
          status?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_challenges: {
        Row: {
          challenge_id: string
          completed_at: string | null
          current_value: number | null
          id: string
          is_completed: boolean | null
          joined_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          challenge_id: string
          completed_at?: string | null
          current_value?: number | null
          id?: string
          is_completed?: boolean | null
          joined_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          challenge_id?: string
          completed_at?: string | null
          current_value?: number | null
          id?: string
          is_completed?: boolean | null
          joined_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_challenges_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
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
      user_emails: {
        Row: {
          ai_suggested_action: string | null
          ai_summary: string | null
          body_preview: string | null
          category: string | null
          created_at: string
          from_email: string
          from_name: string | null
          gmail_labels: string[] | null
          gmail_message_id: string
          id: string
          is_important: boolean | null
          is_phishing: boolean | null
          is_read: boolean | null
          is_spam: boolean | null
          is_starred: boolean | null
          matched_contact_id: string | null
          priority_score: number | null
          received_at: string
          sentiment: string | null
          snippet: string | null
          subject: string | null
          thread_id: string | null
          threat_reason: string | null
          to_email: string | null
          updated_at: string
          user_archived: boolean | null
          user_id: string
          user_snoozed_until: string | null
        }
        Insert: {
          ai_suggested_action?: string | null
          ai_summary?: string | null
          body_preview?: string | null
          category?: string | null
          created_at?: string
          from_email: string
          from_name?: string | null
          gmail_labels?: string[] | null
          gmail_message_id: string
          id?: string
          is_important?: boolean | null
          is_phishing?: boolean | null
          is_read?: boolean | null
          is_spam?: boolean | null
          is_starred?: boolean | null
          matched_contact_id?: string | null
          priority_score?: number | null
          received_at?: string
          sentiment?: string | null
          snippet?: string | null
          subject?: string | null
          thread_id?: string | null
          threat_reason?: string | null
          to_email?: string | null
          updated_at?: string
          user_archived?: boolean | null
          user_id: string
          user_snoozed_until?: string | null
        }
        Update: {
          ai_suggested_action?: string | null
          ai_summary?: string | null
          body_preview?: string | null
          category?: string | null
          created_at?: string
          from_email?: string
          from_name?: string | null
          gmail_labels?: string[] | null
          gmail_message_id?: string
          id?: string
          is_important?: boolean | null
          is_phishing?: boolean | null
          is_read?: boolean | null
          is_spam?: boolean | null
          is_starred?: boolean | null
          matched_contact_id?: string | null
          priority_score?: number | null
          received_at?: string
          sentiment?: string | null
          snippet?: string | null
          subject?: string | null
          thread_id?: string | null
          threat_reason?: string | null
          to_email?: string | null
          updated_at?: string
          user_archived?: boolean | null
          user_id?: string
          user_snoozed_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_emails_matched_contact_id_fkey"
            columns: ["matched_contact_id"]
            isOneToOne: false
            referencedRelation: "user_contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      user_location_settings: {
        Row: {
          city: string
          country: string
          created_at: string
          id: string
          latitude: number | null
          longitude: number | null
          prayer_calculation_method: number
          show_weather: boolean
          temperature_unit: string
          timezone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          city?: string
          country?: string
          created_at?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          prayer_calculation_method?: number
          show_weather?: boolean
          temperature_unit?: string
          timezone?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          city?: string
          country?: string
          created_at?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          prayer_calculation_method?: number
          show_weather?: boolean
          temperature_unit?: string
          timezone?: string
          updated_at?: string
          user_id?: string
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
      user_properties: {
        Row: {
          address: string | null
          city: string | null
          country: string | null
          created_at: string
          current_value: number | null
          id: string
          insurance_provider: string | null
          insurance_renewal: string | null
          mortgage_amount: number | null
          mortgage_provider: string | null
          name: string
          notes: string | null
          property_type: string | null
          purchase_date: string | null
          purchase_price: number | null
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
          insurance_provider?: string | null
          insurance_renewal?: string | null
          mortgage_amount?: number | null
          mortgage_provider?: string | null
          name: string
          notes?: string | null
          property_type?: string | null
          purchase_date?: string | null
          purchase_price?: number | null
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
          insurance_provider?: string | null
          insurance_renewal?: string | null
          mortgage_amount?: number | null
          mortgage_provider?: string | null
          name?: string
          notes?: string | null
          property_type?: string | null
          purchase_date?: string | null
          purchase_price?: number | null
          updated_at?: string
          user_id?: string
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
      vehicle_records: {
        Row: {
          created_at: string
          current_mileage: number | null
          id: string
          insurance_provider: string | null
          insurance_renewal_date: string | null
          last_reminded_at: string | null
          license_plate: string | null
          make: string | null
          model: string | null
          next_inspection_date: string | null
          next_service_date: string | null
          next_tire_change_date: string | null
          nickname: string
          notes: string | null
          updated_at: string
          user_id: string
          vin: string | null
          year: number | null
        }
        Insert: {
          created_at?: string
          current_mileage?: number | null
          id?: string
          insurance_provider?: string | null
          insurance_renewal_date?: string | null
          last_reminded_at?: string | null
          license_plate?: string | null
          make?: string | null
          model?: string | null
          next_inspection_date?: string | null
          next_service_date?: string | null
          next_tire_change_date?: string | null
          nickname: string
          notes?: string | null
          updated_at?: string
          user_id: string
          vin?: string | null
          year?: number | null
        }
        Update: {
          created_at?: string
          current_mileage?: number | null
          id?: string
          insurance_provider?: string | null
          insurance_renewal_date?: string | null
          last_reminded_at?: string | null
          license_plate?: string | null
          make?: string | null
          model?: string | null
          next_inspection_date?: string | null
          next_service_date?: string | null
          next_tire_change_date?: string | null
          nickname?: string
          notes?: string | null
          updated_at?: string
          user_id?: string
          vin?: string | null
          year?: number | null
        }
        Relationships: []
      }
      vehicles: {
        Row: {
          created_at: string
          current_mileage: number | null
          id: string
          insurance_provider: string | null
          insurance_renewal: string | null
          license_plate: string | null
          make: string | null
          model: string | null
          name: string
          next_inspection_date: string | null
          next_service_date: string | null
          notes: string | null
          updated_at: string
          user_id: string
          vin: string | null
          year: number | null
        }
        Insert: {
          created_at?: string
          current_mileage?: number | null
          id?: string
          insurance_provider?: string | null
          insurance_renewal?: string | null
          license_plate?: string | null
          make?: string | null
          model?: string | null
          name: string
          next_inspection_date?: string | null
          next_service_date?: string | null
          notes?: string | null
          updated_at?: string
          user_id: string
          vin?: string | null
          year?: number | null
        }
        Update: {
          created_at?: string
          current_mileage?: number | null
          id?: string
          insurance_provider?: string | null
          insurance_renewal?: string | null
          license_plate?: string | null
          make?: string | null
          model?: string | null
          name?: string
          next_inspection_date?: string | null
          next_service_date?: string | null
          notes?: string | null
          updated_at?: string
          user_id?: string
          vin?: string | null
          year?: number | null
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
      workouts: {
        Row: {
          created_at: string
          duration_minutes: number | null
          exercises: Json | null
          felt_rating: number | null
          id: string
          notes: string | null
          user_id: string
          workout_date: string
          workout_type: string | null
        }
        Insert: {
          created_at?: string
          duration_minutes?: number | null
          exercises?: Json | null
          felt_rating?: number | null
          id?: string
          notes?: string | null
          user_id: string
          workout_date?: string
          workout_type?: string | null
        }
        Update: {
          created_at?: string
          duration_minutes?: number | null
          exercises?: Json | null
          felt_rating?: number | null
          id?: string
          notes?: string | null
          user_id?: string
          workout_date?: string
          workout_type?: string | null
        }
        Relationships: []
      }
      workspace_invite_codes: {
        Row: {
          code: string
          created_at: string
          created_by: string
          expires_at: string | null
          id: string
          max_uses: number | null
          revoked_at: string | null
          role: string
          uses: number
          workspace_id: string
        }
        Insert: {
          code: string
          created_at?: string
          created_by: string
          expires_at?: string | null
          id?: string
          max_uses?: number | null
          revoked_at?: string | null
          role?: string
          uses?: number
          workspace_id: string
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string
          expires_at?: string | null
          id?: string
          max_uses?: number | null
          revoked_at?: string | null
          role?: string
          uses?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_invite_codes_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_members: {
        Row: {
          display_name: string | null
          joined_at: string
          role: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          display_name?: string | null
          joined_at?: string
          role?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          display_name?: string | null
          joined_at?: string
          role?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          archived: boolean
          created_at: string
          description: string | null
          icon: string | null
          id: string
          name: string
          owner_id: string
          slug: string | null
          updated_at: string
        }
        Insert: {
          archived?: boolean
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name: string
          owner_id: string
          slug?: string | null
          updated_at?: string
        }
        Update: {
          archived?: boolean
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name?: string
          owner_id?: string
          slug?: string | null
          updated_at?: string
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
      is_family_agent_member: {
        Args: { _group_id: string; _user_id: string }
        Returns: boolean
      }
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
      is_superadmin: { Args: { check_user_id: string }; Returns: boolean }
      is_workspace_admin: {
        Args: { _user_id: string; _workspace_id: string }
        Returns: boolean
      }
      is_workspace_member: {
        Args: { _user_id: string; _workspace_id: string }
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
