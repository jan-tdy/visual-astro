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
      ccd_catalogs: {
        Row: {
          created_at: string
          id: string
          is_default: boolean
          name: string
          sort_order: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_default?: boolean
          name: string
          sort_order?: number
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          sort_order?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ccd_targets: {
        Row: {
          catalog_id: string
          constellation: string
          created_at: string
          dec_deg: number
          epoch_jd: number | null
          filters: string | null
          id: string
          name: string
          notes: string | null
          period_days: number | null
          ra_hours: number
          sort_order: number
          updated_at: string
          user_id: string
        }
        Insert: {
          catalog_id: string
          constellation?: string
          created_at?: string
          dec_deg?: number
          epoch_jd?: number | null
          filters?: string | null
          id?: string
          name: string
          notes?: string | null
          period_days?: number | null
          ra_hours?: number
          sort_order?: number
          updated_at?: string
          user_id?: string
        }
        Update: {
          catalog_id?: string
          constellation?: string
          created_at?: string
          dec_deg?: number
          epoch_jd?: number | null
          filters?: string | null
          id?: string
          name?: string
          notes?: string | null
          period_days?: number | null
          ra_hours?: number
          sort_order?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ccd_targets_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "ccd_catalogs"
            referencedColumns: ["id"]
          },
        ]
      }
      pozor_locations: {
        Row: {
          created_at: string
          elevation: number
          id: string
          lat: number
          lon: number
          name: string
          sort_order: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          elevation?: number
          id?: string
          lat: number
          lon: number
          name: string
          sort_order?: number
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          elevation?: number
          id?: string
          lat?: number
          lon?: number
          name?: string
          sort_order?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      observations: {
        Row: {
          a: string | null
          b: string | null
          created_at: string
          id: string
          limit_value: string | null
          note: string | null
          pasos_a: number | null
          pasos_b: number | null
          row_index: number
          session_id: string
          star_id: string
          updated_at: string
          user_id: string
          ut_time: string | null
        }
        Insert: {
          a?: string | null
          b?: string | null
          created_at?: string
          id?: string
          limit_value?: string | null
          note?: string | null
          pasos_a?: number | null
          pasos_b?: number | null
          row_index?: number
          session_id: string
          star_id: string
          updated_at?: string
          user_id: string
          ut_time?: string | null
        }
        Update: {
          a?: string | null
          b?: string | null
          created_at?: string
          id?: string
          limit_value?: string | null
          note?: string | null
          pasos_a?: number | null
          pasos_b?: number | null
          row_index?: number
          session_id?: string
          star_id?: string
          updated_at?: string
          user_id?: string
          ut_time?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "observations_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "observations_star_id_fkey"
            columns: ["star_id"]
            isOneToOne: false
            referencedRelation: "stars"
            referencedColumns: ["id"]
          },
        ]
      }
      ocr_usage: {
        Row: {
          count: number
          created_at: string
          id: string
          updated_at: string
          used_on: string
          user_id: string
        }
        Insert: {
          count?: number
          created_at?: string
          id?: string
          updated_at?: string
          used_on?: string
          user_id: string
        }
        Update: {
          count?: number
          created_at?: string
          id?: string
          updated_at?: string
          used_on?: string
          user_id?: string
        }
        Relationships: []
      }
      plus_bonuses: {
        Row: {
          created_at: string
          expires_at: string
          granted_at: string
          id: string
          milestone_key: string
          reason: string
          seen: boolean
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          granted_at?: string
          id?: string
          milestone_key: string
          reason: string
          seen?: boolean
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          granted_at?: string
          id?: string
          milestone_key?: string
          reason?: string
          seen?: boolean
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          catalog_seeded: boolean
          created_at: string
          dev_plus_override: boolean
          fecha_referencia: string
          milestone_progress: Json
          obs_code: string
          open_portal_after_export: Json
          portal_urls: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          catalog_seeded?: boolean
          created_at?: string
          dev_plus_override?: boolean
          fecha_referencia?: string
          milestone_progress?: Json
          obs_code?: string
          open_portal_after_export?: Json
          portal_urls?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          catalog_seeded?: boolean
          created_at?: string
          dev_plus_override?: boolean
          fecha_referencia?: string
          milestone_progress?: Json
          obs_code?: string
          open_portal_after_export?: Json
          portal_urls?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      sessions: {
        Row: {
          created_at: string
          id: string
          is_favorite: boolean
          jd: number | null
          name: string | null
          notes: string | null
          observed_at_utc: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_favorite?: boolean
          jd?: number | null
          name?: string | null
          notes?: string | null
          observed_at_utc?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_favorite?: boolean
          jd?: number | null
          name?: string | null
          notes?: string | null
          observed_at_utc?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      stars: {
        Row: {
          aavso_code: string | null
          chart_id: string | null
          constellation: string
          created_at: string
          id: string
          name: string
          notes: string | null
          sort_order: number
          type: Database["public"]["Enums"]["star_type"]
          updated_at: string
          user_id: string
          vsnet_code: string | null
        }
        Insert: {
          aavso_code?: string | null
          chart_id?: string | null
          constellation: string
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          sort_order?: number
          type?: Database["public"]["Enums"]["star_type"]
          updated_at?: string
          user_id: string
          vsnet_code?: string | null
        }
        Update: {
          aavso_code?: string | null
          chart_id?: string | null
          constellation?: string
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          sort_order?: number
          type?: Database["public"]["Enums"]["star_type"]
          updated_at?: string
          user_id?: string
          vsnet_code?: string | null
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean | null
          created_at: string | null
          current_period_end: string | null
          current_period_start: string | null
          environment: string
          id: string
          price_id: string
          product_id: string
          status: string
          stripe_customer_id: string
          stripe_subscription_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          price_id: string
          product_id: string
          status?: string
          stripe_customer_id: string
          stripe_subscription_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          price_id?: string
          product_id?: string
          status?: string
          stripe_customer_id?: string
          stripe_subscription_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      grant_milestone_bonus: {
        Args: { _kind: string; _user_id: string }
        Returns: undefined
      }
      has_active_bonus: { Args: { _user_id: string }; Returns: boolean }
      has_active_subscription: {
        Args: { check_env?: string; user_uuid: string }
        Returns: boolean
      }
      user_storage_bytes: { Args: { _user_id: string }; Returns: number }
      user_storage_limit_bytes: { Args: { _user_id: string }; Returns: number }
    }
    Enums: {
      star_type: "VISUAL" | "BINAR" | "ECL faint" | "ECL bright"
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
    Enums: {
      star_type: ["VISUAL", "BINAR", "ECL faint", "ECL bright"],
    },
  },
} as const
