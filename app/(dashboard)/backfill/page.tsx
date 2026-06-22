import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getActiveClinicId } from '@/lib/tenant/active-clinic'
import { isFeatureAllowed } from '@/lib/plans/gating'
import { fetchBackfillDashboard } from '@/lib/backfill/index'
import { markSlotFilled, markSlotExpired } from '@/app/actions/backfill'
import type { SlotOpening, Candidate } from '@/lib/backfill/index'

export default async function BackfillPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const clinicId = await getActiveClinicId()
  if (!clinicId) redirect('/clinic-selector')

  const allowed = await isFeatureAllowed(clinicId, 'reactivation')
  if (!allowed) {
    return (
      <div className="max-w-2xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-ink">Backfill de slots</h1>
          <p className="text-sm text-slate mt-1">Huecos detectados + candidatos automáticos para llenar agenda</p>
        </div>
        <div className="rounded-2xl border border-fog bg-white p-10 text-center space-y-4">
          <p className="text-3xl">🔒</p>
          <p className="font-semibold text-ink">Disponible en plan Pro</p>
          <p className="text-sm text-slate max-w-sm mx-auto">
            El backfill automático detecta huecos en tu agenda y envía ofertas flash a pacientes inactivos. Incluido en el plan Pro y Premium.
          </p>
          <Link href="/pricing" className="inline-block bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors">
            Ver planes →
          </Link>
        </div>
      </div>
    )
  }

  const { stats, openSlots, filledToday } = await fetchBackfillDashboard(clinicId)
  const proactiveCount = openSlots.filter((s) => s.reasonOpened === 'gap_detected').length
  const reactiveCount  = openSlots.filter((s) => s.reasonOpened !== 'gap_detected').length

  return (
    <div className="max-w-5xl mx-auto space-y-8">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink">Backfill de slots</h1>
          <p className="text-sm text-slate mt-1">
            Huecos detectados + candidatos automáticos para llenar agenda
          </p>
        </div>
        {stats.open > 0 && (
          <span className="text-sm font-bold bg-blue-600 text-white px-3 py-1.5 rounded-full">
            {stats.open} slots abiertos
          </span>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard label="Slots abiertos"    value={stats.open}        color={stats.open > 0 ? 'text-amber-600' : 'text-slate'} />
        <StatCard label="Llenados hoy"      value={stats.filledToday} color={stats.filledToday > 0 ? 'text-lima-600' : 'text-slate'} />
        <StatCard label="Fill rate 30d"     value={stats.fillRate} suffix="%" color={stats.fillRate >= 50 ? 'text-lima-600' : stats.fillRate > 0 ? 'text-amber-600' : 'text-slate'} />
        <StatCard label="Total slots"       value={stats.totalSlots}  />
        <StatCard label="Proactivos"        value={proactiveCount}    color={proactiveCount > 0 ? 'text-violet-600' : 'text-slate'} />
        <StatCard label="Reactivos"         value={reactiveCount}     color={reactiveCount > 0  ? 'text-orange-500' : 'text-slate'} />
      </div>

      {/* Open slots */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-ink uppercase tracking-wide">
          Huecos disponibles
        </h2>

        {openSlots.length === 0 ? (
          <div className="rounded-2xl border bg-white p-8 text-center">
            <p className="text-sm text-slate">Sin slots abiertos. El sistema los detecta automáticamente cuando hay cancelaciones.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {openSlots.map((slot) => (
              <SlotCard key={slot.id} slot={slot} />
            ))}
          </div>
        )}
      </section>

      {/* Filled today */}
      {filledToday.length > 0 && (
        <section className="rounded-2xl border bg-white p-5 space-y-3">
          <h2 className="text-sm font-semibold text-ink">Llenados hoy</h2>
          <div className="space-y-2">
            {filledToday.map((slot) => (
              <div key={slot.id} className="flex items-center justify-between py-1.5 border-b border-fog last:border-0">
                <div>
                  <p className="text-xs text-[11px] font-semibold text-slate uppercase tracking-[0.06em]">{slot.treatmentType}</p>
                  <p className="text-[11px] text-slate">{formatSlotTime(slot.slotStart)}</p>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-lima-100 text-lima-700">
                  LLENADO
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────

function StatCard({
  label, value, suffix = '', color = 'text-ink',
}: { label: string; value: number; suffix?: string; color?: string }) {
  return (
    <div className="rounded-xl border bg-white p-4">
      <p className="text-xs text-slate">{label}</p>
      <p className={`text-3xl font-bold tabular-nums mt-1 ${color}`}>
        {value}{suffix}
      </p>
    </div>
  )
}

function SlotCard({ slot }: { slot: SlotOpening }) {
  const REASON_LABEL: Record<string, string> = {
    cancellation: 'Cancelación',
    no_show:      'Inasistencia',
    reschedule:   'Reprogramación',
    manual:       'Manual',
    gap_detected: 'Hueco detectado',
  }
  const REASON_COLOR: Record<string, string> = {
    cancellation: 'bg-red-100 text-red-700',
    no_show:      'bg-orange-100 text-orange-700',
    reschedule:   'bg-amber-100 text-amber-700',
    manual:       'bg-[#F3F6F9] text-slate',
    gap_detected: 'bg-violet-100 text-violet-700',
  }

  const isUrgent = new Date(slot.slotStart).getTime() - Date.now() < 48 * 60 * 60 * 1000

  return (
    <div className="rounded-2xl border bg-white overflow-hidden">
      {/* Slot header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-fog">
        <div className="flex items-center gap-3">
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-ink">{slot.treatmentType}</p>
              {isUrgent && (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-600 text-white">URGENTE</span>
              )}
            </div>
            <p className="text-xs text-slate mt-0.5">{formatSlotTime(slot.slotStart)}</p>
          </div>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${REASON_COLOR[slot.reasonOpened]}`}>
            {REASON_LABEL[slot.reasonOpened]}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate">
            {slot.candidateCount} candidato{slot.candidateCount !== 1 ? 's' : ''}
          </span>
          <form action={markSlotExpired.bind(null, slot.id)}>
            <button type="submit"
              className="text-[11px] px-2.5 py-1 rounded-lg bg-[#F3F6F9] text-slate hover:bg-fog">
              Expirar
            </button>
          </form>
        </div>
      </div>

      {/* Candidates */}
      {slot.candidates.length === 0 ? (
        <div className="px-5 py-4">
          <p className="text-xs text-slate italic">Sin candidatos encontrados para este tratamiento.</p>
        </div>
      ) : (
        <div className="divide-y divide-fog">
          {slot.candidates.map((c, i) => (
            <CandidateRow
              key={c.patientId}
              candidate={c}
              rank={i + 1}
              slotId={slot.id}
              isTop={i === 0}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function CandidateRow({
  candidate,
  rank,
  slotId,
  isTop,
}: {
  candidate: Candidate
  rank:      number
  slotId:    string
  isTop:     boolean
}) {
  return (
    <div className={`px-5 py-3 ${isTop ? 'bg-blue-50/40' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          {/* Rank + score */}
          <div className="flex flex-col items-center flex-shrink-0 pt-0.5">
            <span className={`text-[10px] font-bold w-6 h-6 rounded-full flex items-center justify-center ${
              rank === 1 ? 'bg-blue-600 text-white' : 'bg-[#F3F6F9] text-slate'
            }`}>
              {rank}
            </span>
            <span className="text-[9px] text-slate mt-0.5">{candidate.score}pts</span>
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-ink">{candidate.patientName}</p>
              {candidate.isWaitlisted && (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-green-600 text-white">WAITLIST</span>
              )}
            </div>
            <p className="text-xs text-slate">{candidate.phone}</p>
            <div className="flex flex-wrap gap-1 mt-1">
              {candidate.scoreReasons.map((r) => (
                <span key={r} className="text-[10px] px-1.5 py-0.5 rounded bg-[#F3F6F9] text-slate">{r}</span>
              ))}
            </div>

            {/* WA message preview */}
            <details className="mt-2">
              <summary className="text-[10px] text-blue-600 cursor-pointer hover:text-blue-800">
                Ver mensaje WhatsApp
              </summary>
              <pre className="mt-1 whitespace-pre-wrap text-[10px] bg-white border rounded p-2 text-slate font-sans">
                {candidate.waMessage}
              </pre>
            </details>
          </div>
        </div>

        {/* Fill action */}
        <form action={markSlotFilled.bind(null, slotId, candidate.patientId)}>
          <button type="submit"
            className={`text-[11px] px-2.5 py-1.5 rounded-lg font-medium flex-shrink-0 ${
              isTop
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-[#F3F6F9] text-slate hover:bg-fog'
            }`}>
            Marcar llenado
          </button>
        </form>
      </div>
    </div>
  )
}

function formatSlotTime(iso: string): string {
  return new Intl.DateTimeFormat('es-PE', {
    timeZone: 'America/Lima',
    weekday:  'long',
    day:      'numeric',
    month:    'long',
    hour:     '2-digit',
    minute:   '2-digit',
    hour12:   false,
  }).format(new Date(iso))
}
