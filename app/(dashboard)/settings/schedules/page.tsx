import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getActiveOrganizationId, getActiveBranchId } from '@/lib/tenant/context'
import {
  addScheduleBlock, deleteScheduleBlock,
  addDoctorSchedule, deleteDoctorSchedule,
} from '@/app/actions/schedules'

const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

const BLOCK_TYPE_LABELS: Record<string, string> = {
  holiday:  'Feriado',
  vacation: 'Vacaciones',
  meeting:  'Reunión',
  other:    'Otro',
}

const BLOCK_TYPE_COLORS: Record<string, string> = {
  holiday:  'bg-red-100 text-red-700',
  vacation: 'bg-blue-100 text-blue-700',
  meeting:  'bg-yellow-100 text-yellow-700',
  other:    'bg-[#F3F6F9] text-slate',
}

type ScheduleBlock = {
  id: string
  block_date: string
  start_time: string | null
  end_time:   string | null
  reason:     string | null
  block_type: string
  doctor_name: string | null
}

type DoctorSchedule = {
  id:          string
  day_of_week: number
  start_time:  string
  end_time:    string
  professional_id: string | null
  doctor_name: string | null
  professionals: { id: string; name: string; color: string } | null
}

type Professional = {
  id:    string
  name:  string
  color: string
}

