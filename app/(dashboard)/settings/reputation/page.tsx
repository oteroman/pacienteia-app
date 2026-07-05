import { createClient }      from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getActiveContext }  from '@/lib/tenant/context'
import { redirect }          from 'next/navigation'
import { revalidatePath }    from 'next/cache'
import Link                  from 'next/link'

async function disconnect(organizationId: string) {
  'use server'
  const sb = createAdminClient() as any
  await sb.from('google_business_connections').delete().eq('organization_id', organizationId)
  revalidatePath('/settings/reputation')
}

export default async function ReputationSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const ctx = await getActiveContext()
  if (!ctx?.organizationId) redirect('/org-selector')

  const sp = await searchParams

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any

  const { data: conn } = await sb
    .from('google_business_connections')
    .select('location_name, connected_at, last_review_at')
    .eq('organization_id', ctx.organizationId)
    .single()

  const { data: recentReviews } = await sb
    .from('google_review_events')
    .select('review_id, rating, reviewer_name, comment, review_time, task_id')
    .eq('organization_id', ctx.organizationId)
    .order('review_time', { ascending: false })
    .limit(10)

  const disconnectAction = disconnect.bind(null, ctx.organizationId)

  const isConfigured = !!(process.env.GOOGLE_OAUTH_CLIENT_ID)

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-ink">Reputación — Google Business</h1>
        <p className="text-sm text-slate mt-1">
          Conecta tu perfil de Google Business para detectar reseñas nuevas automáticamente
          y recibir respuestas sugeridas por IA en el Copiloto.
        </p>
      </div>

      {/* Success / error banners */}
      {sp.connected === 'true' && (
        <div className="bg-lima-50 border border-lima-200 rounded-xl px-4 py-3 text-sm text-lima-700">
          ✓ Google Business conectado exitosamente. El sistema detectará nuevas reseñas automáticamente.
        </div>
      )}
      {sp.error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
          {errorLabel(sp.error)}
        </div>
      )}

      {/* Connection card */}
      <div className="bg-white rounded-2xl border border-fog shadow-xs p-6 space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-ink">Google Business Profile</p>
            <p className="text-xs text-slate mt-0.5">
              Reseñas negativas (≤ 3★) generan una tarea en el Copiloto con respuesta sugerida por IA.
            </p>
          </div>
          {conn ? (
            <span className="flex-shrink-0 text-xs font-medium bg-lima-100 text-lima-700 px-2.5 py-1 rounded-full">
              Conectado
            </span>
          ) : (
            <span className="flex-shrink-0 text-xs font-medium bg-[#F3F6F9] text-slate px-2.5 py-1 rounded-full">
              Sin conectar
            </span>
          )}
        </div>

        {conn ? (
          <div className="border-t border-fog pt-4 space-y-3">
            <div className="space-y-1">
              <p className="text-xs text-slate">
                <span className="font-medium text-slate">Ubicación:</span> {conn.location_name}
              </p>
              <p className="text-xs text-slate">
                <span className="font-medium text-slate">Conectado:</span>{' '}
                {new Date(conn.connected_at).toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
              {conn.last_review_at && (
                <p className="text-xs text-slate">
                  <span className="font-medium text-slate">Última reseña procesada:</span>{' '}
                  {new Date(conn.last_review_at).toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
              )}
            </div>
            <form action={disconnectAction}>
              <button
                type="submit"
                className="text-xs text-red-500 hover:text-red-700 transition-colors"
              >
                Desconectar cuenta
              </button>
            </form>
          </div>
        ) : isConfigured ? (
          <div className="border-t border-fog pt-4">
            <a
              href="/api/auth/google-business"
              className="inline-flex items-center gap-2 bg-white border border-fog hover:border-slate
                         text-slate text-sm font-medium px-4 py-2.5 rounded-xl transition-colors shadow-xs"
            >
              <GoogleIcon />
              Conectar con Google
            </a>
            <p className="text-[11px] text-slate mt-2">
              Necesitarás acceso al perfil de Google Business de la clínica.
            </p>
          </div>
        ) : (
          <div className="border-t border-fog pt-4 space-y-2">
            <p className="text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              Pendiente de configuración — agrega las credenciales de Google OAuth en las variables de entorno.
            </p>
            <p className="text-[11px] text-slate leading-relaxed">
              Variables necesarias: <code className="bg-[#F3F6F9] px-1 rounded">GOOGLE_OAUTH_CLIENT_ID</code> y{' '}
              <code className="bg-[#F3F6F9] px-1 rounded">GOOGLE_OAUTH_CLIENT_SECRET</code>.
              Crea las credenciales en{' '}
              <span className="text-slate">Google Cloud Console → APIs → Credenciales → OAuth 2.0</span>.
            </p>
          </div>
        )}
      </div>

      {/* Recent reviews */}
      {recentReviews && recentReviews.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm text-[11px] font-semibold text-slate uppercase tracking-[0.06em]">Reseñas recientes detectadas</h2>
          <div className="space-y-2">
            {(recentReviews as any[]).map((r) => (
              <div
                key={r.review_id}
                className="bg-white rounded-xl border border-fog px-4 py-3 space-y-1"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-bold ${r.rating <= 3 ? 'text-red-600' : 'text-lima-600'}`}>
                      {'⭐'.repeat(r.rating)}
                    </span>
                    <span className="text-xs font-medium text-slate">{r.reviewer_name}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-[10px] text-slate">
                      {new Date(r.review_time).toLocaleDateString('es-PE', { day: 'numeric', month: 'short' })}
                    </span>
                    {r.task_id && (
                      <Link
                        href={`/copilot/tasks/${r.task_id}`}
                        className="text-[10px] font-medium text-brand-600 hover:underline"
                      >
                        Ver tarea →
                      </Link>
                    )}
                  </div>
                </div>
                {r.comment && (
                  <p className="text-xs text-slate leading-relaxed line-clamp-2">"{r.comment}"</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* How it works */}
      <div className="bg-mist rounded-2xl border border-fog p-5 space-y-3">
        <p className="text-xs font-semibold text-slate uppercase tracking-wide">Cómo funciona</p>
        <ol className="space-y-2 text-xs text-slate">
          <li className="flex gap-2"><span className="font-bold text-slate">1.</span> El sistema revisa tus reseñas de Google cada hora automáticamente.</li>
          <li className="flex gap-2"><span className="font-bold text-slate">2.</span> Reseñas de 1-3 estrellas generan una tarea en el Copiloto con la reseña y una respuesta sugerida por IA.</li>
          <li className="flex gap-2"><span className="font-bold text-slate">3.</span> Tu equipo revisa la sugerencia, la ajusta si necesita, y responde desde Google Business Profile.</li>
          <li className="flex gap-2"><span className="font-bold text-slate">4.</span> Reseñas de 4-5 estrellas se registran en el historial pero no generan tarea.</li>
        </ol>
      </div>
    </div>
  )
}

function errorLabel(error: string): string {
  const labels: Record<string, string> = {
    cancelled:        'Autorización cancelada. Inténtalo de nuevo.',
    token_exchange:   'Error al obtener los tokens de Google. Inténtalo de nuevo.',
    no_refresh_token: 'No se recibió el token de refresco. Ve a myaccount.google.com/permissions, revoca el acceso de PacienteIA, y vuelve a conectar.',
    no_accounts:      'No se encontraron cuentas de Google Business asociadas a este Google Account.',
    no_locations:     'La cuenta de Google Business no tiene ubicaciones configuradas.',
    not_configured:   'Las credenciales de Google OAuth no están configuradas en el servidor.',
  }
  return labels[error] ?? `Error: ${error}`
}

function GoogleIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  )
}
