'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useTransition, useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { PatientStatusBadge } from './patient-status-badge'
import { Badge } from '@/components/ui/badge'
import { softDeletePatient } from '@/app/actions/patients'
import type { Patient, PatientStatus } from '@/types/database'
import type { RetentionScore } from '@/lib/analytics/retention'

interface PatientTableProps {
  patients: Patient[]
  scores?: Record<string, RetentionScore>
}

export function PatientTable({ patients, scores }: PatientTableProps) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [, startTransition] = useTransition()
  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function updateParam(key: string, value: string) {
    const next = new URLSearchParams(params.toString())
    if (value) next.set(key, value)
    else next.delete(key)
    next.delete('page')
    router.push(`${pathname}?${next.toString()}`)
  }

  function handleSearch(e: React.ChangeEvent<HTMLInputElement>) {
    if (searchRef.current) clearTimeout(searchRef.current)
    searchRef.current = setTimeout(() => updateParam('q', e.target.value), 350)
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`¿Eliminar a ${name}? Esta acción no se puede deshacer.`)) return
    startTransition(async () => { await softDeletePatient(id) })
  }

  return (
    <div className="space-y-4">
      {/* Search + filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          defaultValue={params.get('q') ?? ''}
          onChange={handleSearch}
          placeholder="Buscar por nombre, DNI o teléfono..."
          className="flex-1 rounded-lg border border-fog px-3 py-2.5 text-sm shadow-xs
                     focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
        />
        <select
          defaultValue={params.get('status') ?? ''}
          onChange={(e) => updateParam('status', e.target.value)}
          className="rounded-lg border border-fog px-3 py-2.5 text-sm shadow-xs
                     focus:outline-none focus:ring-2 focus:ring-brand-500 sm:w-40"
        >
          <option value="">Todos</option>
          <option value="active">Activo</option>
          <option value="inactive">Inactivo</option>
          <option value="lead">Lead</option>
          <option value="blocked">Bloqueado</option>
        </select>
      </div>

      {/* Table */}
      {patients.length === 0 ? (
        <div className="text-center py-12 text-slate">
          <p className="text-4xl mb-2">👤</p>
          <p className="text-sm">No se encontraron pacientes</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-fog shadow-xs bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-fog bg-mist">
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-slate uppercase tracking-[0.06em]">Paciente</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-slate uppercase tracking-[0.06em] hidden sm:table-cell">Contacto</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-slate uppercase tracking-[0.06em]">Estado</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-slate uppercase tracking-[0.06em] hidden md:table-cell">Última visita</th>
                {scores && <th className="text-left px-4 py-3 text-[11px] font-semibold text-slate uppercase tracking-[0.06em] hidden lg:table-cell">Retención</th>}
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-slate uppercase tracking-[0.06em] hidden lg:table-cell">Etiquetas</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-fog">
              {patients.map((p) => (
                <tr key={p.id} className="hover:bg-mist transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="relative w-8 h-8 rounded-full bg-[#F3F6F9] overflow-hidden flex-shrink-0">
                        {p.photo_url ? (
                          <Image src={p.photo_url} alt={p.full_name} fill className="object-cover" />
                        ) : (
                          <span className="w-full h-full flex items-center justify-center text-slate text-xs font-bold">
                            {p.full_name.charAt(0).toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div>
                        <Link href={`/patients/${p.id}`} className="font-medium text-ink hover:text-brand-600">
                          {p.full_name}
                        </Link>
                        {p.dni && <p className="text-xs text-slate">DNI {p.dni}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate hidden sm:table-cell">
                    {p.phone && <p>{p.phone}</p>}
                    {p.email && <p className="text-xs text-slate truncate max-w-[180px]">{p.email}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <PatientStatusBadge status={p.status as PatientStatus} />
                  </td>
                  <td className="px-4 py-3 text-slate hidden md:table-cell">
                    {p.last_visit_date
                      ? new Date(p.last_visit_date).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })
                      : <span className="text-fog">—</span>}
                  </td>
                  {scores && (
                    <td className="px-4 py-3 hidden lg:table-cell">
                      {scores[p.id] ? (
                        <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${scores[p.id].badgeCls}`}>
                          <span>{scores[p.id].score}</span>
                          <span className="font-normal">{scores[p.id].label}</span>
                        </span>
                      ) : (
                        <span className="text-fog text-xs">—</span>
                      )}
                    </td>
                  )}
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <div className="flex flex-wrap gap-1 max-w-[200px]">
                      {(p.tags ?? []).slice(0, 3).map((t) => (
                        <Badge key={t} variant="blue" className="text-xs">{t}</Badge>
                      ))}
                      {(p.tags ?? []).length > 3 && (
                        <Badge variant="gray">+{p.tags.length - 3}</Badge>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      <Link href={`/patients/${p.id}/edit`} className="text-xs text-slate hover:text-brand-600">
                        Editar
                      </Link>
                      <button
                        onClick={() => handleDelete(p.id, p.full_name)}
                        className="text-xs text-slate hover:text-red-600"
                      >
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
