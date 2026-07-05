import { notFound } from 'next/navigation'
import { fetchTenantDetail } from '@/lib/platform/tenants'
import {
  extendTrial,
  suspendTenant,
  reactivateTenant,
  assignPlan,
  enterTenant,
  addWhatsAppConfig,
  revokeWhatsAppConfig,
  updateAcquisitionSource,
  addCrmNote,
} from '@/app/actions/platform'
import { setAcquisitionRepAction } from '@/app/actions/platform-admins'
import { requirePlatformAdmin } from '@/lib/platform/auth'
import { createAdminClient } from '@/lib/supabase/admin'

type Params = Promise<{ id: string }>
type SearchParams = Promise<{ ok?: string; err?: string }>

import { PLAN_CONFIG, PLAN_ORDER } from '@/lib/plans/config'

async function getSalesReps() {
  const sb = createAdminClient() as any
  const { data: profiles } = await sb
    .from('profiles')
    .select('id, full_name')
    .eq('platform_role', 'sales')
  if (!profiles?.length) return []
  const { data: { users } } = await sb.auth.admin.listUsers({ perPage: 1000 })
  const emailMap: Record<string, string> = {}
  for (const u of (users ?? [])) emailMap[u.id] = u.email ?? ''
  return (profiles ?? []).map((p: any) => ({
    id:    p.id,
    label: p.full_name ?? emailMap[p.id] ?? p.id,
  }))
}

const OK_MESSAGES: Record<string, string> = {
  created:          'Clínica creada e invitación enviada al propietario.',
  trial:            'Trial extendido correctamente.',
  suspended:        'Clínica suspendida.',
  reactivated:      'Clínica reactivada.',
  plan:             'Plan actualizado.',
  whatsapp_added:   'WhatsApp conectado correctamente.',
  whatsapp_revoked: 'Número de WhatsApp revocado.',
}

const ERR_MESSAGES: Record<string, string> = {
  wa_duplicate: 'Ese Phone Number ID ya está registrado en otra sucursal.',
}

function fmt(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })
}

function statusColor(status: string | null) {
  const map: Record<string, string> = {
    active: 'text-lima-600', trialing: 'text-brand-600',
    past_due: 'text-amber-600', cancelled: 'text-red-600',
  }
  return map[status ?? ''] ?? 'text-slate'
}

