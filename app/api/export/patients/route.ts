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
  const { data: patients, error } = await sb
    .from('patients')
    .select('full_name, phone, email, dni, status, last_visit_date, retention_score, created_at')
    .eq('organization_id', ctx.organizationId)
    .is('deleted_at', null)
    .order('full_name')

  if (error) return NextResponse.json({ error: 'db_error' }, { status: 500 })

  const header = row(['Nombre', 'Teléfono', 'Email', 'DNI', 'Estado', 'Última visita', 'Score retención', 'Registrado'])
  const lines  = (patients ?? []).map((p: any) =>
    row([
      p.full_name,
      p.phone,
      p.email,
      p.dni,
      p.status,
      p.last_visit_date,
      p.retention_score,
      p.created_at ? new Date(p.created_at).toLocaleDateString('es-PE') : '',
    ])
  )

  const csv = [header, ...lines].join('\r\n')
  const date = new Date().toISOString().slice(0, 10)

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="pacientes_${date}.csv"`,
    },
  })
}
