# PacienteIA — DESIGN.md

## Propósito
PacienteIA es una plataforma healthtech B2B enfocada en clínicas y consultorios. La marca debe comunicar confianza médica, claridad operativa, calidez humana y automatización inteligente.

## Instrucción principal para Claude Code
Antes de diseñar o refactorizar cualquier vista, instalar y usar skills orientados a frontend/webapp y respetar estrictamente este archivo como fuente de verdad visual y de branding.

### Skills a instalar / usar
1. website-building
2. Si el flujo requiere documentación adicional, usar también doc.

### Orden de trabajo obligatorio
1. Leer este `DESIGN.md` completo.
2. Tomar este archivo como sistema de branding persistente para toda pantalla nueva o refactorizada.
3. Crear primero un mini design system test si se va a cambiar UI base.
4. Luego rediseñar los módulos del backend de clínicas con consistencia total.
5. Evitar por defecto cualquier estética genérica típica de Claude Code.

## Esencia de marca
- Idea central: “Un cerebro digital que cuida a tus pacientes”.
- Significado del isotipo: red neuronal + flujo + sonrisa.
- Valores visuales: precisión, empatía, continuidad, tecnología confiable.
- Sensación deseada: software médico premium, simple, claro, moderno, humano.

## Personalidad
- Profesional, no fría.
- Tecnológica, no futurista exagerada.
- Cercana, no infantil.
- Eficiente, no corporativa rígida.

## Tipo de producto
- Web app / dashboard / backoffice para clínicas.
- Debe verse como producto serio de operación clínica, no como landing page SaaS genérica.

## Tipografía
Usar la tipografía definida en el brandbook:
- Principal: Inter
- Pesos permitidos: 400 a 900
- Uso recomendado:
  - Títulos principales: 700–800
  - Subtítulos: 600–700
  - Body: 400
  - Datos / labels fuertes: 500–600
- Tipografía monoespaciada complementaria: JetBrains Mono para datos técnicos, métricas compactas, IDs, endpoints o bloques operativos.

## Paleta oficial
Usar exclusivamente la paleta del brandbook como base.

### Colores base
- Azul Médico: `#4A90E2`
- Lima Peruano: `#00A859`
- Morado IA: `#8E44AD`
- Tinta: `#0E1A2B`
- Bruma: `#F8F9FA`
- Niebla: `#DCE2EA`
- Pizarra: `#6B7585`

### Gradiente de marca
- IA Glow: 135deg, `#4A90E2` → `#8E44AD`

## Reglas de color en producto
- El color dominante de UI debe ser **Tinta** sobre fondos claros tipo **Bruma**.
- **Azul Médico** es el principal para acciones, foco, navegación activa y elementos de confianza.
- **Lima Peruano** debe reservarse para wellness, éxito, estados positivos y recuperación.
- **Morado IA** debe usarse como acento de inteligencia, automatización, insights o features AI; no debe invadir toda la interfaz.
- El gradiente IA Glow debe usarse solo en momentos de marca o elementos muy puntuales: logo, highlights AI, badges especiales, splash states. No usarlo masivamente en cards, fondos completos ni botones principales.

## Reglas de composición
- Predominio de superficies limpias y claras.
- Mucho aire visual, pero sin perder densidad operativa.
- Grid sobrio, alineación precisa, espaciado consistente.
- El backend debe priorizar legibilidad de tablas, agendas, pacientes, estados, responsables, recordatorios y acciones.
- Debe sentirse más cercano a un software clínico premium que a un dashboard de analytics genérico.

## Estilo de componentes
### Cards
- Evitar cards infladas o demasiado redondeadas.
- Border sutil en `#DCE2EA` o sombra muy ligera.
- Radio moderado, no "bubble UI".
- Las cards no deben ser el recurso visual dominante de toda pantalla.

### Botones
- Primario: Azul Médico con texto blanco.
- Secundario: fondo claro con borde Niebla/Tinta suave.
- AI action: usar Morado IA o acento con gradiente solo si la acción es claramente de inteligencia artificial.

### Inputs y formularios
- Muy limpios, sobrios, profesionales.
- Enfoque en claridad y accesibilidad.
- Focus ring basado en Azul Médico.

### Tablas y listas
- Alta prioridad.
- Compactas pero respirables.
- Zebra muy sutil o divisores delicados.
- Estados y prioridad con badges discretos, no chillones.

### Sidebar / navegación
- Minimalista.
- Puede usar fondo Tinta o claro dependiendo del layout, pero debe mantenerse premium y clínico.
- Iconografía simple, consistente, sin decoraciones innecesarias.

