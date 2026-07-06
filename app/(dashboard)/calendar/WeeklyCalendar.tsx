'use client'

import { useRouter }               from 'next/navigation'
import { useState, useRef, useEffect } from 'react'
import { dragRescheduleAppointment } from '@/app/actions/appointments'
import type { CalendarAppointment, CalendarProfessional, CalendarSchedule, CalendarBlock } from './page'

// ── Grid constants ────────────────────────────────────────────────────────────

const START_HOUR     = 7
const END_HOUR       = 20
const SLOT_MIN       = 30
const SLOT_H         = 52    // px per 30-min slot
const DURATION_MIN   = 60    // default appointment duration
const TOTAL_SLOTS    = ((END_HOUR - START_HOUR) * 60) / SLOT_MIN   // 26
const GRID_H         = TOTAL_SLOTS * SLOT_H                         // 1352px

const LIMA_OFFSET_MS = -5 * 60 * 60 * 1000

const DAY_NAMES      = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const DAY_NAMES_LONG = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

// ── Lima time helpers ─────────────────────────────────────────────────────────

function utcToLima(ms: number): Date { return new Date(ms + LIMA_OFFSET_MS) }

function limaHM(isoUtc: string): { h: number; m: number } {
  const d = utcToLima(new Date(isoUtc).getTime())
  return { h: d.getUTCHours(), m: d.getUTCMinutes() }
}

function limaDateISO(isoUtc: string): string {
  const d = utcToLima(new Date(isoUtc).getTime())
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}

function addDays(isoDate: string, n: number): string {
  const d = new Date(isoDate + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}

function formatDayLabel(isoDate: string): string {
  const [, m, d] = isoDate.split('-')
  return `${parseInt(d)} ${['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'][parseInt(m)]}`
}

void formatDayLabel

function formatMonthLabel(mondayISO: string, saturdayISO: string): string {
  const [, m1, d1] = mondayISO.split('-')
  const [y2, m2, d2] = saturdayISO.split('-')
  const months = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
  if (m1 === m2) return `${parseInt(d1)}–${parseInt(d2)} ${months[parseInt(m2)]} ${y2}`
  return `${parseInt(d1)} ${months[parseInt(m1)]} – ${parseInt(d2)} ${months[parseInt(m2)]} ${y2}`
}

// ── Appointment positioning & overlap ────────────────────────────────────────

interface PositionedApt extends CalendarAppointment {
  topPx:    number
  heightPx: number
  col:      number
  colCount: number
}

function aptTopPx(isoUtc: string): number {
  const { h, m } = limaHM(isoUtc)
  const minsFromStart = (h - START_HOUR) * 60 + m
  return (minsFromStart / SLOT_MIN) * SLOT_H
}

function aptDurationMin(apt: CalendarAppointment): number {
  return apt.duration_min && apt.duration_min > 0 ? apt.duration_min : DURATION_MIN
}

function layoutApts(apts: CalendarAppointment[]): PositionedApt[] {
  const sorted = [...apts].sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at))
  const cols:  CalendarAppointment[][] = []

  for (const apt of sorted) {
    const start  = new Date(apt.scheduled_at).getTime()
    let placed   = false
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
      result.push({
        ...apt,
        topPx:    aptTopPx(apt.scheduled_at),
        heightPx: (aptDurationMin(apt) / SLOT_MIN) * SLOT_H,
        col:      c,
        colCount: cols.length,
      })
    }
  }
  return result
}

// ── Availability helpers ──────────────────────────────────────────────────────

function timeStrToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

function minutesToGridPx(totalMin: number): number {
  return (totalMin - START_HOUR * 60) / SLOT_MIN * SLOT_H
}

// ── Status style ──────────────────────────────────────────────────────────────

const STATUS_OPACITY: Record<string, string> = {
  confirmed: 'opacity-100',
  scheduled: 'opacity-90',
  completed: 'opacity-50',
  no_show:   'opacity-30 grayscale',
}

const STATUS_LABEL: Record<string, { text: string; cls: string }> = {
  confirmed: { text: 'Confirmada', cls: 'bg-lima-50 text-lima-700' },
  scheduled: { text: 'Programada', cls: 'bg-blue-50 text-blue-700' },
  completed: { text: 'Atendida',   cls: 'bg-mist text-slate'      },
  no_show:   { text: 'No asistió', cls: 'bg-red-50 text-red-700'  },
}

// ── Time label slots ──────────────────────────────────────────────────────────

