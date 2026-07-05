# Gestión de Profesionales y Horarios

## ¿Qué hace?

Permite configurar el equipo médico de la clínica (doctores, terapeutas, especialistas) y definir su disponibilidad semanal. Los profesionales aparecen en el formulario de citas para asignar quién atenderá al paciente. Los horarios se usan como referencia de disponibilidad y los bloqueos de fecha impiden agendar en días no laborables.

## Gestión de Profesionales (`/settings/professionals`)

### Cómo funciona

1. El staff accede a **Ajustes → Profesionales**
2. Ve la lista de profesionales activos con su color asignado y especialidad
3. Puede agregar nuevos, desactivar temporalmente o eliminar profesionales

### Campos de un profesional

| Campo        | Descripción                                          | Requerido |
|--------------|------------------------------------------------------|-----------|
| Nombre       | Nombre completo (ej: "Dra. García")                  | Sí        |
| Especialidad | Texto libre (ej: "Medicina estética", "Psicología")  | No        |
| Color        | Color de identificación en la agenda (hex)           | Sí (default: índigo) |

### Colores disponibles (palette fija)

Los 8 colores predefinidos son: índigo, rosa, ámbar, esmeralda, azul, violeta, rojo y teal.

### Estados

| Estado   | Descripción                                           |
|----------|-------------------------------------------------------|
| Activo   | Aparece en el formulario de citas y en horarios       |
| Inactivo | No aparece en nuevas citas pero conserva historial    |

Un profesional eliminado se borra permanentemente. Un profesional desactivado se puede reactivar.

### Ámbito multi-tenant

Los profesionales son por sucursal (`branch_id`). Si la organización tiene varias sedes, cada sede tiene su propio equipo.

---

## Gestión de Horarios (`/settings/schedules`)

La página de horarios tiene dos secciones: horarios semanales regulares y bloqueos de fecha específicos.

### Sección 1: Horarios semanales regulares

Define la disponibilidad recurrente de cada profesional. Se configura por día de la semana y rango horario.

**Cómo agregar un horario:**
1. Seleccionar el profesional del dropdown
2. Elegir el día de la semana (Domingo = 0, Lunes = 1, ..., Sábado = 6)
3. Definir hora de inicio y hora de fin
4. Guardar

Los horarios se muestran agrupados por profesional, con el punto de color del profesional como identificador visual.

**Nota:** Si no hay profesionales configurados, la sección muestra un aviso para ir primero a Ajustes → Profesionales.

### Sección 2: Bloqueos de fecha

Impide que se agenden citas en fechas específicas (feriados, vacaciones, reuniones, etc.).

**Campos de un bloqueo:**

| Campo        | Descripción                                           | Requerido |
|--------------|-------------------------------------------------------|-----------|
| Fecha        | Fecha del bloqueo (no puede ser en el pasado)         | Sí        |
| Tipo         | Categoría del bloqueo (ver tabla abajo)               | No (default: otro) |
| Hora inicio  | Si el bloqueo es solo para un rango horario           | No        |
| Hora fin     | Par de hora inicio                                    | No        |
| Motivo       | Texto libre (ej: "Día del Trabajo")                   | No        |
| Profesional  | Si aplica solo a un profesional específico            | No (vacío = toda la clínica) |

**Tipos de bloqueo:**

| Tipo        | Label       | Color   |
|-------------|-------------|---------|
| `holiday`   | Feriado     | Rojo    |
| `vacation`  | Vacaciones  | Azul    |
| `meeting`   | Reunión     | Amarillo|
| `other`     | Otro        | Gris    |

Solo se muestran los bloqueos futuros (a partir de hoy). Los pasados no aparecen en la lista.

## Impacto en el sistema

- Los profesionales activos aparecen en el dropdown del **formulario de citas** (`components/appointment/appointment-form.tsx`)
- El campo `professional_id` en `appointments` es una FK a `professionals`
- Los horarios y bloqueos son informativos para el staff; no bloquean automáticamente la agenda (no hay validación automática al agendar)

## Tablas de BD involucradas

| Tabla              | Uso                                                        |
|--------------------|-------------------------------------------------------------|
| `professionals`    | Entidad de profesional: nombre, especialidad, color, estado |
| `doctor_schedules` | Disponibilidad semanal: `professional_id`, `day_of_week`, `start_time`, `end_time` |
| `schedule_blocks`  | Bloqueos de fecha: `block_date`, `block_type`, `reason`, `doctor_name` |
| `appointments`     | FK `professional_id` → profesional que atiende la cita     |

## Archivos clave

| Archivo                                              | Propósito                                         |
|------------------------------------------------------|---------------------------------------------------|
| `app/(dashboard)/settings/professionals/page.tsx`    | UI de gestión de profesionales (CRUD + color picker) |
| `app/(dashboard)/settings/schedules/page.tsx`        | UI de horarios semanales y bloqueos de fecha      |
| `app/actions/professionals.ts`                       | `createProfessional`, `toggleProfessionalActive`, `deleteProfessional` |
| `app/actions/schedules.ts`                           | `addDoctorSchedule`, `deleteDoctorSchedule`, `addScheduleBlock`, `deleteScheduleBlock` |
| `components/appointment/appointment-form.tsx`         | Dropdown de profesionales en el formulario de citas |
