import { ClientOnly, Link, useNavigate } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import type { FormEvent } from 'react'
import { sessionQuery, typesQuery } from '../lib/queries'
import {
  durationSeconds,
  resolveStartTime,
  toLocalInput,
} from '../lib/session-values'
import type {
  ApiProblem,
  MeditationSession,
  MeditationType,
} from '../lib/contracts'
import { saveSession } from '../server/functions'
import { ErrorNotice, FieldError, FormProblem, Loading } from './ui'
import { meditationEmoji } from '../lib/meditation-emoji'

export function SessionPage({ id }: { id?: number }) {
  return (
    <div className="session-page">
      <Link to="/" className="back-link">
        ← Back to your journal
      </Link>
      <div className="page-title">
        <p className="eyebrow">
          {id ? 'REVISIT A MOMENT' : 'MAKE A LITTLE NOTE'}
        </p>
        <h1>{id ? 'A moment, remembered.' : 'How was your practice?'}</h1>
        <p>A few details to remember this time you made for yourself.</p>
      </div>
      <div className="session-layout">
        <section>
          {id === undefined ? <FormLoader /> : <ExistingSession id={id} />}
        </section>
        <aside className="form-aside">
          <p>
            Long or short.
            <br />
            Still or restless.
            <br />
            <em>It all belongs here.</em>
          </p>
        </aside>
      </div>
    </div>
  )
}
function ExistingSession({ id }: { id: number }) {
  const query = useQuery(sessionQuery(id))
  if (query.isPending) return <Loading />
  if (query.isError)
    return (
      <ErrorNotice
        error={query.error}
        retry={() => {
          void query.refetch()
        }}
      />
    )
  return <FormLoader session={query.data} />
}
function FormLoader({ session }: { session?: MeditationSession }) {
  const query = useQuery(typesQuery())
  if (query.isPending) return <Loading label="Preparing a fresh page…" />
  if (query.isError)
    return (
      <ErrorNotice
        error={query.error}
        retry={() => {
          void query.refetch()
        }}
      />
    )
  if (query.data.length === 0)
    return (
      <div className="notice" role="status">
        <h2>A little preparation is needed.</h2>
        <p>
          No meditation types are available yet. Please ask the journal
          administrator to add one, then try again.
        </p>
        <button
          className="text-button"
          onClick={() => {
            void query.refetch()
          }}
        >
          Check again
        </button>
      </div>
    )
  return (
    <ClientOnly fallback={<Loading />}>
      <SessionForm
        key={session?.id ?? 'new'}
        session={session}
        types={query.data}
      />
    </ClientOnly>
  )
}
function SessionForm({
  session,
  types,
}: {
  session?: MeditationSession
  types: MeditationType[]
}) {
  const client = useQueryClient()
  const navigate = useNavigate()
  const initialTime = session
    ? toLocalInput(session.start_time)
    : toLocalInput(new Date().toISOString()).slice(0, 16)
  const initialSeconds = session ? durationSeconds(session.duration) : 600
  const initialMinutes = String(initialSeconds / 60)
  const [problem, setProblem] = useState<ApiProblem | null>(null)
  const [busy, setBusy] = useState(false)
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setProblem(null)
    const form = new FormData(event.currentTarget)
    try {
      const localTime = String(form.get('start_time'))
      const minutes = String(form.get('duration_seconds'))
      const values = {
        meditation_type: Number(form.get('meditation_type')),
        start_time: resolveStartTime(localTime, session?.start_time),
        duration_seconds:
          session && minutes === initialMinutes
            ? initialSeconds
            : Number(minutes) * 60,
        completed: form.get('completed') === 'on',
        notes: String(form.get('notes') ?? ''),
        end_time: undefined as string | undefined,
      }
      if (
        session &&
        values.start_time === session.start_time &&
        values.duration_seconds === initialSeconds
      ) {
        values.end_time = session.end_time
      }
      const result = await saveSession({ data: { id: session?.id, values } })
      if (!result.ok) {
        setProblem(result.error)
        return
      }
      await client.invalidateQueries({ queryKey: ['sessions'] })
      await navigate({ to: '/' })
    } catch (error) {
      setProblem({
        status: 503,
        message:
          error instanceof Error
            ? error.message
            : 'We could not save your session. Please try again.',
        fields: {},
      })
    } finally {
      setBusy(false)
    }
  }
  function invalid(name: string) {
    return {
      'aria-invalid': Boolean(problem?.fields[name]),
      'aria-describedby': problem?.fields[name] ? `${name}-error` : undefined,
    }
  }
  return (
    <form className="paper session-form" method="post" onSubmit={submit}>
      <fieldset disabled={busy}>
        <FormProblem problem={problem} />
        <label className="field">
          <span>Meditation type</span>
          <select
            name="meditation_type"
            defaultValue={session?.meditation_type ?? ''}
            required
            {...invalid('meditation_type')}
          >
            <option value="" disabled>
              Choose your practice
            </option>
            {types.map((type) => (
              <option key={type.id} value={type.id}>
                {meditationEmoji(type.name)} {type.name}
              </option>
            ))}
          </select>
          <FieldError name="meditation_type" problem={problem} />
        </label>
        <div className="field-row">
          <label className="field">
            <span>Started at</span>
            <input
              type="datetime-local"
              name="start_time"
              defaultValue={initialTime}
              step="1"
              required
              {...invalid('start_time')}
            />
            <span className="field-hint">Your local date and time</span>
            <FieldError name="start_time" problem={problem} />
          </label>
          <label className="field">
            <span>
              Duration <span className="muted">(minutes)</span>
            </span>
            <input
              type="number"
              name="duration_seconds"
              min="0"
              max="525600"
              step="any"
              defaultValue={initialMinutes}
              required
              {...invalid('duration_seconds')}
            />
            <FieldError name="duration_seconds" problem={problem} />
          </label>
        </div>
        <label className="checkbox-field">
          <input
            type="checkbox"
            name="completed"
            defaultChecked={session?.completed ?? true}
          />
          <span>
            I completed this session
            <span className="field-hint">
              An unfinished practice is welcome here, too.
            </span>
          </span>
        </label>
        <label className="field">
          <span>
            A reflection <span className="muted">(optional)</span>
          </span>
          <textarea
            name="notes"
            rows={5}
            defaultValue={session?.notes ?? ''}
            placeholder="What did you notice?"
            {...invalid('notes')}
          />
          <FieldError name="notes" problem={problem} />
        </label>
        <div className="form-actions">
          <button className="button" type="submit">
            {busy
              ? 'Saving your moment…'
              : session
                ? 'Save changes'
                : 'Save session'}
            <span aria-hidden="true">→</span>
          </button>
          <Link to="/" className="text-link" disabled={busy}>
            Cancel
          </Link>
        </div>
      </fieldset>
    </form>
  )
}
