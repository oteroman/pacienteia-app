import { requirePlatformAdmin } from '@/lib/platform/auth'
import { logout } from '@/app/(auth)/login/actions'
import { PlatformNav } from '@/components/platform-nav'

export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const pu = await requirePlatformAdmin()

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {/* Platform top bar */}
      <header className="bg-gray-900 border-b border-gray-800 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Row 1: brand + user actions */}
          <div className="flex items-center justify-between h-12 gap-4">
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs font-bold bg-amber-500 text-white px-2 py-0.5 rounded uppercase tracking-wide">
                Admin
              </span>
              <span className="text-white font-bold tracking-tight hidden sm:block">PacienteIA Platform</span>
              <span className="text-white font-bold tracking-tight sm:hidden">Platform</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-500 hidden md:block truncate max-w-[180px]">{pu.email}</span>
              <span className="text-xs font-bold text-amber-400 uppercase hidden sm:block">{pu.platform_role}</span>
              <form action={logout}>
                <button type="submit" className="text-xs text-gray-400 hover:text-white transition-colors border border-gray-700 hover:border-gray-500 px-2.5 py-1 rounded-lg">
                  Salir
                </button>
              </form>
            </div>
          </div>
          {/* Row 2: nav */}
          <div className="border-t border-gray-800/60 overflow-x-auto">
            <PlatformNav indicadoresUrl={`/analytics/admin?key=${process.env.ADMIN_DASHBOARD_SECRET ?? ''}`} />
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