const TIME_LABELS: { label: string; topPx: number; isHour: boolean }[] = Array.from(
  { length: TOTAL_SLOTS + 1 },
  (_, i) => {
    const totalMin = START_HOUR * 60 + i * SLOT_MIN
    const h = Math.floor(totalMin / 60)
    const m = totalMin % 60
    return {
      label:  `${h}:${String(m).padStart(2, '0')}`,
      topPx:  i * SLOT_H,
      isHour: m === 0,
    }
  }
)

// ── Drag state ────────────────────────────────────────────────────────────────

interface DragInfo {
  aptId:   string
  offsetY: number   // click Y offset within the appointment block
}

interface DropTarget {
  dayISO:  string
  slotIdx: number
}

function slotToTime(slotIdx: number): string {
  const totalMin = START_HOUR * 60 + slotIdx * SLOT_MIN
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  return `${h}:${String(m).padStart(2, '0')}`
}

function aptTimeLabel(isoUtc: string): string {
  const { h, m } = limaHM(isoUtc)
  return `${h}:${String(m).padStart(2, '0')}`
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  appointments:  CalendarAppointment[]
  professionals: CalendarProfessional[]
  schedules:     CalendarSchedule[]
  blocks:        CalendarBlock[]
  weekStartISO:  string
  todayISO:      string
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function WeeklyCalendar({ appointments, professionals, schedules, blocks, weekStartISO, todayISO }: Props) {
  const router = useRouter()

  // Drag & drop state
  const dragRef                         = useRef<DragInfo | null>(null)
  const [dropTarget, setDropTarget]     = useState<DropTarget | null>(null)
  const [dragging, setDragging]         = useState(false)
  const [saving, setSaving]             = useState(false)

  // Current-time indicator ("ahora") — client-only to avoid hydration mismatch.
  const [now, setNow] = useState<{ dayISO: string; topPx: number } | null>(null)
  useEffect(() => {
    function tick() {
      const lima = utcToLima(Date.now())
      const mins = lima.getUTCHours() * 60 + lima.getUTCMinutes()
      if (mins < START_HOUR * 60 || mins > END_HOUR * 60) { setNow(null); return }
      setNow({
        dayISO: limaDateISO(new Date().toISOString()),
        topPx:  (mins - START_HOUR * 60) / SLOT_MIN * SLOT_H,
      })
    }
    tick()
    const id = setInterval(tick, 60_000)
    return () => clearInterval(id)
  }, [])

  // Hover preview card
  const [hover, setHover] = useState<{ apt: CalendarAppointment; rect: DOMRect } | null>(null)

  const saturdayISO = addDays(weekStartISO, 5)
  const days        = Array.from({ length: 6 }, (_, i) => addDays(weekStartISO, i))

  // Group appointments by Lima date
  const byDay: Record<string, CalendarAppointment[]> = {}
  for (const apt of appointments) {
    const d = limaDateISO(apt.scheduled_at)
    if (!byDay[d]) byDay[d] = []
    byDay[d].push(apt)
  }

  function goWeek(delta: -1 | 1) {
    router.push(`/calendar?view=week&week=${addDays(weekStartISO, delta * 7)}`)
  }

  function goToday() {
    const todayMonday = (() => {
      const d = new Date(todayISO + 'T12:00:00Z')
      const dow = d.getUTCDay()
      const back = dow === 0 ? 6 : dow - 1
      d.setUTCDate(d.getUTCDate() - back)
      return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
    })()
    router.push(`/calendar?view=week&week=${todayMonday}`)
  }

  function goDay(dayISO: string) {
    router.push(`/calendar?view=day&day=${dayISO}&week=${weekStartISO}`)
  }

  function goNewApt(dayISO: string) {
    const scheduled = `${dayISO}T14:00:00Z`
    router.push(`/appointments/new?scheduled_at=${encodeURIComponent(scheduled)}`)
  }

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

  function handleDragOver(dayISO: string, e: React.DragEvent<HTMLDivElement>) {
    if (!dragRef.current) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    const slotIdx = computeSlot(e.currentTarget, e.clientY)
    setDropTarget(prev =>
      prev?.dayISO === dayISO && prev?.slotIdx === slotIdx ? prev : { dayISO, slotIdx }
    )
  }

  function handleDragLeave(e: React.DragEvent<HTMLDivElement>) {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDropTarget(null)
    }
  }

  async function handleDrop(dayISO: string, e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    if (!dragRef.current) return
    const { aptId } = dragRef.current
    const slotIdx   = computeSlot(e.currentTarget, e.clientY)
    const totalMin  = START_HOUR * 60 + slotIdx * SLOT_MIN
    const h = Math.floor(totalMin / 60)
    const m = totalMin % 60
    // Lima → UTC: add 5h
    const newScheduledAt = `${dayISO}T${String(h + 5).padStart(2, '0')}:${String(m).padStart(2, '0')}:00Z`

    dragRef.current = null
    setDropTarget(null)
    setDragging(false)
    setSaving(true)
    await dragRescheduleAppointment(aptId, newScheduledAt)
    setSaving(false)
    router.refresh()
  }

  const totalWeek    = appointments.length
  const isCurrentWeek = weekStartISO <= todayISO && todayISO <= saturdayISO

  return (
    <div className="flex flex-col h-full -mx-4 -mt-4">

      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-fog bg-white shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={() => goWeek(-1)}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-mist text-slate transition-colors"
          >
            ←
          </button>
          <div>
            <p className="text-sm font-semibold text-ink">{formatMonthLabel(weekStartISO, saturdayISO)}</p>
            <p className="text-xs text-slate">
              {saving ? 'Guardando…' : `${totalWeek} cita${totalWeek !== 1 ? 's' : ''} esta semana`}
            </p>
          </div>
          <button
            onClick={() => goWeek(1)}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-mist text-slate transition-colors"
          >
            →
          </button>
        </div>
        <div className="flex items-center gap-2">
          {!isCurrentWeek && (
            <button
              onClick={goToday}
              className="text-xs font-medium text-brand-600 border border-brand-200 px-3 py-1.5 rounded-lg hover:bg-brand-50 transition-colors"
            >
              Hoy
            </button>
          )}
          <button
            onClick={() => goDay(todayISO)}
            className="text-xs font-medium text-slate border border-fog px-3 py-1.5 rounded-lg hover:bg-mist transition-colors"
          >
            Vista diaria
          </button>
          <button
            onClick={() => router.push('/appointments/new')}
            className="text-xs font-semibold bg-brand-600 text-white px-3 py-1.5 rounded-lg hover:bg-brand-700 transition-colors"
          >
            + Nueva cita
          </button>
        </div>
      </div>

      {/* ── Professional legend ────────────────────────────────────── */}
      {professionals.length > 0 && (
        <div className="flex items-center gap-3 px-4 py-2 border-b border-fog bg-white shrink-0 flex-wrap">
          <span className="text-xs text-slate">Profesionales:</span>
          {professionals.map(p => (
            <span key={p.id} className="flex items-center gap-1.5 text-xs text-slate">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
              {p.name}
            </span>
          ))}
          {dragging && (
            <span className="ml-auto text-xs text-brand-600 font-medium animate-pulse">
              Arrastra a un nuevo slot →
            </span>
          )}
        </div>
      )}

      {/* ── Calendar grid ──────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto">
        <div className="min-w-[640px]">

          {/* Day headers — sticky */}
          <div className="flex sticky top-0 z-20 bg-white border-b border-fog">
            {/* Gutter */}
            <div className="w-14 shrink-0" />
            {days.map((dayISO, i) => {
              const isToday = dayISO === todayISO
              const count   = byDay[dayISO]?.length ?? 0
              return (
                <div key={dayISO} className="flex-1 min-w-[90px] border-l border-fog px-1 py-2">
                  <button
                    onClick={() => goDay(dayISO)}
                    className="w-full text-center group"
                  >
                    <p className="text-[10px] font-medium text-slate uppercase tracking-wide">
                      {DAY_NAMES[i]}
                    </p>
                    <p className={`text-sm font-bold mt-0.5 w-7 h-7 rounded-full flex items-center justify-center mx-auto transition-colors
                      ${isToday ? 'bg-brand-600 text-white' : 'text-ink group-hover:bg-mist'}`}>
                      {parseInt(dayISO.split('-')[2])}
                    </p>
                    {count > 0 && (
                      <p className="text-[10px] text-slate mt-0.5">{count} cita{count !== 1 ? 's' : ''}</p>
                    )}
                  </button>
                  <button
                    onClick={() => goNewApt(dayISO)}
                    className="mt-1 w-full text-[10px] text-slate/70 hover:text-brand-600 hover:bg-brand-50 rounded transition-colors py-0.5"
                  >
                    + cita
                  </button>
                </div>
              )
            })}
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

            {/* Day columns */}
            {days.map((dayISO, colIdx) => {
              const dayApts    = byDay[dayISO] ?? []
              const positioned = layoutApts(dayApts)
              const isToday    = dayISO === todayISO
              const isDrop     = dropTarget?.dayISO === dayISO

              const dayDow       = colIdx + 1
              const daySchedules = schedules.filter(s => s.day_of_week === dayDow)
              const dayBlocks    = blocks.filter(b => b.block_date === dayISO)
              const hasFullBlock = dayBlocks.some(b => !b.start_time)

              const workStart = daySchedules.length > 0
                ? Math.min(...daySchedules.map(s => timeStrToMinutes(s.start_time)))
                : null
              const workEnd = daySchedules.length > 0
                ? Math.max(...daySchedules.map(s => timeStrToMinutes(s.end_time)))
                : null

              return (
                <div
                  key={dayISO}
                  className={`flex-1 min-w-[90px] border-l relative transition-colors ${isToday ? 'bg-brand-50/20' : ''} ${isDrop ? 'bg-brand-50/40' : ''} ${dragging ? 'cursor-grabbing' : 'cursor-crosshair'}`}
                  style={{ height: GRID_H }}
                  onDragOver={(e) => handleDragOver(dayISO, e)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(dayISO, e)}
                  onClick={(e) => {
                    if (dragging) return
                    if ((e.target as HTMLElement).closest('[data-apt]')) return
                    const rect = e.currentTarget.getBoundingClientRect()
                    const clickY = e.clientY - rect.top + e.currentTarget.closest('.overflow-auto')!.scrollTop
                    const slotIdx = Math.floor(clickY / SLOT_H)
                    const totalMin = (START_HOUR * 60) + slotIdx * SLOT_MIN
                    const h = Math.floor(totalMin / 60)
                    const m = totalMin % 60
                    const scheduled = `${dayISO}T${String(h + 5).padStart(2, '0')}:${String(m).padStart(2, '0')}:00Z`
                    router.push(`/appointments/new?scheduled_at=${encodeURIComponent(scheduled)}`)
                  }}
                  title={`${DAY_NAMES_LONG[colIdx]} — click para nueva cita`}
                >
                  {/* Availability overlays */}
                  {hasFullBlock ? (
                    <div className="absolute inset-0 bg-amber-50/70 pointer-events-none z-[1]" />
                  ) : workStart === null ? (
                    <div className="absolute inset-0 bg-[#F3F6F9]/70 pointer-events-none z-[1]" />
                  ) : (
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
                      {dayBlocks.filter(b => b.start_time).map((b, bi) => {
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
                  {now?.dayISO === dayISO && (
                    <div className="absolute left-0 right-0 z-[13] pointer-events-none" style={{ top: now.topPx }}>
                      <div className="absolute -left-1 -top-[3px] w-2 h-2 rounded-full bg-red-500 shadow-sm" />
                      <div className="h-[2px] bg-red-500/80" />
                    </div>
                  )}

                  {/* Drop ghost */}
                  {isDrop && dropTarget && (
                    <div
                      className="absolute left-1 right-1 rounded-md border-2 border-brand-400 bg-brand-100/50 pointer-events-none z-[12] flex items-center justify-center"
                      style={{ top: dropTarget.slotIdx * SLOT_H + 2, height: (DURATION_MIN / SLOT_MIN) * SLOT_H - 4 }}
                    >
                      <span className="text-[10px] font-semibold text-brand-700">{slotToTime(dropTarget.slotIdx)}</span>
                    </div>
                  )}

                  {/* Appointment blocks */}
                  {positioned.map(apt => {
                    const widthPct = 100 / apt.colCount
                    const leftPct  = apt.col * widthPct
                    const color    = apt.professional_color ?? '#6366f1'
                    const opacity  = STATUS_OPACITY[apt.status] ?? 'opacity-90'

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
                        className={`absolute rounded-md px-1.5 py-1 text-left overflow-hidden text-white text-[11px] leading-tight hover:brightness-110 transition-all shadow-xs ${opacity} ${dragging ? 'cursor-grabbing' : 'cursor-grab'}`}
                        style={{
                          backgroundColor: color,
                          top:    apt.topPx + 2,
                          height: Math.max(apt.heightPx - 4, SLOT_H - 4),
                          left:   `calc(${leftPct}% + 2px)`,
                          width:  `calc(${widthPct}% - 4px)`,
                          zIndex: 10,
                        }}
                      >
                        <p className="font-semibold truncate leading-tight">
                          <span className="opacity-75 font-normal">{aptTimeLabel(apt.scheduled_at)}</span> {apt.patient_name || '—'}
                        </p>
                        <p className="truncate opacity-80 mt-0.5">{apt.treatment_type}</p>
                        {apt.professional_name && (
                          <p className="truncate opacity-60 text-[9px]">{apt.professional_name}</p>
                        )}
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
        const start = aptTimeLabel(hover.apt.scheduled_at)
        const end   = aptTimeLabel(new Date(new Date(hover.apt.scheduled_at).getTime() + dur * 60_000).toISOString())
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
