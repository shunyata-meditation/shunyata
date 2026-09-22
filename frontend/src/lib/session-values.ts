import type { SessionInput } from './contracts'

// DRF represents durations as [days ]HH:MM:SS[.ffffff].
export function durationSeconds(value: string): number {
  const match = /^(?:(\d+) )?(\d+):(\d{2}):(\d{2}(?:\.\d+)?)$/.exec(value)
  if (!match) throw new Error('Invalid session duration.')
  return (
    Number(match[1] ?? 0) * 86400 +
    Number(match[2]) * 3600 +
    Number(match[3]) * 60 +
    Number(match[4])
  )
}
export function encodeDuration(seconds: number): string {
  const micros = Math.round(seconds * 1_000_000)
  const whole = Math.floor(micros / 1_000_000)
  const days = Math.floor(whole / 86400)
  const hours = Math.floor((whole % 86400) / 3600)
  const minutes = Math.floor((whole % 3600) / 60)
  const remainder = whole % 60
  const fraction = micros % 1_000_000
  return `${days ? `${days} ` : ''}${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}${fraction ? `.${String(fraction).padStart(6, '0')}` : ''}`
}
export function sessionPayload(input: SessionInput) {
  return {
    meditation_type: input.meditation_type,
    start_time: input.start_time,
    end_time:
      input.end_time ??
      new Date(
        new Date(input.start_time).getTime() + input.duration_seconds * 1000,
      ).toISOString(),
    duration: encodeDuration(input.duration_seconds),
    completed: input.completed,
    notes: input.notes,
  }
}
export function toLocalInput(iso: string) {
  const date = new Date(iso)
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 19)
}
export function localToIso(value: string) {
  const date = new Date(value)
  if (!value || !Number.isFinite(date.getTime()))
    throw new Error('Enter a valid start date and time.')
  return date.toISOString()
}
export function resolveStartTime(value: string, original?: string) {
  const iso = localToIso(value)
  // Browsers omit :00 seconds; preserve the original offset and fractions when
  // the displayed time has not changed (including ambiguous DST wall times).
  return original && iso === localToIso(toLocalInput(original)) ? original : iso
}
export function formatDuration(value: string) {
  const seconds = durationSeconds(value)
  if (seconds < 60) return `${Number(seconds.toFixed(2))} sec`
  const minutes = seconds / 60
  return `${Number(minutes.toFixed(1))} min`
}
