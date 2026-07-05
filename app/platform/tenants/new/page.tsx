import { createAdminClient } from '@/lib/supabase/admin'
import { createTenant }      from '@/app/actions/platform'

type SearchParams = Promise<{ prospect?: string }>

interface Prospect {
  id:           string
  contact_name: string | null
  clinic_name:  string | null
  email:        string | null
}

async function getProspect(id: string | undefined): Promise<Prospect | null> {
  if (!id) return null
  const sb = createAdminClient() as any
  const { data } = await sb
    .from('sales_prospects')
    .select('id, contact_name, clinic_name, email')
    .eq('id', id)
    .single()
  return data ?? null
}

export default async function NewTenantPage({ searchParams }: { searchParams: SearchParams }) {
  const { prospect: prospectId } = await searchParams
  const prospect = await getProspect(prospectId)

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <p className="text-xs text-slate mb-1">
          ← <a href="/platform/tenants" className="hover:text-slate">Tenants</a>
        </p>
        <h1 className="text-2xl font-bold text-ink">Nueva clínica</h1>
        <p className="text-sm text-slate mt-0.5">
          Crea la organización, la sede principal e invita al propietario.
        </p>
        {prospect && (
          <p className="text-sm text-lima-600 mt-2 font-medium">
            Pre-llenado desde prospecto: {prospect.clinic_name ?? prospect.contact_name ?? prospect.id.slice(0, 8)}
          </p>
        )}
      </div>

      <form action={createTenant} className="space-y-5">
        {prospectId && <input type="hidden" name="prospect_id" value={prospectId} />}

        {/* Organización */}
        <Section title="Organización">
          <Field
            label="Nombre de la clínica"
            name="org_name"
            required
            defaultValue={prospect?.clinic_name ?? ''}
            placeholder="Ej: Clínica La Rosa"
          />
          <Field
            label="Sede principal"
            name="branch_name"
            defaultValue={prospect?.clinic_name ?? ''}
            placeholder="Dejar vacío para usar el nombre de la clínica"
          />
        </Section>

        {/* Propietario */}
        <Section title="Propietario">
          <Field
            label="Email del propietario"
            name="owner_email"
            type="email"
            required
            defaultValue={prospect?.email ?? ''}
            placeholder="owner@clinica.com"
          />
          <p className="text-xs text-slate -mt-2">
            Se enviará una invitación a este correo para acceder a la plataforma.
            Si ya tiene cuenta, se vincula directamente.
          </p>
        </Section>

        {/* Plan */}
        <Section title="Plan y acceso">
          <div>
            <label className="block text-xs font-medium text-slate mb-1.5">
              Plan inicial
            </label>
            <select
              name="plan"
              className="w-full bg-mist border border-fog rounded-lg px-3 py-2 text-sm text-slate focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="trial">Trial (gratis)</option>
              <option value="starter">Starter</option>
              <option value="pro">Pro</option>
              <option value="enterprise">Enterprise</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate mb-1.5">
              Días de trial
            </label>
            <input
              name="trial_days"
              type="number"
              defaultValue="14"
              min="1"
              max="90"
              className="w-28 bg-mist border border-fog rounded-lg px-3 py-2 text-sm text-slate focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
        </Section>

        <div className="pt-2 flex gap-3">
          <button
            type="submit"
            className="px-6 py-2.5 bg-brand-600 hover:bg-brand-700 text-ink text-sm font-semibold rounded-xl transition-colors"
          >
            Crear clínica y enviar invitación →
          </button>
          <a
            href="/platform/tenants"
            className="px-6 py-2.5 border border-fog hover:border-gray-600 text-slate hover:text-slate text-sm font-medium rounded-xl transition-colors"
          >
            Cancelar
          </a>
        </div>
      </form>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-fog bg-white p-5 space-y-4">
      <h2 className="text-sm font-semibold text-slate border-b border-fog pb-3">{title}</h2>
      {children}
    </div>
  )
}

function Field({
  label, name, type = 'text', required, defaultValue, placeholder,
}: {
  label: string; name: string; type?: string
  required?: boolean; defaultValue?: string; placeholder?: string
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate mb-1.5">
        {label} {required && <span className="text-red-600">*</span>}
      </label>
      <input
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="w-full bg-mist border border-fog rounded-lg px-3 py-2 text-sm text-slate placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-500"
      />
    </div>
  )
}
