'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'
import Link from 'next/link'
import { LeadPriorityBadge, LeadIntentBadge, LeadUrgencyBadge } from './lead-priority-badge'
import { convertLeadToPatient, archiveLead } from '@/app/actions/leads'
import type { LeadEvent } from '@/types/database'

type LeadPayload = {
  phone?: string
  message?: string
  channel?: string
  ai_priority?: string
  ai_intent?: string
  ai_urgency?: string
}

interface LeadTableProps {
  leads: LeadEvent[]
}

const PRIORITY_TABS = [
  { value: '', label: 'Todos' },
  { value: 'hot', label: 'Hot' },
  { value: 'warm', label: 'Warm' },
  { value: 'cold', label: 'Cold' },
]

export function LeadTable({ leads }: LeadTableProps) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [, startTransition] = useTransition()

  const currentPriority = params.get('priority') ?? ''

  function setFilter(key: string, value: string) {
    const next = new URLSearchParams(params.toString())
    if (value) next.set(key, value)
    else next.delete(key)
    router.push(`${pathname}?${next.toString()}`)
  }

  async function handleConvert(leadId: string) {
    if (!confirm('Crear paciente a partir de este lead?')) return
    startTransition(async () => { await convertLeadToPatient(leadId) })
  }

  async function handleArchive(leadId: string) {
    if (!confirm('Archivar este lead?')) return
    startTransition(async () => { await archiveLead(leadId) })
  }

  return (
    <div className="space-y-4">
      {/* Priority filter tabs */}
      <div className="flex gap-1 border-b border-gray-100">
        {PRIORITY_TABS.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setFilter('priority', value)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              currentPriority === value
                ? 'border-brand-600 text-brand-700'
                : 'border-transparent text-gray-500 hover:text-gray-900'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {leads.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-2">📥</p>
          <p className="text-sm">No hay leads en esta categoría</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-100 shadow-sm bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 font-medium text-gray-500">Teléfono</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 hidden md:table-cell">Mensaje</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 hidden sm:table-cell">Fuente</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Prioridad</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 hidden lg:table-cell">Intención</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 hidden lg:table-cell">Urgencia</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 hidden sm:table-cell">Fecha</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {leads.map((lead) => {
                const p = (lead.payload ?? {}) as LeadPayload
                return (
                  <tr key={lead.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {p.phone ?? <span className="text-gray-300">—</span>}
                      {lead.patient_id && (
                        <Link
                          href={`/patients/${lead.patient_id}`}
                          className="block text-xs text-brand-600 hover:underline mt-0.5"
                        >
                          Ver paciente
                        </Link>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500 hidden md:table-cell max-w-[240px]">
                      <p className="truncate">{p.message ?? '—'}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-500 hidden sm:table-cell capitalize">
                      {p.channel ?? lead.source ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <LeadPriorityBadge priority={p.ai_priority} />
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <LeadIntentBadge intent={p.ai_intent} />
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <LeadUrgencyBadge urgency={p.ai_urgency} />
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs hidden sm:table-cell whitespace-nowrap">
                      {new Date(lead.created_at).toLocaleDateString('es-PE', {
                        day: '2-digit', month: 'short',
                      })}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 justify-end whitespace-nowrap">
                        {!lead.patient_id && (
                          <button
                            onClick={() => handleConvert(lead.id)}
                            className="text-xs text-brand-600 hover:text-brand-800 font-medium"
                          >
                            + Paciente
                          </button>
                        )}
                        <button
                          onClick={() => handleArchive(lead.id)}
                          className="text-xs text-gray-400 hover:text-red-600"
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
