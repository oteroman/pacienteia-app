'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { PlatformRole } from '@/lib/platform/auth'

type NavItem = {
  label: string
  href:  string
  exact?: boolean
  roles: PlatformRole[]   // which roles can see this item
}

const ALL_NAV: NavItem[] = [
  { label: 'Inicio',    href: '/platform',          exact: true, roles: ['superadmin', 'support'] },
  { label: 'Tenants',  href: '/platform/tenants',               roles: ['superadmin', 'support'] },
  { label: 'Trials',   href: '/platform/trials',                roles: ['superadmin', 'support'] },
  { label: 'Revenue',  href: '/platform/mrr',                   roles: ['superadmin'] },
  { label: 'Salud',    href: '/platform/health',                roles: ['superadmin', 'support'] },
  { label: 'CRM',      href: '/platform/crm',                   roles: ['superadmin', 'sales'] },
  { label: 'Ventas',   href: '/platform/sales',                 roles: ['superadmin'] },
  { label: 'Social',   href: '/platform/social',               roles: ['superadmin'] },
  { label: 'Equipo',   href: '/platform/admins',                roles: ['superadmin'] },
  { label: 'Auditoría', href: '/platform/audit',               roles: ['superadmin', 'support'] },
]

export function PlatformNav({ role }: { role: PlatformRole }) {
  const pathname = usePathname()
  const items    = ALL_NAV.filter(item => item.roles.includes(role))

  return (
    <nav className="flex items-center gap-0.5 overflow-x-auto">
      {items.map(({ label, href, exact }) => {
        const active = exact ? pathname === href : pathname.startsWith(href)
        return (
          <Link
            key={href}
            href={href}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              active
                ? 'bg-brand-50 text-brand-700 font-semibold'
                : 'text-slate hover:text-ink hover:bg-mist'
            }`}
          >
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
