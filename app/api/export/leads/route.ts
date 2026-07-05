import { NextResponse }        from 'next/server'
import { createClient }        from '@/lib/supabase/server'
import { createAdminClient }   from '@/lib/supabase/admin'
import { getActiveContext }    from '@/lib/tenant/context'
import { isFeatureAllowed }    from '@/lib/plans/gating'

function escapeCSV(v: unknown): string {
  if (v === null || v === undefined) return ''
  const s = String(v)
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"'
  }
  return s
}

function row(cols: unknown[]): string {
  return cols.map(escapeCSV).join(',')
}

const CHANNEL_LABELS: Record<string, string> = {
  whatsapp: 'WhatsApp', instagram: 'Instagram', facebook: 'Facebook',
  call: 'Llamada', webform: 'Web Form', manual: 'Manual', tiktok: 'TikTok',
}

const STATUS_LABELS: Record<string, string> = {
  new: 'Nuevo', in_progress: 'En proceso', resolved: 'Resuelto', dismissed: 'Descartado',
}

const PRIORITY_LABELS: Record<string, string> = {
  high: 'Alta', medium: 'Media', low: 'Baja',
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const ctx = await getActiveContext()
  if (!ctx?.organizationId) return NextResponse.json({ error: 'no_context' }, { status: 400 })

  const allowed = await isFeatureAllowed(ctx.organizationId, 'csv_export')
  if (!allowed) {
    return NextResponse.json(
      { error: 'plan_required', message: 'CSV export requiere plan Pro o superior.' },
      { status: 403 }
    )
  }

  const sb = createAdminClient() as any
  const { data: leads, error } = await sb
    .from('intakes')
    .select('contact_name, contact_phone, contact_email, source_channel, raw_content, normalized_summary, priority, status, detected_intent, created_at, resolved_at')
    .eq('organization_id', ctx.organizationId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: 'db_error' }, { status: 500 })

  const header = row(['Nombre', 'Teléfono', 'Email', 'Canal', 'Mensaje', 'Resumen IA', 'Prioridad', 'Estado', 'Intent', 'Recibido', 'Resuelto'])
  const lines  = (leads ?? []).map((l: any) =>
    row([
      l.contact_name,
      l.contact_phone,
      l.contact_email,
      CHANNEL_LABELS[l.source_channel] ?? l.source_channel,
      l.raw_content,
      l.normalized_summary,
      PRIORITY_LABELS[l.priority] ?? l.priority,
      STATUS_LABELS[l.status] ?? l.status,
      l.detected_intent,
      l.created_at ? new Date(l.created_at).toLocaleDateString('es-PE') : '',
      l.resolved_at ? new Date(l.resolved_at).toLocaleDateString('es-PE') : '',
    ])
  )

  const csv = [header, ...lines].join('\r\n')
  const date = new Date().toISOString().slice(0, 10)

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="leads_${date}.csv"`,
    },
  })
}
