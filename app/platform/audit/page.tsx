import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'

interface AuditRow {
  id:              string
  actor_email:     string | null
  action_type:     string
  organization_name: string | null
  organization_id: string | null
  details:         Record<string, unknown>
  created_at:      string
}

async function fetchAuditLog(limit = 100): Promise<AuditRow[]> {
  const sb = createAdminClient() as any
  const { data } = await sb
    .from('platform_audit_log')
    .select('id, actor_email, action_type, organization_name, organization_id, details, created_at')
    .order('created_at', { ascending: false })
    .limit(limit)
  return data ?? []
}

const ACTION_COLORS: Record<string, string> = {
  create_tenant: 'bg-green-50 text-green-700 border-green-200',
  extend_trial:  'bg-brand-50 text-brand-700 border-brand-200',
  suspend:       'bg-red-50 text-red-700 border-red-200',
  reactivate:    'bg-green-50 text-green-700 border-green-200',
  assign_plan:   'bg-ai-50 text-ai-600 border-ai-200',
  enter_tenant:    'bg-amber-50 text-amber-700 border-amber-200',
  whatsapp_add:    'bg-teal-50 text-teal-700 border-teal-200',
  whatsapp_revoke: 'bg-red-50 text-red-700 border-red-200',
  exit_tenant:   'bg-mist text-slate border-fog',
}

export default async function AuditPage() {
  const rows = await fetchAuditLog()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">Auditoría de plataforma</h1>
        <p className="text-sm text-slate mt-0.5">Todas las acciones realizadas por admins de plataforma</p>
      </div>

      <div className="rounded-xl border border-fog bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-fog text-left">
              <th className="px-4 py-3 text-[11px] font-semibold text-slate uppercase tracking-[0.06em]">Fecha</th>
              <th className="px-4 py-3 text-[11px] font-semibold text-slate uppercase tracking-[0.06em]">Actor</th>
              <th className="px-4 py-3 text-[11px] font-semibold text-slate uppercase tracking-[0.06em]">Acción</th>
              <th className="px-4 py-3 text-[11px] font-semibold text-slate uppercase tracking-[0.06em]">Clínica</th>
              <th className="px-4 py-3 text-[11px] font-semibold text-slate uppercase tracking-[0.06em]">Detalles</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-fog">
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-mist/50">
                <td className="px-4 py-3 text-slate text-xs whitespace-nowrap">
                  {new Date(r.created_at).toLocaleDateString('es-PE', {
                    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                  })}
                </td>
                <td className="px-4 py-3 text-slate text-xs">{r.actor_email ?? '—'}</td>
                <td className="px-4 py-3">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                    ACTION_COLORS[r.action_type] ?? 'bg-mist text-slate border-fog'
                  }`}>
                    {r.action_type}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate text-xs">
                  {r.organization_id ? (
                    <Link href={`/platform/tenants/${r.organization_id}`} className="hover:text-ink underline underline-offset-2">
                      {r.organization_name ?? r.organization_id}
                    </Link>
                  ) : '—'}
                </td>
                <td className="px-4 py-3 text-slate text-xs font-mono">
                  {Object.keys(r.details).length > 0 ? JSON.stringify(r.details) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && (
          <div className="px-4 py-12 text-center text-slate text-sm">Sin acciones registradas.</div>
        )}
      </div>
    </div>
  )
}
