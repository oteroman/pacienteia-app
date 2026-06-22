import Link from 'next/link'

export default function CheckEmailPage() {
  return (
    <div className="w-full max-w-sm text-center">
      <div className="text-5xl mb-6">📧</div>
      <h1 className="text-2xl font-bold text-ink mb-2">Revisa tu email</h1>
      <p className="text-sm text-slate mb-6">
        Te enviamos un enlace de confirmación. Haz clic en él para activar tu cuenta
        y continuar con la configuración de tu clínica.
      </p>

      <div className="bg-white rounded-2xl shadow-xs border border-fog p-6 text-left space-y-3 text-sm text-slate">
        <p>✅ Abre el email de <strong>noreply@pacienteia.com</strong></p>
        <p>✅ Haz clic en <strong>"Confirmar cuenta"</strong></p>
        <p>✅ Serás redirigido automáticamente al asistente de configuración</p>
      </div>

      <p className="mt-6 text-xs text-slate">
        ¿No llegó el email? Revisa tu carpeta de spam o{' '}
        <Link href="/signup" className="text-brand-600 hover:underline">
          intenta de nuevo
        </Link>
        .
      </p>
    </div>
  )
}
