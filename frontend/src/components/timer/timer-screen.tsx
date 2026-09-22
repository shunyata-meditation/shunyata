import { Link, useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { typesQuery } from '../../lib/queries'
import { countdownLabel, elapsedMs } from '../../lib/timer'
import { useTimer } from './timer-provider'
import { ErrorNotice, FormProblem, Loading } from '../ui'
import { meditationEmoji } from '../../lib/meditation-emoji'

export function TimerScreen() {
  const timer = useTimer()
  const navigate = useNavigate()
  const dialog = useRef<HTMLDialogElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const previousPhase = useRef<string | undefined>(undefined)
  useEffect(() => {
    const phase = timer.draft?.phase
    if (phase && (!previousPhase.current || phase === 'review'))
      heading.current?.focus({ preventScroll: true })
    previousPhase.current = phase
  }, [timer.draft?.phase])
  if (!timer.ready) return <Loading label="Preparing a little space…" />
  const draft = timer.draft
  const elapsed = draft ? elapsedMs(draft, timer.now) : 0
  const remaining = draft ? draft.targetMs - elapsed : 0
  const phaseLabel = !draft
    ? ''
    : draft.phase === 'running'
      ? 'Your practice has begun.'
      : draft.phase === 'paused'
        ? 'Your timer is paused.'
        : draft.completed
          ? 'Your practice is complete.'
          : 'Your practice has ended early.'
  async function save() {
    if (await timer.save()) await navigate({ to: '/' })
  }
  return (
    <div className="timer-page">
      <div className="timer-title">
        <p className="eyebrow">A MOMENT, JUST FOR YOU</p>
        <h1 ref={heading} tabIndex={-1}>
          {!draft
            ? 'Make room for stillness.'
            : draft.phase === 'review'
              ? 'Take this moment with you.'
              : 'Nothing to do. Just be.'}
        </h1>
        <p>
          {!draft
            ? 'Choose a practice. Find your seat. Begin when you’re ready.'
            : draft.phase === 'review'
              ? 'A little space to notice how you feel.'
              : 'Let the time take care of itself.'}
        </p>
      </div>
      {!timer.storageAvailable && (
        <div className="notice" role="status">
          This browser cannot store your timer. It will continue as you move
          around the journal, but refreshing or closing this tab will lose it.
        </div>
      )}
      <p className="sr-only" role="status" aria-live="polite">
        {phaseLabel}
      </p>
      {!draft ? (
        <TimerSetup />
      ) : draft.phase !== 'review' ? (
        <section
          className="paper timer-practice"
          aria-label="Meditation countdown"
        >
          <p className="eyebrow timer-type-pill"><span aria-hidden="true">{meditationEmoji(draft.typeName)}</span>{draft.typeName}</p>
          <div className="timer-dial">
            <svg viewBox="0 0 240 240" aria-hidden="true">
              <defs><linearGradient id="timer-progress-ink" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#a6b28a" /><stop offset="100%" stopColor="#536d4e" /></linearGradient></defs>
              <circle cx="120" cy="120" r="95" className="timer-orbit" />
              {Array.from({ length: 12 }, (_, index) => <line key={index} x1="120" y1="2" x2="120" y2="6" transform={`rotate(${index * 30} 120 120)`} className="timer-tick" />)}
              <circle cx="120" cy="120" r="110" className="timer-track" />
              <circle
                cx="120"
                cy="120"
                r="110"
                className="timer-progress"
                strokeDasharray={2 * Math.PI * 110}
                strokeDashoffset={
                  2 * Math.PI * 110 * (1 - remaining / draft.targetMs)
                }
              />
              <circle className="timer-progress-tip" r="3.5" cx={120 + 110 * Math.cos(2 * Math.PI * remaining / draft.targetMs)} cy={120 + 110 * Math.sin(2 * Math.PI * remaining / draft.targetMs)} />
            </svg>
            <div className="timer-digits">
              <span className="timer-dial-emoji" aria-hidden="true">{meditationEmoji(draft.typeName)}</span>
              <span role="timer" aria-live="off" aria-label="Time remaining">
                {countdownLabel(remaining)}
              </span>
              <span className="eyebrow">
                {draft.phase === 'paused'
                  ? 'PAUSED · TAKE YOUR TIME'
                  : 'ONE BREATH AT A TIME'}
              </span>
            </div>
          </div>
          <div className="timer-controls">
            <button
              className="button"
              onClick={draft.phase === 'running' ? timer.pause : timer.resume}
            >
              {draft.phase === 'running' ? 'Pause' : 'Resume'}
            </button>
            <button className="button secondary" onClick={timer.finish}>
              Finish early
            </button>
          </div>
          <div className="timer-sound">
            <label>
              <input
                type="checkbox"
                checked={draft.soundEnabled}
                onChange={(event) => timer.setSound(event.target.checked)}
              />{' '}
              Gentle completion bell
            </label>
            {draft.soundEnabled && !timer.soundReady && (
              <button
                className="text-button"
                onClick={() => {
                  void timer.enableSound()
                }}
              >
                Enable bell
              </button>
            )}
          </div>
          {timer.soundFailed && (
            <p className="field-hint" role="status">
              Sound is unavailable right now. Your timer will still finish
              normally.
            </p>
          )}
          <button
            className="text-button timer-discard"
            onClick={() => dialog.current?.showModal()}
          >
            Discard session
          </button>
        </section>
      ) : (
        <section className="paper timer-review">
          <div className="timer-emblem" aria-hidden="true">{meditationEmoji(draft.typeName)}</div>
          <p className="eyebrow">
            {draft.completed ? 'A PRACTICE, COMPLETED' : 'EVERY MOMENT COUNTS'}
          </p>
          <h2>
            {draft.completed ? 'Welcome back.' : 'You made a little space.'}
          </h2>
          <dl className="timer-summary">
            <div>
              <dt>Practice</dt>
              <dd><span aria-hidden="true">{meditationEmoji(draft.typeName)} </span>{draft.typeName}</dd>
            </div>
            <div>
              <dt>Time meditating</dt>
              <dd>
                {countdownLabel(Math.floor(draft.activeMs / 1000) * 1000)}
              </dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>{draft.completed ? 'Completed' : 'Unfinished'}</dd>
            </div>
          </dl>
          <p className="field-hint">
            Paused time is excluded from your meditation time.
          </p>
          <form
            method="post"
            onSubmit={(event) => {
              event.preventDefault()
              void save()
            }}
          >
            <fieldset disabled={timer.saving}>
              <FormProblem problem={timer.problem} />
              <label className="field">
                <span>
                  A reflection <span className="muted">(optional)</span>
                </span>
                <textarea
                  rows={4}
                  placeholder="What did you notice?"
                  value={draft.notes}
                  onChange={(event) => timer.setNotes(event.target.value)}
                />
              </label>
              {draft.activeMs < 1000 && (
                <p className="notice" role="status">
                  This session was less than a second. Begin again when you’re
                  ready; there’s no need to save this one.
                </p>
              )}
              <div className="form-actions">
                <button
                  className="button"
                  type="submit"
                  disabled={draft.activeMs < 1000}
                >
                  {timer.saving ? 'Saving your moment…' : 'Save session'}
                  <span aria-hidden="true">→</span>
                </button>
                <button
                  className="text-button"
                  type="button"
                  onClick={() => dialog.current?.showModal()}
                >
                  Discard
                </button>
              </div>
            </fieldset>
          </form>
        </section>
      )}
      <p className="timer-footnote">
        Long or short. Still or restless. It all belongs here.
      </p>
      <dialog
        ref={dialog}
        className="paper confirm-dialog"
        aria-labelledby="discard-timer-title"
      >
        <p className="eyebrow">A moment to check</p>
        <h2 id="discard-timer-title">Let this session go?</h2>
        <p>
          Your timer and any reflection will be discarded without saving to your
          journal.
        </p>
        <div className="form-actions">
          <button
            className="button secondary"
            autoFocus
            onClick={() => dialog.current?.close()}
          >
            Keep session
          </button>
          <button
            className="button danger"
            onClick={() => {
              timer.discard()
              dialog.current?.close()
            }}
          >
            Discard session
          </button>
        </div>
      </dialog>
    </div>
  )
}

function TimerSetup() {
  const query = useQuery(typesQuery())
  const timer = useTimer()
  const [minutes, setMinutes] = useState('10')
  const [sound, setSound] = useState(true)
  const [selectedType, setSelectedType] = useState('')
  const [error, setError] = useState<string | null>(null)
  if (query.isPending) return <Loading label="Preparing your practice…" />
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
        <p>
          No meditation types are available yet. Please ask the journal
          administrator to add one.
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
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const type = query.data?.find(
      (type) => type.id === Number(data.get('meditation_type')),
    )
    if (!type) return
    try {
      timer.start(type, Number(minutes), sound)
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : 'Please check your timer settings.',
      )
    }
  }
  return (
    <form className="paper timer-setup" method="post" onSubmit={submit}>
      <div className="timer-setup-heading"><div className="timer-emblem" aria-hidden="true">{meditationEmoji(query.data.find((type) => String(type.id) === selectedType)?.name ?? '')}</div><p className="eyebrow">YOUR MOMENT OF QUIET</p></div>
      <label className="field" htmlFor="timer-type">
        <span>Meditation type</span>
      </label>
      <select id="timer-type" name="meditation_type" value={selectedType} onChange={(event) => setSelectedType(event.target.value)} required>
        <option value="" disabled>
          Choose your practice
        </option>
        {query.data.map((type) => (
          <option value={type.id} key={type.id}>
            {meditationEmoji(type.name)} {type.name}
          </option>
        ))}
      </select>
      <fieldset className="duration-choices">
        <legend>How much time would you like?</legend>
        <div className="timer-presets">
          {[5, 10, 15, 20].map((value) => (
            <button
              type="button"
              key={value}
              aria-pressed={Number(minutes) === value}
              onClick={() => setMinutes(String(value))}
            >
              {value}
              <span>min</span>
            </button>
          ))}
        </div>
        <label className="field custom-duration">
          <span>
            Duration <span className="muted">(minutes)</span>
          </span>
          <input
            type="number"
            min="1"
            max="180"
            step="1"
            required
            value={minutes}
            onChange={(event) => setMinutes(event.target.value)}
          />
          <span className="field-hint">
            Choose any duration from 1 to 180 minutes.
          </span>
        </label>
      </fieldset>
      <label className="checkbox-field">
        <input
          type="checkbox"
          checked={sound}
          onChange={(event) => setSound(event.target.checked)}
        />
        <span>
          Gentle completion bell
          <span className="field-hint">One quiet sound to bring you back.</span>
        </span>
      </label>
      {error && (
        <div className="notice error" role="alert">
          {error}
        </div>
      )}
      <button className="button full" type="submit">
        Begin practice <span aria-hidden="true">→</span>
      </button>
      <p className="timer-setup-note">
        Already practiced? <Link to="/sessions/new">Log a session instead</Link>
        .
      </p>
    </form>
  )
}
