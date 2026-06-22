'use client'

import { useActionState, useState } from 'react'
import { updatePassword }           from './actions'

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.964-7.178Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
    </svg>
  ) : (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
    </svg>
  )
}

function LogoIsotipo() {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="upGrad" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop stopColor="#5B8BF7" />
          <stop offset="1" stopColor="#7B4FD6" />
        </linearGradient>
      </defs>
      <circle cx="20" cy="20" r="20" fill="url(#upGrad)" />
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

export default function UpdatePasswordPage() {
  const [state, formAction, pending] = useActionState(updatePassword, { error: null })
  const [showPass, setShowPass]      = useState(false)
  const [showConf, setShowConf]      = useState(false)

  return (
    <div className="w-full max-w-sm">
      {/* Logo */}
      <div className="mb-8 text-center">
        <div className="flex justify-center mb-3">
          <LogoIsotipo />
        </div>
        <h1 className="text-xl font-bold text-ink">Nueva contraseña</h1>
        <p className="mt-1 text-sm text-slate">Elige una contraseña segura para tu cuenta</p>
      </div>

      {/* Card */}
      <div
        className="bg-white rounded-3xl p-8"
        style={{ boxShadow: '0 8px 32px rgba(91,139,247,0.12), 0 2px 8px rgba(0,0,0,0.06)' }}
      >
        <form action={formAction} className="space-y-5">
          {/* Password */}
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate mb-1.5">
              Nueva contraseña
            </label>
            <div className="relative">
              <input
                id="password"
                name="password"
                type={showPass ? 'text' : 'password'}
                autoComplete="new-password"
                required
                placeholder="Mínimo 8 caracteres"
                className="w-full rounded-xl border border-fog px-4 py-3 pr-11 text-sm
                           focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                           placeholder:text-slate transition"
              />
              <button
                type="button"
                onClick={() => setShowPass(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate hover:text-slate"
              >
                <EyeIcon open={showPass} />
              </button>
            </div>
          </div>

          {/* Confirm */}
          <div>
            <label htmlFor="confirm" className="block text-sm font-medium text-slate mb-1.5">
              Confirmar contraseña
            </label>
            <div className="relative">
              <input
                id="confirm"
                name="confirm"
                type={showConf ? 'text' : 'password'}
                autoComplete="new-password"
                required
                placeholder="Repite tu contraseña"
                className="w-full rounded-xl border border-fog px-4 py-3 pr-11 text-sm
                           focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                           placeholder:text-slate transition"
              />
              <button
                type="button"
                onClick={() => setShowConf(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate hover:text-slate"
              >
                <EyeIcon open={showConf} />
              </button>
            </div>
          </div>

          {state?.error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">
              {state.error}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-xl px-4 py-3 text-sm font-semibold text-white
                       disabled:opacity-60 disabled:cursor-not-allowed transition-opacity"
            style={{ background: 'linear-gradient(135deg, #5B8BF7 0%, #7B4FD6 100%)' }}
          >
            {pending ? 'Actualizando...' : 'Actualizar contraseña'}
          </button>
        </form>
      </div>
    </div>
  )
}
