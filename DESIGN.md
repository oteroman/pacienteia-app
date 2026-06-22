# PacienteIA — DESIGN.md
> Fuente de verdad visual. Leer antes de crear o modificar cualquier pantalla.

---

## Esencia de marca

**Tagline:** "Un cerebro digital que cuida a tus pacientes"
**Tipo de producto:** Web app B2B para clínicas y consultorios — backoffice clínico premium
**Sensación deseada:** software médico serio, limpio, humano. No una landing page SaaS.

### Personalidad
| Sí | No |
|----|-----|
| Profesional | Frío |
| Tecnológico | Futurista exagerado |
| Cercano | Infantil |
| Eficiente | Corporativo rígido |

---

## Paleta oficial

| Token | Nombre | HEX | Uso |
|-------|--------|-----|-----|
| `--primary` | Azul Médico | `#4A90E2` | Acciones principales, navegación activa, focus, confianza |
| `--success` | Lima Peruano | `#00A859` | Wellness, éxito, estados positivos, recuperación |
| `--ai` | Morado IA | `#8E44AD` | Funciones AI, automatización, insights, badges especiales |
| `--text` | Tinta | `#0E1A2B` | Texto principal, sidebar oscuro |
| `--bg` | Bruma | `#F8F9FA` | Fondo base de la aplicación |
| `--border` | Niebla | `#DCE2EA` | Bordes, divisores, separadores |
| `--text-muted` | Pizarra | `#6B7585` | Texto secundario, labels, placeholders |

### Gradiente de marca — IA Glow
```
linear-gradient(135deg, #4A90E2 0%, #8E44AD 100%)
```
**Usar SOLO en:** logo, isotipo, badges AI, momentos de branding puntual, highlights de IA.
**Nunca en:** fondos de sección completos, botones primarios de operación, cards generales.

---

## Tipografía

### Principal — Inter
- Fuente: `Inter` (Google Fonts)
- Pesos permitidos: 400 → 900

| Uso | Peso | Notas |
|-----|------|-------|
| Títulos principales | 700–800 | `letter-spacing: -0.03em` a `-0.045em` |
| Subtítulos / secciones | 600–700 | |
| Body / párrafos | 400 | `line-height: 1.6` |
| Labels / datos fuertes | 500–600 | |
| Wordmark "PacienteIA" | 800 | `letter-spacing: -4.5%` |

### Complementaria — JetBrains Mono
- Usar **exclusivamente** para: datos técnicos, métricas compactas, IDs, endpoints, bloques operativos, código.
- Peso: 500
- Ejemplos: `/api/agenda`, `ID: 1169072966279649`, timestamps, hashes

---

## Design Tokens

```css
:root {
  /* Colores */
  --bg:            #F8F9FA;
  --surface:       #FFFFFF;
  --surface-alt:   #F3F6F9;
  --border:        #DCE2EA;
  --text:          #0E1A2B;
  --text-muted:    #6B7585;
  --primary:       #4A90E2;
  --success:       #00A859;
  --ai:            #8E44AD;
  --gradient-ai:   linear-gradient(135deg, #4A90E2 0%, #8E44AD 100%);

  /* Tipografía */
  --font-sans:     'Inter', system-ui, -apple-system, sans-serif;
  --font-mono:     'JetBrains Mono', 'Fira Code', monospace;

  /* Radios */
  --radius-sm:     8px;
  --radius-md:     12px;
  --radius-lg:     16px;
  --radius-xl:     20px;

  /* Sombras */
  --shadow-xs:     0 1px 2px rgba(14,26,43,0.06);
  --shadow-sm:     0 2px 6px rgba(14,26,43,0.08);
  --shadow-md:     0 4px 16px rgba(14,26,43,0.10);
}
```

---

## Isotipo — Anatomía y reglas

### Estructura (3 elementos, 1 gesto)
1. **Nodos neuronales** — tres puntos conectados en triángulo (IA, aprendizaje, decisión)
2. **Curva sonrisa** — arco inferior ascendente (resultado humano, paciente que vuelve)
3. **Contenedor** — esquinas redondeadas ~22% border-radius (calidez, escala perfecta a favicon)

