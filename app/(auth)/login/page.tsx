'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Brand } from '@/components/shared/brand'
import { AuthArt } from '@/components/shared/auth-art'
import { Card } from '@/components/ui/card'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/src/lib/supabase/client'
import { ArrowRight, Loader2 } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const { error: loginError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (loginError) {
        setError(loginError.message)
        setLoading(false)
        return
      }

      router.push('/dashboard')
    } catch (err: any) {
      setError(err?.message || 'An unexpected error occurred during login.')
      setLoading(false)
    }
  }

  const handleGoogleLogin = async () => {
    try {
      const { error: oAuthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/dashboard`,
        },
      })

      if (oAuthError) {
        setError(oAuthError.message)
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to authenticate with Google.')
    }
  }

  return (
    <div className="auth-shell flex flex-col studio-page min-h-screen bg-background text-foreground font-sans items-center justify-center p-6">
      <div className="grid w-full max-w-6xl items-stretch gap-10 lg:grid-cols-2">
        <AuthArt />
        <main id="main-content" tabIndex={-1} className="mx-auto flex w-full max-w-md flex-col justify-center py-5">
        {/* Logo Header */}
        <div className="flex flex-col items-center mb-8">
          <Brand className="mb-7" />
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Welcome back</h1>
          <p className="text-muted-foreground text-sm mt-2">Sign in to continue your speech training</p>
        </div>

        {/* Auth Card */}
        <Card className="p-5 shadow-sm sm:p-8">
          {error && (
            <div role="alert" className="mb-6 p-4 rounded-2xl bg-destructive/10 border border-destructive/25 text-destructive text-sm">
              {error}
            </div>
          )}

          {/* Google OAuth Button */}
          <Button variant="ghost"
            type="button"
            onClick={handleGoogleLogin}
            className="w-full flex items-center justify-center gap-3 bg-muted hover:bg-muted text-foreground font-medium py-3.5 px-4 rounded-2xl border border-border transition-all hover:border-border mb-6"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="#EA4335"
                d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.8 14.8 1 12 1 7.4 1 3.5 3.6 1.6 7.4l3.7 2.9C6.2 7.1 8.9 5 12 5z"
              />
              <path
                fill="#4285F4"
                d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z"
              />
              <path
                fill="#FBBC05"
                d="M5.3 14.7c-.2-.7-.4-1.5-.4-2.3s.2-1.6.4-2.3L1.6 7.2C.6 9.2 0 11.5 0 14s.6 4.8 1.6 6.8l3.7-2.9z"
              />
              <path
                fill="#34A853"
                d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3.1 0-5.8-2.1-6.7-5.3L1.6 15.8C3.5 19.6 7.4 23 12 23z"
              />
            </svg>
            Continue with Google
          </Button>

          <div className="flex items-center my-6">
            <div className="flex-1 border-t border-border" />
            <span className="px-3 text-xs text-muted-foreground uppercase tracking-wider">or with email</span>
            <div className="flex-1 border-t border-border" />
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <Label htmlFor="login-email" className="block text-xs font-semibold text-foreground uppercase tracking-wider mb-2">
                Email Address
              </Label>
              <Input id="login-email" name="email" autoComplete="email" type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="alex@example.com"
                className="w-full bg-background border border-border rounded-2xl px-4 py-3 text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary transition-colors text-sm"
              />
            </div>

            <div>
              <Label htmlFor="login-password" className="block text-xs font-semibold text-foreground uppercase tracking-wider mb-2">
                Password
              </Label>
              <Input id="login-password" name="password" autoComplete="current-password" type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="w-full bg-background border border-border rounded-2xl px-4 py-3 text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary transition-colors text-sm"
              />
            </div>

            <Button variant="ghost"
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary text-foreground font-semibold py-3.5 px-4 rounded-2xl shadow-lg shadow-primary/20 transition-all hover:scale-[1.01] mt-6 text-sm disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Opening your studio…
                </>
              ) : (
                <>
                  Sign In <ArrowRight className="w-4 h-4" />
                </>
              )}
            </Button>
          </form>
        </Card>

        {/* Footer Link */}
        <p className="text-center text-sm text-muted-foreground mt-8">
          Don&apos;t have an account?{' '}
          <Link href="/signup" className="text-primary hover:text-primary font-medium">
            Sign up
          </Link>
        </p>
        </main>
      </div>
    </div>
  )
}
