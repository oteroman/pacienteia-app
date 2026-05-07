import { requirePlatformAdmin } from '@/lib/platform/auth'
import { logout } from '@/app/(auth)/login/actions'
import { PlatformNav } from '@/components/platform-nav'

export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const pu = await requirePlatformAdmin()

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {/* Platform top bar */}
      <header className="bg-gray-900 border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-14">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold bg-amber-500 text-white px-2 py-0.5 rounded uppercase tracking-wide">
                Admin
              </span>
              <span className="text-white font-bold text-lg tracking-tight">PacienteIA Platform</span>
            </div>
            <PlatformNav indicadoresUrl={`/analytics/admin?key=${process.env.ADMIN_DASHBOARD_SECRET ?? ''}`} />
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-400">{pu.email}</span>
            <span className="text-xs font-bold text-amber-400 uppercase">{pu.platform_role}</span>
            <form action={logout}>
              <button type="submit" className="text-sm text-gray-400 hover:text-white transition-colors">
                Salir
              </button>
            </form>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  )
}
