# Guía de Usuario — PacienteIA

> Para recepcionistas, administradores y dueños de clínica. Sin tecnicismos.
> Actualizada al 2026-05-19.

---

## Contenido

1. [¿Qué es PacienteIA?](#1-qué-es-pacienteia)
2. [Dashboard — Pantalla de inicio](#2-dashboard--pantalla-de-inicio)
3. [Alertas operacionales](#3-alertas-operacionales)
4. [Bandeja unificada (Inbox)](#4-bandeja-unificada-inbox)
5. [Leads y Pipeline de Captación](#5-leads-y-pipeline-de-captación)
6. [Pacientes](#6-pacientes)
7. [Citas](#7-citas)
8. [Auto-agendamiento desde WhatsApp](#8-auto-agendamiento-desde-whatsapp)
9. [Recordatorios automáticos](#9-recordatorios-automáticos)
10. [Backfill de slots](#10-backfill-de-slots)
11. [Reactivación de pacientes inactivos](#11-reactivación-de-pacientes-inactivos)
12. [Encuesta post-cita y reputación](#12-encuesta-post-cita-y-reputación)
13. [Oportunidades de Revenue](#13-oportunidades-de-revenue)
14. [Copiloto IA](#14-copiloto-ia)
15. [Analítica](#15-analítica)
16. [Crecimiento mensual](#16-crecimiento-mensual)
17. [Redes Sociales — Facebook, Instagram y TikTok](#17-redes-sociales--facebook-instagram-y-tiktok)
18. [Configuración de la clínica](#18-configuración-de-la-clínica)
19. [Panel de Superadmin](#19-panel-de-superadmin)

---

## 1. ¿Qué es PacienteIA?

PacienteIA es un **gerente operativo con inteligencia artificial** para clínicas. Centraliza y automatiza las operaciones diarias a través de WhatsApp: capta leads, confirma citas, reactiva pacientes inactivos, protege la reputación online y da visibilidad en tiempo real de lo que se pierde y lo que se gana.

**No es un chatbot.** Es un copiloto que actúa antes de que el paciente se pierda.

**Regla de Hierro:** El sistema nunca da diagnósticos, prescripciones ni consejos de salud. Su rol es exclusivamente operativo.

### Qué resuelve

| Problema | Cómo lo resuelve |
|----------|-----------------|
| Pacientes que no llegan sin avisar (no-shows) | Recordatorios automáticos 24h y 2h antes con confirmación interactiva |
| Leads que se pierden por respuesta lenta | Clasificación con IA en segundos, SLA visible, alertas al equipo |
| Pacientes que dejaron de venir | Campaña de reactivación automática en 2 pasos |
| Reseñas negativas en Google | Escudo de reputación: solo los pacientes felices van a Google Reviews |
| Recepcionista sin contexto al responder | Sugerencia de respuesta IA en tiempo real en cada conversación |
| Slots cancelados que quedan vacíos | Backfill automático: contacta candidatos en segundos |

---

## 2. Dashboard — Pantalla de inicio

El dashboard es la primera pantalla al ingresar. Muestra el estado operacional del día en tiempo real.

### Tarjetas KPI

| Tarjeta | Qué cuenta | Por qué importa |
|---------|-----------|----------------|
| **Citas hoy** | Total de citas del día con desglose por estado (confirmadas, pendientes, inasistencias) | Vistazo inmediato a la carga del día. Muchas "pendientes" a pocas horas = llamar al paciente |
| **Ingresos del día** | Suma del precio de citas marcadas como "Atendida" hoy | Avance del objetivo diario sin revisar cada cita manualmente |
| **Mensajes sin leer** | Mensajes de WhatsApp que llegaron y no han sido leídos | Mide si la bandeja está al día. Click lleva directo a las conversaciones pendientes |
| **Leads nuevos hoy** | Consultas/solicitudes que ingresaron hoy (formulario web, TikTok, etc.) y no están gestionadas | Oportunidades nuevas esperando contacto |

### Agenda del día

Lista completa de citas del día, ordenadas por horario. Cada fila muestra: nombre del paciente, tratamiento, profesional asignado y precio. Click en cualquier cita abre el detalle para editarla, cambiar estado o agregar notas.

**Estados de una cita:**

| Estado | Significado |
|--------|------------|
| Programada | Agendada, sin confirmación del paciente |
| Confirmada | El paciente respondió que asistirá |
| Atendida | La cita se realizó |
| Cancelada | El paciente o la clínica cancelaron |
| Inasistencia | El paciente no llegó sin avisar |

### Widgets de inteligencia

Debajo de la agenda aparecen automáticamente cuando hay datos relevantes:

- **Pacientes en riesgo de abandono** — Pacientes sin visita en más de 60 días. Click lleva a la lista filtrada.
- **Oportunidades de agenda esta semana** — Pacientes cuyo ciclo de retratamiento está venciendo y no han agendado. Click lleva a la página de Oportunidades.

---

## 3. Alertas operacionales

Las alertas aparecen en la parte superior del dashboard cuando hay situaciones que requieren atención. No es necesario buscarlas.

| Alerta | Qué la genera | Qué hacer |
|--------|--------------|-----------|
| **Leads sin contactar >2h** (rojo) | Consultas que llegaron hace más de 2 horas sin atención. Las clínicas que responden en menos de 2h tienen tasas de conversión hasta 3 veces mayores | Ir a Leads y contactar por WhatsApp de inmediato |
| **Alertas de reputación** (amarillo) | Uno o más pacientes calificaron 1-3 estrellas en la encuesta post-cita en los últimos 7 días | Ir a Analítica → Reputación e identificar al paciente. Hacer seguimiento antes de que lo publique en Google |
| **Tareas urgentes** (naranja) | El copiloto generó tareas de prioridad alta sin atender | Ir a Copiloto y revisar. Normalmente corresponden a pacientes en riesgo detectados automáticamente |
| **Pacientes sin visita >60 días** (morado) | Pacientes activos que no han tenido cita en 60 o más días | Ir a Pacientes filtrado por inactividad. Considerar reactivación manual o campaña automática |
| **Oportunidades de agenda** (verde) | Pacientes cuyo ciclo de retratamiento está próximo a vencer | Ir a Oportunidades y agendar o contactar directamente |

---

## 4. Bandeja de WhatsApp (Inbox)

La bandeja unificada (`/inbox`) muestra todas las conversaciones de WhatsApp de la clínica en un solo lugar. Todo el equipo puede ver y responder desde aquí.

> **En celular o tablet:** la bandeja funciona como WhatsApp — primero ves la lista de conversaciones (pantalla completa) y al tocar una, la lista desaparece y ves el hilo completo. El botón **←** vuelve a la lista. En pantallas grandes (laptop/escritorio) aparecen los dos paneles simultáneamente.

### Lista de conversaciones

Cada conversación muestra:
- Nombre del paciente (o número si es contacto desconocido)
- Último mensaje recibido y hace cuánto tiempo
- **Badge de intención** — etiqueta de color que indica qué quiere el paciente según la IA

**Filtros disponibles:**

| Filtro | Qué muestra |
|--------|------------|
| Todos | Todas las conversaciones activas |
| Urgentes | Conversaciones con intent de urgencia médica detectada |
| Cancelan | Pacientes con intención de cancelar su cita |
| Citas | Solicitudes de nueva cita o reagendamiento |
| Precios | Consultas sobre precios o servicios |

### Intenciones detectadas automáticamente (NLU)

Cada mensaje que llega es analizado por la IA en tiempo real. El sistema detecta una de estas 9 intenciones:

| Intención | Badge | Qué significa |
|-----------|-------|--------------|
| Solicitud de cita | Azul | El paciente quiere agendar |
| Intención de cancelar | Rojo | Quiere cancelar su cita. El sistema ya generó una tarea en el copiloto |
| Reagendamiento | Naranja | Quiere cambiar el horario |
| Consulta de precio | Amarillo | Pregunta por costos. El sistema responde automáticamente con el catálogo |
| Insatisfacción | Rojo oscuro | Expresa malestar. Tarea urgente ya generada en copiloto |
| Urgencia médica | Rojo vivo | Señal de urgencia real. Tarea urgente generada. Atención inmediata |
| Respuesta positiva | Verde | Confirmación o interés positivo |
| Consulta general | Gris | Pregunta informativa sin acción clara |
| Ninguna | Sin badge | Mensaje sin intención detectable |

> Las respuestas automáticas solo se envían para consultas de precio y urgencias detectadas con alta confianza. En todos los demás casos, el sistema avisa al equipo pero no responde solo.

### Hilo de conversación

Al abrir una conversación se ve el historial completo de mensajes. Cada mensaje tiene su badge de intención si fue clasificado.

En la parte superior aparece un panel de contexto con:
- Nombre y teléfono del paciente
- Última cita (fecha, tratamiento, estado)
- Score de retención del paciente

### Compositor de mensajes

El compositor está en la parte inferior. Para enviar un mensaje:
1. Escribe el texto en el campo de texto
2. Presiona Enter o click en Enviar

**Plantillas de respuesta rápida:** Hay un botón **📋 Plantillas** en la barra de acciones del compositor. Al hacer click se despliega la lista de plantillas guardadas, organizadas por categoría. Haz click en cualquier plantilla para copiarla al campo de texto; luego edítala si necesitas personalizar y envía normalmente.

El sistema incluye **15 plantillas base** listas para usar desde el primer día, organizadas en 6 categorías:

| Categoría | Ejemplos de plantillas incluidas |
|-----------|--------------------------------|
| **Confirmación** | "Cita confirmada", "Solicitar confirmación" |
| **Recordatorio** | "Recordatorio mañana", "Estamos listos para recibirte" |
| **Seguimiento** | "¿Cómo te fue?", "Programar próxima cita", "Pedir referidos" |
| **Reactivación** | "Te extrañamos", "Oferta exclusiva para ti", "Chequeo de bienestar" |
| **Promoción** | "Promo del mes", "Slot disponible hoy" |
| **General** | "Horario de atención", "En breve te atendemos", "Cuéntanos más" |

Las plantillas que contienen `[CAMPOS EN MAYÚSCULAS]` requieren que el staff los complete antes de enviar (ej: `[DÍA]`, `[HORA]`). Las que tienen `{{nombre}}` se usan tal cual — el staff puede personalizar si lo desea.

Las plantillas se administran desde Configuración → Plantillas (`/settings/messages`). Se pueden agregar nuevas, desactivar las que no se usan y organizar por categoría.

**Sugerencia IA:** El botón **✨ Sugerencia IA** genera una respuesta personalizada en segundos. La IA analiza el historial completo de la conversación, el perfil del paciente y su última cita.

- La sugerencia aparece en una tarjeta morada debajo del compositor
- Haz click en **"Usar esta respuesta →"** para copiarla al compositor
- Puedes editarla antes de enviar
- **La IA nunca envía sola.** Siempre es el staff quien revisa y confirma

---

## 5. Leads y Pipeline de Captación

Los leads son todas las personas que mostraron interés en la clínica pero aún no son pacientes confirmados. Llegan desde: formulario web, TikTok Ads, WhatsApp directo, o registro manual.

### Lista de leads (`/leads`)

Muestra todos los leads con filtros por estado del pipeline:

| Estado del pipeline | Significado |
|--------------------|------------|
| **Nuevo** | Recién llegado, sin contacto aún |
| **En contacto** | Alguien del equipo ya le escribió o llamó |
| **Esperando** | A la espera de respuesta del lead |
| **Resuelto** | Convertido a paciente, o descartado |

Cada fila muestra: nombre, canal de origen, prioridad asignada por la IA, y el indicador SLA (tiempo restante o vencido para dar primera respuesta).

**Indicador SLA:**
- Verde: tiempo restante dentro del plazo
- Amarillo: quedan menos de 30 minutos
- Rojo: SLA vencido — respuesta tardía

### Detalle de un lead (`/leads/[id]`)

Muestra toda la información del lead:
- Datos de contacto y canal de origen
- Intención y prioridad clasificadas automáticamente por Gemini
- **Pipeline stepper** — botones para avanzar el estado (En contacto → Esperando → Resuelto)
- Timeline de eventos — historial completo de cada acción: cuándo llegó, quién lo contactó, qué pasó
- Notas internas del equipo

**Acciones disponibles:**

| Acción | Qué hace |
|--------|---------|
| **Marcar en progreso** | Cambia estado a "En contacto" y registra quién está atendiendo |
| **Convertir a paciente** | Crea un registro de paciente con los datos del lead |
| **Agendar cita** | Crea paciente (si no existe) y abre el formulario de nueva cita con los datos prellenados |
| **Descartar** | Marca el lead como no válido. Se puede revertir |
| **Agregar nota** | Registra un comentario interno visible en el timeline |

### Cómo llegan los leads

- **WhatsApp directo:** Cuando alguien escribe al número de la clínica por primera vez y el NLU detecta intención de cita, se crea automáticamente un lead en el pipeline
- **Formulario web:** Vía webhook desde el formulario de la web de la clínica
- **TikTok Ads:** Vía webhook desde campañas de TikTok Lead Ads
- **Manual:** El staff puede crear un lead desde `/leads/new`

---

## 6. Pacientes

### Lista de pacientes (`/patients`)

Muestra todos los pacientes registrados con búsqueda por nombre o teléfono. La columna **Retención** muestra el score de retención de cada paciente (visible en pantallas grandes).

Filtros disponibles: todos, nuevos, en riesgo, inactivos.

### Ficha del paciente (`/patients/[id]`)

La ficha centraliza toda la información de un paciente:

- **Datos de contacto:** nombre, teléfono, email, DNI, última visita
- **Contraindicaciones / Alergias:** si están cargadas, aparecen destacadas en rojo con ⚠ al tope de la información clínica. Nunca pasan desapercibidas.
- **Score de retención:** tarjeta con número 0-100, etiqueta (Fiel / Estable / En riesgo / Riesgo alto), barra de progreso y breakdown de factores
- **Fotos antes / después:** galería de imágenes del paciente, organizadas por tipo (Antes, Después, General). Permite subir y borrar fotos directamente.
- **Historial de citas:** todas las citas del paciente con fechas, tratamientos, profesional asignado (con su color) y notas completas de cada sesión
- **Notas:** campo de texto libre para observaciones generales del equipo

**Botones en la cabecera de la ficha:**

| Botón | Qué hace |
|-------|---------|
| **+ Cita** | Abre el formulario de nueva cita con el paciente pre-seleccionado |
| **📄 Consentimiento** | Abre el documento de consentimiento informado pre-llenado, listo para imprimir o guardar como PDF |
| **Editar** | Abre el formulario de edición de datos del paciente |

### Contraindicaciones y Alergias

El campo de contraindicaciones está en el formulario de edición del paciente (Editar → sección "Contraindicaciones / Alergias"). Sirve para registrar:
- Alergias a productos o anestésicos (ej: "Alérgica a lidocaína")
- Condiciones que contraindican ciertos tratamientos (ej: "No aplicar botox en frente — historial de parálisis facial")
- Medicamentos que interfieren con procedimientos

Cuando está completado, aparece en **rojo con ⚠** en la ficha del paciente, antes del historial de citas, para que cualquier miembro del equipo lo vea antes de atender.

### Fotos antes / después

La sección **"Fotos antes / después"** de la ficha permite documentar el progreso visual del tratamiento:

1. Selecciona el tipo de foto: **Antes**, **Después** o **General**
2. Click en **+ Subir foto** y elige la imagen del dispositivo
3. La foto aparece en la galería agrupada por tipo
4. Para ampliar: click en la foto. Para borrar: pasar el cursor sobre la foto y click en **Borrar**

Las fotos son privadas y solo visibles para el equipo de la clínica.

### Consentimiento informado

El botón **📄 Consentimiento** abre una página con el documento de consentimiento informado pre-llenado con los datos del paciente y el nombre de la clínica. Incluye:
- Datos del paciente (nombre, DNI, teléfono, email)
- Texto estándar de consentimiento para procedimientos estéticos
- Campos de firma para el paciente y el profesional tratante
- Fecha del día

Para obtener el PDF: click en **🖨️ Imprimir / Guardar PDF** y en el diálogo del navegador elegir "Guardar como PDF".

### Score de Retención

El score de retención es un número del 0 al 100 que mide qué tan probable es que el paciente continúe viniendo. Se calcula automáticamente y se actualiza con cada cita.

**Cómo se calcula:**

El sistema parte de 100 puntos y aplica bonificaciones o penalizaciones:

*Penalizaciones por inactividad (tiempo desde la última cita):*
- Más de 120 días sin visita: −45 puntos
- Entre 90 y 120 días: −30 puntos
- Entre 60 y 90 días: −20 puntos
- Entre 30 y 60 días: −10 puntos

*Bonificación por cita futura:*
- Tiene una cita agendada próxima: +15 puntos

*Penalizaciones por inasistencias:*
- Más del 50% de sus citas fueron no-shows: −35 puntos
- Entre 25% y 50%: −20 puntos
- Entre 10% y 25%: −10 puntos
- Al menos un no-show (<10%): −5 puntos
- Si su última cita fue una inasistencia: −10 puntos adicionales

*Bonificaciones por fidelidad:*
- 6 o más citas históricas: +10 puntos
- 3 a 5 citas históricas: +5 puntos

**Etiquetas y acciones recomendadas:**

| Score | Etiqueta | Interpretación | Acción |
|-------|----------|---------------|--------|
| 80–100 | **Fiel** | Activo, buena frecuencia, pocas inasistencias | Mantener con recordatorios y seguimiento normal |
| 60–79 | **Estable** | Visita con cierta regularidad pero puede estar perdiendo frecuencia | Asegurarse de que tenga próxima cita antes de salir |
| 40–59 | **En riesgo** | Lleva tiempo sin venir o historial irregular | Reactivación personalizada o llamada de seguimiento |
| 0–39 | **Riesgo alto** | Inactivo por mucho tiempo o muchas inasistencias | Prioridad para campaña de reactivación automática |

---

## 7. Citas

### Lista de citas

Accessible desde el menú. Muestra todas las citas con filtros por fecha, estado, profesional y servicio.

### Nueva cita (`/appointments/new`)

Formulario para agendar una cita. Campos requeridos:
- Paciente (búsqueda por nombre o teléfono)
- Servicio (selección del catálogo de la clínica)
- Profesional (dropdown con los profesionales activos)
- Fecha y hora
- Precio (se pre-llena desde el catálogo, editable)
- Notas (opcional)

**Validación de horarios:** Al guardar la cita, el sistema verifica automáticamente:
1. **Bloqueos de fecha** — si el profesional o la clínica tiene ese día bloqueado (feriado, vacaciones), la cita no se puede crear. El sistema muestra el motivo.
2. **Horario de atención** — si el profesional tiene horarios configurados y la hora elegida está fuera de su jornada, el sistema indica cuál es su horario. Ejemplo: *"Dr. Loli atiende de 10:00–16:00 los lunes. El horario 09:00 está fuera de su agenda."*

> Si el profesional no tiene horarios configurados en Ajustes → Horarios, la validación no aplica y se puede agendar libremente.

### Detalle de cita (`/appointments/[id]`)

Muestra toda la información de la cita. Desde aquí se puede:
- Cambiar el estado (Confirmar, Marcar atendida, Cancelar, Registrar inasistencia)
- Editar los datos de la cita
- **Agregar notas directamente desde la página** — campo de texto inline, guardado automático

### Editar cita (`/appointments/[id]/edit`)

Permite modificar todos los campos de una cita ya creada: paciente, servicio, profesional, fecha, hora y precio.

---

## 8. Auto-agendamiento desde WhatsApp

Los pacientes pueden agendar su cita directamente desde WhatsApp sin llamar ni ir a la clínica.

### Cómo funciona

Cuando el NLU detecta que un paciente quiere agendar una cita (`appointment_request`), el sistema inicia automáticamente el flujo de agendamiento:

**Paso 1 — Selección de servicio:**
El sistema envía un menú numerado con los servicios disponibles de la clínica. El paciente responde con el número del servicio que desea.

**Paso 2 — Selección de horario:**
El sistema muestra los próximos horarios disponibles según la agenda real de los profesionales. El paciente elige el que prefiere respondiendo con el número.

**Resultado según tipo de paciente:**

| Tipo de paciente | Resultado |
|-----------------|-----------|
| **Paciente registrado** (ya existe en el sistema) | Cita creada automáticamente con estado "Confirmada". El paciente recibe confirmación por WhatsApp |
| **Paciente nuevo** (número no registrado) | Se genera un intake en el pipeline de leads con todos los detalles. El staff lo ve en `/leads` y lo convierte a paciente+cita en un click |

**Duración del flujo:** El sistema espera respuesta hasta 30 minutos. Si el paciente no responde en ese tiempo, el flujo expira y puede iniciarse nuevamente la próxima vez que escriba.

---

## 9. Recordatorios automáticos

El sistema envía dos recordatorios de WhatsApp por cada cita programada, sin que el staff tenga que hacer nada.

### Cuándo se envían

- **Recordatorio 24 horas antes:** El día anterior a la cita, alrededor de las 8 AM hora Lima
- **Recordatorio 2 horas antes:** El mismo día de la cita, con 2 horas de anticipación

El mensaje incluye: nombre del paciente, tratamiento, fecha, hora y nombre de la clínica.

### Respuestas del paciente

Al final del recordatorio se indica:
> Responde **1** para confirmar tu asistencia
> Responde **2** si necesitas reagendar

**Si responde 1 (confirmar):**
El sistema cambia el estado de la cita a "Confirmada" automáticamente y envía un mensaje de confirmación al paciente. No se requiere acción del equipo.

**Si responde 2 (reagendar) — flujo completo automático:**

1. El sistema busca los próximos 3 horarios disponibles del mismo profesional (dentro de los próximos 14 días) y los envía al paciente en un nuevo mensaje.
2. El paciente responde con el número del horario que prefiere (1, 2 o 3).
3. La cita se actualiza automáticamente al nuevo horario con estado "Confirmada" y el paciente recibe confirmación: *"✅ ¡Listo! Tu cita fue reagendada para el [día] a las [hora]"*.

Si no hay horarios disponibles configurados para ese profesional, el sistema le informa al paciente que el equipo lo contactará pronto, y crea una tarea en el Copiloto para que el staff coordine manualmente.

**Si el paciente responde "2" pero no elige un horario en 2 horas:**
El sistema crea automáticamente una tarea en el Copiloto con prioridad media: *"📅 Reagendar manualmente: [Nombre] no eligió horario"*. El staff ve la tarea y contacta al paciente para coordinar.

**Si no responde al recordatorio:**
La cita permanece en estado "Programada". El equipo puede ver en el dashboard cuántas citas del día están sin confirmar.

---

## 10. Backfill de slots

El backfill llena automáticamente los espacios que quedan vacíos en la agenda cuando una cita se cancela o un paciente no llega.

### Cómo funciona

Cuando se libera un slot, el sistema busca candidatos en tres fuentes, en orden de prioridad:

1. **Pacientes en campaña de reactivación activa** — Ya recibieron un mensaje de la clínica y están en proceso de volver. Son los más receptivos (puntaje base: 35)
2. **Pacientes con historial del mismo tratamiento** — Lo han hecho antes y saben lo que es (puntaje base: 30)
3. **Leads con solicitud de cita abierta** — Personas que pidieron cita y todavía no fueron atendidas (puntaje base: 25)

### Factores que aumentan el puntaje

| Factor | Puntos adicionales |
|--------|-------------------|
| Visita reciente (menos de 90 días) | +15 |
| Está en lista de espera | +10 |
| El slot es urgente (menos de 48 horas) | +5 |
| Aparece en más de una fuente | +15 a +20 adicionales |

El sistema toma los 3 candidatos con mayor puntaje y les envía un mensaje de WhatsApp ofreciendo el horario disponible. También crea una tarea en el Copiloto para seguimiento del candidato principal.

### Página de Backfill (`/backfill`)

Muestra todos los slots abiertos activos: horario, servicio, candidatos notificados y si el slot ya fue llenado. También permite lanzar el backfill manualmente para un slot específico.

### Qué significa "URGENTE"

Un slot se marca urgente cuando quedan menos de 48 horas. Los candidatos reciben puntos extra porque un turno disponible hoy o mañana tiene mayor probabilidad de interesar a alguien que ya quería atenderse.

---

## 11. Reactivación de pacientes inactivos

La campaña de reactivación contacta automáticamente a pacientes que llevan más de 90 días sin visitar la clínica.

### Los dos pasos de la campaña

**Paso 1 — Mensaje de bienvenida:**
Primer contacto con tono amigable. Le recuerda al paciente que la clínica sigue disponible y le pide que responda "SÍ" si quiere agendar.

**Paso 2 — Seguimiento (7 días después):**
Si el paciente no respondió al primer mensaje, se envía un segundo mensaje una semana después con tono más directo e indicando que tiene prioridad en los horarios.

### Qué pasa cuando el paciente responde positivo

Cuando el paciente responde con una palabra positiva (sí, claro, dale, ok, me interesa, listo, etc.), el sistema:
1. Registra la respuesta automáticamente
2. Actualiza el estado del paciente en la campaña a "Respondió"
3. Crea una tarea en el Copiloto para que el equipo lo contacte y coordine la cita
4. Le envía al paciente un mensaje diciéndole que pronto lo contactarán

El equipo no necesita monitorear mensajes manualmente — el sistema avisa.

---

## 12. Encuesta post-cita y reputación

Entre 4 y 10 horas después de cada cita marcada como "Atendida", el sistema envía automáticamente una encuesta de satisfacción por WhatsApp.

### El flujo de la encuesta

El mensaje pregunta al paciente que califique su atención del **1 al 5**.

**Calificación 4 o 5 (paciente satisfecho):**
El sistema le envía el enlace directo a Google Reviews para que deje una reseña pública. Solo los pacientes felices van a Google.

**Calificación 1, 2 o 3 (paciente insatisfecho):**
El sistema NO envía el enlace de Google Reviews. En cambio, crea una tarea urgente en el Copiloto para que el equipo contacte al paciente y resuelva el problema en privado antes de que lo publique en redes.

### El escudo de reputación

Este mecanismo protege automáticamente la imagen pública de la clínica: las malas experiencias quedan dentro del sistema para ser resueltas internamente, y solo las buenas experiencias se amplifican hacia Google.

---

## 13. Oportunidades de Revenue

La página de Oportunidades (`/opportunities`) muestra los pacientes cuyo ciclo de retratamiento está próximo a vencer y que aún no han agendado su próxima cita.

### Cómo funciona

Cada servicio del catálogo puede tener configurado un **ciclo de retratamiento** en días (por ejemplo: Botox = 90 días, Limpieza facial = 30 días, Rellenos = 180 días).

El sistema calcula: fecha de la última cita de ese servicio + ciclo de retratamiento = fecha estimada de próximo tratamiento. Si esa fecha está dentro de los próximos 14 días y el paciente no tiene cita agendada, aparece en la página de Oportunidades.

### Agrupación por urgencia

| Grupo | Criterio |
|-------|---------|
| **Vencido** | El ciclo ya venció — el paciente debería haber venido hace días |
| **Esta semana** | El ciclo vence en los próximos 7 días |
| **Próximas 2 semanas** | El ciclo vence entre 7 y 14 días |

### Acciones desde la lista

Desde cada fila se puede hacer click en **"Nueva cita"** para ir directamente al formulario de agendamiento con el paciente y servicio prellenados.

> Para que esta pantalla funcione, el equipo de configuración debe haber ingresado el campo "Ciclo (días)" en cada servicio del catálogo (`/settings/services`).

---

## 14. Copiloto IA

El Copiloto (`/copilot`) es el centro de tareas generado por la inteligencia artificial. Funciona como la lista de pendientes del equipo, pero alimentada automáticamente por el sistema.

### Tipos de tareas

El copiloto genera tareas automáticamente ante estos eventos:

| Evento que genera la tarea | Prioridad |
|---------------------------|----------|
| Paciente calificó 1-3 estrellas en encuesta post-cita | Alta |
| NLU detectó intención de cancelar con alta confianza | Alta |
| NLU detectó insatisfacción o urgencia médica | Alta |
| Lead respondió positivo a campaña de reactivación | Normal |
| Paciente nuevo inició booking flow desde WhatsApp | Alta |
| SLA de lead está vencido | Normal |

También se pueden crear tareas manualmente desde `/copilot/new`.

### Lista de tareas

Muestra las tareas agrupadas por estado:
- **Urgente** — Requieren atención inmediata (rojo)
- **Abiertas** — Pendientes de resolver (normal)
- **Listas** — Completadas recientemente (historial)

Cada tarea muestra: descripción, paciente vinculado, fecha de creación y prioridad.

### Detalle de tarea (`/copilot/tasks/[id]`)

Muestra el contexto completo de la tarea: qué pasó, qué paciente está involucrado, y el historial de conversación o cita relacionada. Desde aquí se puede marcar como completada o agregar notas.

---

## 15. Analítica

La sección de Analítica permite medir el rendimiento operativo de la clínica. Se puede filtrar por: últimos 7 días, últimos 30 días, o el mes en curso.

### Dashboard principal (`/analytics`)

#### Funnel de captación

Muestra el recorrido desde que llega un lead hasta que genera ingreso:

| Métrica | Qué mide |
|---------|---------|
| **Leads recibidos** | Cuántas consultas o solicitudes llegaron en el período |
| **Citas agendadas** | Cuántas citas se crearon en el sistema |
| **Citas completadas** | Cuántas se realizaron efectivamente (estado "Atendida") |
| **Ingresos** | Suma total del precio de las citas completadas |

Cada métrica muestra el porcentaje de variación respecto al período anterior.

#### Eficiencia operativa

| Métrica | Qué mide | Referencia |
|---------|---------|-----------|
| **Fill rate** | % de citas programadas que terminaron siendo atendidas | Verde: ≥60%. Amarillo: 40-59%. Rojo: <40% |
| **Tasa de confirmación** | % de pacientes que confirmaron vía WhatsApp | Verde: ≥60%. El promedio del sector es 55-65% |
| **SLA leads (<2h)** | % de leads que recibieron primera respuesta dentro de 2 horas | Verde: ≥70%. Amarillo: 40-69% |
| **NPS pacientes** | Satisfacción neta: % promotores menos % detractores × 100 | Verde: ≥50. Amarillo: 0-49. Rojo: negativo |

---

### Analítica de Recordatorios (`/analytics/reminders`)

| Métrica | Qué mide |
|---------|---------|
| **Enviados** | Cuántos recordatorios de 24h (y 2h) se enviaron |
| **Tasa de confirmación** | % que respondieron "1" sobre el total de recordatorios enviados |
| **No-shows** | Citas donde el paciente no se presentó, en número y porcentaje |
| **Reagendaron** | Cuántos pacientes respondieron "2" y solicitaron cambio de horario |

Incluye el funnel completo: de los recordatorios enviados, cuántos confirmaron, cuántos reagendaron y cuántos no respondieron.

---

### NPS y Reputación (`/analytics/reputation`)

| Métrica | Qué mide |
|---------|---------|
| **Encuestas enviadas** | Cuántas encuestas se enviaron y cuántos respondieron |
| **Calificación promedio** | Promedio del 1 al 5. Verde: ≥4. Amarillo: 3 a 3.9. Rojo: <3 |
| **Reseñas Google enviadas** | Cuántos pacientes con 4-5 estrellas recibieron el enlace a Google Reviews |
| **Alertas de riesgo** | Cuántos pacientes calificaron 1-3 estrellas. Estos casos se escalan internamente |

**NPS simplificado:** (% promotores) − (% detractores) × 100. Promotores = 4-5 estrellas. Detractores = 1-2 estrellas. Pasivos = 3 estrellas.

| NPS | Interpretación |
|-----|---------------|
| 50 o más | Excelente. Los pacientes recomiendan activamente la clínica |
| 0–49 | Bueno. Hay margen de mejora |
| Negativo | Requiere atención. Más pacientes insatisfechos que satisfechos |

---

### Analítica de Reactivación (`/analytics/reactivation`)

| Métrica | Qué mide |
|---------|---------|
| **Pacientes inactivos** | Total con más de 90 días sin cita y WhatsApp válido |
| **Contactados** | Cuántos recibieron el mensaje paso 1 en el período |
| **Respondieron** | Cuántos contestaron positivamente. Una tasa ≥20% es buena |
| **Agendaron cita** | De los que respondieron, cuántos llegaron a agendar |

---

### Revenue (`/analytics/revenue`)

| Métrica | Qué mide |
|---------|---------|
| **Revenue realizado** | Suma del precio de citas completadas en el período |
| **Revenue recuperado** | Estimación del ingreso recuperado por reagendamientos y backfill exitoso |
| **Revenue en riesgo** | Estimación del ingreso perdido por no-shows y cancelaciones no recuperadas |
| **Fill rate backfill** | % de slots vacíos que lograron llenarse con otro paciente |
| **Rebook rate** | % de citas canceladas que terminaron siendo reagendadas |

---

## 16. Crecimiento mensual

La página de Crecimiento (`/analytics/growth`) muestra la evolución de la clínica mes a mes. Está diseñada para que el dueño vea el impacto acumulado de la plataforma a lo largo del tiempo y sienta la mejora concreta en los números.

### Selector de período

En la parte superior hay tres botones: **3 meses**, **6 meses** y **12 meses**. Al hacer click se recalcula toda la vista para el período elegido hacia atrás desde hoy.

### KPIs de resumen del período

Cinco tarjetas con el acumulado total del período seleccionado:

| KPI | Qué mide |
|-----|---------|
| **Citas** | Total de citas creadas en el período |
| **Completadas** | Citas marcadas como "Atendida" |
| **Ingresos** | Suma de precios de las citas completadas (S/) |
| **No-shows** | Citas con estado "Inasistencia" |
| **Leads** | Intakes registrados en el período |

### Gráfico de evolución mensual

Barras verticales por mes que muestran dos dimensiones simultáneamente:
- **Citas totales vs completadas** — barra de doble altura con el total visible y la porción completada superpuesta
- **No-shows** — barra separada con color según el porcentaje: verde si es <10%, amarillo si es 10-20%, rojo si supera el 20%

Las barras más altas indican meses de mayor actividad. Si las barras de completadas son casi tan altas como las de total, el fill rate es bueno.

### Tabla mes a mes

Debajo del gráfico aparece la tabla detallada con una fila por mes:

| Columna | Descripción |
|---------|------------|
| **Mes** | Nombre del mes (ej: "May 2026") |
| **Citas** | Total creadas ese mes |
| **Completadas** | Completadas y % de conversión |
| **No-shows** | Cantidad y porcentaje sobre el total |
| **Ingresos** | Suma en S/ de las citas completadas |
| **Leads** | Intakes captados ese mes |
| **Reactivaciones** | Pacientes inactivos que respondieron positivo a campaña |

La última fila muestra el **Total del período** con la suma de todas las columnas.

> Esta vista es especialmente útil para mostrar al dueño de clínica el crecimiento real: "En 6 meses pasé de 40 citas a 95 citas mensuales" o "Los ingresos crecieron 60% desde que activamos los recordatorios".

---

## 17. Redes Sociales — Facebook, Instagram y TikTok

PacienteIA centraliza todos los canales de comunicación en una sola bandeja. Además de WhatsApp, la clínica puede conectar su **Página de Facebook**, su cuenta de **Instagram de negocio** y recibir **leads de TikTok**.

### ¿Qué se integra?

| Canal | Lo que hace PacienteIA |
|-------|----------------------|
| **Facebook Messenger** | Los mensajes que llegan a tu Página de Facebook aparecen en la Bandeja. El staff responde desde PacienteIA sin abrir Facebook. |
| **Leads de Facebook Ads** | Cuando alguien completa un formulario de Lead Ad de tu Página, el lead entra automáticamente al Pipeline de Captación. |
| **Instagram DMs** | Los mensajes directos de tu cuenta de Instagram de negocio aparecen en la Bandeja junto a WhatsApp y Messenger. |
| **Leads de TikTok** | Los prospectos que completan formularios de tus campañas TikTok Lead Gen ingresan al Pipeline automáticamente. |

### Cómo conectar Facebook e Instagram

1. Ve a **Ajustes → Redes Sociales**
2. En la tarjeta **Facebook Messenger**, click en **Conectar →**
3. Aparece la ventana de autorización de Facebook — selecciona la Página de tu clínica
4. Acepta los permisos y regresarás a PacienteIA con confirmación

> Instagram se conecta automáticamente si tu cuenta de Instagram de negocio ya está vinculada a tu Página de Facebook. Si no está vinculada, el sistema te indica cómo hacerlo en la tarjeta de Instagram.

### Reconocer mensajes por canal en la Bandeja

En la Bandeja (`/inbox`), cada conversación muestra el canal junto al número o ID del contacto:
- `WhatsApp` → número de teléfono del paciente
- `Facebook Messenger` → ID de usuario de Facebook
- `Instagram DM` → ID de cuenta de Instagram

El staff puede responder a cualquier canal desde el mismo compositor de mensajes, sin salir de PacienteIA.

### Leads de TikTok

La integración con TikTok es via **webhook** — no requiere autorización OAuth sino configuración manual en TikTok Ads Manager. El equipo de PacienteIA te asiste en esta configuración al momento del onboarding.

**Qué necesitas:**
- Una cuenta activa en **TikTok Ads Manager**
- Al menos una campaña con objetivo **Lead Generation**
- El **Clinic ID** de tu clínica (visible en Ajustes → Redes Sociales)

Los leads de TikTok aparecen en **Leads** con fuente `TikTok`.

### Desconectar una red social

En **Ajustes → Redes Sociales**, cada tarjeta conectada muestra un enlace "Desconectar" al pie. Al desconectar, los mensajes nuevos de ese canal dejan de llegar a la Bandeja, pero el historial de conversaciones anteriores se conserva.

> Para el detalle técnico de configuración (webhooks, Meta App, variables de entorno), consulta el **Manual de Integraciones Sociales** en `docs/manual-integraciones-sociales.md`.

---

## 18. Configuración de la clínica

Todas las configuraciones están en el menú **Ajustes**.

### Profesionales (`/settings/professionals`)

Gestión de los doctores y terapeutas de la clínica. Cada profesional tiene:
- Nombre y especialidad
- Color identificativo (visible en la agenda)
- Estado activo/inactivo

**Agregar profesional:** Click en "+ Agregar profesional", ingresar nombre, especialidad y elegir color.

**Desactivar profesional:** Toggle en la fila. Los profesionales inactivos no aparecen en el formulario de nuevas citas pero se conservan en el historial.

---

### Servicios (`/settings/services`)

Catálogo de tratamientos de la clínica. Cada servicio tiene:
- Nombre
- Precio base
- Duración estimada en minutos
- **Ciclo de retratamiento en días** — cuántos días suelen pasar entre una cita y la siguiente del mismo servicio. Este campo activa la detección de Oportunidades de Revenue.

**Ejemplos de ciclo:**
| Servicio | Ciclo sugerido |
|---------|--------------|
| Botox | 90 días |
| Rellenos dérmicos | 180 días |
| Limpieza facial | 30 días |
| Láser | 45 días |
| Control mensual | 30 días |

---

### Horarios (`/settings/schedules`)

Configuración de disponibilidad por profesional.

#### Vista semanal de disponibilidad

En la parte superior aparece una tabla con todos los profesionales y sus horarios por día de la semana. Si un profesional atiende el lunes de 10:00 a 16:00, se ve en la celda correspondiente. Si no atiende ese día, aparece un guión.

Esta vista es de solo lectura — sirve para consultar rápidamente sin tener que buscar en la lista.

#### Horarios regulares

Disponibilidad semanal recurrente. Para agregar el horario de un profesional:
1. Sección **Agregar horario** al pie de la página
2. Selecciona el profesional, el día de la semana, hora de inicio y hora de fin
3. Click en **Agregar horario** — aparece en la lista y en la vista semanal

Se puede agregar más de un horario por día (por ejemplo, mañana y tarde con descanso al mediodía). Para eliminar un horario, click en **Eliminar** junto al registro.

#### Bloqueos de fecha

Días específicos donde el profesional o la clínica entera no atiende. Se usa para:
- Feriados nacionales
- Vacaciones de un profesional
- Reuniones internas
- Cualquier cierre puntual

Para agregar un bloqueo:
1. Sección **Agregar bloqueo**
2. Ingresa la fecha, el tipo (feriado / vacaciones / reunión / otro) y opcionalmente el horario si el bloqueo es parcial
3. Elige si aplica a toda la clínica o solo a un profesional específico
4. Click en **Agregar bloqueo**

**Efecto en citas:** Los horarios y bloqueos configurados aquí se respetan al crear o editar una cita. Si se intenta agendar fuera del horario o en una fecha bloqueada, el sistema muestra un error descriptivo antes de guardar.

---

### Staff (`/settings/staff`)

Gestión de los miembros del equipo que tienen acceso a PacienteIA.

**Roles disponibles:**

| Rol | Qué puede hacer |
|-----|----------------|
| **Owner** | Acceso completo a todo el sistema, incluyendo facturación y configuración |
| **Admin** | Acceso operativo completo: citas, pacientes, leads, configuración. Sin acceso a facturación |
| **Staff** | Acceso a bandeja, citas, pacientes y leads. Sin acceso a configuración ni analítica avanzada |

**Invitar miembro:** Click en "+ Invitar miembro", ingresar email y elegir rol. El sistema envía un email de invitación. El usuario acepta, crea su contraseña y queda activo.

**Quitar miembro:** Click en el ícono de opciones de la fila y seleccionar "Quitar del equipo". La persona pierde acceso inmediatamente.

---

### WhatsApp (`/settings/whatsapp`)

Configuración de la integración con WhatsApp Business:

| Campo | Para qué sirve |
|-------|---------------|
| **Google Review URL** | Enlace al perfil de Google Business de la clínica. El sistema lo usa en el escudo de reputación para enviar el link a pacientes satisfechos |
| **Webhook URL** | URL que se ingresa en el panel de Meta Business para que los mensajes lleguen a PacienteIA. Copiar con el botón |
| **Verify Token** | Token de verificación que se ingresa en Meta Business al configurar el webhook. Copiar con el botón |
| **App Secret** | Secreto de la App de Meta para validar la autenticidad de los mensajes. Configura una seguridad propia por clínica |

---

## 19. Panel de Superadmin

> Esta sección es exclusivamente para el equipo interno de PacienteIA. Las clínicas no tienen acceso a este panel.

El panel de superadmin (`/platform`) permite gestionar todas las clínicas registradas en la plataforma.

### Indicadores de Revenue (`/platform`)

| Indicador | Qué mide | Cómo se calcula |
|-----------|---------|----------------|
| **MRR actual** | Ingreso mensual recurrente en soles | Suma de precio del plan × clínicas activas. Los trials no aportan MRR |
| **Nuevo este mes** | MRR ganado por nuevas conversiones | Clínicas que pasaron de trialing a active este mes |
| **Pipeline (trial)** | Revenue potencial si todos los trials convierten | Suma de precios de todas las orgs en trialing |
| **Activation rate** | % de orgs en trial con WhatsApp conectado | Objetivo: >60%. Menos del 30% = riesgo de churn del trial |
| **Conversion rate (90d)** | % de trials que convirtieron en los últimos 90 días | Cohorte de orgs creadas en 90 días con status active |
| **Zombie accounts** | Trials con más de 5 días sin conectar WhatsApp | Señal de onboarding bloqueado — requieren intervención |
| **Upsell candidates** | Clínicas activas que superan el 70% del límite de su plan | Candidatas a upgrade |

### Tabla de planes

| Plan | Precio/mes | Usuarios | Leads/mes | Citas/mes | Funciones clave |
|------|-----------|---------|----------|----------|----------------|
| Trial | S/ 0 | 1 | 50 | 150 | Escudo de reputación |
| Básico | S/ 99 | 1 | 50 | 150 | Escudo de reputación, recordatorios, confirmaciones |
| Pro | S/ 249 | 3 | 200 | 500 | + IA, reactivación, NLU, score de retención, oportunidades |
| Premium | S/ 499 | Ilimitado | 1,000 | Ilimitado | + Backfill, flash offers, ROI automático, Google Business |

---

### Salud de la plataforma (`/platform/health`)

| Indicador | Qué mide |
|-----------|---------|
| **Churn rate** | % de clínicas que cancelaron en los últimos 30 días |
| **Orgs sin actividad >7d** | Clínicas activas o en trial sin actividad en 7 días — posible señal de abandono |
| **WhatsApp desconectado** | Clínicas activas con token revocado — sus automatizaciones no están funcionando |

---

### Acciones en el detalle de un tenant (`/platform/tenants/[id]`)

| Acción | Qué hace |
|--------|---------|
| **Extender trial** | Actualiza `trial_ends_at` y mantiene status trialing |
| **Suspender** | Cambia status a cancelled. La clínica ve la página /blocked |
| **Reactivar** | Restaura acceso completo inmediatamente |
| **Cambiar plan** | Actualiza límites operativos de inmediato |
| **Entrar al tenant** | Impersonation: navegar el dashboard de esa clínica como su owner. Barra naranja en la parte superior indica que estás en modo impersonation |
| **Agregar WhatsApp** | Inserta registro en `branch_whatsapp_config`. Requiere: Phone Number ID, WABA ID, Access Token, App Secret |
| **Revocar WhatsApp** | El número deja de enviar y recibir mensajes |
| **Notas CRM** | Registra contacto: Llamada, Demo, Email, WhatsApp, Nota libre |
| **Fuente de adquisición** | Paxi, Referido, Outreach frío, Google/SEO, Evento/Demo, Otro |

---

### Lista de tenants (`/platform/tenants`)

- Columna **Último contacto:** fecha de la nota CRM más reciente. Si aparece en naranja "Sin contacto" = nunca se ha registrado contacto con esa clínica
- Columna **Fuente:** canal por el que llegó la clínica, con badge de color

---

### Gestión de trials (`/platform/trials`)

Muestra todas las clínicas en período de prueba, ordenadas por días restantes. Las que tienen el trial vencido o a punto de vencer aparecen primero. Desde aquí se puede extender el trial directamente sin entrar al detalle.

---

### Pipeline de Ventas — Paxi (`/platform/sales`)

Muestra el pipeline de prospectos captados por Paxi, el Vendedor IA de PacienteIA. Paxi es un bot de WhatsApp que capta y califica a clínicas interesadas en el servicio a través de un flujo conversacional de 7 pasos.

El pipeline muestra: nombre, clínica, volumen de pacientes, dolor principal, paso del flujo donde está y si dejó email para seguimiento.

---

---

**Documentación técnica complementaria:**
- [Manual de Integraciones Sociales](./manual-integraciones-sociales.md) — configuración paso a paso de WhatsApp, Facebook, Instagram y TikTok

*Guía de usuario PacienteIA — versión 2026-05-19*
