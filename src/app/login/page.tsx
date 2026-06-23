'use client'

import { signIn } from 'next-auth/react'
import { useSearchParams } from 'next/navigation'
import { useState, Suspense } from 'react'
import { Telescope } from 'lucide-react'

function LoginCard() {
  const searchParams  = useSearchParams()
  const callbackUrl   = searchParams.get('callbackUrl') ?? '/dashboard'
  const errorParam    = searchParams.get('error')
  const [loading, setLoading] = useState<string | null>(null)

  async function handleSignIn(provider: string) {
    setLoading(provider)
    await signIn(provider, { callbackUrl })
  }

  const errorMessages: Record<string, string> = {
    OAuthAccountNotLinked: 'Este e-mail já está associado a outro provedor.',
    OAuthSignin:           'Erro ao iniciar autenticação. Tente novamente.',
    Default:               'Ocorreu um erro. Tente novamente.',
  }
  const errorMessage = errorParam
    ? (errorMessages[errorParam] ?? errorMessages.Default)
    : null

  return (
    <div className="w-full max-w-sm space-y-8">
      {/* Logo */}
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-cosmos-500/20 border border-cosmos-500/30 mb-4">
          <Telescope className="w-8 h-8 text-cosmos-400" />
        </div>
        <h1 className="text-3xl font-bold text-white" style={{ fontFamily: 'var(--font-syne)' }}>
          AstroLog
        </h1>
        <p className="text-white/55 text-sm mt-1">Seu diário de astrofotografia</p>
      </div>

      {/* Error banner */}
      {errorMessage && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400 text-center">
          {errorMessage}
        </div>
      )}

      {/* Sign-in card */}
      <div className="card p-6 space-y-3">
        <p className="text-xs text-white/55 text-center uppercase tracking-wider mb-4">
          Entrar com
        </p>

        {/* Google */}
        <button
          onClick={() => handleSignIn('google')}
          disabled={!!loading}
          className="w-full flex items-center justify-center gap-3 bg-white/5 border border-white/10 hover:bg-white/10 rounded-lg px-4 py-3 text-sm font-medium text-white transition-colors duration-150 disabled:opacity-50"
        >
          {loading === 'google' ? (
            <span className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
          ) : (
            <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
          )}
          Continuar com Google
        </button>

        {/* GitHub */}
        <button
          onClick={() => handleSignIn('github')}
          disabled={!!loading}
          className="w-full flex items-center justify-center gap-3 bg-white/5 border border-white/10 hover:bg-white/10 rounded-lg px-4 py-3 text-sm font-medium text-white transition-colors duration-150 disabled:opacity-50"
        >
          {loading === 'github' ? (
            <span className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
          ) : (
            <svg className="w-5 h-5 shrink-0 fill-current" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
            </svg>
          )}
          Continuar com GitHub
        </button>
      </div>

      <p className="text-center text-xs text-white/20">
        Seus dados são privados por padrão
      </p>
    </div>
  )
}

export default function LoginPage() {
  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'radial-gradient(ellipse at 50% 0%, #261b82 0%, #0b0630 60%)' }}
    >
      <Suspense fallback={null}>
        <LoginCard />
      </Suspense>
    </div>
  )
}
