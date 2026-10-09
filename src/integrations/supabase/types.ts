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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      absence_records: {
        Row: {
          church_id: string | null
          church_name: string | null
          created_at: string
          id: string
          member_id: string
          member_name: string
          note: string | null
          reason: string | null
          recorded_by: string | null
          service_date: string
          service_type: string
          updated_at: string
        }
        Insert: {
          church_id?: string | null
          church_name?: string | null
          created_at?: string
          id?: string
          member_id: string
          member_name: string
          note?: string | null
          reason?: string | null
          recorded_by?: string | null
          service_date: string
          service_type: string
          updated_at?: string
        }
        Update: {
          church_id?: string | null
          church_name?: string | null
          created_at?: string
          id?: string
          member_id?: string
          member_name?: string
          note?: string | null
          reason?: string | null
          recorded_by?: string | null
          service_date?: string
          service_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "absence_records_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_settings: {
        Row: {
          admin_id: string | null
          created_at: string
          id: string
          is_global: boolean | null
          setting_key: string
          setting_type: string | null
          setting_value: Json
          updated_at: string
        }
        Insert: {
          admin_id?: string | null
          created_at?: string
          id?: string
          is_global?: boolean | null
          setting_key: string
          setting_type?: string | null
          setting_value: Json
          updated_at?: string
        }
        Update: {
          admin_id?: string | null
          created_at?: string
          id?: string
          is_global?: boolean | null
          setting_key?: string
          setting_type?: string | null
          setting_value?: Json
          updated_at?: string
        }
        Relationships: []
      }
      announcements: {
        Row: {
          church_id: string | null
          created_at: string
          id: string
          message: string
          sender_id: string | null
          sender_name: string | null
          target_audience: string
          title: string
        }
        Insert: {
          church_id?: string | null
          created_at?: string
          id?: string
          message: string
          sender_id?: string | null
          sender_name?: string | null
          target_audience?: string
          title: string
        }
        Update: {
          church_id?: string | null
          created_at?: string
          id?: string
          message?: string
          sender_id?: string | null
          sender_name?: string | null
          target_audience?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcements_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcements_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      app_cron_tokens: {
        Row: {
          created_at: string
          token_hash: string
        }
        Insert: {
          created_at?: string
          token_hash: string
        }
        Update: {
          created_at?: string
          token_hash?: string
        }
        Relationships: []
      }
      attendance_records: {
        Row: {
          attendance_date: string
          check_in_method: string | null
          checked_in_at: string
          checked_in_time: string | null
          church_id: string | null
          church_name: string | null
          id: string
          leader_name: string | null
          member_id: string | null
          member_name: string
          member_role: string | null
          pcf_name: string | null
          service_type: string
          service_type_id: string | null
          status: string | null
          verified_by: string | null
        }
        Insert: {
          attendance_date?: string
          check_in_method?: string | null
          checked_in_at?: string
          checked_in_time?: string | null
          church_id?: string | null
          church_name?: string | null
          id?: string
          leader_name?: string | null
          member_id?: string | null
          member_name: string
          member_role?: string | null
          pcf_name?: string | null
          service_type: string
          service_type_id?: string | null
          status?: string | null
          verified_by?: string | null
        }
        Update: {
          attendance_date?: string
          check_in_method?: string | null
          checked_in_at?: string
          checked_in_time?: string | null
          church_id?: string | null
          church_name?: string | null
          id?: string
          leader_name?: string | null
          member_id?: string | null
          member_name?: string
          member_role?: string | null
          pcf_name?: string | null
          service_type?: string
          service_type_id?: string | null
          status?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_records_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_service_type_id_fkey"
            columns: ["service_type_id"]
            isOneToOne: false
            referencedRelation: "service_types"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor: string
          category: string | null
          church_id: string | null
          church_name: string | null
          created_at: string
          icon: string | null
          id: number
        }
        Insert: {
          action: string
          actor: string
          category?: string | null
          church_id?: string | null
          church_name?: string | null
          created_at?: string
          icon?: string | null
          id?: number
        }
        Update: {
          action?: string
          actor?: string
          category?: string | null
          church_id?: string | null
          church_name?: string | null
          created_at?: string
          icon?: string | null
          id?: number
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
        ]
      }
      cell_reports: {
        Row: {
          cell_attendance: Json
          cell_name: string | null
          church_id: string | null
          church_name: string
          created_at: string
          evangelism: Json
          id: string
          leader_id: string | null
          leader_name: string
          outreach_centre: string | null
          report_date: string
          report_grid: Json
          souls_won_list: Json
          submitted_by: string | null
          sunday_register: Json
          total_attendance: number
          total_first_timers: number
          total_offering: number
          total_souls_won: number
          updated_at: string
        }
        Insert: {
          cell_attendance?: Json
          cell_name?: string | null
          church_id?: string | null
          church_name: string
          created_at?: string
          evangelism?: Json
          id?: string
          leader_id?: string | null
          leader_name: string
          outreach_centre?: string | null
          report_date?: string
          report_grid?: Json
          souls_won_list?: Json
          submitted_by?: string | null
          sunday_register?: Json
          total_attendance?: number
          total_first_timers?: number
          total_offering?: number
          total_souls_won?: number
          updated_at?: string
        }
        Update: {
          cell_attendance?: Json
          cell_name?: string | null
          church_id?: string | null
          church_name?: string
          created_at?: string
          evangelism?: Json
          id?: string
          leader_id?: string | null
          leader_name?: string
          outreach_centre?: string | null
          report_date?: string
          report_grid?: Json
          souls_won_list?: Json
          submitted_by?: string | null
          sunday_register?: Json
          total_attendance?: number
          total_first_timers?: number
          total_offering?: number
          total_souls_won?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cell_reports_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cell_reports_leader_id_fkey"
            columns: ["leader_id"]
            isOneToOne: false
            referencedRelation: "leaders"
            referencedColumns: ["id"]
          },
        ]
      }
      church_admin_accounts: {
        Row: {
          admin_email: string
          admin_name: string
          admin_phone: string | null
          admin_verified: boolean
          church_id: string | null
          church_name: string
          created_at: string
          id: string
          joined_date: string | null
          password: string | null
          photo_url: string | null
          role: string | null
          status: string | null
          zone: string | null
        }
        Insert: {
          admin_email: string
          admin_name: string
          admin_phone?: string | null
          admin_verified?: boolean
          church_id?: string | null
          church_name: string
          created_at?: string
          id: string
          joined_date?: string | null
          password?: string | null
          photo_url?: string | null
          role?: string | null
          status?: string | null
          zone?: string | null
        }
        Update: {
          admin_email?: string
          admin_name?: string
          admin_phone?: string | null
          admin_verified?: boolean
          church_id?: string | null
          church_name?: string
          created_at?: string
          id?: string
          joined_date?: string | null
          password?: string | null
          photo_url?: string | null
          role?: string | null
          status?: string | null
          zone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "church_admin_accounts_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
        ]
      }
      church_report_codes: {
        Row: {
          church_id: string | null
          church_name: string
          code_hash: string
          code_hint: string | null
          created_at: string
          created_by: string | null
          id: string
          updated_at: string
        }
        Insert: {
          church_id?: string | null
          church_name: string
          code_hash: string
          code_hint?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          updated_at?: string
        }
        Update: {
          church_id?: string | null
          church_name?: string
          code_hash?: string
          code_hint?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "church_report_codes_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
        ]
      }
      churches: {
        Row: {
          created_at: string
          id: string
          members_count: number
          name: string
          pastor_name: string
          status: string
          updated_at: string
          zone: string
        }
        Insert: {
          created_at?: string
          id?: string
          members_count?: number
          name: string
          pastor_name?: string
          status?: string
          updated_at?: string
          zone?: string
        }
        Update: {
          created_at?: string
          id?: string
          members_count?: number
          name?: string
          pastor_name?: string
          status?: string
          updated_at?: string
          zone?: string
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      email_verification_tokens: {
        Row: {
          created_at: string
          email: string
          expires_at: string
          id: string
          token_hash: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          expires_at: string
          id?: string
          token_hash: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          token_hash?: string
          used_at?: string | null
        }
        Relationships: []
      }
      leaders: {
        Row: {
          cell_or_pcf_name: string | null
          church_id: string | null
          church_name: string | null
          contact: string | null
          created_at: string
          dob: string | null
          downstream_count: number
          email: string | null
          full_name: string
          id: string
          is_appointed: boolean | null
          leader_code: string | null
          leader_type: Database["public"]["Enums"]["leader_type_enum"]
          location: string | null
          parent_leader_id: string | null
          photo_url: string | null
          promotion_status: Database["public"]["Enums"]["promotion_status_enum"]
          updated_at: string
        }
        Insert: {
          cell_or_pcf_name?: string | null
          church_id?: string | null
          church_name?: string | null
          contact?: string | null
          created_at?: string
          dob?: string | null
          downstream_count?: number
          email?: string | null
          full_name: string
          id?: string
          is_appointed?: boolean | null
          leader_code?: string | null
          leader_type?: Database["public"]["Enums"]["leader_type_enum"]
          location?: string | null
          parent_leader_id?: string | null
          photo_url?: string | null
          promotion_status?: Database["public"]["Enums"]["promotion_status_enum"]
          updated_at?: string
        }
        Update: {
          cell_or_pcf_name?: string | null
          church_id?: string | null
          church_name?: string | null
          contact?: string | null
          created_at?: string
          dob?: string | null
          downstream_count?: number
          email?: string | null
          full_name?: string
          id?: string
          is_appointed?: boolean | null
          leader_code?: string | null
          leader_type?: Database["public"]["Enums"]["leader_type_enum"]
          location?: string | null
          parent_leader_id?: string | null
          photo_url?: string | null
          promotion_status?: Database["public"]["Enums"]["promotion_status_enum"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leaders_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leaders_parent_leader_id_fkey"
            columns: ["parent_leader_id"]
            isOneToOne: false
            referencedRelation: "leaders"
            referencedColumns: ["id"]
          },
        ]
      }
      login_otps: {
        Row: {
          attempts: number
          code_hash: string
          created_at: string
          email: string
          expires_at: string
          id: string
        }
        Insert: {
          attempts?: number
          code_hash: string
          created_at?: string
          email: string
          expires_at: string
          id?: string
        }
        Update: {
          attempts?: number
          code_hash?: string
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
        }
        Relationships: []
      }
      members: {
        Row: {
          church_id: string | null
          church_name: string | null
          created_at: string
          dob: string | null
          education_level: string | null
          email: string | null
          foundation_class: number
          full_name: string
          gender: string | null
          id: string
          invited_by_leader_id: string | null
          invited_by_name: string | null
          join_date: string
          location: string | null
          marital_status: string | null
          occupation: string | null
          phone: string | null
          photo_url: string | null
          role: string | null
          service_count: number
          status: Database["public"]["Enums"]["member_status_enum"]
          updated_at: string
        }
        Insert: {
          church_id?: string | null
          church_name?: string | null
          created_at?: string
          dob?: string | null
          education_level?: string | null
          email?: string | null
          foundation_class?: number
          full_name: string
          gender?: string | null
          id: string
          invited_by_leader_id?: string | null
          invited_by_name?: string | null
          join_date?: string
          location?: string | null
          marital_status?: string | null
          occupation?: string | null
          phone?: string | null
          photo_url?: string | null
          role?: string | null
          service_count?: number
          status?: Database["public"]["Enums"]["member_status_enum"]
          updated_at?: string
        }
        Update: {
          church_id?: string | null
          church_name?: string | null
          created_at?: string
          dob?: string | null
          education_level?: string | null
          email?: string | null
          foundation_class?: number
          full_name?: string
          gender?: string | null
          id?: string
          invited_by_leader_id?: string | null
          invited_by_name?: string | null
          join_date?: string
          location?: string | null
          marital_status?: string | null
          occupation?: string | null
          phone?: string | null
          photo_url?: string | null
          role?: string | null
          service_count?: number
          status?: Database["public"]["Enums"]["member_status_enum"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "members_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "members_invited_by_leader_id_fkey"
            columns: ["invited_by_leader_id"]
            isOneToOne: false
            referencedRelation: "leaders"
            referencedColumns: ["id"]
          },
        ]
      }
      password_reset_tokens: {
        Row: {
          created_at: string
          email: string
          expires_at: string
          id: string
          token_hash: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          expires_at: string
          id?: string
          token_hash: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          token_hash?: string
          used_at?: string | null
        }
        Relationships: []
      }
      portal_sessions: {
        Row: {
          church_id: string | null
          church_name: string | null
          created_at: string
          expires_at: string
          id: string
          role: string
          token_hash: string
          user_email: string | null
          user_name: string | null
        }
        Insert: {
          church_id?: string | null
          church_name?: string | null
          created_at?: string
          expires_at: string
          id?: string
          role: string
          token_hash: string
          user_email?: string | null
          user_name?: string | null
        }
        Update: {
          church_id?: string | null
          church_name?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          role?: string
          token_hash?: string
          user_email?: string | null
          user_name?: string | null
        }
        Relationships: []
      }
      promotion_queue: {
        Row: {
          church_id: string | null
          church_name: string | null
          current_leader_role: Database["public"]["Enums"]["leader_type_enum"]
          flagged_at: string
          id: string
          leader_id: string | null
          member_id: string | null
          member_name: string | null
          reason: string
          requested_by: string | null
          status: string
          target_role: Database["public"]["Enums"]["leader_type_enum"]
        }
        Insert: {
          church_id?: string | null
          church_name?: string | null
          current_leader_role?: Database["public"]["Enums"]["leader_type_enum"]
          flagged_at?: string
          id?: string
          leader_id?: string | null
          member_id?: string | null
          member_name?: string | null
          reason: string
          requested_by?: string | null
          status?: string
          target_role: Database["public"]["Enums"]["leader_type_enum"]
        }
        Update: {
          church_id?: string | null
          church_name?: string | null
          current_leader_role?: Database["public"]["Enums"]["leader_type_enum"]
          flagged_at?: string
          id?: string
          leader_id?: string | null
          member_id?: string | null
          member_name?: string | null
          reason?: string
          requested_by?: string | null
          status?: string
          target_role?: Database["public"]["Enums"]["leader_type_enum"]
        }
        Relationships: [
          {
            foreignKeyName: "promotion_queue_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promotion_queue_leader_id_fkey"
            columns: ["leader_id"]
            isOneToOne: false
            referencedRelation: "leaders"
            referencedColumns: ["id"]
          },
        ]
      }
      qr_tokens: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          is_used: boolean | null
          member_id: string | null
          token_hash: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          is_used?: boolean | null
          member_id?: string | null
          token_hash: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          is_used?: boolean | null
          member_id?: string | null
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "qr_tokens_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      request_rate_limits: {
        Row: {
          bucket_key: string
          request_count: number
          updated_at: string
          window_started_at: string
        }
        Insert: {
          bucket_key: string
          request_count?: number
          updated_at?: string
          window_started_at?: string
        }
        Update: {
          bucket_key?: string
          request_count?: number
          updated_at?: string
          window_started_at?: string
        }
        Relationships: []
      }
      service_types: {
        Row: {
          church_id: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean | null
          is_global: boolean | null
          late_after_minutes: number
          name: string
          start_time: string | null
          updated_at: string
        }
        Insert: {
          church_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_global?: boolean | null
          late_after_minutes?: number
          name: string
          start_time?: string | null
          updated_at?: string
        }
        Update: {
          church_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_global?: boolean | null
          late_after_minutes?: number
          name?: string
          start_time?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_types_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
        ]
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          admin_verified: boolean | null
          auth_user_id: string | null
          avatar_url: string | null
          church_id: string | null
          church_name: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          is_church_admin: boolean | null
          password_hash: string
          phone: string | null
          role: Database["public"]["Enums"]["user_role_enum"]
          updated_at: string
          username: string
          zone: string | null
        }
        Insert: {
          admin_verified?: boolean | null
          auth_user_id?: string | null
          avatar_url?: string | null
          church_id?: string | null
          church_name?: string | null
          created_at?: string
          email: string
          full_name: string
          id?: string
          is_church_admin?: boolean | null
          password_hash: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role_enum"]
          updated_at?: string
          username: string
          zone?: string | null
        }
        Update: {
          admin_verified?: boolean | null
          auth_user_id?: string | null
          avatar_url?: string | null
          church_id?: string | null
          church_name?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          is_church_admin?: boolean | null
          password_hash?: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role_enum"]
          updated_at?: string
          username?: string
          zone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_profiles_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      apply_leader_growth_rules: { Args: never; Returns: undefined }
      confirm_leader_promotion: {
        Args: { p_promotion_id: string }
        Returns: boolean
      }
      consume_rate_limit: {
        Args: {
          p_bucket_key: string
          p_max_requests: number
          p_window_seconds: number
        }
        Returns: {
          allowed: boolean
          retry_after_seconds: number
        }[]
      }
      delete_church_cascade: { Args: { p_church_id: string }; Returns: boolean }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      delete_leader_cascade: { Args: { p_leader_id: string }; Returns: boolean }
      delete_member_cascade: { Args: { p_member_id: string }; Returns: boolean }
      email_queue_dispatch: { Args: never; Returns: undefined }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      verify_user_login: {
        Args: {
          p_church_name?: string
          p_identifier: string
          p_password: string
          p_role?: string
        }
        Returns: Json
      }
    }
    Enums: {
      leader_type_enum:
        | "BSCT"
        | "Cell Leader"
        | "PCF Leader"
        | "Church Coordinator"
      member_status_enum: "First Timer" | "General Member" | "Alumni"
      promotion_status_enum: "None" | "Flagged" | "Confirmed"
      user_role_enum:
        | "Superadmin"
        | "Church Admin"
        | "Leader"
        | "Usher"
        | "Church Pastor"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      leader_type_enum: [
        "BSCT",
        "Cell Leader",
        "PCF Leader",
        "Church Coordinator",
      ],
      member_status_enum: ["First Timer", "General Member", "Alumni"],
      promotion_status_enum: ["None", "Flagged", "Confirmed"],
      user_role_enum: [
        "Superadmin",
        "Church Admin",
        "Leader",
        "Usher",
        "Church Pastor",
      ],
    },
  },
} as const
