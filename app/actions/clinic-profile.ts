'use server'

import { revalidatePath }    from 'next/cache'
import { createClient }      from '@/lib/supabase/server'
import { getActiveClinicId } from '@/lib/tenant/active-clinic'
import { upsertClinicProfile } from '@/lib/clinic/profile'
import type { BrandTone }    from '@/lib/clinic/profile'

export async function saveClinicProfile(formData: FormData): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const orgId = await getActiveClinicId()
  if (!orgId) return

  await upsertClinicProfile(orgId, {
    brandName:        (formData.get('brand_name')        as string | null) || null,
    brandTone:        (formData.get('brand_tone')        as BrandTone)     || 'professional',
    brandToneNotes:   (formData.get('brand_tone_notes')  as string | null) || null,
    defaultSignature: (formData.get('default_signature') as string | null) || null,
    responseOpener:   (formData.get('response_opener')   as string | null) || null,
    whatsapp:         (formData.get('whatsapp')          as string | null) || null,
    phone:            (formData.get('phone')             as string | null) || null,
    address:          (formData.get('address')           as string | null) || null,
    businessHours:    (formData.get('business_hours')    as string | null) || null,
    website:          (formData.get('website')           as string | null) || null,
    instagramHandle:  (formData.get('instagram_handle')  as string | null) || null,
  })

  revalidatePath('/settings/clinic')
  revalidatePath('/inbox')
}
