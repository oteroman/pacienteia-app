'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect }     from 'next/navigation'

export async function updatePassword(
  _prevState: { error: string | null },
  formData: FormData,
): Promise<{ error: string | null }> {
  const password = formData.get('password') as string
  const confirm  = formData.get('confirm')  as string

  if (!password || password.length < 8)
    return { error: 'La contraseña debe tener al menos 8 caracteres' }
  if (password !== confirm)
    return { error: 'Las contraseñas no coinciden' }

  const supabase = await createClient()
  const { error } = await supabase.auth.updateUser({ password })

  if (error) return { error: error.message }

  redirect('/dashboard')
}
