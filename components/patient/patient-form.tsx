'use client'

import { useState, useTransition } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { patientSchema, type PatientFormValues, type PatientFormInput } from '@/lib/validations/patient'
import { FormField } from '@/components/ui/form-field'
import { Input, Textarea, Select } from '@/components/ui/input'
import { Button, LinkButton } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PhotoUpload } from './photo-upload'
import type { Patient } from '@/types/database'

interface PatientFormProps {
  defaultValues?: Partial<Patient>
  action: (data: PatientFormValues) => Promise<{ error: string } | undefined>
}

export function PatientForm({ defaultValues, action }: PatientFormProps) {
  const [serverError, setServerError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [tagInput, setTagInput] = useState('')

  const { register, handleSubmit, control, setValue, watch, formState: { errors } } = useForm<PatientFormInput, any, PatientFormValues>({
    resolver: zodResolver(patientSchema),
    defaultValues: {
      full_name:       defaultValues?.full_name ?? '',
      phone:           defaultValues?.phone ?? '',
      email:           defaultValues?.email ?? '',
      dni:             defaultValues?.dni ?? '',
      status:          (defaultValues?.status as PatientFormValues['status']) ?? 'active',
      notes:           defaultValues?.notes ?? '',
      tags:            defaultValues?.tags ?? [],
      photo_url:       defaultValues?.photo_url ?? '',
      last_visit_date: defaultValues?.last_visit_date ?? '',
    },
  })

  const tags = watch('tags') ?? []
  const photoUrl = watch('photo_url')

  function addTag() {
    const t = tagInput.trim().toLowerCase()
    if (t && !tags.includes(t)) {
      setValue('tags', [...tags, t])
    }
    setTagInput('')
  }

  function removeTag(tag: string) {
    setValue('tags', tags.filter((t) => t !== tag))
  }

  function onSubmit(data: PatientFormValues) {
    setServerError(null)
    startTransition(async () => {
      const result = await action(data)
      if (result?.error) setServerError(result.error)
    })
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Photo */}
      <PhotoUpload
        currentUrl={photoUrl || null}
        onUpload={(url) => setValue('photo_url', url)}
      />

      {/* Main info */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField label="Nombre completo" required error={errors.full_name?.message}>
          <Input {...register('full_name')} placeholder="Ana García Pérez" />
        </FormField>

        <FormField label="Teléfono" error={errors.phone?.message}>
          <Input {...register('phone')} placeholder="+51 999 000 000" type="tel" />
        </FormField>

        <FormField label="Email" error={errors.email?.message}>
          <Input {...register('email')} placeholder="ana@email.com" type="email" />
        </FormField>

        <FormField label="DNI" error={errors.dni?.message}>
          <Input {...register('dni')} placeholder="12345678" />
        </FormField>

        <FormField label="Estado" required error={errors.status?.message}>
          <Select {...register('status')}>
            <option value="active">Activo</option>
            <option value="inactive">Inactivo</option>
            <option value="lead">Lead</option>
            <option value="blocked">Bloqueado</option>
          </Select>
        </FormField>

        <FormField label="Última visita" error={errors.last_visit_date?.message}>
          <Input {...register('last_visit_date')} type="date" />
        </FormField>
      </div>

      {/* Tags */}
      <FormField label="Etiquetas" hint="Presiona Enter o Agregar para añadir">
        <Controller
          name="tags"
          control={control}
          render={() => (
            <div className="space-y-2">
              <div className="flex gap-2">
                <Input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag() } }}
                  placeholder="botox, vip, recurrente..."
                />
                <button
                  type="button"
                  onClick={addTag}
                  className="px-3 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50 whitespace-nowrap"
                >
                  + Agregar
                </button>
              </div>
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {tags.map((tag) => (
                    <Badge key={tag} variant="blue">
                      {tag}
                      <button
                        type="button"
                        onClick={() => removeTag(tag)}
                        className="ml-1 hover:text-blue-900"
                      >
                        ×
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          )}
        />
      </FormField>

      {/* Notes */}
      <FormField label="Notas" error={errors.notes?.message}>
        <Textarea {...register('notes')} placeholder="Observaciones, preferencias, historial relevante..." />
      </FormField>

      {serverError && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{serverError}</p>
      )}

      <div className="flex gap-3 justify-end pt-2">
        <LinkButton href="/patients" variant="secondary">Cancelar</LinkButton>
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Guardando...' : defaultValues?.id ? 'Guardar cambios' : 'Crear paciente'}
        </Button>
      </div>
    </form>
  )
}
