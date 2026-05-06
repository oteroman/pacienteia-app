'use client'

import { useState, useTransition, useRef, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { appointmentSchema, type AppointmentFormValues, type AppointmentFormInput } from '@/lib/validations/appointment'
import { FormField } from '@/components/ui/form-field'
import { Input, Textarea, Select } from '@/components/ui/input'
import { Button, LinkButton } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import type { Patient } from '@/types/database'

interface AppointmentFormProps {
  defaultDate?: string
  defaultPatientId?: string
  clinicId: string
  action: (data: AppointmentFormValues) => Promise<{ error: string } | undefined>
}

export function AppointmentForm({ defaultDate, defaultPatientId, clinicId, action }: AppointmentFormProps) {
  const [serverError, setServerError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [patientSearch, setPatientSearch] = useState('')
  const [patientResults, setPatientResults] = useState<Patient[]>([])
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null)
  const [showDropdown, setShowDropdown] = useState(false)
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { register, handleSubmit, setValue, formState: { errors } } = useForm<AppointmentFormInput, any, AppointmentFormValues>({
    resolver: zodResolver(appointmentSchema),
    defaultValues: {
      patient_id:     defaultPatientId ?? '',
      treatment_type: '',
      scheduled_at:   defaultDate ? `${defaultDate}T09:00` : '',
      status:         'scheduled',
      notes:          '',
      price:          undefined,
    },
  })

  // Pre-load patient if defaultPatientId provided
  useEffect(() => {
    if (!defaultPatientId) return
    createClient()
      .from('patients')
      .select('*')
      .eq('id', defaultPatientId)
      .single()
      .then(({ data }) => { if (data) setSelectedPatient(data) })
  }, [defaultPatientId])

  function searchPatients(q: string) {
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    if (!q.trim()) { setPatientResults([]); return }
    searchTimeout.current = setTimeout(async () => {
      const { data } = await createClient()
        .from('patients')
        .select('*')
        .eq('clinic_id', clinicId)
        .is('deleted_at', null)
        .or(`full_name.ilike.%${q}%,phone.ilike.%${q}%,dni.ilike.%${q}%`)
        .limit(8)
      setPatientResults(data ?? [])
      setShowDropdown(true)
    }, 300)
  }

  function selectPatient(p: Patient) {
    setSelectedPatient(p)
    setValue('patient_id', p.id)
    setPatientSearch('')
    setShowDropdown(false)
  }

  function onSubmit(data: AppointmentFormValues) {
    setServerError(null)
    startTransition(async () => {
      const result = await action(data)
      if (result?.error) setServerError(result.error)
    })
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {/* Patient combobox */}
      <FormField label="Paciente" required error={errors.patient_id?.message}>
        <div className="relative">
          {selectedPatient ? (
            <div className="flex items-center justify-between rounded-lg border border-brand-300 bg-brand-50 px-3 py-2.5">
              <span className="text-sm font-medium text-brand-800">{selectedPatient.full_name}</span>
              <button
                type="button"
                onClick={() => { setSelectedPatient(null); setValue('patient_id', '') }}
                className="text-brand-400 hover:text-brand-700 ml-2 text-xs"
              >
                ✕ Cambiar
              </button>
            </div>
          ) : (
            <input
              type="text"
              value={patientSearch}
              onChange={(e) => { setPatientSearch(e.target.value); searchPatients(e.target.value) }}
              onFocus={() => patientSearch && setShowDropdown(true)}
              onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
              placeholder="Buscar por nombre, DNI o teléfono..."
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            />
          )}
          {showDropdown && patientResults.length > 0 && (
            <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
              {patientResults.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onMouseDown={() => selectPatient(p)}
                  className="w-full text-left px-4 py-2.5 text-sm hover:bg-brand-50 transition-colors"
                >
                  <span className="font-medium">{p.full_name}</span>
                  {p.phone && <span className="text-gray-400 ml-2 text-xs">{p.phone}</span>}
                </button>
              ))}
            </div>
          )}
        </div>
        <input type="hidden" {...register('patient_id')} />
      </FormField>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField label="Tipo de tratamiento" required error={errors.treatment_type?.message}>
          <Input {...register('treatment_type')} placeholder="Botox, peeling, mesoterapia..." />
        </FormField>

        <FormField label="Fecha y hora" required error={errors.scheduled_at?.message}>
          <Input {...register('scheduled_at')} type="datetime-local" />
        </FormField>

        <FormField label="Estado" error={errors.status?.message}>
          <Select {...register('status')}>
            <option value="scheduled">Programada</option>
            <option value="confirmed">Confirmada</option>
            <option value="completed">Completada</option>
            <option value="no_show">No-show</option>
            <option value="cancelled">Cancelada</option>
          </Select>
        </FormField>

        <FormField label="Precio (S/)" error={errors.price?.message}>
          <Input {...register('price')} type="number" min="0" step="0.50" placeholder="0.00" />
        </FormField>
      </div>

      <FormField label="Notas" error={errors.notes?.message}>
        <Textarea {...register('notes')} placeholder="Observaciones, indicaciones previas..." />
      </FormField>

      {serverError && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{serverError}</p>
      )}

      <div className="flex gap-3 justify-end pt-2">
        <LinkButton href="/appointments" variant="secondary">Cancelar</LinkButton>
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Guardando...' : 'Crear cita'}
        </Button>
      </div>
    </form>
  )
}
