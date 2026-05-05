export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-50 to-white px-4">
      {children}
    </main>
  )
}
