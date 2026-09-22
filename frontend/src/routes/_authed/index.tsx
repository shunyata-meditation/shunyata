import { ClientOnly, Link, createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { sessionsQuery } from '../../lib/queries'
import { durationSeconds, formatDuration } from '../../lib/session-values'
import { unwrap } from '../../lib/contracts'
import type { MeditationSession } from '../../lib/contracts'
import { deleteSession } from '../../server/functions'
import { ErrorNotice, Loading, LogoMark } from '../../components/ui'
import { meditationEmoji } from '../../lib/meditation-emoji'

export const Route = createFileRoute('/_authed/')({
  loader: async ({ context }) => {
    await context.queryClient.prefetchQuery(sessionsQuery())
  },
  component: Journal,
})
function Journal() {
  const query = useQuery(sessionsQuery())
  return (
    <>
      <section className="journal-hero">
        <div className="journal-intro">
          <p className="eyebrow">
            <span className="small-rule" /> YOUR PRACTICE, AT YOUR PACE
          </p>
          <h1>
            A little space
            <br />
            for yourself.
          </h1>
          <p>
            Every time you sit, you begin again.
            <br />
            Keep a quiet record of those moments.
          </p>
          <div className="journal-start-actions">
            <Link to="/timer" className="button">
              Begin a session <span aria-hidden="true">→</span>
            </Link>
            <Link to="/sessions/new" className="text-link">
              Log a session
            </Link>
          </div>
        </div>
        {query.data ? (
          <ClientOnly fallback={<PracticeSnapshotFallback />}>
            <PracticeSnapshot sessions={query.data} />
          </ClientOnly>
        ) : (
          <PracticeSnapshotFallback />
        )}
      </section>
      <div className="journal-layout">
        <section className="journal-list">
          <div className="section-heading">
            <div>
              <p className="eyebrow">THE MOMENTS THAT MAKE A PRACTICE</p>
              <h2>Your journal</h2>
            </div>
            {query.data && (
              <span className="count">
                {query.data.length}{' '}
                {query.data.length === 1 ? 'entry' : 'entries'}
              </span>
            )}
          </div>
          {query.isPending ? (
            <Loading />
          ) : query.isError ? (
            <ErrorNotice
              error={query.error}
              retry={() => {
                void query.refetch()
              }}
            />
          ) : query.data.length === 0 ? (
            <div className="empty-state paper">
              <LogoMark />
              <h3>A fresh page.</h3>
              <p>
                Your practice doesn’t have to look a certain way.
                <br />
                Start with a moment you’d like to remember.
              </p>
              <Link to="/sessions/new" className="text-link">
                Record your first session <span aria-hidden="true">→</span>
              </Link>
            </div>
          ) : (
            <ClientOnly fallback={<Loading />}>
              <SessionList sessions={query.data} />
            </ClientOnly>
          )}
        </section>
        <aside className="journal-aside">
          <span className="eyebrow">A GENTLE REMINDER</span>
          <LogoMark />
          <blockquote>
            “You don’t need
            <br />
            to arrive anywhere.
            <br />
            <em>Just return.”</em>
          </blockquote>
          <div className="small-rule" />
          <p>
            A few minutes of attention
            <br />
            is a practice in itself.
          </p>
          <span className="aside-leaf" aria-hidden="true">
            ✳
          </span>
        </aside>
      </div>
    </>
  )
}

function PracticeSnapshot({ sessions }: { sessions: MeditationSession[] }) {
  const now = new Date()
  const startOfWeek = new Date(now)
  const daysSinceMonday = (now.getDay() + 6) % 7
  startOfWeek.setDate(now.getDate() - daysSinceMonday)
  startOfWeek.setHours(0, 0, 0, 0)

  const nextWeek = new Date(startOfWeek)
  nextWeek.setDate(startOfWeek.getDate() + 7)

  const thisWeek = sessions.filter((session) => {
    const startedAt = new Date(session.start_time)
    return startedAt >= startOfWeek && startedAt < nextWeek
  })
  const totalSeconds = thisWeek.reduce(
    (total, session) => total + durationSeconds(session.duration),
    0,
  )
  const roundedMinutes = Math.round(totalSeconds / 60)
  const minuteValue =
    totalSeconds > 0 && roundedMinutes === 0 ? '<1' : roundedMinutes
  const minuteLabel = roundedMinutes === 1 ? 'minute' : 'minutes'

  return (
    <aside className="practice-snapshot" aria-label="Your practice this week">
      <p className="eyebrow">THIS WEEK</p>
      <div className="practice-metrics">
        <p>
          <strong>{thisWeek.length}</strong>
          <span>{thisWeek.length === 1 ? 'session' : 'sessions'}</span>
        </p>
        <p>
          <strong>{minuteValue}</strong>
          <span>{minuteLabel}</span>
        </p>
      </div>
      <p className="snapshot-note">
        {thisWeek.length === 0
          ? 'Begin whenever you’re ready.'
          : 'A quiet rhythm, one moment at a time.'}
      </p>
    </aside>
  )
}

function PracticeSnapshotFallback() {
  return (
    <div className="practice-snapshot snapshot-fallback" aria-hidden="true">
      <p className="eyebrow">THIS WEEK</p>
      <div className="practice-metrics">
        <p>
          <strong>—</strong>
          <span>sessions</span>
        </p>
        <p>
          <strong>—</strong>
          <span>minutes</span>
        </p>
      </div>
      <p className="snapshot-note">Your practice, at a glance.</p>
    </div>
  )
}

function SessionList({ sessions }: { sessions: MeditationSession[] }) {
  const client = useQueryClient()
  const dialog = useRef<HTMLDialogElement>(null)
  const [selected, setSelected] = useState<MeditationSession | null>(null)
  const mutation = useMutation({
    mutationFn: async (id: number) => unwrap(await deleteSession({ data: id })),
    onSuccess: async () => {
      dialog.current?.close()
      setSelected(null)
      await client.invalidateQueries({ queryKey: ['sessions'] })
    },
  })
  const groups = new Map<string, MeditationSession[]>()
  for (const session of [...sessions].sort(
    (a, b) =>
      Date.parse(b.start_time) - Date.parse(a.start_time) || b.id - a.id,
  )) {
    const day = new Date(session.start_time).toLocaleDateString(undefined, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    })
    groups.set(day, [...(groups.get(day) ?? []), session])
  }
  function confirm(session: MeditationSession) {
    mutation.reset()
    setSelected(session)
    dialog.current?.showModal()
  }
  return (
    <>
      <div className="entries">
        {[...groups].map(([date, entries]) => (
          <section className="day-group" key={date}>
            <h3 className="date-heading">{date}</h3>
            {entries.map((session) => (
              <article className="session-entry paper" key={session.id}>
                <div className="session-icon" aria-hidden="true">
                  <span className="meditation-emoji">
                    {meditationEmoji(session.meditation_type_name)}
                  </span>
                </div>
                <div className="session-body">
                  <div className="entry-heading">
                    <h4>{session.meditation_type_name}</h4>
                    <span className="duration">
                      {formatDuration(session.duration)}
                    </span>
                  </div>
                  <div className="entry-meta">
                    <time dateTime={session.start_time}>
                      {new Date(session.start_time).toLocaleTimeString(
                        undefined,
                        { hour: 'numeric', minute: '2-digit' },
                      )}
                    </time>
                    <span aria-hidden="true">·</span>
                    <span
                      className={session.completed ? 'status-complete' : ''}
                    >
                      {session.completed ? 'Completed' : 'Unfinished'}
                    </span>
                  </div>
                  {session.notes && (
                    <p className="session-notes">{session.notes}</p>
                  )}
                  <div className="entry-actions">
                    <Link
                      to="/sessions/$sessionId/edit"
                      params={{ sessionId: String(session.id) }}
                      aria-label={`Edit ${session.meditation_type_name} session`}
                    >
                      Edit
                    </Link>
                    <button
                      type="button"
                      onClick={() => confirm(session)}
                      aria-label={`Delete ${session.meditation_type_name} session`}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </section>
        ))}
      </div>
      <dialog
        ref={dialog}
        className="paper confirm-dialog"
        aria-labelledby="delete-title"
        onCancel={(event) => {
          if (mutation.isPending) event.preventDefault()
        }}
      >
        <p className="eyebrow">A moment to check</p>
        <h2 id="delete-title">Remove this entry?</h2>
        <p>
          Your {selected?.meditation_type_name.toLowerCase()} session and its
          notes will be permanently deleted.
        </p>
        {mutation.isError && <ErrorNotice error={mutation.error} />}
        <div className="form-actions">
          <button
            className="button secondary"
            autoFocus
            disabled={mutation.isPending}
            onClick={() => dialog.current?.close()}
          >
            Keep entry
          </button>
          <button
            className="button danger"
            disabled={mutation.isPending}
            onClick={() => {
              if (selected) mutation.mutate(selected.id)
            }}
          >
            {mutation.isPending ? 'Removing…' : 'Delete entry'}
          </button>
        </div>
      </dialog>
    </>
  )
}
