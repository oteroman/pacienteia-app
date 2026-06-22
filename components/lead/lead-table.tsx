'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'
import Link from 'next/link'
import { archiveLead } from '@/app/actions/leads'
import {
  CHANNEL_LABELS, CHANNEL_COLORS,
  STATUS_LABEL, STATUS_COLOR,
  PRIORITY_COLOR,
  type IntakeChannel, type IntakeStatus, type IntakePriority,
} from '@/lib/intake/index'

export interface IntakeRow {
  id:                string
  contact_name:      string | null
  contact_phone:     string | null
  source_channel:    string
  raw_content:       string
  normalized_summary: string | null
  priority:          string
  status:            string
  detected_intent:   string | null
  sla_due_at:        string | null
  first_response_at: string | null
  patient_id:        string | null
  created_at:        string
}

interface LeadTableProps {
  leads: IntakeRow[]
}

const STATUS_TABS = [
  { value: '',               label: 'Todos'         },
  { value: 'new',            label: 'Nuevos'        },
  { value: 'in_progress',    label: 'En contacto'   },
  { value: 'waiting_customer', label: 'Esperando'   },
  { value: 'waiting_staff',  label: 'Sin respuesta' },
]

export function LeadTable({ leads }: LeadTableProps) {
  const router   = useRouter()
  const pathname = usePathname()
  const params   = useSearchParams()
  const [, startTransition] = useTransition()

  const currentStatus = params.get('status') ?? ''

  function setFilter(key: string, value: string) {
    const next = new URLSearchParams(params.toString())
    if (value) next.set(key, value)
    else next.delete(key)
    router.push(`${pathname}?${next.toString()}`)
  }

  async function handleArchive(id: string) {
    if (!confirm('¿Archivar este lead?')) return
    startTransition(async () => { await archiveLead(id) })
  }

  return (
    <div className="space-y-4">
      {/* Status filter tabs */}
      <div className="flex gap-0.5 border-b border-fog overflow-x-auto">
        {STATUS_TABS.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setFilter('status', value)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              currentStatus === value
                ? 'border-brand-600 text-brand-700'
                : 'border-transparent text-slate hover:text-ink'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {leads.length === 0 ? (
        <div className="text-center py-16 text-slate">
          <p className="text-3xl mb-2">📥</p>
          <p className="text-sm">No hay leads en esta categoría</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-fog shadow-xs bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-fog bg-mist">
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-slate uppercase tracking-[0.06em]">Contacto</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-slate uppercase tracking-[0.06em] hidden md:table-cell">Mensaje</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-slate uppercase tracking-[0.06em] hidden sm:table-cell">Canal</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-slate uppercase tracking-[0.06em]">Estado</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-slate uppercase tracking-[0.06em] hidden lg:table-cell">SLA</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-slate uppercase tracking-[0.06em] hidden sm:table-cell">Fecha</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-fog">
              {leads.map((lead) => {
                const slaOverdue = lead.sla_due_at && new Date(lead.sla_due_at) < new Date()
                return (
                  <tr key={lead.id} className="hover:bg-mist transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/leads/${lead.id}`} className="block hover:text-brand-700 transition-colors">
                        <p className="font-medium text-ink">
                          {lead.contact_name ?? lead.contact_phone ?? '—'}
                        </p>
                        {lead.contact_name && lead.contact_phone && (
                          <p className="text-xs text-slate mt-0.5">{lead.contact_phone}</p>
                        )}
                        {lead.patient_id && (
                          <span className="text-xs text-brand-600 mt-0.5 block">Paciente ✓</span>
                        )}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate hidden md:table-cell max-w-[220px]">
                      <p className="truncate text-xs">
                        {lead.normalized_summary ?? lead.raw_content}
                      </p>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${CHANNEL_COLORS[lead.source_channel as IntakeChannel] ?? 'bg-[#F3F4F6] text-slate'}`}>
                        {CHANNEL_LABELS[lead.source_channel as IntakeChannel] ?? lead.source_channel}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium w-fit ${STATUS_COLOR[lead.status as IntakeStatus] ?? 'bg-mist text-slate'}`}>
                          {STATUS_LABEL[lead.status as IntakeStatus] ?? lead.status}
                        </span>
                        <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium w-fit ${PRIORITY_COLOR[lead.priority as IntakePriority] ?? 'bg-[#F3F4F6] text-slate'}`}>
                          {lead.priority === 'high' ? 'Alta' : lead.priority === 'medium' ? 'Media' : 'Baja'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      {lead.sla_due_at ? (
                        <span className={`text-xs font-medium ${slaOverdue ? 'text-red-600' : 'text-slate'}`}>
                          {slaOverdue ? '⚠ Vencido' : `Vence ${formatRelative(lead.sla_due_at)}`}
                        </span>
                      ) : (
                        <span className="text-xs text-fog">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate text-xs hidden sm:table-cell whitespace-nowrap">
                      {new Date(lead.created_at).toLocaleDateString('es-PE', {
                        day: '2-digit', month: 'short',
                      })}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 justify-end whitespace-nowrap">
                        <Link
                          href={`/leads/${lead.id}`}
                          className="text-xs text-brand-600 hover:text-brand-800 font-medium"
                        >
                          Ver
                        </Link>
                        <button
                          onClick={() => handleArchive(lead.id)}
                          className="text-xs text-slate hover:text-red-600"
                        >
                          Archivar
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function formatRelative(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now()
  const mins = Math.round(diff / 60_000)
  if (mins < 60)  return `en ${mins}m`
  const hrs = Math.round(mins / 60)
  if (hrs  < 24)  return `en ${hrs}h`
  return `en ${Math.round(hrs / 24)}d`
}
