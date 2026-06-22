import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Paciente IA',
  description: 'Copiloto operacional para clínicas estéticas',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="bg-mist text-ink antialiased font-sans" suppressHydrationWarning>
        {children}
      </body>
    </html>
  )
}
