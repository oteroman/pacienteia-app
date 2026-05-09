'use client'

import { useActionState, useState } from 'react'
import { useSearchParams }          from 'next/navigation'
import { Suspense }                 from 'react'
import {
  createOrganization,
  createBranch,
  connectWhatsApp,
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

const WEBHOOK_URL = 'https://app.pacienteia.com/api/whatsapp/webhook'

const INPUT_BASE =
  'w-full bg-gray-800 border rounded-xl px-4 py-2.5 text-sm text-white ' +
  'placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500 transition-colors'

function IdInput({
  id, name, placeholder, error, onBlur,
}: {
  id: string; name: string; placeholder: string
  error?: string; onBlur: (v: string) => void
}) {
  return (
    <input
      id={id} name={name} type="text" required
      placeholder={placeholder}
      onBlur={(e) => onBlur(e.target.value)}
      className={`${INPUT_BASE} ${error ? 'border-red-700' : 'border-gray-700'}`}
    />
  )
}

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7
           -1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  ) : (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7
           a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243
           M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29
           M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7
           a10.025 10.025 0 01-4.132 4.411m0 0L21 21" />
    </svg>
  )
}

function FieldHint({ text }: { text: string }) {
  return <p className="text-[11px] text-gray-600">{text}</p>
}

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null
  return <p className="text-[11px] text-red-400">{msg}</p>
}

const SUPPORT_WA = 'https://wa.me/51990180506?text=Hola%2C+necesito+ayuda+para+conectar+mi+WhatsApp+Business+a+PacienteIA'
// Reemplaza este link cuando tengas el video tutorial grabado:
const TUTORIAL_YT = 'https://www.youtube.com/results?search_query=conectar+whatsapp+business+api+meta+credenciales'

