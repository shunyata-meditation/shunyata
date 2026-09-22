import { describe, expect, it } from 'vitest'
import {
  durationSeconds,
  encodeDuration,
  localToIso,
  resolveStartTime,
  sessionPayload,
  toLocalInput,
} from '../src/lib/session-values'
import { registerSchema, sessionSchema } from '../src/lib/validation'

describe('session values', () => {
  it('preserves fractional timestamps when browsers normalize zero seconds', () => {
    const original = '2026-09-22T10:30:00.123456+03:30'
    expect(
      resolveStartTime(toLocalInput(original).slice(0, 16), original),
    ).toBe(original)
    expect(resolveStartTime('2026-09-23T12:00', original)).toBe(
      localToIso('2026-09-23T12:00'),
    )
  })
  it.each([0.125, 59, 600, 3661.123456, 90061.5])(
    'round-trips %s seconds without dropping precision',
    (seconds) => {
      expect(durationSeconds(encodeDuration(seconds))).toBeCloseTo(seconds, 6)
    },
  )
  it('derives a consistent end time and accepts an unfinished practice', () => {
    expect(
      sessionPayload({
        meditation_type: 4,
        start_time: '2026-09-22T23:55:00+03:30',
        duration_seconds: 600,
        completed: false,
        notes: 'Restless, and still here.',
      }),
    ).toEqual({
      meditation_type: 4,
      start_time: '2026-09-22T23:55:00+03:30',
      end_time: '2026-09-22T20:35:00.000Z',
      duration: '00:10:00',
      completed: false,
      notes: 'Restless, and still here.',
    })
  })
  it('round-trips a browser-local datetime and rejects invalid input', () => {
    const date = '2026-09-22T10:30:45.000Z'
    expect(localToIso(toLocalInput(date))).toBe(date)
    expect(() => localToIso('')).toThrow('valid start')
  })
  it('rejects invalid dates, nonpositive durations, and missing types', () => {
    const good = {
      meditation_type: 1,
      start_time: '2026-09-22T10:00:00Z',
      duration_seconds: 60,
      completed: true,
      notes: '',
    }
    expect(sessionSchema.safeParse(good).success).toBe(true)
    for (const override of [
      { duration_seconds: 0 },
      { duration_seconds: -2 },
      { duration_seconds: NaN },
      { start_time: 'yesterday' },
      { meditation_type: 0 },
    ]) {
      expect(sessionSchema.safeParse({ ...good, ...override }).success).toBe(
        false,
      )
    }
  })
  it('associates mismatched passwords with confirmation', () => {
    const result = registerSchema.safeParse({
      username: 'river',
      email: 'river@example.test',
      password: 'example-phrase',
      password_confirm: 'different',
    })
    expect(result.success).toBe(false)
    if (!result.success)
      expect(result.error.issues[0].path).toEqual(['password_confirm'])
  })
})
