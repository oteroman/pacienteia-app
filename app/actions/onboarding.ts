'use server'

import { redirect }           from 'next/navigation'
import { revalidatePath }      from 'next/cache'
import { createClient }        from '@/lib/supabase/server'
import { createAdminClient }   from '@/lib/supabase/admin'
import { setActiveContext }    from '@/lib/tenant/context'

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
}

// ── Step 1: Create organization ────────────────────────────────────────────

export async function createOrganization(prevState: { error?: string } | null, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const name     = (formData.get('name') as string)?.trim()
  const industry = formData.get('industry') as string
  const phone    = (formData.get('phone') as string)?.trim() || null

  if (!name || name.length < 2)   return { error: 'El nombre de la clínica es requerido' }
  if (!['estetica','dental','psicologia','medicina'].includes(industry))
    return { error: 'Selecciona una especialidad válida' }

  const sb   = createAdminClient() as any
  const slug = slugify(name)

  // Ensure unique slug
  const { data: existing } = await sb.from('organizations').select('id').eq('slug', slug).single()
  const finalSlug = existing ? `${slug}-${Date.now().toString(36)}` : slug

  const { data: org, error } = await sb.from('organizations').insert({
    owner_user_id:      user.id,
    name,
    slug:               finalSlug,
    industry,
    onboarding_status:  'org_created',
    settings:           { contact_phone: phone },
  }).select('id').single()

  if (error) return { error: error.message }

  // Create owner membership
  await sb.from('org_members').insert({
    organization_id: org.id,
    user_id:         user.id,
    role:            'owner',
    status:          'active',
  })

  revalidatePath('/onboarding')
  redirect('/onboarding?step=2')
}

// ── Step 2: Create branch ──────────────────────────────────────────────────

export async function createBranch(prevState: { error?: string } | null, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const sb = createAdminClient() as any

  const { data: org } = await sb.from('organizations')
    .select('id, name')
    .eq('owner_user_id', user.id)
    .is('deleted_at', null)
    .single()

  if (!org) return { error: 'Organización no encontrada' }

  const branchName = (formData.get('branch_name') as string)?.trim()
  const city       = (formData.get('city') as string)?.trim() || 'Lima'
  const address    = (formData.get('address') as string)?.trim() || null
  const phone      = (formData.get('phone') as string)?.trim() || null

  if (!branchName || branchName.length < 2) return { error: 'El nombre de la sucursal es requerido' }

  const slug = slugify(branchName)

  const { data: branch, error } = await sb.from('branches').insert({
    organization_id: org.id,
    name:            branchName,
    slug,
    city,
    address,
    phone,
  }).select('id').single()

  if (error) return { error: error.message }

  await sb.from('organizations')
    .update({ onboarding_status: 'branch_created' })
    .eq('id', org.id)

  // Set active context so the dashboard works after onboarding
  await setActiveContext(org.id, branch.id)

  revalidatePath('/onboarding')
  redirect('/onboarding?step=3')
}

// ── Step 3: Mark WhatsApp connected (manual for now) ──────────────────────

export async function markWhatsAppConnected(_prevState: unknown, _formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const sb = createAdminClient() as any
  await sb.from('organizations')
    .update({ onboarding_status: 'whatsapp_connected' })
    .eq('owner_user_id', user.id)
    .is('deleted_at', null)

  revalidatePath('/onboarding')
  redirect('/onboarding?step=4')
}

// ── Step 4: Mark first flow active → go to dashboard ──────────────────────

export async function markFirstFlowActive(_prevState: unknown, _formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const sb = createAdminClient() as any
  await sb.from('organizations')
    .update({ onboarding_status: 'first_flow_active' })
    .eq('owner_user_id', user.id)
    .is('deleted_at', null)

  redirect('/dashboard')
}
