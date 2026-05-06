import Link from 'next/link'
import Image from 'next/image'
import { PatientStatusBadge } from './patient-status-badge'
import { Badge } from '@/components/ui/badge'
import type { Patient, PatientStatus } from '@/types/database'

interface PatientCardProps {
  patient: Patient
}

export function PatientCard({ patient }: PatientCardProps) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 hover:shadow-md transition-shadow flex flex-col">
      {/* Top: avatar + name + status */}
      <div className="flex items-start gap-3">
        <div className="relative w-10 h-10 rounded-full bg-gray-100 overflow-hidden flex-shrink-0">
          {patient.photo_url ? (
            <Image src={patient.photo_url} alt={patient.full_name} fill className="object-cover" />
          ) : (
            <span className="w-full h-full flex items-center justify-center text-gray-400 text-sm font-bold">
              {patient.full_name.charAt(0).toUpperCase()}
            </span>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-1">
            <Link
              href={`/patients/${patient.id}`}
              className="font-semibold text-sm text-gray-900 hover:text-brand-600 leading-tight truncate"
            >
              {patient.full_name}
            </Link>
            <PatientStatusBadge status={patient.status as PatientStatus} />
          </div>

          {patient.dni && (
            <p className="text-xs text-gray-400 mt-0.5">DNI {patient.dni}</p>
          )}
        </div>
      </div>

      {/* Contact info */}
      {(patient.phone || patient.email) && (
        <div className="mt-3 space-y-0.5">
          {patient.phone && (
            <p className="text-xs text-gray-500 flex items-center gap-1">
              <span className="text-gray-300">📞</span> {patient.phone}
            </p>
          )}
          {patient.email && (
            <p className="text-xs text-gray-400 truncate">{patient.email}</p>
          )}
        </div>
      )}

      {/* Last visit */}
      {patient.last_visit_date && (
        <p className="mt-2 text-xs text-gray-400">
          Última visita:{' '}
          <span className="text-gray-600">
            {new Date(patient.last_visit_date).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })}
          </span>
        </p>
      )}

      {/* Tags */}
      {(patient.tags ?? []).length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {(patient.tags ?? []).slice(0, 3).map((t) => (
            <Badge key={t} variant="blue" className="text-xs">{t}</Badge>
          ))}
          {patient.tags.length > 3 && (
            <Badge variant="gray">+{patient.tags.length - 3}</Badge>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 mt-auto pt-3 border-t border-gray-50">
        <Link
          href={`/appointments/new?patient_id=${patient.id}`}
          className="flex-1 text-center text-xs font-medium text-brand-600 hover:text-brand-700 py-1 rounded-lg hover:bg-brand-50 transition-colors"
        >
          + Cita
        </Link>
        <Link
          href={`/patients/${patient.id}/edit`}
          className="flex-1 text-center text-xs font-medium text-gray-500 hover:text-gray-700 py-1 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Editar
        </Link>
      </div>
    </div>
  )
}
