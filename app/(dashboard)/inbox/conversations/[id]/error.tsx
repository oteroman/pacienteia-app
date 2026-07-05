'use client'

import Link from 'next/link'
import { useEffect } from 'react'

export default function ConversationError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[conversation-page]', error)
  }, [error])

  return (
    <div className="max-w-2xl mx-auto flex flex-col items-center justify-center py-20 gap-4">
      <p className="text-sm font-semibold text-red-600">Error al cargar la conversación</p>
      <p className="text-xs text-slate">{error.message ?? 'Error desconocido'}</p>
      {error.digest && (
        <p className="text-[10px] text-fog">Digest: {error.digest}</p>
      )}
      <div className="flex gap-3 mt-2">
        <button
          onClick={reset}
          className="text-xs bg-brand-600 text-white px-4 py-2 rounded-lg hover:bg-brand-700"
        >
          Reintentar
        </button>
        <Link href="/inbox" className="text-xs text-slate px-4 py-2 rounded-lg border hover:bg-mist">
          Volver a bandeja
        </Link>
      </div>
    </div>
  )
}
