import type { MeditationSession } from './contracts'
import { durationSeconds } from './session-values'

const DAY_MS = 86_400_000

export interface PracticeDay {
  date: Date
  key: string
  minutes: number
  seconds: number
  sessions: number
  future: boolean
}

export interface PracticeStatistics {
  days: PracticeDay[]
  currentStreak: number
  longestStreak: number
  periodMinutes: number
  periodSessions: number
  weekMinutes: number
  weekSessions: number
}

function startOfDay(value: Date) {
  const date = new Date(value)
  date.setHours(0, 0, 0, 0)
  return date
}

function addDays(value: Date, amount: number) {
  const date = new Date(value)
  date.setDate(date.getDate() + amount)
  return date
}

function dateKey(value: Date) {
  return [
    value.getFullYear(),
    String(value.getMonth() + 1).padStart(2, '0'),
    String(value.getDate()).padStart(2, '0'),
  ].join('-')
}

function dayOrdinal(value: Date) {
  return Math.floor(
    Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()) / DAY_MS,
  )
}

function mondayOf(value: Date) {
  const monday = startOfDay(value)
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7))
  return monday
}

export function buildPracticeStatistics(
  sessions: MeditationSession[],
  now = new Date(),
): PracticeStatistics {
  const today = startOfDay(now)
  const activeOrdinals = new Set<number>()
  const totals = new Map<string, { seconds: number; sessions: number }>()

  for (const session of sessions) {
    const startedAt = new Date(session.start_time)
    if (
      !session.completed ||
      !Number.isFinite(startedAt.getTime()) ||
      startedAt > now
    )
      continue
    const key = dateKey(startedAt)
    const total = totals.get(key) ?? { seconds: 0, sessions: 0 }
    total.seconds += durationSeconds(session.duration)
    total.sessions += 1
    totals.set(key, total)
    activeOrdinals.add(dayOrdinal(startedAt))
  }

  const currentWeek = mondayOf(today)
  const periodStart = addDays(currentWeek, -77)
  const days = Array.from({ length: 84 }, (_, index) => {
    const date = addDays(periodStart, index)
    const total = totals.get(dateKey(date)) ?? { seconds: 0, sessions: 0 }
    return {
      date,
      key: dateKey(date),
      minutes: Math.round(total.seconds / 60),
      seconds: total.seconds,
      sessions: total.sessions,
      future: date > today,
    }
  })

  const periodDays = days.filter((day) => !day.future)
  const weekDays = periodDays.filter((day) => day.date >= currentWeek)
  const todayOrdinal = dayOrdinal(today)
  let cursor = activeOrdinals.has(todayOrdinal)
    ? todayOrdinal
    : activeOrdinals.has(todayOrdinal - 1)
      ? todayOrdinal - 1
      : null
  let currentStreak = 0
  while (cursor !== null && activeOrdinals.has(cursor)) {
    currentStreak += 1
    cursor -= 1
  }

  let longestStreak = 0
  let run = 0
  let previous: number | null = null
  for (const ordinal of [...activeOrdinals].sort((a, b) => a - b)) {
    run = previous !== null && ordinal === previous + 1 ? run + 1 : 1
    longestStreak = Math.max(longestStreak, run)
    previous = ordinal
  }

  return {
    days,
    currentStreak,
    longestStreak,
    periodMinutes: Math.round(
      periodDays.reduce((sum, day) => sum + day.seconds, 0) / 60,
    ),
    periodSessions: periodDays.reduce((sum, day) => sum + day.sessions, 0),
    weekMinutes: Math.round(
      weekDays.reduce((sum, day) => sum + day.seconds, 0) / 60,
    ),
    weekSessions: weekDays.reduce((sum, day) => sum + day.sessions, 0),
  }
}
