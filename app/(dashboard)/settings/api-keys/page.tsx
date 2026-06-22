import Link         from 'next/link'
import { redirect } from 'next/navigation'
import { createClient }      from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getActiveContext }  from '@/lib/tenant/context'
import { isFeatureAllowed }  from '@/lib/plans/gating'
import { createApiKey, revokeApiKey } from '@/app/actions/api-keys'

interface ApiKeyRow {
  id:           string
  name:         string
  key_prefix:   string
  last_used_at: string | null
  revoked_at:   string | null
  created_at:   string
}

const inputCls = 'w-full border border-fog rounded-xl px-3 py-2 text-sm text-ink placeholder-slate focus:outline-none focus:ring-2 focus:ring-brand-300'

export default async function ApiKeysPage({
  searchParams,
}: {
  searchParams: Promise<{ new_key?: string }>
}) {
  const { new_key } = await searchParams

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const ctx = await getActiveContext()
  if (!ctx) redirect('/org-selector')

  const allowed = await isFeatureAllowed(ctx.organizationId, 'api_webhooks')
  if (!allowed) {
    return (
      <div className="max-w-2xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-ink">API Keys</h1>
          <p className="text-sm text-slate mt-1">Integra PacienteIA con tus propios sistemas.</p>
        </div>
        <div className="rounded-2xl border border-fog bg-white p-10 text-center space-y-4">
          <p className="text-3xl">🔒</p>
          <p className="font-semibold text-ink">Disponible en plan Premium</p>
          <p className="text-sm text-slate max-w-sm mx-auto">
            La API pública permite conectar PacienteIA con tu CRM, web, o cualquier sistema externo. Incluida en el plan Premium.
          </p>
          <Link href="/pricing" className="inline-block bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors">
            Ver planes →
          </Link>
        </div>
      </div>
    )
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any
  const { data: keys } = await sb
    .from('api_keys')
    .select('id, name, key_prefix, last_used_at, revoked_at, created_at')
    .eq('organization_id', ctx.organizationId)
    .order('created_at', { ascending: false })

  const activeKeys  = ((keys ?? []) as ApiKeyRow[]).filter(k => !k.revoked_at)
  const revokedKeys = ((keys ?? []) as ApiKeyRow[]).filter(k => k.revoked_at)

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-ink">API Keys</h1>
        <p className="text-sm text-slate mt-1">
          Integra PacienteIA con sistemas externos. Autentícate con el header{' '}
          <code className="text-xs bg-mist px-1.5 py-0.5 rounded font-mono">X-API-Key: paia_...</code>
        </p>
      </div>

      {/* New key banner — shown once after creation */}
      {new_key && (
        <div className="rounded-2xl border border-lima-300 bg-lima-50 p-5 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-lima-600 font-bold text-sm">✓ API Key creada</span>
            <span className="text-xs text-lima-700">Cópiala ahora — no la podremos mostrar de nuevo.</span>
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-white border border-lima-200 rounded-xl px-3 py-2 text-xs font-mono text-ink break-all select-all">
              {new_key}
            </code>
          </div>
        </div>
      )}

      {/* Active keys */}
      <section className="rounded-2xl border bg-white p-6 space-y-4">
        <h2 className="text-sm font-semibold text-ink">Keys activas</h2>

        {activeKeys.length === 0 ? (
          <p className="text-xs text-slate">No hay API keys activas. Crea una abajo.</p>
        ) : (
          <div className="space-y-2">
            {activeKeys.map((k) => (
              <div key={k.id} className="flex items-center gap-3 p-3 bg-mist rounded-xl">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-ink">{k.name}</p>
                  <p className="text-xs text-slate font-mono mt-0.5">
                    {k.key_prefix}••••••••
                    {k.last_used_at && (
                      <span className="ml-3 not-italic">
                        Último uso: {new Date(k.last_used_at).toLocaleDateString('es-PE')}
                      </span>
                    )}
                    {!k.last_used_at && <span className="ml-3 not-italic">Nunca usada</span>}
                  </p>
                </div>
                <form action={revokeApiKey}>
                  <input type="hidden" name="id" value={k.id} />
                  <button
                    type="submit"
                    className="text-xs text-red-400 hover:text-red-600 px-2 py-1 rounded-lg hover:bg-red-50 transition-colors"
                  >
                    Revocar
                  </button>
                </form>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Create new key */}
      <section className="rounded-2xl border bg-white p-6 space-y-4">
        <h2 className="text-sm font-semibold text-ink">Crear nueva API Key</h2>
        <form action={createApiKey} className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="block text-xs font-medium text-slate mb-1">Nombre de la key</label>
            <input
              name="name"
              type="text"
              required
              placeholder="Ej: Mi CRM, Zapier, Web"
              className={inputCls}
            />
          </div>
          <button
            type="submit"
            className="bg-brand-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-brand-700 transition-colors whitespace-nowrap"
          >
            Crear key
          </button>
        </form>
      </section>

      {/* API docs */}
      <section className="rounded-2xl border border-fog bg-mist p-5 space-y-4 text-xs">
        <p className="font-semibold text-ink text-sm">Endpoints disponibles</p>
        <div className="space-y-3 font-mono">
          <div>
            <span className="text-xs font-bold text-lima-700 bg-lima-50 px-1.5 py-0.5 rounded mr-2">GET</span>
            <span className="text-ink">/api/v1/patients</span>
            <p className="text-slate mt-0.5 font-sans">Lista de pacientes activos. Params: <code>q</code>, <code>limit</code> (max 100)</p>
          </div>
          <div>
            <span className="text-xs font-bold text-lima-700 bg-lima-50 px-1.5 py-0.5 rounded mr-2">GET</span>
            <span className="text-ink">/api/v1/appointments</span>
            <p className="text-slate mt-0.5 font-sans">Lista de citas. Params: <code>date</code> (YYYY-MM-DD), <code>status</code>, <code>limit</code></p>
          </div>
          <div>
            <span className="text-xs font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded mr-2">POST</span>
            <span className="text-ink">/api/v1/leads</span>
            <p className="text-slate mt-0.5 font-sans">Crear un lead desde sistema externo. Body: <code>{'{ contact_name, contact_phone, source_channel, raw_content }'}</code></p>
          </div>
        </div>
        <div className="mt-3 bg-gray-900 text-green-400 rounded-xl p-3 font-mono text-xs">
          <p className="text-gray-500 mb-1"># Ejemplo</p>
          <p>curl https://app.pacienteia.com/api/v1/patients \</p>
          <p className="pl-4">-H &quot;X-API-Key: paia_...&quot;</p>
        </div>
      </section>

      {/* Revoked keys (collapsed) */}
      {revokedKeys.length > 0 && (
        <details className="rounded-2xl border bg-white p-5">
          <summary className="text-xs font-semibold text-slate cursor-pointer">
            Keys revocadas ({revokedKeys.length})
          </summary>
          <div className="mt-3 space-y-2">
            {revokedKeys.map((k) => (
              <div key={k.id} className="flex items-center gap-3 p-3 bg-mist rounded-xl opacity-60">
                <div className="flex-1">
                  <p className="text-xs font-medium text-ink line-through">{k.name}</p>
                  <p className="text-xs text-slate font-mono">{k.key_prefix}••••••••</p>
                </div>
                <span className="text-xs text-red-400">Revocada {new Date(k.revoked_at!).toLocaleDateString('es-PE')}</span>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  )
}
