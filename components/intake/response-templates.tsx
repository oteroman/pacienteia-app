'use client'

import { useState } from 'react'
import { TEMPLATES, SUGGESTED_ACTION } from '@/lib/intake/orchestrate'
import type { IntakeIntent, IntakeChannel } from '@/lib/intake/index'
import type { ClinicProfileDTO } from '@/lib/clinic/profile'
import { generateDraft } from '@/app/actions/draft'

interface ResponseTemplatesProps {
  intakeId:    string
  intent:      IntakeIntent
  channel:     IntakeChannel
  contactName: string | null
  profile:     ClinicProfileDTO | null
}

type Mode = 'templates' | 'draft'

const VAR_LABELS: Record<string, string> = {
  nombre:      'Nombre',
  fecha:       'Fecha',
  hora:        'Hora',
  tratamiento: 'Tratamiento',
}

function initVars(contactName: string | null, profile: ClinicProfileDTO | null): Record<string, string> {
  // auto_fill: pre-populate from known context
  return {
    nombre:  contactName                   ?? '',
    // fecha / hora / tratamiento are appointment-specific — can't auto-fill globally
  }
}

export function ResponseTemplates({
  intakeId, intent, channel: _channel, contactName, profile,
}: ResponseTemplatesProps) {
  const templates    = TEMPLATES[intent] ?? []
  const suggestedAct = SUGGESTED_ACTION[intent]

  const [mode, setMode]               = useState<Mode>('templates')
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [vars, setVars]               = useState<Record<string, string>>(
    () => initVars(contactName, profile)
  )
  const [draft, setDraft]           = useState('')
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError]     = useState(false)
  const [copied, setCopied]         = useState(false)

  const tpl     = templates[selectedIdx]
  const allVars = tpl?.variables ?? []

  // Apply opener override from profile if set
  function applyOpener(text: string): string {
    if (!profile?.responseOpener) return text
    return text.replace(/^Hola \[nombre\],?/, profile.responseOpener)
  }

  function fillText(text: string): string {
    return applyOpener(text)
      .replace(/\[nombre\]/g,      vars['nombre']      || contactName || '[nombre]')
      .replace(/\[fecha\]/g,       vars['fecha']        || '[fecha]')
      .replace(/\[hora\]/g,        vars['hora']         || '[hora]')
      .replace(/\[tratamiento\]/g, vars['tratamiento']  || '[tratamiento]')
  }

  const previewText = mode === 'draft' ? draft : (tpl ? fillText(tpl.text) : '')
  const missingVars = mode === 'templates'
    ? allVars.filter((v) => v !== 'nombre' && !vars[v])
    : []

  async function handleGenerateDraft() {
    setGenerating(true)
    setGenError(false)
    try {
      const text = await generateDraft(intakeId)
      if (text) {
        setDraft(text)
        setMode('draft')
      } else {
        setGenError(true)
      }
    } catch {
      setGenError(true)
    } finally {
      setGenerating(false)
    }
  }

  async function handleCopy() {
    if (!previewText) return
    // Append signature from clinic profile
    const sig = profile?.defaultSignature
    const full = sig ? `${previewText}\n\n${sig}` : previewText
    await navigator.clipboard.writeText(full)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-4">

      {/* Suggested action */}
      <div className="flex items-start gap-2">
        <span className="text-[10px] font-medium text-slate uppercase tracking-wide mt-0.5 flex-shrink-0">
          Acción sugerida
        </span>
        <span className="text-xs text-brand-700 bg-brand-50 px-2 py-0.5 rounded-full font-medium">
          {suggestedAct}
        </span>
      </div>

      {/* Mode toggle */}
      <div className="flex gap-1.5 items-center">
        <button
          onClick={() => setMode('templates')}
          className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
            mode === 'templates'
              ? 'bg-gray-900 text-white'
              : 'bg-[#F3F6F9] text-slate hover:bg-fog'
          }`}
        >
          Plantillas
        </button>
        <button
          onClick={handleGenerateDraft}
          disabled={generating}
          className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-60 ${
            mode === 'draft'
              ? 'bg-gray-900 text-white'
              : 'bg-[#F3F6F9] text-slate hover:bg-fog'
          }`}
        >
          {generating ? 'Generando…' : 'Borrador IA'}
        </button>
        {genError && (
          <span className="text-xs text-red-500">Error — usa plantilla</span>
        )}
        {profile?.brandTone && mode === 'draft' && (
          <span className="ml-auto text-[10px] text-slate">
            Tono: {profile.brandTone}
          </span>
        )}
      </div>

      {/* Template variant picker */}
      {mode === 'templates' && templates.length > 1 && (
        <div className="flex gap-1.5">
          {templates.map((t, i) => (
            <button
              key={i}
              onClick={() => setSelectedIdx(i)}
              className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${
                selectedIdx === i
                  ? 'border-brand-400 bg-brand-50 text-brand-700 font-medium'
                  : 'border-fog text-slate hover:border-fog'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {/* Variable inputs — only unfilled ones */}
      {mode === 'templates' && allVars.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {allVars.map((v) => (
            <div key={v} className="flex items-center gap-1.5">
              <span className="text-[10px] font-medium text-slate">{VAR_LABELS[v] ?? v}</span>
              <input
                type="text"
                placeholder={v === 'nombre' && contactName ? contactName : `Ej: ${v}`}
                value={vars[v] ?? ''}
                onChange={(e) => setVars((prev) => ({ ...prev, [v]: e.target.value }))}
                className="text-xs border border-fog rounded-lg px-2 py-1 w-28 focus:outline-none focus:ring-2 focus:ring-brand-300"
              />
            </div>
          ))}
          {missingVars.length > 0 && (
            <span className="text-[10px] text-amber-500 self-center">
              Rellena {missingVars.map((v) => VAR_LABELS[v]).join(', ')}
            </span>
          )}
        </div>
      )}

      {/* Preview / draft editor */}
      {previewText && (
        <textarea
          value={previewText}
          onChange={(e) => { if (mode === 'draft') setDraft(e.target.value) }}
          readOnly={mode === 'templates'}
          rows={4}
          className={`w-full text-sm rounded-xl p-3 border resize-none focus:outline-none focus:ring-2 focus:ring-brand-300 ${
            mode === 'templates'
              ? 'bg-mist border-fog text-slate cursor-default'
              : 'bg-white border-fog text-ink'
          }`}
        />
      )}

      {/* Signature preview */}
      {previewText && profile?.defaultSignature && (
        <p className="text-xs text-slate">
          Se agrega al copiar: <span className="italic text-slate">{profile.defaultSignature}</span>
        </p>
      )}

      {/* Actions row */}
      {previewText && (
        <div className="flex items-center gap-3">
          <button
            onClick={handleCopy}
            className="text-xs bg-brand-600 text-white px-3 py-1.5 rounded-lg font-semibold hover:bg-brand-700 transition-colors"
          >
            {copied ? '✓ Copiado' : 'Copiar respuesta'}
          </button>
          {mode === 'templates' && tpl?.nextStep && (
            <p className="text-xs text-slate flex-1 line-clamp-1">
              Siguiente: {tpl.nextStep}
            </p>
          )}
          {mode === 'draft' && (
            <button
              onClick={() => { setMode('templates'); setDraft('') }}
              className="text-xs text-slate hover:text-slate transition-colors"
            >
              Volver a plantillas
            </button>
          )}
        </div>
      )}

    </div>
  )
}
