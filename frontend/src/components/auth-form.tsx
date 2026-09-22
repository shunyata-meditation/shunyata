import { Link, useHydrated, useRouter } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import type { FormEvent } from 'react'
import { login, register } from '../server/functions'
import type { ApiProblem } from '../lib/contracts'
import { Brand, Branch, FieldError, Footer, FormProblem } from './ui'

export function AuthForm({ mode }: { mode: 'login' | 'register' }) {
  const isRegister = mode === 'register'
  const hydrated = useHydrated()
  const router = useRouter()
  const client = useQueryClient()
  const [problem, setProblem] = useState<ApiProblem | null>(null)
  const [busy, setBusy] = useState(false)
  const [registered, setRegistered] = useState(false)
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setProblem(null)
    const form = new FormData(event.currentTarget)
    const credentials = {
      username: String(form.get('username')),
      password: String(form.get('password')),
    }
    try {
      const result = isRegister
        ? await register({
            data: {
              ...credentials,
              email: String(form.get('email')),
              password_confirm: String(form.get('password_confirm')),
            },
          })
        : await login({ data: credentials })
      if (!result.ok) {
        setProblem(result.error)
        return
      }
      if (isRegister) {
        setRegistered(true)
        return
      }
      client.clear()
      await router.invalidate()
      await router.navigate({ to: '/' })
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
  const fields = isRegister
    ? ['username', 'email', 'password', 'password_confirm']
    : ['username', 'password']
  const labels: Record<string, string> = {
    username: 'Username',
    email: 'Email address',
    password: 'Password',
    password_confirm: 'Confirm password',
  }
  return (
    <div className="app-shell">
      <header className="header">
        <Brand />
        <span className="header-note">ONE BREATH AT A TIME</span>
      </header>
      <main className="auth-layout">
        <section className="auth-intro">
          <p className="eyebrow">A quieter kind of practice</p>
          <h1>
            Come back
            <br />
            to yourself.
          </h1>
          <p>
            A small place to notice your practice.
            <br />
            And make a little room for what matters.
          </p>
          <Branch />
          <span className="intro-footnote">
            No perfect practice. Just your own.
          </span>
        </section>
        <section className="paper auth-card">
          {registered ? (
            <>
              <span className="eyebrow">One small step</span>
              <h2>Check your inbox.</h2>
              <p>
                We’ve sent you a link to verify your email. Open it to finish
                creating your account, then come back and sign in.
              </p>
              <Link to="/login" className="button full">
                Back to sign in <span aria-hidden="true">→</span>
              </Link>
            </>
          ) : (
            <>
              <p className="eyebrow">
                {isRegister ? 'Begin gently' : 'Your practice is here'}
              </p>
              <h2>{isRegister ? 'Make yourself at home.' : 'Welcome back.'}</h2>
              <p className="form-intro">
                {isRegister
                  ? 'Create a quiet space for your meditation journal.'
                  : 'Sign in to return to your journal.'}
              </p>
              <form method="post" onSubmit={submit}>
                <fieldset disabled={!hydrated || busy}>
                  <FormProblem problem={problem} />
                  {fields.map((name) => (
                    <label className="field" key={name}>
                      <span>{labels[name]}</span>
                      <input
                        name={name}
                        type={
                          name.includes('password')
                            ? 'password'
                            : name === 'email'
                              ? 'email'
                              : 'text'
                        }
                        required
                        autoComplete={
                          name.includes('password')
                            ? isRegister
                              ? 'new-password'
                              : 'current-password'
                            : name
                        }
                        aria-invalid={Boolean(problem?.fields[name])}
                        aria-describedby={
                          problem?.fields[name] ? `${name}-error` : undefined
                        }
                      />
                      <FieldError name={name} problem={problem} />
                    </label>
                  ))}
                  <button className="button full" type="submit">
                    {busy
                      ? 'A moment…'
                      : isRegister
                        ? 'Create your account'
                        : 'Sign in'}
                    <span aria-hidden="true">→</span>
                  </button>
                </fieldset>
              </form>
              <p className="auth-switch">
                {isRegister ? 'Already have a space here?' : 'New to Shunyata?'}{' '}
                <Link to={isRegister ? '/login' : '/register'}>
                  {isRegister ? 'Sign in' : 'Begin your journal'}
                </Link>
              </p>
            </>
          )}
        </section>
      </main>
      <Footer />
    </div>
  )
}
