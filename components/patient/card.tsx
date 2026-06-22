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
    <div className="bg-white rounded-2xl border border-fog shadow-xs p-4 hover:shadow-md transition-shadow flex flex-col">
      {/* Top: avatar + name + status */}
      <div className="flex items-start gap-3">
        <div className="relative w-10 h-10 rounded-full bg-[#F3F6F9] overflow-hidden flex-shrink-0">
          {patient.photo_url ? (
            <Image src={patient.photo_url} alt={patient.full_name} fill className="object-cover" />
          ) : (
            <span className="w-full h-full flex items-center justify-center text-slate text-sm font-bold">
              {patient.full_name.charAt(0).toUpperCase()}
            </span>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-1">
            <Link
              href={`/patients/${patient.id}`}
              className="font-semibold text-sm text-ink hover:text-brand-600 leading-tight truncate"
            >
              {patient.full_name}
            </Link>
            <PatientStatusBadge status={patient.status as PatientStatus} />
          </div>

          {patient.dni && (
            <p className="text-xs text-slate mt-0.5">DNI {patient.dni}</p>
          )}
        </div>
      </div>

      {/* Contact info */}
      {(patient.phone || patient.email) && (
        <div className="mt-3 space-y-0.5">
          {patient.phone && (
            <p className="text-xs text-slate flex items-center gap-1">
              <span className="text-fog">📞</span> {patient.phone}
            </p>
          )}
          {patient.email && (
            <p className="text-xs text-slate truncate">{patient.email}</p>
          )}
        </div>
      )}

      {/* Last visit */}
      {patient.last_visit_date && (
        <p className="mt-2 text-xs text-slate">
          Última visita:{' '}
          <span className="text-slate">
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
      <div className="flex gap-2 mt-auto pt-3 border-t border-fog">
        <Link
          href={`/appointments/new?patient_id=${patient.id}`}
          className="flex-1 text-center text-xs font-medium text-brand-600 hover:text-brand-700 py-1 rounded-lg hover:bg-brand-50 transition-colors"
        >
          + Cita
        </Link>
        <Link
          href={`/patients/${patient.id}/edit`}
          className="flex-1 text-center text-xs font-medium text-slate hover:text-slate py-1 rounded-lg hover:bg-mist transition-colors"
        >
          Editar
        </Link>
      </div>
    </div>
  )
}
