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
  if (days === null) return 'text-slate'
  if (days <= 0)  return 'text-red-600 font-bold'
  if (days <= 3)  return 'text-red-600 font-semibold'
  if (days <= 7)  return 'text-amber-600 font-semibold'
  if (days <= 14) return 'text-yellow-400'
  return 'text-slate'
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
          <h1 className="text-2xl font-bold text-ink">Trials</h1>
          <p className="text-sm text-slate mt-0.5">
            {trials.length} clínicas en período de prueba
          </p>
        </div>
        <div className="flex gap-3 flex-wrap">
          {expired  > 0 && <Pill label="Expirados"  value={expired}  color="bg-red-50 text-red-700 border-red-200" />}
          {critical > 0 && <Pill label="≤3 días"    value={critical} color="bg-amber-50 text-amber-700 border-amber-200" />}
          {week     > 0 && <Pill label="≤7 días"    value={week}     color="bg-yellow-900 text-yellow-300 border-yellow-800" />}
        </div>
      </div>

      <div className="rounded-xl border border-fog bg-white overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[600px]">
          <thead>
            <tr className="border-b border-fog text-left">
              <th className="px-4 py-3 text-[11px] font-semibold text-slate uppercase tracking-[0.06em]">Clínica</th>
              <th className="px-4 py-3 text-[11px] font-semibold text-slate uppercase tracking-[0.06em]">Días restantes</th>
              <th className="px-4 py-3 text-[11px] font-semibold text-slate uppercase tracking-[0.06em] hidden sm:table-cell">Expira</th>
              <th className="px-4 py-3 text-[11px] font-semibold text-slate uppercase tracking-[0.06em] hidden md:table-cell">Plan</th>
              <th className="px-4 py-3 text-[11px] font-semibold text-slate uppercase tracking-[0.06em] hidden md:table-cell">Miembros</th>
              <th className="px-4 py-3 text-[11px] font-semibold text-slate uppercase tracking-[0.06em]">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-fog">
            {trials.map((t) => {
              const days = daysLeft(t.trial_ends_at)
              const ext7  = extendTrial.bind(null, t.id, t.name, 7)
              const ext14 = extendTrial.bind(null, t.id, t.name, 14)
              const ext30 = extendTrial.bind(null, t.id, t.name, 30)
              return (
                <tr key={t.id} className="hover:bg-mist transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-ink">{t.name}</p>
                    <p className="text-xs text-slate font-mono">{t.slug}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={urgencyStyle(days)}>{urgencyLabel(days)}</span>
                  </td>
                  <td className="px-4 py-3 text-slate text-xs hidden sm:table-cell">
                    {t.trial_ends_at
                      ? new Date(t.trial_ends_at).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-slate capitalize hidden md:table-cell">{t.plan ?? '—'}</td>
                  <td className="px-4 py-3 text-slate tabular-nums hidden md:table-cell">{t.memberCount}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <form action={ext7}>
                        <button type="submit" className="px-2 py-1 bg-brand-50 hover:bg-brand-100 text-brand-700 text-xs font-semibold rounded transition-colors">+7d</button>
                      </form>
                      <form action={ext14}>
                        <button type="submit" className="px-2 py-1 bg-brand-50 hover:bg-brand-100 text-brand-700 text-xs font-semibold rounded transition-colors">+14d</button>
                      </form>
                      <form action={ext30}>
                        <button type="submit" className="px-2 py-1 bg-brand-50 hover:bg-brand-100 text-brand-700 text-xs font-semibold rounded transition-colors hidden sm:block">+30d</button>
                      </form>
                      <Link href={`/platform/tenants/${t.id}`} className="px-2 py-1 bg-mist hover:bg-[#EEF0F3] text-slate text-xs font-semibold rounded transition-colors">
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
          <div className="px-4 py-12 text-center text-slate text-sm">
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
