'use server'

import { createClient } from '@/lib/supabase/server'
import { setActiveClinicId } from '@/lib/tenant/active-clinic'
import { redirect } from 'next/navigation'

interface LoginState {
  error: string | null
}

export async function login(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  if (!email || !password) {
    return { error: 'Email y contraseña son requeridos' }
  }

  const supabase = await createClient()

  const { error: authError } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (authError) {
    return { error: 'Credenciales incorrectas. Verifica tu email y contraseña.' }
  }

  // Determine clinic context after successful login
  const { data: { user } } = await supabase.auth.getUser()

  const { data: memberships } = await supabase
    .from('clinic_members')
    .select('clinic_id')
    .eq('user_id', user!.id)

  if (!memberships || memberships.length === 0) {
    return { error: 'Tu cuenta no está asociada a ninguna clínica. Contacta al administrador.' }
  }

  if (memberships.length === 1) {
    const { clinic_id } = memberships[0]
    await setActiveClinicId(clinic_id)
    redirect('/dashboard')
  }

  // Multiple clinics — let the user choose
  redirect('/clinic-selector')
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
