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
    PostgrestVersion: "14.4"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      business_details: {
        Row: {
          abn: string
          account_number: string
          address: string
          bsb: string
          business_name: string
          email: string
          id: string
          include_super_in_totals: boolean
          name: string
          suburb: string
          super_fund: string
          super_fund_abn: string
          super_member_number: string
          super_usi: string
          user_id: string
        }
        Insert: {
          abn?: string
          account_number?: string
          address?: string
          bsb?: string
          business_name?: string
          email?: string
          id?: string
          include_super_in_totals?: boolean
          name?: string
          suburb?: string
          super_fund?: string
          super_fund_abn?: string
          super_member_number?: string
          super_usi?: string
          user_id: string
        }
        Update: {
          abn?: string
          account_number?: string
          address?: string
          bsb?: string
          business_name?: string
          email?: string
          id?: string
          include_super_in_totals?: boolean
          name?: string
          suburb?: string
          super_fund?: string
          super_fund_abn?: string
          super_member_number?: string
          super_usi?: string
          user_id?: string
        }
        Relationships: []
      }
      client_workflow_rates: {
        Row: {
          client_id: string
          id: string
          incentive_rate_per_sku: number
          is_flat_bonus: boolean
          kpi: number
          max_bonus: number
          upper_limit_skus: number
          workflow: string
        }
        Insert: {
          client_id: string
          id?: string
          incentive_rate_per_sku: number
          is_flat_bonus?: boolean
          kpi: number
          max_bonus?: number
          upper_limit_skus: number
          workflow: string
        }
        Update: {
          client_id?: string
          id?: string
          incentive_rate_per_sku?: number
          is_flat_bonus?: boolean
          kpi?: number
          max_bonus?: number
          upper_limit_skus?: number
          workflow?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_workflow_rates_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          abn: string | null
          address: string
          billing_type: Database["public"]["Enums"]["billing_type"]
          color: string | null
          contact_name: string | null
          created_at: string
          default_finish_time: string | null
          default_start_time: string | null
          email: string
          entry_label: string | null
          id: string
          invoice_frequency: Database["public"]["Enums"]["invoice_frequency"]
          is_active: boolean
          name: string
          notes: string | null
          pays_super: boolean
          rate_full_day: number | null
          rate_half_day: number | null
          rate_hourly: number | null
          rate_hourly_operator: number | null
          rate_hourly_photographer: number | null
          show_role: boolean
          show_super_on_invoice: boolean
          suburb: string
          super_rate: number
          user_id: string
        }
        Insert: {
          abn?: string | null
          address?: string
          billing_type: Database["public"]["Enums"]["billing_type"]
          color?: string | null
          contact_name?: string | null
          created_at?: string
          default_finish_time?: string | null
          default_start_time?: string | null
          email?: string
          entry_label?: string | null
          id?: string
          invoice_frequency?: Database["public"]["Enums"]["invoice_frequency"]
          is_active?: boolean
          name: string
          notes?: string | null
          pays_super?: boolean
          rate_full_day?: number | null
          rate_half_day?: number | null
          rate_hourly?: number | null
          rate_hourly_operator?: number | null
          rate_hourly_photographer?: number | null
          show_role?: boolean
          show_super_on_invoice?: boolean
          suburb?: string
          super_rate?: number
          user_id: string
        }
        Update: {
          abn?: string | null
          address?: string
          billing_type?: Database["public"]["Enums"]["billing_type"]
          color?: string | null
          contact_name?: string | null
          created_at?: string
          default_finish_time?: string | null
          default_start_time?: string | null
          email?: string
          entry_label?: string | null
          id?: string
          invoice_frequency?: Database["public"]["Enums"]["invoice_frequency"]
          is_active?: boolean
          name?: string
          notes?: string | null
          pays_super?: boolean
          rate_full_day?: number | null
          rate_half_day?: number | null
          rate_hourly?: number | null
          rate_hourly_operator?: number | null
          rate_hourly_photographer?: number | null
          show_role?: boolean
          show_super_on_invoice?: boolean
          suburb?: string
          super_rate?: number
          user_id?: string
        }
        Relationships: []
      }
      entries: {
        Row: {
          base_amount: number
          billing_type_snapshot: Database["public"]["Enums"]["billing_type"]
          bonus_amount: number
          brand: string | null
          break_minutes: number | null
          client_id: string
          created_at: string
          date: string
          day_type: Database["public"]["Enums"]["day_type"] | null
          description: string | null
          finish_time: string | null
          hours_worked: number | null
          id: string
          invoice_id: string | null
          role: string | null
          shoot_client: string | null
          skus: number | null
          start_time: string | null
          super_amount: number
          total_amount: number
          user_id: string
          workflow_type: string | null
        }
        Insert: {
          base_amount?: number
          billing_type_snapshot: Database["public"]["Enums"]["billing_type"]
          bonus_amount?: number
          brand?: string | null
          break_minutes?: number | null
          client_id: string
          created_at?: string
          date: string
          day_type?: Database["public"]["Enums"]["day_type"] | null
          description?: string | null
          finish_time?: string | null
          hours_worked?: number | null
          id?: string
          invoice_id?: string | null
          role?: string | null
          shoot_client?: string | null
          skus?: number | null
          start_time?: string | null
          super_amount?: number
          total_amount?: number
          user_id: string
          workflow_type?: string | null
        }
        Update: {
          base_amount?: number
          billing_type_snapshot?: Database["public"]["Enums"]["billing_type"]
          bonus_amount?: number
          brand?: string | null
          break_minutes?: number | null
          client_id?: string
          created_at?: string
          date?: string
          day_type?: Database["public"]["Enums"]["day_type"] | null
          description?: string | null
          finish_time?: string | null
          hours_worked?: number | null
          id?: string
          invoice_id?: string | null
          role?: string | null
          shoot_client?: string | null
          skus?: number | null
          start_time?: string | null
          super_amount?: number
          total_amount?: number
          user_id?: string
          workflow_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "entries_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_entries_invoice"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          category: Database["public"]["Enums"]["expense_category"]
          created_at: string
          date: string
          description: string
          gst_included: boolean
          id: string
          invoice_id: string | null
          is_billable: boolean
          notes: string | null
          receipt_path: string | null
          user_id: string
        }
        Insert: {
          amount: number
          category: Database["public"]["Enums"]["expense_category"]
          created_at?: string
          date: string
          description: string
          gst_included?: boolean
          id?: string
          invoice_id?: string | null
          is_billable?: boolean
          notes?: string | null
          receipt_path?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          category?: Database["public"]["Enums"]["expense_category"]
          created_at?: string
          date?: string
          description?: string
          gst_included?: boolean
          id?: string
          invoice_id?: string | null
          is_billable?: boolean
          notes?: string | null
          receipt_path?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_line_items: {
        Row: {
          amount: number
          created_at: string
          description: string
          id: string
          invoice_id: string
          quantity: number | null
          sort_order: number
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          description: string
          id?: string
          invoice_id: string
          quantity?: number | null
          sort_order?: number
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string
          id?: string
          invoice_id?: string
          quantity?: number | null
          sort_order?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_line_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_sequence: {
        Row: {
          due_date_offset: number
          id: string
          invoice_prefix: string
          last_number: number
          user_id: string
        }
        Insert: {
          due_date_offset?: number
          id?: string
          invoice_prefix?: string
          last_number: number
          user_id: string
        }
        Update: {
          due_date_offset?: number
          id?: string
          invoice_prefix?: string
          last_number?: number
          user_id?: string
        }
        Relationships: []
      }
      invoices: {
        Row: {
          client_id: string
          created_at: string
          due_date: string | null
          id: string
          invoice_number: string
          issued_date: string | null
          notes: string | null
          paid_date: string | null
          status: Database["public"]["Enums"]["invoice_status"]
          subtotal: number
          super_amount: number
          total: number
          user_id: string
        }
        Insert: {
          client_id: string
          created_at?: string
          due_date?: string | null
          id?: string
          invoice_number: string
          issued_date?: string | null
          notes?: string | null
          paid_date?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number
          super_amount?: number
          total?: number
          user_id: string
        }
        Update: {
          client_id?: string
          created_at?: string
          due_date?: string | null
          id?: string
          invoice_number?: string
          issued_date?: string | null
          notes?: string | null
          paid_date?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number
          super_amount?: number
          total?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      user_preferences: {
        Row: {
          bcc_self: boolean
          mark_as_issued_on_send: boolean
          user_id: string
        }
        Insert: {
          bcc_self?: boolean
          mark_as_issued_on_send?: boolean
          user_id: string
        }
        Update: {
          bcc_self?: boolean
          mark_as_issued_on_send?: boolean
          user_id?: string
        }
        Relationships: []
      }
      scheduled_emails: {
        Row: {
          bcc_address: string | null
          body_text: string
          cc_address: string | null
          created_at: string
          error: string | null
          filename: string
          id: string
          invoice_id: string | null
          mark_issued: boolean
          scheduled_for: string
          sent_at: string | null
          status: string
          subject: string
          to_address: string
          user_id: string
        }
        Insert: {
          bcc_address?: string | null
          body_text: string
          cc_address?: string | null
          created_at?: string
          error?: string | null
          filename: string
          id?: string
          invoice_id?: string | null
          mark_issued?: boolean
          scheduled_for: string
          sent_at?: string | null
          status?: string
          subject: string
          to_address: string
          user_id: string
        }
        Update: {
          bcc_address?: string | null
          body_text?: string
          cc_address?: string | null
          created_at?: string
          error?: string | null
          filename?: string
          id?: string
          invoice_id?: string | null
          mark_issued?: boolean
          scheduled_for?: string
          sent_at?: string | null
          status?: string
          subject?: string
          to_address?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_emails_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      next_invoice_number: { Args: never; Returns: number }
      next_invoice_number_for_user: {
        Args: { p_user_id: string }
        Returns: number
      }
      uninvoiced_group_count: { Args: { p_user_id: string }; Returns: number }
    }
    Enums: {
      billing_type: "day_rate" | "hourly" | "manual"
      day_type: "full" | "half"
      expense_category:
        | "gear"
        | "gear_consumable"
        | "gear_hire"
        | "lab"
        | "education"
        | "software"
        | "travel"
        | "other"
        | "office"
      invoice_frequency: "weekly" | "per_job"
      invoice_status: "draft" | "issued" | "paid"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      billing_type: ["day_rate", "hourly", "manual"],
      day_type: ["full", "half"],
      expense_category: [
        "gear",
        "gear_consumable",
        "gear_hire",
        "lab",
        "education",
        "software",
        "travel",
        "other",
        "office",
      ],
      invoice_frequency: ["weekly", "per_job"],
      invoice_status: ["draft", "issued", "paid"],
    },
  },
} as const
