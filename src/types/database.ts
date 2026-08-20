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
  public: {
    Tables: {
      activity_dismissals: {
        Row: {
          dismissed_at: string
          kind: string
          subject_key: string
          user_id: string
        }
        Insert: {
          dismissed_at?: string
          kind: string
          subject_key: string
          user_id: string
        }
        Update: {
          dismissed_at?: string
          kind?: string
          subject_key?: string
          user_id?: string
        }
        Relationships: []
      }
      activity_events: {
        Row: {
          actor_id: string | null
          circle_id: string | null
          created_at: string
          dismissed_at: string | null
          event_type: Database["public"]["Enums"]["activity_event_type"]
          id: string
          payload: Json
          recipient_id: string
          revoked_at: string | null
          seen_at: string | null
          subject_id: string
          subject_type: string
        }
        Insert: {
          actor_id?: string | null
          circle_id?: string | null
          created_at?: string
          dismissed_at?: string | null
          event_type: Database["public"]["Enums"]["activity_event_type"]
          id?: string
          payload?: Json
          recipient_id: string
          revoked_at?: string | null
          seen_at?: string | null
          subject_id: string
          subject_type: string
        }
        Update: {
          actor_id?: string | null
          circle_id?: string | null
          created_at?: string
          dismissed_at?: string | null
          event_type?: Database["public"]["Enums"]["activity_event_type"]
          id?: string
          payload?: Json
          recipient_id?: string
          revoked_at?: string | null
          seen_at?: string | null
          subject_id?: string
          subject_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_events_circle_id_fkey"
            columns: ["circle_id"]
            isOneToOne: false
            referencedRelation: "circles"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_calls: {
        Row: {
          attempts: number | null
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
          attempts?: number | null
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
          attempts?: number | null
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
          rescue_model_id: string | null
          timeout_ms: number
          updated_at: string
          validator_policy: string
          workload: Database["public"]["Enums"]["ai_workload"]
        }
        Insert: {
          enabled?: boolean
          max_tokens?: number
          model_id: string
          params?: Json
          provider?: string
          rescue_model_id?: string | null
          timeout_ms?: number
          updated_at?: string
          validator_policy?: string
          workload: Database["public"]["Enums"]["ai_workload"]
        }
        Update: {
          enabled?: boolean
          max_tokens?: number
          model_id?: string
          params?: Json
          provider?: string
          rescue_model_id?: string | null
          timeout_ms?: number
          updated_at?: string
          validator_policy?: string
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
      boards: {
        Row: {
          created_at: string
          ends_on: string | null
          id: string
          name: string
          starts_on: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          ends_on?: string | null
          id?: string
          name: string
          starts_on?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          ends_on?: string | null
          id?: string
          name?: string
          starts_on?: string | null
          updated_at?: string
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
      catalog_lookups: {
        Row: {
          cache_key: string
          expires_at: string
          fetched_at: string
          hits: number
          mode: string
          product_count: number
          products: Json | null
          provider: Database["public"]["Enums"]["catalog_provider"]
          terms: string[]
        }
        Insert: {
          cache_key: string
          expires_at: string
          fetched_at?: string
          hits?: number
          mode: string
          product_count?: number
          products?: Json | null
          provider: Database["public"]["Enums"]["catalog_provider"]
          terms?: string[]
        }
        Update: {
          cache_key?: string
          expires_at?: string
          fetched_at?: string
          hits?: number
          mode?: string
          product_count?: number
          products?: Json | null
          provider?: Database["public"]["Enums"]["catalog_provider"]
          terms?: string[]
        }
        Relationships: []
      }
      catalog_merchants: {
        Row: {
          active: boolean
          approved_at: string
          external_id: string
          feed_locale: string | null
          id: string
          name: string
          network: string
          sync_error: string | null
          synced_at: string | null
        }
        Insert: {
          active?: boolean
          approved_at?: string
          external_id: string
          feed_locale?: string | null
          id?: string
          name: string
          network: string
          sync_error?: string | null
          synced_at?: string | null
        }
        Update: {
          active?: boolean
          approved_at?: string
          external_id?: string
          feed_locale?: string | null
          id?: string
          name?: string
          network?: string
          sync_error?: string | null
          synced_at?: string | null
        }
        Relationships: []
      }
      catalog_products: {
        Row: {
          availability: string
          brand: string | null
          colour: string | null
          currency: string | null
          external_id: string
          google_category: string | null
          id: string
          image_url: string
          merchant_id: string
          price_cents: number | null
          product_url: string
          slot: string | null
          title: string
          updated_at: string
        }
        Insert: {
          availability?: string
          brand?: string | null
          colour?: string | null
          currency?: string | null
          external_id: string
          google_category?: string | null
          id?: string
          image_url: string
          merchant_id: string
          price_cents?: number | null
          product_url: string
          slot?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          availability?: string
          brand?: string | null
          colour?: string | null
          currency?: string | null
          external_id?: string
          google_category?: string | null
          id?: string
          image_url?: string
          merchant_id?: string
          price_cents?: number | null
          product_url?: string
          slot?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "catalog_products_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "catalog_merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      catalog_quota: {
        Row: {
          bill_day: number | null
          cache_write_failures: number
          cycle_start: string
          limit_total: number | null
          provider: Database["public"]["Enums"]["catalog_provider"]
          reserve: number
          updated_at: string
          used: number
        }
        Insert: {
          bill_day?: number | null
          cache_write_failures?: number
          cycle_start: string
          limit_total?: number | null
          provider: Database["public"]["Enums"]["catalog_provider"]
          reserve?: number
          updated_at?: string
          used?: number
        }
        Update: {
          bill_day?: number | null
          cache_write_failures?: number
          cycle_start?: string
          limit_total?: number | null
          provider?: Database["public"]["Enums"]["catalog_provider"]
          reserve?: number
          updated_at?: string
          used?: number
        }
        Relationships: []
      }
      catalogue_demand_daily: {
        Row: {
          audience: string | null
          brand_slug: string | null
          colour_family: string | null
          day: string
          family_opens: number
          first_seen_at: string
          garment_class: string | null
          import_attempts: number
          import_successes: number
          intent_key: string
          latency_fast: number
          latency_medium: number
          latency_slow: number
          searches: number
          updated_at: string
          zero_result_searches: number
        }
        Insert: {
          audience?: string | null
          brand_slug?: string | null
          colour_family?: string | null
          day?: string
          family_opens?: number
          first_seen_at?: string
          garment_class?: string | null
          import_attempts?: number
          import_successes?: number
          intent_key: string
          latency_fast?: number
          latency_medium?: number
          latency_slow?: number
          searches?: number
          updated_at?: string
          zero_result_searches?: number
        }
        Update: {
          audience?: string | null
          brand_slug?: string | null
          colour_family?: string | null
          day?: string
          family_opens?: number
          first_seen_at?: string
          garment_class?: string | null
          import_attempts?: number
          import_successes?: number
          intent_key?: string
          latency_fast?: number
          latency_medium?: number
          latency_slow?: number
          searches?: number
          updated_at?: string
          zero_result_searches?: number
        }
        Relationships: []
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
      circle_members: {
        Row: {
          circle_id: string
          created_at: string
          invited_by: string | null
          role: Database["public"]["Enums"]["circle_member_role"]
          state: Database["public"]["Enums"]["circle_member_state"]
          updated_at: string
          user_id: string
        }
        Insert: {
          circle_id: string
          created_at?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["circle_member_role"]
          state?: Database["public"]["Enums"]["circle_member_state"]
          updated_at?: string
          user_id: string
        }
        Update: {
          circle_id?: string
          created_at?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["circle_member_role"]
          state?: Database["public"]["Enums"]["circle_member_state"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "circle_members_circle_id_fkey"
            columns: ["circle_id"]
            isOneToOne: false
            referencedRelation: "circles"
            referencedColumns: ["id"]
          },
        ]
      }
      circles: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          updated_at?: string
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
            referencedRelation: "friend_worn_outfits"
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
      commerce_alert_sends: {
        Row: {
          key: string
          last_sent_at: string
          send_count: number
        }
        Insert: {
          key: string
          last_sent_at?: string
          send_count?: number
        }
        Update: {
          key?: string
          last_sent_at?: string
          send_count?: number
        }
        Relationships: []
      }
      commerce_health: {
        Row: {
          last_at: string | null
          last_detail: string | null
          metric: string
          updated_at: string
          value: number
        }
        Insert: {
          last_at?: string | null
          last_detail?: string | null
          metric: string
          updated_at?: string
          value?: number
        }
        Update: {
          last_at?: string | null
          last_detail?: string | null
          metric?: string
          updated_at?: string
          value?: number
        }
        Relationships: []
      }
      commerce_joined_programmes: {
        Row: {
          active: boolean
          joined_at: string
          merchant_id: string
          merchant_name: string
          network: string
          note: string | null
        }
        Insert: {
          active?: boolean
          joined_at?: string
          merchant_id: string
          merchant_name: string
          network: string
          note?: string | null
        }
        Update: {
          active?: boolean
          joined_at?: string
          merchant_id?: string
          merchant_name?: string
          network?: string
          note?: string | null
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
      daily_social_reactions: {
        Row: {
          created_at: string
          outfit_id: string
          owner_id: string
          reaction: string
          reactor_id: string
        }
        Insert: {
          created_at?: string
          outfit_id: string
          owner_id: string
          reaction: string
          reactor_id: string
        }
        Update: {
          created_at?: string
          outfit_id?: string
          owner_id?: string
          reaction?: string
          reactor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_social_reactions_outfit_id_fkey"
            columns: ["outfit_id"]
            isOneToOne: false
            referencedRelation: "friend_worn_outfits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_social_reactions_outfit_id_fkey"
            columns: ["outfit_id"]
            isOneToOne: false
            referencedRelation: "outfits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_social_reactions_outfit_id_fkey"
            columns: ["outfit_id"]
            isOneToOne: false
            referencedRelation: "public_outfits"
            referencedColumns: ["id"]
          },
        ]
      }
      data_exports: {
        Row: {
          bytes: number | null
          error: string | null
          expires_at: string | null
          id: string
          object_path: string | null
          ready_at: string | null
          requested_at: string
          status: string
          user_id: string
        }
        Insert: {
          bytes?: number | null
          error?: string | null
          expires_at?: string | null
          id?: string
          object_path?: string | null
          ready_at?: string | null
          requested_at?: string
          status?: string
          user_id: string
        }
        Update: {
          bytes?: number | null
          error?: string | null
          expires_at?: string | null
          id?: string
          object_path?: string | null
          ready_at?: string | null
          requested_at?: string
          status?: string
          user_id?: string
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
            referencedRelation: "friend_worn_outfits"
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
            referencedRelation: "friend_worn_outfits"
            referencedColumns: ["id", "user_id"]
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
          starts_at: string | null
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
          starts_at?: string | null
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
          starts_at?: string | null
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
      intake_drafts: {
        Row: {
          colour_oklch: Json | null
          colour_term: string | null
          confidence: number
          created_at: string
          fabric: string | null
          formality: number | null
          id: string
          image_path: string | null
          name: string
          ordinal: number
          pattern: string | null
          quantity: number
          session_id: string
          slot: string
          state: string
          user_id: string
          utterance: string
          warmth: number | null
        }
        Insert: {
          colour_oklch?: Json | null
          colour_term?: string | null
          confidence?: number
          created_at?: string
          fabric?: string | null
          formality?: number | null
          id?: string
          image_path?: string | null
          name: string
          ordinal: number
          pattern?: string | null
          quantity?: number
          session_id: string
          slot: string
          state?: string
          user_id: string
          utterance: string
          warmth?: number | null
        }
        Update: {
          colour_oklch?: Json | null
          colour_term?: string | null
          confidence?: number
          created_at?: string
          fabric?: string | null
          formality?: number | null
          id?: string
          image_path?: string | null
          name?: string
          ordinal?: number
          pattern?: string | null
          quantity?: number
          session_id?: string
          slot?: string
          state?: string
          user_id?: string
          utterance?: string
          warmth?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "intake_drafts_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "intake_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      intake_sessions: {
        Row: {
          created_at: string
          cursor: number
          duration_ms: number | null
          error_code: string | null
          id: string
          status: string
          transcript: string | null
          unconsumed: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          cursor?: number
          duration_ms?: number | null
          error_code?: string | null
          id?: string
          status?: string
          transcript?: string | null
          unconsumed?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          cursor?: number
          duration_ms?: number | null
          error_code?: string | null
          id?: string
          status?: string
          transcript?: string | null
          unconsumed?: string[]
          updated_at?: string
          user_id?: string
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
          catalog_external_id: string | null
          category: Database["public"]["Enums"]["item_category"]
          color_analysis: Json | null
          colors: Json
          colour_source: string
          condition: string | null
          created_at: string
          cutout_path: string | null
          description: string | null
          fit: Database["public"]["Enums"]["garment_fit"] | null
          formality_score: number | null
          id: string
          image_path: string | null
          intake_draft_id: string | null
          intake_method: string
          is_archived: boolean
          is_for_sale: boolean
          is_public: boolean
          last_worn_at: string | null
          listing_confirmed_at: string | null
          listing_path: string | null
          listing_source_label: string | null
          listing_source_url: string | null
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
          catalog_external_id?: string | null
          category?: Database["public"]["Enums"]["item_category"]
          color_analysis?: Json | null
          colors?: Json
          colour_source?: string
          condition?: string | null
          created_at?: string
          cutout_path?: string | null
          description?: string | null
          fit?: Database["public"]["Enums"]["garment_fit"] | null
          formality_score?: number | null
          id?: string
          image_path?: string | null
          intake_draft_id?: string | null
          intake_method?: string
          is_archived?: boolean
          is_for_sale?: boolean
          is_public?: boolean
          last_worn_at?: string | null
          listing_confirmed_at?: string | null
          listing_path?: string | null
          listing_source_label?: string | null
          listing_source_url?: string | null
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
          catalog_external_id?: string | null
          category?: Database["public"]["Enums"]["item_category"]
          color_analysis?: Json | null
          colors?: Json
          colour_source?: string
          condition?: string | null
          created_at?: string
          cutout_path?: string | null
          description?: string | null
          fit?: Database["public"]["Enums"]["garment_fit"] | null
          formality_score?: number | null
          id?: string
          image_path?: string | null
          intake_draft_id?: string | null
          intake_method?: string
          is_archived?: boolean
          is_for_sale?: boolean
          is_public?: boolean
          last_worn_at?: string | null
          listing_confirmed_at?: string | null
          listing_path?: string | null
          listing_source_label?: string | null
          listing_source_url?: string | null
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
        Relationships: [
          {
            foreignKeyName: "items_intake_draft_id_fkey"
            columns: ["intake_draft_id"]
            isOneToOne: false
            referencedRelation: "intake_drafts"
            referencedColumns: ["id"]
          },
        ]
      }
      moderation_terms: {
        Row: {
          created_at: string
          match_squeezed: boolean
          note: string | null
          term: string
        }
        Insert: {
          created_at?: string
          match_squeezed?: boolean
          note?: string | null
          term: string
        }
        Update: {
          created_at?: string
          match_squeezed?: boolean
          note?: string | null
          term?: string
        }
        Relationships: []
      }
      notification_prefs: {
        Row: {
          borrow_requests: boolean
          created_at: string
          event_reminders: boolean
          friend_activity: boolean
          morning_edit: boolean
          morning_edit_at: string
          updated_at: string
          user_id: string
          votes_comments: boolean
        }
        Insert: {
          borrow_requests?: boolean
          created_at?: string
          event_reminders?: boolean
          friend_activity?: boolean
          morning_edit?: boolean
          morning_edit_at?: string
          updated_at?: string
          user_id: string
          votes_comments?: boolean
        }
        Update: {
          borrow_requests?: boolean
          created_at?: string
          event_reminders?: boolean
          friend_activity?: boolean
          morning_edit?: boolean
          morning_edit_at?: string
          updated_at?: string
          user_id?: string
          votes_comments?: boolean
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
            referencedRelation: "friend_worn_outfits"
            referencedColumns: ["id"]
          },
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
            referencedRelation: "friend_worn_outfits"
            referencedColumns: ["id", "user_id"]
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
            referencedRelation: "friend_worn_outfits"
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
          {
            foreignKeyName: "outfit_items_outfit_same_user"
            columns: ["outfit_id", "user_id"]
            isOneToOne: false
            referencedRelation: "friend_worn_outfits"
            referencedColumns: ["id", "user_id"]
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
            referencedRelation: "friend_worn_outfits"
            referencedColumns: ["id"]
          },
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
            referencedRelation: "friend_worn_outfits"
            referencedColumns: ["id", "user_id"]
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
          board_id: string | null
          context_snapshot: Json | null
          created_at: string
          favorited_at: string | null
          generated_by: Database["public"]["Enums"]["outfit_source"]
          id: string
          is_public: boolean
          name: string | null
          note: string | null
          occasion: string | null
          origin_outfit_id: string | null
          rating: number | null
          rating_reason: string | null
          reasoning: string | null
          saved_at: string | null
          user_id: string
          wear_rating: number | null
          worn_at: string | null
        }
        Insert: {
          board_id?: string | null
          context_snapshot?: Json | null
          created_at?: string
          favorited_at?: string | null
          generated_by?: Database["public"]["Enums"]["outfit_source"]
          id?: string
          is_public?: boolean
          name?: string | null
          note?: string | null
          occasion?: string | null
          origin_outfit_id?: string | null
          rating?: number | null
          rating_reason?: string | null
          reasoning?: string | null
          saved_at?: string | null
          user_id: string
          wear_rating?: number | null
          worn_at?: string | null
        }
        Update: {
          board_id?: string | null
          context_snapshot?: Json | null
          created_at?: string
          favorited_at?: string | null
          generated_by?: Database["public"]["Enums"]["outfit_source"]
          id?: string
          is_public?: boolean
          name?: string | null
          note?: string | null
          occasion?: string | null
          origin_outfit_id?: string | null
          rating?: number | null
          rating_reason?: string | null
          reasoning?: string | null
          saved_at?: string | null
          user_id?: string
          wear_rating?: number | null
          worn_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "outfits_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "boards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outfits_origin_outfit_id_fkey"
            columns: ["origin_outfit_id"]
            isOneToOne: false
            referencedRelation: "friend_worn_outfits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outfits_origin_outfit_id_fkey"
            columns: ["origin_outfit_id"]
            isOneToOne: false
            referencedRelation: "outfits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outfits_origin_outfit_id_fkey"
            columns: ["origin_outfit_id"]
            isOneToOne: false
            referencedRelation: "public_outfits"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          activity_seen_at: string | null
          ai_consent_at: string | null
          ai_consent_revoked_at: string | null
          ai_consent_version: number | null
          avatar_url: string | null
          bio: string | null
          closet_hidden: boolean
          color_season: string | null
          created_at: string
          deletion_requested_at: string | null
          display_name: string | null
          dress_occasions: string[]
          follower_count: number
          following_count: number
          gender_presentation: string | null
          home_city: string | null
          invited_at: string | null
          invited_by: string | null
          life_stage: string | null
          onboarding_complete: boolean
          preference_summary: string | null
          preference_summary_updated_at: string | null
          shoppable: boolean
          show_where_to_buy: boolean
          sizes: Json
          social_terms_at: string | null
          social_terms_version: number | null
          stat_cost_per_wear_hidden: boolean
          stat_pieces_hidden: boolean
          stat_wears_hidden: boolean
          style_profile_prompted_at: string | null
          style_tags: string[]
          time_zone: string | null
          toured_at: string | null
          units: string
          updated_at: string
          user_id: string
          username: string | null
          visibility: Database["public"]["Enums"]["profile_visibility"]
          worn_outfits_shared_since: string | null
        }
        Insert: {
          activity_seen_at?: string | null
          ai_consent_at?: string | null
          ai_consent_revoked_at?: string | null
          ai_consent_version?: number | null
          avatar_url?: string | null
          bio?: string | null
          closet_hidden?: boolean
          color_season?: string | null
          created_at?: string
          deletion_requested_at?: string | null
          display_name?: string | null
          dress_occasions?: string[]
          follower_count?: number
          following_count?: number
          gender_presentation?: string | null
          home_city?: string | null
          invited_at?: string | null
          invited_by?: string | null
          life_stage?: string | null
          onboarding_complete?: boolean
          preference_summary?: string | null
          preference_summary_updated_at?: string | null
          shoppable?: boolean
          show_where_to_buy?: boolean
          sizes?: Json
          social_terms_at?: string | null
          social_terms_version?: number | null
          stat_cost_per_wear_hidden?: boolean
          stat_pieces_hidden?: boolean
          stat_wears_hidden?: boolean
          style_profile_prompted_at?: string | null
          style_tags?: string[]
          time_zone?: string | null
          toured_at?: string | null
          units?: string
          updated_at?: string
          user_id: string
          username?: string | null
          visibility?: Database["public"]["Enums"]["profile_visibility"]
          worn_outfits_shared_since?: string | null
        }
        Update: {
          activity_seen_at?: string | null
          ai_consent_at?: string | null
          ai_consent_revoked_at?: string | null
          ai_consent_version?: number | null
          avatar_url?: string | null
          bio?: string | null
          closet_hidden?: boolean
          color_season?: string | null
          created_at?: string
          deletion_requested_at?: string | null
          display_name?: string | null
          dress_occasions?: string[]
          follower_count?: number
          following_count?: number
          gender_presentation?: string | null
          home_city?: string | null
          invited_at?: string | null
          invited_by?: string | null
          life_stage?: string | null
          onboarding_complete?: boolean
          preference_summary?: string | null
          preference_summary_updated_at?: string | null
          shoppable?: boolean
          show_where_to_buy?: boolean
          sizes?: Json
          social_terms_at?: string | null
          social_terms_version?: number | null
          stat_cost_per_wear_hidden?: boolean
          stat_pieces_hidden?: boolean
          stat_wears_hidden?: boolean
          style_profile_prompted_at?: string | null
          style_tags?: string[]
          time_zone?: string | null
          toured_at?: string | null
          units?: string
          updated_at?: string
          user_id?: string
          username?: string | null
          visibility?: Database["public"]["Enums"]["profile_visibility"]
          worn_outfits_shared_since?: string | null
        }
        Relationships: []
      }
      push_receipts: {
        Row: {
          attempts: number
          channel: string
          created_at: string
          last_attempt_at: string | null
          ticket_id: string
          token: string
        }
        Insert: {
          attempts?: number
          channel: string
          created_at?: string
          last_attempt_at?: string | null
          ticket_id: string
          token: string
        }
        Update: {
          attempts?: number
          channel?: string
          created_at?: string
          last_attempt_at?: string | null
          ticket_id?: string
          token?: string
        }
        Relationships: []
      }
      push_sends: {
        Row: {
          channel: string
          dedupe_key: string
          sent_at: string
          user_id: string
        }
        Insert: {
          channel: string
          dedupe_key: string
          sent_at?: string
          user_id: string
        }
        Update: {
          channel?: string
          dedupe_key?: string
          sent_at?: string
          user_id?: string
        }
        Relationships: []
      }
      push_tokens: {
        Row: {
          created_at: string
          id: string
          last_seen_at: string
          platform: string
          token: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_seen_at?: string
          platform?: string
          token: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_seen_at?: string
          platform?: string
          token?: string
          user_id?: string
        }
        Relationships: []
      }
      saved_looks: {
        Row: {
          collection_id: string | null
          created_at: string
          id: string
          note: string | null
          owner_id: string
          snap_image_url: string | null
          snap_saved_at: string
          snap_source_label: string
          snap_source_visibility: string
          snap_title: string | null
          source_id: string
          source_owner_id: string | null
          source_type: Database["public"]["Enums"]["saved_look_source"]
          updated_at: string
        }
        Insert: {
          collection_id?: string | null
          created_at?: string
          id?: string
          note?: string | null
          owner_id: string
          snap_image_url?: string | null
          snap_saved_at: string
          snap_source_label: string
          snap_source_visibility: string
          snap_title?: string | null
          source_id: string
          source_owner_id?: string | null
          source_type: Database["public"]["Enums"]["saved_look_source"]
          updated_at?: string
        }
        Update: {
          collection_id?: string | null
          created_at?: string
          id?: string
          note?: string | null
          owner_id?: string
          snap_image_url?: string | null
          snap_saved_at?: string
          snap_source_label?: string
          snap_source_visibility?: string
          snap_title?: string | null
          source_id?: string
          source_owner_id?: string | null
          source_type?: Database["public"]["Enums"]["saved_look_source"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_looks_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "boards"
            referencedColumns: ["id"]
          },
        ]
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
            referencedRelation: "friend_worn_outfits"
            referencedColumns: ["id"]
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
            referencedRelation: "friend_worn_outfits"
            referencedColumns: ["id", "user_id"]
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
      stylist_chat_reservations: {
        Row: {
          created_at: string
          id: string
          period_start: string
          settled_at: string | null
          state: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          period_start: string
          settled_at?: string | null
          state: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          period_start?: string
          settled_at?: string | null
          state?: string
          user_id?: string
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
      superwall_events: {
        Row: {
          app_user_id: string
          delivery_count: number
          event_type: string
          expiration_at: string | null
          last_delivery_at: string
          original_transaction_id: string | null
          outcome: Database["public"]["Enums"]["superwall_outcome"]
          plan: string | null
          product_id: string | null
          received_at: string
          reconciled_at: string | null
          reconciled_user_id: string | null
          svix_id: string
        }
        Insert: {
          app_user_id: string
          delivery_count?: number
          event_type: string
          expiration_at?: string | null
          last_delivery_at?: string
          original_transaction_id?: string | null
          outcome: Database["public"]["Enums"]["superwall_outcome"]
          plan?: string | null
          product_id?: string | null
          received_at?: string
          reconciled_at?: string | null
          reconciled_user_id?: string | null
          svix_id: string
        }
        Update: {
          app_user_id?: string
          delivery_count?: number
          event_type?: string
          expiration_at?: string | null
          last_delivery_at?: string
          original_transaction_id?: string | null
          outcome?: Database["public"]["Enums"]["superwall_outcome"]
          plan?: string | null
          product_id?: string | null
          received_at?: string
          reconciled_at?: string | null
          reconciled_user_id?: string | null
          svix_id?: string
        }
        Relationships: []
      }
      support_sends: {
        Row: {
          id: string
          sent_at: string
          topic: string
          user_id: string
        }
        Insert: {
          id?: string
          sent_at?: string
          topic: string
          user_id: string
        }
        Update: {
          id?: string
          sent_at?: string
          topic?: string
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
      trips: {
        Row: {
          companions: string
          created_at: string
          ends_on: string
          friend_ids: string[]
          id: string
          item_ids: string[]
          latitude: number
          longitude: number
          look_count: number | null
          memo: Json | null
          note: string
          parts: string[]
          piece_count: number | null
          place_admin1: string
          place_country: string
          place_name: string
          saved_at: string | null
          starts_on: string
          updated_at: string
          user_id: string
          vibes: string[]
          weather_source: string
        }
        Insert: {
          companions: string
          created_at?: string
          ends_on: string
          friend_ids?: string[]
          id?: string
          item_ids?: string[]
          latitude: number
          longitude: number
          look_count?: number | null
          memo?: Json | null
          note?: string
          parts: string[]
          piece_count?: number | null
          place_admin1?: string
          place_country?: string
          place_name: string
          saved_at?: string | null
          starts_on: string
          updated_at?: string
          user_id: string
          vibes: string[]
          weather_source?: string
        }
        Update: {
          companions?: string
          created_at?: string
          ends_on?: string
          friend_ids?: string[]
          id?: string
          item_ids?: string[]
          latitude?: number
          longitude?: number
          look_count?: number | null
          memo?: Json | null
          note?: string
          parts?: string[]
          piece_count?: number | null
          place_admin1?: string
          place_country?: string
          place_name?: string
          saved_at?: string | null
          starts_on?: string
          updated_at?: string
          user_id?: string
          vibes?: string[]
          weather_source?: string
        }
        Relationships: []
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
      waitlist: {
        Row: {
          created_at: string
          email: string
          id: string
          notified_at: string | null
          source: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          notified_at?: string | null
          source?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          notified_at?: string | null
          source?: string
        }
        Relationships: []
      }
      waitlist_throttle: {
        Row: {
          client_hash: string
          hits: number
          window_start: string
        }
        Insert: {
          client_hash: string
          hits?: number
          window_start?: string
        }
        Update: {
          client_hash?: string
          hits?: number
          window_start?: string
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
      friend_closet_meta: {
        Row: {
          bio: string | null
          closet_hidden: boolean | null
          cost_per_wear: number | null
          pieces: number | null
          user_id: string | null
          wears_logged: number | null
        }
        Relationships: []
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
          last_worn_at: string | null
          material: string | null
          occasions: string[] | null
          pattern: string | null
          plate_path: string | null
          seasons: string[] | null
          shoppable: boolean | null
          subcategory: string | null
          thumb_path: string | null
          user_id: string | null
          wear_count: number | null
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
          last_worn_at?: string | null
          material?: string | null
          occasions?: string[] | null
          pattern?: string | null
          plate_path?: string | null
          seasons?: string[] | null
          shoppable?: never
          subcategory?: string | null
          thumb_path?: string | null
          user_id?: string | null
          wear_count?: number | null
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
          last_worn_at?: string | null
          material?: string | null
          occasions?: string[] | null
          pattern?: string | null
          plate_path?: string | null
          seasons?: string[] | null
          shoppable?: never
          subcategory?: string | null
          thumb_path?: string | null
          user_id?: string | null
          wear_count?: number | null
        }
        Relationships: []
      }
      friend_worn_outfit_items: {
        Row: {
          item_id: string | null
          outfit_id: string | null
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
            referencedRelation: "friend_worn_outfits"
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
      friend_worn_outfits: {
        Row: {
          id: string | null
          name: string | null
          user_id: string | null
          worn_at: string | null
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
            referencedRelation: "friend_worn_outfits"
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
            referencedRelation: "friend_worn_outfits"
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
      saved_looks_resolved: {
        Row: {
          availability: string | null
          collection_id: string | null
          created_at: string | null
          id: string | null
          note: string | null
          owner_id: string | null
          snap_image_url: string | null
          snap_saved_at: string | null
          snap_source_label: string | null
          snap_source_visibility: string | null
          snap_title: string | null
          source_id: string | null
          source_owner_id: string | null
          source_type: Database["public"]["Enums"]["saved_look_source"] | null
          updated_at: string | null
        }
        Insert: {
          availability?: never
          collection_id?: string | null
          created_at?: string | null
          id?: string | null
          note?: string | null
          owner_id?: string | null
          snap_image_url?: string | null
          snap_saved_at?: string | null
          snap_source_label?: string | null
          snap_source_visibility?: string | null
          snap_title?: string | null
          source_id?: string | null
          source_owner_id?: string | null
          source_type?: Database["public"]["Enums"]["saved_look_source"] | null
          updated_at?: string | null
        }
        Update: {
          availability?: never
          collection_id?: string | null
          created_at?: string | null
          id?: string | null
          note?: string | null
          owner_id?: string | null
          snap_image_url?: string | null
          snap_saved_at?: string | null
          snap_source_label?: string | null
          snap_source_visibility?: string | null
          snap_title?: string | null
          source_id?: string | null
          source_owner_id?: string | null
          source_type?: Database["public"]["Enums"]["saved_look_source"] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "saved_looks_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "boards"
            referencedColumns: ["id"]
          },
        ]
      }
      social_profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          display_name: string | null
          user_id: string | null
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          display_name?: string | null
          user_id?: string | null
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          display_name?: string | null
          user_id?: string | null
          username?: string | null
        }
        Relationships: []
      }
      superwall_unreconciled: {
        Row: {
          alias: string | null
          delivery_count: number | null
          event_type: string | null
          original_transaction_id: string | null
          product_id: string | null
          received_at: string | null
          svix_id: string | null
        }
        Insert: {
          alias?: string | null
          delivery_count?: number | null
          event_type?: string | null
          original_transaction_id?: string | null
          product_id?: string | null
          received_at?: string | null
          svix_id?: string | null
        }
        Update: {
          alias?: string | null
          delivery_count?: number | null
          event_type?: string | null
          original_transaction_id?: string | null
          product_id?: string | null
          received_at?: string | null
          svix_id?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      activity_feed: {
        Args: never
        Returns: {
          actor_id: string
          event_id: string
          item_id: string
          kind: string
          occurred_at: string
          outfit_id: string
          post_id: string
          subject_key: string
          tally: number
        }[]
      }
      activity_has_unseen: { Args: never; Returns: boolean }
      apply_invite: {
        Args: { p_handle: string }
        Returns: {
          display_name: string
          inviter_id: string
        }[]
      }
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
      blocked_term_in: { Args: { p_text: string }; Returns: string }
      can_save_source: {
        Args: {
          p_id: string
          p_type: Database["public"]["Enums"]["saved_look_source"]
        }
        Returns: boolean
      }
      can_see_circle: { Args: { p_circle: string }; Returns: boolean }
      can_see_event: { Args: { p_event: string }; Returns: boolean }
      catalog_cycle_start: {
        Args: { p_at?: string; p_bill_day: number }
        Returns: string
      }
      circle_member_count: { Args: { p_circle: string }; Returns: number }
      circle_seats_taken: {
        Args: { p_circle: string; p_except_user: string }
        Returns: number
      }
      claim_ai_quota: {
        Args: {
          p_kind: string
          p_limit: number
          p_period: string
          p_user_id: string
        }
        Returns: Json
      }
      claim_catalog_request: {
        Args: {
          p_exact?: boolean
          p_provider: Database["public"]["Enums"]["catalog_provider"]
        }
        Returns: boolean
      }
      claim_command: {
        Args: { p_kind: string; p_op_id: string; p_user_id: string }
        Returns: {
          already_done: boolean
          existing_result: string
        }[]
      }
      claim_commerce_alert: {
        Args: { p_cooldown_hours?: number; p_key: string }
        Returns: boolean
      }
      claim_stylist_chat: {
        Args: { p_limit: number; p_user_id: string }
        Returns: Json
      }
      claim_superwall_alias: {
        Args: { p_alias: string; p_user_id: string }
        Returns: {
          event_type: string
          expiration_at: string
          product_id: string
          svix_id: string
        }[]
      }
      claim_superwall_event: {
        Args: {
          p_app_user_id: string
          p_event_type: string
          p_expiration_at?: string
          p_original_transaction_id?: string
          p_product_id?: string
          p_svix_id: string
        }
        Returns: boolean
      }
      claim_support_send: {
        Args: { p_topic: string; p_user_id: string }
        Returns: {
          booking_id: string
          refused: string
        }[]
      }
      commerce_health_invoke: { Args: never; Returns: number }
      commerce_health_report: { Args: never; Returns: Json }
      commit_intake_session: {
        Args: { p_draft_ids?: string[]; p_session_id: string }
        Returns: {
          committed: number
          held: number
        }[]
      }
      complete_stylist_chat: {
        Args: { p_limit: number; p_reservation_id: string; p_user_id: string }
        Returns: Json
      }
      current_ai_consent_version: { Args: never; Returns: number }
      current_social_terms_version: { Args: never; Returns: number }
      effective_plan: {
        Args: { p_user_id: string }
        Returns: Database["public"]["Enums"]["subscription_plan"]
      }
      emit_activity_event: {
        Args: {
          p_actor: string
          p_circle: string
          p_payload: Json
          p_recipient: string
          p_subject: string
          p_subject_type: string
          p_type: Database["public"]["Enums"]["activity_event_type"]
        }
        Returns: undefined
      }
      event_is_open: { Args: { p_event_id: string }; Returns: boolean }
      event_limit_for_plan: {
        Args: { p_plan: Database["public"]["Enums"]["subscription_plan"] }
        Returns: number
      }
      export_invoke: { Args: never; Returns: number }
      friends_sharing_worn_outfits_count: { Args: never; Returns: number }
      has_accepted_social_terms: { Args: never; Returns: boolean }
      import_capacity: {
        Args: never
        Returns: {
          active: number
          active_limit: number
          total: number
          total_limit: number
        }[]
      }
      intake_category_for: {
        Args: { p_slot: string }
        Returns: Database["public"]["Enums"]["item_category"]
      }
      invite_arrivals: {
        Args: never
        Returns: {
          display_name: string
          joined_at: string
          user_id: string
          username: string
        }[]
      }
      invite_card: { Args: { p_handle: string }; Returns: string }
      is_circle_member: { Args: { p_circle: string }; Returns: boolean }
      is_circle_owner: { Args: { p_circle: string }; Returns: boolean }
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
      item_total_limit_for_plan: {
        Args: { p_plan: Database["public"]["Enums"]["subscription_plan"] }
        Returns: number
      }
      join_waitlist: {
        Args: { p_client_hash: string; p_email: string; p_source?: string }
        Returns: string
      }
      log_outfit_wear: { Args: { p_outfit_id: string }; Returns: undefined }
      normalize_for_moderation: { Args: { p_text: string }; Returns: string }
      note_catalog_cache_write_failure: {
        Args: { p_provider: Database["public"]["Enums"]["catalog_provider"] }
        Returns: undefined
      }
      note_commerce_metric: {
        Args: { p_delta?: number; p_detail?: string; p_metric: string }
        Returns: undefined
      }
      note_superwall_outcome: {
        Args: {
          p_outcome: Database["public"]["Enums"]["superwall_outcome"]
          p_plan?: string
          p_svix_id: string
        }
        Returns: undefined
      }
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
      purge_activity_events: { Args: never; Returns: undefined }
      push_claim_borrow_requests: {
        Args: never
        Returns: {
          actor_name: string
          dedupe_key: string
          item_label: string
          kind: string
          user_id: string
        }[]
      }
      push_claim_event_reminders: {
        Args: never
        Returns: {
          dedupe_key: string
          event_title: string
          user_id: string
        }[]
      }
      push_claim_friend_activity: {
        Args: never
        Returns: {
          dedupe_key: string
          follow_backs: number
          lead_name: string
          new_pieces: number
          people: number
          user_id: string
        }[]
      }
      push_claim_morning_edit: {
        Args: never
        Returns: {
          dedupe_key: string
          user_id: string
        }[]
      }
      push_claim_receipts: {
        Args: { p_limit?: number }
        Returns: {
          ticket_id: string
          token: string
        }[]
      }
      push_claim_votes_comments: {
        Args: never
        Returns: {
          comments: number
          dedupe_key: string
          user_id: string
          votes: number
        }[]
      }
      push_invoke: { Args: { p_channel: string }; Returns: number }
      push_receipts_invoke: { Args: never; Returns: number }
      push_receipts_prune: { Args: never; Returns: number }
      push_release_claims: {
        Args: { p_channel: string; p_keys: string[]; p_user_ids: string[] }
        Returns: number
      }
      push_sends_prune: { Args: never; Returns: number }
      read_catalog_cache: {
        Args: { p_cache_key: string }
        Returns: {
          is_hit: boolean
          products: Json
        }[]
      }
      reap_intake_audio: { Args: never; Returns: number }
      record_catalogue_demand: {
        Args: {
          p_audience: string
          p_brand_slug: string
          p_colour_family: string
          p_family_opens?: number
          p_garment_class: string
          p_import_attempts?: number
          p_import_successes?: number
          p_latency_bucket?: string
          p_searches?: number
          p_zero_result?: number
        }
        Returns: string
      }
      record_catalogue_demand_by_key: {
        Args: {
          p_family_opens?: number
          p_import_attempts?: number
          p_import_successes?: number
          p_intent_key: string
        }
        Returns: boolean
      }
      release_commerce_alert: { Args: { p_key: string }; Returns: undefined }
      release_stylist_chat: {
        Args: { p_limit: number; p_reservation_id: string; p_user_id: string }
        Returns: Json
      }
      release_support_send: {
        Args: { p_booking_id: string; p_user_id: string }
        Returns: boolean
      }
      request_data_export: { Args: never; Returns: string }
      squeeze_for_moderation: { Args: { p_text: string }; Returns: string }
      stylist_reservation_window: { Args: never; Returns: string }
      sweep_catalog_cache: { Args: never; Returns: number }
      unwear_outfit_tx: {
        Args: { p_op_id: string; p_outfit_id: string }
        Returns: undefined
      }
      username_available: { Args: { p_username: string }; Returns: boolean }
      wear_outfit_tx: {
        Args: {
          p_context?: Json
          p_favorite?: boolean
          p_item_ids: string[]
          p_name?: string
          p_note?: string
          p_op_id: string
          p_origin?: string
          p_reasoning?: string
          p_source?: Database["public"]["Enums"]["outfit_source"]
          p_wear_rating?: number
        }
        Returns: string
      }
    }
    Enums: {
      activity_event_type:
        | "circle.invite.received"
        | "circle.invite.accepted"
        | "circle.invite.declined"
        | "circle.member.joined"
        | "circle.member.left"
        | "circle.self.left"
        | "daily.reaction.received"
        | "outfit.saved.shared"
      ai_workload:
        | "tagging"
        | "outfit_generation"
        | "stylist_chat"
        | "garment_search"
        | "voice_transcription"
        | "closet_parsing"
        | "packing_brief"
        | "inspiration"
      catalog_provider: "datafeedr" | "sovrn" | "amazon"
      circle_member_role: "owner" | "member"
      circle_member_state:
        | "invited"
        | "joined"
        | "declined"
        | "removed"
        | "left"
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
      saved_look_source: "own_outfit" | "daily_look" | "event_look"
      subscription_plan: "free" | "standard" | "pro"
      superwall_outcome:
        | "applied"
        | "no_state_change"
        | "unidentified_alias"
        | "unmapped_product"
        | "stale"
        | "duplicate"
        | "write_failed"
        | "reconciled"
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
      activity_event_type: [
        "circle.invite.received",
        "circle.invite.accepted",
        "circle.invite.declined",
        "circle.member.joined",
        "circle.member.left",
        "circle.self.left",
        "daily.reaction.received",
        "outfit.saved.shared",
      ],
      ai_workload: [
        "tagging",
        "outfit_generation",
        "stylist_chat",
        "garment_search",
        "voice_transcription",
        "closet_parsing",
        "packing_brief",
        "inspiration",
      ],
      catalog_provider: ["datafeedr", "sovrn", "amazon"],
      circle_member_role: ["owner", "member"],
      circle_member_state: ["invited", "joined", "declined", "removed", "left"],
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
      saved_look_source: ["own_outfit", "daily_look", "event_look"],
      subscription_plan: ["free", "standard", "pro"],
      superwall_outcome: [
        "applied",
        "no_state_change",
        "unidentified_alias",
        "unmapped_product",
        "stale",
        "duplicate",
        "write_failed",
        "reconciled",
      ],
    },
  },
} as const
