'use server'

import { revalidatePath } from 'next/cache'
import { redirect }        from 'next/navigation'
import { createClient }    from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getActiveOrganizationId, getActiveBranchId } from '@/lib/tenant/context'
import { processInteraction } from '@/lib/copilot/process'

const adminSb = () => createAdminClient() as any

export type InteractionFormState = { error: string } | null

export async function submitInteraction(
  _prev: InteractionFormState,
  formData: FormData
): Promise<InteractionFormState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const organizationId = await getActiveOrganizationId()
  if (!organizationId) return { error: 'Sin organización activa. Recarga la página.' }

  // Resolve branch: use cookie first, else auto-detect from DB
  let branchId = await getActiveBranchId()
  if (!branchId) {
    const { data: branch } = await adminSb()
      .from('branches')
      .select('id')
      .eq('organization_id', organizationId)
      .limit(1)
      .single()
    branchId = branch?.id ?? null
  }

  const rawContent = (formData.get('raw_content') as string | null)?.trim()
  const patientId  = (formData.get('patient_id')  as string | null) || null

  if (!rawContent || rawContent.length < 5) return { error: 'El contenido es muy corto.' }

  const result = await processInteraction(rawContent).catch((err: Error) => {
    console.error('[copilot] processInteraction error:', err.message)
    return null
  })

  if (!result) return { error: 'El análisis con IA falló. Verifica la clave de API y vuelve a intentarlo.' }

  if (result.tasks.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: dbErr } = await adminSb().from('copilot_tasks').insert(
      result.tasks.map((t: any) => ({
        organization_id: organizationId,
        branch_id:       branchId,
        patient_id:      patientId,
        title:           t.title,
        description:     t.description,
        priority:        t.priority,
      }))
    )
    if (dbErr) {
      console.error('[copilot] insert error:', dbErr)
      return { error: `Error al guardar tareas: ${dbErr.message}` }
    }
  }

  revalidatePath('/copilot')
  redirect('/copilot?analizado=1&tareas=' + result.tasks.length)
}

export async function resolveTask(taskId: string): Promise<void> {
  const organizationId = await getActiveOrganizationId()
  if (!organizationId) return

  await adminSb()
    .from('copilot_tasks')
    .update({ status: 'done', resolved_at: new Date().toISOString() })
    .eq('id', taskId)
    .eq('organization_id', organizationId)

  revalidatePath('/copilot')
}

export async function dismissTask(taskId: string): Promise<void> {
  const organizationId = await getActiveOrganizationId()
  if (!organizationId) return

  await adminSb()
    .from('copilot_tasks')
    .update({ status: 'dismissed', resolved_at: new Date().toISOString() })
    .eq('id', taskId)
    .eq('organization_id', organizationId)

  revalidatePath('/copilot')
}
