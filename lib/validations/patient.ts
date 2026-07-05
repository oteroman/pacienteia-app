import { z } from 'zod'

export const patientSchema = z.object({
  full_name:        z.string().min(2, 'Mínimo 2 caracteres').max(100),
  phone:            z.string().max(20).regex(/^[\d+\s\-()]*$/, 'Solo números y + permitidos').optional().or(z.literal('')),
  email:            z.string().email('Email inválido').max(100).optional().or(z.literal('')),
  dni:              z.string().max(12).optional().or(z.literal('')),
  status:           z.enum(['active', 'inactive', 'lead', 'blocked']).default('active'),
  notes:            z.string().max(1000).optional().or(z.literal('')),
  contraindications: z.string().max(500).optional().or(z.literal('')),
  tags:             z.array(z.string()).default([]),
  photo_url:        z.string().url('URL inválida').optional().or(z.literal('')),
  last_visit_date:  z.string().optional().or(z.literal('')),
})

export type PatientFormValues = z.infer<typeof patientSchema>
export type PatientFormInput  = z.input<typeof patientSchema>
