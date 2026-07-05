// Single source of truth for the settings navigation, grouped by intent.
// Used by the settings hub (/settings) and the top-nav config entry.

export interface SettingsItem {
  label: string
  href:  string
  desc:  string
}

export interface SettingsGroup {
  label: string
  items: SettingsItem[]
}

export const SETTINGS_GROUPS: SettingsGroup[] = [
  {
    label: 'Tu clínica',
    items: [
      { label: 'Perfil de clínica', href: '/settings/clinic',    desc: 'Nombre, marca y tono de las respuestas' },
      { label: 'Sucursales',        href: '/settings/branches',   desc: 'Sedes y ubicaciones' },
      { label: 'Horarios',          href: '/settings/schedules',  desc: 'Disponibilidad y bloqueos de fecha' },
      { label: 'Servicios',         href: '/settings/services',   desc: 'Catálogo de tratamientos y precios' },
    ],
  },
  {
    label: 'Tu equipo',
    items: [
      { label: 'Profesionales', href: '/settings/professionals', desc: 'Doctores y terapeutas' },
      { label: 'Staff',         href: '/settings/staff',         desc: 'Equipo y permisos de acceso' },
    ],
  },
  {
    label: 'Pacientes y mensajes',
    items: [
      { label: 'Plantillas',       href: '/settings/messages',     desc: 'Respuestas rápidas de WhatsApp' },
      { label: 'Automatizaciones', href: '/settings/automations',  desc: 'Activa o pausa los flujos automáticos' },
      { label: 'Reputación',       href: '/settings/reputation',   desc: 'Reseñas de Google y encuestas' },
      { label: 'Sala de espera',   href: '/settings/waiting-room', desc: 'QR para el registro de llegada' },
    ],
  },
  {
    label: 'Captación',
    items: [
      { label: 'Redes sociales',  href: '/settings/social',   desc: 'Facebook, Instagram y TikTok' },
      { label: 'Formularios web', href: '/settings/webforms', desc: 'Formulario para embeber en tu web' },
    ],
  },
  {
    label: 'Cobros y cuenta',
    items: [
      { label: 'Pagos',    href: '/settings/payments', desc: 'Separación anti no-show' },
      { label: 'Tu plan',  href: '/billing',           desc: 'Suscripción y facturación' },
      { label: 'API Keys', href: '/settings/api-keys', desc: 'Integración con sistemas externos' },
    ],
  },
]
