'use client'

import { useActionState }    from 'react'
import { useSearchParams }   from 'next/navigation'
import { Suspense }          from 'react'
import {
  createOrganization,
  createBranch,
  markWhatsAppConnected,
  markFirstFlowActive,
} from '@/app/actions/onboarding'

// ── Step indicator ─────────────────────────────────────────────────────────

const STEPS = [
  { n: 1, label: 'Tu clínica' },
  { n: 2, label: 'Sucursal' },
  { n: 3, label: 'WhatsApp' },
  { n: 4, label: 'Listo' },
]

function StepBar({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-2 mb-8">
      {STEPS.map((s, i) => (
        <div key={s.n} className="flex items-center gap-2">
          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border
            ${current === s.n
              ? 'bg-brand-600 border-brand-500 text-white'
              : current > s.n
                ? 'bg-green-600 border-green-500 text-white'
                : 'bg-gray-800 border-gray-700 text-gray-500'}`}>
            {current > s.n ? '✓' : s.n}
          </div>
          <span className={`text-xs font-medium hidden sm:block
            ${current === s.n ? 'text-white' : current > s.n ? 'text-green-400' : 'text-gray-600'}`}>
            {s.label}
          </span>
          {i < STEPS.length - 1 && (
            <div className={`h-px w-6 sm:w-10 ${current > s.n ? 'bg-green-600' : 'bg-gray-800'}`} />
          )}
        </div>
      ))}
    </div>
  )
}

// ── Input helpers ──────────────────────────────────────────────────────────

function Field({ label, name, type = 'text', placeholder, required, children }: {
  label: string; name: string; type?: string
  placeholder?: string; required?: boolean; children?: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={name} className="block text-sm font-medium text-gray-300">
        {label}{required && <span className="text-brand-400 ml-0.5">*</span>}
      </label>
      {children ?? (
        <input
          id={name} name={name} type={type} placeholder={placeholder}
          required={required}
          className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white
                     placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
        />
      )}
    </div>
  )
}

function SubmitButton({ children, pending }: { children: React.ReactNode; pending: boolean }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white font-semibold
                 text-sm px-5 py-3 rounded-xl transition-colors"
    >
      {pending ? 'Guardando...' : children}
    </button>
  )
}

// ── Step 1: Create organization ─────────────────────────────────────────────

function Step1() {
  const [state, action, pending] = useActionState(createOrganization, null)
  return (
    <form action={action} className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-white">Cuéntanos sobre tu clínica</h1>
        <p className="text-sm text-gray-400 mt-1">Esta información configura tu cuenta en PacienteIA.</p>
      </div>

      <Field label="Nombre de la clínica" name="name" placeholder="Ej. Clínica Estética Lumina" required />

      <Field label="Especialidad" name="industry" required>
        <select
          name="industry"
          required
          defaultValue="estetica"
          className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white
                     focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          <option value="estetica">Clínica Estética / Medicina Estética</option>
          <option value="dental">Clínica Dental / Odontología</option>
          <option value="psicologia">Consultorio Psicológico</option>
          <option value="medicina">Consultorio Médico General</option>
        </select>
      </Field>

      <Field label="Teléfono de contacto" name="phone" type="tel" placeholder="+51 999 999 999" />

      {state?.error && (
        <p className="text-sm text-red-400 bg-red-950 rounded-xl px-4 py-2.5 border border-red-900">
          {state.error}
        </p>
      )}

      <SubmitButton pending={pending}>Continuar →</SubmitButton>
    </form>
  )
}

// ── Step 2: Create branch ───────────────────────────────────────────────────

function Step2() {
  const [state, action, pending] = useActionState(createBranch, null)
  return (
    <form action={action} className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-white">Tu primera sucursal</h1>
        <p className="text-sm text-gray-400 mt-1">
          Una sucursal = una ubicación física + un número de WhatsApp.
          Puedes agregar más después.
        </p>
      </div>

      <Field
        label="Nombre de la sucursal"
        name="branch_name"
        placeholder="Ej. Sede Miraflores"
        required
      />

      <div className="grid grid-cols-2 gap-4">
        <Field label="Ciudad" name="city" placeholder="Lima" required />
        <Field label="Teléfono WhatsApp" name="phone" type="tel" placeholder="+51 999 999 999" />
      </div>

      <Field label="Dirección" name="address" placeholder="Av. Larco 123, Miraflores" />

      {state?.error && (
        <p className="text-sm text-red-400 bg-red-950 rounded-xl px-4 py-2.5 border border-red-900">
          {state.error}
        </p>
      )}

      <SubmitButton pending={pending}>Continuar →</SubmitButton>
    </form>
  )
}

// ── Step 3: WhatsApp connection ─────────────────────────────────────────────

function Step3() {
  const [, action, pending] = useActionState(markWhatsAppConnected, null)
  return (
    <form action={action} className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-white">Conecta WhatsApp</h1>
        <p className="text-sm text-gray-400 mt-1">
          PacienteIA usa la API oficial de WhatsApp Business para enviar confirmaciones,
          recordatorios y reactivaciones automáticamente.
        </p>
      </div>

      <div className="bg-gray-900 rounded-xl border border-gray-800 p-5 space-y-4">
        <p className="text-sm font-semibold text-gray-200">Pasos para conectar:</p>
        <ol className="space-y-3 text-sm text-gray-400 list-decimal list-inside">
          <li>Crea una cuenta en <strong className="text-white">Meta Business Suite</strong></li>
          <li>Activa <strong className="text-white">WhatsApp Business API</strong> para tu número</li>
          <li>Genera un <strong className="text-white">Access Token permanente</strong></li>
          <li>
            Envía las credenciales a{' '}
            <a href="mailto:soporte@pacienteia.com" className="text-brand-400 hover:underline">
              soporte@pacienteia.com
            </a>{' '}
            — las configuramos en menos de 24 horas
          </li>
        </ol>
      </div>

      <div className="bg-amber-950 border border-amber-900 rounded-xl px-4 py-3 text-sm text-amber-300">
        Si ya tienes tu número configurado, haz clic en <strong>Continuar</strong> y
        coordina con nuestro equipo para activar la integración.
      </div>

      <SubmitButton pending={pending}>Continuar →</SubmitButton>
    </form>
  )
}

// ── Step 4: All done ────────────────────────────────────────────────────────

function Step4() {
  const [, action, pending] = useActionState(markFirstFlowActive, null)
  return (
    <form action={action} className="space-y-5 text-center">
      <div className="text-6xl">🎉</div>
      <div>
        <h1 className="text-2xl font-bold text-white">¡Todo listo!</h1>
        <p className="text-sm text-gray-400 mt-2 max-w-sm mx-auto">
          Tu clínica está configurada. Entra al dashboard para comenzar a gestionar
          pacientes, citas y leads desde un solo lugar.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3 text-center text-sm">
        {[
          { icon: '📋', label: 'Gestiona leads y citas' },
          { icon: '💬', label: 'WhatsApp automatizado' },
          { icon: '📊', label: 'Dashboard de resultados' },
        ].map((f) => (
          <div key={f.label} className="bg-gray-900 rounded-xl p-4 border border-gray-800">
            <p className="text-2xl mb-2">{f.icon}</p>
            <p className="text-xs text-gray-400 leading-tight">{f.label}</p>
          </div>
        ))}
      </div>

      <SubmitButton pending={pending}>Ir al dashboard →</SubmitButton>
    </form>
  )
}

// ── Page controller (reads ?step from URL) ─────────────────────────────────

function OnboardingContent() {
  const params = useSearchParams()
  const step   = Number(params.get('step') ?? '1')

  return (
    <div className="w-full max-w-md space-y-6">
      <StepBar current={step} />
      {step === 1 && <Step1 />}
      {step === 2 && <Step2 />}
      {step === 3 && <Step3 />}
      {step === 4 && <Step4 />}
    </div>
  )
}

export default function OnboardingPage() {
  return (
    <Suspense>
      <OnboardingContent />
    </Suspense>
  )
}
