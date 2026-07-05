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
  { label: 'Resumen', href: '/dashboard' },
  { label: 'Bandeja', href: '/inbox' },
]

const GROUPS: NavGroup[] = [
  {
    id: 'gestion',
    label: 'Gestión',
    items: [
      { label: 'Pacientes',  href: '/patients',     desc: 'Historiales y seguimiento' },
      { label: 'Citas',      href: '/appointments', desc: 'Agenda y confirmaciones'  },
      { label: 'Calendario', href: '/calendar',     desc: 'Vista semanal y diaria'   },
      { label: 'Consultas',  href: '/leads',        desc: 'Interesados y su seguimiento' },
    ],
  },
  {
    id: 'ia',
    label: 'Copiloto IA',
    items: [
      { label: 'Copiloto',       href: '/copilot',       desc: 'Tareas automatizadas por IA'    },
      { label: 'Bitácora',       href: '/activity',      desc: 'Actividad del staff y la IA'    },
      { label: 'Sala de espera', href: '/waiting-room',  desc: 'Cola de pacientes en recepción' },
      { label: 'Operaciones',    href: '/ops',           desc: 'Visión operativa cruzada'       },
      { label: 'Reagendar',      href: '/rebooking',     desc: 'Cancelaciones por recuperar'    },
      { label: 'Recuperación',   href: '/backfill',      desc: 'Huecos libres prioritarios'     },
    ],
  },
  {
    id: 'analisis',
    label: 'Análisis',
    items: [
      { label: 'Métricas',           href: '/analytics',              desc: 'Indicadores de operación'    },
      { label: 'Crecimiento',        href: '/analytics/growth',       desc: 'Evolución 3 / 6 / 12 meses'  },
      { label: 'Ingresos',           href: '/analytics/revenue',      desc: 'Ingresos y recuperación'     },
      { label: 'Recordatorios',      href: '/analytics/reminders',    desc: 'Confirmaciones y no-shows'   },
      { label: 'Reputación',         href: '/analytics/reputation',   desc: 'Encuestas y reseñas Google'  },
      { label: 'Reactivación',       href: '/analytics/reactivation', desc: 'Pacientes inactivos'         },
      { label: 'Fugas de marketing', href: '/analytics/marketing',    desc: 'Costo de anuncios y conversión' },
    ],
  },
]

// ── Props ────────────────────────────────────────────────────────

interface NavHeaderProps { user: { email: string } }

// ── Component ────────────────────────────────────────────────────

