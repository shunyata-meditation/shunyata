import { describe, expect, it } from 'vitest'
import {
  advanceTimer,
  beginTimer,
  countdownLabel,
  elapsedMs,
  finishTimer,
  pauseTimer,
  restoreTimer,
  resumeTimer,
  timerSaveValues,
} from '../src/lib/timer'
import { sessionPayload } from '../src/lib/session-values'
import { sessionSchema } from '../src/lib/validation'

const start = 1_800_000_000_000
const begin = () =>
  beginTimer('scope-a', { id: 1, name: 'Mindfulness' }, 1, true, start)

describe('countdown state', () => {
  it('finishes at the deadline even when callbacks arrive much later', () => {
    const timer = begin()
    expect(advanceTimer(timer, start + 59_999)).toBe(timer)
    const finished = advanceTimer(timer, start + 180_000)
    expect(finished).toMatchObject({
      phase: 'review',
      activeMs: 60_000,
      finishedAt: start + 60_000,
      completed: true,
    })
    expect(advanceTimer(finished, start + 300_000)).toBe(finished)
    expect(countdownLabel(-100)).toBe('00:00')
  })
  it('excludes repeated pauses and retains the real finish time', () => {
    let timer = pauseTimer(begin(), start + 10_000)
    expect(elapsedMs(timer, start + 60_000)).toBe(10_000)
    timer = resumeTimer(timer, start + 70_000)
    timer = pauseTimer(timer, start + 90_000)
    timer = resumeTimer(timer, start + 120_000)
    timer = advanceTimer(timer, start + 150_000)
    expect(timerSaveValues(timer)).toMatchObject({
      duration_seconds: 60,
      end_time: new Date(start + 150_000).toISOString(),
      completed: true,
    })
    const values = timerSaveValues(timer)
    expect(sessionSchema.safeParse(values).success).toBe(true)
    expect(sessionPayload(values).end_time).toBe(values.end_time)
  })
  it('does not turn an already finished countdown into an unfinished practice', () => {
    expect(finishTimer(begin(), start + 60_000).completed).toBe(true)
    expect(pauseTimer(begin(), start + 60_000).phase).toBe('review')
  })
  it('finishes early while running or paused without including pauses', () => {
    const timer = pauseTimer(begin(), start + 12_500)
    const finished = finishTimer(timer, start + 80_000)
    expect(timerSaveValues(finished)).toMatchObject({
      duration_seconds: 12,
      completed: false,
      end_time: new Date(start + 80_000).toISOString(),
    })
    expect(
      timerSaveValues(finishTimer(begin(), start + 1_999)).duration_seconds,
    ).toBe(1)
    expect(() => timerSaveValues(finishTimer(begin(), start + 999))).toThrow(
      'one second',
    )
  })
  it('restores a running deadline, paused state, and unsaved reflection', () => {
    const running = begin()
    expect(
      restoreTimer(JSON.stringify(running), 'scope-a', start + 20_000),
    ).toEqual(running)
    expect(
      restoreTimer(JSON.stringify(running), 'scope-a', start + 90_000),
    ).toMatchObject({ phase: 'review', finishedAt: start + 60_000 })
    const paused = pauseTimer(running, start + 20_000)
    expect(
      restoreTimer(JSON.stringify(paused), 'scope-a', start + 90_000),
    ).toEqual(paused)
    const review = {
      ...finishTimer(paused, start + 90_000),
      notes: 'A softer morning.',
    }
    expect(
      restoreTimer(JSON.stringify(review), 'scope-a', start + 100_000)?.notes,
    ).toBe('A softer morning.')
  })
  it('rejects corrupt, foreign-account, and impossible snapshots', () => {
    expect(restoreTimer('{', 'scope-a', start)).toBeNull()
    expect(restoreTimer(JSON.stringify(begin()), 'scope-b', start)).toBeNull()
    for (const invalid of [
      { version: 2 },
      { phase: 'made-up' },
      { targetMs: -1 },
      { activeMs: 70_000 },
      { startedAt: start + 1 },
      { segmentStartedAt: null },
      { notes: 42 },
      { completed: true },
      { activeMs: 5000 },
    ]) {
      expect(
        restoreTimer(
          JSON.stringify({ ...begin(), ...invalid }),
          'scope-a',
          start,
        ),
      ).toBeNull()
    }
  })
  it('rejects unsupported setup values and inconsistent save end times', () => {
    for (const minutes of [0, 0.5, 181, NaN])
      expect(() =>
        beginTimer('a', { id: 1, name: 'Practice' }, minutes, false, start),
      ).toThrow()
    const values = timerSaveValues(advanceTimer(begin(), start + 60_000))
    expect(
      sessionSchema.safeParse({
        ...values,
        end_time: new Date(start + 59_000).toISOString(),
      }).success,
    ).toBe(false)
    expect(
      sessionSchema.safeParse({
        ...values,
        end_time: new Date(start - 1000).toISOString(),
      }).success,
    ).toBe(false)
  })
})
