export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main
      className="min-h-screen flex items-center justify-center px-4 py-12"
      style={{
        background: 'linear-gradient(135deg, #f0f9ff 0%, #f5f0ff 60%, #faf5ff 100%)',
      }}
    >
      {children}
    </main>
  )
}