### Variantes disponibles
| Variante | Archivo | Cuándo usar |
|----------|---------|-------------|
| Principal gradiente | `assets/logo-principal-gradiente.png` | Header, login, onboarding |
| Monocromo tinta | `assets/logo-monocromo-tinta.png` | Documentos, fondos claros |
| Monocromo reverso | `assets/logo-monocromo-reverso.png` | Fondos oscuros, sidebar dark |
| Isotipo flotante | `assets/logo-isotipo-flotante.png` | Favicon, app icon, loading |
| Icono solo | `assets/logo-icono.png` | Favicon, badge pequeño |

### Tamaños mínimos
| Contexto | Mínimo |
|----------|--------|
| Web (logo completo) | 120 px |
| Web (isotipo solo) | 16 px (favicon) |
| Print (logo completo) | 30 mm |
| Print (isotipo solo) | 6 mm |

### Clear space
- Reservar la altura del isotipo (`x`) como margen alrededor del logo en todas las direcciones.

### Reglas de uso
| ✓ Correcto | ✗ Incorrecto |
|-----------|-------------|
| Versión oficial sobre fondos limpios | Cambiar colores del isotipo |
| Gradiente sobre fondo oscuro Tinta | Deformar o inclinar la marca |
| Versión mono cuando no hay color | Colocar sobre fondos con bajo contraste |
| Simplificar nodos a escala muy pequeña | Reemplazar por iniciales o emojis |

---

## Componentes UI

### Cards
- Border: `1px solid var(--border)` — nunca border lateral de color
- Sombra: `var(--shadow-xs)` o `var(--shadow-sm)` — nunca sombras pesadas
- Border-radius: `var(--radius-lg)` (16px) para cards principales, `var(--radius-md)` para cards compactas
- No usar como único recurso visual — alternar con tablas, listas y secciones planas

### Botones
| Tipo | Fondo | Texto | Cuándo |
|------|-------|-------|--------|
| Primario | `#4A90E2` | blanco | Acción principal de operación |
| Secundario | `var(--surface)` border `var(--border)` | `var(--text)` | Acción secundaria |
| AI | gradiente IA Glow o `#8E44AD` | blanco | Solo si la acción es explícitamente IA |
| Destructivo | `#EF4444` | blanco | Eliminar, cancelar permanente |

### Inputs y formularios
- Border: `1px solid var(--border)`
- Focus ring: `2px solid var(--primary)` con `offset: 0`
- Background: `var(--surface)` — nunca grises oscuros en modo claro
- Placeholder: `var(--text-muted)`
- Error: `#EF4444` con mensaje debajo, nunca tooltip flotante

### Tablas y listas
- **Alta prioridad en esta app** — son el recurso central de los módulos operativos
- Zebra muy sutil: `#FAFBFC` en filas impares, o divisores `var(--border)` entre filas
- Header de columna: texto 11–12px, `var(--text-muted)`, uppercase, `letter-spacing: 0.06em`
- Datos: 13–14px, `var(--text)`
- Badges de estado: fondo suave + texto del mismo tono (no colores sólidos chillones)
- Acciones de fila: visibles al hover, texto pequeño, sin íconos en círculos

### Badges y estados
```
Estado activo   → bg: #EBF5EB  text: #16a34a
Estado trial    → bg: #FEF9EE  text: #B45309
Estado overdue  → bg: #FFF1EE  text: #C2410C
Estado inactivo → bg: #F3F4F6  text: #6B7280
Estado AI       → bg: #F3EEFF  text: #7C3AED
```
- Font-weight: 500–600, font-size: 11–12px
- Evitar badges grandes o con íconos rellenos

### Sidebar / Navegación
- Puede ser fondo `var(--text)` (Tinta oscuro) o `var(--surface)` (blanco), pero consistente
- Iconografía: 18–20px, línea simple, sin rellenos decorativos
- Item activo: Azul Médico con fondo muy sutil `rgba(74,144,226,0.10)`
- Separadores de sección: `var(--border)` 1px

