'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'

interface ViewToggleProps {
  current: string
}

export function ViewToggle({ current }: ViewToggleProps) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()

  function setView(view: string) {
    const next = new URLSearchParams(params.toString())
    next.set('view', view)
    next.delete('page')
    router.push(`${pathname}?${next.toString()}`)
  }

  return (
    <div className="flex items-center rounded-lg border border-gray-200 p-0.5 bg-gray-50">
      <button
        onClick={() => setView('table')}
        title="Vista tabla"
        className={`p-1.5 rounded-md transition-colors ${
          current !== 'cards'
            ? 'bg-white shadow-sm text-gray-700'
            : 'text-gray-400 hover:text-gray-600'
        }`}
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 16 16" stroke="currentColor" strokeWidth={1.5}>
          <rect x="1" y="1" width="14" height="3" rx="1" />
          <rect x="1" y="6.5" width="14" height="3" rx="1" />
          <rect x="1" y="12" width="14" height="3" rx="1" />
        </svg>
      </button>
      <button
        onClick={() => setView('cards')}
        title="Vista tarjetas"
        className={`p-1.5 rounded-md transition-colors ${
          current === 'cards'
            ? 'bg-white shadow-sm text-gray-700'
            : 'text-gray-400 hover:text-gray-600'
        }`}
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 16 16" stroke="currentColor" strokeWidth={1.5}>
          <rect x="1" y="1" width="6" height="6" rx="1" />
          <rect x="9" y="1" width="6" height="6" rx="1" />
          <rect x="1" y="9" width="6" height="6" rx="1" />
          <rect x="9" y="9" width="6" height="6" rx="1" />
        </svg>
      </button>
    </div>
  )
}
