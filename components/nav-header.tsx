'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useClinic } from '@/providers/clinic-provider'
import { ClinicSelector } from './clinic-selector'
import { logout } from '@/app/(auth)/login/actions'

interface NavHeaderProps {
  user: { email: string }
}

const NAV = [
  { label: 'Dashboard',  href: '/dashboard' },
  { label: 'Pacientes',  href: '/patients' },
  { label: 'Citas',      href: '/appointments' },
  { label: 'Leads',      href: '/leads' },
  { label: 'Mi plan',    href: '/billing' },
  { label: 'Métricas',  href: '/analytics' },
]

export function NavHeader({ user }: NavHeaderProps) {
  const { clinic } = useClinic()
  const pathname = usePathname()

  return (
    <header className="bg-white border-b border-gray-100 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          {/* Brand + clinic */}
          <div className="flex items-center gap-3">
            <span className="text-brand-700 font-bold text-lg tracking-tight">Paciente IA</span>
            <span className="hidden sm:block text-gray-200">|</span>
            <ClinicSelector />
          </div>

          {/* Navigation links */}
          <nav className="hidden md:flex items-center gap-1">
            {NAV.map(({ label, href }) => {
              const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
              return (
                <Link
                  key={href}
                  href={href}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
                    ${active
                      ? 'bg-brand-50 text-brand-700'
                      : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                    }`}
                >
                  {label}
                </Link>
              )
            })}
          </nav>

          {/* User */}
          <div className="flex items-center gap-4">
            <span className="hidden sm:block text-sm text-gray-400 truncate max-w-[160px]">
              {user.email}
            </span>
            <form action={logout}>
              <button type="submit" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">
                Salir
              </button>
            </form>
          </div>
        </div>

        {/* Mobile nav */}
        <div className="flex md:hidden gap-1 pb-2 overflow-x-auto">
          {NAV.map(({ label, href }) => {
            const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
            return (
              <Link
                key={href}
                href={href}
                className={`px-3 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-colors
                  ${active ? 'bg-brand-50 text-brand-700' : 'text-gray-500 hover:bg-gray-50'}`}
              >
                {label}
              </Link>
            )
          })}
        </div>
      </div>
    </header>
  )
}
