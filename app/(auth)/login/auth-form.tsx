'use client'

import { useState, useTransition, useEffect } from 'react'
import { useActionState }  from 'react'
import { createClient }    from '@/lib/supabase/client'
import { login, signUp, sendMagicLink, resetPassword } from './actions'

// ── Brand identity (matches landing) ────────────────────────────────────────

function LogoIsotipo() {
  return (
    <svg width={44} height={44} viewBox="0 0 40 40" fill="none" aria-hidden>
      <rect width="40" height="40" rx="10" fill="url(#auth-bg)" />
      <line x1="20" y1="12" x2="12" y2="21" stroke="rgba(255,255,255,0.52)" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="20" y1="12" x2="28" y2="21" stroke="rgba(255,255,255,0.52)" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="12" y1="21" x2="28" y2="21" stroke="rgba(255,255,255,0.52)" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="20" cy="12" r="2.8" fill="white" />
      <circle cx="12" cy="21" r="2.8" fill="white" />
      <circle cx="28" cy="21" r="2.8" fill="white" />
      <path d="M11 28 Q20 35 29 28" stroke="white" strokeWidth="2.6" fill="none" strokeLinecap="round" />
      <defs>
        <linearGradient id="auth-bg" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#5B8BF7" />
          <stop offset="100%" stopColor="#7B4FD6" />
        </linearGradient>
      </defs>
    </svg>
  )
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  )
}

// ── Shared input styles ──────────────────────────────────────────────────────

const inputCls =
  'w-full rounded-xl border border-fog px-4 py-3 text-sm text-ink placeholder-slate ' +
  'focus:outline-none focus:ring-2 focus:border-transparent transition-all bg-white ' +
  'focus:ring-[#5B8BF7]/30'

const primaryBtn =
  'w-full py-3 px-6 rounded-xl text-sm font-bold text-white transition-all ' +
  'disabled:opacity-60 disabled:cursor-not-allowed hover:-translate-y-0.5 active:translate-y-0'

const primaryBtnStyle = {
  background: 'linear-gradient(135deg, #5B8BF7 0%, #7B4FD6 100%)',
  boxShadow: '0 8px 20px -4px rgba(91,139,247,0.4)',
}

// ── Mode-specific forms ──────────────────────────────────────────────────────

