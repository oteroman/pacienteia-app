import { requirePlatformAdmin, PLATFORM_ROLE_LABEL } from '@/lib/platform/auth'
import { logout } from '@/app/(auth)/login/actions'
import { PlatformNav } from '@/components/platform-nav'
import type { PlatformRole } from '@/lib/platform/auth'

export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const pu = await requirePlatformAdmin()

  const ROLE_BADGE: Record<PlatformRole, string> = {
    superadmin: 'bg-amber-500 text-white',
    support:    'bg-brand-100 text-brand-700',
    sales:      'bg-lima-100 text-lima-700',
  }

  return (
    <div className="min-h-screen bg-mist flex flex-col">
      {/* Platform top bar */}
      <header className="bg-white border-b border-fog sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Row 1: brand + user actions */}
          <div className="flex items-center justify-between h-12 gap-4">
            <div className="flex items-center gap-2 shrink-0">
              <span className={`text-xs font-bold px-2 py-0.5 rounded uppercase tracking-wide ${ROLE_BADGE[pu.platform_role]}`}>
                {PLATFORM_ROLE_LABEL[pu.platform_role]}
              </span>
              <span className="text-ink font-bold tracking-tight hidden sm:block">PacienteIA Platform</span>
              <span className="text-ink font-bold tracking-tight sm:hidden">Platform</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate hidden md:block truncate max-w-[180px]">{pu.email}</span>
              <form action={logout}>
                <button type="submit" className="text-xs text-slate hover:text-ink transition-colors border border-fog hover:border-fog px-2.5 py-1 rounded-lg">
                  Salir
                </button>
              </form>
            </div>
          </div>
          {/* Row 2: role-based nav */}
          <div className="border-t border-fog/60 overflow-x-auto">
            <PlatformNav role={pu.platform_role} />
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {children}
      </main>
    </div>
  )
}
