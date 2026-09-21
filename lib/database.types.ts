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
      blocks: {
        Row: {
          created_at: string
          ends_at: string
          event_id: string
          id: string
          kind: string
          name: string | null
          position: number
          starts_at: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          ends_at: string
          event_id: string
          id?: string
          kind: string
          name?: string | null
          position: number
          starts_at: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          ends_at?: string
          event_id?: string
          id?: string
          kind?: string
          name?: string | null
          position?: number
          starts_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "blocks_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      checkin_staff: {
        Row: {
          checkin_id: string
          created_at: string
          event_id: string
          staff_id: string
        }
        Insert: {
          checkin_id: string
          created_at?: string
          event_id: string
          staff_id: string
        }
        Update: {
          checkin_id?: string
          created_at?: string
          event_id?: string
          staff_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "checkin_staff_event_id_checkin_id_fkey"
            columns: ["event_id", "checkin_id"]
            isOneToOne: false
            referencedRelation: "station_checkins"
            referencedColumns: ["event_id", "id"]
          },
          {
            foreignKeyName: "checkin_staff_event_id_staff_id_fkey"
            columns: ["event_id", "staff_id"]
            isOneToOne: false
            referencedRelation: "event_staff"
            referencedColumns: ["event_id", "id"]
          },
        ]
      }
      device_event_access: {
        Row: {
          access_code_id: string | null
          auth_user_id: string
          device_id: string
          event_id: string
          granted_at: string
          id: string
          revoked_at: string | null
        }
        Insert: {
          access_code_id?: string | null
          auth_user_id: string
          device_id: string
          event_id: string
          granted_at?: string
          id?: string
          revoked_at?: string | null
        }
        Update: {
          access_code_id?: string | null
          auth_user_id?: string
          device_id?: string
          event_id?: string
          granted_at?: string
          id?: string
          revoked_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "device_event_access_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "device_event_access_event_id_access_code_id_fkey"
            columns: ["event_id", "access_code_id"]
            isOneToOne: false
            referencedRelation: "event_access_codes"
            referencedColumns: ["event_id", "id"]
          },
          {
            foreignKeyName: "device_event_access_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      devices: {
        Row: {
          created_at: string
          id: string
          label: string
          last_seen_at: string | null
          registered_by: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: string
          label: string
          last_seen_at?: string | null
          registered_by?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          last_seen_at?: string | null
          registered_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "devices_registered_by_fkey"
            columns: ["registered_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      event_access_codes: {
        Row: {
          code_digest: string
          created_at: string
          event_id: string
          id: string
          revoked_at: string | null
          valid_until: string
        }
        Insert: {
          code_digest: string
          created_at?: string
          event_id: string
          id?: string
          revoked_at?: string | null
          valid_until: string
        }
        Update: {
          code_digest?: string
          created_at?: string
          event_id?: string
          id?: string
          revoked_at?: string | null
          valid_until?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_access_codes_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_device_states: {
        Row: {
          created_at: string
          device_id: string
          downloaded_plan_version: number
          event_id: string
          final_sequence: number | null
          last_reported_sequence: number
          reconciled_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          device_id: string
          downloaded_plan_version: number
          event_id: string
          final_sequence?: number | null
          last_reported_sequence?: number
          reconciled_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          device_id?: string
          downloaded_plan_version?: number
          event_id?: string
          final_sequence?: number | null
          last_reported_sequence?: number
          reconciled_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_device_states_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_device_states_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_games: {
        Row: {
          allow_ties: boolean
          comparison_direction: string
          created_at: string
          default_duration_seconds: number | null
          description: string
          event_id: string
          id: string
          materials: string
          max_teams: number
          measurement_type: string
          min_teams: number
          name: string
          referee_notes: string
          rules: string
          scoring_rule_id: string | null
          template_id: string | null
          tools_config: Json
          unit: string | null
          updated_at: string
        }
        Insert: {
          allow_ties?: boolean
          comparison_direction: string
          created_at?: string
          default_duration_seconds?: number | null
          description?: string
          event_id: string
          id?: string
          materials?: string
          max_teams?: number
          measurement_type: string
          min_teams?: number
          name: string
          referee_notes?: string
          rules?: string
          scoring_rule_id?: string | null
          template_id?: string | null
          tools_config?: Json
          unit?: string | null
          updated_at?: string
        }
        Update: {
          allow_ties?: boolean
          comparison_direction?: string
          created_at?: string
          default_duration_seconds?: number | null
          description?: string
          event_id?: string
          id?: string
          materials?: string
          max_teams?: number
          measurement_type?: string
          min_teams?: number
          name?: string
          referee_notes?: string
          rules?: string
          scoring_rule_id?: string | null
          template_id?: string | null
          tools_config?: Json
          unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_games_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_games_event_id_scoring_rule_id_fkey"
            columns: ["event_id", "scoring_rule_id"]
            isOneToOne: false
            referencedRelation: "scoring_rules"
            referencedColumns: ["event_id", "id"]
          },
          {
            foreignKeyName: "event_games_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "game_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      event_maps: {
        Row: {
          asset_path: string
          attribution: string | null
          content_hash: string
          created_at: string
          east: number
          event_id: string
          height_px: number
          id: string
          mime_type: string
          north: number
          projection: string
          source_label: string | null
          south: number
          updated_at: string
          version: number
          west: number
          width_px: number
        }
        Insert: {
          asset_path: string
          attribution?: string | null
          content_hash: string
          created_at?: string
          east: number
          event_id: string
          height_px: number
          id?: string
          mime_type: string
          north: number
          projection?: string
          source_label?: string | null
          south: number
          updated_at?: string
          version: number
          west: number
          width_px: number
        }
        Update: {
          asset_path?: string
          attribution?: string | null
          content_hash?: string
          created_at?: string
          east?: number
          event_id?: string
          height_px?: number
          id?: string
          mime_type?: string
          north?: number
          projection?: string
          source_label?: string | null
          south?: number
          updated_at?: string
          version?: number
          west?: number
          width_px?: number
        }
        Relationships: [
          {
            foreignKeyName: "event_maps_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_memberships: {
        Row: {
          active: boolean
          created_at: string
          event_id: string
          id: string
          role: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          event_id: string
          id?: string
          role?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          event_id?: string
          id?: string
          role?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_memberships_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_memberships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      event_staff: {
        Row: {
          created_at: string
          display_name: string
          event_id: string
          id: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name: string
          event_id: string
          id?: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string
          event_id?: string
          id?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_staff_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          active_map_id: string | null
          break_minutes: number
          changeover_minutes: number
          created_at: string
          default_scoring_rule_id: string | null
          event_date: string
          id: string
          motto: string | null
          name: string
          ntfy_base_url: string | null
          ntfy_topic: string | null
          plan_version: number
          round_minutes: number
          schedule_start_time: string
          staff_assignment_mode: string
          status: string
          timezone: string
          updated_at: string
          venue_east: number | null
          venue_north: number | null
          venue_south: number | null
          venue_west: number | null
        }
        Insert: {
          active_map_id?: string | null
          break_minutes?: number
          changeover_minutes?: number
          created_at?: string
          default_scoring_rule_id?: string | null
          event_date: string
          id?: string
          motto?: string | null
          name: string
          ntfy_base_url?: string | null
          ntfy_topic?: string | null
          plan_version?: number
          round_minutes?: number
          schedule_start_time?: string
          staff_assignment_mode?: string
          status?: string
          timezone?: string
          updated_at?: string
          venue_east?: number | null
          venue_north?: number | null
          venue_south?: number | null
          venue_west?: number | null
        }
        Update: {
          active_map_id?: string | null
          break_minutes?: number
          changeover_minutes?: number
          created_at?: string
          default_scoring_rule_id?: string | null
          event_date?: string
          id?: string
          motto?: string | null
          name?: string
          ntfy_base_url?: string | null
          ntfy_topic?: string | null
          plan_version?: number
          round_minutes?: number
          schedule_start_time?: string
          staff_assignment_mode?: string
          status?: string
          timezone?: string
          updated_at?: string
          venue_east?: number | null
          venue_north?: number | null
          venue_south?: number | null
          venue_west?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "events_active_map_fk"
            columns: ["id", "active_map_id"]
            isOneToOne: false
            referencedRelation: "event_maps"
            referencedColumns: ["event_id", "id"]
          },
          {
            foreignKeyName: "events_default_scoring_rule_fk"
            columns: ["id", "default_scoring_rule_id"]
            isOneToOne: false
            referencedRelation: "scoring_rules"
            referencedColumns: ["event_id", "id"]
          },
        ]
      }
      game_assignments: {
        Row: {
          created_at: string
          event_game_id: string
          event_id: string
          id: string
          staff_id: string
        }
        Insert: {
          created_at?: string
          event_game_id: string
          event_id: string
          id?: string
          staff_id: string
        }
        Update: {
          created_at?: string
          event_game_id?: string
          event_id?: string
          id?: string
          staff_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_assignments_event_id_event_game_id_fkey"
            columns: ["event_id", "event_game_id"]
            isOneToOne: false
            referencedRelation: "event_games"
            referencedColumns: ["event_id", "id"]
          },
          {
            foreignKeyName: "game_assignments_event_id_staff_id_fkey"
            columns: ["event_id", "staff_id"]
            isOneToOne: false
            referencedRelation: "event_staff"
            referencedColumns: ["event_id", "id"]
          },
        ]
      }
      game_templates: {
        Row: {
          allow_ties: boolean
          comparison_direction: string
          created_at: string
          default_duration_seconds: number | null
          description: string
          id: string
          materials: string
          max_teams: number
          measurement_type: string
          min_teams: number
          name: string
          owner_id: string
          referee_notes: string
          rules: string
          tools_config: Json
          unit: string | null
          updated_at: string
        }
        Insert: {
          allow_ties?: boolean
          comparison_direction: string
          created_at?: string
          default_duration_seconds?: number | null
          description?: string
          id?: string
          materials?: string
          max_teams?: number
          measurement_type: string
          min_teams?: number
          name: string
          owner_id: string
          referee_notes?: string
          rules?: string
          tools_config?: Json
          unit?: string | null
          updated_at?: string
        }
        Update: {
          allow_ties?: boolean
          comparison_direction?: string
          created_at?: string
          default_duration_seconds?: number | null
          description?: string
          id?: string
          materials?: string
          max_teams?: number
          measurement_type?: string
          min_teams?: number
          name?: string
          owner_id?: string
          referee_notes?: string
          rules?: string
          tools_config?: Json
          unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_templates_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      match_participants: {
        Row: {
          created_at: string
          event_id: string
          id: string
          match_id: string
          slot: number
          team_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          match_id: string
          slot: number
          team_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          match_id?: string
          slot?: number
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_participants_event_id_match_id_fkey"
            columns: ["event_id", "match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["event_id", "id"]
          },
          {
            foreignKeyName: "match_participants_event_id_team_id_fkey"
            columns: ["event_id", "team_id"]
            isOneToOne: false
            referencedRelation: "standings"
            referencedColumns: ["event_id", "team_id"]
          },
          {
            foreignKeyName: "match_participants_event_id_team_id_fkey"
            columns: ["event_id", "team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["event_id", "id"]
          },
        ]
      }
      matches: {
        Row: {
          actual_ended_at: string | null
          actual_started_at: string | null
          counts_for_ranking: boolean
          created_at: string
          current_result_version: number
          event_id: string
          id: string
          notes: string | null
          round_id: string
          scoring_rule_id: string | null
          station_setup_id: string
          status: string
          updated_at: string
        }
        Insert: {
          actual_ended_at?: string | null
          actual_started_at?: string | null
          counts_for_ranking?: boolean
          created_at?: string
          current_result_version?: number
          event_id: string
          id?: string
          notes?: string | null
          round_id: string
          scoring_rule_id?: string | null
          station_setup_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          actual_ended_at?: string | null
          actual_started_at?: string | null
          counts_for_ranking?: boolean
          created_at?: string
          current_result_version?: number
          event_id?: string
          id?: string
          notes?: string | null
          round_id?: string
          scoring_rule_id?: string | null
          station_setup_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "matches_event_id_round_id_fkey"
            columns: ["event_id", "round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
            referencedColumns: ["event_id", "id"]
          },
          {
            foreignKeyName: "matches_event_id_scoring_rule_id_fkey"
            columns: ["event_id", "scoring_rule_id"]
            isOneToOne: false
            referencedRelation: "scoring_rules"
            referencedColumns: ["event_id", "id"]
          },
          {
            foreignKeyName: "matches_event_id_station_setup_id_fkey"
            columns: ["event_id", "station_setup_id"]
            isOneToOne: false
            referencedRelation: "station_setups"
            referencedColumns: ["event_id", "id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name: string
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      result_revisions: {
        Row: {
          event_id: string
          id: string
          match_id: string
          reason: string | null
          recorded_at: string
          recorded_by: string | null
          request_id: string
          version: number
        }
        Insert: {
          event_id: string
          id?: string
          match_id: string
          reason?: string | null
          recorded_at?: string
          recorded_by?: string | null
          request_id: string
          version: number
        }
        Update: {
          event_id?: string
          id?: string
          match_id?: string
          reason?: string | null
          recorded_at?: string
          recorded_by?: string | null
          request_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "result_revisions_event_id_match_id_fkey"
            columns: ["event_id", "match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["event_id", "id"]
          },
          {
            foreignKeyName: "result_revisions_event_id_request_id_fkey"
            columns: ["event_id", "request_id"]
            isOneToOne: false
            referencedRelation: "result_submissions"
            referencedColumns: ["event_id", "request_id"]
          },
          {
            foreignKeyName: "result_revisions_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      result_submissions: {
        Row: {
          base_result_version: number
          captured_at: string
          checkin_id: string | null
          device_access_id: string | null
          device_id: string
          event_id: string
          local_sequence: number
          match_id: string
          payload: Json
          payload_hash: string
          plan_version: number
          received_at: string
          request_id: string
          resolution_request_id: string | null
          status: string
          submitted_by: string | null
        }
        Insert: {
          base_result_version: number
          captured_at: string
          checkin_id?: string | null
          device_access_id?: string | null
          device_id: string
          event_id: string
          local_sequence: number
          match_id: string
          payload: Json
          payload_hash: string
          plan_version: number
          received_at?: string
          request_id: string
          resolution_request_id?: string | null
          status: string
          submitted_by?: string | null
        }
        Update: {
          base_result_version?: number
          captured_at?: string
          checkin_id?: string | null
          device_access_id?: string | null
          device_id?: string
          event_id?: string
          local_sequence?: number
          match_id?: string
          payload?: Json
          payload_hash?: string
          plan_version?: number
          received_at?: string
          request_id?: string
          resolution_request_id?: string | null
          status?: string
          submitted_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "result_submissions_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "result_submissions_event_id_checkin_id_fkey"
            columns: ["event_id", "checkin_id"]
            isOneToOne: false
            referencedRelation: "station_checkins"
            referencedColumns: ["event_id", "id"]
          },
          {
            foreignKeyName: "result_submissions_event_id_device_access_id_fkey"
            columns: ["event_id", "device_access_id"]
            isOneToOne: false
            referencedRelation: "device_event_access"
            referencedColumns: ["event_id", "id"]
          },
          {
            foreignKeyName: "result_submissions_event_id_match_id_fkey"
            columns: ["event_id", "match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["event_id", "id"]
          },
          {
            foreignKeyName: "result_submissions_resolution_request_id_fkey"
            columns: ["resolution_request_id"]
            isOneToOne: false
            referencedRelation: "result_submissions"
            referencedColumns: ["request_id"]
          },
          {
            foreignKeyName: "result_submissions_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      result_values: {
        Row: {
          event_id: string
          match_id: string
          measured_value: number | null
          participant_id: string
          placement: number | null
          revision_id: string
        }
        Insert: {
          event_id: string
          match_id: string
          measured_value?: number | null
          participant_id: string
          placement?: number | null
          revision_id: string
        }
        Update: {
          event_id?: string
          match_id?: string
          measured_value?: number | null
          participant_id?: string
          placement?: number | null
          revision_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "result_values_event_id_match_id_fkey"
            columns: ["event_id", "match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["event_id", "id"]
          },
          {
            foreignKeyName: "result_values_event_id_participant_id_fkey"
            columns: ["event_id", "participant_id"]
            isOneToOne: false
            referencedRelation: "match_participants"
            referencedColumns: ["event_id", "id"]
          },
          {
            foreignKeyName: "result_values_event_id_revision_id_fkey"
            columns: ["event_id", "revision_id"]
            isOneToOne: false
            referencedRelation: "result_revisions"
            referencedColumns: ["event_id", "id"]
          },
        ]
      }
      rounds: {
        Row: {
          block_id: string
          created_at: string
          duration_minutes: number | null
          ends_at: string
          event_id: string
          id: string
          kind: string
          label: string | null
          position: number
          starts_at: string
          updated_at: string
        }
        Insert: {
          block_id: string
          created_at?: string
          duration_minutes?: number | null
          ends_at: string
          event_id: string
          id?: string
          kind: string
          label?: string | null
          position: number
          starts_at: string
          updated_at?: string
        }
        Update: {
          block_id?: string
          created_at?: string
          duration_minutes?: number | null
          ends_at?: string
          event_id?: string
          id?: string
          kind?: string
          label?: string | null
          position?: number
          starts_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rounds_event_id_block_id_fkey"
            columns: ["event_id", "block_id"]
            isOneToOne: false
            referencedRelation: "blocks"
            referencedColumns: ["event_id", "id"]
          },
        ]
      }
      scoring_rules: {
        Row: {
          config: Json
          created_at: string
          event_id: string
          id: string
          mode: string
          name: string
          updated_at: string
        }
        Insert: {
          config: Json
          created_at?: string
          event_id: string
          id?: string
          mode: string
          name: string
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          event_id?: string
          id?: string
          mode?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "scoring_rules_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      station_assignments: {
        Row: {
          created_at: string
          event_id: string
          id: string
          staff_id: string
          station_setup_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          staff_id: string
          station_setup_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          staff_id?: string
          station_setup_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "station_assignments_event_id_staff_id_fkey"
            columns: ["event_id", "staff_id"]
            isOneToOne: false
            referencedRelation: "event_staff"
            referencedColumns: ["event_id", "id"]
          },
          {
            foreignKeyName: "station_assignments_event_id_station_setup_id_fkey"
            columns: ["event_id", "station_setup_id"]
            isOneToOne: false
            referencedRelation: "station_setups"
            referencedColumns: ["event_id", "id"]
          },
        ]
      }
      station_checkins: {
        Row: {
          checked_in_at: string
          checked_out_at: string | null
          created_at: string
          device_access_id: string
          event_id: string
          id: string
          received_at: string
          station_setup_id: string
        }
        Insert: {
          checked_in_at: string
          checked_out_at?: string | null
          created_at?: string
          device_access_id: string
          event_id: string
          id: string
          received_at?: string
          station_setup_id: string
        }
        Update: {
          checked_in_at?: string
          checked_out_at?: string | null
          created_at?: string
          device_access_id?: string
          event_id?: string
          id?: string
          received_at?: string
          station_setup_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "station_checkins_event_id_device_access_id_fkey"
            columns: ["event_id", "device_access_id"]
            isOneToOne: false
            referencedRelation: "device_event_access"
            referencedColumns: ["event_id", "id"]
          },
          {
            foreignKeyName: "station_checkins_event_id_station_setup_id_fkey"
            columns: ["event_id", "station_setup_id"]
            isOneToOne: false
            referencedRelation: "station_setups"
            referencedColumns: ["event_id", "id"]
          },
        ]
      }
      station_setups: {
        Row: {
          block_id: string
          created_at: string
          event_game_id: string
          event_id: string
          id: string
          notes: string | null
          station_id: string
          updated_at: string
        }
        Insert: {
          block_id: string
          created_at?: string
          event_game_id: string
          event_id: string
          id?: string
          notes?: string | null
          station_id: string
          updated_at?: string
        }
        Update: {
          block_id?: string
          created_at?: string
          event_game_id?: string
          event_id?: string
          id?: string
          notes?: string | null
          station_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "station_setups_event_id_block_id_fkey"
            columns: ["event_id", "block_id"]
            isOneToOne: false
            referencedRelation: "blocks"
            referencedColumns: ["event_id", "id"]
          },
          {
            foreignKeyName: "station_setups_event_id_event_game_id_fkey"
            columns: ["event_id", "event_game_id"]
            isOneToOne: false
            referencedRelation: "event_games"
            referencedColumns: ["event_id", "id"]
          },
          {
            foreignKeyName: "station_setups_event_id_station_id_fkey"
            columns: ["event_id", "station_id"]
            isOneToOne: false
            referencedRelation: "stations"
            referencedColumns: ["event_id", "id"]
          },
        ]
      }
      stations: {
        Row: {
          arrival_notes: string | null
          created_at: string
          event_id: string
          id: string
          latitude: number | null
          location: string | null
          longitude: number | null
          name: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          arrival_notes?: string | null
          created_at?: string
          event_id: string
          id?: string
          latitude?: number | null
          location?: string | null
          longitude?: number | null
          name: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          arrival_notes?: string | null
          created_at?: string
          event_id?: string
          id?: string
          latitude?: number | null
          location?: string | null
          longitude?: number | null
          name?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          color: string | null
          created_at: string
          event_id: string
          id: string
          name: string
          number: number | null
          participant_count: number | null
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          event_id: string
          id?: string
          name: string
          number?: number | null
          participant_count?: number | null
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          event_id?: string
          id?: string
          name?: string
          number?: number | null
          participant_count?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "teams_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      current_result_values: {
        Row: {
          event_id: string | null
          match_id: string | null
          measured_value: number | null
          participant_id: string | null
          placement: number | null
          recorded_at: string | null
          team_id: string | null
          version: number | null
        }
        Relationships: [
          {
            foreignKeyName: "result_revisions_event_id_match_id_fkey"
            columns: ["event_id", "match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["event_id", "id"]
          },
        ]
      }
      standings: {
        Row: {
          event_id: string | null
          last_result_at: string | null
          table_points: number | null
          team_id: string | null
          team_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "teams_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      add_event_organizer: {
        Args: { p_email: string; p_event_id: string }
        Returns: {
          active: boolean
          created_at: string
          event_id: string
          id: string
          role: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "event_memberships"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      check_event_readiness: { Args: { p_event_id: string }; Returns: Json }
      create_event: {
        Args: {
          p_event_date: string
          p_motto?: string
          p_name: string
          p_timezone?: string
        }
        Returns: {
          active_map_id: string | null
          break_minutes: number
          changeover_minutes: number
          created_at: string
          default_scoring_rule_id: string | null
          event_date: string
          id: string
          motto: string | null
          name: string
          ntfy_base_url: string | null
          ntfy_topic: string | null
          plan_version: number
          round_minutes: number
          schedule_start_time: string
          staff_assignment_mode: string
          status: string
          timezone: string
          updated_at: string
          venue_east: number | null
          venue_north: number | null
          venue_south: number | null
          venue_west: number | null
        }
        SetofOptions: {
          from: "*"
          to: "events"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      delete_draft_event: { Args: { p_event_id: string }; Returns: undefined }
      list_event_organizers: {
        Args: { p_event_id: string }
        Returns: {
          active: boolean
          display_name: string
          email: string
          membership_id: string
          user_id: string
        }[]
      }
      publish_event: {
        Args: { p_event_id: string }
        Returns: {
          active_map_id: string | null
          break_minutes: number
          changeover_minutes: number
          created_at: string
          default_scoring_rule_id: string | null
          event_date: string
          id: string
          motto: string | null
          name: string
          ntfy_base_url: string | null
          ntfy_topic: string | null
          plan_version: number
          round_minutes: number
          schedule_start_time: string
          staff_assignment_mode: string
          status: string
          timezone: string
          updated_at: string
          venue_east: number | null
          venue_north: number | null
          venue_south: number | null
          venue_west: number | null
        }
        SetofOptions: {
          from: "*"
          to: "events"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      redeem_access_code: {
        Args: { p_code: string; p_device_id: string; p_device_label: string }
        Returns: {
          access_code_id: string | null
          auth_user_id: string
          device_id: string
          event_id: string
          granted_at: string
          id: string
          revoked_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "device_event_access"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      revoke_access_code: { Args: { p_event_id: string }; Returns: undefined }
      revoke_device_access: {
        Args: { p_access_id: string }
        Returns: undefined
      }
      rotate_access_code: {
        Args: { p_event_id: string; p_valid_until?: string }
        Returns: string
      }
      schedule_apply_layout: {
        Args: { p_event_id: string; p_rows: Json; p_settings?: Json }
        Returns: undefined
      }
      schedule_set_block_game: {
        Args: {
          p_block_id: string
          p_event_game_id: string
          p_station_id: string
        }
        Returns: undefined
      }
      schedule_set_cells: {
        Args: { p_cells: Json; p_event_id: string }
        Returns: undefined
      }
      set_event_status: {
        Args: { p_event_id: string; p_status: string }
        Returns: {
          active_map_id: string | null
          break_minutes: number
          changeover_minutes: number
          created_at: string
          default_scoring_rule_id: string | null
          event_date: string
          id: string
          motto: string | null
          name: string
          ntfy_base_url: string | null
          ntfy_topic: string | null
          plan_version: number
          round_minutes: number
          schedule_start_time: string
          staff_assignment_mode: string
          status: string
          timezone: string
          updated_at: string
          venue_east: number | null
          venue_north: number | null
          venue_south: number | null
          venue_west: number | null
        }
        SetofOptions: {
          from: "*"
          to: "events"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      submit_result: {
        Args: {
          p_base_result_version: number
          p_captured_at: string
          p_checkin_id: string
          p_device_access_id: string
          p_device_id: string
          p_event_id: string
          p_local_sequence: number
          p_match_id: string
          p_payload: Json
          p_payload_hash: string
          p_plan_version: number
          p_reason?: string
          p_request_id: string
        }
        Returns: {
          payload_hash: string
          request_id: string
          result_version: number
          status: string
        }[]
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
    Enums: {},
  },
} as const