function Step3() {
  const [state,    connectAction, connecting] = useActionState(connectWhatsApp,      null)
  const [,         skipAction,    skipping  ] = useActionState(markWhatsAppConnected, null)
  const [showForm,  setShowForm]  = useState(false)
  const [showToken, setShowToken] = useState(false)
  const [errs, setErrs] = useState<Record<string, string>>({})

  function validateId(field: string, value: string) {
    const v = value.trim()
    const msg = !v
      ? 'Este campo es requerido'
      : !/^\d{10,20}$/.test(v)
        ? 'Debe ser un ID numérico (10–20 dígitos)'
        : ''
    setErrs((prev) => ({ ...prev, [field]: msg }))
  }

  function validateToken(value: string) {
    setErrs((prev) => ({ ...prev, access_token: value.trim() ? '' : 'El Access Token es requerido' }))
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-white">Conecta WhatsApp Business</h1>
        <p className="text-sm text-gray-400 mt-1">
          Vincula tu número de WhatsApp Business para que PacienteIA atienda
          automáticamente consultas, confirme citas y haga seguimiento.
        </p>
      </div>

      {/* ── Opciones de ayuda ───────────────────────────── */}
      <div className="grid grid-cols-2 gap-3">

        {/* Opción 1: Tutorial YouTube */}
        <a
          href={TUTORIAL_YT}
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-col gap-1.5 bg-gray-900 border border-gray-700 hover:border-gray-500
                     rounded-xl p-4 transition-colors group"
        >
          <span className="text-xl">▶️</span>
          <span className="text-sm font-semibold text-white group-hover:text-brand-300 transition-colors">
            Ver tutorial
          </span>
          <span className="text-[11px] text-gray-500 leading-snug">
            Cómo obtener credenciales de Meta en 10 minutos
          </span>
        </a>

        {/* Opción 2: Contactar soporte */}
        <a
          href={SUPPORT_WA}
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-col gap-1.5 bg-gray-900 border border-gray-700 hover:border-green-700
                     rounded-xl p-4 transition-colors group"
        >
          <span className="text-xl">💬</span>
          <span className="text-sm font-semibold text-white group-hover:text-green-400 transition-colors">
            Hablar con soporte
          </span>
          <span className="text-[11px] text-gray-500 leading-snug">
            Te ayudamos a configurarlo paso a paso vía WhatsApp
          </span>
        </a>
      </div>

      {/* ── Separador ───────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-gray-800" />
        <span className="text-xs text-gray-600">o si ya tienes las credenciales</span>
        <div className="flex-1 h-px bg-gray-800" />
      </div>

      {/* ── Toggle formulario ───────────────────────────── */}
      {!showForm ? (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="w-full bg-brand-600 hover:bg-brand-700 text-white font-semibold
                     text-sm px-5 py-3 rounded-xl transition-colors"
        >
          Ingresar credenciales →
        </button>
      ) : (
        <div className="space-y-4">
          {/* Webhook URL */}
          <div className="bg-gray-900 rounded-xl border border-gray-700 p-4 space-y-1.5">
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
              URL de webhook — pégala en Meta Business Suite
            </p>
            <p className="text-sm font-mono text-brand-400 break-all select-all">{WEBHOOK_URL}</p>
            <p className="text-[11px] text-gray-600">
              Meta → WhatsApp → Configuración → Webhooks → URL de devolución de llamada
            </p>
          </div>

          {/* Credentials form */}
          <form action={connectAction} className="space-y-4">

            <Field label="Phone Number ID" name="phone_number_id" required>
              <IdInput
                id="phone_number_id" name="phone_number_id"
                placeholder="Ej. 123456789012345"
                error={errs.phone_number_id}
                onBlur={(v) => validateId('phone_number_id', v)}
              />
              <FieldError msg={errs.phone_number_id} />
              <FieldHint text="Meta → WhatsApp → Números de teléfono → columna «ID de número de teléfono»" />
            </Field>

            <Field label="WABA ID (WhatsApp Business Account ID)" name="waba_id" required>
              <IdInput
                id="waba_id" name="waba_id"
                placeholder="Ej. 987654321098765"
                error={errs.waba_id}
                onBlur={(v) => validateId('waba_id', v)}
              />
              <FieldError msg={errs.waba_id} />
              <FieldHint text="Meta → Configuración del negocio → Cuentas de WhatsApp → ID de cuenta" />
            </Field>

            <Field label="Access Token permanente" name="access_token" required>
              <div className="relative">
                <input
                  id="access_token" name="access_token"
                  type={showToken ? 'text' : 'password'}
                  required
                  placeholder="Token generado desde tu usuario del sistema"
                  onBlur={(e) => validateToken(e.target.value)}
                  className={`${INPUT_BASE} pr-10 ${errs.access_token ? 'border-red-700' : 'border-gray-700'}`}
                />
                <button
                  type="button"
                  onClick={() => setShowToken((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                  aria-label={showToken ? 'Ocultar token' : 'Mostrar token'}
                >
                  <EyeIcon open={showToken} />
                </button>
              </div>
              <FieldError msg={errs.access_token} />
              <FieldHint text="Se almacena cifrado con AES-256. Nunca se muestra en texto plano." />
            </Field>

            <Field label="Nombre del número (opcional)" name="display_name">
              <input
                id="display_name" name="display_name" type="text"
                placeholder="Ej. Clínica Lumina — Miraflores"
                className={`${INPUT_BASE} border-gray-700`}
              />
            </Field>

            {state?.error && (
              <p className="text-sm text-red-400 bg-red-950 rounded-xl px-4 py-2.5 border border-red-900">
                {state.error}
              </p>
            )}

            <SubmitButton pending={connecting}>Conectar WhatsApp →</SubmitButton>
          </form>
        </div>
      )}

      {/* Skip option */}
      <form action={skipAction}>
        <button
          type="submit"
          disabled={skipping}
          className="w-full text-sm text-gray-500 hover:text-gray-300 py-2 transition-colors disabled:opacity-40"
        >
          {skipping ? 'Redirigiendo...' : 'Conectar después →'}
        </button>
      </form>
    </div>
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
