import Link from 'next/link'
import { SETTINGS_GROUPS } from '@/lib/settings/nav'

// Settings hub — a grouped, scannable home for all clinic configuration.
// Replaces the old redirect-to-/clinic so the 15 sections fit on one screen.
export default function SettingsHubPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-ink">Configuración</h1>
        <p className="text-sm text-slate mt-1">Todo lo de tu clínica, organizado en un solo lugar.</p>
      </div>

      {SETTINGS_GROUPS.map((group) => (
        <section key={group.label} className="space-y-3">
          <h2 className="text-xs font-semibold text-slate uppercase tracking-widest">
            {group.label}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {group.items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="group flex flex-col rounded-xl border border-fog bg-white px-4 py-3.5 shadow-xs hover:border-brand-300 hover:bg-mist transition-colors"
              >
                <span className="text-sm font-semibold text-ink group-hover:text-brand-700">
                  {item.label}
                </span>
                <span className="text-xs text-slate mt-0.5 leading-snug">
                  {item.desc}
                </span>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
