'use client'

import Link             from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense }     from 'react'

function LogoIsotipo() {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="ceGrad" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop stopColor="#5B8BF7" />
          <stop offset="1" stopColor="#7B4FD6" />
        </linearGradient>
      </defs>
      <circle cx="20" cy="20" r="20" fill="url(#ceGrad)" />
      <circle cx="12" cy="14" r="2.5" fill="white" fillOpacity="0.9" />
      <circle cx="28" cy="14" r="2.5" fill="white" fillOpacity="0.9" />
      <circle cx="20" cy="10" r="2" fill="white" fillOpacity="0.7" />
      <circle cx="20" cy="22" r="3" fill="white" />
      <line x1="12" y1="14" x2="20" y2="22" stroke="white" strokeOpacity="0.6" strokeWidth="1.5" />
      <line x1="28" y1="14" x2="20" y2="22" stroke="white" strokeOpacity="0.6" strokeWidth="1.5" />
      <line x1="20" y1="10" x2="20" y2="22" stroke="white" strokeOpacity="0.4" strokeWidth="1.5" />
      <path d="M13 27 Q20 33 27 27" stroke="white" strokeWidth="2" strokeLinecap="round" fill="none" />
    </svg>
  )
}

const COPY: Record<string, { title: string; body: string; retry: string; retryHref: string }> = {
  signup: {
    title:     'Confirma tu email',
    body:      'Te enviamos un enlace de activación. Haz clic en él para continuar con la configuración de tu clínica.',
    retry:     'Volver al registro',
    retryHref: '/login?tab=signup',
  },
  magic: {
    title:     '¡Enlace enviado!',
    body:      'Revisa tu bandeja de entrada. El enlace te iniciará sesión directamente — no necesitas contraseña.',
    retry:     'Volver al inicio',
    retryHref: '/login',
  },
  reset: {
    title:     'Revisa tu email',
    body:      'Si existe una cuenta con ese correo, recibirás un enlace para restablecer tu contraseña.',
    retry:     'Volver al inicio',
    retryHref: '/login',
  },
}

function CheckEmailContent() {
  const params = useSearchParams()
  const email  = params.get('email') ?? ''
  const type   = params.get('type')  ?? 'signup'
  const copy   = COPY[type] ?? COPY.signup

  return (
    <div className="w-full max-w-sm">
      {/* Header */}
      <div className="mb-8 text-center">
        <div className="flex justify-center mb-3">
          <LogoIsotipo />
        </div>
        <h1 className="text-xl font-bold text-ink">{copy.title}</h1>
        {email && (
          <p className="mt-1 text-sm font-medium" style={{ color: '#5B8BF7' }}>{email}</p>
        )}
      </div>

      {/* Card */}
      <div
        className="bg-white rounded-3xl p-8 text-center"
        style={{ boxShadow: '0 8px 32px rgba(91,139,247,0.12), 0 2px 8px rgba(0,0,0,0.06)' }}
      >
        {/* Envelope illustration */}
        <div className="mb-6 flex justify-center">
          <div
            className="w-20 h-20 rounded-2xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #EEF4FF 0%, #F3EEFF 100%)' }}
          >
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="4" y="10" width="32" height="22" rx="3" fill="url(#envGrad)" fillOpacity="0.15" stroke="url(#envGrad)" strokeWidth="1.5"/>
              <path d="M4 14l16 11 16-11" stroke="url(#envGrad)" strokeWidth="1.5" strokeLinecap="round"/>
              <defs>
                <linearGradient id="envGrad" x1="4" y1="10" x2="36" y2="32" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#5B8BF7"/>
                  <stop offset="1" stopColor="#7B4FD6"/>
                </linearGradient>
              </defs>
            </svg>
          </div>
        </div>

        <p className="text-sm text-slate leading-relaxed mb-6">{copy.body}</p>

        {/* Steps */}
        <div className="text-left space-y-3 text-sm text-slate bg-mist rounded-2xl p-4 mb-6">
          <p className="flex items-center gap-2">
            <span className="text-lima-500 font-bold">1.</span>
            Abre el email de <strong>noreply@pacienteia.com</strong>
          </p>
          <p className="flex items-center gap-2">
            <span className="text-lima-500 font-bold">2.</span>
            Haz clic en el enlace del email
          </p>
          <p className="flex items-center gap-2">
            <span className="text-lima-500 font-bold">3.</span>
            Serás redirigido automáticamente
          </p>
        </div>

        <Link
          href={copy.retryHref}
          className="block w-full text-center rounded-xl px-4 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          style={{ background: 'linear-gradient(135deg, #5B8BF7 0%, #7B4FD6 100%)' }}
        >
          {copy.retry}
        </Link>
      </div>

      <p className="mt-6 text-center text-xs text-slate">
        ¿No llegó el email? Revisa tu carpeta de spam o{' '}
        <Link href={copy.retryHref} className="hover:underline" style={{ color: '#5B8BF7' }}>
          intenta de nuevo
        </Link>
        .
      </p>
    </div>
  )
}

export default function CheckEmailPage() {
  return (
    <Suspense>
      <CheckEmailContent />
    </Suspense>
  )
}
