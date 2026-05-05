'use client'

import { useActionState } from 'react'
import { login } from './actions'

const initialState = { error: null }

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, initialState)

  return (
    <div className="w-full max-w-sm">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold text-brand-700 tracking-tight">Paciente IA</h1>
        <p className="mt-1 text-sm text-gray-500">Accede a tu clínica</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
        <form action={formAction} className="space-y-5">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm shadow-sm
                         focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent
                         placeholder:text-gray-400"
              placeholder="tu@clinica.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Contraseña
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm shadow-sm
                         focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            />
          </div>

          {state.error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
              {state.error}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white
                       shadow-sm hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500
                       disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            {pending ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>
      </div>
    </div>
  )
}
