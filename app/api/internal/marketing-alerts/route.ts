import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient }         from '@/lib/supabase/admin'
import { checkMarketingAlert }        from '@/lib/analytics/marketing'
import { sendWhatsAppText }           from '@/lib/whatsapp/send'

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any

  // Fetch all active orgs that have ad_spend entries (opted in to this feature)
  const { data: orgs } = await sb
    .from('organizations')
    .select('id, name')
    .is('deleted_at', null)

  const results: { org: string; alerted: boolean }[] = []

  for (const org of (orgs ?? [])) {
    const { data: branch } = await sb
      .from('branches')
      .select('id')
      .eq('organization_id', org.id)
      .is('deleted_at', null)
      .order('created_at')
      .limit(1)
      .single()

    if (!branch) continue

    // Only process orgs that have ad spend data
    const { data: hasSpend } = await sb
      .from('ad_spend')
      .select('id')
      .eq('organization_id', org.id)
      .limit(1)
      .single()

    if (!hasSpend) continue

    const { shouldAlert, alertType, kpis } = await checkMarketingAlert(org.id, branch.id)

    if (!shouldAlert) {
      results.push({ org: org.name, alerted: false })
      continue
    }

    // Log the alert
    const { data: alert } = await sb
      .from('marketing_alerts')
      .insert({
        organization_id: org.id,
        alert_type:      alertType,
        cpl_current:     kpis.cpl7d,
        cpl_baseline:    kpis.cpl30d ?? kpis.cpl7d,
        conversion_rate: kpis.confirmationRate7d,
        new_leads_count: kpis.newLeads7d,
        message_sent:    false,
      })
      .select('id')
      .single()

    // Send WhatsApp alert to owner
    const { data: ownerMember } = await sb
      .from('org_members')
      .select('user_id')
      .eq('organization_id', org.id)
      .eq('role', 'owner')
      .eq('status', 'active')
      .single()

    if (ownerMember) {
      const { data: waConfig } = await sb
        .from('branch_whatsapp_config')
        .select('phone_number_id, access_token_enc, display_name')
        .eq('organization_id', org.id)
        .eq('branch_id', branch.id)
        .eq('status', 'active')
        .single()

      const { data: ownerProfile } = await sb
        .from('org_members')
        .select('whatsapp_phone')
        .eq('organization_id', org.id)
        .eq('role', 'owner')
        .single()

      if (waConfig && ownerProfile?.whatsapp_phone) {
        const cplLine = kpis.cpl7d
          ? `CPL esta semana: S/ ${kpis.cpl7d.toFixed(0)} (base: S/ ${(kpis.cpl30d ?? kpis.cpl7d).toFixed(0)})`
          : ''
        const convLine = `Tasa de confirmación: ${kpis.confirmationRate7d.toFixed(0)}%`
        const msg = `⚠️ *Alerta de marketing — ${org.name}*\n\n` +
          `Tu inversión en anuncios puede no estar convirtiendo bien:\n` +
          `${cplLine ? `• ${cplLine}\n` : ''}` +
          `• ${convLine}\n\n` +
          `Posible causa: leads sin respuesta rápida del staff.\n` +
          `Revisa la bandeja de entrada: app.pacienteia.com/inbox`

        try {
          await sendWhatsAppText({
            branchId: branch.id,
            to:       ownerProfile.whatsapp_phone,
            body:     msg,
          })
          if (alert?.id) {
            await sb.from('marketing_alerts').update({ message_sent: true }).eq('id', alert.id)
          }
        } catch {
          // non-fatal
        }
      }
    }

    results.push({ org: org.name, alerted: true })
  }

  return NextResponse.json({ ok: true, results })
}
