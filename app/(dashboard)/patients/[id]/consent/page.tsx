import { notFound, redirect } from 'next/navigation'
import { createClient }      from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getActiveContext }  from '@/lib/tenant/context'
import { PrintButton }       from './print-button'

interface PageProps { params: Promise<{ id: string }> }

export default async function ConsentPage({ params }: PageProps) {
  const { id } = await params

  const ctx = await getActiveContext()
  if (!ctx) redirect('/org-selector')
  const { organizationId } = ctx

  const supabase = await createClient()
  const sb       = createAdminClient() as any

  const [{ data: patient }, { data: org }] = await Promise.all([
    (supabase as any)
      .from('patients')
      .select('full_name, dni, phone, email')
      .eq('id', id)
      .eq('organization_id', organizationId)
      .is('deleted_at', null)
      .single(),
    sb
      .from('organizations')
      .select('name')
      .eq('id', organizationId)
      .single(),
  ])

  if (!patient) notFound()

  const today = new Date().toLocaleDateString('es-PE', {
    day: '2-digit', month: 'long', year: 'numeric',
  })

  return (
    <>
      {/* Print styles */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          .print-page { box-shadow: none !important; border: none !important; }
        }
      `}</style>

      {/* Toolbar */}
      <div className="no-print flex items-center justify-between mb-6">
        <a href={`/patients/${id}`} className="text-sm text-slate hover:text-ink">← Volver a ficha</a>
        <PrintButton />
      </div>

      {/* Document */}
      <div className="print-page max-w-2xl mx-auto bg-white border border-fog rounded-2xl p-8 shadow-sm space-y-6 text-sm text-ink">

        {/* Header */}
        <div className="text-center space-y-1 border-b border-fog pb-6">
          <h1 className="text-xl font-bold">{org?.name ?? 'Clínica'}</h1>
          <p className="text-slate text-xs">Consentimiento Informado para Procedimientos Estéticos</p>
        </div>

        {/* Patient data */}
        <div className="space-y-2">
          <h2 className="text-xs font-semibold text-slate uppercase tracking-widest">Datos del paciente</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-slate">Nombre completo</p>
              <p className="font-medium">{patient.full_name}</p>
            </div>
            <div>
              <p className="text-xs text-slate">DNI</p>
              <p className="font-medium">{patient.dni || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-slate">Teléfono</p>
              <p className="font-medium">{patient.phone || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-slate">Email</p>
              <p className="font-medium">{patient.email || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-slate">Fecha</p>
              <p className="font-medium">{today}</p>
            </div>
          </div>
        </div>

        {/* Consent text */}
        <div className="space-y-3 leading-relaxed">
          <h2 className="text-xs font-semibold text-slate uppercase tracking-widest">Declaración de consentimiento</h2>

          <p>
            Yo, <strong>{patient.full_name}</strong>, en pleno uso de mis facultades mentales, declaro que he sido
            informado/a de manera clara y comprensible sobre el procedimiento estético que se me va a realizar,
            incluyendo sus características, beneficios, riesgos, alternativas posibles y el proceso de recuperación.
          </p>

          <p>
            Declaro que he tenido la oportunidad de realizar las preguntas que he considerado necesarias y que
            todas ellas han sido respondidas satisfactoriamente por el profesional tratante.
          </p>

          <p>
            Entiendo que los procedimientos estéticos no son considerados tratamientos médicos y que los resultados
            pueden variar según las características individuales de cada paciente. Acepto que no existen garantías
            de resultados específicos.
          </p>

          <p>
            Confirmo que he informado al profesional sobre todas mis condiciones de salud relevantes, alergias
            conocidas, medicamentos que tomo actualmente y tratamientos previos que puedan afectar el procedimiento.
          </p>

          <p>
            Autorizo al equipo de <strong>{org?.name ?? 'la clínica'}</strong> a realizar el procedimiento acordado
            y a tomar fotografías de seguimiento para uso exclusivo de mi expediente clínico, salvo indicación
            expresa en contrario.
          </p>
        </div>

        {/* Signature area */}
        <div className="pt-6 border-t border-fog grid grid-cols-2 gap-8">
          <div className="space-y-8">
            <div>
              <div className="border-b border-ink h-12" />
              <p className="text-xs text-slate mt-1">Firma del paciente</p>
              <p className="text-xs text-ink font-medium">{patient.full_name}</p>
            </div>
          </div>
          <div className="space-y-8">
            <div>
              <div className="border-b border-ink h-12" />
              <p className="text-xs text-slate mt-1">Firma del profesional tratante</p>
              <p className="text-xs text-ink font-medium">&nbsp;</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <p className="text-[10px] text-slate text-center pt-2 border-t border-fog">
          Documento generado el {today} · {org?.name ?? 'Clínica'} · Expediente operativo — No constituye historia clínica médica
        </p>
      </div>
    </>
  )
}
