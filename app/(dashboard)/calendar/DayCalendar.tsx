'use client'

import { useRouter }               from 'next/navigation'
import { useState, useRef, useEffect } from 'react'
import { dragRescheduleAppointment } from '@/app/actions/appointments'
import type { CalendarAppointment, CalendarProfessional, CalendarSchedule, CalendarBlock } from './page'

// ── Grid constants ────────────────────────────────────────────────────────────

const START_HOUR   = 7
const END_HOUR     = 20
const SLOT_MIN     = 30
const SLOT_H       = 52
const DURATION_MIN = 60
const TOTAL_SLOTS  = ((END_HOUR - START_HOUR) * 60) / SLOT_MIN
const GRID_H       = TOTAL_SLOTS * SLOT_H

const LIMA_OFFSET_MS = -5 * 60 * 60 * 1000

// ── Helpers ───────────────────────────────────────────────────────────────────

function utcToLima(ms: number): Date { return new Date(ms + LIMA_OFFSET_MS) }

function limaHM(isoUtc: string): { h: number; m: number } {
  const d = utcToLima(new Date(isoUtc).getTime())
  return { h: d.getUTCHours(), m: d.getUTCMinutes() }
}

function addDays(isoDate: string, n: number): string {
  const d = new Date(isoDate + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}

function formatFullDate(dayISO: string): string {
  const d    = new Date(dayISO + 'T12:00:00Z')
  const dow  = d.getUTCDay()
  const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
  const mons = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
  return `${days[dow]} ${d.getUTCDate()} de ${mons[d.getUTCMonth() + 1]}`
}

function aptTopPx(isoUtc: string): number {
  const { h, m } = limaHM(isoUtc)
  return ((h - START_HOUR) * 60 + m) / SLOT_MIN * SLOT_H
}

function formatTime(isoUtc: string): string {
  const { h, m } = limaHM(isoUtc)
  return `${h}:${String(m).padStart(2, '0')}`
}

function slotToTime(slotIdx: number): string {
  const totalMin = START_HOUR * 60 + slotIdx * SLOT_MIN
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  return `${h}:${String(m).padStart(2, '0')}`
}

// ── Overlap layout ────────────────────────────────────────────────────────────

interface PositionedApt extends CalendarAppointment {
  topPx: number; heightPx: number; col: number; colCount: number
}

function aptDurationMin(apt: CalendarAppointment): number {
  return apt.duration_min && apt.duration_min > 0 ? apt.duration_min : DURATION_MIN
}

function layoutApts(apts: CalendarAppointment[]): PositionedApt[] {
  const sorted = [...apts].sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at))
  const cols: CalendarAppointment[][] = []

  for (const apt of sorted) {
    const start = new Date(apt.scheduled_at).getTime()
    let placed = false
    for (let c = 0; c < cols.length; c++) {
      const last    = cols[c].at(-1)!
      const lastEnd = new Date(last.scheduled_at).getTime() + aptDurationMin(last) * 60_000
      if (start >= lastEnd) {
        cols[c].push(apt); placed = true; break
      }
    }
    if (!placed) cols.push([apt])
  }

  const result: PositionedApt[] = []
  for (let c = 0; c < cols.length; c++) {
    for (const apt of cols[c]) {
      result.push({ ...apt, topPx: aptTopPx(apt.scheduled_at), heightPx: (aptDurationMin(apt) / SLOT_MIN) * SLOT_H, col: c, colCount: cols.length })
    }
  }
  return result
}

// ── Time labels ───────────────────────────────────────────────────────────────

const TIME_LABELS = Array.from({ length: TOTAL_SLOTS + 1 }, (_, i) => {
  const totalMin = START_HOUR * 60 + i * SLOT_MIN
  const h = Math.floor(totalMin / 60), m = totalMin % 60
  return { label: `${h}:${String(m).padStart(2, '0')}`, topPx: i * SLOT_H, isHour: m === 0 }
})

const STATUS_OPACITY: Record<string, string> = {
  confirmed: 'opacity-100', scheduled: 'opacity-90', completed: 'opacity-50', no_show: 'opacity-30 grayscale',
}

const STATUS_LABEL: Record<string, { text: string; cls: string }> = {
  confirmed: { text: 'Confirmada', cls: 'bg-lima-50 text-lima-700' },
  scheduled: { text: 'Programada', cls: 'bg-blue-50 text-blue-700' },
  completed: { text: 'Atendida',   cls: 'bg-mist text-slate'      },
  no_show:   { text: 'No asistió', cls: 'bg-red-50 text-red-700'  },
}

