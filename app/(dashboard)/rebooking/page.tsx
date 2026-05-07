import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getActiveClinicId } from '@/lib/tenant/active-clinic'
import { fetchRebookingDashboard } from '@/lib/rebooking/index'
import { markRebookingOutcome } from '@/app/actions/rebooking'
import type { RebookingRecord, FreedSlot } from '@/lib/rebooking/index'

export default async function RebookingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const clinicId = await getActiveClinicId()
  if (!clinicId) redirect('/clinic-selector')

  const { stats, cancelled, noResponse, slotsFreed, resolvedToday } =
    await fetchRebookingDashboard(clinicId)

  const totalPending = cancelled.length + noResponse.length

  return (
    <div className="max-w-5xl mx-auto space-y-8">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Rebooking</h1>
          <p className="text-sm text-gray-500 mt-1">
            Recuperación de cancelaciones, no-shows y silencios
          </p>
        </div>
        {totalPending > 0 && (
          <span className="text-sm font-bold bg-amber-500 text-white px-3 py-1.5 rounded-full">
            {totalPending} pendientes
          </span>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <Stat label="Pendientes"  value={stats.pending}    color={stats.pending > 0    ? 'text-amber-600'  : 'text-gray-900'} />
        <Stat label="Recuperados" value={stats.rebooked}   color={stats.rebooked > 0   ? 'text-green-600'  : 'text-gray-400'} />
        <Stat label="Escalados"   value={stats.escalated}  color={stats.escalated > 0  ? 'text-blue-600'   : 'text-gray-400'} />
        <Stat label="Sin rpta"    value={stats.noResponse} color={stats.noResponse > 0 ? 'text-orange-500' : 'text-gray-400'} />
        <Stat label="Perdidos"    value={stats.lost}       color={stats.lost > 0       ? 'text-red-500'    : 'text-gray-400'} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Cancelaciones */}
        <Section
          title="Cancelaciones por reagendar"
          empty="Sin cancelaciones pendientes"
          count={cancelled.length}
          countColor="bg-red-100 text-red-700"
        >
          {cancelled.map((r) => (
            <RebookCard key={r.id} record={r} triggerLabel="Canceló" triggerColor="bg-red-100 text-red-700" />
          ))}
        </Section>

        {/* No-responses */}
        <Section
          title="Sin respuesta al recordatorio"
          empty="Sin casos pendientes"
          count={noResponse.length}
          countColor="bg-orange-100 text-orange-700"
        >
          {noResponse.map((r) => (
            <RebookCard key={r.id} record={r} triggerLabel="Sin rpta" triggerColor="bg-orange-100 text-orange-700" />
          ))}
        </Section>

        {/* Slots liberados */}
        <Section
          title="Slots liberados hoy"
          empty="Sin slots liberados"
          count={slotsFreed.length}
          countColor="bg-blue-100 text-blue-700"
        >
          {slotsFreed.map((s) => (
            <SlotCard key={s.appointmentId} slot={s} />
          ))}
        </Section>

        {/* Resueltos hoy */}
        <Section
          title="Recuperados hoy"
          empty="Sin recuperaciones aún"
          count={resolvedToday.length}
          countColor="bg-green-100 text-green-700"
        >
          {resolvedToday.map((r) => (
            <ResolvedCard key={r.id} record={r} />
          ))}
        </Section>

      </div>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────

function Stat({ label, value, color = 'text-gray-900' }: { label: string; value: number; color?: string }) {
  return (
    <div className="rounded-xl border bg-white p-4">
      <p className="text-xs text-gray-400">{label}</p>
      <p className={`text-3xl font-bold tabular-nums mt-1 ${color}`}>{value}</p>
    </div>
  )
}

function Section({
  title, empty, count, countColor, children,
}: {
  title: string; empty: string; count: number; countColor: string; children: React.ReactNode
}) {
  return (
    <section className="rounded-2xl border bg-white p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-800">{title}</h2>
        {count > 0 && (
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${countColor}`}>{count}</span>
        )}
      </div>
      {count === 0
        ? <p className="text-xs text-gray-400">{empty}</p>
        : <div className="space-y-3">{children}</div>
      }
    </section>
  )
}

function RebookCard({
  record,
  triggerLabel,
  triggerColor,
}: {
  record: RebookingRecord
  triggerLabel: string
  triggerColor: string
}) {
  const scheduledFormatted = record.scheduledAt
    ? new Intl.DateTimeFormat('es-PE', {
        timeZone: 'America/Lima',
        weekday: 'short', day: 'numeric', month: 'short',
        hour: '2-digit', minute: '2-digit', hour12: false,
      }).format(new Date(record.scheduledAt))
    : null

  return (
    <div className="rounded-xl border border-gray-100 p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${triggerColor}`}>
            {triggerLabel}
          </span>
          {record.channel === 'whatsapp' && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-100 text-green-700">WA</span>
          )}
        </div>
        <span className="text-[10px] text-gray-400 flex-shrink-0">{timeAgo(record.createdAt)}</span>
      </div>

      <div>
        <p className="text-sm font-semibold text-gray-800">{record.patientName ?? '—'}</p>
        <p className="text-xs text-gray-500">{record.treatmentType ?? '—'}</p>
        {scheduledFormatted && (
          <p className="text-[11px] text-gray-400 mt-0.5">Cita: {scheduledFormatted}</p>
        )}
        {record.patientPhone && (
          <p className="text-[11px] text-gray-400">{record.patientPhone}</p>
        )}
      </div>

      {/* WhatsApp message preview */}
      {record.whatsappMessage && (
        <details className="text-[10px] text-gray-500">
          <summary className="cursor-pointer hover:text-gray-700">Ver mensaje WA</summary>
          <p className="mt-1 whitespace-pre-wrap bg-gray-50 rounded p-2 text-[10px]">
            {record.whatsappMessage}
          </p>
        </details>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1">
        <form action={markRebookingOutcome.bind(null, record.id, 'rebooked')}>
          <button type="submit"
            className="text-[11px] px-2.5 py-1 rounded-lg bg-green-600 text-white hover:bg-green-700 font-medium">
            Reagendado ✓
          </button>
        </form>
        <form action={markRebookingOutcome.bind(null, record.id, 'escalated')}>
          <button type="submit"
            className="text-[11px] px-2.5 py-1 rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-200 font-medium">
            Escalar
          </button>
        </form>
        <form action={markRebookingOutcome.bind(null, record.id, 'lost')}>
          <button type="submit"
            className="text-[11px] px-2.5 py-1 rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200 font-medium">
            Perdido
          </button>
        </form>
        <Link href={`/appointments`}
          className="text-[11px] px-2.5 py-1 rounded-lg border text-gray-600 hover:bg-gray-50">
          Citas →
        </Link>
      </div>
    </div>
  )
}

function SlotCard({ slot }: { slot: FreedSlot }) {
  const dt = new Intl.DateTimeFormat('es-PE', {
    timeZone: 'America/Lima',
    weekday: 'short', day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date(slot.scheduledAt))

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-blue-100 bg-blue-50/40 p-3">
      <div>
        <p className="text-sm font-semibold text-gray-800">{slot.treatmentType}</p>
        <p className="text-xs text-gray-500">{dt}</p>
        {slot.patientName && (
          <p className="text-[11px] text-gray-400">Antes: {slot.patientName}</p>
        )}
      </div>
      <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-blue-600 text-white flex-shrink-0">
        LIBRE
      </span>
    </div>
  )
}

function ResolvedCard({ record }: { record: RebookingRecord }) {
  const outcomeLabel: Record<string, string> = {
    rebooked:    'Reagendado',
    escalated:   'Escalado',
    lost:        'Perdido',
    no_response: 'Sin respuesta',
  }
  const outcomeColor: Record<string, string> = {
    rebooked:    'bg-green-100 text-green-700',
    escalated:   'bg-blue-100 text-blue-700',
    lost:        'bg-gray-100 text-gray-500',
    no_response: 'bg-orange-100 text-orange-600',
  }

  return (
    <div className="flex items-center justify-between gap-3 py-2 border-b border-gray-50 last:border-0">
      <div className="min-w-0">
        <p className="text-xs font-semibold text-gray-700 truncate">{record.patientName ?? '—'}</p>
        <p className="text-[11px] text-gray-400">{record.treatmentType ?? '—'}</p>
      </div>
      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${outcomeColor[record.outcome] ?? 'bg-gray-100 text-gray-500'}`}>
        {outcomeLabel[record.outcome] ?? record.outcome}
      </span>
    </div>
  )
}

function timeAgo(iso: string): string {
  const diff  = Date.now() - new Date(iso).getTime()
  const mins  = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  const days  = Math.floor(diff / 86_400_000)
  if (mins < 1)   return 'ahora'
  if (mins < 60)  return `${mins}m`
  if (hours < 24) return `${hours}h`
  return `${days}d`
}
