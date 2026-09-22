import {
  Link,
  Outlet,
  createFileRoute,
  redirect,
  useRouter,
  useLocation,
} from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { Brand, ErrorNotice, Footer } from '../components/ui'
import { logout } from '../server/functions'
import { TimerProvider, useTimer } from '../components/timer/timer-provider'
import { countdownLabel, elapsedMs } from '../lib/timer'

export const Route = createFileRoute('/_authed')({
  beforeLoad: ({ context }) => {
    if (!context.auth.authenticated) throw redirect({ to: '/login' })
  },
  component: AppLayout,
})
function AppLayout() {
  const { auth } = Route.useRouteContext()
  if (!auth.timerScope) return null
  return (
    <TimerProvider key={auth.timerScope} scope={auth.timerScope}>
      <AppContent />
    </TimerProvider>
  )
}
function AppContent() {
  const client = useQueryClient()
  const router = useRouter()
  const location = useLocation()
  const timer = useTimer()
  const signOutDialog = useRef<HTMLDialogElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)
  async function signOut() {
    setBusy(true)
    try {
      await logout()
      timer.discard()
      client.clear()
      await router.invalidate()
      await router.navigate({ to: '/login' })
    } catch (failure) {
      setError(failure)
      setBusy(false)
    }
  }
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="header">
        <Brand />
        <nav aria-label="Main navigation">
          <Link
            to="/"
            activeOptions={{ exact: true }}
            className="nav-link"
            activeProps={{ className: 'nav-link active' }}
          >
            Journal
          </Link>
          <Link
            to="/timer"
            className="nav-link"
            activeProps={{ className: 'nav-link active' }}
          >
            Timer
          </Link>
          <Link
            to="/sessions/new"
            className="nav-link"
            activeProps={{ className: 'nav-link active' }}
          >
            Log a session
          </Link>
          <Link
            to="/statistics"
            className="nav-link"
            activeProps={{ className: 'nav-link active' }}
          >
            Statistics
          </Link>
          <Link
            to="/profile"
            className="nav-link"
            activeProps={{ className: 'nav-link active' }}
          >
            Profile
          </Link>
          <span className="nav-divider" />
          <button
            className="sign-out"
            onClick={() => {
              if (timer.draft) signOutDialog.current?.showModal()
              else void signOut()
            }}
            disabled={busy || timer.saving || !timer.ready}
          >
            {busy ? 'Leaving…' : 'Sign out'}
          </button>
        </nav>
      </header>
      {error ? <ErrorNotice error={error} /> : null}
      {timer.draft && location.pathname !== '/timer' && (
        <Link className="timer-return" to="/timer">
          <span className="timer-return-dot" aria-hidden="true" />
          <span>
            {timer.draft.phase === 'review'
              ? 'Your session is ready to save'
              : timer.draft.phase === 'paused'
                ? 'Your practice is paused'
                : `${countdownLabel(timer.draft.targetMs - elapsedMs(timer.draft, timer.now))} of quiet remaining`}
          </span>
          <span>
            Return to timer <span aria-hidden="true">→</span>
          </span>
        </Link>
      )}
      <main id="main">
        <Outlet />
      </main>
      <Footer />
      <dialog
        ref={signOutDialog}
        className="paper confirm-dialog"
        aria-labelledby="timer-signout-title"
        onCancel={(event) => {
          if (busy) event.preventDefault()
        }}
      >
        <p className="eyebrow">Before you go</p>
        <h2 id="timer-signout-title">Leave this session behind?</h2>
        <p>Signing out will discard your timer and any unsaved reflection.</p>
        <div className="form-actions">
          <button
            className="button secondary"
            autoFocus
            disabled={busy}
            onClick={() => signOutDialog.current?.close()}
          >
            Stay here
          </button>
          <button
            className="button danger"
            disabled={busy || timer.saving}
            onClick={() => {
              void signOut()
            }}
          >
            {busy ? 'Leaving…' : 'Discard and sign out'}
          </button>
        </div>
      </dialog>
    </div>
  )
}
