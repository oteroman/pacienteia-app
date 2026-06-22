'use client'

import { useState } from 'react'

export function CopyButton({ text, label = 'Copiar' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false)

  async function handleClick() {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={handleClick}
      className="shrink-0 px-3 py-1.5 text-xs font-medium border border-fog rounded-lg text-slate hover:text-brand-700 hover:border-brand-300 transition-colors"
    >
      {copied ? '✓ Copiado' : label}
    </button>
  )
}
