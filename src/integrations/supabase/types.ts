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
      [_ in never]: never
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
