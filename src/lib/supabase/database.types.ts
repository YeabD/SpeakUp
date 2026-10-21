import type { CaseFile, Evaluation, Turn } from '@/src/lib/alibi/contracts'

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      alibi_attempts: {
        Row: { id: string; user_id: string; session_number: number; case_file: CaseFile; turns: Turn[]; question: string | null; evaluation: Evaluation | null; created_at: string }
        Insert: { id: string; user_id: string; session_number: number; case_file: CaseFile; turns?: Turn[]; question?: string | null; evaluation?: Evaluation | null; created_at?: string }
        Update: { question?: string | null; turns?: Turn[]; evaluation?: Evaluation | null }
        Relationships: []
      }
      alibi_completions: {
        Row: { user_id: string; session_number: number; attempt_id: string; score: number; created_at: string }
        Insert: { user_id: string; session_number: number; attempt_id: string; score: number; created_at?: string }
        Update: { score?: number }
        Relationships: []
      }
      profiles: {
        Row: {
          id: string
          username: string | null
          full_name: string | null
          avatar_url: string | null
          active_language: string | null
          streak_count: number
          total_xp: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          username?: string | null
          full_name?: string | null
          avatar_url?: string | null
          active_language?: string | null
          streak_count?: number
          total_xp?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          username?: string | null
          full_name?: string | null
          avatar_url?: string | null
          active_language?: string | null
          streak_count?: number
          total_xp?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      module_progress: {
        Row: {
          id: string
          user_id: string
          module_id: string
          current_level: number
          completed_sessions_in_level: number
          average_accuracy: number
          completed: boolean
          score: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          module_id: string
          current_level?: number
          completed_sessions_in_level?: number
          average_accuracy?: number
          completed?: boolean
          score?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          module_id?: string
          current_level?: number
          completed_sessions_in_level?: number
          average_accuracy?: number
          completed?: boolean
          score?: number | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      level_sessions: {
        Row: {
          id: string
          user_id: string
          level_id: string | null
          module_type: string | null
          level_number: number | null
          session_number: number | null
          accuracy_score: number | null
          status: string
          transcript: string | null
          metrics: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          level_id?: string | null
          module_type?: string | null
          level_number?: number | null
          session_number?: number | null
          accuracy_score?: number | null
          status?: string
          transcript?: string | null
          metrics?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          level_id?: string | null
          module_type?: string | null
          level_number?: number | null
          session_number?: number | null
          accuracy_score?: number | null
          status?: string
          transcript?: string | null
          metrics?: Json | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      daily_quests: {
        Row: {
          id: string
          user_id: string
          quest_type: string
          completed: boolean
          reward_xp: number
          date: string
          shadowing_count: number
          circumlocution_count: number
          ping_pong_count: number
          compressor_count: number
          alibi_count: number
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          quest_type: string
          completed?: boolean
          reward_xp?: number
          date?: string
          shadowing_count?: number
          circumlocution_count?: number
          ping_pong_count?: number
          compressor_count?: number
          alibi_count?: number
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          quest_type?: string
          completed?: boolean
          reward_xp?: number
          date?: string
          shadowing_count?: number
          circumlocution_count?: number
          ping_pong_count?: number
          compressor_count?: number
          alibi_count?: number
          created_at?: string
        }
        Relationships: []
      }
      open_mic_evaluations: {
        Row: {
          id: string
          user_id: string
          audio_url: string | null
          transcript: string | null
          feedback: Json | null
          score: number | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          audio_url?: string | null
          transcript?: string | null
          feedback?: Json | null
          score?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          audio_url?: string | null
          transcript?: string | null
          feedback?: Json | null
          score?: number | null
          created_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      alibi_mutate: {
        Args: { p_user: string; p_id: string; p_action: string; p_payload: Json }
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
}
