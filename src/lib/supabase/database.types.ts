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
      profiles: {
        Row: {
          id: string
          username: string | null
          full_name: string | null
          avatar_url: string | null
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
          completed: boolean
          score: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          module_id: string
          completed?: boolean
          score?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          module_id?: string
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
          level_id: string
          status: string
          transcript: string | null
          metrics: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          level_id: string
          status?: string
          transcript?: string | null
          metrics?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          level_id?: string
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
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          quest_type: string
          completed?: boolean
          reward_xp?: number
          date?: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          quest_type?: string
          completed?: boolean
          reward_xp?: number
          date?: string
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
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
