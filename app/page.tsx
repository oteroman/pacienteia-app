import { redirect } from 'next/navigation'

// Root route — middleware handles auth redirection,
// but we cover the case where middleware is bypassed.
export default function RootPage() {
  redirect('/dashboard')
}
