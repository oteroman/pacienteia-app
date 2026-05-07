import { createAdminClient } from '@/lib/supabase/admin'

// ── Types ─────────────────────────────────────────────────────
export type IntakeChannel =
  | 'whatsapp' | 'instagram' | 'facebook'
  | 'call'     | 'webform'   | 'manual'
  | 'tiktok'

export type IntakeIntent =
  | 'lead_inquiry' | 'appointment_request'
  | 'followup'     | 'urgent' | 'general'

export type IntakePriority = 'high' | 'medium' | 'low'
export type IntakeStatus   =
  | 'new' | 'in_progress'
  | 'waiting_customer' | 'waiting_staff'
  | 'resolved' | 'dismissed'

export interface Intake {
  id:                 string
  clinicId:           string
  sourceChannel:      IntakeChannel
  externalId:         string | null
  contactName:        string | null
  contactPhone:       string | null
  contactEmail:       string | null
  rawContent:         string
  normalizedSummary:  string | null
  detectedIntent:     IntakeIntent | null
  priority:           IntakePriority
  status:             IntakeStatus
  assignedTo:         string | null
  patientId:          string | null
  metadata:           Record<string, unknown>
  tasksCreated:       number
  // Orchestration
  firstResponseAt:    string | null
  slaDueAt:           string | null
  escalationLevel:    number
  interactionCount:   number
  followUpDueAt:      string | null
  createdAt:          string
  updatedAt:          string
  resolvedAt:         string | null
}

// ── Display metadata ──────────────────────────────────────────
export const CHANNEL_LABELS: Record<IntakeChannel, string> = {
  whatsapp:  'WhatsApp',
  instagram: 'Instagram',
  facebook:  'Facebook',
  call:      'Llamada',
  webform:   'Formulario web',
  manual:    'Manual',
  tiktok:    'TikTok',
}

export const CHANNEL_COLORS: Record<IntakeChannel, string> = {
  whatsapp:  'bg-green-100 text-green-700',
  instagram: 'bg-pink-100 text-pink-700',
  facebook:  'bg-blue-100 text-blue-700',
  call:      'bg-indigo-100 text-indigo-700',
  webform:   'bg-violet-100 text-violet-700',
  manual:    'bg-gray-100 text-gray-600',
  tiktok:    'bg-black/10 text-gray-900',
}

export const INTENT_LABELS: Record<IntakeIntent, string> = {
  lead_inquiry:         'Consulta / lead',
  appointment_request:  'Agendar cita',
  followup:             'Seguimiento',
  urgent:               'Urgencia',
  general:              'General',
}

export const INTENT_COLORS: Record<IntakeIntent, string> = {
  lead_inquiry:         'bg-blue-50 text-blue-700',
  appointment_request:  'bg-brand-50 text-brand-700',
  followup:             'bg-amber-50 text-amber-700',
  urgent:               'bg-red-50 text-red-700',
  general:              'bg-gray-50 text-gray-600',
}

export const PRIORITY_COLOR: Record<IntakePriority, string> = {
  high:   'bg-red-100 text-red-700',
  medium: 'bg-amber-100 text-amber-700',
  low:    'bg-gray-100 text-gray-500',
}

export const STATUS_LABEL: Record<IntakeStatus, string> = {
  new:              'Nuevo',
  in_progress:      'En proceso',
  waiting_customer: 'Esperando cliente',
  waiting_staff:    'Requiere atención',
  resolved:         'Resuelto',
  dismissed:        'Ignorado',
}

export const STATUS_COLOR: Record<IntakeStatus, string> = {
  new:              'bg-blue-50 text-blue-700',
  in_progress:      'bg-amber-50 text-amber-700',
  waiting_customer: 'bg-purple-50 text-purple-700',
  waiting_staff:    'bg-orange-50 text-orange-700',
  resolved:         'bg-green-50 text-green-700',
  dismissed:        'bg-gray-50 text-gray-500',
}

// ── DB row type ───────────────────────────────────────────────
type IntakeRow = {
  id: string; clinic_id: string; source_channel: string; external_id: string | null
  contact_name: string | null; contact_phone: string | null; contact_email: string | null
  raw_content: string; normalized_summary: string | null; detected_intent: string | null
  priority: string; status: string; assigned_to: string | null; patient_id: string | null
  metadata: Record<string, unknown>; tasks_created: number
  first_response_at: string | null; sla_due_at: string | null
  escalation_level: number; interaction_count: number; follow_up_due_at: string | null
  created_at: string; updated_at: string; resolved_at: string | null
}

function toIntake(r: IntakeRow): Intake {
  return {
    id:                r.id,
    clinicId:          r.clinic_id,
    sourceChannel:     r.source_channel as IntakeChannel,
    externalId:        r.external_id,
    contactName:       r.contact_name,
    contactPhone:      r.contact_phone,
    contactEmail:      r.contact_email,
    rawContent:        r.raw_content,
    normalizedSummary: r.normalized_summary,
    detectedIntent:    r.detected_intent as IntakeIntent | null,
    priority:          r.priority as IntakePriority,
    status:            r.status as IntakeStatus,
    assignedTo:        r.assigned_to,
    patientId:         r.patient_id,
    metadata:          r.metadata,
    tasksCreated:      r.tasks_created,
    firstResponseAt:   r.first_response_at,
    slaDueAt:          r.sla_due_at,
    escalationLevel:   r.escalation_level,
    interactionCount:  r.interaction_count,
    followUpDueAt:     r.follow_up_due_at,
    createdAt:         r.created_at,
    updatedAt:         r.updated_at,
    resolvedAt:        r.resolved_at,
  }
}

// ── Fetch ─────────────────────────────────────────────────────
const ACTIVE_STATUSES: IntakeStatus[] = ['new', 'in_progress', 'waiting_staff', 'waiting_customer']
const PRIORITY_RANK: Record<IntakePriority, number> = { high: 0, medium: 1, low: 2 }

export async function fetchInbox(clinicId: string): Promise<Intake[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any

  const { data } = await sb
    .from('intakes')
    .select('*')
    .eq('clinic_id', clinicId)
    .in('status', ACTIVE_STATUSES)
    .order('created_at', { ascending: false })
    .limit(100)

  return ((data ?? []) as IntakeRow[])
    .map(toIntake)
    .sort((a, b) => {
      // Escalated always first
      if (b.escalationLevel !== a.escalationLevel) return b.escalationLevel - a.escalationLevel
      // Then by priority
      const pd = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]
      if (pd !== 0) return pd
      // waiting_staff before others (needs immediate action)
      const statusRank = (s: IntakeStatus) => s === 'waiting_staff' ? 0 : s === 'new' ? 1 : 2
      return statusRank(a.status) - statusRank(b.status)
    })
}

export async function fetchIntake(clinicId: string, intakeId: string): Promise<Intake | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any

  const { data } = await sb
    .from('intakes')
    .select('*')
    .eq('clinic_id', clinicId)
    .eq('id', intakeId)
    .single()

  return data ? toIntake(data as IntakeRow) : null
}

export async function fetchRecentResolved(clinicId: string): Promise<Intake[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any

  const { data } = await sb
    .from('intakes')
    .select('*')
    .eq('clinic_id', clinicId)
    .in('status', ['resolved', 'dismissed'])
    .order('updated_at', { ascending: false })
    .limit(20)

  return ((data ?? []) as IntakeRow[]).map(toIntake)
}
