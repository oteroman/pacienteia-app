# 15 — Sugerencias de Respuesta IA en el Hilo de Conversación

Generación automática de respuestas sugeridas por Gemini dentro del compositor de mensajes de WhatsApp, con contexto completo del paciente.

---

## Concepto

Cuando el staff está respondiendo en un hilo de WhatsApp, puede pedir una sugerencia de respuesta al copiloto con un click. Gemini lee los últimos 12 mensajes del hilo más la ficha del paciente y genera un borrador listo para editar y enviar. El staff siempre tiene el control final — la sugerencia nunca se envía sola.

**Diferenciador:** no es un template genérico. Cada sugerencia conoce el nombre del paciente, su historial, su última cita, y el contexto de la conversación actual.

---

## Flujo de Usuario

1. Staff abre un hilo en `/inbox/conversations/[id]`
2. Debajo del textarea del compositor, aparece el botón **✨ Sugerencia IA**
3. Click → spinner de carga → aparece una card morada con el texto sugerido
4. **"Usar esta respuesta →"** copia el texto al textarea y le da el foco
5. Staff edita si quiere y presiona Enter para enviar
6. **"✕"** descarta la sugerencia si no sirve

---

## Arquitectura

### Frontend — `MessageComposer.tsx`

Archivo: `app/(dashboard)/inbox/conversations/[id]/MessageComposer.tsx`

Client Component (`'use client'`). Estados locales:

```typescript
const [suggestion,     setSuggestion]     = useState<string | null>(null)
const [loadingSuggest, setLoadingSuggest] = useState(false)
const [suggestError,   setSuggestError]   = useState<string | null>(null)
```

`handleSuggest()`: llama `POST /api/ai/suggest-reply` con `{ conversationId }`. En éxito, guarda la sugerencia en estado. En error, muestra mensaje inline.

`useSuggestion()`: escribe el texto directamente en el `textarea` via `ref` y le da foco — el staff puede editar antes de enviar.

Después de un envío exitoso (`state?.ok`), la sugerencia se descarta automáticamente.

### Backend — `route.ts`

Archivo: `app/api/ai/suggest-reply/route.ts`

Requiere sesión autenticada y `organization_id` activo (no es público).

**Contexto que construye el prompt:**

| Fuente | Datos |
|--------|-------|
| `messages` | Últimos 12 mensajes del hilo, orden cronológico |
| `patients` | `full_name`, `status`, días desde última visita |
| `appointments` | Última cita: tratamiento, fecha, estado |
| `organizations` | Nombre de la clínica |

**Prompt:**
```
Eres la recepcionista de {clinicName}, una clínica en Lima, Perú.
Redacta UNA respuesta breve, amable y en español natural para el paciente.

Paciente: ...
Última visita: hace X días
Última cita: ...

Conversación reciente:
Paciente: ...
Clínica: ...

Instrucciones:
- Solo el texto del mensaje, sin comillas ni explicaciones
- Máximo 3 oraciones, tono cálido e informal
- NUNCA diagnósticos, tratamientos médicos ni consejos de salud
```

**Respuesta:** `{ suggestion: string }` o `{ error: string }` con código HTTP apropiado.

---

## Casos de Uso Óptimos

- Paciente pregunta horarios o servicios → sugerencia con info de la clínica
- Paciente con queja → sugerencia empática con disculpa y oferta de solución
- Paciente quiere reagendar → sugerencia que invita a dar disponibilidad
- Conversación inactiva que reactiva → sugerencia de seguimiento cálido

---

## Archivos Clave

| Archivo | Propósito |
|---------|-----------|
| `app/(dashboard)/inbox/conversations/[id]/MessageComposer.tsx` | UI: botón, spinner, card de sugerencia, acción "Usar" |
| `app/api/ai/suggest-reply/route.ts` | Endpoint POST: construye contexto, llama Gemini, retorna sugerencia |

---

## Notas para Desarrolladores

- **La IA nunca envía sola.** El texto llega al textarea — el staff lo revisa y presiona Enter. Es un asistente, no un bot.
- **Sin estado en servidor.** La sugerencia vive en React state del cliente. Si el staff recarga, desaparece — es intencional.
- **Rate limiting:** no implementado. Si el uso crece, agregar un límite por `user_id` (ej. 20 sugerencias/hora) en el route handler.
- **La Regla de Hierro aplica aquí:** el prompt prohíbe explícitamente diagnósticos y consejos de salud. Si Gemini los incluyera de todas formas, el staff los vería antes de enviar y podría corregirlos.