export function NavHeader({ user }: NavHeaderProps) {
  const pathname        = usePathname()
  const { clinic }      = useClinic()
  const { sub, trialDaysLeft } = usePlanStatus()

  const [openGroup, setOpenGroup] = useState<string | null>(null)
  const [mobileOpen, setMobileOpen]   = useState(false)
  const navRef = useRef<HTMLElement>(null)

  // Notification badge counts (polled every 30s)
  const [unreadMessages, setUnreadMessages] = useState(0)
  const [pendingLeads,   setPendingLeads]   = useState(0)

  useEffect(() => {
    let active = true
    async function fetchCounts() {
      try {
        const res = await fetch('/api/notifications')
        if (!res.ok || !active) return
        const data = await res.json()
        setUnreadMessages(data.unreadMessages ?? 0)
        setPendingLeads(data.pendingLeads ?? 0)
      } catch { /* ignore */ }
    }
    fetchCounts()
    const id = setInterval(() => { if (document.visibilityState === 'visible') fetchCounts() }, 30_000)
    return () => { active = false; clearInterval(id) }
  }, [])

  // Close everything on outside click or Escape
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (!navRef.current?.contains(e.target as Node)) {
        setOpenGroup(null)
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { setOpenGroup(null); setMobileOpen(false) }
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
        className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-fog shadow-xs"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 gap-4">

            {/* ── Brand + clinic ─────────────────────────── */}
            <div className="flex items-center gap-3 min-w-0">
              <Link href="/dashboard" className="text-brand-700 font-bold text-lg tracking-tight shrink-0">
                Paciente IA
              </Link>
              <span className="hidden sm:block text-fog shrink-0">|</span>
              <ClinicSelector />
            </div>

            {/* ── Desktop nav ────────────────────────────── */}
            <nav className="hidden lg:flex items-center gap-0.5">
              {/* Standalone items */}
              {STANDALONE.map(({ label, href }) => {
                const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
                const badge  = href === '/inbox' ? unreadMessages : 0
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`relative px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      active
                        ? 'bg-brand-50 text-brand-700'
                        : 'text-slate hover:text-ink hover:bg-mist'
                    }`}
                  >
                    {label}
                    {badge > 0 && (
                      <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center leading-none">
                        {badge > 99 ? '99+' : badge}
                      </span>
                    )}
                  </Link>
                )
              })}

              <span className="w-px h-4 bg-fog mx-1" />

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
                          : 'text-slate hover:text-ink hover:bg-mist'
                      }`}
                    >
                      {group.label}
                      <ChevronDown open={isOpen} />
                    </button>

                    {isOpen && (
                      <div className="absolute left-0 top-full mt-1.5 w-56 bg-white border border-fog rounded-xl shadow-md z-50 py-1.5 overflow-hidden">
                        {group.items.map((item) => {
                          const active    = pathname.startsWith(item.href)
                          const itemBadge = item.href === '/leads' ? pendingLeads : 0
                          return (
                            <Link
                              key={item.href}
                              href={item.href}
                              onClick={() => setOpenGroup(null)}
                              className={`flex flex-col px-4 py-2.5 transition-colors ${
                                active ? 'bg-brand-50' : 'hover:bg-mist'
                              }`}
                            >
                              <span className={`flex items-center gap-2 text-sm font-medium ${active ? 'text-brand-700' : 'text-ink'}`}>
                                {item.label}
                                {itemBadge > 0 && (
                                  <span className="min-w-[18px] h-4.5 px-1.5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                                    {itemBadge > 99 ? '99+' : itemBadge}
                                  </span>
                                )}
                              </span>
                              {item.desc && (
                                <span className="text-xs text-slate mt-0.5 leading-snug">{item.desc}</span>
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

              {/* Config (desktop) — enlaza al hub de configuración */}
              <Link
                href="/settings"
                aria-label="Configuración"
                className={`hidden lg:flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  pathname.startsWith('/settings') || pathname.startsWith('/billing')
                    ? 'bg-brand-50 text-brand-700'
                    : 'text-slate hover:text-ink hover:bg-mist'
                }`}
              >
                <GearIcon />
              </Link>

              {/* Email (desktop) */}
              <span className="hidden xl:block text-sm text-slate truncate max-w-[160px]">
                {user.email}
              </span>

              {/* Logout (desktop) */}
              <form action={logout} className="hidden lg:block">
                <button type="submit" className="text-sm text-slate hover:text-ink transition-colors">
                  Salir
                </button>
              </form>

              {/* Hamburger (mobile) */}
              <button
                onClick={() => setMobileOpen(v => !v)}
                className="lg:hidden flex flex-col gap-1.5 p-1.5 rounded-md hover:bg-mist transition-colors"
                aria-label="Abrir menú"
              >
                <span className={`block h-0.5 w-5 bg-slate transition-transform ${mobileOpen ? 'rotate-45 translate-y-2' : ''}`} />
                <span className={`block h-0.5 w-5 bg-slate transition-opacity ${mobileOpen ? 'opacity-0' : ''}`} />
                <span className={`block h-0.5 w-5 bg-slate transition-transform ${mobileOpen ? '-rotate-45 -translate-y-2' : ''}`} />
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
            <div className="flex items-center justify-between px-5 py-4 border-b border-fog">
              <span className="font-bold text-brand-700 text-lg">Paciente IA</span>
              <button
                onClick={() => setMobileOpen(false)}
                className="text-slate hover:text-ink text-2xl leading-none font-light"
              >
                ×
              </button>
            </div>

            {/* Clinic */}
            <div className="px-5 py-3 bg-mist border-b border-fog">
              <p className="text-[10px] font-semibold text-slate uppercase tracking-widest mb-0.5">Clínica activa</p>
              <p className="text-sm font-semibold text-ink">{clinic.name}</p>
            </div>

            {/* Nav items */}
            <nav className="flex-1 py-2 overflow-y-auto">
              {/* Standalone */}
              {STANDALONE.map(({ label, href }) => {
                const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
                const badge  = href === '/inbox' ? unreadMessages : 0
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`flex items-center justify-between px-5 py-2.5 text-sm font-medium transition-colors ${
                      active ? 'text-brand-700 bg-brand-50' : 'text-ink hover:bg-mist'
                    }`}
                  >
                    {label}
                    {badge > 0 && (
                      <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center">
                        {badge > 99 ? '99+' : badge}
                      </span>
                    )}
                  </Link>
                )
              })}

              {/* Groups */}
              {GROUPS.map((group) => (
                <div key={group.id} className="mt-3">
                  <p className="px-5 py-1 text-[10px] font-bold text-slate uppercase tracking-widest">
                    {group.label}
                  </p>
                  {group.items.map(({ label, href }) => {
                    const active = pathname.startsWith(href)
                    return (
                      <Link
                        key={href}
                        href={href}
                        className={`flex items-center px-5 py-2.5 text-sm transition-colors ${
                          active ? 'text-brand-700 font-medium bg-brand-50' : 'text-slate hover:bg-mist hover:text-ink'
                        }`}
                      >
                        {label}
                      </Link>
                    )
                  })}
                </div>
              ))}

              {/* Config — entrada única al hub de configuración */}
              <div className="mt-3 pt-3 border-t border-fog">
                <Link
                  href="/settings"
                  className={`flex items-center px-5 py-2.5 text-sm font-medium transition-colors ${
                    pathname.startsWith('/settings') || pathname.startsWith('/billing')
                      ? 'text-brand-700 bg-brand-50'
                      : 'text-slate hover:bg-mist hover:text-ink'
                  }`}
                >
                  Configuración
                </Link>
              </div>
            </nav>

            {/* Sidebar footer */}
            <div className="px-5 py-4 border-t border-fog">
              {planBadge && (
                <span className={`inline-flex text-xs font-medium border px-2.5 py-0.5 rounded-full mb-3 ${planBadge.cls}`}>
                  {planBadge.label}
                </span>
              )}
              <p className="text-xs text-slate truncate mb-2">{user.email}</p>
              <form action={logout}>
                <button type="submit" className="text-sm text-slate hover:text-ink transition-colors font-medium">
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
