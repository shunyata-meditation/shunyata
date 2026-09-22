export const TIMER_STORAGE_KEY = 'shunyata.timer.v1'

export interface TimerDraft {
  version: 1
  scope: string
  phase: 'running' | 'paused' | 'review'
  typeId: number
  typeName: string
  targetMs: number
  startedAt: number
  activeMs: number
  segmentStartedAt: number | null
  finishedAt: number | null
  completed: boolean
  soundEnabled: boolean
  notes: string
}

export function beginTimer(
  scope: string,
  type: { id: number; name: string },
  minutes: number,
  soundEnabled: boolean,
  now: number,
): TimerDraft {
  if (
    !scope ||
    !Number.isInteger(type.id) ||
    type.id <= 0 ||
    !Number.isInteger(minutes) ||
    minutes < 1 ||
    minutes > 180
  )
    throw new Error(
      'Choose a meditation type and a duration from 1 to 180 minutes.',
    )
  return {
    version: 1,
    scope,
    phase: 'running',
    typeId: type.id,
    typeName: type.name,
    targetMs: minutes * 60_000,
    startedAt: now,
    activeMs: 0,
    segmentStartedAt: now,
    finishedAt: null,
    completed: false,
    soundEnabled,
    notes: '',
  }
}

export function elapsedMs(draft: TimerDraft, now: number) {
  return Math.min(
    draft.targetMs,
    draft.activeMs +
      (draft.phase === 'running' && draft.segmentStartedAt !== null
        ? Math.max(0, now - draft.segmentStartedAt)
        : 0),
  )
}

export function advanceTimer(draft: TimerDraft, now: number): TimerDraft {
  if (draft.phase !== 'running' || draft.segmentStartedAt === null) return draft
  const deadline = draft.segmentStartedAt + draft.targetMs - draft.activeMs
  if (now < deadline) return draft
  return {
    ...draft,
    phase: 'review',
    activeMs: draft.targetMs,
    segmentStartedAt: null,
    finishedAt: deadline,
    completed: true,
  }
}

export function pauseTimer(draft: TimerDraft, now: number): TimerDraft {
  const current = advanceTimer(draft, now)
  if (current.phase !== 'running') return current
  return {
    ...current,
    phase: 'paused',
    activeMs: elapsedMs(current, now),
    segmentStartedAt: null,
  }
}

export function resumeTimer(draft: TimerDraft, now: number): TimerDraft {
  return draft.phase === 'paused'
    ? {
        ...draft,
        phase: 'running',
        segmentStartedAt: Math.max(now, draft.startedAt),
      }
    : draft
}

export function finishTimer(draft: TimerDraft, now: number): TimerDraft {
  const current = advanceTimer(draft, now)
  if (current.phase === 'review') return current
  return {
    ...current,
    phase: 'review',
    activeMs: elapsedMs(current, now),
    segmentStartedAt: null,
    finishedAt: Math.max(now, current.startedAt),
    completed: false,
  }
}

export function timerSaveValues(draft: TimerDraft) {
  if (
    draft.phase !== 'review' ||
    draft.finishedAt === null ||
    draft.activeMs < 1000
  )
    throw new Error('Practice for at least one second before saving.')
  return {
    meditation_type: draft.typeId,
    start_time: new Date(draft.startedAt).toISOString(),
    end_time: new Date(draft.finishedAt).toISOString(),
    duration_seconds: Math.floor(draft.activeMs / 1000),
    completed: draft.completed,
    notes: draft.notes,
  }
}

export function countdownLabel(milliseconds: number) {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000))
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}

export function restoreTimer(
  raw: string | null,
  scope: string,
  now: number,
): TimerDraft | null {
  if (!raw) return null
  try {
    const value: unknown = JSON.parse(raw)
    if (!value || typeof value !== 'object') return null
    const d = value as Record<string, unknown>
    const number = (n: unknown): n is number =>
      typeof n === 'number' && Number.isFinite(n) && n >= 0
    if (
      d.version !== 1 ||
      d.scope !== scope ||
      !['running', 'paused', 'review'].includes(String(d.phase)) ||
      !number(d.typeId) ||
      !Number.isInteger(d.typeId) ||
      d.typeId < 1 ||
      typeof d.typeName !== 'string' ||
      !number(d.targetMs) ||
      d.targetMs < 60_000 ||
      d.targetMs > 10_800_000 ||
      d.targetMs % 60_000 !== 0 ||
      !number(d.startedAt) ||
      d.startedAt > now ||
      !number(d.activeMs) ||
      d.activeMs > d.targetMs ||
      typeof d.completed !== 'boolean' ||
      typeof d.soundEnabled !== 'boolean' ||
      typeof d.notes !== 'string'
    )
      return null
    if (d.phase === 'running') {
      if (
        !number(d.segmentStartedAt) ||
        d.segmentStartedAt < d.startedAt ||
        d.segmentStartedAt > now ||
        d.finishedAt !== null ||
        d.completed ||
        d.activeMs >= d.targetMs ||
        d.activeMs > d.segmentStartedAt - d.startedAt
      )
        return null
    } else if (d.segmentStartedAt !== null) return null
    if (
      d.phase === 'paused' &&
      (d.finishedAt !== null ||
        d.completed ||
        d.activeMs >= d.targetMs ||
        d.activeMs > now - d.startedAt)
    )
      return null
    if (
      d.phase === 'review' &&
      (!number(d.finishedAt) ||
        d.finishedAt < d.startedAt ||
        d.finishedAt > now ||
        d.activeMs > d.finishedAt - d.startedAt ||
        (d.completed && d.activeMs !== d.targetMs))
    )
      return null
    return advanceTimer(value as TimerDraft, now)
  } catch {
    return null
  }
}