// ── Availability helpers ──────────────────────────────────────────────────────

function timeStrToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

function minutesToGridPx(totalMin: number): number {
  return (totalMin - START_HOUR * 60) / SLOT_MIN * SLOT_H
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  appointments:  CalendarAppointment[]
  professionals: CalendarProfessional[]
  schedules:     CalendarSchedule[]
  blocks:        CalendarBlock[]
  dayISO:        string
  weekStartISO:  string
  todayISO:      string
}

// ── Drag state ────────────────────────────────────────────────────────────────

interface DragInfo { aptId: string; offsetY: number }
interface DropTarget { colKey: string; slotIdx: number }

// ── Component ─────────────────────────────────────────────────────────────────

export default function DayCalendar({ appointments, professionals, schedules, blocks, dayISO, weekStartISO, todayISO }: Props) {
  const router = useRouter()

  const dragRef                     = useRef<DragInfo | null>(null)
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null)
  const [dragging, setDragging]     = useState(false)
  const [saving, setSaving]         = useState(false)

  // Current-time indicator ("ahora") — only on today's date, client-only.
  const [nowPx, setNowPx] = useState<number | null>(null)
  useEffect(() => {
    if (dayISO !== todayISO) { setNowPx(null); return }
    function tick() {
      const lima = utcToLima(Date.now())
      const mins = lima.getUTCHours() * 60 + lima.getUTCMinutes()
      setNowPx(mins < START_HOUR * 60 || mins > END_HOUR * 60 ? null : (mins - START_HOUR * 60) / SLOT_MIN * SLOT_H)
    }
    tick()
    const id = setInterval(tick, 60_000)
    return () => clearInterval(id)
  }, [dayISO, todayISO])

  // Hover preview card
  const [hover, setHover] = useState<{ apt: CalendarAppointment; rect: DOMRect } | null>(null)

  const isToday = dayISO === todayISO
  const prevDay = addDays(dayISO, -1)
  const nextDay = addDays(dayISO, 1)

  const dayDow = new Date(dayISO + 'T12:00:00Z').getUTCDay()

  // Build columns: one per professional + one for unassigned
  const unassigned = appointments.filter(a => !a.professional_id)
  const columns: { key: string; label: string; color: string | null; apts: CalendarAppointment[] }[] = [
    ...professionals.map(p => ({
      key:   p.id,
      label: p.name,
      color: p.color,
      apts:  appointments.filter(a => a.professional_id === p.id),
    })),
    ...(unassigned.length > 0 ? [{ key: 'unassigned', label: 'Sin asignar', color: '#94a3b8', apts: unassigned }] : []),
  ]

  const effectiveCols = columns.length > 0 ? columns : [{
    key: 'all', label: 'Todas las citas', color: '#6366f1', apts: appointments,
  }]

  // ── Drag handlers ──────────────────────────────────────────────────────────

  function handleDragStart(apt: CalendarAppointment, e: React.DragEvent<HTMLButtonElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    dragRef.current = { aptId: apt.id, offsetY: e.clientY - rect.top }
    e.dataTransfer.effectAllowed = 'move'
    setDragging(true)
  }

  function handleDragEnd() {
    dragRef.current = null
    setDropTarget(null)
    setDragging(false)
  }

  function computeSlot(colEl: HTMLElement, clientY: number): number {
    const rect     = colEl.getBoundingClientRect()
    const scrollEl = colEl.closest('.overflow-auto')
    const scrollTop = scrollEl?.scrollTop ?? 0
    const offsetY  = dragRef.current?.offsetY ?? 0
    const y        = clientY - rect.top + scrollTop - offsetY
    return Math.max(0, Math.min(TOTAL_SLOTS - 1, Math.floor(y / SLOT_H)))
  }

  function handleDragOver(colKey: string, e: React.DragEvent<HTMLDivElement>) {
    if (!dragRef.current) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    const slotIdx = computeSlot(e.currentTarget, e.clientY)
    setDropTarget(prev =>
      prev?.colKey === colKey && prev?.slotIdx === slotIdx ? prev : { colKey, slotIdx }
    )
  }

  function handleDragLeave(e: React.DragEvent<HTMLDivElement>) {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDropTarget(null)
    }
  }

  async function handleDrop(colKey: string, e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    if (!dragRef.current) return
    const { aptId } = dragRef.current
    const slotIdx   = computeSlot(e.currentTarget, e.clientY)
    const totalMin  = START_HOUR * 60 + slotIdx * SLOT_MIN
    const h = Math.floor(totalMin / 60)
    const m = totalMin % 60
    const newScheduledAt = `${dayISO}T${String(h + 5).padStart(2, '0')}:${String(m).padStart(2, '0')}:00Z`

    dragRef.current = null
    setDropTarget(null)
    setDragging(false)
    setSaving(true)

    // If dropped on a specific professional column, also update professional_id
    // (only when dragging to a different professional's column)
    await dragRescheduleAppointment(aptId, newScheduledAt)
    setSaving(false)
    router.refresh()
  }

  function handleSlotClick(colKey: string, e: React.MouseEvent<HTMLDivElement>) {
    if (dragging) return
    if ((e.target as HTMLElement).closest('[data-apt]')) return
    const rect   = e.currentTarget.getBoundingClientRect()
    const scrollEl = e.currentTarget.closest('.overflow-auto')
    const scrollTop = scrollEl ? scrollEl.scrollTop : 0
    const clickY = e.clientY - rect.top + scrollTop
    const slotIdx   = Math.floor(clickY / SLOT_H)
    const totalMin  = START_HOUR * 60 + slotIdx * SLOT_MIN
    const h = Math.floor(totalMin / 60)
    const m = totalMin % 60
    const scheduled = `${dayISO}T${String(h + 5).padStart(2, '0')}:${String(m).padStart(2, '0')}:00Z`
    const proId = colKey !== 'all' && colKey !== 'unassigned' ? colKey : ''
    const url   = `/appointments/new?scheduled_at=${encodeURIComponent(scheduled)}${proId ? `&professional_id=${proId}` : ''}`
    router.push(url)
  }

  const totalDay = appointments.length

  return (
    <div className="flex flex-col h-full -mx-4 -mt-4">

      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-fog bg-white shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push(`/calendar?view=day&day=${prevDay}&week=${weekStartISO}`)}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-mist text-slate transition-colors"
          >
            ←
          </button>
          <div>
            <p className={`text-sm font-semibold ${isToday ? 'text-brand-700' : 'text-ink'}`}>
              {isToday && <span className="text-brand-600 mr-1">Hoy ·</span>}
              {formatFullDate(dayISO)}
            </p>
            <p className="text-xs text-slate">
              {saving ? 'Guardando…' : `${totalDay} cita${totalDay !== 1 ? 's' : ''}`}
            </p>
          </div>
          <button
            onClick={() => router.push(`/calendar?view=day&day=${nextDay}&week=${weekStartISO}`)}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-mist text-slate transition-colors"
          >
            →
          </button>
        </div>
        <div className="flex items-center gap-2">
          {dragging && (
            <span className="text-xs text-brand-600 font-medium animate-pulse">
              Arrastra a un nuevo slot →
            </span>
          )}
          <button
            onClick={() => router.push(`/calendar?week=${weekStartISO}`)}
            className="text-xs font-medium text-slate border border-fog px-3 py-1.5 rounded-lg hover:bg-mist transition-colors"
          >
            Vista semanal
          </button>
          <button
            onClick={() => {
              const scheduled = `${dayISO}T14:00:00Z`
              router.push(`/appointments/new?scheduled_at=${encodeURIComponent(scheduled)}`)
            }}
            className="text-xs font-semibold bg-brand-600 text-white px-3 py-1.5 rounded-lg hover:bg-brand-700 transition-colors"
          >
            + Nueva cita
          </button>
        </div>
      </div>

      {/* ── No professionals state ─────────────────────────────────── */}
      {professionals.length === 0 && (
        <div className="px-4 py-2 bg-amber-50 border-b border-amber-100 text-xs text-amber-700 shrink-0">
          Sin profesionales configurados —{' '}
          <a href="/settings/professionals" className="font-medium underline">agregar en Ajustes</a>
        </div>
      )}

      {/* ── Calendar grid ──────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto">
        <div style={{ minWidth: `${effectiveCols.length * 140 + 56}px` }}>

          {/* Column headers — sticky */}
          <div className="flex sticky top-0 z-20 bg-white border-b border-fog">
            <div className="w-14 shrink-0" />
            {effectiveCols.map(col => (
              <div key={col.key} className="flex-1 min-w-[140px] border-l border-fog px-3 py-3">
                <div className="flex items-center gap-2">
                  {col.color && (
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: col.color }} />
                  )}
                  <p className="text-sm font-semibold text-ink truncate">{col.label}</p>
                </div>
                <p className="text-xs text-slate mt-0.5 ml-4">
                  {col.apts.length} cita{col.apts.length !== 1 ? 's' : ''}
                </p>
              </div>
            ))}
          </div>

          {/* Time grid body */}
          <div className="flex">

            {/* Time gutter */}
            <div className="w-14 shrink-0 relative" style={{ height: GRID_H }}>
              {TIME_LABELS.filter(t => t.isHour).map(t => (
                <div
                  key={t.label}
                  className="absolute right-2 text-[10px] text-slate -translate-y-2 select-none"
                  style={{ top: t.topPx }}
                >
                  {t.label}
                </div>
              ))}
            </div>

            {/* Professional columns */}
            {effectiveCols.map(col => {
              const positioned = layoutApts(col.apts)
              const isDrop     = dropTarget?.colKey === col.key

              const colSchedules = col.key === 'all' || col.key === 'unassigned'
                ? schedules.filter(s => s.day_of_week === dayDow)
                : schedules.filter(s => s.professional_id === col.key && s.day_of_week === dayDow)
              const colBlocks    = blocks.filter(b =>
                b.block_date === dayISO &&
                (b.professional_id === null || b.professional_id === col.key)
              )
              const hasFullBlock = colBlocks.some(b => !b.start_time)

              const workStart = colSchedules.length > 0
                ? Math.min(...colSchedules.map(s => timeStrToMinutes(s.start_time)))
                : null
              const workEnd = colSchedules.length > 0
                ? Math.max(...colSchedules.map(s => timeStrToMinutes(s.end_time)))
                : null

              return (
                <div
                  key={col.key}
                  className={`flex-1 min-w-[140px] border-l border-fog relative transition-colors ${isDrop ? 'bg-brand-50/40' : ''} ${dragging ? 'cursor-grabbing' : 'cursor-crosshair'}`}
                  style={{ height: GRID_H }}
                  onDragOver={(e) => handleDragOver(col.key, e)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(col.key, e)}
                  onClick={(e) => handleSlotClick(col.key, e)}
                >
                  {/* Availability overlays */}
                  {hasFullBlock ? (
                    <div className="absolute inset-0 bg-amber-50/70 pointer-events-none z-[1]" />
                  ) : workStart === null ? null : (
                    <>
                      {minutesToGridPx(workStart) > 0 && (
                        <div
                          className="absolute left-0 right-0 bg-[#F3F6F9]/70 pointer-events-none z-[1]"
                          style={{ top: 0, height: minutesToGridPx(workStart) }}
                        />
                      )}
                      {minutesToGridPx(workEnd!) < GRID_H && (
                        <div
                          className="absolute left-0 right-0 bg-[#F3F6F9]/70 pointer-events-none z-[1]"
                          style={{ top: minutesToGridPx(workEnd!), height: GRID_H - minutesToGridPx(workEnd!) }}
                        />
                      )}
                      {colBlocks.filter(b => b.start_time).map((b, bi) => {
                        const bStartPx = minutesToGridPx(timeStrToMinutes(b.start_time!))
                        const bEndPx   = minutesToGridPx(timeStrToMinutes(b.end_time!))
                        return (
                          <div
                            key={bi}
                            className="absolute left-0 right-0 bg-amber-100/60 border-y border-amber-200/40 pointer-events-none z-[1]"
                            style={{ top: bStartPx, height: bEndPx - bStartPx }}
                          />
                        )
                      })}
                    </>
                  )}

                  {/* Slot lines */}
                  {Array.from({ length: TOTAL_SLOTS }).map((_, i) => (
                    <div
                      key={i}
                      className={`absolute w-full pointer-events-none ${i % 2 === 0 ? 'border-t border-fog' : 'border-t border-fog/60'}`}
                      style={{ top: i * SLOT_H }}
                    />
                  ))}

                  {/* Current-time line ("ahora") */}
                  {nowPx !== null && (
                    <div className="absolute left-0 right-0 z-[13] pointer-events-none" style={{ top: nowPx }}>
                      <div className="absolute -left-1 -top-[3px] w-2 h-2 rounded-full bg-red-500 shadow-sm" />
                      <div className="h-[2px] bg-red-500/80" />
                    </div>
                  )}

                  {/* Drop ghost */}
                  {isDrop && dropTarget && (
                    <div
                      className="absolute left-1 right-1 rounded-lg border-2 border-brand-400 bg-brand-100/50 pointer-events-none z-[12] flex items-center justify-center"
                      style={{ top: dropTarget.slotIdx * SLOT_H + 2, height: (DURATION_MIN / SLOT_MIN) * SLOT_H - 4 }}
                    >
                      <span className="text-[10px] font-semibold text-brand-700">{slotToTime(dropTarget.slotIdx)}</span>
                    </div>
                  )}

                  {/* Appointment blocks */}
                  {positioned.map(apt => {
                    const w     = 100 / apt.colCount
                    const l     = apt.col * w
                    const color = apt.professional_color ?? col.color ?? '#6366f1'
                    const opacity = STATUS_OPACITY[apt.status] ?? 'opacity-90'

                    return (
                      <button
                        key={apt.id}
                        data-apt="1"
                        draggable
                        onDragStart={(e) => { setHover(null); handleDragStart(apt, e) }}
                        onDragEnd={handleDragEnd}
                        onClick={(e) => { e.stopPropagation(); if (!dragging) router.push(`/appointments/${apt.id}`) }}
                        onMouseEnter={(e) => { if (!dragging) setHover({ apt, rect: e.currentTarget.getBoundingClientRect() }) }}
                        onMouseLeave={() => setHover(null)}
                        className={`absolute rounded-lg px-2 py-1.5 text-left overflow-hidden text-white text-xs leading-snug hover:brightness-110 transition-all shadow-xs ${opacity} ${dragging ? 'cursor-grabbing' : 'cursor-grab'}`}
                        style={{
                          backgroundColor: color,
                          top:    apt.topPx + 2,
                          height: Math.max(apt.heightPx - 4, SLOT_H - 4),
                          left:   `calc(${l}% + 3px)`,
                          width:  `calc(${w}% - 6px)`,
                          zIndex: 10,
                        }}
                      >
                        <p className="font-semibold truncate">{apt.patient_name || '—'}</p>
                        <p className="truncate opacity-80 text-[10px]">{formatTime(apt.scheduled_at)}</p>
                        <p className="truncate opacity-70 text-[10px]">{apt.treatment_type}</p>
                      </button>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Hover preview card */}
      {hover && !dragging && (() => {
        const W = 240, gap = 10
        const flipLeft = hover.rect.right + W + gap > window.innerWidth
        const left = flipLeft ? Math.max(8, hover.rect.left - W - gap) : hover.rect.right + gap
        const top  = Math.min(hover.rect.top, window.innerHeight - 175)
        const dur  = hover.apt.duration_min && hover.apt.duration_min > 0 ? hover.apt.duration_min : DURATION_MIN
        const start = formatTime(hover.apt.scheduled_at)
        const end   = formatTime(new Date(new Date(hover.apt.scheduled_at).getTime() + dur * 60_000).toISOString())
        const st    = STATUS_LABEL[hover.apt.status] ?? { text: hover.apt.status, cls: 'bg-mist text-slate' }
        return (
          <div
            className="fixed z-50 w-60 rounded-xl border border-fog bg-white shadow-md p-3.5 pointer-events-none"
            style={{ left, top }}
          >
            <p className="text-sm font-semibold text-ink truncate">{hover.apt.patient_name || 'Sin nombre'}</p>
            <p className="text-xs text-slate mt-0.5">{hover.apt.treatment_type}</p>
            <p className="text-sm font-medium text-ink mt-2">
              {start} – {end} <span className="text-xs font-normal text-slate">({dur} min)</span>
            </p>
            {hover.apt.professional_name && (
              <p className="flex items-center gap-1.5 text-xs text-slate mt-1.5">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: hover.apt.professional_color ?? '#9CA3AF' }} />
                {hover.apt.professional_name}
              </p>
            )}
            <span className={`inline-block mt-2.5 text-[11px] font-medium px-2 py-0.5 rounded-full ${st.cls}`}>{st.text}</span>
          </div>
        )
      })()}
    </div>
  )
}