function LoginForm({ onForgot }: { onForgot: () => void }) {
  const [state, action, pending] = useActionState(login, { error: null })
  const [show, setShow] = useState(false)

  return (
    <form action={action} className="space-y-4">
      <div>
        <label className="block text-xs font-semibold text-slate mb-1.5">Email</label>
        <input name="email" type="email" autoComplete="email" required placeholder="tu@clinica.com" className={inputCls} />
      </div>
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="block text-xs text-[11px] font-semibold text-slate uppercase tracking-[0.06em]">Contraseña</label>
          <button
            type="button"
            onClick={onForgot}
            className="text-xs font-medium hover:underline"
            style={{ color: '#5B8BF7' }}
          >
            ¿Olvidaste tu contraseña?
          </button>
        </div>
        <div className="relative">
          <input
            name="password" type={show ? 'text' : 'password'}
            autoComplete="current-password" required
            className={`${inputCls} pr-12`}
          />
          <button
            type="button" onClick={() => setShow(v => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate hover:text-slate transition-colors p-1"
            aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          >
            {show
              ? <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 4.411m0 0L21 21" /></svg>
              : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
            }
          </button>
        </div>
      </div>
      {state.error && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2.5 border border-red-100">{state.error}</p>}
      <button type="submit" disabled={pending} className={primaryBtn} style={primaryBtnStyle}>
        {pending ? 'Ingresando...' : 'Ingresar →'}
      </button>
    </form>
  )
}

function SignupForm() {
  const [state, action, pending] = useActionState(signUp, { error: null })
  const [show, setShow] = useState(false)

  return (
    <form action={action} className="space-y-4">
      <div>
        <label className="block text-xs font-semibold text-slate mb-1.5">Email</label>
        <input name="email" type="email" autoComplete="email" required placeholder="tu@clinica.com" className={inputCls} />
      </div>
      <div>
        <label className="block text-xs font-semibold text-slate mb-1.5">Contraseña</label>
        <div className="relative">
          <input
            name="password" type={show ? 'text' : 'password'}
            autoComplete="new-password" required placeholder="Mínimo 8 caracteres"
            className={`${inputCls} pr-12`}
          />
          <button
            type="button" onClick={() => setShow(v => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate hover:text-slate transition-colors p-1"
            aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          >
            {show
              ? <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 4.411m0 0L21 21" /></svg>
              : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
            }
          </button>
        </div>
      </div>
      {state.error && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2.5 border border-red-100">{state.error}</p>}
      <button type="submit" disabled={pending} className={primaryBtn} style={primaryBtnStyle}>
        {pending ? 'Creando cuenta...' : 'Crear cuenta gratis →'}
      </button>
      <p className="text-center text-[11px] text-slate">
        Al crear tu cuenta aceptas los{' '}
        <a href="https://pacienteia.com/terminos" target="_blank" rel="noopener noreferrer" className="underline hover:text-slate">Términos de Uso</a>
        {' '}y la{' '}
        <a href="https://pacienteia.com/privacidad" target="_blank" rel="noopener noreferrer" className="underline hover:text-slate">Política de Privacidad</a>
      </p>
    </form>
  )
}

function MagicLinkForm({ onBack }: { onBack: () => void }) {
  const [state, action, pending] = useActionState(sendMagicLink, { error: null })

  if (state.sent) {
    return (
      <div className="text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto text-3xl"
          style={{ background: 'linear-gradient(135deg, #f0f9ff, #f5f0ff)' }}>
          ✉️
        </div>
        <div>
          <p className="font-bold text-ink">¡Enlace enviado!</p>
          <p className="text-sm text-slate mt-1">Revisa tu email y haz clic en el enlace para ingresar. Si no lo ves, revisa la carpeta de spam.</p>
        </div>
        <button onClick={onBack} className="text-sm font-medium hover:underline" style={{ color: '#5B8BF7' }}>
          ← Volver al inicio de sesión
        </button>
      </div>
    )
  }

  return (
    <form action={action} className="space-y-4">
      <div className="text-center">
        <p className="text-sm font-semibold text-ink">Iniciar con enlace mágico</p>
        <p className="text-xs text-slate mt-1">Te enviamos un enlace directo a tu email — sin contraseña</p>
      </div>
      <input name="email" type="email" autoComplete="email" required placeholder="tu@clinica.com" className={inputCls} />
      {state.error && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2.5 border border-red-100">{state.error}</p>}
      <button type="submit" disabled={pending} className={primaryBtn} style={primaryBtnStyle}>
        {pending ? 'Enviando...' : '✉️ Enviar enlace mágico'}
      </button>
      <button type="button" onClick={onBack} className="w-full text-sm text-slate hover:text-slate transition-colors py-1">
        ← Volver
      </button>
    </form>
  )
}

function ForgotForm({ onBack }: { onBack: () => void }) {
  const [state, action, pending] = useActionState(resetPassword, { error: null })

  if (state.sent) {
    return (
      <div className="text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto text-3xl"
          style={{ background: 'linear-gradient(135deg, #f0f9ff, #f5f0ff)' }}>
          🔑
        </div>
        <div>
          <p className="font-bold text-ink">Revisa tu email</p>
          <p className="text-sm text-slate mt-1">Si existe una cuenta con ese email, te enviamos el enlace para restablecer tu contraseña.</p>
        </div>
        <button onClick={onBack} className="text-sm font-medium hover:underline" style={{ color: '#5B8BF7' }}>
          ← Volver al inicio de sesión
        </button>
      </div>
    )
  }

  return (
    <form action={action} className="space-y-4">
      <div className="text-center">
        <p className="text-sm font-semibold text-ink">Recuperar contraseña</p>
        <p className="text-xs text-slate mt-1">Ingresa tu email y te enviamos un enlace para crear una nueva contraseña</p>
      </div>
      <input name="email" type="email" autoComplete="email" required placeholder="tu@clinica.com" className={inputCls} />
      {state.error && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2.5 border border-red-100">{state.error}</p>}
      <button type="submit" disabled={pending} className={primaryBtn} style={primaryBtnStyle}>
        {pending ? 'Enviando...' : 'Enviar enlace de recuperación'}
      </button>
      <button type="button" onClick={onBack} className="w-full text-sm text-slate hover:text-slate transition-colors py-1">
        ← Volver
      </button>
    </form>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────

type Mode = 'login' | 'signup' | 'magic' | 'forgot'

function AuthContent() {
  const [mode, setMode]           = useState<Mode>('login')
  const [oauthLoading, startOAuth] = useTransition()

  // Read ?tab=signup from URL after mount — avoids useSearchParams() BAILOUT on SSR
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('tab') === 'signup') {
      setMode('signup')
    }
  }, [])

  const handleGoogle = () => {
    startOAuth(async () => {
      const supabase = createClient()
      await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=/auth/post-login`,
        },
      })
    })
  }

  const showTabs   = mode === 'login' || mode === 'signup'
  const showSocial = mode === 'login' || mode === 'signup'

  return (
    <div className="w-full max-w-sm">

      {/* ── Logo ── */}
      <div className="flex flex-col items-center mb-8 gap-3">
        <LogoIsotipo />
        <div>
          <p className="text-center font-bold text-xl tracking-tight" style={{ color: '#171717' }}>
            Paciente<span style={{ background: 'linear-gradient(135deg, #5B8BF7, #7B4FD6)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>IA</span>
          </p>
          <p className="text-center text-xs text-slate mt-0.5">
            {mode === 'signup' ? '14 días gratis · Sin tarjeta de crédito' : 'Copiloto IA para tu clínica'}
          </p>
        </div>
      </div>

      {/* ── Card ── */}
      <div className="bg-white rounded-3xl shadow-lg border border-fog p-8" style={{ boxShadow: '0 20px 40px -8px rgba(91,139,247,0.12), 0 4px 12px -2px rgba(0,0,0,0.06)' }}>

        {/* Tab switcher */}
        {showTabs && (
          <div className="flex rounded-xl border border-fog p-1 mb-6 bg-mist">
            {(['login', 'signup'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setMode(t)}
                className="flex-1 py-2 text-xs font-bold rounded-lg transition-all"
                style={mode === t
                  ? { background: 'linear-gradient(135deg, #5B8BF7 0%, #7B4FD6 100%)', color: 'white', boxShadow: '0 2px 8px rgba(91,139,247,0.3)' }
                  : { color: '#737373' }}
              >
                {t === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
              </button>
            ))}
          </div>
        )}

        {/* Google OAuth */}
        {showSocial && (
          <>
            <button
              type="button"
              onClick={handleGoogle}
              disabled={oauthLoading}
              className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl border border-fog bg-white text-sm font-semibold text-slate hover:bg-mist hover:border-fog transition-all disabled:opacity-60 disabled:cursor-not-allowed mb-5"
            >
              <GoogleIcon />
              {oauthLoading ? 'Redirigiendo...' : 'Continuar con Google'}
            </button>

            <div className="flex items-center gap-3 mb-5">
              <div className="flex-1 h-px bg-[#F3F6F9]" />
              <span className="text-[11px] text-fog font-medium">o con email</span>
              <div className="flex-1 h-px bg-[#F3F6F9]" />
            </div>
          </>
        )}

        {/* Forms */}
        {mode === 'login'  && <LoginForm onForgot={() => setMode('forgot')} />}
        {mode === 'signup' && <SignupForm />}
        {mode === 'magic'  && <MagicLinkForm onBack={() => setMode('login')} />}
        {mode === 'forgot' && <ForgotForm onBack={() => setMode('login')} />}

        {/* Magic link option */}
        {mode === 'login' && (
          <div className="mt-5 pt-4 border-t border-fog text-center">
            <button
              type="button"
              onClick={() => setMode('magic')}
              className="text-xs text-slate hover:text-slate transition-colors font-medium"
            >
              ✉️ Ingresar con enlace al email (sin contraseña)
            </button>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="text-center mt-6">
        {(mode === 'login' || mode === 'forgot' || mode === 'magic') ? (
          <p className="text-sm text-slate">
            ¿Sin cuenta?{' '}
            <button onClick={() => setMode('signup')} className="font-semibold hover:underline" style={{ color: '#5B8BF7' }}>
              Empieza gratis
            </button>
          </p>
        ) : (
          <p className="text-sm text-slate">
            ¿Ya tienes cuenta?{' '}
            <button onClick={() => setMode('login')} className="font-semibold hover:underline" style={{ color: '#5B8BF7' }}>
              Inicia sesión
            </button>
          </p>
        )}
        <p className="text-[11px] text-fog mt-3">
          ¿Necesitas ayuda?{' '}
          <a
            href="https://wa.me/51934123012?text=Hola%2C+necesito+ayuda+con+mi+cuenta+de+PacienteIA"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-slate"
          >
            Escríbenos por WhatsApp
          </a>
        </p>
      </div>
    </div>
  )
}

function AuthSkeleton() {
  return (
    <div className="w-full max-w-sm">
      <div className="flex flex-col items-center mb-8 gap-3">
        <div className="w-11 h-11 rounded-[10px] bg-gradient-to-br from-[#5B8BF7] to-[#7B4FD6]" />
        <div className="h-5 w-32 rounded bg-fog animate-pulse" />
      </div>
      <div className="bg-white rounded-3xl border border-fog p-8" style={{ boxShadow: '0 20px 40px -8px rgba(91,139,247,0.12)' }}>
        <div className="h-10 rounded-xl bg-mist animate-pulse mb-6" />
        <div className="h-11 rounded-xl bg-mist animate-pulse mb-4" />
        <div className="space-y-3">
          <div className="h-10 rounded-xl bg-mist animate-pulse" />
          <div className="h-10 rounded-xl bg-mist animate-pulse" />
          <div className="h-11 rounded-xl bg-[#5B8BF7]/20 animate-pulse" />
        </div>
      </div>
    </div>
  )
}

export function AuthForm() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])
  if (!mounted) return <AuthSkeleton />
  return <AuthContent />
}
