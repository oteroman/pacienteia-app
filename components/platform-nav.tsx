'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const INTERNAL_NAV = [
  { label: 'Inicio',    href: '/platform',          exact: true },
  { label: 'Tenants',  href: '/platform/tenants' },
  { label: 'Trials',   href: '/platform/trials' },
  { label: 'Salud',    href: '/platform/health' },
  { label: 'Auditoría', href: '/platform/audit' },
]

interface PlatformNavProps {
  indicadoresUrl: string
}

export function PlatformNav({ indicadoresUrl }: PlatformNavProps) {
  const pathname = usePathname()

  return (
    <nav className="flex items-center gap-0.5 overflow-x-auto">
      {INTERNAL_NAV.map(({ label, href, exact }) => {
        const active = exact ? pathname === href : pathname.startsWith(href)
        return (
          <Link
            key={href}
            href={href}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              active
                ? 'bg-gray-800 text-white'
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
          >
            {label}
          </Link>
        )
      })}

      <a
        href={indicadoresUrl}
        className="px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors text-amber-400 hover:text-amber-300 hover:bg-gray-800"
      >
        Indicadores ↗
      </a>
    </nav>
  )
}