export default async function SchedulesPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>
}) {
  const { saved } = await searchParams

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const organizationId = await getActiveOrganizationId()
  const branchId       = await getActiveBranchId()
  if (!organizationId || !branchId) redirect('/clinic-selector')

  const sb = supabase as any
  const today = new Date().toISOString().split('T')[0]

  const [blocksRes, schedulesRes, prosRes] = await Promise.all([
    sb
      .from('schedule_blocks')
      .select('id, block_date, start_time, end_time, reason, block_type, doctor_name')
      .eq('organization_id', organizationId)
      .eq('branch_id', branchId)
      .gte('block_date', today)
      .order('block_date', { ascending: true }),
    sb
      .from('doctor_schedules')
      .select('id, day_of_week, start_time, end_time, professional_id, doctor_name, professionals(id, name, color)')
      .eq('organization_id', organizationId)
      .eq('branch_id', branchId)
      .eq('is_active', true)
      .order('day_of_week'),
    sb
      .from('professionals')
      .select('id, name, color')
      .eq('organization_id', organizationId)
      .eq('branch_id', branchId)
      .eq('is_active', true)
      .order('name'),
  ])

  const blocks: ScheduleBlock[]     = blocksRes.data    ?? []
  const schedules: DoctorSchedule[] = schedulesRes.data ?? []
  const professionals: Professional[] = prosRes.data    ?? []

  // Group schedules by professional
  const byPro: Record<string, { pro: { name: string; color: string } | null; rows: DoctorSchedule[] }> = {}
  for (const s of schedules) {
    const key   = s.professional_id ?? s.doctor_name ?? '—'
    const label = s.professionals ?? (s.doctor_name ? { name: s.doctor_name, color: '#6b7280' } : null)
    if (!byPro[key]) byPro[key] = { pro: label, rows: [] }
    byPro[key].rows.push(s)
  }

  // Weekly grid: for each professional, which days/hours they work
  const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

  return (
    <div className="max-w-3xl mx-auto space-y-8">

      <div>
        <h1 className="text-2xl font-bold text-ink">Horarios y bloqueos</h1>
        <p className="text-sm text-slate mt-1">
          Define la disponibilidad del equipo y bloquea fechas específicas.
        </p>
      </div>

      {/* ── VISTA SEMANAL POR PROFESIONAL ─────────────────── */}
      <section className="rounded-2xl border bg-white p-6 space-y-4">
        <h2 className="text-sm font-semibold text-ink">Vista semanal de disponibilidad</h2>
        {Object.keys(byPro).length === 0 ? (
          <p className="text-xs text-slate py-1">
            No hay horarios configurados todavía. Agrégalos en la sección <span className="font-medium text-ink">Horarios regulares</span> más abajo.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr>
                  <th className="text-left text-slate font-medium py-2 pr-4 min-w-[120px]">Profesional</th>
                  {DAYS.map(d => (
                    <th key={d} className="text-center text-slate font-medium py-2 px-2 min-w-[60px]">{d}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.values(byPro).map(({ pro, rows }, i) => {
                  const dayMap: Record<number, string> = {}
                  for (const r of rows) {
                    dayMap[r.day_of_week] = `${r.start_time.slice(0,5)}–${r.end_time.slice(0,5)}`
                  }
                  const color = pro?.color ?? '#6b7280'
                  return (
                    <tr key={i} className="border-t border-fog">
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                          <span className="font-medium text-ink">{pro?.name ?? '—'}</span>
                        </div>
                      </td>
                      {[0,1,2,3,4,5,6].map(d => (
                        <td key={d} className="py-3 px-2 text-center">
                          {dayMap[d]
                            ? <span className="inline-block bg-brand-50 text-brand-700 rounded-lg px-1.5 py-1 font-medium leading-tight">{dayMap[d]}</span>
                            : <span className="text-fog">—</span>
                          }
                        </td>
                      ))}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {saved === '1' && (
        <div className="rounded-xl bg-lima-50 border border-lima-200 px-4 py-3 text-sm text-lima-700 font-medium">
          Guardado correctamente.
        </div>
      )}

      {/* ── BLOQUEOS DE FECHA ──────────────────────────────── */}
      <section className="rounded-2xl border bg-white p-6 space-y-5">
        <div>
          <h2 className="text-sm font-semibold text-ink">Bloqueos de fecha</h2>
          <p className="text-xs text-slate mt-0.5">
            Feriados, vacaciones, reuniones — fechas sin atención.
          </p>
        </div>

        {blocks.length > 0 ? (
          <div className="space-y-2">
            {blocks.map((block) => (
              <div key={block.id} className="flex items-center gap-3 p-3 bg-mist rounded-xl">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-ink">{formatDate(block.block_date)}</span>
                    {block.start_time && block.end_time && (
                      <span className="text-xs text-slate">
                        {block.start_time.slice(0, 5)} – {block.end_time.slice(0, 5)}
                      </span>
                    )}
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${BLOCK_TYPE_COLORS[block.block_type] ?? 'bg-[#F3F6F9] text-slate'}`}>
                      {BLOCK_TYPE_LABELS[block.block_type] ?? block.block_type}
                    </span>
                    {block.doctor_name && (
                      <span className="text-xs text-slate">· {block.doctor_name}</span>
                    )}
                  </div>
                  {block.reason && (
                    <p className="text-xs text-slate mt-0.5 truncate">{block.reason}</p>
                  )}
                </div>
                <form action={deleteScheduleBlock}>
                  <input type="hidden" name="id" value={block.id} />
                  <button
                    type="submit"
                    className="text-xs text-red-400 hover:text-red-600 transition-colors px-2 py-1 rounded-lg hover:bg-red-50"
                  >
                    Eliminar
                  </button>
                </form>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate py-1">No hay bloqueos próximos.</p>
        )}

        {/* Add block form */}
        <form action={addScheduleBlock} className="space-y-3 pt-4 border-t border-fog">
          <p className="text-[11px] font-semibold text-slate uppercase tracking-widest">Agregar bloqueo</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate mb-1">Fecha *</label>
              <input name="block_date" type="date" min={today} required className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate mb-1">Tipo</label>
              <select name="block_type" className={inputCls}>
                <option value="holiday">Feriado</option>
                <option value="vacation">Vacaciones</option>
                <option value="meeting">Reunión</option>
                <option value="other">Otro</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate mb-1">Hora inicio (opcional)</label>
              <input name="start_time" type="time" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate mb-1">Hora fin (opcional)</label>
              <input name="end_time" type="time" className={inputCls} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate mb-1">Motivo</label>
              <input name="reason" type="text" placeholder="Ej: Día del Trabajo" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate mb-1">Profesional</label>
              {professionals.length > 0 ? (
                <select name="doctor_name" className={inputCls}>
                  <option value="">Toda la clínica</option>
                  {professionals.map(p => (
                    <option key={p.id} value={p.name}>{p.name}</option>
                  ))}
                </select>
              ) : (
                <input name="doctor_name" type="text" placeholder="Vacío = toda la clínica" className={inputCls} />
              )}
            </div>
          </div>
          <button
            type="submit"
            className="w-full bg-brand-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-brand-700 transition-colors"
          >
            Agregar bloqueo
          </button>
        </form>
      </section>

      {/* ── HORARIOS REGULARES ─────────────────────────────── */}
      <section className="rounded-2xl border bg-white p-6 space-y-5">
        <div>
          <h2 className="text-sm font-semibold text-ink">Horarios regulares</h2>
          <p className="text-xs text-slate mt-0.5">
            Disponibilidad semanal recurrente por profesional.
          </p>
        </div>

        {Object.keys(byPro).length > 0 ? (
          <div className="space-y-5">
            {Object.entries(byPro).map(([key, { pro, rows }]) => (
              <div key={key}>
                <div className="flex items-center gap-2 mb-2">
                  {pro && (
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: pro.color }}
                    />
                  )}
                  <p className="text-xs text-[11px] font-semibold text-slate uppercase tracking-[0.06em]">{pro?.name ?? key}</p>
                </div>
                <div className="space-y-1.5">
                  {rows.map((row) => (
                    <div key={row.id} className="flex items-center gap-3 px-3 py-2 bg-mist rounded-lg">
                      <span className="text-xs font-medium text-slate w-20 shrink-0">
                        {DAY_NAMES[row.day_of_week]}
                      </span>
                      <span className="text-xs text-slate flex-1">
                        {row.start_time.slice(0, 5)} – {row.end_time.slice(0, 5)}
                      </span>
                      <form action={deleteDoctorSchedule}>
                        <input type="hidden" name="id" value={row.id} />
                        <button
                          type="submit"
                          className="text-xs text-red-400 hover:text-red-600 transition-colors px-2 py-1 rounded hover:bg-red-50"
                        >
                          Eliminar
                        </button>
                      </form>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate py-1">No hay horarios configurados.</p>
        )}

        {/* Add schedule form */}
        <form action={addDoctorSchedule} className="space-y-3 pt-4 border-t border-fog">
          <p className="text-[11px] font-semibold text-slate uppercase tracking-widest">Agregar horario</p>

          {professionals.length === 0 ? (
            <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
              Primero agrega profesionales en{' '}
              <a href="/settings/professionals" className="font-semibold underline">
                Ajustes → Profesionales
              </a>
              .
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate mb-1">Profesional *</label>
                  <select name="professional_id" required className={inputCls}>
                    <option value="">— Seleccionar —</option>
                    {professionals.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate mb-1">Día *</label>
                  <select name="day_of_week" required className={inputCls}>
                    {DAY_NAMES.map((name, i) => (
                      <option key={i} value={i}>{name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate mb-1">Hora inicio *</label>
                  <input name="start_time" type="time" required className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate mb-1">Hora fin *</label>
                  <input name="end_time" type="time" required className={inputCls} />
                </div>
              </div>
              <button
                type="submit"
                className="w-full bg-brand-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-brand-700 transition-colors"
              >
                Agregar horario
              </button>
            </>
          )}
        </form>
      </section>

    </div>
  )
}

const inputCls = 'w-full border border-fog rounded-xl px-3 py-2 text-sm text-ink placeholder-slate focus:outline-none focus:ring-2 focus:ring-brand-300'

function formatDate(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('es-PE', {
    weekday: 'short', day: 'numeric', month: 'short',
  })
}
