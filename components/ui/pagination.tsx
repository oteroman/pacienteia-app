'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'

interface PaginationProps {
  page: number
  totalPages: number
}

export function Pagination({ page, totalPages }: PaginationProps) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()

  if (totalPages <= 1) return null

  function go(p: number) {
    const next = new URLSearchParams(params.toString())
    next.set('page', String(p))
    router.push(`${pathname}?${next.toString()}`)
  }

  return (
    <div className="flex items-center justify-between py-3">
      <p className="text-sm text-slate">
        Página {page} de {totalPages}
      </p>
      <div className="flex gap-2">
        <button
          onClick={() => go(page - 1)}
          disabled={page <= 1}
          className="px-3 py-1.5 text-sm rounded-lg border border-fog disabled:opacity-40 hover:bg-mist transition-colors"
        >
          ← Anterior
        </button>
        <button
          onClick={() => go(page + 1)}
          disabled={page >= totalPages}
          className="px-3 py-1.5 text-sm rounded-lg border border-fog disabled:opacity-40 hover:bg-mist transition-colors"
        >
          Siguiente →
        </button>
      </div>
    </div>
  )
}
