import { forwardRef, type InputHTMLAttributes } from 'react'

const inputClass = `w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm shadow-sm
  focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent
  placeholder:text-gray-400 disabled:bg-gray-50 disabled:cursor-not-allowed`

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
