import type { UsageGateResult } from '@/lib/plans/gating'
import { UNLIMITED } from '@/lib/plans/config'

interface UsageBarProps {
  label: string
  gate: UsageGateResult
  unit?: string
}

function barColor(result: UsageGateResult['result']): string {
  if (result === 'hard_blocked') return 'bg-red-500'
  if (result === 'soft_blocked') return 'bg-yellow-400'
  return 'bg-brand-500'
}

function textColor(result: UsageGateResult['result']): string {
  if (result === 'hard_blocked') return 'text-red-600'
  if (result === 'soft_blocked') return 'text-yellow-700'
  return 'text-slate'
}

export function UsageBar({ label, gate, unit = '' }: UsageBarProps) {
  const isUnlimited = gate.limit === UNLIMITED

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-slate">{label}</span>
        {isUnlimited ? (
          <span className="text-slate text-xs">Ilimitado</span>
        ) : (
          <span className={`text-xs font-medium ${textColor(gate.result)}`}>
            {gate.used}{unit} / {gate.limit}{unit}
            {gate.result !== 'allowed' && (
              <span className="ml-1">
                ({gate.pct}%)
              </span>
            )}
          </span>
        )}
      </div>

      {!isUnlimited && (
        <div className="h-2 w-full rounded-full bg-[#F3F6F9] overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${barColor(gate.result)}`}
            style={{ width: `${Math.min(gate.pct, 100)}%` }}
          />
        </div>
      )}

      {gate.result === 'soft_blocked' && (
        <p className="text-xs text-yellow-700">
          Te queda poco. Considera subir de plan para no interrumpir tu operación.
        </p>
      )}
      {gate.result === 'hard_blocked' && (
        <p className="text-xs text-red-600 font-medium">
          Límite alcanzado. Sube de plan para continuar creando {label.toLowerCase()}.
        </p>
      )}
    </div>
  )
}
