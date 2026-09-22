import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import type { FormEvent } from 'react'
import type { ApiProblem } from '../../lib/contracts'
import { profileQuery } from '../../lib/queries'
import { changePassword } from '../../server/functions'
import { useTimer } from '../../components/timer/timer-provider'
import {
  ErrorNotice,
  FieldError,
  FormProblem,
  Loading,
} from '../../components/ui'

export const Route = createFileRoute('/_authed/profile')({
  loader: async ({ context }) => {
    await context.queryClient.prefetchQuery(profileQuery())
  },
  head: () => ({ meta: [{ title: 'Your profile | Shunyata' }] }),
  component: ProfilePage,
})

function ProfilePage() {
  const profile = useQuery(profileQuery())
  const timer = useTimer()
  const client = useQueryClient()
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<ApiProblem | null>(null)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setProblem(null)
    const form = new FormData(event.currentTarget)
    try {
      const result = await changePassword({
        data: {
          current_password: String(form.get('current_password')),
          new_password: String(form.get('new_password')),
          password_confirm: String(form.get('password_confirm')),
        },
      })
      if (!result.ok) {
        setProblem(result.error)
        return
      }
      try {
        sessionStorage.setItem(
          'shunyata-auth-notice',
          'Your password has been changed. Sign in again on this device.',
        )
      } catch {
        // The password change still succeeds if browser storage is unavailable.
      }
      timer.discard()
      client.clear()
      window.location.assign('/login')
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
    <section className="profile-page">
      <header className="page-title">
        <p className="eyebrow">YOUR SPACE</p>
        <h1>Your profile</h1>
        <p>Your account details and the key that keeps them private.</p>
      </header>
      {profile.isPending ? (
        <Loading label="Opening your profile…" />
      ) : profile.isError ? (
        <ErrorNotice
          error={profile.error}
          retry={() => void profile.refetch()}
        />
      ) : (
        <div className="profile-layout">
          <section
            className="paper profile-details"
            aria-labelledby="details-title"
          >
            <p className="eyebrow">ACCOUNT DETAILS</p>
            <h2 id="details-title">A quiet place of your own</h2>
            <dl>
              <div>
                <dt>Username</dt>
                <dd>{profile.data.username}</dd>
              </div>
              <div>
                <dt>Verified email</dt>
                <dd>{profile.data.email}</dd>
              </div>
            </dl>
          </section>
          <section
            className="paper profile-password"
            aria-labelledby="password-title"
          >
            <p className="eyebrow">SECURITY</p>
            <h2 id="password-title">Change your password</h2>
            <p>Changing it signs out every device, including this one.</p>
            <form method="post" onSubmit={submit}>
              <fieldset disabled={busy}>
                <FormProblem problem={problem} />
                {[
                  ['current_password', 'Current password', 'current-password'],
                  ['new_password', 'New password', 'new-password'],
                  ['password_confirm', 'Confirm new password', 'new-password'],
                ].map(([name, label, autoComplete]) => (
                  <label className="field" key={name}>
                    <span>{label}</span>
                    <input
                      name={name}
                      type="password"
                      required
                      autoComplete={autoComplete}
                      aria-invalid={Boolean(problem?.fields[name])}
                      aria-describedby={
                        problem?.fields[name] ? `${name}-error` : undefined
                      }
                    />
                    <FieldError name={name} problem={problem} />
                  </label>
                ))}
                <button className="button" type="submit">
                  {busy ? 'Changing…' : 'Change password'}
                </button>
              </fieldset>
            </form>
          </section>
        </div>
      )}
    </section>
  )
}
