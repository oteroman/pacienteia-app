'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useClinic } from '@/providers/clinic-provider'
import { usePlanStatus } from '@/context/plan-status'
import { ClinicSelector } from './clinic-selector'
import { logout } from '@/app/(auth)/login/actions'

// ── Types ────────────────────────────────────────────────────────

interface NavItem  { label: string; href: string; desc?: string }
interface NavGroup { id: string; label: string; items: NavItem[] }

// ── Navigation map ───────────────────────────────────────────────

const STANDALONE: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Bandeja',   href: '/inbox' },
]

const GROUPS: NavGroup[] = [
  {
    id: 'gestion',
    label: 'Gestión',
    items: [
      { label: 'Pacientes', href: '/patients',     desc: 'Historiales y seguimiento' },
      { label: 'Citas',     href: '/appointments', desc: 'Agenda y confirmaciones'   },
      { label: 'Leads',     href: '/leads',        desc: 'Captación y nurturing'     },
    ],
  },
  {
    id: 'ia',
    label: 'Copiloto IA',
    items: [
      { label: 'Copiloto',  href: '/copilot',   desc: 'Tareas automatizadas por IA' },
      { label: 'Ops',       href: '/ops',        desc: 'Visión operativa cruzada'    },
      { label: 'Rebooking', href: '/rebooking',  desc: 'Cancelaciones pendientes'    },
      { label: 'Backfill',  href: '/backfill',   desc: 'Slots libres prioritarios'   },
    ],
  },
  {
    id: 'analisis',
    label: 'Análisis',
    items: [
      { label: 'Métricas', href: '/analytics',         desc: 'KPIs de operación'       },
      { label: 'Revenue',  href: '/analytics/revenue', desc: 'Ingresos y recuperación'  },
      { label: 'Renewal',  href: '/renewal',            desc: 'Churn risk y expansión'  },
    ],
  },
]

const CONFIG: NavItem[] = [
  { label: 'Ajustes', href: '/settings/clinic', desc: 'Configuración de clínica' },
  { label: 'Mi plan', href: '/billing',          desc: 'Suscripción y facturación' },
]

// ── Props ────────────────────────────────────────────────────────

interface NavHeaderProps { user: { email: string } }

// ── Component ────────────────────────────────────────────────────

