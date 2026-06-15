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
      agent_logs: {
        Row: {
          agent_id: string
          agent_slug: string
          created_at: string
          duration_ms: number | null
          error_message: string | null
          id: string
          input_summary: string | null
          output_summary: string | null
          run_id: string
          status: string
          token_usage: Json | null
        }
        Insert: {
          agent_id: string
          agent_slug: string
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          input_summary?: string | null
          output_summary?: string | null
          run_id: string
          status: string
          token_usage?: Json | null
        }
        Update: {
          agent_id?: string
          agent_slug?: string
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          input_summary?: string | null
          output_summary?: string | null
          run_id?: string
          status?: string
          token_usage?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_logs_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_logs_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "agent_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_runs: {
        Row: {
          completed_at: string | null
          error_message: string | null
          id: string
          lead_limit: number
          started_at: string
          status: string
          summary: Json | null
          triggered_by: string | null
        }
        Insert: {
          completed_at?: string | null
          error_message?: string | null
          id?: string
          lead_limit?: number
          started_at?: string
          status?: string
          summary?: Json | null
          triggered_by?: string | null
        }
        Update: {
          completed_at?: string | null
          error_message?: string | null
          id?: string
          lead_limit?: number
          started_at?: string
          status?: string
          summary?: Json | null
          triggered_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_runs_triggered_by_fkey"
            columns: ["triggered_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_agents: {
        Row: {
          config: Json
          created_at: string
          description: string | null
          id: string
          instructions: string
          is_enabled: boolean
          model: string
          name: string
          pipeline_order: number
          slug: string
          updated_at: string
        }
        Insert: {
          config?: Json
          created_at?: string
          description?: string | null
          id?: string
          instructions: string
          is_enabled?: boolean
          model?: string
          name: string
          pipeline_order: number
          slug: string
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          description?: string | null
          id?: string
          instructions?: string
          is_enabled?: boolean
          model?: string
          name?: string
          pipeline_order?: number
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      batch_sync_settings: {
        Row: {
          equity_max: number | null
          id: number
          ingest_source: string
          page_size: number
          property_type: string | null
          quick_list: string
          states: string[]
          updated_at: string
        }
        Insert: {
          equity_max?: number | null
          id?: number
          ingest_source?: string
          page_size?: number
          property_type?: string | null
          quick_list?: string
          states?: string[]
          updated_at?: string
        }
        Update: {
          equity_max?: number | null
          id?: number
          ingest_source?: string
          page_size?: number
          property_type?: string | null
          quick_list?: string
          states?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      bridge_mls_sync_profiles: {
        Row: {
          condition_filters: string[]
          created_at: string
          dataset_id: string
          display_name: string
          enabled: boolean
          id: string
          integration_id: string
          keyword_filters: string[]
          last_synced_at: string | null
          last_test_error: string | null
          last_test_status: string | null
          last_tested_at: string | null
          odata_filter_override: string | null
          page_size: number
          select_fields: string[]
          sort_order: string
          state_allowlist: string[]
          updated_at: string
        }
        Insert: {
          condition_filters?: string[]
          created_at?: string
          dataset_id: string
          display_name: string
          enabled?: boolean
          id?: string
          integration_id: string
          keyword_filters?: string[]
          last_synced_at?: string | null
          last_test_error?: string | null
          last_test_status?: string | null
          last_tested_at?: string | null
          odata_filter_override?: string | null
          page_size?: number
          select_fields?: string[]
          sort_order?: string
          state_allowlist?: string[]
          updated_at?: string
        }
        Update: {
          condition_filters?: string[]
          created_at?: string
          dataset_id?: string
          display_name?: string
          enabled?: boolean
          id?: string
          integration_id?: string
          keyword_filters?: string[]
          last_synced_at?: string | null
          last_test_error?: string | null
          last_test_status?: string | null
          last_tested_at?: string | null
          odata_filter_override?: string | null
          page_size?: number
          select_fields?: string[]
          sort_order?: string
          state_allowlist?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bridge_mls_sync_profiles_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "integrations"
            referencedColumns: ["id"]
          },
        ]
      }
      bridge_property_raw: {
        Row: {
          id: string
          list_agent_key: string | null
          listing_id: string
          profile_id: string
          raw_payload: Json
          synced_at: string
        }
        Insert: {
          id?: string
          list_agent_key?: string | null
          listing_id: string
          profile_id: string
          raw_payload?: Json
          synced_at?: string
        }
        Update: {
          id?: string
          list_agent_key?: string | null
          listing_id?: string
          profile_id?: string
          raw_payload?: Json
          synced_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bridge_property_raw_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "bridge_mls_sync_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      county_scrape_runs: {
        Row: {
          completed_at: string | null
          county_source_id: string | null
          error_message: string | null
          id: string
          raw_preview: string | null
          records_found: number | null
          records_inserted: number | null
          records_skipped: number | null
          started_at: string
          status: string
        }
        Insert: {
          completed_at?: string | null
          county_source_id?: string | null
          error_message?: string | null
          id?: string
          raw_preview?: string | null
          records_found?: number | null
          records_inserted?: number | null
          records_skipped?: number | null
          started_at?: string
          status?: string
        }
        Update: {
          completed_at?: string | null
          county_source_id?: string | null
          error_message?: string | null
          id?: string
          raw_preview?: string | null
          records_found?: number | null
          records_inserted?: number | null
          records_skipped?: number | null
          started_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "county_scrape_runs_county_source_id_fkey"
            columns: ["county_source_id"]
            isOneToOne: false
            referencedRelation: "county_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      county_sources: {
        Row: {
          apify_actor_id: string | null
          county_fips: string | null
          created_at: string
          id: string
          is_active: boolean
          last_record_count: number | null
          last_scraped_at: string | null
          name: string
          notes: string | null
          schedule: string
          scrape_method: string
          scrape_url: string
          state: string
          updated_at: string
          url_params: Json | null
        }
        Insert: {
          apify_actor_id?: string | null
          county_fips?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          last_record_count?: number | null
          last_scraped_at?: string | null
          name: string
          notes?: string | null
          schedule?: string
          scrape_method?: string
          scrape_url: string
          state?: string
          updated_at?: string
          url_params?: Json | null
        }
        Update: {
          apify_actor_id?: string | null
          county_fips?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          last_record_count?: number | null
          last_scraped_at?: string | null
          name?: string
          notes?: string | null
          schedule?: string
          scrape_method?: string
          scrape_url?: string
          state?: string
          updated_at?: string
          url_params?: Json | null
        }
        Relationships: []
      }
      integration_api_logs: {
        Row: {
          created_at: string
          credential_id: string | null
          direction: string
          endpoint: string
          error_message: string | null
          id: string
          integration_id: string
          latency_ms: number | null
          method: string
          request_size_bytes: number | null
          response_size_bytes: number | null
          status_code: number | null
        }
        Insert: {
          created_at?: string
          credential_id?: string | null
          direction?: string
          endpoint: string
          error_message?: string | null
          id?: string
          integration_id: string
          latency_ms?: number | null
          method: string
          request_size_bytes?: number | null
          response_size_bytes?: number | null
          status_code?: number | null
        }
        Update: {
          created_at?: string
          credential_id?: string | null
          direction?: string
          endpoint?: string
          error_message?: string | null
          id?: string
          integration_id?: string
          latency_ms?: number | null
          method?: string
          request_size_bytes?: number | null
          response_size_bytes?: number | null
          status_code?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "integration_api_logs_credential_id_fkey"
            columns: ["credential_id"]
            isOneToOne: false
            referencedRelation: "integration_credentials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integration_api_logs_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "integrations"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_credentials: {
        Row: {
          base_url: string | null
          configured_by: string | null
          created_at: string
          credentials_iv: string
          encrypted_credentials: string
          id: string
          integration_id: string
          last_test_error: string | null
          last_test_status: string | null
          last_tested_at: string | null
          oauth_access_token: string | null
          oauth_authorization_url: string | null
          oauth_refresh_token: string | null
          oauth_token_expires_at: string | null
          oauth_token_url: string | null
          status: string
          updated_at: string
          webhook_secret: string | null
        }
        Insert: {
          base_url?: string | null
          configured_by?: string | null
          created_at?: string
          credentials_iv: string
          encrypted_credentials: string
          id?: string
          integration_id: string
          last_test_error?: string | null
          last_test_status?: string | null
          last_tested_at?: string | null
          oauth_access_token?: string | null
          oauth_authorization_url?: string | null
          oauth_refresh_token?: string | null
          oauth_token_expires_at?: string | null
          oauth_token_url?: string | null
          status?: string
          updated_at?: string
          webhook_secret?: string | null
        }
        Update: {
          base_url?: string | null
          configured_by?: string | null
          created_at?: string
          credentials_iv?: string
          encrypted_credentials?: string
          id?: string
          integration_id?: string
          last_test_error?: string | null
          last_test_status?: string | null
          last_tested_at?: string | null
          oauth_access_token?: string | null
          oauth_authorization_url?: string | null
          oauth_refresh_token?: string | null
          oauth_token_expires_at?: string | null
          oauth_token_url?: string | null
          status?: string
          updated_at?: string
          webhook_secret?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "integration_credentials_configured_by_fkey"
            columns: ["configured_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integration_credentials_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "integrations"
            referencedColumns: ["id"]
          },
        ]
      }
      integrations: {
        Row: {
          auth_method: string
          category: string
          created_at: string
          default_base_url: string | null
          description: string | null
          health_check_endpoint: string | null
          icon_url: string | null
          id: string
          is_builtin: boolean
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          auth_method: string
          category?: string
          created_at?: string
          default_base_url?: string | null
          description?: string | null
          health_check_endpoint?: string | null
          icon_url?: string | null
          id?: string
          is_builtin?: boolean
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          auth_method?: string
          category?: string
          created_at?: string
          default_base_url?: string | null
          description?: string | null
          health_check_endpoint?: string | null
          icon_url?: string | null
          id?: string
          is_builtin?: boolean
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      inventory_leads: {
        Row: {
          address: string
          apn: string | null
          assigned_rep_id: string | null
          batch_list_id: number | null
          batch_list_name: string | null
          city: string
          contact_attempts: number
          county: string
          days_to_auction: number
          email: string | null
          equity_pct: number
          external_id: string
          filing_type: string | null
          id: string
          ingested_at: string
          language: string
          last_contact_date: string | null
          last_outcome: string | null
          lead_type: string
          ltv_pct: number | null
          normalized_address: string | null
          owner: string
          phone: string | null
          pipeline_stage: string | null
          raw_payload: Json | null
          received_at: string
          score: number
          source: string
          state: string
          status: string
          synced_at: string
        }
        Insert: {
          address?: string
          apn?: string | null
          assigned_rep_id?: string | null
          batch_list_id?: number | null
          batch_list_name?: string | null
          city?: string
          contact_attempts?: number
          county?: string
          days_to_auction?: number
          email?: string | null
          equity_pct?: number
          external_id: string
          filing_type?: string | null
          id: string
          ingested_at?: string
          language?: string
          last_contact_date?: string | null
          last_outcome?: string | null
          lead_type?: string
          ltv_pct?: number | null
          normalized_address?: string | null
          owner?: string
          phone?: string | null
          pipeline_stage?: string | null
          raw_payload?: Json | null
          received_at?: string
          score?: number
          source?: string
          state?: string
          status?: string
          synced_at?: string
        }
        Update: {
          address?: string
          apn?: string | null
          assigned_rep_id?: string | null
          batch_list_id?: number | null
          batch_list_name?: string | null
          city?: string
          contact_attempts?: number
          county?: string
          days_to_auction?: number
          email?: string | null
          equity_pct?: number
          external_id?: string
          filing_type?: string | null
          id?: string
          ingested_at?: string
          language?: string
          last_contact_date?: string | null
          last_outcome?: string | null
          lead_type?: string
          ltv_pct?: number | null
          normalized_address?: string | null
          owner?: string
          phone?: string | null
          pipeline_stage?: string | null
          raw_payload?: Json | null
          received_at?: string
          score?: number
          source?: string
          state?: string
          status?: string
          synced_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_leads_assigned_rep_id_fkey"
            columns: ["assigned_rep_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_round_robin_state: {
        Row: {
          next_index: number
          scope: string
          updated_at: string
        }
        Insert: {
          next_index?: number
          scope?: string
          updated_at?: string
        }
        Update: {
          next_index?: number
          scope?: string
          updated_at?: string
        }
        Relationships: []
      }
      inventory_sync_runs: {
        Row: {
          completed_at: string | null
          error_message: string | null
          id: string
          leads_upserted: number
          lists_processed: number
          metadata: Json
          source: string
          started_at: string
          status: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          error_message?: string | null
          id?: string
          leads_upserted?: number
          lists_processed?: number
          metadata?: Json
          source?: string
          started_at?: string
          status?: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          error_message?: string | null
          id?: string
          leads_upserted?: number
          lists_processed?: number
          metadata?: Json
          source?: string
          started_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      lead_ai_results: {
        Row: {
          created_at: string
          decision: string | null
          id: string
          lead_id: string
          notes: string | null
          run_id: string | null
          score: number | null
          score_reason: string | null
          script: string | null
        }
        Insert: {
          created_at?: string
          decision?: string | null
          id?: string
          lead_id: string
          notes?: string | null
          run_id?: string | null
          score?: number | null
          score_reason?: string | null
          script?: string | null
        }
        Update: {
          created_at?: string
          decision?: string | null
          id?: string
          lead_id?: string
          notes?: string | null
          run_id?: string | null
          score?: number | null
          score_reason?: string | null
          script?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_ai_results_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "agent_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      mls_agent_leads: {
        Row: {
          agent_email: string
          agent_name: string
          agent_phone: string
          assigned_rep: string | null
          brokerage: string
          created_at: string
          dataset_id: string
          external_id: string
          id: string
          language: string
          last_contact_at: string | null
          latest_city: string | null
          latest_days_on_market: number | null
          latest_list_price: number | null
          latest_listing_id: string | null
          latest_property_address: string | null
          latest_public_remarks: string | null
          latest_state: string | null
          list_agent_key: string | null
          listing_count: number
          notes: string | null
          profile_id: string
          status: string
          updated_at: string
        }
        Insert: {
          agent_email?: string
          agent_name?: string
          agent_phone?: string
          assigned_rep?: string | null
          brokerage?: string
          created_at?: string
          dataset_id: string
          external_id: string
          id?: string
          language?: string
          last_contact_at?: string | null
          latest_city?: string | null
          latest_days_on_market?: number | null
          latest_list_price?: number | null
          latest_listing_id?: string | null
          latest_property_address?: string | null
          latest_public_remarks?: string | null
          latest_state?: string | null
          list_agent_key?: string | null
          listing_count?: number
          notes?: string | null
          profile_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          agent_email?: string
          agent_name?: string
          agent_phone?: string
          assigned_rep?: string | null
          brokerage?: string
          created_at?: string
          dataset_id?: string
          external_id?: string
          id?: string
          language?: string
          last_contact_at?: string | null
          latest_city?: string | null
          latest_days_on_market?: number | null
          latest_list_price?: number | null
          latest_listing_id?: string | null
          latest_property_address?: string | null
          latest_public_remarks?: string | null
          latest_state?: string | null
          list_agent_key?: string | null
          listing_count?: number
          notes?: string | null
          profile_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mls_agent_leads_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "bridge_mls_sync_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      realtor_sync_runs: {
        Row: {
          completed_at: string | null
          dataset_id: string
          error_message: string | null
          id: string
          leads_upserted: number
          metadata: Json
          profile_id: string
          started_at: string
          status: string
        }
        Insert: {
          completed_at?: string | null
          dataset_id: string
          error_message?: string | null
          id?: string
          leads_upserted?: number
          metadata?: Json
          profile_id: string
          started_at?: string
          status?: string
        }
        Update: {
          completed_at?: string | null
          dataset_id?: string
          error_message?: string | null
          id?: string
          leads_upserted?: number
          metadata?: Json
          profile_id?: string
          started_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "realtor_sync_runs_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "bridge_mls_sync_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          avatar_color: string
          created_at: string
          email: string
          google_id: string | null
          id: string
          is_active: boolean
          last_login_at: string | null
          microsoft_id: string | null
          name: string
          password_hash: string | null
          role: string
          status: string
          updated_at: string
        }
        Insert: {
          avatar_color?: string
          created_at?: string
          email: string
          google_id?: string | null
          id?: string
          is_active?: boolean
          last_login_at?: string | null
          microsoft_id?: string | null
          name: string
          password_hash?: string | null
          role?: string
          status?: string
          updated_at?: string
        }
        Update: {
          avatar_color?: string
          created_at?: string
          email?: string
          google_id?: string | null
          id?: string
          is_active?: boolean
          last_login_at?: string | null
          microsoft_id?: string | null
          name?: string
          password_hash?: string | null
          role?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      zillow_agent_leads: {
        Row: {
          agent_email: string
          agent_name: string
          agent_phone: string
          assigned_rep: string | null
          broker_phone: string
          brokerage: string
          created_at: string
          dataset_id: string
          external_id: string
          id: string
          is_listed_by_owner: boolean
          last_contact_at: string | null
          latest_city: string | null
          latest_days_on_market: number | null
          latest_detail_url: string | null
          latest_list_price: number | null
          latest_property_address: string | null
          latest_state: string | null
          latest_zpid: string | null
          listing_count: number
          mls_name: string
          notes: string | null
          profile_id: string
          status: string
          true_status: string | null
          updated_at: string
        }
        Insert: {
          agent_email?: string
          agent_name?: string
          agent_phone?: string
          assigned_rep?: string | null
          broker_phone?: string
          brokerage?: string
          created_at?: string
          dataset_id?: string
          external_id: string
          id?: string
          is_listed_by_owner?: boolean
          last_contact_at?: string | null
          latest_city?: string | null
          latest_days_on_market?: number | null
          latest_detail_url?: string | null
          latest_list_price?: number | null
          latest_property_address?: string | null
          latest_state?: string | null
          latest_zpid?: string | null
          listing_count?: number
          mls_name?: string
          notes?: string | null
          profile_id: string
          status?: string
          true_status?: string | null
          updated_at?: string
        }
        Update: {
          agent_email?: string
          agent_name?: string
          agent_phone?: string
          assigned_rep?: string | null
          broker_phone?: string
          brokerage?: string
          created_at?: string
          dataset_id?: string
          external_id?: string
          id?: string
          is_listed_by_owner?: boolean
          last_contact_at?: string | null
          latest_city?: string | null
          latest_days_on_market?: number | null
          latest_detail_url?: string | null
          latest_list_price?: number | null
          latest_property_address?: string | null
          latest_state?: string | null
          latest_zpid?: string | null
          listing_count?: number
          mls_name?: string
          notes?: string | null
          profile_id?: string
          status?: string
          true_status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "zillow_agent_leads_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "zillow_apify_sync_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      zillow_apify_sync_profiles: {
        Row: {
          created_at: string
          display_name: string
          enabled: boolean
          id: string
          integration_id: string
          last_synced_at: string | null
          search_config: Json
          search_url: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name: string
          enabled?: boolean
          id?: string
          integration_id: string
          last_synced_at?: string | null
          search_config?: Json
          search_url: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string
          enabled?: boolean
          id?: string
          integration_id?: string
          last_synced_at?: string | null
          search_config?: Json
          search_url?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "zillow_apify_sync_profiles_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "integrations"
            referencedColumns: ["id"]
          },
        ]
      }
      zillow_apify_sync_runs: {
        Row: {
          agents_upserted: number
          completed_at: string | null
          error_message: string | null
          id: string
          listings_scraped: number
          metadata: Json
          profile_id: string
          started_at: string
          status: string
        }
        Insert: {
          agents_upserted?: number
          completed_at?: string | null
          error_message?: string | null
          id?: string
          listings_scraped?: number
          metadata?: Json
          profile_id: string
          started_at?: string
          status?: string
        }
        Update: {
          agents_upserted?: number
          completed_at?: string | null
          error_message?: string | null
          id?: string
          listings_scraped?: number
          metadata?: Json
          profile_id?: string
          started_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "zillow_apify_sync_runs_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "zillow_apify_sync_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      zillow_listing_staging: {
        Row: {
          address: string | null
          agent_enriched_at: string | null
          broker_name: string | null
          city: string | null
          days_on_market: number | null
          detail_url: string
          id: string
          list_price: number | null
          search_raw: Json
          state: string | null
          sync_run_id: string
          zipcode: string | null
          zpid: string
        }
        Insert: {
          address?: string | null
          agent_enriched_at?: string | null
          broker_name?: string | null
          city?: string | null
          days_on_market?: number | null
          detail_url: string
          id?: string
          list_price?: number | null
          search_raw?: Json
          state?: string | null
          sync_run_id: string
          zipcode?: string | null
          zpid: string
        }
        Update: {
          address?: string | null
          agent_enriched_at?: string | null
          broker_name?: string | null
          city?: string | null
          days_on_market?: number | null
          detail_url?: string
          id?: string
          list_price?: number | null
          search_raw?: Json
          state?: string | null
          sync_run_id?: string
          zipcode?: string | null
          zpid?: string
        }
        Relationships: [
          {
            foreignKeyName: "zillow_listing_staging_sync_run_id_fkey"
            columns: ["sync_run_id"]
            isOneToOne: false
            referencedRelation: "zillow_apify_sync_runs"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      hash_password: { Args: { input_password: string }; Returns: string }
      verify_password: {
        Args: { input_password: string; stored_hash: string }
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
