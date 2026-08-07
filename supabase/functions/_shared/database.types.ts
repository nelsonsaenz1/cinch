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
    PostgrestVersion: "14.15"
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
      ai_calls: {
        Row: {
          completion_tokens: number | null
          cost_usd: number | null
          created_at: string
          error: string | null
          id: string
          item_id: string | null
          latency_ms: number | null
          model_id: string
          prompt_tokens: number | null
          provider: string
          succeeded: boolean
          user_id: string | null
          workload: Database["public"]["Enums"]["ai_workload"]
        }
        Insert: {
          completion_tokens?: number | null
          cost_usd?: number | null
          created_at?: string
          error?: string | null
          id?: string
          item_id?: string | null
          latency_ms?: number | null
          model_id: string
          prompt_tokens?: number | null
          provider: string
          succeeded?: boolean
          user_id?: string | null
          workload: Database["public"]["Enums"]["ai_workload"]
        }
        Update: {
          completion_tokens?: number | null
          cost_usd?: number | null
          created_at?: string
          error?: string | null
          id?: string
          item_id?: string | null
          latency_ms?: number | null
          model_id?: string
          prompt_tokens?: number | null
          provider?: string
          succeeded?: boolean
          user_id?: string | null
          workload?: Database["public"]["Enums"]["ai_workload"]
        }
        Relationships: [
          {
            foreignKeyName: "ai_calls_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "friend_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_calls_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_calls_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "public_items"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_config: {
        Row: {
          enabled: boolean
          max_tokens: number
          model_id: string
          params: Json
          provider: string
          updated_at: string
          workload: Database["public"]["Enums"]["ai_workload"]
        }
        Insert: {
          enabled?: boolean
          max_tokens?: number
          model_id: string
          params?: Json
          provider?: string
          updated_at?: string
          workload: Database["public"]["Enums"]["ai_workload"]
        }
        Update: {
          enabled?: boolean
          max_tokens?: number
          model_id?: string
          params?: Json
          provider?: string
          updated_at?: string
          workload?: Database["public"]["Enums"]["ai_workload"]
        }
        Relationships: []
      }
      ai_usage_counters: {
        Row: {
          calls: number
          kind: string
          period: string
          period_start: string
          user_id: string
        }
        Insert: {
          calls?: number
          kind: string
          period?: string
          period_start?: string
          user_id: string
        }
        Update: {
          calls?: number
          kind?: string
          period?: string
          period_start?: string
          user_id?: string
        }
        Relationships: []
      }
      borrow_requests: {
        Row: {
          created_at: string
          event_id: string | null
          id: string
          item_id: string
          message: string | null
          owner_id: string
          requester_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          event_id?: string | null
          id?: string
          item_id: string
          message?: string | null
          owner_id: string
          requester_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          event_id?: string | null
          id?: string
          item_id?: string
          message?: string | null
          owner_id?: string
          requester_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "borrow_requests_event_fk"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "borrow_requests_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "friend_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "borrow_requests_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "borrow_requests_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "public_items"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          content: Json
          created_at: string
          id: string
          role: string
          session_id: string
          user_id: string
        }
        Insert: {
          content: Json
          created_at?: string
          id?: string
          role: string
          session_id: string
          user_id: string
        }
        Update: {
          content?: Json
          created_at?: string
          id?: string
          role?: string
          session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "chat_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_sessions: {
        Row: {
          created_at: string
          id: string
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      closet_likes: {
        Row: {
          created_at: string
          item_id: string | null
          outfit_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          item_id?: string | null
          outfit_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          item_id?: string | null
          outfit_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "closet_likes_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "friend_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "closet_likes_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "closet_likes_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "public_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "closet_likes_outfit_id_fkey"
            columns: ["outfit_id"]
            isOneToOne: false
            referencedRelation: "outfits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "closet_likes_outfit_id_fkey"
            columns: ["outfit_id"]
            isOneToOne: false
            referencedRelation: "public_outfits"
            referencedColumns: ["id"]
          },
        ]
      }
      command_log: {
        Row: {
          claimed_at: string
          kind: string
          op_id: string
          result_id: string | null
          user_id: string
        }
        Insert: {
          claimed_at?: string
          kind: string
          op_id: string
          result_id?: string | null
          user_id: string
        }
        Update: {
          claimed_at?: string
          kind?: string
          op_id?: string
          result_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      content_reports: {
        Row: {
          created_at: string
          details: string | null
          id: string
          reason: string
          reporter_id: string
          status: string
          subject: Database["public"]["Enums"]["report_subject"]
          subject_id: string
          subject_user: string | null
        }
        Insert: {
          created_at?: string
          details?: string | null
          id?: string
          reason: string
          reporter_id: string
          status?: string
          subject: Database["public"]["Enums"]["report_subject"]
          subject_id: string
          subject_user?: string | null
        }
        Update: {
          created_at?: string
          details?: string | null
          id?: string
          reason?: string
          reporter_id?: string
          status?: string
          subject?: Database["public"]["Enums"]["report_subject"]
          subject_id?: string
          subject_user?: string | null
        }
        Relationships: []
      }
      event_comments: {
        Row: {
          body: string
          created_at: string
          event_id: string
          hidden: boolean
          id: string
          post_id: string | null
          reported: boolean
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          event_id: string
          hidden?: boolean
          id?: string
          post_id?: string | null
          reported?: boolean
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          event_id?: string
          hidden?: boolean
          id?: string
          post_id?: string | null
          reported?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_comments_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "event_outfit_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "event_post_items"
            referencedColumns: ["post_id"]
          },
        ]
      }
      event_members: {
        Row: {
          created_at: string
          event_id: string
          invited_by: string | null
          role: Database["public"]["Enums"]["event_member_role"]
          state: Database["public"]["Enums"]["event_member_state"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["event_member_role"]
          state?: Database["public"]["Enums"]["event_member_state"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["event_member_role"]
          state?: Database["public"]["Enums"]["event_member_state"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_members_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_outfit_posts: {
        Row: {
          caption: string | null
          created_at: string
          event_id: string
          id: string
          outfit_id: string
          user_id: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          event_id: string
          id?: string
          outfit_id: string
          user_id: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          event_id?: string
          id?: string
          outfit_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_outfit_posts_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_outfit_posts_outfit_id_fkey"
            columns: ["outfit_id"]
            isOneToOne: false
            referencedRelation: "outfits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_outfit_posts_outfit_id_fkey"
            columns: ["outfit_id"]
            isOneToOne: false
            referencedRelation: "public_outfits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_posts_outfit_same_user"
            columns: ["outfit_id", "user_id"]
            isOneToOne: false
            referencedRelation: "outfits"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "event_posts_outfit_same_user"
            columns: ["outfit_id", "user_id"]
            isOneToOne: false
            referencedRelation: "public_outfits"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      event_outfit_votes: {
        Row: {
          created_at: string
          event_id: string
          post_id: string
          voter_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          post_id: string
          voter_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          post_id?: string
          voter_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_outfit_votes_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_outfit_votes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "event_outfit_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_outfit_votes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "event_post_items"
            referencedColumns: ["post_id"]
          },
        ]
      }
      events: {
        Row: {
          canceled_at: string | null
          created_at: string
          dress_code: string | null
          ends_at: string | null
          host_id: string
          id: string
          note: string | null
          occasion: string | null
          party_size: number | null
          reservation_url: string | null
          starts_at: string
          title: string
          updated_at: string
          venue_address: string | null
          venue_meta: Json | null
          venue_name: string | null
          visibility: Database["public"]["Enums"]["event_visibility"]
        }
        Insert: {
          canceled_at?: string | null
          created_at?: string
          dress_code?: string | null
          ends_at?: string | null
          host_id: string
          id?: string
          note?: string | null
          occasion?: string | null
          party_size?: number | null
          reservation_url?: string | null
          starts_at: string
          title: string
          updated_at?: string
          venue_address?: string | null
          venue_meta?: Json | null
          venue_name?: string | null
          visibility?: Database["public"]["Enums"]["event_visibility"]
        }
        Update: {
          canceled_at?: string | null
          created_at?: string
          dress_code?: string | null
          ends_at?: string | null
          host_id?: string
          id?: string
          note?: string | null
          occasion?: string | null
          party_size?: number | null
          reservation_url?: string | null
          starts_at?: string
          title?: string
          updated_at?: string
          venue_address?: string | null
          venue_meta?: Json | null
          venue_name?: string | null
          visibility?: Database["public"]["Enums"]["event_visibility"]
        }
        Relationships: []
      }
      follows: {
        Row: {
          created_at: string
          followee_id: string
          follower_id: string
        }
        Insert: {
          created_at?: string
          followee_id: string
          follower_id: string
        }
        Update: {
          created_at?: string
          followee_id?: string
          follower_id?: string
        }
        Relationships: []
      }
      item_inquiries: {
        Row: {
          created_at: string
          id: string
          inquirer_id: string
          item_id: string
          message: string | null
          owner_id: string
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          inquirer_id: string
          item_id: string
          message?: string | null
          owner_id: string
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          inquirer_id?: string
          item_id?: string
          message?: string | null
          owner_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "item_inquiries_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "friend_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_inquiries_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_inquiries_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "public_items"
            referencedColumns: ["id"]
          },
        ]
      }
      items: {
        Row: {
          ai_tags: Json | null
          borrowable: boolean
          brand: string | null
          category: Database["public"]["Enums"]["item_category"]
          color_analysis: Json | null
          colors: Json
          condition: string | null
          created_at: string
          cutout_path: string | null
          description: string | null
          fit: Database["public"]["Enums"]["garment_fit"] | null
          formality_score: number | null
          id: string
          image_path: string | null
          is_archived: boolean
          is_for_sale: boolean
          is_public: boolean
          last_worn_at: string | null
          material: string | null
          occasions: string[]
          pattern: string | null
          pattern_scale: Database["public"]["Enums"]["pattern_scale"] | null
          plate_path: string | null
          purchase_date: string | null
          purchase_price: number | null
          sale_note: string | null
          sale_price: number | null
          seasons: string[]
          size: string | null
          status: Database["public"]["Enums"]["item_status"]
          subcategory: string | null
          thumb_path: string | null
          updated_at: string
          user_id: string
          user_verified: boolean
          warmth_score: number | null
          water_resistant: boolean
          wear_count: number
        }
        Insert: {
          ai_tags?: Json | null
          borrowable?: boolean
          brand?: string | null
          category?: Database["public"]["Enums"]["item_category"]
          color_analysis?: Json | null
          colors?: Json
          condition?: string | null
          created_at?: string
          cutout_path?: string | null
          description?: string | null
          fit?: Database["public"]["Enums"]["garment_fit"] | null
          formality_score?: number | null
          id?: string
          image_path?: string | null
          is_archived?: boolean
          is_for_sale?: boolean
          is_public?: boolean
          last_worn_at?: string | null
          material?: string | null
          occasions?: string[]
          pattern?: string | null
          pattern_scale?: Database["public"]["Enums"]["pattern_scale"] | null
          plate_path?: string | null
          purchase_date?: string | null
          purchase_price?: number | null
          sale_note?: string | null
          sale_price?: number | null
          seasons?: string[]
          size?: string | null
          status?: Database["public"]["Enums"]["item_status"]
          subcategory?: string | null
          thumb_path?: string | null
          updated_at?: string
          user_id: string
          user_verified?: boolean
          warmth_score?: number | null
          water_resistant?: boolean
          wear_count?: number
        }
        Update: {
          ai_tags?: Json | null
          borrowable?: boolean
          brand?: string | null
          category?: Database["public"]["Enums"]["item_category"]
          color_analysis?: Json | null
          colors?: Json
          condition?: string | null
          created_at?: string
          cutout_path?: string | null
          description?: string | null
          fit?: Database["public"]["Enums"]["garment_fit"] | null
          formality_score?: number | null
          id?: string
          image_path?: string | null
          is_archived?: boolean
          is_for_sale?: boolean
          is_public?: boolean
          last_worn_at?: string | null
          material?: string | null
          occasions?: string[]
          pattern?: string | null
          pattern_scale?: Database["public"]["Enums"]["pattern_scale"] | null
          plate_path?: string | null
          purchase_date?: string | null
          purchase_price?: number | null
          sale_note?: string | null
          sale_price?: number | null
          seasons?: string[]
          size?: string | null
          status?: Database["public"]["Enums"]["item_status"]
          subcategory?: string | null
          thumb_path?: string | null
          updated_at?: string
          user_id?: string
          user_verified?: boolean
          warmth_score?: number | null
          water_resistant?: boolean
          wear_count?: number
        }
        Relationships: []
      }
      outfit_calendar: {
        Row: {
          created_at: string
          id: string
          note: string | null
          outfit_id: string | null
          planned_date: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          note?: string | null
          outfit_id?: string | null
          planned_date: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          note?: string | null
          outfit_id?: string | null
          planned_date?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "outfit_calendar_outfit_id_fkey"
            columns: ["outfit_id"]
            isOneToOne: false
            referencedRelation: "outfits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outfit_calendar_outfit_id_fkey"
            columns: ["outfit_id"]
            isOneToOne: false
            referencedRelation: "public_outfits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outfit_calendar_outfit_same_user"
            columns: ["outfit_id", "user_id"]
            isOneToOne: false
            referencedRelation: "outfits"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "outfit_calendar_outfit_same_user"
            columns: ["outfit_id", "user_id"]
            isOneToOne: false
            referencedRelation: "public_outfits"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      outfit_items: {
        Row: {
          item_id: string
          outfit_id: string
          position: number
          role: string
          user_id: string
        }
        Insert: {
          item_id: string
          outfit_id: string
          position?: number
          role?: string
          user_id: string
        }
        Update: {
          item_id?: string
          outfit_id?: string
          position?: number
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "outfit_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "friend_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outfit_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outfit_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "public_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outfit_items_item_same_user"
            columns: ["item_id", "user_id"]
            isOneToOne: false
            referencedRelation: "friend_items"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "outfit_items_item_same_user"
            columns: ["item_id", "user_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "outfit_items_item_same_user"
            columns: ["item_id", "user_id"]
            isOneToOne: false
            referencedRelation: "public_items"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "outfit_items_outfit_id_fkey"
            columns: ["outfit_id"]
            isOneToOne: false
            referencedRelation: "outfits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outfit_items_outfit_id_fkey"
            columns: ["outfit_id"]
            isOneToOne: false
            referencedRelation: "public_outfits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outfit_items_outfit_same_user"
            columns: ["outfit_id", "user_id"]
            isOneToOne: false
            referencedRelation: "outfits"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "outfit_items_outfit_same_user"
            columns: ["outfit_id", "user_id"]
            isOneToOne: false
            referencedRelation: "public_outfits"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      outfit_reactions: {
        Row: {
          baseline: Json
          created_at: string
          features: Json
          id: string
          item_ids: string[]
          outfit_id: string | null
          reaction: number
          reason: string | null
          source: string
          user_id: string
        }
        Insert: {
          baseline?: Json
          created_at?: string
          features?: Json
          id?: string
          item_ids?: string[]
          outfit_id?: string | null
          reaction: number
          reason?: string | null
          source?: string
          user_id: string
        }
        Update: {
          baseline?: Json
          created_at?: string
          features?: Json
          id?: string
          item_ids?: string[]
          outfit_id?: string | null
          reaction?: number
          reason?: string | null
          source?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "outfit_reactions_outfit_id_fkey"
            columns: ["outfit_id"]
            isOneToOne: false
            referencedRelation: "outfits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outfit_reactions_outfit_id_fkey"
            columns: ["outfit_id"]
            isOneToOne: false
            referencedRelation: "public_outfits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outfit_reactions_outfit_same_user"
            columns: ["outfit_id", "user_id"]
            isOneToOne: false
            referencedRelation: "outfits"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "outfit_reactions_outfit_same_user"
            columns: ["outfit_id", "user_id"]
            isOneToOne: false
            referencedRelation: "public_outfits"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      outfits: {
        Row: {
          context_snapshot: Json | null
          created_at: string
          generated_by: Database["public"]["Enums"]["outfit_source"]
          id: string
          is_public: boolean
          name: string | null
          occasion: string | null
          rating: number | null
          rating_reason: string | null
          reasoning: string | null
          user_id: string
          worn_at: string | null
        }
        Insert: {
          context_snapshot?: Json | null
          created_at?: string
          generated_by?: Database["public"]["Enums"]["outfit_source"]
          id?: string
          is_public?: boolean
          name?: string | null
          occasion?: string | null
          rating?: number | null
          rating_reason?: string | null
          reasoning?: string | null
          user_id: string
          worn_at?: string | null
        }
        Update: {
          context_snapshot?: Json | null
          created_at?: string
          generated_by?: Database["public"]["Enums"]["outfit_source"]
          id?: string
          is_public?: boolean
          name?: string | null
          occasion?: string | null
          rating?: number | null
          rating_reason?: string | null
          reasoning?: string | null
          user_id?: string
          worn_at?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          ai_consent_at: string | null
          ai_consent_revoked_at: string | null
          ai_consent_version: number | null
          avatar_url: string | null
          bio: string | null
          color_season: string | null
          created_at: string
          deletion_requested_at: string | null
          display_name: string | null
          follower_count: number
          following_count: number
          gender_presentation: string | null
          home_city: string | null
          onboarding_complete: boolean
          preference_summary: string | null
          preference_summary_updated_at: string | null
          sizes: Json
          style_tags: string[]
          units: string
          updated_at: string
          user_id: string
          username: string | null
          visibility: Database["public"]["Enums"]["profile_visibility"]
        }
        Insert: {
          ai_consent_at?: string | null
          ai_consent_revoked_at?: string | null
          ai_consent_version?: number | null
          avatar_url?: string | null
          bio?: string | null
          color_season?: string | null
          created_at?: string
          deletion_requested_at?: string | null
          display_name?: string | null
          follower_count?: number
          following_count?: number
          gender_presentation?: string | null
          home_city?: string | null
          onboarding_complete?: boolean
          preference_summary?: string | null
          preference_summary_updated_at?: string | null
          sizes?: Json
          style_tags?: string[]
          units?: string
          updated_at?: string
          user_id: string
          username?: string | null
          visibility?: Database["public"]["Enums"]["profile_visibility"]
        }
        Update: {
          ai_consent_at?: string | null
          ai_consent_revoked_at?: string | null
          ai_consent_version?: number | null
          avatar_url?: string | null
          bio?: string | null
          color_season?: string | null
          created_at?: string
          deletion_requested_at?: string | null
          display_name?: string | null
          follower_count?: number
          following_count?: number
          gender_presentation?: string | null
          home_city?: string | null
          onboarding_complete?: boolean
          preference_summary?: string | null
          preference_summary_updated_at?: string | null
          sizes?: Json
          style_tags?: string[]
          units?: string
          updated_at?: string
          user_id?: string
          username?: string | null
          visibility?: Database["public"]["Enums"]["profile_visibility"]
        }
        Relationships: []
      }
      style_feedback: {
        Row: {
          action: Database["public"]["Enums"]["feedback_action"]
          context: Json | null
          created_at: string
          id: string
          item_id: string | null
          outfit_id: string | null
          reason: string | null
          user_id: string
        }
        Insert: {
          action: Database["public"]["Enums"]["feedback_action"]
          context?: Json | null
          created_at?: string
          id?: string
          item_id?: string | null
          outfit_id?: string | null
          reason?: string | null
          user_id: string
        }
        Update: {
          action?: Database["public"]["Enums"]["feedback_action"]
          context?: Json | null
          created_at?: string
          id?: string
          item_id?: string | null
          outfit_id?: string | null
          reason?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "style_feedback_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "friend_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "style_feedback_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "style_feedback_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "public_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "style_feedback_item_same_user"
            columns: ["item_id", "user_id"]
            isOneToOne: false
            referencedRelation: "friend_items"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "style_feedback_item_same_user"
            columns: ["item_id", "user_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "style_feedback_item_same_user"
            columns: ["item_id", "user_id"]
            isOneToOne: false
            referencedRelation: "public_items"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "style_feedback_outfit_id_fkey"
            columns: ["outfit_id"]
            isOneToOne: false
            referencedRelation: "outfits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "style_feedback_outfit_id_fkey"
            columns: ["outfit_id"]
            isOneToOne: false
            referencedRelation: "public_outfits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "style_feedback_outfit_same_user"
            columns: ["outfit_id", "user_id"]
            isOneToOne: false
            referencedRelation: "outfits"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "style_feedback_outfit_same_user"
            columns: ["outfit_id", "user_id"]
            isOneToOne: false
            referencedRelation: "public_outfits"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      style_profiles: {
        Row: {
          affinities: Json
          feedback_count: number
          summary: string[]
          updated_at: string
          user_id: string
          weights: Json
        }
        Insert: {
          affinities?: Json
          feedback_count?: number
          summary?: string[]
          updated_at?: string
          user_id: string
          weights?: Json
        }
        Update: {
          affinities?: Json
          feedback_count?: number
          summary?: string[]
          updated_at?: string
          user_id?: string
          weights?: Json
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          current_period_end: string | null
          plan: Database["public"]["Enums"]["subscription_plan"]
          trial_ends_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          current_period_end?: string | null
          plan?: Database["public"]["Enums"]["subscription_plan"]
          trial_ends_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          current_period_end?: string | null
          plan?: Database["public"]["Enums"]["subscription_plan"]
          trial_ends_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      tag_corrections: {
        Row: {
          corrected: Json
          created_at: string
          id: string
          image_path: string | null
          item_id: string | null
          model_id: string
          model_output: Json
          user_id: string
        }
        Insert: {
          corrected: Json
          created_at?: string
          id?: string
          image_path?: string | null
          item_id?: string | null
          model_id: string
          model_output: Json
          user_id: string
        }
        Update: {
          corrected?: Json
          created_at?: string
          id?: string
          image_path?: string | null
          item_id?: string | null
          model_id?: string
          model_output?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tag_corrections_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "friend_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tag_corrections_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tag_corrections_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "public_items"
            referencedColumns: ["id"]
          },
        ]
      }
      user_blocks: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
        }
        Relationships: []
      }
      wardrobe_gaps: {
        Row: {
          category: Database["public"]["Enums"]["item_category"]
          computed_at: string
          dismissed: boolean
          id: string
          mean_score: number | null
          outfits_unlocked: number
          price_high: number | null
          price_low: number | null
          rationale: string | null
          subcategory: string | null
          target_colors: Json
          target_formality: number | null
          target_warmth: number | null
          user_id: string
        }
        Insert: {
          category: Database["public"]["Enums"]["item_category"]
          computed_at?: string
          dismissed?: boolean
          id?: string
          mean_score?: number | null
          outfits_unlocked?: number
          price_high?: number | null
          price_low?: number | null
          rationale?: string | null
          subcategory?: string | null
          target_colors?: Json
          target_formality?: number | null
          target_warmth?: number | null
          user_id: string
        }
        Update: {
          category?: Database["public"]["Enums"]["item_category"]
          computed_at?: string
          dismissed?: boolean
          id?: string
          mean_score?: number | null
          outfits_unlocked?: number
          price_high?: number | null
          price_low?: number | null
          rationale?: string | null
          subcategory?: string | null
          target_colors?: Json
          target_formality?: number | null
          target_warmth?: number | null
          user_id?: string
        }
        Relationships: []
      }
      wishlist_items: {
        Row: {
          brand: string | null
          created_at: string
          currency: string
          fit_score: number | null
          gap_id: string | null
          id: string
          image_url: string | null
          item_id: string | null
          merchant: string | null
          price: number | null
          purchased: boolean
          rationale: string | null
          title: string
          url: string | null
          user_id: string
        }
        Insert: {
          brand?: string | null
          created_at?: string
          currency?: string
          fit_score?: number | null
          gap_id?: string | null
          id?: string
          image_url?: string | null
          item_id?: string | null
          merchant?: string | null
          price?: number | null
          purchased?: boolean
          rationale?: string | null
          title: string
          url?: string | null
          user_id: string
        }
        Update: {
          brand?: string | null
          created_at?: string
          currency?: string
          fit_score?: number | null
          gap_id?: string | null
          id?: string
          image_url?: string | null
          item_id?: string | null
          merchant?: string | null
          price?: number | null
          purchased?: boolean
          rationale?: string | null
          title?: string
          url?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wishlist_items_gap_id_fkey"
            columns: ["gap_id"]
            isOneToOne: false
            referencedRelation: "wardrobe_gaps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wishlist_items_gap_same_user"
            columns: ["gap_id", "user_id"]
            isOneToOne: false
            referencedRelation: "wardrobe_gaps"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "wishlist_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "friend_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wishlist_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wishlist_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "public_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wishlist_items_item_same_user"
            columns: ["item_id", "user_id"]
            isOneToOne: false
            referencedRelation: "friend_items"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "wishlist_items_item_same_user"
            columns: ["item_id", "user_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "wishlist_items_item_same_user"
            columns: ["item_id", "user_id"]
            isOneToOne: false
            referencedRelation: "public_items"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
    }
    Views: {
      event_post_items: {
        Row: {
          borrowable: boolean | null
          category: Database["public"]["Enums"]["item_category"] | null
          colors: Json | null
          cutout_path: string | null
          event_id: string | null
          item_id: string | null
          plate_path: string | null
          position: number | null
          post_id: string | null
          subcategory: string | null
          thumb_path: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_outfit_posts_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outfit_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "friend_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outfit_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outfit_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "public_items"
            referencedColumns: ["id"]
          },
        ]
      }
      event_vote_counts: {
        Row: {
          event_id: string | null
          post_id: string | null
          votes: number | null
        }
        Relationships: [
          {
            foreignKeyName: "event_outfit_votes_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_outfit_votes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "event_outfit_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_outfit_votes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "event_post_items"
            referencedColumns: ["post_id"]
          },
        ]
      }
      friend_items: {
        Row: {
          borrowable: boolean | null
          brand: string | null
          category: Database["public"]["Enums"]["item_category"] | null
          colors: Json | null
          created_at: string | null
          cutout_path: string | null
          description: string | null
          id: string | null
          material: string | null
          occasions: string[] | null
          pattern: string | null
          plate_path: string | null
          seasons: string[] | null
          subcategory: string | null
          thumb_path: string | null
          user_id: string | null
        }
        Insert: {
          borrowable?: boolean | null
          brand?: string | null
          category?: Database["public"]["Enums"]["item_category"] | null
          colors?: Json | null
          created_at?: string | null
          cutout_path?: string | null
          description?: string | null
          id?: string | null
          material?: string | null
          occasions?: string[] | null
          pattern?: string | null
          plate_path?: string | null
          seasons?: string[] | null
          subcategory?: string | null
          thumb_path?: string | null
          user_id?: string | null
        }
        Update: {
          borrowable?: boolean | null
          brand?: string | null
          category?: Database["public"]["Enums"]["item_category"] | null
          colors?: Json | null
          created_at?: string | null
          cutout_path?: string | null
          description?: string | null
          id?: string | null
          material?: string | null
          occasions?: string[] | null
          pattern?: string | null
          plate_path?: string | null
          seasons?: string[] | null
          subcategory?: string | null
          thumb_path?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      public_items: {
        Row: {
          brand: string | null
          category: Database["public"]["Enums"]["item_category"] | null
          colors: Json | null
          created_at: string | null
          cutout_path: string | null
          description: string | null
          id: string | null
          is_for_sale: boolean | null
          material: string | null
          occasions: string[] | null
          pattern: string | null
          seasons: string[] | null
          subcategory: string | null
          thumb_path: string | null
          user_id: string | null
        }
        Relationships: []
      }
      public_like_counts: {
        Row: {
          item_id: string | null
          likes: number | null
          outfit_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "closet_likes_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "friend_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "closet_likes_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "closet_likes_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "public_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "closet_likes_outfit_id_fkey"
            columns: ["outfit_id"]
            isOneToOne: false
            referencedRelation: "outfits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "closet_likes_outfit_id_fkey"
            columns: ["outfit_id"]
            isOneToOne: false
            referencedRelation: "public_outfits"
            referencedColumns: ["id"]
          },
        ]
      }
      public_outfit_items: {
        Row: {
          item_id: string | null
          outfit_id: string | null
          position: number | null
          role: string | null
        }
        Relationships: [
          {
            foreignKeyName: "outfit_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "friend_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outfit_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outfit_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "public_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outfit_items_outfit_id_fkey"
            columns: ["outfit_id"]
            isOneToOne: false
            referencedRelation: "outfits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outfit_items_outfit_id_fkey"
            columns: ["outfit_id"]
            isOneToOne: false
            referencedRelation: "public_outfits"
            referencedColumns: ["id"]
          },
        ]
      }
      public_outfits: {
        Row: {
          created_at: string | null
          id: string | null
          name: string | null
          occasion: string | null
          user_id: string | null
        }
        Relationships: []
      }
      public_profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string | null
          display_name: string | null
          follower_count: number | null
          following_count: number | null
          style_tags: string[] | null
          user_id: string | null
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          display_name?: string | null
          follower_count?: number | null
          following_count?: number | null
          style_tags?: string[] | null
          user_id?: string | null
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          display_name?: string | null
          follower_count?: number | null
          following_count?: number | null
          style_tags?: string[] | null
          user_id?: string | null
          username?: string | null
        }
        Relationships: []
      }
      social_profiles: {
        Row: {
          avatar_url: string | null
          display_name: string | null
          user_id: string | null
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          display_name?: string | null
          user_id?: string | null
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          display_name?: string | null
          user_id?: string | null
          username?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      apply_outfit_reaction: {
        Args: {
          p_affinities: Json
          p_baseline: Json
          p_expected_feedback_count?: number
          p_features: Json
          p_item_ids: string[]
          p_outfit_id?: string
          p_reaction: number
          p_reason?: string
          p_source?: string
          p_summary: string[]
          p_weights: Json
        }
        Returns: Json
      }
      blocked_between: { Args: { p_a: string; p_b: string }; Returns: boolean }
      can_see_event: { Args: { p_event: string }; Returns: boolean }
      claim_ai_quota: {
        Args: {
          p_kind: string
          p_limit: number
          p_period: string
          p_user_id: string
        }
        Returns: Json
      }
      claim_command: {
        Args: { p_kind: string; p_op_id: string; p_user_id: string }
        Returns: {
          already_done: boolean
          existing_result: string
        }[]
      }
      current_ai_consent_version: { Args: never; Returns: number }
      effective_plan: {
        Args: { p_user_id: string }
        Returns: Database["public"]["Enums"]["subscription_plan"]
      }
      event_limit_for_plan: {
        Args: { p_plan: Database["public"]["Enums"]["subscription_plan"] }
        Returns: number
      }
      is_event_host: { Args: { p_event: string }; Returns: boolean }
      is_event_member: { Args: { p_event: string }; Returns: boolean }
      is_friend: { Args: { p_other: string }; Returns: boolean }
      item_is_published: { Args: { p_item: string }; Returns: boolean }
      item_limit_for_plan: {
        Args: { p_plan: Database["public"]["Enums"]["subscription_plan"] }
        Returns: number
      }
      item_owned_by_friend: { Args: { p_item: string }; Returns: boolean }
      item_posted_to_my_event: { Args: { p_item: string }; Returns: boolean }
      log_outfit_wear: { Args: { p_outfit_id: string }; Returns: undefined }
      plan_outfit_tx: {
        Args: {
          p_context?: Json
          p_item_ids: string[]
          p_name?: string
          p_note?: string
          p_op_id: string
          p_planned_date: string
        }
        Returns: string
      }
      username_available: { Args: { p_username: string }; Returns: boolean }
      wear_outfit_tx: {
        Args: {
          p_context?: Json
          p_item_ids: string[]
          p_name?: string
          p_op_id: string
          p_reasoning?: string
          p_source?: Database["public"]["Enums"]["outfit_source"]
        }
        Returns: string
      }
    }
    Enums: {
      ai_workload:
        | "tagging"
        | "outfit_generation"
        | "stylist_chat"
        | "garment_search"
      event_member_role: "host" | "attendee"
      event_member_state: "invited" | "joined" | "declined" | "removed"
      event_visibility: "invite_only" | "friends"
      feedback_action: "accepted" | "rejected" | "edited" | "worn"
      garment_fit: "fitted" | "regular" | "relaxed" | "oversized"
      item_category:
        | "top"
        | "bottom"
        | "outerwear"
        | "footwear"
        | "dress"
        | "accessory"
        | "bag"
        | "headwear"
        | "jewelry"
        | "other"
      item_status:
        | "pending_upload"
        | "pending_tag"
        | "tagged"
        | "needs_review"
        | "verified"
      outfit_source: "ai" | "user"
      pattern_scale: "none" | "micro" | "small" | "medium" | "large"
      profile_visibility: "private" | "public"
      report_subject: "profile" | "item" | "outfit_post" | "comment" | "event"
      subscription_plan: "free" | "standard" | "pro"
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
      ai_workload: [
        "tagging",
        "outfit_generation",
        "stylist_chat",
        "garment_search",
      ],
      event_member_role: ["host", "attendee"],
      event_member_state: ["invited", "joined", "declined", "removed"],
      event_visibility: ["invite_only", "friends"],
      feedback_action: ["accepted", "rejected", "edited", "worn"],
      garment_fit: ["fitted", "regular", "relaxed", "oversized"],
      item_category: [
        "top",
        "bottom",
        "outerwear",
        "footwear",
        "dress",
        "accessory",
        "bag",
        "headwear",
        "jewelry",
        "other",
      ],
      item_status: [
        "pending_upload",
        "pending_tag",
        "tagged",
        "needs_review",
        "verified",
      ],
      outfit_source: ["ai", "user"],
      pattern_scale: ["none", "micro", "small", "medium", "large"],
      profile_visibility: ["private", "public"],
      report_subject: ["profile", "item", "outfit_post", "comment", "event"],
      subscription_plan: ["free", "standard", "pro"],
    },
  },
} as const
