import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { getActiveContext } from '@/lib/tenant/context'
import { inviteStaffMember, updateStaffRole, removeStaffMember, setStaffPhone } from '@/app/actions/staff'

type Member = {
  user_id:        string
  role:           string
  email:          string
  name:           string | null
  whatsapp_phone: string | null
}

const ROLE_LABEL: Record<string, string> = {
  owner: 'Propietario',
  admin: 'Administrador',
  staff: 'Recepcionista',
}

const ROLE_COLOR: Record<string, string> = {
  owner: 'bg-ai-100 text-ai-600',
  admin: 'bg-blue-100 text-blue-700',
  staff: 'bg-[#F3F6F9] text-slate',
}

const inputCls = 'w-full border border-fog rounded-xl px-3 py-2 text-sm text-ink placeholder-slate focus:outline-none focus:ring-2 focus:ring-brand-300'

export default async function StaffPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>
}) {
  const { saved } = await searchParams

  const supabase = await createClient()
  const { data: { user: currentUser } } = await supabase.auth.getUser()
  if (!currentUser) redirect('/login')

  const ctx = await getActiveContext()
  if (!ctx) redirect('/org-selector')
  const { organizationId } = ctx

  const sb = createAdminClient() as any

  // Fetch org_members
  const { data: members } = await sb
    .from('org_members')
    .select('user_id, role, whatsapp_phone')
    .eq('organization_id', organizationId)
    .order('role')

  // Fetch auth user details for each member
  const { data: listData } = await sb.auth.admin.listUsers({ page: 1, perPage: 1000 })
  const authUsers = listData?.users ?? []
  const authMap = new Map(
    (authUsers as { id: string; email?: string; user_metadata?: { full_name?: string; name?: string } }[])
      .map(u => [u.id, u])
  )

  const enriched: Member[] = ((members ?? []) as { user_id: string; role: string; whatsapp_phone: string | null }[]).map(m => {
    const au = authMap.get(m.user_id)
    return {
      user_id:        m.user_id,
      role:           m.role,
      email:          au?.email ?? '—',
      name:           au?.user_metadata?.full_name ?? au?.user_metadata?.name ?? null,
      whatsapp_phone: m.whatsapp_phone ?? null,
    }
  })

  const currentMember = enriched.find(m => m.user_id === currentUser.id)

  const isOwnerOrAdmin = currentMember?.role !== 'staff'

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-ink">Equipo</h1>
        <p className="text-sm text-slate mt-1">
          Gestiona quién tiene acceso al dashboard y sus permisos.
        </p>
      </div>

      {saved === '1' && (
        <div className="rounded-xl bg-lima-50 border border-lima-200 px-4 py-3 text-sm text-lima-700 font-medium">
          Guardado correctamente.
        </div>
      )}

      {/* Members list */}
      <section className="rounded-2xl border bg-white p-6 space-y-4">
        <h2 className="text-sm font-semibold text-ink">Miembros actuales</h2>

        {enriched.length === 0 ? (
          <p className="text-xs text-slate">No hay miembros en esta organización.</p>
        ) : (
          <div className="space-y-2">
            {enriched.map((m) => {
              const isSelf = m.user_id === currentUser.id
              const isOwner = m.role === 'owner'
              return (
                <div key={m.user_id} className="flex items-center gap-3 p-3 bg-mist rounded-xl">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-ink">
                        {m.name ?? m.email}
                        {isSelf && <span className="ml-1 text-xs text-slate">(tú)</span>}
                      </p>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${ROLE_COLOR[m.role] ?? 'bg-[#F3F6F9] text-slate'}`}>
                        {ROLE_LABEL[m.role] ?? m.role}
                      </span>
                    </div>
                    {m.name && <p className="text-xs text-slate mt-0.5">{m.email}</p>}
                  </div>

                  {isOwnerOrAdmin && !isSelf && !isOwner && (
                    <div className="flex items-center gap-1 shrink-0">
                      <form action={updateStaffRole}>
                        <input type="hidden" name="user_id" value={m.user_id} />
                        <select
                          name="role"
                          defaultValue={m.role}
                          onChange={(e) => e.currentTarget.form?.requestSubmit()}
                          className="text-xs border border-fog rounded-lg px-2 py-1 text-slate focus:outline-none focus:ring-1 focus:ring-brand-300 bg-white"
                        >
                          <option value="admin">Administrador</option>
                          <option value="staff">Recepcionista</option>
                        </select>
                      </form>
                      <form action={removeStaffMember}>
                        <input type="hidden" name="user_id" value={m.user_id} />
                        <button type="submit" className="text-xs text-red-400 hover:text-red-600 px-2 py-1 rounded-lg hover:bg-red-50 transition-colors">
                          Quitar
                        </button>
                      </form>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* Voice-to-Task phone */}
      <section className="rounded-2xl border bg-white p-6 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-ink flex items-center gap-2">
            🎙️ Tu teléfono para notas de voz
          </h2>
          <p className="text-xs text-slate mt-1">
            Registra tu número de WhatsApp personal para que el sistema reconozca tus notas de voz
            y las convierta automáticamente en tareas, mensajes y citas. Incluye el código de país (ej: +51987654321).
          </p>
        </div>
        <form action={setStaffPhone} className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="block text-xs font-medium text-slate mb-1">Número WhatsApp</label>
            <input
              name="whatsapp_phone"
              type="tel"
              placeholder="+51987654321"
              defaultValue={currentMember?.whatsapp_phone ?? ''}
              className={inputCls}
            />
          </div>
          <button
            type="submit"
            className="bg-brand-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-brand-700 transition-colors whitespace-nowrap"
          >
            Guardar
          </button>
        </form>
        {currentMember?.whatsapp_phone && (
          <p className="text-xs text-lima-700 font-medium">
            ✓ Registrado: {currentMember.whatsapp_phone}
          </p>
        )}
        <div className="rounded-xl bg-brand-50 border border-brand-100 p-3 text-xs text-brand-800 space-y-1">
          <p className="font-semibold">¿Cómo funciona?</p>
          <p>Envía una nota de voz al número de WhatsApp de la clínica. El sistema la transcribe y ejecuta la instrucción automáticamente.</p>
          <p>Ejemplo: <em>"Alessandra terminó su sesión de botox, agendarle control en 15 días y enviarle guía de cuidados"</em></p>
        </div>
      </section>

      {/* Invite form */}
      {isOwnerOrAdmin && (
        <section className="rounded-2xl border bg-white p-6 space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-ink">Invitar miembro</h2>
            <p className="text-xs text-slate mt-0.5">
              Recibirán un email con acceso al dashboard de esta clínica.
            </p>
          </div>
          <form action={inviteStaffMember} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate mb-1">Email *</label>
                <input name="email" type="email" required placeholder="recepcion@clinica.com" className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate mb-1">Rol</label>
                <select name="role" className={inputCls}>
                  <option value="staff">Recepcionista</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>
            </div>
            <button
              type="submit"
              className="w-full bg-brand-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-brand-700 transition-colors"
            >
              Enviar invitación
            </button>
          </form>

          <div className="pt-2 border-t border-fog">
            <p className="text-xs text-slate">
              <strong>Recepcionista</strong> — ve y gestiona citas, pacientes, leads, bandeja de mensajes.<br />
              <strong>Administrador</strong> — acceso completo excepto facturación y eliminar la organización.
            </p>
          </div>
        </section>
      )}
    </div>
  )
}
