import { Link, useHydrated } from '@tanstack/react-router'
import { useState } from 'react'
import type { FormEvent } from 'react'
import type { ApiProblem } from '../lib/contracts'
import { requestPasswordReset, resendVerification } from '../server/functions'
import { Brand, FieldError, Footer, FormProblem, LogoMark } from './ui'

export function AccountEmailPage({
  mode,
}: {
  mode: 'password-reset' | 'verification'
}) {
  const hydrated = useHydrated()
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [problem, setProblem] = useState<ApiProblem | null>(null)
  const reset = mode === 'password-reset'

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setProblem(null)
    const email = String(new FormData(event.currentTarget).get('email'))
    try {
      const result = reset
        ? await requestPasswordReset({ data: { email } })
        : await resendVerification({ data: { email } })
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
        <span className="header-note">ONE BREATH AT A TIME</span>
      </header>
      <main className="account-recovery-layout">
        <section className="paper account-recovery-card">
          <LogoMark />
          <p className="eyebrow">A WAY BACK</p>
          <h1>
            {done
              ? 'Check your inbox.'
              : reset
                ? 'Reset your password.'
                : 'Verify your email.'}
          </h1>
          {done ? (
            <>
              <p>
                {reset
                  ? 'If an eligible account uses that email, a reset link is on its way.'
                  : 'If an unverified account uses that email, a verification link is on its way.'}
              </p>
              <Link to="/login" className="button">
                Return to sign in <span aria-hidden="true">→</span>
              </Link>
            </>
          ) : (
            <>
              <p>
                {reset
                  ? 'Enter your verified email and we’ll send a one-hour reset link.'
                  : 'Enter the email you used to begin your journal.'}
              </p>
              <form method="post" onSubmit={submit}>
                <fieldset disabled={!hydrated || busy}>
                  <FormProblem problem={problem} />
                  <label className="field">
                    <span>Email address</span>
                    <input
                      name="email"
                      type="email"
                      required
                      autoComplete="email"
                      aria-invalid={Boolean(problem?.fields.email)}
                      aria-describedby={
                        problem?.fields.email ? 'email-error' : undefined
                      }
                    />
                    <FieldError name="email" problem={problem} />
                  </label>
                  <button className="button full" type="submit">
                    {busy
                      ? 'Sending…'
                      : reset
                        ? 'Send reset link'
                        : 'Send verification link'}
                    <span aria-hidden="true">→</span>
                  </button>
                </fieldset>
              </form>
              <Link to="/login" className="back-link recovery-back-link">
                ← Back to sign in
              </Link>
            </>
          )}
        </section>
      </main>
      <Footer />
    </div>
  )
}
