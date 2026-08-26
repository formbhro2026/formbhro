export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15";
  };
  public: {
    Tables: {
      activity_logs: {
        Row: {
          action: string;
          actor_id: string | null;
          actor_role: Database["public"]["Enums"]["app_role"] | null;
          created_at: string;
          id: string;
          label: string | null;
          meta: Json;
          request_id: string | null;
        };
        Insert: {
          action: string;
          actor_id?: string | null;
          actor_role?: Database["public"]["Enums"]["app_role"] | null;
          created_at?: string;
          id?: string;
          label?: string | null;
          meta?: Json;
          request_id?: string | null;
        };
        Update: {
          action?: string;
          actor_id?: string | null;
          actor_role?: Database["public"]["Enums"]["app_role"] | null;
          created_at?: string;
          id?: string;
          label?: string | null;
          meta?: Json;
          request_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "activity_logs_request_id_fkey";
            columns: ["request_id"];
            isOneToOne: false;
            referencedRelation: "requests";
            referencedColumns: ["id"];
          },
        ];
      };
      device_tokens: {
        Row: {
          id: string;
          user_id: string;
          device_id: string;
          platform: string;
          fcm_token: string;
          created_at: string;
          updated_at: string;
          last_seen_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          device_id: string;
          platform?: string;
          fcm_token: string;
          created_at?: string;
          updated_at?: string;
          last_seen_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          device_id?: string;
          platform?: string;
          fcm_token?: string;
          created_at?: string;
          updated_at?: string;
          last_seen_at?: string;
        };
        Relationships: [];
      };
      chat_rooms: {
        Row: {
          created_at: string;
          id: string;
          last_message: string | null;
          last_message_at: string | null;
          request_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          last_message?: string | null;
          last_message_at?: string | null;
          request_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          last_message?: string | null;
          last_message_at?: string | null;
          request_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "chat_rooms_request_id_fkey";
            columns: ["request_id"];
            isOneToOne: true;
            referencedRelation: "requests";
            referencedColumns: ["id"];
          },
        ];
      };
      documents: {
        Row: {
          chat_room_id: string | null;
          created_at: string;
          file_name: string;
          id: string;
          kind: string;
          mime_type: string;
          request_id: string | null;
          size_bytes: number;
          storage_path: string;
          uploaded_by: string;
          uploader_role: Database["public"]["Enums"]["message_sender"];
        };
        Insert: {
          chat_room_id?: string | null;
          created_at?: string;
          file_name: string;
          id?: string;
          kind?: string;
          mime_type?: string;
          request_id?: string | null;
          size_bytes?: number;
          storage_path: string;
          uploaded_by: string;
          uploader_role?: Database["public"]["Enums"]["message_sender"];
        };
        Update: {
          chat_room_id?: string | null;
          created_at?: string;
          file_name?: string;
          id?: string;
          kind?: string;
          mime_type?: string;
          request_id?: string | null;
          size_bytes?: number;
          storage_path?: string;
          uploaded_by?: string;
          uploader_role?: Database["public"]["Enums"]["message_sender"];
        };
        Relationships: [
          {
            foreignKeyName: "documents_chat_room_id_fkey";
            columns: ["chat_room_id"];
            isOneToOne: false;
            referencedRelation: "chat_rooms";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "documents_request_id_fkey";
            columns: ["request_id"];
            isOneToOne: false;
            referencedRelation: "requests";
            referencedColumns: ["id"];
          },
        ];
      };
      messages: {
        Row: {
          attachment_id: string | null;
          body: string | null;
          chat_room_id: string;
          created_at: string;
          deleted: boolean;
          edited: boolean;
          id: string;
          is_system: boolean;
          reactions: Json;
          reply_to_id: string | null;
          request_id: string;
          seen: boolean;
          seen_at: string | null;
          sender_id: string | null;
          sender_role: Database["public"]["Enums"]["message_sender"];
        };
        Insert: {
          attachment_id?: string | null;
          body?: string | null;
          chat_room_id: string;
          created_at?: string;
          deleted?: boolean;
          edited?: boolean;
          id?: string;
          is_system?: boolean;
          reactions?: Json;
          reply_to_id?: string | null;
          request_id: string;
          seen?: boolean;
          seen_at?: string | null;
          sender_id?: string | null;
          sender_role?: Database["public"]["Enums"]["message_sender"];
        };
        Update: {
          attachment_id?: string | null;
          body?: string | null;
          chat_room_id?: string;
          created_at?: string;
          deleted?: boolean;
          edited?: boolean;
          id?: string;
          is_system?: boolean;
          reactions?: Json;
          reply_to_id?: string | null;
          request_id?: string;
          seen?: boolean;
          seen_at?: string | null;
          sender_id?: string | null;
          sender_role?: Database["public"]["Enums"]["message_sender"];
        };
        Relationships: [
          {
            foreignKeyName: "messages_attachment_id_fkey";
            columns: ["attachment_id"];
            isOneToOne: false;
            referencedRelation: "documents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "messages_chat_room_id_fkey";
            columns: ["chat_room_id"];
            isOneToOne: false;
            referencedRelation: "chat_rooms";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "messages_reply_to_id_fkey";
            columns: ["reply_to_id"];
            isOneToOne: false;
            referencedRelation: "messages";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "messages_request_id_fkey";
            columns: ["request_id"];
            isOneToOne: false;
            referencedRelation: "requests";
            referencedColumns: ["id"];
          },
        ];
      };
      news: {
        Row: {
          category: string;
          created_at: string;
          created_by: string | null;
          description: string;
          featured: boolean;
          id: string;
          image_url: string | null;
          published: boolean;
          published_at: string;
          title: string;
        };
        Insert: {
          category?: string;
          created_at?: string;
          created_by?: string | null;
          description?: string;
          featured?: boolean;
          id?: string;
          image_url?: string | null;
          published?: boolean;
          published_at?: string;
          title: string;
        };
        Update: {
          category?: string;
          created_at?: string;
          created_by?: string | null;
          description?: string;
          featured?: boolean;
          id?: string;
          image_url?: string | null;
          published?: boolean;
          published_at?: string;
          title?: string;
        };
        Relationships: [];
      };
      notifications: {
        Row: {
          body: string | null;
          chat_room_id: string | null;
          created_at: string;
          id: string;
          is_read: boolean;
          receiver_id: string;
          request_id: string | null;
          role: Database["public"]["Enums"]["app_role"];
          title: string;
          type: string;
        };
        Insert: {
          body?: string | null;
          chat_room_id?: string | null;
          created_at?: string;
          id?: string;
          is_read?: boolean;
          receiver_id: string;
          request_id?: string | null;
          role?: Database["public"]["Enums"]["app_role"];
          title: string;
          type?: string;
        };
        Update: {
          body?: string | null;
          chat_room_id?: string | null;
          created_at?: string;
          id?: string;
          is_read?: boolean;
          receiver_id?: string;
          request_id?: string | null;
          role?: Database["public"]["Enums"]["app_role"];
          title?: string;
          type?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notifications_chat_room_id_fkey";
            columns: ["chat_room_id"];
            isOneToOne: false;
            referencedRelation: "chat_rooms";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notifications_request_id_fkey";
            columns: ["request_id"];
            isOneToOne: false;
            referencedRelation: "requests";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          auth_provider: string;
          avatar_url: string | null;
          created_at: string;
          email: string;
          full_name: string;
          id: string;
          is_active: boolean;
          phone: string | null;
          updated_at: string;
        };
        Insert: {
          auth_provider?: string;
          avatar_url?: string | null;
          created_at?: string;
          email?: string;
          full_name?: string;
          id: string;
          is_active?: boolean;
          phone?: string | null;
          updated_at?: string;
        };
        Update: {
          auth_provider?: string;
          avatar_url?: string | null;
          created_at?: string;
          email?: string;
          full_name?: string;
          id?: string;
          is_active?: boolean;
          phone?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      quick_replies: {
        Row: {
          body: string;
          created_at: string;
          id: string;
          is_global: boolean;
          owner_id: string | null;
          title: string;
        };
        Insert: {
          body: string;
          created_at?: string;
          id?: string;
          is_global?: boolean;
          owner_id?: string | null;
          title: string;
        };
        Update: {
          body?: string;
          created_at?: string;
          id?: string;
          is_global?: boolean;
          owner_id?: string | null;
          title?: string;
        };
        Relationships: [];
      };
      request_status_history: {
        Row: {
          changed_by: string | null;
          created_at: string;
          from_status: Database["public"]["Enums"]["request_status"] | null;
          id: string;
          note: string | null;
          request_id: string;
          to_status: Database["public"]["Enums"]["request_status"];
        };
        Insert: {
          changed_by?: string | null;
          created_at?: string;
          from_status?: Database["public"]["Enums"]["request_status"] | null;
          id?: string;
          note?: string | null;
          request_id: string;
          to_status: Database["public"]["Enums"]["request_status"];
        };
        Update: {
          changed_by?: string | null;
          created_at?: string;
          from_status?: Database["public"]["Enums"]["request_status"] | null;
          id?: string;
          note?: string | null;
          request_id?: string;
          to_status?: Database["public"]["Enums"]["request_status"];
        };
        Relationships: [
          {
            foreignKeyName: "request_status_history_request_id_fkey";
            columns: ["request_id"];
            isOneToOne: false;
            referencedRelation: "requests";
            referencedColumns: ["id"];
          },
        ];
      };
      requests: {
        Row: {
          archived: boolean;
          assigned_at: string | null;
          assigned_team_id: string | null;
          category: string;
          completed_at: string | null;
          created_at: string;
          id: string;
          is_escalated: boolean;
          last_activity_at: string;
          last_message: string | null;
          priority: Database["public"]["Enums"]["request_priority"];
          progress: number;
          reference: string;
          resolution_notes: string | null;
          status: Database["public"]["Enums"]["request_status"];
          title: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          archived?: boolean;
          assigned_at?: string | null;
          assigned_team_id?: string | null;
          category?: string;
          completed_at?: string | null;
          created_at?: string;
          id?: string;
          is_escalated?: boolean;
          last_activity_at?: string;
          last_message?: string | null;
          priority?: Database["public"]["Enums"]["request_priority"];
          progress?: number;
          reference: string;
          resolution_notes?: string | null;
          status?: Database["public"]["Enums"]["request_status"];
          title: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          archived?: boolean;
          assigned_at?: string | null;
          assigned_team_id?: string | null;
          category?: string;
          completed_at?: string | null;
          created_at?: string;
          id?: string;
          is_escalated?: boolean;
          last_activity_at?: string;
          last_message?: string | null;
          priority?: Database["public"]["Enums"]["request_priority"];
          progress?: number;
          reference?: string;
          resolution_notes?: string | null;
          status?: Database["public"]["Enums"]["request_status"];
          title?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "requests_assigned_team_id_fkey";
            columns: ["assigned_team_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      settings: {
        Row: {
          allowed_file_types: string;
          brand_name: string;
          contact_email: string;
          id: boolean;
          logo_url: string | null;
          max_upload_mb: number;
          notify_email: boolean;
          notify_push: boolean;
          phone: string;
          support_email: string;
          theme: string;
          updated_at: string;
        };
        Insert: {
          allowed_file_types?: string;
          brand_name?: string;
          contact_email?: string;
          id?: boolean;
          logo_url?: string | null;
          max_upload_mb?: number;
          notify_email?: boolean;
          notify_push?: boolean;
          phone?: string;
          support_email?: string;
          theme?: string;
          updated_at?: string;
        };
        Update: {
          allowed_file_types?: string;
          brand_name?: string;
          contact_email?: string;
          id?: boolean;
          logo_url?: string | null;
          max_upload_mb?: number;
          notify_email?: boolean;
          notify_push?: boolean;
          phone?: string;
          support_email?: string;
          theme?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      team_members: {
        Row: {
          created_at: string;
          created_by: string | null;
          id: string;
          is_active: boolean;
          job_title: string;
          team_code: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          id: string;
          is_active?: boolean;
          job_title?: string;
          team_code?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          is_active?: boolean;
          job_title?: string;
          team_code?: string;
        };
        Relationships: [
          {
            foreignKeyName: "team_members_id_fkey";
            columns: ["id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      user_roles: {
        Row: {
          created_at: string;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
      categories: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      policies: {
        Row: {
          id: string;
          type: string;
          content: string;
          is_active: boolean;
          version: string;
          created_at: string;
          created_by: string | null;
          published_at: string | null;
        };
        Insert: {
          id?: string;
          type: string;
          content: string;
          is_active?: boolean;
          version: string;
          created_at?: string;
          created_by?: string | null;
          published_at?: string | null;
        };
        Update: {
          id?: string;
          type?: string;
          content?: string;
          is_active?: boolean;
          version?: string;
          created_at?: string;
          created_by?: string | null;
          published_at?: string | null;
        };
        Relationships: [];
      };
      policy_acknowledgments: {
        Row: {
          id: string;
          user_id: string;
          policy_id: string;
          acknowledged_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          policy_id: string;
          acknowledged_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          policy_id?: string;
          acknowledged_at?: string;
        };
        Relationships: [];
      };
      user_settings: {
        Row: {
          email_notifications: boolean;
          language: string;
          push_notifications: boolean;
          sound_enabled: boolean;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          email_notifications?: boolean;
          language?: string;
          push_notifications?: boolean;
          sound_enabled?: boolean;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          email_notifications?: boolean;
          language?: string;
          push_notifications?: boolean;
          sound_enabled?: boolean;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      can_access_request: { Args: { _request_id: string }; Returns: boolean };
      can_access_request_ref: { Args: { _ref: string }; Returns: boolean };
      current_role_name: {
        Args: never;
        Returns: Database["public"]["Enums"]["app_role"];
      };
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
      is_admin: { Args: never; Returns: boolean };
      is_team: { Args: never; Returns: boolean };
      notify_admins: {
        Args: {
          _body: string;
          _request_id: string;
          _room_id: string;
          _title: string;
          _type: string;
        };
        Returns: undefined;
      };
      request_of_room: { Args: { _room_id: string }; Returns: string };
      transfer_request: {
        Args: {
          req_id: string;
          new_assignee_id: string;
        };
        Returns: undefined;
      };
      escalate_request: {
        Args: {
          req_id: string;
        };
        Returns: undefined;
      };
      de_escalate_request: {
        Args: {
          req_id: string;
        };
        Returns: undefined;
      };
      claim_request: {
        Args: {
          req_id: string;
        };
        Returns: undefined;
      };
      takeover_request: {
        Args: {
          req_id: string;
        };
        Returns: undefined;
      };
      create_new_request_with_limit: {
        Args: {
          p_title: string;
          p_category: string;
          p_priority: string;
        };
        Returns: Database["public"]["Tables"]["requests"]["Row"];
      };
    };
    Enums: {
      app_role: "user" | "team" | "admin";
      message_sender: "user" | "team" | "admin" | "system";
      request_priority: "low" | "medium" | "high";
      request_status:
        | "pending"
        | "assigned"
        | "waiting_documents"
        | "under_review"
        | "in_progress"
        | "completed"
        | "cancelled"
        | "closed";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["user", "team", "admin"],
      message_sender: ["user", "team", "admin", "system"],
      request_priority: ["low", "medium", "high"],
      request_status: [
        "pending",
        "assigned",
        "waiting_documents",
        "under_review",
        "in_progress",
        "completed",
        "cancelled",
        "closed",
      ],
    },
  },
} as const;
