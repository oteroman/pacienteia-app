import { z } from 'zod'

export const appointmentSchema = z.object({
  patient_id:     z.string().uuid('Selecciona un paciente'),
  treatment_type: z.string().min(2, 'Mínimo 2 caracteres').max(100),
  scheduled_at:   z.string().min(1, 'Fecha y hora requerida'),
  status:         z.enum(['scheduled', 'confirmed', 'completed', 'cancelled', 'no_show']).default('scheduled'),
  notes:          z.string().max(500).optional().or(z.literal('')),
  price:          z.coerce.number().min(0).max(99999).optional(),
})

export type AppointmentFormValues = z.infer<typeof appointmentSchema>
