'use client'
import { useEffect }                              from 'react'
import { useRouter }                              from 'next/navigation'
import { callPatient, markDone, removeFromQueue } from '@/app/actions/waiting-room'
import type { QueueEntry }                        from './page'

function elapsed(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000)
  return mins < 1 ? 'Ahora mismo' : `${mins} min`
}

export default function WaitingRoomClient({ queue }: { queue: QueueEntry[] }) {
  const router = useRouter()

  useEffect(() => {
    const id = setInterval(() => router.refresh(), 30_000)
    return () => clearInterval(id)
  }, [router])

  const waiting = queue.filter(e => e.status === 'waiting')
  const called  = queue.filter(e => e.status === 'called')

  return (
    <div className="space-y-6 max-w-2xl">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink">Sala de Espera</h1>
          <p className="text-sm text-slate mt-0.5">
            {queue.length} paciente{queue.length !== 1 ? 's' : ''} en cola · actualiza cada 30s
          </p>
        </div>
        <button
          onClick={() => router.refresh()}
          className="text-xs text-brand-600 hover:text-brand-700 font-medium px-3 py-1.5 border border-brand-200 rounded-lg transition-colors"
        >
          Refrescar
        </button>
      </div>

      {/* Empty state */}
      {queue.length === 0 && (
        <div className="rounded-xl border border-fog bg-white px-4 py-16 text-center text-sm text-slate">
          Sin pacientes en espera.<br />
          <span className="text-xs">Cuando escaneen el QR de recepción aparecerán aquí.</span>
        </div>
      )}

      {/* Called — in transit */}
      {called.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide mb-2">
            Llamados — en camino
          </p>
          <div className="space-y-2">
            {called.map(e => (
              <div key={e.id} className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-ink">{e.patient_name}</p>
                  <p className="text-xs text-slate">{e.treatment_type ?? 'Sin tratamiento especificado'}</p>
                </div>
                <form action={markDone.bind(null, e.id)}>
                  <button
                    type="submit"
                    className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-3 py-1.5 rounded-lg transition-colors"
                  >
                    Listo ✓
                  </button>
                </form>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Waiting queue */}
      {waiting.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate uppercase tracking-wide mb-2">
            Esperando · {waiting.length} paciente{waiting.length !== 1 ? 's' : ''}
          </p>
          <div className="space-y-2">
            {waiting.map((e, i) => (
              <div
                key={e.id}
                className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${
                  i === 0
                    ? 'border-brand-200 bg-brand-50'
                    : 'border-fog bg-white'
                }`}
              >
                {/* Position */}
                <span className={`text-lg font-bold w-8 text-center shrink-0 ${i === 0 ? 'text-brand-600' : 'text-slate'}`}>
                  #{i + 1}
                </span>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-ink">{e.patient_name}</p>
                  <p className="text-xs text-slate">
                    {e.treatment_type ?? 'Sin tratamiento especificado'} · {elapsed(e.entered_at)}
                  </p>
                </div>

                {/* Actions */}
                <div className="shrink-0 flex items-center gap-2">
                  <form action={callPatient.bind(null, e.id)}>
                    <button
                      type="submit"
                      className="text-xs bg-brand-600 hover:bg-brand-700 text-white font-semibold px-3 py-1.5 rounded-lg transition-colors"
                    >
                      Llamar
                    </button>
                  </form>
                  <form action={removeFromQueue.bind(null, e.id)}>
                    <button
                      type="submit"
                      className="text-xs text-slate hover:text-red-600 transition-colors px-2 py-1.5"
                      title="Quitar de la lista"
                    >
                      ✕
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  )
}