export function NavHeader({ user }: NavHeaderProps) {
  const pathname        = usePathname()
  const { clinic }      = useClinic()
  const { sub, trialDaysLeft } = usePlanStatus()

  const [openGroup, setOpenGroup] = useState<string | null>(null)
  const [configOpen, setConfigOpen]   = useState(false)
  const [mobileOpen, setMobileOpen]   = useState(false)
  const navRef = useRef<HTMLElement>(null)

  // Close everything on outside click or Escape
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (!navRef.current?.contains(e.target as Node)) {
        setOpenGroup(null)
        setConfigOpen(false)
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { setOpenGroup(null); setConfigOpen(false); setMobileOpen(false) }
    }
    document.addEventListener('mousedown', handleClick)
    window.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      window.removeEventListener('keydown', handleKey)
    }
  }, [])

  // Close mobile menu on navigation
  useEffect(() => { setMobileOpen(false) }, [pathname])

  const planBadge = sub.status === 'trialing'
    ? { label: `Trial · ${trialDaysLeft}d`, cls: 'bg-amber-50 text-amber-700 border-amber-200' }
    : sub.status === 'overdue'
    ? { label: 'Pago pendiente', cls: 'bg-red-50 text-red-700 border-red-200' }
    : null

  return (
    <>
      {/* ── Main Header ────────────────────────────────────── */}
      <header
        ref={navRef}
        className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-gray-100 shadow-sm"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 gap-4">

            {/* ── Brand + clinic ─────────────────────────── */}
            <div className="flex items-center gap-3 min-w-0">
              <Link href="/dashboard" className="text-brand-700 font-bold text-lg tracking-tight shrink-0">
                Paciente IA
              </Link>
              <span className="hidden sm:block text-gray-200 shrink-0">|</span>
              <ClinicSelector />
            </div>

            {/* ── Desktop nav ────────────────────────────── */}
            <nav className="hidden lg:flex items-center gap-0.5">
              {/* Standalone items */}
              {STANDALONE.map(({ label, href }) => {
                const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      active
                        ? 'bg-brand-50 text-brand-700'
                        : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                    }`}
                  >
                    {label}
                  </Link>
                )
              })}

              <span className="w-px h-4 bg-gray-200 mx-1" />

              {/* Group dropdowns */}
              {GROUPS.map((group) => {
                const isOpen        = openGroup === group.id
                const isGroupActive = group.items.some(i => pathname.startsWith(i.href))
                return (
                  <div key={group.id} className="relative">
                    <button
                      onClick={() => setOpenGroup(isOpen ? null : group.id)}
                      className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                        isGroupActive || isOpen
                          ? 'bg-brand-50 text-brand-700'
                          : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                      }`}
                    >
                      {group.label}
                      <ChevronDown open={isOpen} />
                    </button>

                    {isOpen && (
                      <div className="absolute left-0 top-full mt-1.5 w-56 bg-white border border-gray-100 rounded-xl shadow-xl z-50 py-1.5 overflow-hidden">
                        {group.items.map((item) => {
                          const active = pathname.startsWith(item.href)
                          return (
                            <Link
                              key={item.href}
                              href={item.href}
                              onClick={() => setOpenGroup(null)}
                              className={`flex flex-col px-4 py-2.5 transition-colors ${
                                active ? 'bg-brand-50' : 'hover:bg-gray-50'
                              }`}
                            >
                              <span className={`text-sm font-medium ${active ? 'text-brand-700' : 'text-gray-800'}`}>
                                {item.label}
                              </span>
                              {item.desc && (
                                <span className="text-xs text-gray-400 mt-0.5 leading-snug">{item.desc}</span>
                              )}
                            </Link>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </nav>

            {/* ── Right side ─────────────────────────────── */}
            <div className="flex items-center gap-3">
              {/* Plan badge */}
              {planBadge && (
                <span className={`hidden sm:inline-flex text-xs font-medium border px-2.5 py-0.5 rounded-full ${planBadge.cls}`}>
                  {planBadge.label}
                </span>
              )}

              {/* Config dropdown (desktop) */}
              <div className="relative hidden lg:block">
                <button
                  onClick={() => setConfigOpen(v => !v)}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    CONFIG.some(i => pathname.startsWith(i.href)) || configOpen
                      ? 'bg-brand-50 text-brand-700'
                      : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  <GearIcon />
                  <ChevronDown open={configOpen} />
                </button>

                {configOpen && (
                  <div className="absolute right-0 top-full mt-1.5 w-52 bg-white border border-gray-100 rounded-xl shadow-xl z-50 py-1.5 overflow-hidden">
                    {CONFIG.map((item) => {
                      const active = pathname.startsWith(item.href)
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setConfigOpen(false)}
                          className={`flex flex-col px-4 py-2.5 transition-colors ${
                            active ? 'bg-brand-50' : 'hover:bg-gray-50'
                          }`}
                        >
                          <span className={`text-sm font-medium ${active ? 'text-brand-700' : 'text-gray-800'}`}>
                            {item.label}
                          </span>
                          {item.desc && (
                            <span className="text-xs text-gray-400 mt-0.5">{item.desc}</span>
                          )}
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Email (desktop) */}
              <span className="hidden xl:block text-sm text-gray-400 truncate max-w-[160px]">
                {user.email}
              </span>

              {/* Logout (desktop) */}
              <form action={logout} className="hidden lg:block">
                <button type="submit" className="text-sm text-gray-400 hover:text-gray-700 transition-colors">
                  Salir
                </button>
              </form>

              {/* Hamburger (mobile) */}
              <button
                onClick={() => setMobileOpen(v => !v)}
                className="lg:hidden flex flex-col gap-1.5 p-1.5 rounded-md hover:bg-gray-50 transition-colors"
                aria-label="Abrir menú"
              >
                <span className={`block h-0.5 w-5 bg-gray-600 transition-transform ${mobileOpen ? 'rotate-45 translate-y-2' : ''}`} />
                <span className={`block h-0.5 w-5 bg-gray-600 transition-opacity ${mobileOpen ? 'opacity-0' : ''}`} />
                <span className={`block h-0.5 w-5 bg-gray-600 transition-transform ${mobileOpen ? '-rotate-45 -translate-y-2' : ''}`} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ── Mobile Sidebar ──────────────────────────────────── */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/30 z-40 lg:hidden"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="fixed left-0 top-0 bottom-0 w-72 bg-white z-50 overflow-y-auto flex flex-col shadow-2xl lg:hidden">
            {/* Sidebar header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <span className="font-bold text-brand-700 text-lg">Paciente IA</span>
              <button
                onClick={() => setMobileOpen(false)}
                className="text-gray-400 hover:text-gray-700 text-2xl leading-none font-light"
              >
                ×
              </button>
            </div>

            {/* Clinic */}
            <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-0.5">Clínica activa</p>
              <p className="text-sm font-semibold text-gray-800">{clinic.name}</p>
            </div>

            {/* Nav items */}
            <nav className="flex-1 py-2 overflow-y-auto">
              {/* Standalone */}
              {STANDALONE.map(({ label, href }) => {
                const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`flex items-center px-5 py-2.5 text-sm font-medium transition-colors ${
                      active ? 'text-brand-700 bg-brand-50' : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {label}
                  </Link>
                )
              })}

              {/* Groups */}
              {GROUPS.map((group) => (
                <div key={group.id} className="mt-3">
                  <p className="px-5 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                    {group.label}
                  </p>
                  {group.items.map(({ label, href }) => {
                    const active = pathname.startsWith(href)
                    return (
                      <Link
                        key={href}
                        href={href}
                        className={`flex items-center px-5 py-2.5 text-sm transition-colors ${
                          active ? 'text-brand-700 font-medium bg-brand-50' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                        }`}
                      >
                        {label}
                      </Link>
                    )
                  })}
                </div>
              ))}

              {/* Config */}
              <div className="mt-3 pt-3 border-t border-gray-100">
                <p className="px-5 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  Configuración
                </p>
                {CONFIG.map(({ label, href }) => {
                  const active = pathname.startsWith(href)
                  return (
                    <Link
                      key={href}
                      href={href}
                      className={`flex items-center px-5 py-2.5 text-sm transition-colors ${
                        active ? 'text-brand-700 font-medium bg-brand-50' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      }`}
                    >
                      {label}
                    </Link>
                  )
                })}
              </div>
            </nav>

            {/* Sidebar footer */}
            <div className="px-5 py-4 border-t border-gray-100">
              {planBadge && (
                <span className={`inline-flex text-xs font-medium border px-2.5 py-0.5 rounded-full mb-3 ${planBadge.cls}`}>
                  {planBadge.label}
                </span>
              )}
              <p className="text-xs text-gray-400 truncate mb-2">{user.email}</p>
              <form action={logout}>
                <button type="submit" className="text-sm text-gray-500 hover:text-gray-900 transition-colors font-medium">
                  Cerrar sesión
                </button>
              </form>
            </div>
          </aside>
        </>
      )}
    </>
  )
}

// ── SVG helpers ──────────────────────────────────────────────────

function ChevronDown({ open }: { open: boolean }) {
  return (
    <svg
      className={`w-3.5 h-3.5 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
      viewBox="0 0 20 20"
      fill="currentColor"
    >
      <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
    </svg>
  )
}

function GearIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
    </svg>
  )
}
