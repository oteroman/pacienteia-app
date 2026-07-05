import { createAdminClient }            from '@/lib/supabase/admin'
import { fetchAllClinicsPerformance }   from '@/lib/analytics/revenue'
import type { PeriodKey, AllClinicsRow } from '@/lib/analytics/revenue'

// ── Signal types ──────────────────────────────────────────────
export type SignalKey =
  | 'expansion_ready'
  | 'expansion_low_hanging'
  | 'healthy_renewal'
  | 'renewal_watch'
  | 'renewal_risk'
  | 'inactive'

export interface SignalMeta {
  label:       string
  description: string
  cta:         string
  color:       string   // Tailwind color classes (badge)
  priority:    number   // lower = shown first
}

export const SIGNAL_META: Record<SignalKey, SignalMeta> = {
  renewal_risk: {
    label:       'Riesgo de churn',
    description: 'Fricción alta o caída severa de uso. Intervención humana urgente.',
    cta:         'Intervenir ahora',
    color:       'bg-red-100 text-red-700 border-red-200',
    priority:    0,
  },
  expansion_ready: {
    label:       'Lista para expansión',
    description: 'Alto fill rate, SLA y revenue recuperado. Momento ideal para propuesta de upgrade.',
    cta:         'Enviar propuesta de upgrade',
    color:       'bg-green-100 text-green-700 border-green-200',
    priority:    1,
  },
  expansion_low_hanging: {
    label:       'Oportunidad de upgrade',
    description: 'Buen desempeño. Un CTA simple de plan superior puede convertir.',
    cta:         'Enviar CTA de upgrade',
    color:       'bg-emerald-100 text-emerald-700 border-emerald-200',
    priority:    2,
  },
  healthy_renewal: {
    label:       'Renovación sana',
    description: 'Operación estable. Preparar renovación y solicitar testimonio.',
    cta:         'Preparar renovación',
    color:       'bg-blue-100 text-blue-700 border-blue-200',
    priority:    3,
  },
  renewal_watch: {
    label:       'Bajo supervisión',
    description: 'Adopción baja o decreciente. Check-in de fricción antes del próximo ciclo.',
    cta:         'Agendar check-in',
    color:       'bg-amber-100 text-amber-700 border-amber-200',
    priority:    4,
  },
  inactive: {
    label:       'Sin actividad',
    description: 'Sin citas ni ingresos en el período. Verificar onboarding o reactivar.',
    cta:         'Revisar cuenta',
    color:       'bg-gray-100 text-gray-500 border-gray-200',
    priority:    5,
  },
}

// ── Playbooks (suggested actions) ─────────────────────────────
export interface PlaybookStep {
  step:    number
  action:  string
}

export const PLAYBOOKS: Record<SignalKey, PlaybookStep[]> = {
  renewal_risk: [
    { step: 1, action: 'Llamada de rescate en < 48h para entender causa raíz' },
    { step: 2, action: 'Revisar si hay fricción técnica o de adopción no resuelta' },
    { step: 3, action: 'Ofrecer sesión de onboarding intensivo o ajuste de plan' },
    { step: 4, action: 'Documentar resultado en notas de cuenta' },
  ],
  expansion_ready: [
    { step: 1, action: 'Preparar propuesta con ROI documentado de los últimos 30 días' },
    { step: 2, action: 'Enviar propuesta de upgrade con comparativa de plan actual vs superior' },
    { step: 3, action: 'Follow-up en 5 días hábiles si no hay respuesta' },
  ],
  expansion_low_hanging: [
    { step: 1, action: 'Enviar mensaje de "valor que se están perdiendo" con plan superior' },
    { step: 2, action: 'Si responde positivo, pasar a propuesta formal' },
  ],
  healthy_renewal: [
    { step: 1, action: 'Confirmar renovación automática con 30 días de anticipación' },
    { step: 2, action: 'Solicitar testimonio o caso de éxito' },
    { step: 3, action: 'Evaluar si aplica upsell en la renovación' },
  ],
  renewal_watch: [
    { step: 1, action: 'Check-in de adopción: ¿están usando el inbox, copiloto y backfill?' },
    { step: 2, action: 'Identificar la funcionalidad con mayor drop-off' },
    { step: 3, action: 'Ofrecer sesión de reactivación guiada' },
  ],
  inactive: [
    { step: 1, action: 'Verificar que el onboarding se completó correctamente' },
    { step: 2, action: 'Campaña de reactivación por WhatsApp o email directo' },
    { step: 3, action: 'Si no responde en 14 días, evaluar offboarding o downgrade' },
  ],
}

