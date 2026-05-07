// Types shared between server action and client components
// Import only types here — no server code

export type GatingEventName =
  | 'blocked_action_attempted' // user clicked a gated button (before modal)
  | 'modal_opened'             // upgrade modal appeared
  | 'modal_closed'             // modal dismissed without action (X or "Ahora no")
  | 'cta_primary_clicked'      // "Subir a Pro" / "Actualizar ahora"
  | 'cta_secondary_clicked'    // "Ver mi plan"

export type GatingResource  = 'leads' | 'appointments' | 'users'
export type GatingGateState = 'soft_blocked' | 'hard_blocked'
export type GatingOperation = 'create' | 'edit'

export interface GatingEventPayload {
  event:       GatingEventName
  resource?:   GatingResource
  gate_state?: GatingGateState
  operation?:  GatingOperation
  source_page?: string
  metadata?:   Record<string, unknown>
}
