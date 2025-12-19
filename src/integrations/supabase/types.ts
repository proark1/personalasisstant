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
      contracts: {
        Row: {
          auto_renews: boolean | null
          cancellation_notice_days: number | null
          category: string
          contract_number: string | null
          cost_amount: number | null
          cost_frequency: string | null
          created_at: string | null
          document_url: string | null
          end_date: string | null
          id: string
          is_active: boolean | null
          name: string
          notes: string | null
          provider: string | null
          renewal_date: string | null
          start_date: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          auto_renews?: boolean | null
          cancellation_notice_days?: number | null
          category?: string
          contract_number?: string | null
          cost_amount?: number | null
          cost_frequency?: string | null
          created_at?: string | null
          document_url?: string | null
          end_date?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          notes?: string | null
          provider?: string | null
          renewal_date?: string | null
          start_date?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          auto_renews?: boolean | null
          cancellation_notice_days?: number | null
          category?: string
          contract_number?: string | null
          cost_amount?: number | null
          cost_frequency?: string | null
          created_at?: string | null
          document_url?: string | null
          end_date?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          notes?: string | null
          provider?: string | null
          renewal_date?: string | null
          start_date?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      direct_messages: {
        Row: {
          attachments: Json | null
          content: string
          created_at: string
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
      family_members: {
        Row: {
          activities: Json | null
          address: string | null
          allergies: string[] | null
          avatar_url: string | null
          birth_date: string | null
          clothing_sizes: Json | null
          created_at: string
          email: string | null
          id: string
          is_active: boolean | null
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
          avatar_url?: string | null
          birth_date?: string | null
          clothing_sizes?: Json | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean | null
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
          avatar_url?: string | null
          birth_date?: string | null
          clothing_sizes?: Json | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean | null
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
          group_id: string
          id: string
          reactions: Json | null
          sender_id: string
        }
        Insert: {
          attachments?: Json | null
          content?: string
          created_at?: string
          group_id: string
          id?: string
          reactions?: Json | null
          sender_id: string
        }
        Update: {
          attachments?: Json | null
          content?: string
          created_at?: string
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
          name?: string
          reminder_time?: string | null
          target_count?: number
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
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          businesses: string[] | null
          created_at: string
          display_name: string | null
          email: string | null
          goals: string | null
          id: string
          interests: string[] | null
          location_city: string | null
          location_country: string | null
          preferred_work_hours: string | null
          role: string | null
          skills: string[] | null
          timezone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          businesses?: string[] | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          goals?: string | null
          id?: string
          interests?: string[] | null
          location_city?: string | null
          location_country?: string | null
          preferred_work_hours?: string | null
          role?: string | null
          skills?: string[] | null
          timezone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          businesses?: string[] | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          goals?: string | null
          id?: string
          interests?: string[] | null
          location_city?: string | null
          location_country?: string | null
          preferred_work_hours?: string | null
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
          space_member_id: string
          updated_at: string
        }
        Insert: {
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
          space_member_id: string
          updated_at?: string
        }
        Update: {
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
      user_contacts: {
        Row: {
          business_level: string | null
          city: string | null
          company: string | null
          contact_frequency_days: number | null
          contact_type: string
          contact_user_id: string | null
          country: string | null
          created_at: string
          email: string | null
          id: string
          last_contacted_at: string | null
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
          business_level?: string | null
          city?: string | null
          company?: string | null
          contact_frequency_days?: number | null
          contact_type?: string
          contact_user_id?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          id?: string
          last_contacted_at?: string | null
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
          business_level?: string | null
          city?: string | null
          company?: string | null
          contact_frequency_days?: number | null
          contact_type?: string
          contact_user_id?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          id?: string
          last_contacted_at?: string | null
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
