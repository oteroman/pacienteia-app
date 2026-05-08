'use server'

import { createClient } from '@/lib/supabase/server'
import { headers }      from 'next/headers'
import { redirect }     from 'next/navigation'

export async function signUp(
  _prevState: { error: string | null },
  formData: FormData,
): Promise<{ error: string | null }> {
  const email    = (formData.get('email') as string)?.trim().toLowerCase()
  const password = formData.get('password') as string

  if (!email)                         return { error: 'El email es requerido' }
  if (!password || password.length < 8) return { error: 'La contraseña debe tener al menos 8 caracteres' }

  const headersList = await headers()
  const origin      = headersList.get('origin') ?? 'https://app.pacienteia.com'

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${origin}/auth/callback?next=/onboarding`,
    },
  })

  if (error) {
    if (error.message.toLowerCase().includes('already registered')) {
      return { error: 'Ya existe una cuenta con este email. Inicia sesión.' }
    }
    return { error: error.message }
  }

  // Email confirmation disabled in project → session available immediately
  if (data.session) {
    redirect('/onboarding')
  }

  // Email confirmation required → show check-email screen
  redirect(`/signup/check-email?email=${encodeURIComponent(email)}`)
}
