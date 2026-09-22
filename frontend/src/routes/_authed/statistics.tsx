import { ClientOnly, createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import type { CSSProperties, FormEvent } from 'react'
import { ErrorNotice, Loading } from '../../components/ui'
import { errorMessage, unwrap } from '../../lib/contracts'
import { practiceGoalQuery, sessionsQuery } from '../../lib/queries'
import {
  buildPracticeStatistics,
  type PracticeStatistics,
} from '../../lib/statistics'
import { deletePracticeGoal, savePracticeGoal } from '../../server/functions'

export const Route = createFileRoute('/_authed/statistics')({
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.prefetchQuery(sessionsQuery()),
      context.queryClient.prefetchQuery(practiceGoalQuery()),
    ])
  },
  head: () => ({ meta: [{ title: 'Your statistics | Shunyata' }] }),
  component: StatisticsPage,
})

function StatisticsPage() {
  const sessions = useQuery(sessionsQuery())
  const goal = useQuery(practiceGoalQuery())

  return (
    <section className="statistics-page">
      <header className="statistics-title">
        <p className="eyebrow">THE SHAPE OF YOUR PRACTICE</p>
        <h1>Small moments, gathered.</h1>
        <p>
          Notice the rhythm you’re building, without asking it to be perfect.
        </p>
      </header>
      {sessions.isPending || goal.isPending ? (
        <Loading label="Gathering your practice…" />
      ) : sessions.isError ? (
        <ErrorNotice
          error={sessions.error}
          retry={() => void sessions.refetch()}
        />
      ) : goal.isError ? (
        <ErrorNotice error={goal.error} retry={() => void goal.refetch()} />
      ) : (
        <ClientOnly fallback={<Loading label="Gathering your practice…" />}>
          <StatisticsContent
            sessions={sessions.data}
            weeklyGoal={goal.data.weekly_minutes}
          />
        </ClientOnly>
      )}
    </section>
  )
}

function StatisticsContent({
  sessions,
  weeklyGoal,
}: {
  sessions: Parameters<typeof buildPracticeStatistics>[0]
  weeklyGoal: number | null
}) {
  const statistics = buildPracticeStatistics(sessions)
  return (
    <>
      <div className="streak-grid">
        <MetricCard
          label="CURRENT STREAK"
          value={statistics.currentStreak}
          unit={statistics.currentStreak === 1 ? 'day' : 'days'}
          note={
            statistics.currentStreak > 0
              ? 'A steady return to yourself.'
              : 'Your next return can begin today.'
          }
        />
        <MetricCard
          label="LONGEST STREAK"
          value={statistics.longestStreak}
          unit={statistics.longestStreak === 1 ? 'day' : 'days'}
          note="Your longest stretch of daily practice."
        />
        <MetricCard
          label="LAST 12 WEEKS"
          value={statistics.periodMinutes}
          unit="minutes"
          note={`${statistics.periodSessions} completed ${statistics.periodSessions === 1 ? 'session' : 'sessions'}.`}
        />
      </div>
      <div className="statistics-layout">
        <ProgressChart statistics={statistics} />
        <GoalCard statistics={statistics} weeklyGoal={weeklyGoal} />
      </div>
    </>
  )
}

function MetricCard({
  label,
  value,
  unit,
  note,
}: {
  label: string
  value: number
  unit: string
  note: string
}) {
  return (
    <article className="metric-card paper">
      <p className="eyebrow">{label}</p>
      <p className="metric-value">
        <strong>{value}</strong> <span>{unit}</span>
      </p>
      <p>{note}</p>
    </article>
  )
}

function activityLevel(minutes: number) {
  if (minutes >= 40) return 4
  if (minutes >= 20) return 3
  if (minutes >= 10) return 2
  if (minutes > 0) return 1
  return 0
}

function ProgressChart({ statistics }: { statistics: PracticeStatistics }) {
  return (
    <section className="progress-card paper" aria-labelledby="progress-title">
      <div className="card-heading">
        <div>
          <p className="eyebrow">DAILY PRACTICE</p>
          <h2 id="progress-title">The last twelve weeks</h2>
        </div>
        <span>{statistics.periodMinutes} min</span>
      </div>
      <div className="heatmap-frame">
        <div className="weekday-labels" aria-hidden="true">
          <span>Mon</span>
          <span />
          <span>Wed</span>
          <span />
          <span>Fri</span>
          <span />
          <span>Sun</span>
        </div>
        <div
          className="practice-heatmap"
          role="list"
          aria-label="Completed meditation minutes by day for the last twelve weeks"
        >
          {statistics.days.map((day) => {
            const date = day.date.toLocaleDateString(undefined, {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })
            const label = day.future
              ? `${date}: upcoming`
              : `${date}: ${day.minutes} ${day.minutes === 1 ? 'minute' : 'minutes'} across ${day.sessions} ${day.sessions === 1 ? 'session' : 'sessions'}`
            return (
              <span
                key={day.key}
                className={`heatmap-day level-${activityLevel(day.minutes)}${day.future ? ' future' : ''}`}
                role="listitem"
                aria-label={label}
                title={label}
              />
            )
          })}
        </div>
      </div>
      <div className="heatmap-legend" aria-label="Chart intensity legend">
        <span>Less</span>
        {[0, 1, 2, 3, 4].map((level) => (
          <span
            key={level}
            className={`heatmap-day level-${level}`}
            aria-hidden="true"
          />
        ))}
        <span>More</span>
      </div>
    </section>
  )
}

