import { redirect }          from 'next/navigation'
import { createClient }      from '@/lib/supabase/server'
import { getActiveContext }  from '@/lib/tenant/context'
import { isFeatureAllowed }  from '@/lib/plans/gating'
import Link                  from 'next/link'
import { CopyButton }        from './CopyButton'

export default async function WebFormsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const ctx = await getActiveContext()
  if (!ctx?.organizationId) redirect('/org-selector')

  const allowed = await isFeatureAllowed(ctx.organizationId, 'web_forms')

  if (!allowed) {
    return (
      <div className="max-w-2xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-ink">Web Forms</h1>
          <p className="text-sm text-slate mt-1">Captura leads desde tu sitio web directamente en PacienteIA.</p>
        </div>
        <div className="rounded-2xl border border-fog bg-white p-8 text-center space-y-4">
          <p className="text-3xl">🔒</p>
          <p className="font-semibold text-ink">Función disponible en plan Pro</p>
          <p className="text-sm text-slate max-w-sm mx-auto">
            Con Web Forms puedes integrar un formulario de contacto en tu web. Cada envío llega como lead en tu bandeja con triage automático por IA.
          </p>
          <Link
            href="/pricing"
            className="inline-block bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors"
          >
            Ver planes →
          </Link>
        </div>
      </div>
    )
  }

  const orgId = ctx.organizationId
  const endpoint = `https://app.pacienteia.com/api/intake/webform`

  const htmlSnippet = `<!-- Formulario PacienteIA -->
<form id="pacienteia-form" action="${endpoint}" method="POST">
  <input type="hidden" name="clinic_id" value="${orgId}" />
  <div>
    <label>Nombre</label>
    <input type="text" name="contact_name" placeholder="Tu nombre" />
  </div>
  <div>
    <label>WhatsApp / Teléfono *</label>
    <input type="tel" name="contact_phone" required placeholder="987 654 321" />
  </div>
  <div>
    <label>Email</label>
    <input type="email" name="contact_email" placeholder="correo@ejemplo.com" />
  </div>
  <div>
    <label>¿En qué te podemos ayudar? *</label>
    <textarea name="message" required placeholder="Cuéntanos sobre tu consulta..."></textarea>
  </div>
  <button type="submit">Enviar consulta</button>
</form>
<script>
  document.getElementById('pacienteia-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(this));
    const res = await fetch('${endpoint}', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      this.innerHTML = '<p>¡Mensaje recibido! Te contactamos pronto.</p>';
    } else {
      alert('Hubo un error. Por favor intenta de nuevo.');
    }
  });
</script>`

  const curlExample = `curl -X POST ${endpoint} \\
  -H "Content-Type: application/json" \\
  -d '{
    "clinic_id": "${orgId}",
    "contact_name": "María García",
    "contact_phone": "987654321",
    "contact_email": "maria@ejemplo.com",
    "message": "Me interesa el tratamiento de botox"
  }'`

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-ink">Web Forms</h1>
        <p className="text-sm text-slate mt-1">
          Integra un formulario de contacto en tu sitio web. Cada envío llega como lead con triage automático de IA.
        </p>
      </div>

      {/* How it works */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { step: '1', title: 'Paciente llena el form', desc: 'En tu web, blog o landing page' },
          { step: '2', title: 'Llega como lead', desc: 'Aparece en Leads con prioridad asignada por IA' },
          { step: '3', title: 'Staff responde', desc: 'Desde el inbox o copiloto en segundos' },
        ].map(({ step, title, desc }) => (
          <div key={step} className="bg-white rounded-xl border border-fog p-4 space-y-1">
            <span className="text-xs font-bold text-brand-600 bg-brand-50 px-2 py-0.5 rounded-full">Paso {step}</span>
            <p className="font-semibold text-ink text-sm mt-2">{title}</p>
            <p className="text-xs text-slate">{desc}</p>
          </div>
        ))}
      </div>

      {/* Clinic ID */}
      <div className="bg-white rounded-2xl border border-fog p-6 space-y-3">
        <h2 className="font-semibold text-ink">Tu ID de clínica</h2>
        <p className="text-xs text-slate">Incluye este valor en todos los envíos al formulario.</p>
        <div className="flex items-center gap-2 bg-mist rounded-lg px-3 py-2">
          <code className="text-xs text-amber-700 flex-1 break-all">{orgId}</code>
          <CopyButton text={orgId} />
        </div>
      </div>

      {/* HTML Snippet */}
      <div className="bg-white rounded-2xl border border-fog p-6 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-ink">Código HTML</h2>
            <p className="text-xs text-slate mt-0.5">Pega esto en tu sitio web. Personaliza los estilos con CSS.</p>
          </div>
          <CopyButton text={htmlSnippet} label="Copiar HTML" />
        </div>
        <pre className="bg-[#1e1e2e] text-[#cdd6f4] text-xs rounded-xl p-4 overflow-x-auto leading-relaxed whitespace-pre-wrap">
          {htmlSnippet}
        </pre>
      </div>

      {/* API / cURL */}
      <div className="bg-white rounded-2xl border border-fog p-6 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-ink">Integración directa (API)</h2>
            <p className="text-xs text-slate mt-0.5">POST JSON al endpoint. Útil para integraciones custom o Zapier.</p>
          </div>
          <CopyButton text={curlExample} label="Copiar cURL" />
        </div>
        <pre className="bg-[#1e1e2e] text-[#cdd6f4] text-xs rounded-xl p-4 overflow-x-auto leading-relaxed whitespace-pre-wrap">
          {curlExample}
        </pre>
        <div className="rounded-lg bg-mist border border-fog p-3 text-xs text-slate space-y-1">
          <p className="font-medium text-ink">Campos aceptados:</p>
          <p><code className="text-amber-700">clinic_id</code> — requerido. Tu ID de clínica (arriba).</p>
          <p><code className="text-amber-700">contact_phone</code> — requerido. Se usa para el seguimiento por WhatsApp.</p>
          <p><code className="text-amber-700">message</code> — requerido. Texto libre del paciente.</p>
          <p><code className="text-amber-700">contact_name</code>, <code className="text-amber-700">contact_email</code> — opcionales.</p>
        </div>
      </div>

      {/* Test */}
      <div className="rounded-xl border border-brand-100 bg-brand-50 p-4 text-sm text-brand-800 space-y-1">
        <p className="font-semibold">¿Cómo probar?</p>
        <p>Envía el cURL de arriba desde tu terminal. Luego ve a <Link href="/leads" className="underline">Leads</Link> — el mensaje aparecerá en segundos con prioridad asignada por IA.</p>
      </div>
    </div>
  )
}
