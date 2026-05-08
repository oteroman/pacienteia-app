import type { ReactNode } from 'react'
import Link from 'next/link'

export default function OnboardingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      <header className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
        <Link href="/" className="text-white font-bold text-lg tracking-tight">
          Paciente<span className="text-brand-400">IA</span>
        </Link>
        <span className="text-xs text-gray-500">Configuración inicial</span>
      </header>
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        {children}
      </main>
    </div>
  )
}
