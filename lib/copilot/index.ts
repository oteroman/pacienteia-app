import { createAdminClient } from '@/lib/supabase/admin'

// ── Types ─────────────────────────────────────────────────────
export type SourceType    = 'whatsapp_text' | 'whatsapp_audio' | 'phone_call' | 'staff_note' | 'chat'
export type InteractionStatus = 'pending' | 'processing' | 'done' | 'failed'
export type CopilotTaskStatus   = 'open' | 'done' | 'dismissed'
export type CopilotTaskPriority = 'high' | 'medium' | 'low'

export interface Interaction {
  id:           string
  clinicId:     string
  sourceType:   SourceType
  rawContent:   string
  patientId:    string | null
  patientName:  string | null
  status:       InteractionStatus
  summary:      string | null
  commitments:  string[]
  risks:        string[]
  tasksCreated: number
  createdAt:    string
}

export interface CopilotTask {
  id:            string
  interactionId: string
  clinicId:      string
  patientId:     string | null
  patientName:   string | null
  sourceType:    SourceType
  title:         string
  description:   string | null
  priority:      CopilotTaskPriority
  status:        CopilotTaskStatus
  dueDate:       string | null
  resolvedAt:    string | null
  createdAt:     string
}

// ── Source type display metadata ──────────────────────────────
export const SOURCE_LABELS: Record<SourceType, string> = {
  whatsapp_text:  'WhatsApp texto',
  whatsapp_audio: 'Audio / voz',
  phone_call:     'Llamada',
  staff_note:     'Nota de staff',
  chat:           'Chat',
}

export const SOURCE_COLORS: Record<SourceType, string> = {
  whatsapp_text:  'bg-green-100 text-green-700',
  whatsapp_audio: 'bg-teal-100 text-teal-700',
  phone_call:     'bg-blue-100 text-blue-700',
  staff_note:     'bg-gray-100 text-gray-700',
  chat:           'bg-purple-100 text-purple-700',
}

const PRIORITY_ORDER: Record<CopilotTaskPriority, number> = { high: 0, medium: 1, low: 2 }

// ── Raw DB row types ──────────────────────────────────────────
type IntRow = {
  id: string; clinic_id: string; source_type: string; raw_content: string
  patient_id: string | null; status: string; created_at: string
  interaction_summaries: {
    summary: string; commitments: unknown[]; risks: unknown[]; tasks_created: number
  } | null
  patients: { full_name: string } | null
}

type TaskRow = {
  id: string; interaction_id: string; clinic_id: string; patient_id: string | null
  title: string; description: string | null; priority: string; status: string
  due_date: string | null; resolved_at: string | null; created_at: string
  interactions: { source_type: string } | null
  patients: { full_name: string } | null
}

// ── Fetch ─────────────────────────────────────────────────────
export interface CopilotDashboardData {
  interactions: Interaction[]
  openTasks:    CopilotTask[]
}

export async function fetchCopilotDashboard(clinicId: string): Promise<CopilotDashboardData> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any

  const [intRes, taskRes] = await Promise.all([
    sb.from('interactions')
      .select('*, interaction_summaries(summary, commitments, risks, tasks_created), patients(full_name)')
      .eq('clinic_id', clinicId)
      .order('created_at', { ascending: false })
      .limit(20),
    sb.from('copilot_tasks')
      .select('*, interactions(source_type), patients(full_name)')
      .eq('clinic_id', clinicId)
      .eq('status', 'open')
      .order('created_at', { ascending: false })
      .limit(50),
  ])

  const interactions: Interaction[] = ((intRes.data ?? []) as IntRow[]).map((r) => ({
    id:           r.id,
    clinicId:     r.clinic_id,
    sourceType:   r.source_type as SourceType,
    rawContent:   r.raw_content,
    patientId:    r.patient_id,
    patientName:  r.patients?.full_name ?? null,
    status:       r.status as InteractionStatus,
    summary:      r.interaction_summaries?.summary ?? null,
    commitments:  (r.interaction_summaries?.commitments ?? []) as string[],
    risks:        (r.interaction_summaries?.risks ?? []) as string[],
    tasksCreated: r.interaction_summaries?.tasks_created ?? 0,
    createdAt:    r.created_at,
  }))

  const openTasks: CopilotTask[] = ((taskRes.data ?? []) as TaskRow[])
    .map((r) => ({
      id:            r.id,
      interactionId: r.interaction_id,
      clinicId:      r.clinic_id,
      patientId:     r.patient_id,
      patientName:   r.patients?.full_name ?? null,
      sourceType:    (r.interactions?.source_type ?? 'staff_note') as SourceType,
      title:         r.title,
      description:   r.description,
      priority:      r.priority as CopilotTaskPriority,
      status:        r.status as CopilotTaskStatus,
      dueDate:       r.due_date,
      resolvedAt:    r.resolved_at,
      createdAt:     r.created_at,
    }))
    .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority])

  return { interactions, openTasks }
}
