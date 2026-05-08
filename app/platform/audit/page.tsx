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
  extend_trial:  'bg-blue-900 text-blue-300 border-blue-800',
  suspend:       'bg-red-900 text-red-300 border-red-800',
  reactivate:    'bg-green-900 text-green-300 border-green-800',
  assign_plan:   'bg-purple-900 text-purple-300 border-purple-800',
  enter_tenant:  'bg-amber-900 text-amber-300 border-amber-800',
  exit_tenant:   'bg-gray-800 text-gray-400 border-gray-700',
}

export default async function AuditPage() {
  const rows = await fetchAuditLog()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Auditoría de plataforma</h1>
        <p className="text-sm text-gray-400 mt-0.5">Todas las acciones realizadas por admins de plataforma</p>
      </div>

      <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-left">
              <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Fecha</th>
              <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Actor</th>
              <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Acción</th>
              <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Clínica</th>
              <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Detalles</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-gray-800/30">
                <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                  {new Date(r.created_at).toLocaleDateString('es-PE', {
                    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                  })}
                </td>
                <td className="px-4 py-3 text-gray-300 text-xs">{r.actor_email ?? '—'}</td>
                <td className="px-4 py-3">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                    ACTION_COLORS[r.action_type] ?? 'bg-gray-800 text-gray-400 border-gray-700'
                  }`}>
                    {r.action_type}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-300 text-xs">
                  {r.organization_id ? (
                    <Link href={`/platform/tenants/${r.organization_id}`} className="hover:text-white underline underline-offset-2">
                      {r.organization_name ?? r.organization_id}
                    </Link>
                  ) : '—'}
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs font-mono">
                  {Object.keys(r.details).length > 0 ? JSON.stringify(r.details) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && (
          <div className="px-4 py-12 text-center text-gray-500 text-sm">Sin acciones registradas.</div>
        )}
      </div>
    </div>
  )
}
