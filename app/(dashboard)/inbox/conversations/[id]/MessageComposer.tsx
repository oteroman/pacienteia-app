'use client'

import { useActionState, useRef, useEffect, useState, useCallback } from 'react'
import { sendMessage } from '@/app/actions/conversations'

interface Template {
  id:       string
  name:     string
  body:     string
  category: string
}

interface Props {
  conversationId: string
}

type State = { ok: boolean; error?: string } | null

const CATEGORY_LABELS: Record<string, string> = {
  general:      'General',
  confirmacion: 'Confirmación',
  recordatorio: 'Recordatorio',
  seguimiento:  'Seguimiento',
  reactivacion: 'Reactivación',
  promocion:    'Promoción',
}

export function MessageComposer({ conversationId }: Props) {
  const boundAction = sendMessage.bind(null, conversationId)
  const [state, action, isPending] = useActionState<State, FormData>(boundAction, null)
  const formRef     = useRef<HTMLFormElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // AI suggestion state
  const [suggestion,     setSuggestion]     = useState<string | null>(null)
  const [loadingSuggest, setLoadingSuggest] = useState(false)
  const [suggestError,   setSuggestError]   = useState<string | null>(null)

  // Template picker state
  const [templates,        setTemplates]        = useState<Template[]>([])
  const [templatesLoaded,  setTemplatesLoaded]  = useState(false)
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false)

  useEffect(() => {
    if (state?.ok) {
      formRef.current?.reset()
      setSuggestion(null)
    }
  }, [state])

  // Close template picker on outside click
  useEffect(() => {
    if (!templatePickerOpen) return
    function handleClick(e: MouseEvent) {
      const el = document.getElementById('template-picker')
      if (el && !el.contains(e.target as Node)) setTemplatePickerOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [templatePickerOpen])

  const loadTemplates = useCallback(async () => {
    if (templatesLoaded) return
    try {
      const res  = await fetch(`/api/templates?conversation_id=${conversationId}`)
      const data = await res.json()
      setTemplates(data.templates ?? [])
    } catch {
      setTemplates([])
    } finally {
      setTemplatesLoaded(true)
    }
  }, [conversationId, templatesLoaded])

  function openTemplatePicker() {
    loadTemplates()
    setTemplatePickerOpen(v => !v)
    setSuggestion(null)
  }

  function applyTemplate(tmpl: Template) {
    if (!textareaRef.current) return
    textareaRef.current.value = tmpl.body
    textareaRef.current.focus()
    setTemplatePickerOpen(false)
  }

  async function handleSuggest() {
    setLoadingSuggest(true)
    setSuggestError(null)
    setSuggestion(null)
    setTemplatePickerOpen(false)
    try {
      const res  = await fetch('/api/ai/suggest-reply', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ conversationId }),
      })
      const data = await res.json()
      if (data.suggestion) {
        setSuggestion(data.suggestion)
      } else {
        setSuggestError('No se pudo generar una sugerencia')
      }
    } catch {
      setSuggestError('Error al conectar con la IA')
    } finally {
      setLoadingSuggest(false)
    }
  }

  function useSuggestion() {
    if (!suggestion || !textareaRef.current) return
    textareaRef.current.value = suggestion
    textareaRef.current.focus()
    setSuggestion(null)
  }

  // Group templates by category for the picker
  const byCategory = templates.reduce<Record<string, Template[]>>((acc, t) => {
    const cat = t.category ?? 'general'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(t)
    return acc
  }, {})

  return (
    <div className="space-y-2">

      {/* AI suggestion card */}
      {suggestion && (
        <div className="bg-ai-50 border border-ai-200 rounded-xl p-3">
          <div className="flex items-start gap-2">
            <span className="text-purple-500 text-base leading-none flex-shrink-0 mt-0.5">✨</span>
            <p className="text-sm text-slate flex-1 leading-relaxed">{suggestion}</p>
            <button
              type="button"
              onClick={() => setSuggestion(null)}
              className="text-slate hover:text-slate flex-shrink-0 text-xs px-1"
              aria-label="Descartar sugerencia"
            >
              ✕
            </button>
          </div>
          <button
            type="button"
            onClick={useSuggestion}
            className="mt-2 text-xs font-medium text-ai-500 hover:text-ai-600 transition-colors"
          >
            Usar esta respuesta →
          </button>
        </div>
      )}

      {/* Template picker dropdown */}
      {templatePickerOpen && (
        <div
          id="template-picker"
          className="border border-fog rounded-xl bg-white shadow-lg overflow-hidden max-h-64 overflow-y-auto"
        >
          {!templatesLoaded ? (
            <p className="text-xs text-slate px-4 py-3">Cargando plantillas…</p>
          ) : templates.length === 0 ? (
            <div className="px-4 py-3 space-y-1">
              <p className="text-xs text-slate">No hay plantillas guardadas.</p>
              <a
                href="/settings/messages"
                target="_blank"
                rel="noreferrer"
                className="text-xs text-brand-600 hover:underline"
              >
                Crear plantillas →
              </a>
            </div>
          ) : (
            Object.entries(byCategory).map(([cat, items]) => (
              <div key={cat}>
                <p className="px-4 py-1.5 text-[10px] font-bold text-slate uppercase tracking-widest bg-mist border-b border-fog">
                  {CATEGORY_LABELS[cat] ?? cat}
                </p>
                {items.map((tmpl) => (
                  <button
                    key={tmpl.id}
                    type="button"
                    onClick={() => applyTemplate(tmpl)}
                    className="w-full text-left px-4 py-2.5 hover:bg-brand-50 transition-colors border-b border-fog last:border-0"
                  >
                    <p className="text-sm font-medium text-ink">{tmpl.name}</p>
                    <p className="text-xs text-slate mt-0.5 line-clamp-1">{tmpl.body}</p>
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
      )}

      <form ref={formRef} action={action} className="flex gap-2 items-end">
        <div className="flex-1 space-y-1.5">
          <textarea
            ref={textareaRef}
            name="body"
            rows={2}
            required
            placeholder="Escribe tu respuesta… (Enter para enviar)"
            className="w-full resize-none rounded-xl border border-fog px-4 py-3 text-sm
                       focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                e.currentTarget.form?.requestSubmit()
              }
            }}
          />

          {/* Action bar */}
          <div className="flex items-center gap-3">
            {/* Template picker button */}
            <div className="relative">
              <button
                type="button"
                onClick={openTemplatePicker}
                className={`flex items-center gap-1.5 text-xs transition-colors ${
                  templatePickerOpen
                    ? 'text-brand-700 font-medium'
                    : 'text-slate hover:text-slate'
                }`}
              >
                <span>📋</span>
                Plantillas
              </button>
            </div>

            <span className="text-fog text-xs">|</span>

            {/* AI suggestion button */}
            <button
              type="button"
              onClick={handleSuggest}
              disabled={loadingSuggest}
              className="flex items-center gap-1.5 text-xs text-ai-500 hover:text-ai-600
                         disabled:opacity-50 transition-colors"
            >
              {loadingSuggest
                ? <span className="inline-block w-3 h-3 border border-purple-400 border-t-transparent rounded-full animate-spin" />
                : <span>✨</span>
              }
              {loadingSuggest ? 'Generando…' : 'Sugerencia IA'}
            </button>

            {suggestError && (
              <p className="text-[10px] text-red-500">{suggestError}</p>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-1 flex-shrink-0">
          <button
            type="submit"
            disabled={isPending}
            className="bg-brand-600 text-white px-5 py-3 rounded-xl text-sm font-semibold
                       hover:bg-brand-700 disabled:opacity-50 transition-colors"
          >
            {isPending ? '…' : 'Enviar'}
          </button>
          {state?.error && (
            <p className="text-[10px] text-red-500 text-center">{state.error}</p>
          )}
        </div>
      </form>
    </div>
  )
}