function GoalCard({
  statistics,
  weeklyGoal,
}: {
  statistics: PracticeStatistics
  weeklyGoal: number | null
}) {
  const client = useQueryClient()
  const [editing, setEditing] = useState(weeklyGoal === null)
  const [value, setValue] = useState(String(weeklyGoal ?? 60))
  const [validationError, setValidationError] = useState<string | null>(null)
  const mutation = useMutation({
    mutationFn: async (target: number | null) =>
      target === null
        ? unwrap(await deletePracticeGoal())
        : unwrap(await savePracticeGoal({ data: { weekly_minutes: target } })),
    onSuccess: async (_, target) => {
      await client.invalidateQueries({ queryKey: ['practice-goal'] })
      if (target === null) {
        setValue('60')
        setEditing(true)
      } else {
        setEditing(false)
      }
    },
  })

  function save(event: FormEvent) {
    event.preventDefault()
    setValidationError(null)
    const target = Number(value)
    if (!/^\d+$/.test(value) || target < 1 || target > 10_080) {
      setValidationError('Enter a whole number from 1 to 10,080.')
      return
    }
    mutation.mutate(target)
  }

  const percentage = weeklyGoal
    ? Math.round((statistics.weekMinutes / weeklyGoal) * 100)
    : 0
  const fill = Math.min(percentage, 100) * 3.6
  const remaining = weeklyGoal
    ? Math.max(weeklyGoal - statistics.weekMinutes, 0)
    : 0

  return (
    <aside className="goal-card paper" aria-labelledby="goal-title">
      <p className="eyebrow">THIS WEEK’S INTENTION</p>
      {editing ? (
        <form onSubmit={save}>
          <h2 id="goal-title">
            {weeklyGoal === null ? 'Set a gentle goal' : 'Adjust your goal'}
          </h2>
          <p>Choose how many minutes you’d like to make space for each week.</p>
          <label className="field goal-field">
            <span>Weekly minutes</span>
            <input
              type="number"
              min="1"
              max="10080"
              step="1"
              value={value}
              aria-invalid={validationError ? true : undefined}
              onChange={(event) => setValue(event.target.value)}
            />
            {validationError && (
              <span className="field-error">{validationError}</span>
            )}
          </label>
          {mutation.isError && (
            <p className="field-error" role="alert">
              {errorMessage(mutation.error)}
            </p>
          )}
          <div className="goal-actions">
            <button className="button" disabled={mutation.isPending}>
              {mutation.isPending ? 'Saving…' : 'Save goal'}
            </button>
            {weeklyGoal !== null && (
              <button
                type="button"
                className="text-button"
                disabled={mutation.isPending}
                onClick={() => {
                  setValidationError(null)
                  setValue(String(weeklyGoal))
                  setEditing(false)
                }}
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      ) : (
        <>
          <div
            className="goal-ring"
            style={{ '--goal-fill': `${fill}deg` } as CSSProperties}
            role="progressbar"
            aria-label="Weekly meditation goal"
            aria-valuemin={0}
            aria-valuemax={weeklyGoal ?? undefined}
            aria-valuenow={Math.min(statistics.weekMinutes, weeklyGoal ?? 0)}
            aria-valuetext={`${statistics.weekMinutes} of ${weeklyGoal} minutes, ${percentage}%`}
          >
            <div>
              <strong>{percentage}%</strong>
              <span>of your goal</span>
            </div>
          </div>
          <h2 id="goal-title">
            {statistics.weekMinutes} of {weeklyGoal} minutes
          </h2>
          <p>
            {remaining === 0
              ? 'You reached your intention. Let the rest be a gift.'
              : `${remaining} ${remaining === 1 ? 'minute' : 'minutes'} remain this week.`}
          </p>
          <p className="goal-session-count">
            {statistics.weekSessions} completed{' '}
            {statistics.weekSessions === 1 ? 'session' : 'sessions'}
          </p>
          {mutation.isError && (
            <p className="field-error" role="alert">
              {errorMessage(mutation.error)}
            </p>
          )}
          <div className="goal-actions">
            <button
              type="button"
              className="text-button"
              onClick={() => {
                mutation.reset()
                setValue(String(weeklyGoal))
                setEditing(true)
              }}
            >
              Edit goal
            </button>
            <button
              type="button"
              className="text-button remove-goal"
              disabled={mutation.isPending}
              onClick={() => mutation.mutate(null)}
            >
              {mutation.isPending ? 'Removing…' : 'Remove goal'}
            </button>
          </div>
        </>
      )}
    </aside>
  )
}
