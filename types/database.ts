// Auto-generated from Supabase schema — 2026-05-05
// Regenerate with: npm run types

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      appointments: {
        Row: {
          assigned_staff_id: string | null
          clinic_id: string
          created_at: string
          deleted_at: string | null
          id: string
          metadata: Json
          notes: string | null
          patient_id: string
          price: number | null
          scheduled_at: string
          status: string
          treatment_type: string
          updated_at: string
        }
        Insert: {
          assigned_staff_id?: string | null
          clinic_id: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          metadata?: Json
          notes?: string | null
          patient_id: string
          price?: number | null
          scheduled_at: string
          status?: string
          treatment_type: string
          updated_at?: string
        }
        Update: {
          assigned_staff_id?: string | null
          clinic_id?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          metadata?: Json
          notes?: string | null
          patient_id?: string
          price?: number | null
          scheduled_at?: string
          status?: string
          treatment_type?: string
          updated_at?: string
        }
        Relationships: [
          { foreignKeyName: 'appointments_clinic_id_fkey'; columns: ['clinic_id']; referencedRelation: 'clinics'; referencedColumns: ['id'] },
          { foreignKeyName: 'appointments_patient_id_fkey'; columns: ['patient_id']; referencedRelation: 'patients'; referencedColumns: ['id'] },
        ]
      }
      clinic_members: {
        Row: {
          clinic_id: string
          created_at: string
          id: string
          role: 'owner' | 'admin' | 'staff'
          user_id: string
        }
        Insert: {
          clinic_id: string
          created_at?: string
          id?: string
          role: 'owner' | 'admin' | 'staff'
          user_id: string
        }
        Update: {
          clinic_id?: string
          created_at?: string
          id?: string
          role?: 'owner' | 'admin' | 'staff'
          user_id?: string
        }
        Relationships: [
          { foreignKeyName: 'clinic_members_clinic_id_fkey'; columns: ['clinic_id']; referencedRelation: 'clinics'; referencedColumns: ['id'] },
        ]
      }
      clinics: {
        Row: {
          address: string | null
          billing_email: string | null
          city: string
          country: string
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          deleted_at: string | null
          id: string
          logo_url: string | null
          name: string
          phone: string | null
          plan: 'trial' | 'basic' | 'pro' | 'premium'
          settings: Json
          slug: string
          subscription_status: 'trialing' | 'active' | 'overdue' | 'cancelled'
          ticket_avg: number
          trial_ends_at: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          billing_email?: string | null
          city?: string
          country?: string
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          deleted_at?: string | null
          id?: string
          logo_url?: string | null
          name: string
          phone?: string | null
          plan?: 'trial' | 'basic' | 'pro' | 'premium'
          settings?: Json
          slug: string
          subscription_status?: 'trialing' | 'active' | 'overdue' | 'cancelled'
          ticket_avg?: number
          trial_ends_at?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          billing_email?: string | null
          city?: string
          country?: string
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          deleted_at?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          phone?: string | null
          plan?: 'trial' | 'basic' | 'pro' | 'premium'
          settings?: Json
          slug?: string
          subscription_status?: 'trialing' | 'active' | 'overdue' | 'cancelled'
          ticket_avg?: number
          trial_ends_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      subscription_usage: {
        Row: {
          active_users: number
          appointments_count: number
          clinic_id: string
          id: string
          leads_count: number
          period_start: string
          updated_at: string
        }
        Insert: {
          active_users?: number
          appointments_count?: number
          clinic_id: string
          id?: string
          leads_count?: number
          period_start: string
          updated_at?: string
        }
        Update: {
          active_users?: number
          appointments_count?: number
          clinic_id?: string
          id?: string
          leads_count?: number
          period_start?: string
          updated_at?: string
        }
        Relationships: [
          { foreignKeyName: 'subscription_usage_clinic_id_fkey'; columns: ['clinic_id']; referencedRelation: 'clinics'; referencedColumns: ['id'] }
        ]
      }
      lead_events: {
        Row: {
          clinic_id: string
          created_at: string
          deleted_at: string | null
          event_type: string
          id: string
          patient_id: string | null
          payload: Json
          processed: boolean
          source: string | null
        }
        Insert: {
          clinic_id: string
          created_at?: string
          deleted_at?: string | null
          event_type: string
          id?: string
          patient_id?: string | null
          payload?: Json
          processed?: boolean
          source?: string | null
        }
        Update: {
          clinic_id?: string
          created_at?: string
          deleted_at?: string | null
          event_type?: string
          id?: string
          patient_id?: string | null
          payload?: Json
          processed?: boolean
          source?: string | null
        }
        Relationships: []
      }
      metrics_daily: {
        Row: {
          appointments_cancelled: number
          appointments_completed: number
          appointments_confirmed: number
          appointments_no_show: number
          appointments_scheduled: number
          clinic_id: string
          created_at: string
          date: string
          estimated_revenue_recovered: number
          id: string
          leads_captured: number
          new_patients: number
          reactivated_patients: number
          updated_at: string
        }
        Insert: {
          appointments_cancelled?: number
          appointments_completed?: number
          appointments_confirmed?: number
          appointments_no_show?: number
          appointments_scheduled?: number
          clinic_id: string
          created_at?: string
          date: string
          estimated_revenue_recovered?: number
          id?: string
          leads_captured?: number
          new_patients?: number
          reactivated_patients?: number
          updated_at?: string
        }
        Update: {
          appointments_cancelled?: number
          appointments_completed?: number
          appointments_confirmed?: number
          appointments_no_show?: number
          appointments_scheduled?: number
          clinic_id?: string
          created_at?: string
          date?: string
          estimated_revenue_recovered?: number
          id?: string
          leads_captured?: number
          new_patients?: number
          reactivated_patients?: number
          updated_at?: string
        }
        Relationships: []
      }
      patients: {
        Row: {
          clinic_id: string
          created_at: string
          deleted_at: string | null
          dni: string | null
          email: string | null
          full_name: string
          id: string
          last_visit_date: string | null
          metadata: Json
          notes: string | null
          phone: string | null
          photo_url: string | null
          status: 'active' | 'inactive' | 'lead' | 'blocked'
          tags: string[]
          updated_at: string
        }
        Insert: {
          clinic_id: string
          created_at?: string
          deleted_at?: string | null
          dni?: string | null
          email?: string | null
          full_name: string
          id?: string
          last_visit_date?: string | null
          metadata?: Json
          notes?: string | null
          phone?: string | null
          photo_url?: string | null
          status?: 'active' | 'inactive' | 'lead' | 'blocked'
          tags?: string[]
          updated_at?: string
        }
        Update: {
          clinic_id?: string
          created_at?: string
          deleted_at?: string | null
          dni?: string | null
          email?: string | null
          full_name?: string
          id?: string
          last_visit_date?: string | null
          metadata?: Json
          notes?: string | null
          phone?: string | null
          photo_url?: string | null
          status?: 'active' | 'inactive' | 'lead' | 'blocked'
          tags?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      workflow_runs: {
        Row: {
          clinic_id: string
          completed_at: string | null
          entity_id: string | null
          entity_type: string | null
          error: string | null
          event_type: string
          id: string
          payload: Json
          result: Json | null
          status: 'pending' | 'running' | 'success' | 'failed'
          triggered_at: string
        }
        Insert: {
          clinic_id: string
          completed_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          error?: string | null
          event_type: string
          id?: string
          payload?: Json
          result?: Json | null
          status?: 'pending' | 'running' | 'success' | 'failed'
          triggered_at?: string
        }
        Update: {
          clinic_id?: string
          completed_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          error?: string | null
          event_type?: string
          id?: string
          payload?: Json
          result?: Json | null
          status?: 'pending' | 'running' | 'success' | 'failed'
          triggered_at?: string
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      has_clinic_role: { Args: { p_clinic_id: string; p_role: string }; Returns: boolean }
      is_clinic_member: { Args: { p_clinic_id: string }; Returns: boolean }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

// Convenience aliases
export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row']

export type TablesInsert<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert']

export type TablesUpdate<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update']

// Domain types
export type Clinic        = Tables<'clinics'>
export type ClinicMember  = Tables<'clinic_members'>
export type Profile       = Tables<'profiles'>
export type Patient       = Tables<'patients'>
export type Appointment   = Tables<'appointments'>
export type LeadEvent          = Tables<'lead_events'>
export type WorkflowRun        = Tables<'workflow_runs'>
export type MetricsDaily       = Tables<'metrics_daily'>
export type SubscriptionUsageRow = Tables<'subscription_usage'>

export type ClinicRole = 'owner' | 'admin' | 'staff'
export type PatientStatus = 'active' | 'inactive' | 'lead' | 'blocked'
export type AppointmentStatus = 'scheduled' | 'confirmed' | 'completed' | 'cancelled' | 'no_show'
export type WorkflowStatus = 'pending' | 'running' | 'success' | 'failed'
export type Plan = 'trial' | 'basic' | 'pro' | 'premium'
export type SubscriptionStatus = 'trialing' | 'active' | 'overdue' | 'cancelled'
export type SubscriptionUsage = Tables<'subscription_usage'>

export type ClinicWithRole = Clinic & { role: ClinicRole }