---

## Reglas de composición

### Layout general
- Fondo base: `var(--bg)` (#F8F9FA) — nunca blanco puro en toda la pantalla
- Superficies de contenido: `var(--surface)` (#FFFFFF)
- Mucho aire visual, pero con densidad operativa suficiente — no es un dashboard de analytics vacío
- Grid máximo de contenido: `max-width: 1280px`
- Alineación izquierda — no centrar todo
- Espaciado base: múltiplos de 4px (4, 8, 12, 16, 20, 24, 32, 40, 48)

### Jerarquía visual por módulo
| Módulo | Elemento dominante |
|--------|-------------------|
| Dashboard clínico | KPIs compactos + agenda del día + alertas |
| Gestión de pacientes | Tabla con búsqueda y filtros |
| Citas / agenda | Vista de lista o calendario limpio |
| Inbox WhatsApp | Panel de lista + hilo de conversación |
| IA / copiloto | Gradiente AI + morado como acento puntual |
| Analytics | Métricas + tablas, mínimos gráficos decorativos |

---

## Lo que Claude Code debe evitar siempre

| Prohibido | Alternativa |
|-----------|-------------|
| Paleta morado/azul neón genérica | Usar la paleta oficial del brandbook |
| Gradientes de fondo en secciones del dashboard | Fondos planos `var(--bg)` o `var(--surface)` |
| Íconos dentro de círculos de color | Íconos sueltos con color del mismo tono |
| Grids de 3 columnas idénticas tipo template | Layouts asimétricos según contenido |
| Centrar todo horizontalmente | Alineación izquierda, jerarquía editorial |
| Cards idénticas para todo tipo de información | Tablas, listas y secciones planas para datos |
| Sombras pesadas | `var(--shadow-xs)` o `var(--shadow-sm)` |
| Bordes laterales de color en cards | Border completo sutil o sin border |
| Estética fintech / cripto | Healthtech premium, sobrio, clínico |
| Inventar identidad visual distinta | Siempre partir del brandbook |

---

## Referencia estética

Apuntar a un cruce entre:
- **Linear** (claridad, eficiencia, producto premium)
- **Notion** (sobriedad, tipografía editorial, aire)
- **Software clínico premium** (tablas funcionales, legibilidad, estados claros)

Adaptado al contexto latinoamericano: más calidez, más color de marca, menos frialdad escandinava.

---

## Prompt maestro para nuevas pantallas

Pegar esto al inicio de cualquier tarea de UI nueva:

```
Lee DESIGN.md como fuente de verdad visual antes de empezar.

Estás construyendo PacienteIA: plataforma healthtech B2B para clínicas en Lima, Perú.
No es una landing page SaaS genérica — es un backoffice clínico premium.

Reglas obligatorias:
- Tipografía: Inter principal, JetBrains Mono solo para datos técnicos
- Paleta: Azul Médico #4A90E2 (primary), Lima Peruano #00A859 (success),
  Morado IA #8E44AD (AI only), Tinta #0E1A2B (text), Bruma #F8F9FA (bg),
  Niebla #DCE2EA (border), Pizarra #6B7585 (muted)
- Gradiente IA Glow solo para momentos AI o branding — nunca como fondo general
- Priorizar tablas, listas y legibilidad operativa sobre cards y decoración
- Evitar: cards infladas, bordes de color, íconos en círculos, sombras pesadas,
  grids repetitivos, centrado excesivo, estética fintech

Módulo a trabajar: [INSERTAR MÓDULO]
```

---

## Prompt corto para iteraciones

```
Usa DESIGN.md. Refactoriza esta pantalla como PacienteIA: healthtech B2B premium,
Inter + paleta oficial, morado/gradiente solo para AI, sin estética SaaS genérica.
```

---

*Última actualización: 2026-05-15 — basado en brandbook oficial PacienteIA v1*
