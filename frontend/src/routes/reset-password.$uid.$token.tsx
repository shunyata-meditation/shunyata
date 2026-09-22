import { Link, createFileRoute, useHydrated } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import type { FormEvent } from 'react'
import type { ApiProblem } from '../lib/contracts'
import { resetPassword, validatePasswordReset } from '../server/functions'
import { Brand, FieldError, FormProblem, LogoMark } from '../components/ui'

export const Route = createFileRoute('/reset-password/$uid/$token')({
  loader: async ({ params }) =>
    validatePasswordReset({ data: { uid: params.uid, token: params.token } }),
  head: () => ({
    meta: [
      { title: 'Choose a new password | Shunyata' },
      { name: 'referrer', content: 'no-referrer' },
    ],
  }),
  headers: () => ({
    'Cache-Control': 'private, no-store',
    'Referrer-Policy': 'no-referrer',
  }),
  component: ResetPasswordPage,
})

function ResetPasswordPage() {
  const { uid, token } = Route.useParams()
  const initial = Route.useLoaderData()
  const hydrated = useHydrated()
  const client = useQueryClient()
  const [problem, setProblem] = useState<ApiProblem | null>(
    initial.ok ? null : initial.error,
  )
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setProblem(null)
    const form = new FormData(event.currentTarget)
    try {
      const result = await resetPassword({
        data: {
          uid,
          token,
          new_password: String(form.get('new_password')),
          password_confirm: String(form.get('password_confirm')),
        },
      })
      if (result.ok) {
        client.clear()
        setDone(true)
      } else setProblem(result.error)
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

  const invalidLink = !initial.ok && !done
  return (
    <div className="app-shell">
      <header className="header">
        <Brand />
      </header>
      <main className="verification paper reset-password-card">
        <LogoMark />
        <p className="eyebrow">A FRESH BEGINNING</p>
        <h1>
          {done
            ? 'Your password is ready.'
            : invalidLink
              ? 'This link has faded.'
              : 'Choose a new password.'}
        </h1>
        {done ? (
          <>
            <p>Your old sessions are signed out. You can return securely.</p>
            <Link to="/login" className="button">
              Continue to sign in <span aria-hidden="true">→</span>
            </Link>
          </>
        ) : invalidLink ? (
          <>
            <FormProblem problem={problem} />
            <p>Request another reset email to continue.</p>
            <Link to="/forgot-password" className="button">
              Request another link
            </Link>
          </>
        ) : (
          <form method="post" onSubmit={submit}>
            <fieldset disabled={!hydrated || busy}>
              <FormProblem problem={problem} />
              {[
                ['new_password', 'New password'],
                ['password_confirm', 'Confirm new password'],
              ].map(([name, label]) => (
                <label className="field" key={name}>
                  <span>{label}</span>
                  <input
                    name={name}
                    type="password"
                    required
                    autoComplete="new-password"
                    aria-invalid={Boolean(problem?.fields[name])}
                    aria-describedby={
                      problem?.fields[name] ? `${name}-error` : undefined
                    }
                  />
                  <FieldError name={name} problem={problem} />
                </label>
              ))}
              <button className="button full" type="submit">
                {busy ? 'Saving…' : 'Set new password'}
                <span aria-hidden="true">→</span>
              </button>
            </fieldset>
          </form>
        )}
      </main>
    </div>
  )
}
