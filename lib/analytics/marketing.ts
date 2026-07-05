import { createAdminClient } from '@/lib/supabase/admin'

export interface MarketingKPIs {
  totalSpend7d:        number
  totalSpend30d:       number
  newLeads7d:          number
  newLeads30d:         number
  cpl7d:               number | null
  cpl30d:              number | null
  confirmationRate7d:  number
  confirmationRate30d: number
}

export interface AdSpendEntry {
  id:            string
  spend_date:    string
  amount_soles:  number
  source:        string
  campaign_name: string | null
  notes:         string | null
  created_at:    string
}

export interface MarketingAlert {
  id:              string
  alert_type:      string
  cpl_current:     number | null
  cpl_baseline:    number | null
  conversion_rate: number | null
  new_leads_count: number | null
  message_sent:    boolean
  created_at:      string
}

export async function fetchMarketingData(organizationId: string, branchId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any

  const date30d = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10)
  const date7d  = new Date(Date.now() - 7  * 86_400_000).toISOString().slice(0, 10)

  const [spendRes, leadsRes, aptsRes, entriesRes, alertsRes] = await Promise.all([
    sb.from('ad_spend')
      .select('spend_date, amount_soles, source')
      .eq('organization_id', organizationId)
      .gte('spend_date', date30d),
    sb.from('intakes')
      .select('id, created_at')
      .eq('organization_id', organizationId)
      .eq('branch_id', branchId)
      .gte('created_at', `${date30d}T00:00:00Z`),
    sb.from('appointments')
      .select('id, status, scheduled_at')
      .eq('organization_id', organizationId)
      .eq('branch_id', branchId)
      .gte('scheduled_at', `${date30d}T00:00:00Z`)
      .is('deleted_at', null),
    sb.from('ad_spend')
      .select('id, spend_date, amount_soles, source, campaign_name, notes, created_at')
      .eq('organization_id', organizationId)
      .order('spend_date', { ascending: false })
      .limit(30),
    sb.from('marketing_alerts')
      .select('id, alert_type, cpl_current, cpl_baseline, conversion_rate, new_leads_count, message_sent, created_at')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })
      .limit(10),
  ])

  const spend30: { spend_date: string; amount_soles: number }[] = spendRes.data ?? []
  const leads30: { id: string; created_at: string }[]           = leadsRes.data ?? []
  const apts30:  { id: string; status: string; scheduled_at: string }[] = aptsRes.data ?? []

  const spend7d = spend30.filter(s => s.spend_date >= date7d)
  const leads7d = leads30.filter(l => l.created_at >= `${date7d}T00:00:00Z`)
  const apts7d  = apts30.filter(a => a.scheduled_at >= `${date7d}T00:00:00Z`)

  const totalSpend7d  = spend7d.reduce((s, r) => s + Number(r.amount_soles), 0)
  const totalSpend30d = spend30.reduce((s, r) => s + Number(r.amount_soles), 0)

  const confirmed7d  = apts7d.filter(a  => ['confirmed', 'completed'].includes(a.status)).length
  const confirmed30d = apts30.filter(a  => ['confirmed', 'completed'].includes(a.status)).length

  const kpis: MarketingKPIs = {
    totalSpend7d,
    totalSpend30d,
    newLeads7d:          leads7d.length,
    newLeads30d:         leads30.length,
    cpl7d:               leads7d.length > 0 && totalSpend7d  > 0 ? totalSpend7d  / leads7d.length  : null,
    cpl30d:              leads30.length > 0 && totalSpend30d > 0 ? totalSpend30d / leads30.length : null,
    confirmationRate7d:  apts7d.length  > 0 ? (confirmed7d  / apts7d.length)  * 100 : 0,
    confirmationRate30d: apts30.length  > 0 ? (confirmed30d / apts30.length) * 100 : 0,
  }

  // Spend grouped by day for chart (last 30 days)
  const spendByDay: Record<string, number> = {}
  for (const s of spend30) {
    spendByDay[s.spend_date] = (spendByDay[s.spend_date] ?? 0) + Number(s.amount_soles)
  }

  return {
    kpis,
    spendByDay,
    entries: (entriesRes.data ?? []) as AdSpendEntry[],
    alerts:  (alertsRes.data  ?? []) as MarketingAlert[],
    date30d,
    date7d,
  }
}

export async function checkMarketingAlert(organizationId: string, branchId: string): Promise<{
  shouldAlert: boolean
  alertType:   string
  kpis:        MarketingKPIs
}> {
  const { kpis } = await fetchMarketingData(organizationId, branchId)

  if (!kpis.cpl7d || kpis.newLeads7d === 0) return { shouldAlert: false, alertType: '', kpis }

  const baseline  = kpis.cpl30d ?? kpis.cpl7d
  const cplSpike  = kpis.cpl7d > baseline * 1.3
  const lowConv   = kpis.confirmationRate7d < 20

  if (!cplSpike && !lowConv) return { shouldAlert: false, alertType: '', kpis }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any
  const { data: recent } = await sb
    .from('marketing_alerts')
    .select('id')
    .eq('organization_id', organizationId)
    .gte('created_at', new Date(Date.now() - 3 * 86_400_000).toISOString())
    .limit(1)

  if (recent?.length > 0) return { shouldAlert: false, alertType: '', kpis }

  const alertType = cplSpike && lowConv ? 'combined' : cplSpike ? 'cpl_spike' : 'low_conversion'
  return { shouldAlert: true, alertType, kpis }
}
