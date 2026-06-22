import { requirePlatformAdmin, requireRole, PLATFORM_ROLE_LABEL, type PlatformRole } from '@/lib/platform/auth'
import { listPlatformAdmins, invitePlatformAdmin, removePlatformAdmin } from '@/app/actions/platform-admins'
import { unstable_noStore as noStore } from 'next/cache'

type AdminRow = {
  id:              string
  email:           string
  full_name:       string
  platform_role:   PlatformRole
  commission_rate: number
}

export default async function AdminsPage() {
  noStore()
  const pu = await requirePlatformAdmin()
  requireRole(pu, ['superadmin'])

  const admins = await listPlatformAdmins()

  const ROLE_COLOR: Record<PlatformRole, string> = {
    superadmin: 'bg-red-50 text-red-700 border-red-200',
    support:    'bg-brand-50 text-brand-700 border-brand-200',
    sales:      'bg-lima-50 text-lima-700 border-lima-200',
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">Equipo de Plataforma</h1>
        <p className="text-sm text-slate mt-0.5">
          Gestiona quién tiene acceso al panel de administración y con qué rol.
        </p>
      </div>

      {/* Roles explanation */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {([
          {
            role: 'superadmin' as PlatformRole,
            desc: 'Acceso total. Puede crear tenants, cambiar planes, ver revenue, suspender cuentas y gestionar el equipo de plataforma.',
          },
          {
            role: 'support' as PlatformRole,
            desc: 'Puede entrar como soporte a cualquier clínica, configurar WhatsApp/Meta, extender trials. No ve finanzas ni puede cambiar planes.',
          },
          {
            role: 'sales' as PlatformRole,
            desc: 'Solo accede al CRM de ventas. Ve sus prospectos asignados, clientes captados y sus métricas de comisión.',
          },
        ]).map(({ role, desc }) => (
          <div key={role} className={`rounded-xl border p-4 text-sm ${ROLE_COLOR[role]}`}>
            <p className="font-semibold mb-1">{PLATFORM_ROLE_LABEL[role]}</p>
            <p className="text-xs opacity-80 leading-relaxed">{desc}</p>
          </div>
        ))}
      </div>

      {/* Current team */}
      <section className="rounded-xl border border-fog bg-white shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-fog">
          <h2 className="text-sm font-semibold text-ink">Miembros actuales ({admins.length})</h2>
        </div>
        {admins.length === 0 ? (
          <p className="px-5 py-8 text-sm text-slate text-center">Sin miembros de plataforma aún.</p>
        ) : (
          <div className="divide-y divide-fog">
            {admins.map((a: AdminRow) => (
              <div key={a.id} className="px-5 py-3 flex items-center justify-between gap-4 flex-wrap">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink">{a.email}</p>
                  {a.full_name && <p className="text-xs text-slate">{a.full_name}</p>}
                </div>
                <div className="flex items-center gap-3">
                  {a.platform_role === 'sales' && (
                    <p className="text-xs text-slate">
                      Comisión: <span className="font-semibold text-lima-600">{a.commission_rate}%</span>
                    </p>
                  )}
                  <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${ROLE_COLOR[a.platform_role]}`}>
                    {PLATFORM_ROLE_LABEL[a.platform_role]}
                  </span>
                  {a.id !== pu.id && (
                    <form action={removePlatformAdmin.bind(null, a.id)}>
                      <button type="submit" className="text-[11px] text-red-600 hover:text-red-700 font-medium transition-colors">
                        Quitar
                      </button>
                    </form>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Invite form */}
      <section className="rounded-xl border border-fog bg-white shadow-xs p-6">
        <h2 className="text-sm font-semibold text-ink mb-4">Invitar miembro</h2>
        <form action={invitePlatformAdmin} className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate mb-1.5">Email</label>
            <input
              name="email"
              type="email"
              required
              placeholder="nombre@empresa.com"
              className="w-full px-3 py-2 text-sm border border-fog rounded-lg bg-white text-ink placeholder:text-slate focus:outline-none focus:ring-2 focus:ring-brand-300"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate mb-1.5">Rol</label>
            <select
              name="role"
              required
              className="w-full px-3 py-2 text-sm border border-fog rounded-lg bg-white text-ink focus:outline-none focus:ring-2 focus:ring-brand-300"
            >
              <option value="support">Soporte</option>
              <option value="sales">Comercial</option>
              <option value="superadmin">Super Admin</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate mb-1.5">Comisión % (solo comercial)</label>
            <input
              name="commission_rate"
              type="number"
              min="0"
              max="100"
              step="0.5"
              defaultValue="0"
              className="w-full px-3 py-2 text-sm border border-fog rounded-lg bg-white text-ink focus:outline-none focus:ring-2 focus:ring-brand-300"
            />
          </div>
          <div className="sm:col-span-4 flex justify-end">
            <button
              type="submit"
              className="px-5 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              Invitar
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}
