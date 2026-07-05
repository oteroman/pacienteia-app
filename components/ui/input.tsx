import { forwardRef, type InputHTMLAttributes } from 'react'

const inputClass = `w-full rounded-lg border border-fog px-3 py-2.5 text-sm shadow-xs
  focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent
  placeholder:text-slate disabled:bg-mist disabled:cursor-not-allowed`

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className = '', ...props }, ref) => (
    <input ref={ref} className={`${inputClass} ${className}`} {...props} />
  )
)
Input.displayName = 'Input'

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className = '', ...props }, ref) => (
    <textarea
      ref={ref}
      rows={3}
      className={`${inputClass} resize-none ${className}`}
      {...props}
    />
  )
)
Textarea.displayName = 'Textarea'

export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className = '', children, ...props }, ref) => (
    <select ref={ref} className={`${inputClass} ${className}`} {...props}>
      {children}
    </select>
  )
)
Select.displayName = 'Select'