export default async function TenantDetailPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const [{ id }, { ok, err }] = await Promise.all([params, searchParams])
  const [tenant, pu, salesReps] = await Promise.all([
    fetchTenantDetail(id),
    requirePlatformAdmin(),
    getSalesReps(),
  ])
  if (!tenant) notFound()

  const isSuperAdmin     = pu.platform_role === 'superadmin'
  const enterAction      = enterTenant.bind(null, tenant.id, tenant.name)
  const suspendAction    = suspendTenant.bind(null, tenant.id, tenant.name)
  const reactivateAction = reactivateTenant.bind(null, tenant.id, tenant.name)
  const addWaAction      = addWhatsAppConfig.bind(null, tenant.id, tenant.name)
  const updateSourceAct  = updateAcquisitionSource.bind(null, tenant.id, tenant.name)
  const addNoteAction    = addCrmNote.bind(null, tenant.id, tenant.name)
  const setRepAction     = setAcquisitionRepAction.bind(null, tenant.id)

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Success banner */}
      {ok && OK_MESSAGES[ok] && (
        <div className="rounded-lg bg-green-50 border border-green-200 text-green-700 px-4 py-3 text-sm font-medium">
          ✓ {OK_MESSAGES[ok]}
        </div>
      )}
      {/* Error banner */}
      {err && ERR_MESSAGES[err] && (
        <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm font-medium">
          ✗ {ERR_MESSAGES[err]}
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <p className="text-xs text-slate mb-1">← <a href="/platform/tenants" className="hover:text-slate">Tenants</a></p>
          <h1 className="text-2xl font-bold text-ink">{tenant.name}</h1>
          <p className="text-sm text-slate mt-0.5">
            <span className="font-mono">{tenant.slug}</span>
            {' · '}
            <span className={statusColor(tenant.subscription_status)}>{tenant.subscription_status ?? '—'}</span>
            {' · '}
            <span className="text-slate">Plan: {tenant.plan ?? '—'}</span>
          </p>
        </div>

        {/* Enter tenant */}
        <form action={enterAction}>
          <button
            type="submit"
            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-ink text-sm font-semibold rounded-lg transition-colors"
          >
            Entrar como soporte →
          </button>
        </form>
      </div>

      {/* Onboarding checklist */}
      <section className="rounded-xl border border-fog bg-white px-5 py-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-slate">Onboarding</h2>
          <span className="text-xs text-slate">
            {tenant.onboarding.filter((s) => s.done).length}/{tenant.onboarding.length} completados
          </span>
        </div>
        <div className="flex flex-wrap gap-3">
          {tenant.onboarding.map((step) => (
            <div
              key={step.key}
              title={step.done ? step.label : `Pendiente: ${step.hint}`}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-colors ${
                step.done
                  ? 'bg-green-50 border-green-200 text-green-700'
                  : 'bg-mist border-fog text-slate'
              }`}
            >
              <span>{step.done ? '✓' : '○'}</span>
              <span>{step.label}</span>
            </div>
          ))}
        </div>
        {tenant.onboarding.some((s) => !s.done) && (
          <ul className="mt-3 space-y-1">
            {tenant.onboarding.filter((s) => !s.done).map((step) => (
              <li key={step.key} className="text-[11px] text-amber-600/80 flex gap-2">
                <span className="shrink-0">→</span>
                <span><span className="font-semibold">{step.label}:</span> {step.hint}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Subscription info */}
        <section className="rounded-xl border border-fog bg-white p-5 space-y-4">
          <h2 className="text-sm font-semibold text-slate">Suscripción</h2>
          <dl className="space-y-2 text-sm">
            <Row label="Estado"      value={tenant.subscription_status ?? '—'} />
            <Row label="Plan"        value={tenant.plan ?? '—'} />
            <Row label="Trial hasta" value={fmt(tenant.trial_ends_at)} />
            <Row label="Período fin" value={fmt(tenant.current_period_end)} />
            <Row label="Registrada"  value={fmt(tenant.created_at)} />
            <Row label="Miembros"    value={String(tenant.memberCount)} />
          </dl>
          <div className="border-t border-fog pt-3 space-y-2">
            <p className="text-xs text-slate">Fuente de adquisición</p>
            <form action={updateSourceAct} className="flex gap-2">
              <select
                name="acquisition_source"
                defaultValue={tenant.acquisition_source ?? ''}
                className="flex-1 bg-mist border border-fog rounded-lg px-2 py-1.5 text-xs text-slate focus:outline-none focus:ring-1 focus:ring-brand-500"
              >
                <option value="">Sin definir</option>
                <option value="paxi">Paxi (bot WhatsApp)</option>
                <option value="referido">Referido</option>
                <option value="outreach">Outreach frío</option>
                <option value="google">Google / SEO</option>
                <option value="evento">Evento / Demo</option>
                <option value="otro">Otro</option>
              </select>
              <button type="submit" className="px-3 py-1.5 bg-[#EEF0F3] hover:bg-[#E2E5EA] text-slate text-xs rounded-lg transition-colors">
                Guardar
              </button>
            </form>
          </div>
          {isSuperAdmin && salesReps.length > 0 && (
            <div className="border-t border-fog pt-3 space-y-2">
              <p className="text-xs text-slate">Comercial responsable</p>
              <form action={setRepAction} className="flex gap-2">
                <select
                  name="rep_id"
                  defaultValue={tenant.acquisition_rep_id ?? ''}
                  className="flex-1 bg-mist border border-fog rounded-lg px-2 py-1.5 text-xs text-slate focus:outline-none focus:ring-1 focus:ring-brand-500"
                >
                  <option value="">Sin asignar</option>
                  {salesReps.map((r: { id: string; label: string }) => (
                    <option key={r.id} value={r.id}>{r.label}</option>
                  ))}
                </select>
                <button type="submit" className="px-3 py-1.5 bg-[#EEF0F3] hover:bg-[#E2E5EA] text-slate text-xs rounded-lg transition-colors">
                  Guardar
                </button>
              </form>
            </div>
          )}
        </section>

        {/* Actions */}
        <section className="rounded-xl border border-fog bg-white p-5 space-y-4">
          <h2 className="text-sm font-semibold text-slate">Acciones de plataforma</h2>

          {/* Extend trial */}
          <div className="space-y-1">
            <p className="text-xs text-slate">Extender trial</p>
            <div className="flex gap-2">
              {[7, 14, 30].map((days) => {
                const action = extendTrial.bind(null, tenant.id, tenant.name, days)
                return (
                  <form key={days} action={action}>
                    <button
                      type="submit"
                      className="px-3 py-1.5 bg-brand-50 hover:bg-brand-100 text-brand-700 text-xs font-semibold rounded-lg transition-colors"
                    >
                      +{days}d
                    </button>
                  </form>
                )
              })}
            </div>
          </div>

          {/* Assign plan */}
          <div className="space-y-1">
            <p className="text-xs text-slate">Asignar plan</p>
            <div className="flex flex-wrap gap-2">
              {PLAN_ORDER.map((plan) => {
                const cfg    = PLAN_CONFIG[plan]
                const action = assignPlan.bind(null, tenant.id, tenant.name, plan)
                const label  = cfg.price_pen === 0
                  ? `${cfg.name} (free)`
                  : `${cfg.name} · S/ ${cfg.price_pen}`
                return (
                  <form key={plan} action={action}>
                    <button
                      type="submit"
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                        tenant.plan === plan
                          ? 'bg-brand-600 text-ink'
                          : 'bg-mist hover:bg-[#EEF0F3] text-slate'
                      }`}
                    >
                      {label}
                    </button>
                  </form>
                )
              })}
            </div>
          </div>

          {/* Suspend / Reactivate */}
          <div className="flex gap-2 pt-2 border-t border-fog">
            {tenant.subscription_status !== 'cancelled' ? (
              <form action={suspendAction}>
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-semibold rounded-lg transition-colors"
                >
                  Suspender clínica
                </button>
              </form>
            ) : (
              <form action={reactivateAction}>
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-lima-50 hover:bg-lima-100 text-lima-700 text-xs font-semibold rounded-lg transition-colors"
                >
                  Reactivar clínica
                </button>
              </form>
            )}
          </div>
        </section>
      </div>

      {/* Members */}
      <section className="rounded-xl border border-fog bg-white overflow-hidden">
        <div className="px-5 py-4 border-b border-fog">
          <h2 className="text-sm font-semibold text-slate">Miembros ({tenant.memberCount})</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-fog text-left">
              <th className="px-4 py-3 text-[11px] font-semibold text-slate uppercase tracking-[0.06em]">Nombre</th>
              <th className="px-4 py-3 text-[11px] font-semibold text-slate uppercase tracking-[0.06em]">Email</th>
              <th className="px-4 py-3 text-[11px] font-semibold text-slate uppercase tracking-[0.06em]">Rol</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-fog">
            {tenant.members.map((m) => (
              <tr key={m.id} className="hover:bg-mist/50">
                <td className="px-4 py-3 text-slate">{m.full_name ?? '—'}</td>
                <td className="px-4 py-3 text-slate font-mono text-xs">{m.email}</td>
                <td className="px-4 py-3">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                    m.role === 'owner'  ? 'bg-ai-50 text-ai-600 border-ai-200' :
                    m.role === 'doctor' ? 'bg-brand-50 text-brand-700 border-brand-200' :
                    'bg-mist text-slate border-fog'
                  }`}>
                    {m.role}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* WhatsApp */}
      <section className="rounded-xl border border-fog bg-white overflow-hidden">
        <div className="px-5 py-4 border-b border-fog flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate">WhatsApp Business</h2>
            <p className="text-xs text-slate mt-0.5">Números conectados a esta clínica</p>
          </div>
          <span className="text-xs text-slate">
            Webhook: <span className="font-mono text-slate">https://app.pacienteia.com/api/whatsapp/webhook</span>
          </span>
        </div>

        {/* Existing configs */}
        {tenant.whatsappConfigs.length > 0 && (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-fog text-left">
                <th className="px-4 py-3 text-[11px] font-semibold text-slate uppercase tracking-[0.06em]">Número / Sucursal</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-slate uppercase tracking-[0.06em] hidden sm:table-cell">Phone Number ID</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-slate uppercase tracking-[0.06em] hidden md:table-cell">WABA ID</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-slate uppercase tracking-[0.06em]">Estado</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-slate uppercase tracking-[0.06em]">Secret</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-fog">
              {tenant.whatsappConfigs.map((c) => {
                const revokeAction = revokeWhatsAppConfig.bind(null, c.id, tenant.id, tenant.name)
                return (
                  <tr key={c.id} className={c.status === 'revoked' ? 'opacity-50' : ''}>
                    <td className="px-4 py-3">
                      <p className="text-slate font-medium">{c.display_name ?? '—'}</p>
                      <p className="text-xs text-slate">{c.branch_name}</p>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate hidden sm:table-cell">{c.phone_number_id}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate hidden md:table-cell">{c.waba_id}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                        c.status === 'active'  ? 'bg-green-50 text-green-700' :
                        c.status === 'revoked' ? 'bg-mist text-slate'  :
                        c.status === 'error'   ? 'bg-red-50 text-red-700'    :
                                                 'bg-amber-50 text-amber-700'
                      }`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {c.has_app_secret
                        ? <span className="text-[11px] text-lima-600">✓</span>
                        : <span className="text-[11px] text-amber-600">Pendiente</span>}
                    </td>
                    <td className="px-4 py-3">
                      {c.status !== 'revoked' && (
                        <form action={revokeAction}>
                          <button
                            type="submit"
                            className="text-[11px] text-red-600 hover:text-red-700 border border-red-200 hover:border-red-300 px-2 py-0.5 rounded transition-colors"
                          >
                            Revocar
                          </button>
                        </form>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}

        {/* Add new config form */}
        <div className="px-5 py-5 border-t border-fog space-y-4">
          <p className="text-xs text-[11px] font-semibold text-slate uppercase tracking-[0.06em]">Conectar nuevo número</p>
          <form action={addWaAction} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate mb-1">Sucursal *</label>
                <select
                  name="branch_id"
                  required
                  className="w-full bg-mist border border-fog rounded-lg px-3 py-2 text-sm text-slate focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <option value="">Selecciona una sucursal</option>
                  {tenant.branches.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate mb-1">Nombre del número</label>
                <input
                  name="display_name"
                  type="text"
                  placeholder="Ej: La Rosa - San Isidro"
                  className="w-full bg-mist border border-fog rounded-lg px-3 py-2 text-sm text-slate placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <div>
                <label className="block text-xs text-slate mb-1">Phone Number ID * <span className="text-slate">(Meta → API Setup)</span></label>
                <input
                  name="phone_number_id"
                  type="text"
                  required
                  placeholder="1169072966279649"
                  className="w-full bg-mist border border-fog rounded-lg px-3 py-2 text-sm text-slate placeholder-gray-600 font-mono focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <div>
                <label className="block text-xs text-slate mb-1">WABA ID * <span className="text-slate">(WhatsApp Business Account ID)</span></label>
                <input
                  name="waba_id"
                  type="text"
                  required
                  placeholder="1000106235772431"
                  className="w-full bg-mist border border-fog rounded-lg px-3 py-2 text-sm text-slate placeholder-gray-600 font-mono focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <div>
                <label className="block text-xs text-slate mb-1">Access Token * <span className="text-slate">(System User → Generate Token)</span></label>
                <input
                  name="access_token"
                  type="password"
                  required
                  placeholder="EAAxxxxxxxx…"
                  className="w-full bg-mist border border-fog rounded-lg px-3 py-2 text-sm text-slate placeholder-gray-600 font-mono focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <div>
                <label className="block text-xs text-slate mb-1">App Secret <span className="text-slate">(Settings → Basic → App Secret)</span></label>
                <input
                  name="app_secret"
                  type="password"
                  placeholder="Recomendado para validar webhooks"
                  className="w-full bg-mist border border-fog rounded-lg px-3 py-2 text-sm text-slate placeholder-gray-600 font-mono focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
            </div>
            <div className="pt-1">
              <button
                type="submit"
                className="px-5 py-2 bg-lima-500 hover:bg-lima-600 text-white text-sm font-semibold rounded-lg transition-colors"
              >
                Conectar número →
              </button>
            </div>
          </form>
        </div>
      </section>

      {/* CRM Notes */}
      <section className="rounded-xl border border-fog bg-white overflow-hidden">
        <div className="px-5 py-4 border-b border-fog">
          <h2 className="text-sm font-semibold text-slate">Notas de contacto</h2>
          <p className="text-xs text-slate mt-0.5">Llamadas, demos, emails — historial del equipo de ventas</p>
        </div>

        {/* Add note form */}
        <form action={addNoteAction} className="px-5 py-4 border-b border-fog space-y-3">
          <div className="flex gap-2">
            <select
              name="contact_type"
              className="bg-mist border border-fog rounded-lg px-2 py-2 text-xs text-slate focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              <option value="note">Nota</option>
              <option value="call">Llamada</option>
              <option value="email">Email</option>
              <option value="demo">Demo</option>
              <option value="whatsapp">WhatsApp</option>
            </select>
            <textarea
              name="body"
              rows={2}
              required
              placeholder="Ej: Llamé a Juan, interesado en plan Pro, evalúa hasta fin de mes…"
              className="flex-1 bg-mist border border-fog rounded-lg px-3 py-2 text-sm text-slate placeholder-gray-600 resize-none focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
            <button type="submit" className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-ink text-sm font-semibold rounded-lg transition-colors shrink-0 self-end">
              Guardar
            </button>
          </div>
        </form>

        {/* Notes list */}
        {tenant.crmNotes.length === 0 ? (
          <p className="px-5 py-6 text-sm text-slate">Sin notas aún. Registra tu primer contacto arriba.</p>
        ) : (
          <div className="divide-y divide-fog">
            {tenant.crmNotes.map((note) => (
              <div key={note.id} className="px-5 py-3 flex gap-3">
                <span className={`shrink-0 mt-0.5 text-[10px] font-bold px-2 py-0.5 rounded border h-fit ${
                  note.contact_type === 'call'     ? 'bg-brand-50 text-brand-700 border-brand-200' :
                  note.contact_type === 'demo'     ? 'bg-green-50 text-green-700 border-green-200' :
                  note.contact_type === 'email'    ? 'bg-ai-50 text-ai-600 border-ai-200' :
                  note.contact_type === 'whatsapp' ? 'bg-teal-50 text-teal-700 border-teal-200' :
                                                     'bg-mist text-slate border-fog'
                }`}>
                  {note.contact_type.toUpperCase()}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate">{note.body}</p>
                  <p className="text-[10px] text-slate mt-0.5">
                    {note.author_email} · {new Date(note.created_at).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Audit log */}
      {tenant.recentActivity.length > 0 && (
        <section className="rounded-xl border border-fog bg-white overflow-hidden">
          <div className="px-5 py-4 border-b border-fog">
            <h2 className="text-sm font-semibold text-slate">Historial de acciones de plataforma</h2>
          </div>
          <div className="divide-y divide-fog">
            {tenant.recentActivity.map((a, i) => (
              <div key={i} className="px-5 py-3 flex items-start justify-between gap-4">
                <div>
                  <span className="text-xs font-bold text-amber-600 uppercase">{a.action_type}</span>
                  <span className="text-xs text-slate ml-2">por {a.actor_email ?? '—'}</span>
                  {Object.keys(a.details).length > 0 && (
                    <p className="text-xs text-slate mt-0.5 font-mono">{JSON.stringify(a.details)}</p>
                  )}
                </div>
                <p className="text-xs text-slate whitespace-nowrap">
                  {new Date(a.created_at).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-slate">{label}</dt>
      <dd className="text-slate font-medium">{value}</dd>
    </div>
  )
}
