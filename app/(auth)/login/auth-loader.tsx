'use client'

import dynamic from 'next/dynamic'

const AuthForm = dynamic(
  () => import('./auth-form').then(m => ({ default: m.AuthForm })),
  {
    ssr: false,
    loading: () => (
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8 gap-3">
          <div className="w-11 h-11 rounded-[10px] bg-gradient-to-br from-[#5B8BF7] to-[#7B4FD6]" />
          <div className="h-5 w-32 rounded bg-fog animate-pulse" />
        </div>
        <div className="bg-white rounded-3xl border border-fog p-8" style={{ boxShadow: '0 20px 40px -8px rgba(91,139,247,0.12)' }}>
          <div className="h-10 rounded-xl bg-mist animate-pulse mb-6" />
          <div className="h-11 rounded-xl bg-mist animate-pulse mb-4" />
          <div className="space-y-3">
            <div className="h-10 rounded-xl bg-mist animate-pulse" />
            <div className="h-10 rounded-xl bg-mist animate-pulse" />
            <div className="h-11 rounded-xl bg-[#5B8BF7]/20 animate-pulse" />
          </div>
        </div>
      </div>
    ),
  }
)

export function AuthLoader() {
  return <AuthForm />
}
