'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import dayjs from 'dayjs'
import 'dayjs/locale/es'
import { AppointmentStatusBadge } from './appointment-status-badge'
import type { Appointment, Patient, AppointmentStatus } from '@/types/database'

dayjs.locale('es')

type AptWithPatient = Appointment & { patients: Pick<Patient, 'full_name'> | null }

interface AppointmentCalendarProps {
  appointments: AptWithPatient[]
  year: number
  month: number  // 0-indexed
}

const DOT_COLORS: Record<AppointmentStatus, string> = {
  scheduled: 'bg-gray-400',
  confirmed: 'bg-green-500',
  completed: 'bg-brand-500',
  cancelled: 'bg-red-400',
  no_show:   'bg-yellow-500',
}

export function AppointmentCalendar({ appointments, year, month }: AppointmentCalendarProps) {
  const router = useRouter()
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  const today = dayjs()
  const current = dayjs(new Date(year, month, 1))

  function navigate(delta: number) {
    const next = current.add(delta, 'month')
    router.push(`/appointments?year=${next.year()}&month=${next.month()}`)
  }

  // Build calendar grid
  const startOfMonth = current.startOf('month')
  const endOfMonth = current.endOf('month')
  const startDay = startOfMonth.day() // 0=Sun
  const daysInMonth = endOfMonth.date()

  // Group appointments by date
  const aptsByDate: Record<string, AptWithPatient[]> = {}
  appointments.forEach((apt) => {
    const date = apt.scheduled_at.split('T')[0]
    if (!aptsByDate[date]) aptsByDate[date] = []
    aptsByDate[date].push(apt)
  })

  const cells: (number | null)[] = [
    ...Array(startDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  // Pad to complete last row
  while (cells.length % 7 !== 0) cells.push(null)

  const selectedApts = selectedDate ? (aptsByDate[selectedDate] ?? []) : appointments
  const displayTitle = selectedDate
    ? dayjs(selectedDate).format('dddd D [de] MMMM')
    : `Todas las citas de ${current.format('MMMM YYYY')}`

  return (
    <div className="space-y-6">
      {/* Month navigation */}
      <div className="flex items-center justify-between">
        <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500">←</button>
        <h2 className="text-base font-semibold text-gray-900 capitalize">{current.format('MMMM YYYY')}</h2>
        <button onClick={() => navigate(1)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500">→</button>
      </div>

      {/* Day headers */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="grid grid-cols-7 border-b border-gray-100">
          {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map((d) => (
            <div key={d} className="py-2 text-center text-xs font-medium text-gray-400">{d}</div>
          ))}
        </div>

        {/* Calendar cells */}
        <div className="grid grid-cols-7">
          {cells.map((day, idx) => {
            const dateStr = day ? `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}` : null
            const apts = dateStr ? (aptsByDate[dateStr] ?? []) : []
            const isToday = dateStr === today.format('YYYY-MM-DD')
            const isSelected = dateStr === selectedDate

            return (
              <div
                key={idx}
                onClick={() => {
                  if (!dateStr) return
                  setSelectedDate(isSelected ? null : dateStr)
                }}
                className={`min-h-[64px] p-1.5 border-b border-r border-gray-50 transition-colors
                  ${day ? 'cursor-pointer hover:bg-brand-50' : ''}
                  ${isSelected ? 'bg-brand-50' : ''}`}
              >
                {day && (
                  <>
                    <span className={`text-xs font-medium flex w-6 h-6 items-center justify-center rounded-full
                      ${isToday ? 'bg-brand-600 text-white' : 'text-gray-700'}`}>
                      {day}
                    </span>
                    <div className="mt-1 flex flex-wrap gap-0.5">
                      {apts.slice(0, 3).map((apt) => (
                        <span
                          key={apt.id}
                          className={`w-2 h-2 rounded-full ${DOT_COLORS[apt.status as AppointmentStatus]}`}
                          title={apt.patients?.full_name ?? ''}
                        />
                      ))}
                      {apts.length > 3 && (
                        <span className="text-[9px] text-gray-400">+{apts.length - 3}</span>
                      )}
                    </div>
                  </>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Appointment list for selected day */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900 capitalize">{displayTitle}</h3>
          <span className="text-xs text-gray-400">{selectedApts.length} cita{selectedApts.length !== 1 ? 's' : ''}</span>
        </div>
        {selectedApts.length === 0 ? (
          <p className="px-5 py-6 text-sm text-gray-400 text-center">Sin citas</p>
        ) : (
          <ul className="divide-y divide-gray-50">
            {selectedApts
              .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at))
              .map((apt) => (
                <li key={apt.id} className="px-5 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{apt.patients?.full_name ?? '—'}</p>
                    <p className="text-xs text-gray-400">{apt.treatment_type}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-500">
                      {dayjs(apt.scheduled_at).format('HH:mm')}
                    </span>
                    <AppointmentStatusBadge status={apt.status as AppointmentStatus} />
                  </div>
                </li>
              ))}
          </ul>
        )}
      </div>
    </div>
  )
}
