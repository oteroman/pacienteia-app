import { NextResponse }      from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getActiveContext }  from '@/lib/tenant/context'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const ctx = await getActiveContext()
    if (!ctx?.organizationId || !ctx?.branchId) {
      return NextResponse.json({ unreadMessages: 0, pendingLeads: 0 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = createAdminClient() as any

    const [convRes, leadsRes] = await Promise.all([
      sb.from('conversations')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', ctx.organizationId)
        .eq('branch_id', ctx.branchId)
        .eq('is_read', false),
      sb.from('intakes')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', ctx.organizationId)
        .eq('branch_id', ctx.branchId)
        .eq('status', 'new'),
    ])

    return NextResponse.json({
      unreadMessages: convRes.count ?? 0,
      pendingLeads:   leadsRes.count ?? 0,
    })
  } catch {
    return NextResponse.json({ unreadMessages: 0, pendingLeads: 0 })
  }
}
