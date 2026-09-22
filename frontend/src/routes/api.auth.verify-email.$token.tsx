import { Link, createFileRoute, useHydrated } from '@tanstack/react-router'
import { useState } from 'react'
import { verifyEmail } from '../server/functions'
import { Brand, Enso, FormProblem } from '../components/ui'
import type { ApiProblem } from '../lib/contracts'

export const Route = createFileRoute('/api/auth/verify-email/$token')({
  head: () => ({
    meta: [
      { title: 'Verify your email — Shunyata' },
      { name: 'referrer', content: 'no-referrer' },
    ],
  }),
  headers: () => ({
    'Cache-Control': 'private, no-store',
    'Referrer-Policy': 'no-referrer',
  }),
  component: Verification,
})
function Verification() {
  const { token } = Route.useParams()
  const hydrated = useHydrated()
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [problem, setProblem] = useState<ApiProblem | null>(null)
  async function verify() {
    setBusy(true)
    setProblem(null)
    try {
      const result = await verifyEmail({ data: token })
      if (result.ok) setDone(true)
      else setProblem(result.error)
    } catch {
      setProblem({
        status: 503,
        message: 'We could not connect. Please try again.',
        fields: {},
      })
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="app-shell">
      <header className="header">
        <Brand />
      </header>
      <main className="verification paper">
        <Enso />
        <p className="eyebrow">A place to begin</p>
        <h1>{done ? 'You’re all set.' : 'Welcome to your space.'}</h1>
        <p>
          {done
            ? 'Your email is verified. Your journal is ready when you are.'
            : 'Verify your email to begin your meditation journal.'}
        </p>
        <FormProblem problem={problem} />
        {done ? (
          <Link to="/login" className="button">
            Continue to sign in <span aria-hidden="true">→</span>
          </Link>
        ) : (
          <button
            className="button"
            disabled={!hydrated || busy || problem?.status === 400}
            onClick={verify}
          >
            {busy ? 'Verifying…' : 'Verify email'}
          </button>
        )}
        {problem?.status === 400 && (
          <p>
            This link may have expired or already been used.{' '}
            <Link to="/login">Try signing in</Link>, or{' '}
            <Link to="/register">register again</Link> if it expired.
          </p>
        )}
      </main>
    </div>
  )
}
