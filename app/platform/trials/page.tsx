import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { extendTrial } from '@/app/actions/platform'

interface Trial {
  id: string
  name: string
  slug: string
  plan: string | null
  trial_ends_at: string | null
  created_at: string
  memberCount: number
}

async function fetchTrials(): Promise<Trial[]> {
  const sb = createAdminClient() as any

  const { data: orgs } = await sb
    .from('organizations')
    .select('id, name, slug, plan, trial_ends_at, created_at')
    .eq('subscription_status', 'trialing')
    .order('trial_ends_at', { ascending: true, nullsFirst: false })

  if (!orgs?.length) return []

  const { data: members } = await sb
    .from('org_members')
    .select('organization_id')

  const countMap: Record<string, number> = {}
  for (const m of (members ?? [])) {
    countMap[m.organization_id] = (countMap[m.organization_id] ?? 0) + 1
  }

  return orgs.map((o: any) => ({ ...o, memberCount: countMap[o.id] ?? 0 }))
}

function daysLeft(iso: string | null) {
  if (!iso) return null
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000)
}

function urgencyStyle(days: number | null) {
  if (days === null) return 'text-gray-400'
  if (days <= 0)  return 'text-red-400 font-bold'
  if (days <= 3)  return 'text-red-400 font-semibold'
  if (days <= 7)  return 'text-amber-400 font-semibold'
  if (days <= 14) return 'text-yellow-400'
  return 'text-gray-400'
}

function urgencyLabel(days: number | null) {
  if (days === null) return '—'
  if (days <= 0) return 'Expirado'
  if (days === 1) return '1 día'
  return `${days} días`
}

export default async function TrialsPage() {
  const trials = await fetchTrials()

  const expired  = trials.filter(t => (daysLeft(t.trial_ends_at) ?? 1) <= 0).length
  const critical = trials.filter(t => { const d = daysLeft(t.trial_ends_at); return d !== null && d > 0 && d <= 3 }).length
  const week     = trials.filter(t => { const d = daysLeft(t.trial_ends_at); return d !== null && d > 3 && d <= 7 }).length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Trials</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {trials.length} clínicas en período de prueba
          </p>
        </div>
        <div className="flex gap-3 flex-wrap">
          {expired  > 0 && <Pill label="Expirados"  value={expired}  color="bg-red-900 text-red-300 border-red-800" />}
          {critical > 0 && <Pill label="≤3 días"    value={critical} color="bg-amber-900 text-amber-300 border-amber-800" />}
          {week     > 0 && <Pill label="≤7 días"    value={week}     color="bg-yellow-900 text-yellow-300 border-yellow-800" />}
        </div>
      </div>

      <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[600px]">
          <thead>
            <tr className="border-b border-gray-800 text-left">
              <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Clínica</th>
              <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Días restantes</th>
              <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase hidden sm:table-cell">Expira</th>
              <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase hidden md:table-cell">Plan</th>
              <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase hidden md:table-cell">Miembros</th>
              <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {trials.map((t) => {
              const days = daysLeft(t.trial_ends_at)
              const ext7  = extendTrial.bind(null, t.id, t.name, 7)
              const ext14 = extendTrial.bind(null, t.id, t.name, 14)
              const ext30 = extendTrial.bind(null, t.id, t.name, 30)
              return (
                <tr key={t.id} className="hover:bg-gray-800/40 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-white">{t.name}</p>
                    <p className="text-xs text-gray-500 font-mono">{t.slug}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={urgencyStyle(days)}>{urgencyLabel(days)}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs hidden sm:table-cell">
                    {t.trial_ends_at
                      ? new Date(t.trial_ends_at).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-300 capitalize hidden md:table-cell">{t.plan ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-300 tabular-nums hidden md:table-cell">{t.memberCount}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <form action={ext7}>
                        <button type="submit" className="px-2 py-1 bg-blue-900 hover:bg-blue-800 text-blue-300 text-xs font-semibold rounded transition-colors">+7d</button>
                      </form>
                      <form action={ext14}>
                        <button type="submit" className="px-2 py-1 bg-blue-900 hover:bg-blue-800 text-blue-300 text-xs font-semibold rounded transition-colors">+14d</button>
                      </form>
                      <form action={ext30}>
                        <button type="submit" className="px-2 py-1 bg-blue-900 hover:bg-blue-800 text-blue-300 text-xs font-semibold rounded transition-colors hidden sm:block">+30d</button>
                      </form>
                      <Link href={`/platform/tenants/${t.id}`} className="px-2 py-1 bg-gray-800 hover:bg-gray-700 text-gray-400 text-xs font-semibold rounded transition-colors">
                        Ver
                      </Link>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        </div>
        {trials.length === 0 && (
          <div className="px-4 py-12 text-center text-gray-500 text-sm">
            Sin clínicas en trial actualmente.
          </div>
        )}
      </div>
    </div>
  )
}

function Pill({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className={`text-center px-3 py-1.5 rounded-lg border text-xs font-bold ${color}`}>
      {value} {label}
    </div>
  )
}
