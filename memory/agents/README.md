# Memoria de los subagentes

Cada subagente del SDLC agéntico tiene su propio archivo `memory/agents/<agente>.md` — un registro persistente de lo que ha construido y lo que hará. Sobrevive entre sesiones y permite retomar el hilo sin re-investigar.

## Convención (todos los agentes la siguen)
1. **Antes de trabajar:** el agente lee su `memory/agents/<agente>.md` para saber qué ya hizo y qué está pendiente.
2. **Al terminar:** añade una entrada al **tope** del historial (orden cronológico inverso).

## Formato de entrada
```markdown
### YYYY-MM-DD — <título corto>
- **Qué:** una o dos frases.
- **Archivos:** `ruta/uno.ts`, `ruta/dos.tsx`
- **Resultado:** compila / aplicado / pendiente de confirmación / etc.
- **Próximo:** el siguiente paso lógico, si lo hay.
```

## Reglas
- Conciso. Registra **decisiones, estado y contexto para retomar** — no dupliques lo que ya está en el código.
- Si algo queda a medias o bloqueado, déjalo explícito en la sección **Pendiente / próximo**.
- Una responsabilidad por agente; una memoria por agente.
