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
      achievements: {
        Row: {
          badge_key: string
          description: string | null
          icon: string | null
          id: string
          name: string
          unlocked_at: string
          user_id: string
        }
        Insert: {
          badge_key: string
          description?: string | null
          icon?: string | null
          id?: string
          name: string
          unlocked_at?: string
          user_id: string
        }
        Update: {
          badge_key?: string
          description?: string | null
          icon?: string | null
          id?: string
          name?: string
          unlocked_at?: string
          user_id?: string
        }
        Relationships: []
      }
      bad_habit_relapses: {
        Row: {
          bad_habit_id: string
          created_at: string
          id: string
          note: string | null
          relapsed_at: string
          streak_seconds: number
          user_id: string
        }
        Insert: {
          bad_habit_id: string
          created_at?: string
          id?: string
          note?: string | null
          relapsed_at?: string
          streak_seconds?: number
          user_id: string
        }
        Update: {
          bad_habit_id?: string
          created_at?: string
          id?: string
          note?: string | null
          relapsed_at?: string
          streak_seconds?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bad_habit_relapses_bad_habit_id_fkey"
            columns: ["bad_habit_id"]
            isOneToOne: false
            referencedRelation: "bad_habits"
            referencedColumns: ["id"]
          },
        ]
      }
      bad_habits: {
        Row: {
          archived_at: string | null
          best_streak_seconds: number
          color: string
          created_at: string
          difficulty: Database["public"]["Enums"]["bad_habit_difficulty"]
          goal_date: string | null
          icon: string
          id: string
          last_awarded_day: number
          motivation: string | null
          name: string
          priority: Database["public"]["Enums"]["bad_habit_priority"]
          relapse_count: number
          started_at: string
          total_clean_seconds: number
          updated_at: string
          user_id: string
        }
        Insert: {
          archived_at?: string | null
          best_streak_seconds?: number
          color?: string
          created_at?: string
          difficulty?: Database["public"]["Enums"]["bad_habit_difficulty"]
          goal_date?: string | null
          icon?: string
          id?: string
          last_awarded_day?: number
          motivation?: string | null
          name: string
          priority?: Database["public"]["Enums"]["bad_habit_priority"]
          relapse_count?: number
          started_at?: string
          total_clean_seconds?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          archived_at?: string | null
          best_streak_seconds?: number
          color?: string
          created_at?: string
          difficulty?: Database["public"]["Enums"]["bad_habit_difficulty"]
          goal_date?: string | null
          icon?: string
          id?: string
          last_awarded_day?: number
          motivation?: string | null
          name?: string
          priority?: Database["public"]["Enums"]["bad_habit_priority"]
          relapse_count?: number
          started_at?: string
          total_clean_seconds?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      finance_goals: {
        Row: {
          color: string
          completed: boolean
          created_at: string
          current_amount: number
          deadline: string | null
          icon: string
          id: string
          name: string
          target_amount: number
          updated_at: string
          user_id: string
        }
        Insert: {
          color?: string
          completed?: boolean
          created_at?: string
          current_amount?: number
          deadline?: string | null
          icon?: string
          id?: string
          name: string
          target_amount: number
          updated_at?: string
          user_id: string
        }
        Update: {
          color?: string
          completed?: boolean
          created_at?: string
          current_amount?: number
          deadline?: string | null
          icon?: string
          id?: string
          name?: string
          target_amount?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      finance_recurrences: {
        Row: {
          account: string | null
          active: boolean
          amount: number
          category: string | null
          created_at: string
          description: string | null
          frequency: string
          id: string
          interval_n: number
          kind: Database["public"]["Enums"]["transaction_kind"]
          last_generated_date: string | null
          start_date: string
          to_account: string | null
          until_date: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account?: string | null
          active?: boolean
          amount: number
          category?: string | null
          created_at?: string
          description?: string | null
          frequency?: string
          id?: string
          interval_n?: number
          kind: Database["public"]["Enums"]["transaction_kind"]
          last_generated_date?: string | null
          start_date?: string
          to_account?: string | null
          until_date?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account?: string | null
          active?: boolean
          amount?: number
          category?: string | null
          created_at?: string
          description?: string | null
          frequency?: string
          id?: string
          interval_n?: number
          kind?: Database["public"]["Enums"]["transaction_kind"]
          last_generated_date?: string | null
          start_date?: string
          to_account?: string | null
          until_date?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      finance_transactions: {
        Row: {
          account: string | null
          amount: number
          category: string | null
          created_at: string
          description: string | null
          group_id: string | null
          id: string
          installment_no: number | null
          installment_total: number | null
          kind: Database["public"]["Enums"]["transaction_kind"]
          notes: string | null
          occurred_on: string
          recurrence_id: string | null
          to_account: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account?: string | null
          amount: number
          category?: string | null
          created_at?: string
          description?: string | null
          group_id?: string | null
          id?: string
          installment_no?: number | null
          installment_total?: number | null
          kind: Database["public"]["Enums"]["transaction_kind"]
          notes?: string | null
          occurred_on?: string
          recurrence_id?: string | null
          to_account?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account?: string | null
          amount?: number
          category?: string | null
          created_at?: string
          description?: string | null
          group_id?: string | null
          id?: string
          installment_no?: number | null
          installment_total?: number | null
          kind?: Database["public"]["Enums"]["transaction_kind"]
          notes?: string | null
          occurred_on?: string
          recurrence_id?: string | null
          to_account?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      focus_sessions: {
        Row: {
          actual_seconds: number
          ambient_sound: string | null
          completed: boolean
          created_at: string
          ended_at: string | null
          id: string
          label: string | null
          mode: Database["public"]["Enums"]["focus_mode"]
          planned_seconds: number
          skill_category: Database["public"]["Enums"]["skill_category"] | null
          started_at: string
          user_id: string
          xp_awarded: number
        }
        Insert: {
          actual_seconds?: number
          ambient_sound?: string | null
          completed?: boolean
          created_at?: string
          ended_at?: string | null
          id?: string
          label?: string | null
          mode?: Database["public"]["Enums"]["focus_mode"]
          planned_seconds: number
          skill_category?: Database["public"]["Enums"]["skill_category"] | null
          started_at?: string
          user_id: string
          xp_awarded?: number
        }
        Update: {
          actual_seconds?: number
          ambient_sound?: string | null
          completed?: boolean
          created_at?: string
          ended_at?: string | null
          id?: string
          label?: string | null
          mode?: Database["public"]["Enums"]["focus_mode"]
          planned_seconds?: number
          skill_category?: Database["public"]["Enums"]["skill_category"] | null
          started_at?: string
          user_id?: string
          xp_awarded?: number
        }
        Relationships: []
      }
      goals: {
        Row: {
          area: string
          completed: boolean
          created_at: string
          current_value: number | null
          deadline: string | null
          description: string | null
          id: string
          target_value: number | null
          title: string
          unit: string | null
          user_id: string
        }
        Insert: {
          area: string
          completed?: boolean
          created_at?: string
          current_value?: number | null
          deadline?: string | null
          description?: string | null
          id?: string
          target_value?: number | null
          title: string
          unit?: string | null
          user_id: string
        }
        Update: {
          area?: string
          completed?: boolean
          created_at?: string
          current_value?: number | null
          deadline?: string | null
          description?: string | null
          id?: string
          target_value?: number | null
          title?: string
          unit?: string | null
          user_id?: string
        }
        Relationships: []
      }
      habits: {
        Row: {
          best_streak: number
          category: Database["public"]["Enums"]["task_category"]
          created_at: string
          id: string
          last_completed_date: string | null
          skill_category: Database["public"]["Enums"]["skill_category"] | null
          streak: number
          title: string
          user_id: string
          xp_reward: number
        }
        Insert: {
          best_streak?: number
          category?: Database["public"]["Enums"]["task_category"]
          created_at?: string
          id?: string
          last_completed_date?: string | null
          skill_category?: Database["public"]["Enums"]["skill_category"] | null
          streak?: number
          title: string
          user_id: string
          xp_reward?: number
        }
        Update: {
          best_streak?: number
          category?: Database["public"]["Enums"]["task_category"]
          created_at?: string
          id?: string
          last_completed_date?: string | null
          skill_category?: Database["public"]["Enums"]["skill_category"] | null
          streak?: number
          title?: string
          user_id?: string
          xp_reward?: number
        }
        Relationships: []
      }
      health_goals: {
        Row: {
          created_at: string
          sleep_hours_goal: number
          updated_at: string
          user_id: string
          water_ml_goal: number
          weight_goal_kg: number | null
        }
        Insert: {
          created_at?: string
          sleep_hours_goal?: number
          updated_at?: string
          user_id: string
          water_ml_goal?: number
          weight_goal_kg?: number | null
        }
        Update: {
          created_at?: string
          sleep_hours_goal?: number
          updated_at?: string
          user_id?: string
          water_ml_goal?: number
          weight_goal_kg?: number | null
        }
        Relationships: []
      }
      health_logs: {
        Row: {
          calories: number | null
          created_at: string
          id: string
          log_date: string
          mood: number | null
          sleep_hours: number | null
          sleep_quality: number | null
          user_id: string
          water_ml: number | null
          weight_kg: number | null
        }
        Insert: {
          calories?: number | null
          created_at?: string
          id?: string
          log_date?: string
          mood?: number | null
          sleep_hours?: number | null
          sleep_quality?: number | null
          user_id: string
          water_ml?: number | null
          weight_kg?: number | null
        }
        Update: {
          calories?: number | null
          created_at?: string
          id?: string
          log_date?: string
          mood?: number | null
          sleep_hours?: number | null
          sleep_quality?: number | null
          user_id?: string
          water_ml?: number | null
          weight_kg?: number | null
        }
        Relationships: []
      }
      inventory_items: {
        Row: {
          description: string | null
          earned_at: string
          icon: string | null
          id: string
          item_key: string
          kind: Database["public"]["Enums"]["item_kind"]
          metadata: Json | null
          name: string
          rarity: Database["public"]["Enums"]["item_rarity"]
          user_id: string
        }
        Insert: {
          description?: string | null
          earned_at?: string
          icon?: string | null
          id?: string
          item_key: string
          kind: Database["public"]["Enums"]["item_kind"]
          metadata?: Json | null
          name: string
          rarity?: Database["public"]["Enums"]["item_rarity"]
          user_id: string
        }
        Update: {
          description?: string | null
          earned_at?: string
          icon?: string | null
          id?: string
          item_key?: string
          kind?: Database["public"]["Enums"]["item_kind"]
          metadata?: Json | null
          name?: string
          rarity?: Database["public"]["Enums"]["item_rarity"]
          user_id?: string
        }
        Relationships: []
      }
      journal_entries: {
        Row: {
          created_at: string
          entry_date: string
          goals_today: string | null
          gratitude: string | null
          id: string
          lessons: string | null
          mood: number | null
          thoughts: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          entry_date?: string
          goals_today?: string | null
          gratitude?: string | null
          id?: string
          lessons?: string | null
          mood?: number | null
          thoughts?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          entry_date?: string
          goals_today?: string | null
          gratitude?: string | null
          id?: string
          lessons?: string | null
          mood?: number | null
          thoughts?: string | null
          user_id?: string
        }
        Relationships: []
      }
      library_items: {
        Row: {
          author: string | null
          category: Database["public"]["Enums"]["library_category"]
          completed: boolean
          completed_at: string | null
          cover_url: string | null
          created_at: string
          current_page: number | null
          description: string | null
          favorite: boolean
          id: string
          item_type: Database["public"]["Enums"]["library_item_type"]
          notes: string | null
          progress: number
          status: Database["public"]["Enums"]["library_status"]
          study_seconds: number
          title: string
          total_pages: number | null
          updated_at: string
          url: string | null
          user_id: string
        }
        Insert: {
          author?: string | null
          category: Database["public"]["Enums"]["library_category"]
          completed?: boolean
          completed_at?: string | null
          cover_url?: string | null
          created_at?: string
          current_page?: number | null
          description?: string | null
          favorite?: boolean
          id?: string
          item_type?: Database["public"]["Enums"]["library_item_type"]
          notes?: string | null
          progress?: number
          status?: Database["public"]["Enums"]["library_status"]
          study_seconds?: number
          title: string
          total_pages?: number | null
          updated_at?: string
          url?: string | null
          user_id: string
        }
        Update: {
          author?: string | null
          category?: Database["public"]["Enums"]["library_category"]
          completed?: boolean
          completed_at?: string | null
          cover_url?: string | null
          created_at?: string
          current_page?: number | null
          description?: string | null
          favorite?: boolean
          id?: string
          item_type?: Database["public"]["Enums"]["library_item_type"]
          notes?: string | null
          progress?: number
          status?: Database["public"]["Enums"]["library_status"]
          study_seconds?: number
          title?: string
          total_pages?: number | null
          updated_at?: string
          url?: string | null
          user_id?: string
        }
        Relationships: []
      }
      life_score_snapshots: {
        Row: {
          breakdown: Json
          created_at: string
          id: string
          score: number
          snapshot_date: string
          user_id: string
        }
        Insert: {
          breakdown?: Json
          created_at?: string
          id?: string
          score: number
          snapshot_date?: string
          user_id: string
        }
        Update: {
          breakdown?: Json
          created_at?: string
          id?: string
          score?: number
          snapshot_date?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_frame: string | null
          avatar_url: string | null
          bio: string | null
          created_at: string
          current_rank: string | null
          equipped_title: string | null
          full_name: string | null
          goals: string | null
          id: string
          last_active_date: string | null
          level: number
          life_score: number | null
          notifications_enabled: boolean
          streak_days: number
          theme: string
          total_xp: number
          updated_at: string
          username: string | null
          xp: number
        }
        Insert: {
          avatar_frame?: string | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          current_rank?: string | null
          equipped_title?: string | null
          full_name?: string | null
          goals?: string | null
          id: string
          last_active_date?: string | null
          level?: number
          life_score?: number | null
          notifications_enabled?: boolean
          streak_days?: number
          theme?: string
          total_xp?: number
          updated_at?: string
          username?: string | null
          xp?: number
        }
        Update: {
          avatar_frame?: string | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          current_rank?: string | null
          equipped_title?: string | null
          full_name?: string | null
          goals?: string | null
          id?: string
          last_active_date?: string | null
          level?: number
          life_score?: number | null
          notifications_enabled?: boolean
          streak_days?: number
          theme?: string
          total_xp?: number
          updated_at?: string
          username?: string | null
          xp?: number
        }
        Relationships: []
      }
      recovery_missions: {
        Row: {
          bad_habit_id: string | null
          completed: boolean
          completed_at: string | null
          created_at: string
          description: string | null
          id: string
          mission_date: string
          title: string
          user_id: string
          xp_reward: number
        }
        Insert: {
          bad_habit_id?: string | null
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          mission_date?: string
          title: string
          user_id: string
          xp_reward?: number
        }
        Update: {
          bad_habit_id?: string | null
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          mission_date?: string
          title?: string
          user_id?: string
          xp_reward?: number
        }
        Relationships: [
          {
            foreignKeyName: "recovery_missions_bad_habit_id_fkey"
            columns: ["bad_habit_id"]
            isOneToOne: false
            referencedRelation: "bad_habits"
            referencedColumns: ["id"]
          },
        ]
      }
      skills: {
        Row: {
          category: Database["public"]["Enums"]["skill_category"] | null
          color: string | null
          created_at: string
          custom_slug: string | null
          display_name: string | null
          icon: string | null
          id: string
          is_custom: boolean
          level: number
          total_xp: number
          user_id: string
          xp: number
        }
        Insert: {
          category?: Database["public"]["Enums"]["skill_category"] | null
          color?: string | null
          created_at?: string
          custom_slug?: string | null
          display_name?: string | null
          icon?: string | null
          id?: string
          is_custom?: boolean
          level?: number
          total_xp?: number
          user_id: string
          xp?: number
        }
        Update: {
          category?: Database["public"]["Enums"]["skill_category"] | null
          color?: string | null
          created_at?: string
          custom_slug?: string | null
          display_name?: string | null
          icon?: string | null
          id?: string
          is_custom?: boolean
          level?: number
          total_xp?: number
          user_id?: string
          xp?: number
        }
        Relationships: []
      }
      tasks: {
        Row: {
          category: Database["public"]["Enums"]["task_category"]
          completed: boolean
          completed_at: string | null
          created_at: string
          custom_skill_id: string | null
          description: string | null
          difficulty: Database["public"]["Enums"]["task_difficulty"]
          difficulty_locked: boolean
          due_date: string | null
          due_time: string | null
          estimated_min: number | null
          failed_at: string | null
          id: string
          is_template: boolean
          last_generated_date: string | null
          penalty_enabled: boolean
          penalty_xp: number
          priority: Database["public"]["Enums"]["task_priority"]
          reminder_minutes: number | null
          repeat_interval: number
          repeat_kind: Database["public"]["Enums"]["task_repeat"]
          repeat_rule: Database["public"]["Enums"]["task_repeat_rule"] | null
          repeat_until: string | null
          repeat_weekdays: number[] | null
          skill_category: Database["public"]["Enums"]["skill_category"] | null
          start_date: string | null
          status: Database["public"]["Enums"]["task_status"]
          template_id: string | null
          time_spent_min: number | null
          title: string
          user_id: string
          xp_awarded: boolean
          xp_granted: number
          xp_reward: number
        }
        Insert: {
          category?: Database["public"]["Enums"]["task_category"]
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          custom_skill_id?: string | null
          description?: string | null
          difficulty?: Database["public"]["Enums"]["task_difficulty"]
          difficulty_locked?: boolean
          due_date?: string | null
          due_time?: string | null
          estimated_min?: number | null
          failed_at?: string | null
          id?: string
          is_template?: boolean
          last_generated_date?: string | null
          penalty_enabled?: boolean
          penalty_xp?: number
          priority?: Database["public"]["Enums"]["task_priority"]
          reminder_minutes?: number | null
          repeat_interval?: number
          repeat_kind?: Database["public"]["Enums"]["task_repeat"]
          repeat_rule?: Database["public"]["Enums"]["task_repeat_rule"] | null
          repeat_until?: string | null
          repeat_weekdays?: number[] | null
          skill_category?: Database["public"]["Enums"]["skill_category"] | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          template_id?: string | null
          time_spent_min?: number | null
          title: string
          user_id: string
          xp_awarded?: boolean
          xp_granted?: number
          xp_reward?: number
        }
        Update: {
          category?: Database["public"]["Enums"]["task_category"]
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          custom_skill_id?: string | null
          description?: string | null
          difficulty?: Database["public"]["Enums"]["task_difficulty"]
          difficulty_locked?: boolean
          due_date?: string | null
          due_time?: string | null
          estimated_min?: number | null
          failed_at?: string | null
          id?: string
          is_template?: boolean
          last_generated_date?: string | null
          penalty_enabled?: boolean
          penalty_xp?: number
          priority?: Database["public"]["Enums"]["task_priority"]
          reminder_minutes?: number | null
          repeat_interval?: number
          repeat_kind?: Database["public"]["Enums"]["task_repeat"]
          repeat_rule?: Database["public"]["Enums"]["task_repeat_rule"] | null
          repeat_until?: string | null
          repeat_weekdays?: number[] | null
          skill_category?: Database["public"]["Enums"]["skill_category"] | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          template_id?: string | null
          time_spent_min?: number | null
          title?: string
          user_id?: string
          xp_awarded?: boolean
          xp_granted?: number
          xp_reward?: number
        }
        Relationships: [
          {
            foreignKeyName: "tasks_custom_skill_id_fkey"
            columns: ["custom_skill_id"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      timeline_events: {
        Row: {
          category: string
          description: string | null
          event_key: string
          icon: string | null
          id: string
          metadata: Json | null
          occurred_at: string
          title: string
          user_id: string
        }
        Insert: {
          category: string
          description?: string | null
          event_key: string
          icon?: string | null
          id?: string
          metadata?: Json | null
          occurred_at?: string
          title: string
          user_id: string
        }
        Update: {
          category?: string
          description?: string | null
          event_key?: string
          icon?: string | null
          id?: string
          metadata?: Json | null
          occurred_at?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      user_titles: {
        Row: {
          description: string | null
          earned_at: string
          icon: string
          id: string
          rarity: Database["public"]["Enums"]["item_rarity"]
          title_key: string
          title_name: string
          user_id: string
        }
        Insert: {
          description?: string | null
          earned_at?: string
          icon?: string
          id?: string
          rarity?: Database["public"]["Enums"]["item_rarity"]
          title_key: string
          title_name: string
          user_id: string
        }
        Update: {
          description?: string | null
          earned_at?: string
          icon?: string
          id?: string
          rarity?: Database["public"]["Enums"]["item_rarity"]
          title_key?: string
          title_name?: string
          user_id?: string
        }
        Relationships: []
      }
      weekly_bosses: {
        Row: {
          completed_at: string | null
          created_at: string
          defeated_at: string | null
          description: string | null
          icon: string | null
          id: string
          name: string
          objectives: Json
          status: Database["public"]["Enums"]["boss_status"]
          updated_at: string
          user_id: string
          week_start: string
          xp_reward: number
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          defeated_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          name: string
          objectives?: Json
          status?: Database["public"]["Enums"]["boss_status"]
          updated_at?: string
          user_id: string
          week_start: string
          xp_reward?: number
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          defeated_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          name?: string
          objectives?: Json
          status?: Database["public"]["Enums"]["boss_status"]
          updated_at?: string
          user_id?: string
          week_start?: string
          xp_reward?: number
        }
        Relationships: []
      }
      workout_exercises: {
        Row: {
          created_at: string
          id: string
          name: string
          position: number
          reps: number
          sets: number
          user_id: string
          weight_kg: number | null
          workout_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          position?: number
          reps?: number
          sets?: number
          user_id: string
          weight_kg?: number | null
          workout_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          position?: number
          reps?: number
          sets?: number
          user_id?: string
          weight_kg?: number | null
          workout_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_exercises_workout_id_fkey"
            columns: ["workout_id"]
            isOneToOne: false
            referencedRelation: "workouts"
            referencedColumns: ["id"]
          },
        ]
      }
      workouts: {
        Row: {
          calories_burned: number | null
          duration_min: number
          id: string
          intensity: string | null
          notes: string | null
          performed_at: string
          user_id: string
          workout_type: string
        }
        Insert: {
          calories_burned?: number | null
          duration_min?: number
          id?: string
          intensity?: string | null
          notes?: string | null
          performed_at?: string
          user_id: string
          workout_type: string
        }
        Update: {
          calories_burned?: number | null
          duration_min?: number
          id?: string
          intensity?: string | null
          notes?: string | null
          performed_at?: string
          user_id?: string
          workout_type?: string
        }
        Relationships: []
      }
      xp_history: {
        Row: {
          amount: number
          created_at: string
          custom_skill_id: string | null
          id: string
          skill_category: Database["public"]["Enums"]["skill_category"] | null
          source: string
          source_key: string | null
          task_id: string | null
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          custom_skill_id?: string | null
          id?: string
          skill_category?: Database["public"]["Enums"]["skill_category"] | null
          source: string
          source_key?: string | null
          task_id?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          custom_skill_id?: string | null
          id?: string
          skill_category?: Database["public"]["Enums"]["skill_category"] | null
          source?: string
          source_key?: string | null
          task_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "xp_history_custom_skill_id_fkey"
            columns: ["custom_skill_id"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "xp_history_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      _award_xp_for_user: {
        Args: {
          p_amount: number
          p_custom_skill_id?: string
          p_skill?: Database["public"]["Enums"]["skill_category"]
          p_source: string
          p_user_id: string
        }
        Returns: undefined
      }
      _compute_task_xp: {
        Args: { p_base: number; p_completed_at: string; p_user_id: string }
        Returns: number
      }
      _recovery_xp_total: {
        Args: { p_days: number; p_difficulty: string }
        Returns: number
      }
      _refund_xp_for_user: {
        Args: {
          p_amount: number
          p_custom_skill_id?: string
          p_skill?: Database["public"]["Enums"]["skill_category"]
          p_user_id: string
        }
        Returns: undefined
      }
      award_title: {
        Args: {
          p_desc: string
          p_icon: string
          p_key: string
          p_name: string
          p_rarity: Database["public"]["Enums"]["item_rarity"]
          p_user_id: string
        }
        Returns: boolean
      }
      award_xp: {
        Args: {
          p_amount: number
          p_custom_skill_id?: string
          p_skill?: Database["public"]["Enums"]["skill_category"]
          p_source: string
        }
        Returns: undefined
      }
      bad_habit_relapse: {
        Args: { p_id: string; p_note?: string }
        Returns: undefined
      }
      bad_habit_sync_awards: { Args: never; Returns: undefined }
      calc_life_score: { Args: { p_user_id?: string }; Returns: number }
      check_all_titles: { Args: { p_user_id?: string }; Returns: number }
      check_rank: { Args: { p_user_id?: string }; Returns: string }
      complete_focus_session: {
        Args: { p_actual_seconds: number; p_id: string }
        Returns: number
      }
      complete_habit_today: { Args: { p_habit_id: string }; Returns: undefined }
      equip_title: { Args: { p_key: string }; Returns: undefined }
      generate_recurring_finance: { Args: never; Returns: number }
      generate_recurring_missions: { Args: never; Returns: number }
      generate_weekly_boss: { Args: { p_user_id?: string }; Returns: string }
      get_activity_heatmap: { Args: { p_year?: number }; Returns: Json }
      get_day_detail: { Args: { p_date: string }; Returns: Json }
      get_mission_stats: { Args: never; Returns: Json }
      get_user_stats: { Args: never; Returns: Json }
      get_weekly_boss_progress: { Args: never; Returns: Json }
      project_future: { Args: { p_days: number }; Returns: Json }
      recalc_xp: { Args: never; Returns: undefined }
      recompute_user_xp: { Args: { p_user: string }; Returns: number }
      record_timeline: {
        Args: {
          p_category: string
          p_description?: string
          p_icon?: string
          p_key: string
          p_metadata?: Json
          p_title: string
          p_user_id: string
        }
        Returns: undefined
      }
      refresh_mission_states: { Args: never; Returns: number }
      sync_life_state: { Args: never; Returns: Json }
      xp_ledger_for: {
        Args: { p_user: string }
        Returns: {
          amount: number
          custom_skill_id: string
          occurred_at: string
          skill: Database["public"]["Enums"]["skill_category"]
          source: string
          source_key: string
        }[]
      }
    }
    Enums: {
      bad_habit_difficulty: "easy" | "medium" | "hard"
      bad_habit_priority: "low" | "medium" | "high"
      boss_status: "active" | "completed" | "failed" | "expired"
      focus_mode: "pomodoro" | "deep_work" | "custom"
      item_kind:
        | "badge"
        | "artifact"
        | "boost"
        | "cosmetic"
        | "title"
        | "medal"
        | "book"
      item_rarity: "common" | "rare" | "epic" | "legendary" | "mythic"
      library_category:
        | "psicologia"
        | "filosofia"
        | "financas"
        | "programacao"
        | "negocios"
        | "saude"
        | "nutricao"
        | "exercicio"
        | "sobrevivencia"
        | "primeiros_socorros"
        | "fitness"
        | "idiomas"
        | "marketing"
        | "desenvolvimento_pessoal"
      library_item_type: "artigo" | "livro" | "curso" | "video" | "link" | "pdf"
      library_status: "em_andamento" | "concluido" | "pausado"
      skill_category:
        | "mente"
        | "corpo"
        | "conhecimento"
        | "financas"
        | "disciplina"
        | "social"
      task_category:
        | "estudo"
        | "treino"
        | "leitura"
        | "meditacao"
        | "nutricao"
        | "financas"
        | "habito"
        | "outro"
      task_difficulty:
        | "muito_facil"
        | "facil"
        | "media"
        | "dificil"
        | "epica"
        | "lendaria"
      task_priority: "baixa" | "normal" | "alta" | "urgente"
      task_repeat: "unica" | "diaria" | "semanal" | "mensal" | "personalizada"
      task_repeat_rule:
        | "every_day"
        | "weekdays"
        | "weekends"
        | "specific_days"
        | "every_x_days"
        | "every_x_weeks"
        | "every_x_months"
        | "custom_date"
      task_status:
        | "pendente"
        | "em_andamento"
        | "concluida"
        | "falhada"
        | "atrasada"
        | "cancelada"
      transaction_kind: "receita" | "despesa" | "transferencia"
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
      bad_habit_difficulty: ["easy", "medium", "hard"],
      bad_habit_priority: ["low", "medium", "high"],
      boss_status: ["active", "completed", "failed", "expired"],
      focus_mode: ["pomodoro", "deep_work", "custom"],
      item_kind: [
        "badge",
        "artifact",
        "boost",
        "cosmetic",
        "title",
        "medal",
        "book",
      ],
      item_rarity: ["common", "rare", "epic", "legendary", "mythic"],
      library_category: [
        "psicologia",
        "filosofia",
        "financas",
        "programacao",
        "negocios",
        "saude",
        "nutricao",
        "exercicio",
        "sobrevivencia",
        "primeiros_socorros",
        "fitness",
        "idiomas",
        "marketing",
        "desenvolvimento_pessoal",
      ],
      library_item_type: ["artigo", "livro", "curso", "video", "link", "pdf"],
      library_status: ["em_andamento", "concluido", "pausado"],
      skill_category: [
        "mente",
        "corpo",
        "conhecimento",
        "financas",
        "disciplina",
        "social",
      ],
      task_category: [
        "estudo",
        "treino",
        "leitura",
        "meditacao",
        "nutricao",
        "financas",
        "habito",
        "outro",
      ],
      task_difficulty: [
        "muito_facil",
        "facil",
        "media",
        "dificil",
        "epica",
        "lendaria",
      ],
      task_priority: ["baixa", "normal", "alta", "urgente"],
      task_repeat: ["unica", "diaria", "semanal", "mensal", "personalizada"],
      task_repeat_rule: [
        "every_day",
        "weekdays",
        "weekends",
        "specific_days",
        "every_x_days",
        "every_x_weeks",
        "every_x_months",
        "custom_date",
      ],
      task_status: [
        "pendente",
        "em_andamento",
        "concluida",
        "falhada",
        "atrasada",
        "cancelada",
      ],
      transaction_kind: ["receita", "despesa", "transferencia"],
    },
  },
} as const