// ── Signal computation ─────────────────────────────────────────
function computeSignal(
  row:          AllClinicsRow,
  slotsOpened:  number,
  intakesTotal: number,
): { signal: SignalKey; reasons: string[] } {
  const hasActivity = row.completed > 0 || row.revenueActual > 0

  if (!hasActivity) {
    return { signal: 'inactive', reasons: ['Sin citas completadas ni revenue en el período'] }
  }

  // ── renewal_risk: any severe friction ────────────────────────
  const reasons: string[] = []
  if (slotsOpened >= 3 && row.fillRate < 20)  reasons.push(`Fill rate crítico: ${row.fillRate}%`)
  if (intakesTotal >= 5 && row.slaMetRate < 30) reasons.push(`SLA crítico: ${row.slaMetRate}%`)
  if (row.cancellations > 0 && row.completed > 0) {
    const cancelRate = Math.round((row.cancellations / (row.completed + row.cancellations)) * 100)
    if (cancelRate > 50) reasons.push(`Cancelaciones: ${cancelRate}%`)
  }
  if (reasons.length > 0) return { signal: 'renewal_risk', reasons }

  // ── expansion_ready: top performers ──────────────────────────
  if (row.fillRate >= 70 && row.slaMetRate >= 70 && row.recoveredValue > 0) {
    return {
      signal: 'expansion_ready',
      reasons: [`Fill rate: ${row.fillRate}%`, `SLA: ${row.slaMetRate}%`, `Revenue recuperado activo`],
    }
  }

  // ── expansion_low_hanging: good but not top ───────────────────
  if ((row.fillRate >= 50 || row.slaMetRate >= 60) && row.score >= 50) {
    return {
      signal:  'expansion_low_hanging',
      reasons: [`Score: ${row.score}/100`, `Fill: ${row.fillRate}%`, `SLA: ${row.slaMetRate}%`],
    }
  }

  // ── healthy_renewal: stable ───────────────────────────────────
  if (row.fillRate >= 40 && row.slaMetRate >= 50 && row.score >= 40) {
    return {
      signal:  'healthy_renewal',
      reasons: [`Score: ${row.score}/100`, 'Operación estable'],
    }
  }

  // ── renewal_watch: catch-all for underperforming active accounts
  return {
    signal: 'renewal_watch',
    reasons: [
      row.fillRate < 40    ? `Fill rate bajo: ${row.fillRate}%` : null,
      row.slaMetRate < 50  ? `SLA bajo: ${row.slaMetRate}%` : null,
      `Score: ${row.score}/100`,
    ].filter(Boolean) as string[],
  }
}

// ── Public types and fetcher ──────────────────────────────────
export interface ClinicSignal {
  clinicId:    string
  clinicName:  string
  signal:      SignalKey
  reasons:     string[]
  kpis:        AllClinicsRow
  slotsOpened: number
  intakesTotal: number
  meta:        SignalMeta
  playbook:    PlaybookStep[]
}

export interface RenewalDashboard {
  bySigal: Record<SignalKey, ClinicSignal[]>
  counts:  Record<SignalKey, number>
  total:   number
}

export async function fetchRenewalSignals(periodKey: PeriodKey = '30d'): Promise<ClinicSignal[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb     = createAdminClient() as any
  const now    = new Date()
  const pDays  = periodKey === 'week' ? 7 : 30
  const start  = new Date(now.getTime() - pDays * 86_400_000).toISOString()

  const [rows, slotRes, intakeRes] = await Promise.all([
    fetchAllClinicsPerformance(periodKey),

    sb.from('slot_openings')
      .select('organization_id')
      .gte('created_at', start),

    sb.from('intakes')
      .select('organization_id')
      .gte('created_at', start),
  ])

  type IdRow = { organization_id: string }
  const slotsByClinic   = new Map<string, number>()
  const intakesByClinic = new Map<string, number>()

  for (const r of (slotRes.data ?? []) as IdRow[]) {
    slotsByClinic.set(r.organization_id, (slotsByClinic.get(r.organization_id) ?? 0) + 1)
  }
  for (const r of (intakeRes.data ?? []) as IdRow[]) {
    intakesByClinic.set(r.organization_id, (intakesByClinic.get(r.organization_id) ?? 0) + 1)
  }

  const signals: ClinicSignal[] = rows.map((row) => {
    const slotsOpened  = slotsByClinic.get(row.clinicId) ?? 0
    const intakesTotal = intakesByClinic.get(row.clinicId) ?? 0
    const { signal, reasons } = computeSignal(row, slotsOpened, intakesTotal)

    return {
      clinicId:    row.clinicId,
      clinicName:  row.clinicName,
      signal,
      reasons,
      kpis:        row,
      slotsOpened,
      intakesTotal,
      meta:        SIGNAL_META[signal],
      playbook:    PLAYBOOKS[signal],
    }
  })

  return signals.sort((a, b) => a.meta.priority - b.meta.priority)
}

export async function fetchClinicSignal(clinicId: string, periodKey: PeriodKey = '30d'): Promise<ClinicSignal | null> {
  const all = await fetchRenewalSignals(periodKey)
  return all.find((s) => s.clinicId === clinicId) ?? null
}
