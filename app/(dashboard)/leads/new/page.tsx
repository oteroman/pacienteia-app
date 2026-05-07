import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getActiveClinicId } from '@/lib/tenant/active-clinic'

export default async function NewLeadPage() {
  const clinicId = await getActiveClinicId()
  if (!clinicId) redirect('/clinic-selector')

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/leads" className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
          ← Leads
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-gray-900">Nuevo lead</h1>
        <p className="text-sm text-gray-500 mt-0.5">Registro manual de lead</p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center space-y-4">
        <p className="text-4xl">📥</p>
        <div className="space-y-1.5">
          <p className="text-sm font-semibold text-gray-800">
            Los leads se capturan automáticamente
          </p>
          <p className="text-sm text-gray-500 leading-relaxed">
            Conecta tu WhatsApp Business o formularios web a través de n8n
            para que cada consulta entrante quede registrada aquí al instante.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          <Link
            href="/billing"
            className="inline-block bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors"
          >
            Ver automatizaciones →
          </Link>
          <Link
            href="/leads"
            className="inline-block border border-gray-200 hover:bg-gray-50 text-gray-700 text-sm font-medium px-5 py-2.5 rounded-lg transition-colors"
          >
            Volver a leads
          </Link>
        </div>
      </div>
    </div>
  )
}
