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
                : 'bg-gray-800 border-gray-700 text-slate'}`}>
            {current > s.n ? '✓' : s.n}
          </div>
          <span className={`text-xs font-medium hidden sm:block
            ${current === s.n ? 'text-white' : current > s.n ? 'text-green-400' : 'text-slate'}`}>
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
      <label htmlFor={name} className="block text-sm font-medium text-fog">
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

function Step1({ industry }: { industry: string }) {
  const [state, action, pending] = useActionState(createOrganization, null)
  return (
    <form action={action} className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-white">Cuéntanos sobre tu clínica</h1>
        <p className="text-sm text-slate mt-1">Esta información configura tu cuenta en PacienteIA.</p>
      </div>

      <Field label="Nombre de la clínica" name="name" placeholder="Ej. Clínica Estética Lumina" required />

      <Field label="Especialidad" name="industry" required>
        <select
          name="industry"
          required
          defaultValue={industry || 'estetica'}
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

function Step2({ industry }: { industry: string }) {
  const [state, action, pending] = useActionState(createBranch, null)
  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="industry" value={industry} />
      <div>
        <h1 className="text-2xl font-bold text-white">Tu primera sucursal</h1>
        <p className="text-sm text-slate mt-1">
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
  return <p className="text-[11px] text-slate">{text}</p>
}

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null
  return <p className="text-[11px] text-red-400">{msg}</p>
}

const SUPPORT_WA = 'https://wa.me/51934123012?text=Hola%2C+necesito+ayuda+para+conectar+mi+WhatsApp+Business+a+PacienteIA'

function Step3({ industry }: { industry: string }) {
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
        <p className="text-sm text-slate mt-1">
          Vincula tu número de WhatsApp Business para que PacienteIA atienda
          automáticamente consultas, confirme citas y haga seguimiento.
        </p>
      </div>

      {/* ── Toggle formulario ───────────────────────────── */}
      {!showForm ? (
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="w-full bg-brand-600 hover:bg-brand-700 text-white font-semibold
                       text-sm px-5 py-3 rounded-xl transition-colors"
          >
            Ingresar credenciales de Meta →
          </button>

          {/* Soporte discreto */}
          <a
            href={SUPPORT_WA}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full border border-gray-700
                       hover:border-green-700 text-slate hover:text-green-400 text-sm
                       font-medium px-5 py-2.5 rounded-xl transition-colors"
          >
            <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
              <path d="M12 0C5.373 0 0 5.373 0 12c0 2.12.554 4.107 1.523 5.828L0 24l6.332-1.51A11.946 11.946 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.818 9.818 0 0 1-5.006-1.37l-.36-.214-3.724.888.913-3.638-.235-.374A9.797 9.797 0 0 1 2.182 12C2.182 6.575 6.575 2.182 12 2.182S21.818 6.575 21.818 12 17.425 21.818 12 21.818z"/>
            </svg>
            ¿Necesitas ayuda? Escríbenos por WhatsApp
          </a>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Webhook URL */}
          <div className="bg-gray-900 rounded-xl border border-gray-700 p-4 space-y-1.5">
            <p className="text-[10px] font-semibold text-slate uppercase tracking-wide">
              URL de webhook — pégala en Meta Business Suite
            </p>
            <p className="text-sm font-mono text-brand-400 break-all select-all">{WEBHOOK_URL}</p>
            <p className="text-[11px] text-slate">
              Meta → WhatsApp → Configuración → Webhooks → URL de devolución de llamada
            </p>
          </div>

          {/* Credentials form */}
          <form action={connectAction} className="space-y-4">
            <input type="hidden" name="industry" value={industry} />

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
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate hover:text-fog transition-colors"
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
        <input type="hidden" name="industry" value={industry} />
        <button
          type="submit"
          disabled={skipping}
          className="w-full text-sm text-slate hover:text-fog py-2 transition-colors disabled:opacity-40"
        >
          {skipping ? 'Redirigiendo...' : 'Conectar después →'}
        </button>
      </form>
    </div>
  )
}

// ── Step 4: All done — rubro-specific ──────────────────────────────────────

const RUBRO_FEATURES: Record<string, { title: string; features: { icon: string; label: string }[] }> = {
  estetica: {
    title: 'Lista para tu clínica estética',
    features: [
      { icon: '💉', label: 'Ciclos de retratamiento por servicio (botox, rellenos)' },
      { icon: '📅', label: 'Recordatorios automáticos 24h y 2h antes' },
      { icon: '⭐', label: 'Encuesta post-cita y escudo de reputación Google' },
    ],
  },
  dental: {
    title: 'Lista para tu clínica dental',
    features: [
      { icon: '🦷', label: 'Seguimiento de controles y limpiezas semestrales' },
      { icon: '📅', label: 'Recordatorios de citas por WhatsApp' },
      { icon: '📋', label: 'Gestión de planes de tratamiento multi-sesión' },
    ],
  },
  psicologia: {
    title: 'Lista para tu consultorio',
    features: [
      { icon: '🧠', label: 'Adherencia al tratamiento: recordatorios sin revelar motivo' },
      { icon: '🔒', label: 'Máxima privacidad: la IA nunca menciona diagnósticos' },
      { icon: '📅', label: 'Sesiones semanales automatizadas' },
    ],
  },
  medicina: {
    title: 'Lista para tu consultorio médico',
    features: [
      { icon: '🩺', label: 'Seguimiento de pacientes crónicos' },
      { icon: '📅', label: 'Recordatorios de controles preventivos' },
      { icon: '💬', label: 'Confirmación automática de citas por WhatsApp' },
    ],
  },
}

function Step4({ industry }: { industry: string }) {
  const [, action, pending] = useActionState(markFirstFlowActive, null)
  const info = RUBRO_FEATURES[industry] ?? RUBRO_FEATURES.estetica
  return (
    <form action={action} className="space-y-5 text-center">
      <div className="text-6xl">🎉</div>
      <div>
        <h1 className="text-2xl font-bold text-white">¡Todo listo!</h1>
        <p className="text-sm text-slate mt-2 max-w-sm mx-auto">
          {info.title}. Tu dashboard está configurado con los flujos automáticos
          para tu especialidad.
        </p>
      </div>

      <div className="space-y-2 text-left">
        {info.features.map((f) => (
          <div key={f.label} className="flex items-start gap-3 bg-gray-900 rounded-xl p-3.5 border border-gray-800">
            <span className="text-xl shrink-0">{f.icon}</span>
            <p className="text-xs text-fog leading-snug">{f.label}</p>
          </div>
        ))}
      </div>

      <SubmitButton pending={pending}>Ir al dashboard →</SubmitButton>
    </form>
  )
}

// ── Page controller (reads ?step from URL) ─────────────────────────────────

const VALID_INDUSTRIES = ['estetica', 'dental', 'psicologia', 'medicina']

function OnboardingContent() {
  const params    = useSearchParams()
  const step      = Number(params.get('step') ?? '1')
  const industry  = VALID_INDUSTRIES.includes(params.get('industry') ?? '')
    ? (params.get('industry') as string)
    : 'estetica'

  return (
    <div className="w-full max-w-md space-y-6">
      <StepBar current={step} />
      {step === 1 && <Step1 industry={industry} />}
      {step === 2 && <Step2 industry={industry} />}
      {step === 3 && <Step3 industry={industry} />}
      {step === 4 && <Step4 industry={industry} />}
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
