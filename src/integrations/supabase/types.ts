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
      activity_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_type: string | null
          event_type: string
          id: string
          ip_address: unknown
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          event_type: string
          id?: string
          ip_address?: unknown
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          event_type?: string
          id?: string
          ip_address?: unknown
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      agent_settings: {
        Row: {
          company_logo_url: string | null
          created_at: string
          digital_signature_url: string | null
          email_template: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          company_logo_url?: string | null
          created_at?: string
          digital_signature_url?: string | null
          email_template?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          company_logo_url?: string | null
          created_at?: string
          digital_signature_url?: string | null
          email_template?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      api_key_user_mapping: {
        Row: {
          api_key_id: string
          created_at: string | null
          id: string
          user_id: string
        }
        Insert: {
          api_key_id: string
          created_at?: string | null
          id?: string
          user_id: string
        }
        Update: {
          api_key_id?: string
          created_at?: string | null
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_key_user_mapping_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: true
            referencedRelation: "api_keys"
            referencedColumns: ["id"]
          },
        ]
      }
      api_keys: {
        Row: {
          created_at: string | null
          created_by: string | null
          expires_at: string | null
          id: string
          is_active: boolean
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          name: string
          partner_email: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          name: string
          partner_email?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          name?: string
          partner_email?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "api_keys_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      api_logs: {
        Row: {
          api_key_id: string | null
          api_key_masked: string | null
          created_at: string | null
          endpoint: string | null
          error_message: string | null
          id: string
          ip_address: string | null
          method: string | null
          practice_id: string | null
          request_body_size: number | null
          source: string | null
          status_code: number | null
        }
        Insert: {
          api_key_id?: string | null
          api_key_masked?: string | null
          created_at?: string | null
          endpoint?: string | null
          error_message?: string | null
          id?: string
          ip_address?: string | null
          method?: string | null
          practice_id?: string | null
          request_body_size?: number | null
          source?: string | null
          status_code?: number | null
        }
        Update: {
          api_key_id?: string | null
          api_key_masked?: string | null
          created_at?: string | null
          endpoint?: string | null
          error_message?: string | null
          id?: string
          ip_address?: string | null
          method?: string | null
          practice_id?: string | null
          request_body_size?: number | null
          source?: string | null
          status_code?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "api_logs_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "api_keys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "api_logs_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "practices"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          actor_role: string | null
          at: string
          changed_keys: string[] | null
          details: Json | null
          id: number
          ip: string | null
          new_data: Json | null
          old_data: Json | null
          row_id: string | null
          source: string
          table_name: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_role?: string | null
          at?: string
          changed_keys?: string[] | null
          details?: Json | null
          id?: number
          ip?: string | null
          new_data?: Json | null
          old_data?: Json | null
          row_id?: string | null
          source?: string
          table_name?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_role?: string | null
          at?: string
          changed_keys?: string[] | null
          details?: Json | null
          id?: number
          ip?: string | null
          new_data?: Json | null
          old_data?: Json | null
          row_id?: string | null
          source?: string
          table_name?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      clients: {
        Row: {
          address_city: string | null
          address_country: string | null
          address_postal_code: string | null
          address_province: string | null
          address_street: string | null
          company_name: string | null
          created_at: string
          email: string | null
          first_name: string
          full_name: string | null
          id: string
          last_name: string
          mobile: string | null
          notes: string | null
          phone: string | null
          tax_code: string | null
          updated_at: string
          user_id: string
          vat_number: string | null
        }
        Insert: {
          address_city?: string | null
          address_country?: string | null
          address_postal_code?: string | null
          address_province?: string | null
          address_street?: string | null
          company_name?: string | null
          created_at?: string
          email?: string | null
          first_name: string
          full_name?: string | null
          id?: string
          last_name: string
          mobile?: string | null
          notes?: string | null
          phone?: string | null
          tax_code?: string | null
          updated_at?: string
          user_id: string
          vat_number?: string | null
        }
        Update: {
          address_city?: string | null
          address_country?: string | null
          address_postal_code?: string | null
          address_province?: string | null
          address_street?: string | null
          company_name?: string | null
          created_at?: string
          email?: string | null
          first_name?: string
          full_name?: string | null
          id?: string
          last_name?: string
          mobile?: string | null
          notes?: string | null
          phone?: string | null
          tax_code?: string | null
          updated_at?: string
          user_id?: string
          vat_number?: string | null
        }
        Relationships: []
      }
      email_logs: {
        Row: {
          delivery_detail: string | null
          delivery_updated_at: string | null
          provider: string | null
          created_at: string
          error_message: string | null
          id: string
          notification_id: string | null
          notification_type: string | null
          practice_id: string | null
          recipient_email: string
          recipient_name: string | null
          resend_email_id: string | null
          status: string
          subject: string | null
          template_used: string | null
        }
        Insert: {
          delivery_detail?: string | null
          delivery_updated_at?: string | null
          provider?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          notification_id?: string | null
          notification_type?: string | null
          practice_id?: string | null
          recipient_email: string
          recipient_name?: string | null
          resend_email_id?: string | null
          status: string
          subject?: string | null
          template_used?: string | null
        }
        Update: {
          delivery_detail?: string | null
          delivery_updated_at?: string | null
          provider?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          notification_id?: string | null
          notification_type?: string | null
          practice_id?: string | null
          recipient_email?: string
          recipient_name?: string | null
          resend_email_id?: string | null
          status?: string
          subject?: string | null
          template_used?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_logs_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "expiry_notifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_logs_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "practices"
            referencedColumns: ["id"]
          },
        ]
      }
      email_suppressions: {
        Row: {
          detail: string | null
          email: string
          first_at: string
          hits: number
          last_at: string
          reason: string
          source: string
        }
        Insert: {
          detail?: string | null
          email: string
          first_at?: string
          hits?: number
          last_at?: string
          reason: string
          source?: string
        }
        Update: {
          detail?: string | null
          email?: string
          first_at?: string
          hits?: number
          last_at?: string
          reason?: string
          source?: string
        }
        Relationships: []
      }
      expiry_notifications: {
        Row: {
          created_at: string | null
          email_sent: boolean | null
          email_sent_at: string | null
          id: string
          notification_date: string
          notification_type: string
          practice_id: string
          sent: boolean | null
          sent_at: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email_sent?: boolean | null
          email_sent_at?: string | null
          id?: string
          notification_date: string
          notification_type: string
          practice_id: string
          sent?: boolean | null
          sent_at?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email_sent?: boolean | null
          email_sent_at?: string | null
          id?: string
          notification_date?: string
          notification_type?: string
          practice_id?: string
          sent?: boolean | null
          sent_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expiry_notifications_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "practices"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_events: {
        Row: {
          created_at: string
          direction: string
          error: string | null
          event_type: string
          external_event_id: string | null
          id: string
          payload: Json
          portal_id: string
          practice_id: string | null
          processed_at: string | null
          status: string
        }
        Insert: {
          created_at?: string
          direction: string
          error?: string | null
          event_type: string
          external_event_id?: string | null
          id?: string
          payload?: Json
          portal_id: string
          practice_id?: string | null
          processed_at?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          direction?: string
          error?: string | null
          event_type?: string
          external_event_id?: string | null
          id?: string
          payload?: Json
          portal_id?: string
          practice_id?: string | null
          processed_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "integration_events_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "practices"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          message: string
          practice_id: string
          read: boolean
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          practice_id: string
          read?: boolean
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          practice_id?: string
          read?: boolean
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "practices"
            referencedColumns: ["id"]
          },
        ]
      }
      outbound_deliveries: {
        Row: {
          alerted_at: string | null
          attempts: number
          created_at: string
          delivered_at: string | null
          event_id: string
          event_type: string
          id: string
          last_error: string | null
          last_http_status: number | null
          next_attempt_at: string
          payload: Json
          practice_id: string | null
          status: string
          target_id: string
          target_kind: string
          target_label: string | null
        }
        Insert: {
          alerted_at?: string | null
          attempts?: number
          created_at?: string
          delivered_at?: string | null
          event_id?: string
          event_type: string
          id?: string
          last_error?: string | null
          last_http_status?: number | null
          next_attempt_at?: string
          payload: Json
          practice_id?: string | null
          status?: string
          target_id: string
          target_kind: string
          target_label?: string | null
        }
        Update: {
          alerted_at?: string | null
          attempts?: number
          created_at?: string
          delivered_at?: string | null
          event_id?: string
          event_type?: string
          id?: string
          last_error?: string | null
          last_http_status?: number | null
          next_attempt_at?: string
          payload?: Json
          practice_id?: string | null
          status?: string
          target_id?: string
          target_kind?: string
          target_label?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "outbound_deliveries_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "practices"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_webhooks: {
        Row: {
          active: boolean
          api_key_id: string
          created_at: string
          secret: string
          updated_at: string
          url: string
        }
        Insert: {
          active?: boolean
          api_key_id: string
          created_at?: string
          secret: string
          updated_at?: string
          url: string
        }
        Update: {
          active?: boolean
          api_key_id?: string
          created_at?: string
          secret?: string
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_webhooks_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: true
            referencedRelation: "api_keys"
            referencedColumns: ["id"]
          },
        ]
      }
      practice_documents: {
        Row: {
          created_at: string
          document_type: string | null
          file_name: string
          file_path: string
          file_size: number
          id: string
          mime_type: string
          practice_id: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          document_type?: string | null
          file_name: string
          file_path: string
          file_size: number
          id?: string
          mime_type: string
          practice_id: string
          uploaded_by: string
        }
        Update: {
          created_at?: string
          document_type?: string | null
          file_name?: string
          file_path?: string
          file_size?: number
          id?: string
          mime_type?: string
          practice_id?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "practice_documents_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "practices"
            referencedColumns: ["id"]
          },
        ]
      }
      practice_events: {
        Row: {
          created_at: string
          created_by: string
          description: string
          event_type: string
          id: string
          practice_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description: string
          event_type: string
          id?: string
          practice_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string
          event_type?: string
          id?: string
          practice_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "practice_events_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "practices"
            referencedColumns: ["id"]
          },
        ]
      }
      practice_workflow: {
        Row: {
          info_due_date: string | null
          info_overdue_notified_at: string | null
          info_reminded_at: string | null
          info_requested_at: string | null
          deliberated_at: string | null
          deliberation_note: string | null
          issued_at: string | null
          payment_due_date: string | null
          practice_id: string
          rejected_at: string | null
          rejection_reason: string | null
          sent_at: string | null
          source_portal: string | null
          source_reference: string | null
          target_portal: string | null
          target_reference: string | null
          updated_at: string
        }
        Insert: {
          info_due_date?: string | null
          info_overdue_notified_at?: string | null
          info_reminded_at?: string | null
          info_requested_at?: string | null
          deliberated_at?: string | null
          deliberation_note?: string | null
          issued_at?: string | null
          payment_due_date?: string | null
          practice_id: string
          rejected_at?: string | null
          rejection_reason?: string | null
          sent_at?: string | null
          source_portal?: string | null
          source_reference?: string | null
          target_portal?: string | null
          target_reference?: string | null
          updated_at?: string
        }
        Update: {
          info_due_date?: string | null
          info_overdue_notified_at?: string | null
          info_reminded_at?: string | null
          info_requested_at?: string | null
          deliberated_at?: string | null
          deliberation_note?: string | null
          issued_at?: string | null
          payment_due_date?: string | null
          practice_id?: string
          rejected_at?: string | null
          rejection_reason?: string | null
          sent_at?: string | null
          source_portal?: string | null
          source_reference?: string | null
          target_portal?: string | null
          target_reference?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "practice_workflow_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: true
            referencedRelation: "practices"
            referencedColumns: ["id"]
          },
        ]
      }
      practices: {
        Row: {
          api_key_id: string | null
          beneficiary: string | null
          client_email: string
          client_id: string | null
          client_name: string
          client_phone: string
          commission_amount: number | null
          commission_percentage: number | null
          commission_received_date: string | null
          created_at: string
          financial_status:
            | Database["public"]["Enums"]["financial_status"]
            | null
          id: string
          notes: string | null
          owner_tax_code: string | null
          payment_date: string | null
          pet_microchip: string | null
          policy_end_date: string | null
          policy_number: string | null
          policy_start_date: string | null
          practice_number: string
          practice_type: Database["public"]["Enums"]["practice_type"]
          premium_gross: number | null
          premium_net: number | null
          premium_taxable: number | null
          premium_taxes: number | null
          status: Database["public"]["Enums"]["practice_status"]
          updated_at: string
          user_id: string
          vies_batch_id: string | null
        }
        Insert: {
          api_key_id?: string | null
          beneficiary?: string | null
          client_email: string
          client_id?: string | null
          client_name: string
          client_phone: string
          commission_amount?: number | null
          commission_percentage?: number | null
          commission_received_date?: string | null
          created_at?: string
          financial_status?:
            | Database["public"]["Enums"]["financial_status"]
            | null
          id?: string
          notes?: string | null
          owner_tax_code?: string | null
          payment_date?: string | null
          pet_microchip?: string | null
          policy_end_date?: string | null
          policy_number?: string | null
          policy_start_date?: string | null
          practice_number?: string
          practice_type: Database["public"]["Enums"]["practice_type"]
          premium_gross?: number | null
          premium_net?: number | null
          premium_taxable?: number | null
          premium_taxes?: number | null
          status?: Database["public"]["Enums"]["practice_status"]
          updated_at?: string
          user_id: string
          vies_batch_id?: string | null
        }
        Update: {
          api_key_id?: string | null
          beneficiary?: string | null
          client_email?: string
          client_id?: string | null
          client_name?: string
          client_phone?: string
          commission_amount?: number | null
          commission_percentage?: number | null
          commission_received_date?: string | null
          created_at?: string
          financial_status?:
            | Database["public"]["Enums"]["financial_status"]
            | null
          id?: string
          notes?: string | null
          owner_tax_code?: string | null
          payment_date?: string | null
          pet_microchip?: string | null
          policy_end_date?: string | null
          policy_number?: string | null
          policy_start_date?: string | null
          practice_number?: string
          practice_type?: Database["public"]["Enums"]["practice_type"]
          premium_gross?: number | null
          premium_net?: number | null
          premium_taxable?: number | null
          premium_taxes?: number | null
          status?: Database["public"]["Enums"]["practice_status"]
          updated_at?: string
          user_id?: string
          vies_batch_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "practices_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "api_keys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "practices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          address: string | null
          avatar_url: string | null
          commission_bonus_tiers: Json
          created_at: string
          date_format: string | null
          default_commission_percentage: number | null
          email: string | null
          email_notifications: Json | null
          full_name: string | null
          id: string
          language: string | null
          phone: string | null
          theme: string | null
          timezone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          avatar_url?: string | null
          commission_bonus_tiers?: Json
          created_at?: string
          date_format?: string | null
          default_commission_percentage?: number | null
          email?: string | null
          email_notifications?: Json | null
          full_name?: string | null
          id: string
          language?: string | null
          phone?: string | null
          theme?: string | null
          timezone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          avatar_url?: string | null
          commission_bonus_tiers?: Json
          created_at?: string
          date_format?: string | null
          default_commission_percentage?: number | null
          email?: string | null
          email_notifications?: Json | null
          full_name?: string | null
          id?: string
          language?: string | null
          phone?: string | null
          theme?: string | null
          timezone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      security_flags: {
        Row: {
          enabled: boolean
          key: string
          only_users: string[] | null
          updated_at: string
        }
        Insert: {
          enabled?: boolean
          key: string
          only_users?: string[] | null
          updated_at?: string
        }
        Update: {
          enabled?: boolean
          key?: string
          only_users?: string[] | null
          updated_at?: string
        }
        Relationships: []
      }
      system_settings: {
        Row: {
          created_at: string
          default_date_format: string | null
          default_language: string | null
          default_timezone: string | null
          id: string
          lockout_duration_minutes: number | null
          max_login_attempts: number | null
          password_min_length: number | null
          password_require_numbers: boolean | null
          password_require_uppercase: boolean | null
          portal_logo_url: string | null
          portal_name: string
          sender_email: string | null
          sender_name: string | null
          session_timeout_minutes: number | null
          storage_limit_per_user_gb: number | null
          support_email: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_date_format?: string | null
          default_language?: string | null
          default_timezone?: string | null
          id?: string
          lockout_duration_minutes?: number | null
          max_login_attempts?: number | null
          password_min_length?: number | null
          password_require_numbers?: boolean | null
          password_require_uppercase?: boolean | null
          portal_logo_url?: string | null
          portal_name?: string
          sender_email?: string | null
          sender_name?: string | null
          session_timeout_minutes?: number | null
          storage_limit_per_user_gb?: number | null
          support_email?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_date_format?: string | null
          default_language?: string | null
          default_timezone?: string | null
          id?: string
          lockout_duration_minutes?: number | null
          max_login_attempts?: number | null
          password_min_length?: number | null
          password_require_numbers?: boolean | null
          password_require_uppercase?: boolean | null
          portal_logo_url?: string | null
          portal_name?: string
          sender_email?: string | null
          sender_name?: string | null
          session_timeout_minutes?: number | null
          storage_limit_per_user_gb?: number | null
          support_email?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      user_notification_settings: {
        Row: {
          documents: boolean
          new_practice: boolean
          notes: boolean
          notification_emails: string[]
          status_change: boolean
          updated_at: string
          updated_by: string | null
          user_id: string
        }
        Insert: {
          documents?: boolean
          new_practice?: boolean
          notes?: boolean
          notification_emails?: string[]
          status_change?: boolean
          updated_at?: string
          updated_by?: string | null
          user_id: string
        }
        Update: {
          documents?: boolean
          new_practice?: boolean
          notes?: boolean
          notification_emails?: string[]
          status_change?: boolean
          updated_at?: string
          updated_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_notification_settings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_product_permissions: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          practice_type: Database["public"]["Enums"]["practice_type"]
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          practice_type: Database["public"]["Enums"]["practice_type"]
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          practice_type?: Database["public"]["Enums"]["practice_type"]
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          parent_agent_id: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          parent_agent_id?: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          parent_agent_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vies_batch_documents: {
        Row: {
          batch_id: string
          created_at: string
          depth: number
          file_extension: string | null
          file_name: string
          file_path: string
          file_size: number
          id: string
          is_nested_zip: boolean
          nome_zip: string | null
          practice_id: string | null
          requirement_matches: string[]
          row_number: number | null
          status: string
          user_id: string
          zip_file_name: string | null
        }
        Insert: {
          batch_id: string
          created_at?: string
          depth?: number
          file_extension?: string | null
          file_name: string
          file_path: string
          file_size?: number
          id?: string
          is_nested_zip?: boolean
          nome_zip?: string | null
          practice_id?: string | null
          requirement_matches?: string[]
          row_number?: number | null
          status?: string
          user_id: string
          zip_file_name?: string | null
        }
        Update: {
          batch_id?: string
          created_at?: string
          depth?: number
          file_extension?: string | null
          file_name?: string
          file_path?: string
          file_size?: number
          id?: string
          is_nested_zip?: boolean
          nome_zip?: string | null
          practice_id?: string | null
          requirement_matches?: string[]
          row_number?: number | null
          status?: string
          user_id?: string
          zip_file_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vies_batch_documents_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "vies_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vies_batch_documents_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "practices"
            referencedColumns: ["id"]
          },
        ]
      }
      vies_batches: {
        Row: {
          blocked_jobs: number
          cancelled_jobs: number
          commission_percentage: number | null
          commissions_received_at: string | null
          completed_at: string | null
          completed_jobs: number
          created_at: string
          excel_storage_path: string | null
          failed_jobs: number
          fiscal_representative_id: string | null
          id: string
          last_worker_message: string | null
          last_worker_run_at: string | null
          lot_number: number | null
          matched_requirements: number
          missing_requirements: Json
          name: string
          notes: string | null
          paid_at: string | null
          processing_jobs: number
          processing_started_at: string | null
          queued_at: string | null
          queued_jobs: number
          ready_jobs: number
          source_excel_file_name: string | null
          source_zip_file_name: string | null
          statement_generated_at: string | null
          status: string
          target_portal: string | null
          total_documents: number
          total_rows: number
          updated_at: string
          user_id: string
          withholding_percentage: number | null
          zip_storage_path: string | null
        }
        Insert: {
          blocked_jobs?: number
          cancelled_jobs?: number
          commission_percentage?: number | null
          commissions_received_at?: string | null
          completed_at?: string | null
          completed_jobs?: number
          created_at?: string
          excel_storage_path?: string | null
          failed_jobs?: number
          fiscal_representative_id?: string | null
          id?: string
          last_worker_message?: string | null
          last_worker_run_at?: string | null
          lot_number?: number | null
          matched_requirements?: number
          missing_requirements?: Json
          name: string
          notes?: string | null
          paid_at?: string | null
          processing_jobs?: number
          processing_started_at?: string | null
          queued_at?: string | null
          queued_jobs?: number
          ready_jobs?: number
          source_excel_file_name?: string | null
          source_zip_file_name?: string | null
          statement_generated_at?: string | null
          status?: string
          target_portal?: string | null
          total_documents?: number
          total_rows?: number
          updated_at?: string
          user_id: string
          withholding_percentage?: number | null
          zip_storage_path?: string | null
        }
        Update: {
          blocked_jobs?: number
          cancelled_jobs?: number
          commission_percentage?: number | null
          commissions_received_at?: string | null
          completed_at?: string | null
          completed_jobs?: number
          created_at?: string
          excel_storage_path?: string | null
          failed_jobs?: number
          fiscal_representative_id?: string | null
          id?: string
          last_worker_message?: string | null
          last_worker_run_at?: string | null
          lot_number?: number | null
          matched_requirements?: number
          missing_requirements?: Json
          name?: string
          notes?: string | null
          paid_at?: string | null
          processing_jobs?: number
          processing_started_at?: string | null
          queued_at?: string | null
          queued_jobs?: number
          ready_jobs?: number
          source_excel_file_name?: string | null
          source_zip_file_name?: string | null
          statement_generated_at?: string | null
          status?: string
          target_portal?: string | null
          total_documents?: number
          total_rows?: number
          updated_at?: string
          user_id?: string
          withholding_percentage?: number | null
          zip_storage_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vies_batches_fiscal_representative_id_fkey"
            columns: ["fiscal_representative_id"]
            isOneToOne: false
            referencedRelation: "vies_fiscal_representatives"
            referencedColumns: ["id"]
          },
        ]
      }
      vies_fiscal_representatives: {
        Row: {
          address: string | null
          administrator_name: string | null
          administrator_tax_code: string | null
          created_at: string
          id: string
          name: string
          pec: string | null
          tax_code: string
          updated_at: string
          user_id: string
          visura_reference: string | null
          visura_storage_path: string | null
        }
        Insert: {
          address?: string | null
          administrator_name?: string | null
          administrator_tax_code?: string | null
          created_at?: string
          id?: string
          name: string
          pec?: string | null
          tax_code: string
          updated_at?: string
          user_id?: string
          visura_reference?: string | null
          visura_storage_path?: string | null
        }
        Update: {
          address?: string | null
          administrator_name?: string | null
          administrator_tax_code?: string | null
          created_at?: string
          id?: string
          name?: string
          pec?: string | null
          tax_code?: string
          updated_at?: string
          user_id?: string
          visura_reference?: string | null
          visura_storage_path?: string | null
        }
        Relationships: []
      }
      vies_intake_lots: {
        Row: {
          api_key_id: string | null
          batch_id: string | null
          created_at: string
          expected_rows: number | null
          files: Json
          fiscal_representative_name: string | null
          fiscal_representative_tax_code: string | null
          id: string
          notes: string | null
          owner_user_id: string
          processed_at: string | null
          received_at: string | null
          rejected_reason: string | null
          source_portal: string
          source_reference: string
          status: string
          updated_at: string
        }
        Insert: {
          api_key_id?: string | null
          batch_id?: string | null
          created_at?: string
          expected_rows?: number | null
          files?: Json
          fiscal_representative_name?: string | null
          fiscal_representative_tax_code?: string | null
          id?: string
          notes?: string | null
          owner_user_id: string
          processed_at?: string | null
          received_at?: string | null
          rejected_reason?: string | null
          source_portal: string
          source_reference: string
          status?: string
          updated_at?: string
        }
        Update: {
          api_key_id?: string | null
          batch_id?: string | null
          created_at?: string
          expected_rows?: number | null
          files?: Json
          fiscal_representative_name?: string | null
          fiscal_representative_tax_code?: string | null
          id?: string
          notes?: string | null
          owner_user_id?: string
          processed_at?: string | null
          received_at?: string | null
          rejected_reason?: string | null
          source_portal?: string
          source_reference?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vies_intake_lots_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "vies_batches"
            referencedColumns: ["id"]
          },
        ]
      }
      vies_jobs: {
        Row: {
          agent_result: Json
          assigned_agent: string | null
          attempts: number
          batch_id: string
          beneficiario: string | null
          completed_at: string | null
          contraente: string | null
          created_at: string
          documenti_indicati: string | null
          error_code: string | null
          external_reference: string | null
          failed_at: string | null
          id: string
          indirizzo_beneficiario: string | null
          indirizzo_rappresentante_fiscale: string | null
          last_error: string | null
          last_heartbeat_at: string | null
          locked_at: string | null
          locked_by: string | null
          max_attempts: number
          next_attempt_at: string
          nome_zip: string | null
          pagamento: string | null
          partita_iva_beneficiario: string | null
          partita_iva_contraente: string | null
          pec: string | null
          pec_beneficiario: string | null
          priority: number
          processed_at: string | null
          processing_started_at: string | null
          progressivo: string | null
          raw_payload: Json
          reconciliation_errors: Json
          row_number: number
          status: string
          updated_at: string
          user_id: string
          validation_errors: Json
          zip_file_name: string | null
        }
        Insert: {
          agent_result?: Json
          assigned_agent?: string | null
          attempts?: number
          batch_id: string
          beneficiario?: string | null
          completed_at?: string | null
          contraente?: string | null
          created_at?: string
          documenti_indicati?: string | null
          error_code?: string | null
          external_reference?: string | null
          failed_at?: string | null
          id?: string
          indirizzo_beneficiario?: string | null
          indirizzo_rappresentante_fiscale?: string | null
          last_error?: string | null
          last_heartbeat_at?: string | null
          locked_at?: string | null
          locked_by?: string | null
          max_attempts?: number
          next_attempt_at?: string
          nome_zip?: string | null
          pagamento?: string | null
          partita_iva_beneficiario?: string | null
          partita_iva_contraente?: string | null
          pec?: string | null
          pec_beneficiario?: string | null
          priority?: number
          processed_at?: string | null
          processing_started_at?: string | null
          progressivo?: string | null
          raw_payload?: Json
          reconciliation_errors?: Json
          row_number: number
          status?: string
          updated_at?: string
          user_id: string
          validation_errors?: Json
          zip_file_name?: string | null
        }
        Update: {
          agent_result?: Json
          assigned_agent?: string | null
          attempts?: number
          batch_id?: string
          beneficiario?: string | null
          completed_at?: string | null
          contraente?: string | null
          created_at?: string
          documenti_indicati?: string | null
          error_code?: string | null
          external_reference?: string | null
          failed_at?: string | null
          id?: string
          indirizzo_beneficiario?: string | null
          indirizzo_rappresentante_fiscale?: string | null
          last_error?: string | null
          last_heartbeat_at?: string | null
          locked_at?: string | null
          locked_by?: string | null
          max_attempts?: number
          next_attempt_at?: string
          nome_zip?: string | null
          pagamento?: string | null
          partita_iva_beneficiario?: string | null
          partita_iva_contraente?: string | null
          pec?: string | null
          pec_beneficiario?: string | null
          priority?: number
          processed_at?: string | null
          processing_started_at?: string | null
          progressivo?: string | null
          raw_payload?: Json
          reconciliation_errors?: Json
          row_number?: number
          status?: string
          updated_at?: string
          user_id?: string
          validation_errors?: Json
          zip_file_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vies_jobs_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "vies_batches"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      auth_user_for_email: {
        Args: { p_email: string }
        Returns: {
          banned: boolean
          id: string
          last_sign_in_at: string
          recovery_sent_at: string
        }[]
      }
      block_vies_job: {
        Args: { p_error_code?: string; p_job_id: string; p_reason: string }
        Returns: {
          agent_result: Json
          assigned_agent: string | null
          attempts: number
          batch_id: string
          beneficiario: string | null
          completed_at: string | null
          contraente: string | null
          created_at: string
          documenti_indicati: string | null
          error_code: string | null
          external_reference: string | null
          failed_at: string | null
          id: string
          indirizzo_beneficiario: string | null
          indirizzo_rappresentante_fiscale: string | null
          last_error: string | null
          last_heartbeat_at: string | null
          locked_at: string | null
          locked_by: string | null
          max_attempts: number
          next_attempt_at: string
          nome_zip: string | null
          pagamento: string | null
          partita_iva_beneficiario: string | null
          partita_iva_contraente: string | null
          pec: string | null
          pec_beneficiario: string | null
          priority: number
          processed_at: string | null
          processing_started_at: string | null
          progressivo: string | null
          raw_payload: Json
          reconciliation_errors: Json
          row_number: number
          status: string
          updated_at: string
          user_id: string
          validation_errors: Json
          zip_file_name: string | null
        }
        SetofOptions: {
          from: "*"
          to: "vies_jobs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      can_view_practice: {
        Args: { _practice_user_id: string; _user_id: string }
        Returns: boolean
      }
      cancel_vies_batch: {
        Args: { p_batch_id: string; p_reason?: string }
        Returns: {
          blocked_jobs: number
          cancelled_jobs: number
          commission_percentage: number | null
          commissions_received_at: string | null
          completed_at: string | null
          completed_jobs: number
          created_at: string
          excel_storage_path: string | null
          failed_jobs: number
          fiscal_representative_id: string | null
          id: string
          last_worker_message: string | null
          last_worker_run_at: string | null
          lot_number: number | null
          matched_requirements: number
          missing_requirements: Json
          name: string
          notes: string | null
          paid_at: string | null
          processing_jobs: number
          processing_started_at: string | null
          queued_at: string | null
          queued_jobs: number
          ready_jobs: number
          source_excel_file_name: string | null
          source_zip_file_name: string | null
          statement_generated_at: string | null
          status: string
          target_portal: string | null
          total_documents: number
          total_rows: number
          updated_at: string
          user_id: string
          withholding_percentage: number | null
          zip_storage_path: string | null
        }
        SetofOptions: {
          from: "*"
          to: "vies_batches"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      claim_vies_jobs: {
        Args: {
          p_limit?: number
          p_lock_timeout_minutes?: number
          p_worker_id: string
        }
        Returns: {
          agent_result: Json
          assigned_agent: string | null
          attempts: number
          batch_id: string
          beneficiario: string | null
          completed_at: string | null
          contraente: string | null
          created_at: string
          documenti_indicati: string | null
          error_code: string | null
          external_reference: string | null
          failed_at: string | null
          id: string
          indirizzo_beneficiario: string | null
          indirizzo_rappresentante_fiscale: string | null
          last_error: string | null
          last_heartbeat_at: string | null
          locked_at: string | null
          locked_by: string | null
          max_attempts: number
          next_attempt_at: string
          nome_zip: string | null
          pagamento: string | null
          partita_iva_beneficiario: string | null
          partita_iva_contraente: string | null
          pec: string | null
          pec_beneficiario: string | null
          priority: number
          processed_at: string | null
          processing_started_at: string | null
          progressivo: string | null
          raw_payload: Json
          reconciliation_errors: Json
          row_number: number
          status: string
          updated_at: string
          user_id: string
          validation_errors: Json
          zip_file_name: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "vies_jobs"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      complete_vies_job: {
        Args: {
          p_agent_result?: Json
          p_external_reference?: string
          p_job_id: string
          p_worker_id: string
        }
        Returns: {
          agent_result: Json
          assigned_agent: string | null
          attempts: number
          batch_id: string
          beneficiario: string | null
          completed_at: string | null
          contraente: string | null
          created_at: string
          documenti_indicati: string | null
          error_code: string | null
          external_reference: string | null
          failed_at: string | null
          id: string
          indirizzo_beneficiario: string | null
          indirizzo_rappresentante_fiscale: string | null
          last_error: string | null
          last_heartbeat_at: string | null
          locked_at: string | null
          locked_by: string | null
          max_attempts: number
          next_attempt_at: string
          nome_zip: string | null
          pagamento: string | null
          partita_iva_beneficiario: string | null
          partita_iva_contraente: string | null
          pec: string | null
          pec_beneficiario: string | null
          priority: number
          processed_at: string | null
          processing_started_at: string | null
          progressivo: string | null
          raw_payload: Json
          reconciliation_errors: Json
          row_number: number
          status: string
          updated_at: string
          user_id: string
          validation_errors: Json
          zip_file_name: string | null
        }
        SetofOptions: {
          from: "*"
          to: "vies_jobs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      enforce_mfa_on_request: { Args: never; Returns: undefined }
      enqueue_vies_batch: {
        Args: { p_batch_id: string }
        Returns: {
          blocked_jobs: number
          cancelled_jobs: number
          commission_percentage: number | null
          commissions_received_at: string | null
          completed_at: string | null
          completed_jobs: number
          created_at: string
          excel_storage_path: string | null
          failed_jobs: number
          fiscal_representative_id: string | null
          id: string
          last_worker_message: string | null
          last_worker_run_at: string | null
          lot_number: number | null
          matched_requirements: number
          missing_requirements: Json
          name: string
          notes: string | null
          paid_at: string | null
          processing_jobs: number
          processing_started_at: string | null
          queued_at: string | null
          queued_jobs: number
          ready_jobs: number
          source_excel_file_name: string | null
          source_zip_file_name: string | null
          statement_generated_at: string | null
          status: string
          target_portal: string | null
          total_documents: number
          total_rows: number
          updated_at: string
          user_id: string
          withholding_percentage: number | null
          zip_storage_path: string | null
        }
        SetofOptions: {
          from: "*"
          to: "vies_batches"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      fail_vies_job: {
        Args: {
          p_agent_result?: Json
          p_error_code?: string
          p_error_message: string
          p_job_id: string
          p_retry_delay_seconds?: number
          p_worker_id: string
        }
        Returns: {
          agent_result: Json
          assigned_agent: string | null
          attempts: number
          batch_id: string
          beneficiario: string | null
          completed_at: string | null
          contraente: string | null
          created_at: string
          documenti_indicati: string | null
          error_code: string | null
          external_reference: string | null
          failed_at: string | null
          id: string
          indirizzo_beneficiario: string | null
          indirizzo_rappresentante_fiscale: string | null
          last_error: string | null
          last_heartbeat_at: string | null
          locked_at: string | null
          locked_by: string | null
          max_attempts: number
          next_attempt_at: string
          nome_zip: string | null
          pagamento: string | null
          partita_iva_beneficiario: string | null
          partita_iva_contraente: string | null
          pec: string | null
          pec_beneficiario: string | null
          priority: number
          processed_at: string | null
          processing_started_at: string | null
          progressivo: string | null
          raw_payload: Json
          reconciliation_errors: Json
          row_number: number
          status: string
          updated_at: string
          user_id: string
          validation_errors: Json
          zip_file_name: string | null
        }
        SetofOptions: {
          from: "*"
          to: "vies_jobs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      generate_expiry_notifications: {
        Args: { p_practice_id: string }
        Returns: undefined
      }
      generate_practice_number: { Args: never; Returns: string }
      get_all_users_with_details: {
        Args: never
        Returns: {
          agent_name: string
          avatar_url: string
          commission_bonus_tiers: Json
          default_commission_percentage: number
          email: string
          full_name: string
          id: string
          phone: string
          practice_count: number
          role: string
        }[]
      }
      get_dashboard_kpis: {
        Args: { p_period?: string }
        Returns: {
          active_agents: number
          avg_premium: number
          conversion_rate: number
          current_period_commission: number
          current_period_practices: number
          current_period_premium: number
          expiring_soon: number
          growth_commission: number
          growth_practices: number
          growth_premium: number
          previous_period_commission: number
          previous_period_practices: number
          previous_period_premium: number
        }[]
      }
      get_effective_commission_percentage: {
        Args: {
          p_current_premium?: number
          p_exclude_practice_id?: string
          p_reference_date?: string
          p_user_id: string
        }
        Returns: number
      }
      get_financial_summary: {
        Args: { user_uuid: string }
        Returns: {
          incassate_commission: number
          incassate_count: number
          non_incassate_amount: number
          non_incassate_count: number
          provvigioni_ricevute_amount: number
          provvigioni_ricevute_count: number
          total_commission_amount: number
          total_practices: number
          total_premium_amount: number
        }[]
      }
      get_hierarchical_financial_summary: {
        Args: { requesting_user_id: string; target_user_id?: string }
        Returns: {
          incassate_commission: number
          incassate_count: number
          non_incassate_amount: number
          non_incassate_count: number
          provvigioni_ricevute_amount: number
          provvigioni_ricevute_count: number
          total_commission_amount: number
          total_practices: number
          total_premium_amount: number
        }[]
      }
      get_hierarchical_practices: {
        Args: { requesting_user_id: string; target_user_id?: string }
        Returns: {
          client_name: string
          commission_amount: number
          commission_percentage: number
          commission_received_date: string
          created_at: string
          financial_status: string
          id: string
          payment_date: string
          practice_number: string
          practice_type: string
          premium_gross: number
          premium_net: number
          premium_taxable: number
          premium_taxes: number
          user_full_name: string
          user_id: string
          user_role: string
        }[]
      }
      get_hierarchical_user_ids: {
        Args: { requesting_user_id: string }
        Returns: {
          full_name: string
          role: string
          user_id: string
        }[]
      }
      get_parent_agent: { Args: { _user_id: string }; Returns: string }
      get_pending_email_notifications: {
        Args: never
        Returns: {
          agent_email: string
          agent_name: string
          agent_phone: string
          client_email: string
          client_name: string
          days_until_expiry: number
          notification_date: string
          notification_id: string
          notification_type: string
          policy_end_date: string
          practice_id: string
          practice_number: string
          practice_type: string
        }[]
      }
      get_practice_id_from_path: { Args: { path: string }; Returns: string }
      get_practice_lots: {
        Args: { p_batch_ids?: string[]; p_limit?: number }
        Returns: {
          batch_id: string
          created_at: string
          fiscal_representative_name: string
          lot_number: number
          name: string
          practice_count: number
        }[]
      }
      get_production_details: {
        Args: {
          p_agent_id?: string
          p_end_date: string
          p_practice_type?: string
          p_start_date: string
          p_status?: string
        }
        Returns: {
          client_name: string
          commission_amount: number
          created_at: string
          policy_end_date: string
          policy_number: string
          policy_start_date: string
          practice_number: string
          practice_type: string
          premium_gross: number
          status: string
        }[]
      }
      get_production_stats: {
        Args: { p_agent_id?: string; p_end_date: string; p_start_date: string }
        Returns: {
          avg_premium: number
          practices_by_month: Json
          practices_by_status: Json
          practices_by_type: Json
          top_agents: Json
          total_commission: number
          total_practices: number
          total_premium: number
        }[]
      }
      get_upcoming_expiries: {
        Args: {
          p_days_ahead?: number
          p_practice_type?: string
          p_user_id: string
        }
        Returns: {
          client_email: string
          client_name: string
          client_phone: string
          days_until_expiry: number
          notification_30_sent: boolean
          notification_60_sent: boolean
          notification_7_sent: boolean
          notification_90_sent: boolean
          policy_end_date: string
          practice_id: string
          practice_number: string
          practice_type: string
          user_full_name: string
          user_id: string
        }[]
      }
      get_user_allowed_practice_types: {
        Args: { _user_id: string }
        Returns: {
          practice_type: Database["public"]["Enums"]["practice_type"]
        }[]
      }
      has_product_permission: {
        Args: {
          _practice_type: Database["public"]["Enums"]["practice_type"]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin_or_service: { Args: never; Returns: boolean }
      is_service_role: { Args: never; Returns: boolean }
      log_email_sent: {
        Args: {
          p_error_message?: string
          p_notification_id: string
          p_notification_type: string
          p_practice_id: string
          p_recipient_email: string
          p_recipient_name: string
          p_resend_email_id: string
          p_status: string
          p_subject: string
          p_template_used: string
        }
        Returns: string
      }
      mark_email_notification_sent: {
        Args: { p_notification_id: string }
        Returns: undefined
      }
      mark_notification_sent: {
        Args: {
          p_email_sent?: boolean
          p_notification_type: string
          p_practice_id: string
        }
        Returns: undefined
      }
      mfa_required_for_user: { Args: { p_user_id: string }; Returns: boolean }
      mfa_satisfied: { Args: never; Returns: boolean }
      refresh_vies_batch_counters: {
        Args: { p_batch_id: string }
        Returns: {
          blocked_jobs: number
          cancelled_jobs: number
          commission_percentage: number | null
          commissions_received_at: string | null
          completed_at: string | null
          completed_jobs: number
          created_at: string
          excel_storage_path: string | null
          failed_jobs: number
          fiscal_representative_id: string | null
          id: string
          last_worker_message: string | null
          last_worker_run_at: string | null
          lot_number: number | null
          matched_requirements: number
          missing_requirements: Json
          name: string
          notes: string | null
          paid_at: string | null
          processing_jobs: number
          processing_started_at: string | null
          queued_at: string | null
          queued_jobs: number
          ready_jobs: number
          source_excel_file_name: string | null
          source_zip_file_name: string | null
          statement_generated_at: string | null
          status: string
          target_portal: string | null
          total_documents: number
          total_rows: number
          updated_at: string
          user_id: string
          withholding_percentage: number | null
          zip_storage_path: string | null
        }
        SetofOptions: {
          from: "*"
          to: "vies_batches"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      report_scope_user_ids: { Args: never; Returns: string[] }
      retry_vies_job: {
        Args: { p_job_id: string }
        Returns: {
          agent_result: Json
          assigned_agent: string | null
          attempts: number
          batch_id: string
          beneficiario: string | null
          completed_at: string | null
          contraente: string | null
          created_at: string
          documenti_indicati: string | null
          error_code: string | null
          external_reference: string | null
          failed_at: string | null
          id: string
          indirizzo_beneficiario: string | null
          indirizzo_rappresentante_fiscale: string | null
          last_error: string | null
          last_heartbeat_at: string | null
          locked_at: string | null
          locked_by: string | null
          max_attempts: number
          next_attempt_at: string
          nome_zip: string | null
          pagamento: string | null
          partita_iva_beneficiario: string | null
          partita_iva_contraente: string | null
          pec: string | null
          pec_beneficiario: string | null
          priority: number
          processed_at: string | null
          processing_started_at: string | null
          progressivo: string | null
          raw_payload: Json
          reconciliation_errors: Json
          row_number: number
          status: string
          updated_at: string
          user_id: string
          validation_errors: Json
          zip_file_name: string | null
        }
        SetofOptions: {
          from: "*"
          to: "vies_jobs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      app_role: "admin" | "agente" | "collaboratore"
      financial_status: "non_incassata" | "incassata" | "provvigioni_ricevute"
      practice_status:
        | "in_lavorazione"
        | "in_attesa"
        | "approvata"
        | "rifiutata"
        | "completata"
        | "integrazioni"
      practice_type:
        | "auto"
        | "casa"
        | "vita"
        | "salute"
        | "responsabilita"
        | "altro"
        | "fidejussioni"
        | "car"
        | "postuma_decennale"
        | "all_risk"
        | "responsabilita_civile"
        | "pet"
        | "fotovoltaico"
        | "catastrofali"
        | "azienda"
        | "risparmio"
        | "vies"
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
      app_role: ["admin", "agente", "collaboratore"],
      financial_status: ["non_incassata", "incassata", "provvigioni_ricevute"],
      practice_status: [
        "in_lavorazione",
        "in_attesa",
        "approvata",
        "rifiutata",
        "completata",
        "integrazioni",
      ],
      practice_type: [
        "auto",
        "casa",
        "vita",
        "salute",
        "responsabilita",
        "altro",
        "fidejussioni",
        "car",
        "postuma_decennale",
        "all_risk",
        "responsabilita_civile",
        "pet",
        "fotovoltaico",
        "catastrofali",
        "azienda",
        "risparmio",
        "vies",
      ],
    },
  },
} as const