## Uso del branding visual
- El isotipo puede aparecer en login, loading, módulos AI, empty states o favicon.
- El logo completo debe respetar proporciones y no reinventarse.
- No alterar la anatomía del isotipo: nodos conectados arriba + curva sonrisa abajo.

## Lo que Claude Code debe evitar siempre
- No usar la clásica paleta morado/azul neón genérica.
- No usar gradientes exagerados como fondo de secciones completas del dashboard.
- No usar iconos dentro de círculos de color por defecto.
- No crear grids de 3 columnas repetitivas tipo template SaaS.
- No centrar todo.
- No usar cards idénticas para cada bloque de información.
- No usar sombras pesadas.
- No usar bordes laterales de color en cards.
- No diseñar como startup fintech o cripto.
- No inventar una nueva identidad visual distinta al brandbook.

## Referencia estética a perseguir
- Healthtech / SaaS premium.
- Sobrio, editorial, sistemático.
- Tecnología confiable con calidez humana.
- IA visible como capacidad, no como gimmick visual.

## Prioridades por módulo
### Dashboard clínico
- KPIs claros
- agenda del día
- pacientes inactivos
- no-shows
- recuperación / reactivación
- alertas operativas

### Gestión de pacientes
- búsqueda excelente
- filtros claros
- timeline comprensible
- estados y etiquetas discretas

### Agenda y citas
- legibilidad de calendario
- confirmaciones por WhatsApp
- reprogramaciones
- alertas y disponibilidad

### IA / insights
- usar Morado IA y gradiente solo para resaltar inteligencia, sugerencias, automatización o predicción
- estas piezas deben destacar, pero sin romper la sobriedad general del sistema

## Tokens sugeridos
```css
:root {
  --bg: #F8F9FA;
  --surface: #FFFFFF;
  --surface-alt: #F3F6F9;
  --border: #DCE2EA;
  --text: #0E1A2B;
  --text-muted: #6B7585;
  --primary: #4A90E2;
  --success: #00A859;
  --ai: #8E44AD;
  --gradient-brand: linear-gradient(135deg, #4A90E2 0%, #8E44AD 100%);
  --radius-sm: 10px;
  --radius-md: 14px;
  --radius-lg: 18px;
}
```

## Prompt maestro para Claude Code
Usa este prompt al iniciar una tarea nueva de UI:

```md
Instala y usa los skills necesarios para diseño de producto en Claude Code, especialmente `website-building`, y toma `DESIGN.md` como fuente de verdad visual permanente.

Contexto: estoy desarrollando PacienteIA, una plataforma healthtech B2B para clínicas y consultorios. Ya existe un brandbook definido y debes respetarlo estrictamente. No quiero una estética genérica de Claude Code.

Tu tarea es rediseñar/refinar el backend de clínicas con criterio de product design senior.

Reglas obligatorias:
- Leer y obedecer `DESIGN.md` antes de proponer UI.
- Mantener la identidad de PacienteIA: confianza médica, claridad operativa, calidez humana y automatización inteligente.
- Usar Inter como tipografía principal y JetBrains Mono solo para datos técnicos o labels operativos.
- Usar la paleta oficial: Azul Médico `#4A90E2`, Lima Peruano `#00A859`, Morado IA `#8E44AD`, Tinta `#0E1A2B`, Bruma `#F8F9FA`, Niebla `#DCE2EA`, Pizarra `#6B7585`.
- Usar el gradiente de marca `#4A90E2 -> #8E44AD` solo en momentos AI o branding puntual.
- Diseñar como web app clínica premium, no como landing page SaaS ni dashboard fintech.
- Priorizar legibilidad, jerarquía, tablas, agenda, estados clínicos, acciones rápidas y eficiencia operativa.
- Evitar cards genéricas, bordes de color, iconos en círculos, sombras pesadas, layouts repetitivos y fondos exagerados.

Proceso requerido:
1. Resume cómo entiendes la marca y sus reglas visuales.
2. Propón un mini design system específico para la app.
3. Define tokens, componentes base y patrones de layout.
4. Rediseña el módulo solicitado respetando la sobriedad clínica y el branding.
5. Explica qué decisiones tomaste y por qué encajan con PacienteIA.

Módulo inicial a trabajar:
[PEGAR AQUÍ EL MÓDULO: dashboard de clínicas / pacientes / agenda / campañas / IA]
```

## Prompt corto para iteraciones rápidas
```md
Usa `website-building`, lee `DESIGN.md` y refactoriza esta pantalla para que se vea como PacienteIA: healthtech B2B premium, sobria, clara y humana. Respeta tipografía Inter, paleta oficial y uso restringido del morado/gradiente solo para AI. Elimina estética genérica de Claude Code.
```
