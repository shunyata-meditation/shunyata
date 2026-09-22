import { describe, expect, it } from 'vitest'
import { buildPracticeStatistics } from '../src/lib/statistics'
import type { MeditationSession } from '../src/lib/contracts'

function session(
  id: number,
  start_time: string,
  duration = '00:10:00',
  completed = true,
): MeditationSession {
  return {
    id,
    user: 1,
    meditation_type: 1,
    meditation_type_name: 'Mindfulness',
    start_time,
    end_time: start_time,
    duration,
    completed,
    notes: '',
  }
}

describe('practice statistics', () => {
  const now = new Date(2026, 8, 22, 12)

  it('aggregates completed sessions into local days and the current week', () => {
    const stats = buildPracticeStatistics(
      [
        session(1, new Date(2026, 8, 21, 8).toISOString(), '00:12:30'),
        session(2, new Date(2026, 8, 21, 18).toISOString(), '00:07:30'),
        session(3, new Date(2026, 8, 22, 9).toISOString(), '00:05:00'),
        session(4, new Date(2026, 8, 22, 10).toISOString(), '00:30:00', false),
      ],
      now,
    )
    expect(stats.weekMinutes).toBe(25)
    expect(stats.weekSessions).toBe(3)
    expect(stats.days.find((day) => day.key === '2026-09-21')).toMatchObject({
      minutes: 20,
      sessions: 2,
    })
  })

  it('calculates current and longest streaks with yesterday grace', () => {
    const stats = buildPracticeStatistics(
      [
        session(1, new Date(2026, 8, 18, 8).toISOString()),
        session(2, new Date(2026, 8, 19, 8).toISOString()),
        session(3, new Date(2026, 8, 20, 8).toISOString()),
        session(4, new Date(2026, 8, 21, 8).toISOString()),
        session(5, new Date(2026, 8, 15, 8).toISOString()),
      ],
      now,
    )
    expect(stats.currentStreak).toBe(4)
    expect(stats.longestStreak).toBe(4)
  })

  it('excludes future and unfinished sessions and marks upcoming chart days', () => {
    const stats = buildPracticeStatistics(
      [
        session(1, new Date(2026, 8, 23, 8).toISOString()),
        session(2, new Date(2026, 8, 22, 8).toISOString(), '00:10:00', false),
      ],
      now,
    )
    expect(stats.periodSessions).toBe(0)
    expect(stats.currentStreak).toBe(0)
    expect(stats.days.find((day) => day.key === '2026-09-23')?.future).toBe(
      true,
    )
  })
})
