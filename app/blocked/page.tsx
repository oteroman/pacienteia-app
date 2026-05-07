import Link from 'next/link'

export default function BlockedPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center space-y-5">
        <div className="text-5xl">🔒</div>

        <div className="space-y-2">
          <h1 className="text-xl font-bold text-gray-900">Tu cuenta está suspendida</h1>
          <p className="text-sm text-gray-500 leading-relaxed">
            Tu suscripción fue cancelada o venció. Tus datos están seguros y
            disponibles en cuanto reactives tu cuenta.
          </p>
        </div>

        <div className="space-y-3 pt-2">
          <a
            href="mailto:billing@pacienteia.com?subject=Renovar%20suscripci%C3%B3n%20PacienteIA"
            className="block w-full bg-brand-600 hover:bg-brand-700 text-white font-semibold text-sm px-5 py-3 rounded-xl transition-colors"
          >
            Contactar para renovar
          </a>
          <Link
            href="/pricing"
            className="block w-full border border-gray-200 hover:bg-gray-50 text-gray-700 font-medium text-sm px-5 py-3 rounded-xl transition-colors"
          >
            Ver planes
          </Link>
        </div>

        <p className="text-xs text-gray-400">
          ¿Tienes dudas?{' '}
          <a href="mailto:billing@pacienteia.com" className="underline hover:text-gray-600">
            billing@pacienteia.com
          </a>
        </p>
      </div>
    </div>
  )
}
