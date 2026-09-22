import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
} from 'react'
import type { ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { ApiProblem, MeditationType } from '../../lib/contracts'
import {
  advanceTimer,
  beginTimer,
  finishTimer,
  pauseTimer,
  restoreTimer,
  resumeTimer,
  timerSaveValues,
  TIMER_STORAGE_KEY,
} from '../../lib/timer'
import type { TimerDraft } from '../../lib/timer'
import { TimerBell } from '../../lib/timer-audio'
import { saveSession } from '../../server/functions'
import { useRouter } from '@tanstack/react-router'

interface TimerContextValue {
  draft: TimerDraft | null
  ready: boolean
  now: number
  storageAvailable: boolean
  soundReady: boolean
  soundFailed: boolean
  saving: boolean
  problem: ApiProblem | null
  start: (type: MeditationType, minutes: number, sound: boolean) => void
  pause: () => void
  resume: () => void
  finish: () => void
  discard: () => void
  setNotes: (notes: string) => void
  setSound: (enabled: boolean) => void
  enableSound: () => Promise<void>
  save: () => Promise<boolean>
}
const TimerContext = createContext<TimerContextValue | null>(null)

export function TimerProvider({
  scope,
  children,
}: {
  scope: string
  children: ReactNode
}) {
  const client = useQueryClient()
  const router = useRouter()
  const [draft, setDraft] = useState<TimerDraft | null>(null)
  const current = useRef<TimerDraft | null>(null)
  const [ready, setReady] = useState(false)
  const [now, setNow] = useState(0)
  const [storageAvailable, setStorageAvailable] = useState(true)
  const [soundReady, setSoundReady] = useState(false)
  const [soundFailed, setSoundFailed] = useState(false)
  const [saving, setSaving] = useState(false)
  const savingRef = useRef(false)
  const [problem, setProblem] = useState<ApiProblem | null>(null)
  const bell = useRef<TimerBell | null>(null)
  const mounted = useRef(false)

  const commit = useCallback((next: TimerDraft | null, ring = false) => {
    if (ring && next?.completed && next.soundEnabled) bell.current?.play()
    current.current = next
    setDraft(next)
    setNow(Date.now())
    try {
      if (next) sessionStorage.setItem(TIMER_STORAGE_KEY, JSON.stringify(next))
      else sessionStorage.removeItem(TIMER_STORAGE_KEY)
    } catch {
      setStorageAvailable(false)
    }
  }, [])

  useEffect(() => {
    mounted.current = true
    bell.current = new TimerBell()
    const time = Date.now()
    try {
      const restored = restoreTimer(
        sessionStorage.getItem(TIMER_STORAGE_KEY),
        scope,
        time,
      )
      commit(restored)
      // Also probe writes so disabled/quota-limited storage is reported at setup.
      sessionStorage.setItem(`${TIMER_STORAGE_KEY}.probe`, '1')
      sessionStorage.removeItem(`${TIMER_STORAGE_KEY}.probe`)
    } catch {
      setStorageAvailable(false)
    }
    setNow(time)
    setReady(true)
    const tick = () => {
      const nextNow = Date.now()
      const value = current.current
      if (value?.phase === 'running') {
        const next = advanceTimer(value, nextNow)
        if (next !== value) commit(next, true)
        else setNow(nextNow)
      }
      setSoundReady(bell.current?.ready ?? false)
    }
    const interval = window.setInterval(tick, 250)
    document.addEventListener('visibilitychange', tick)
    window.addEventListener('pageshow', tick)
    return () => {
      mounted.current = false
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', tick)
      window.removeEventListener('pageshow', tick)
      bell.current?.close()
    }
  }, [scope, commit])

  async function enableSound() {
    const enabled = (await bell.current?.enable()) ?? false
    if (!mounted.current) return
    setSoundReady(enabled)
    setSoundFailed(!enabled)
  }
  function transition(action: (value: TimerDraft, time: number) => TimerDraft) {
    if (!current.current || savingRef.current) return
    const previous = current.current
    const next = action(previous, Date.now())
    commit(
      next,
      previous.phase !== 'review' && next.phase === 'review' && next.completed,
    )
  }
  async function save() {
    if (!current.current || savingRef.current) return false
    setProblem(null)
    savingRef.current = true
    setSaving(true)
    try {
      const result = await saveSession({
        data: { values: timerSaveValues(current.current), timerScope: scope },
      })
      if (!mounted.current) return false
      if (!result.ok) {
        setProblem(result.error)
        if (result.error.status === 409) await router.invalidate()
        return false
      }
      commit(null)
      // A failed refetch does not undo a confirmed write or invite another save.
      await client.invalidateQueries({ queryKey: ['sessions'] }).catch(() => {})
      return true
    } catch (error) {
      if (mounted.current)
        setProblem({
          status: 503,
          message:
            error instanceof Error
              ? error.message
              : 'We could not save this moment. Your reflection is still here.',
          fields: {},
        })
      return false
    } finally {
      savingRef.current = false
      if (mounted.current) setSaving(false)
    }
  }

  return (
    <TimerContext.Provider
      value={{
        draft,
        ready,
        now,
        storageAvailable,
        soundReady,
        soundFailed,
        saving,
        problem,
        start: (type, minutes, sound) => {
          if (!ready || current.current || savingRef.current) return
          setProblem(null)
          setSoundFailed(false)
          commit(beginTimer(scope, type, minutes, sound, Date.now()))
          if (sound) void enableSound()
        },
        pause: () => transition(pauseTimer),
        resume: () => {
          if (current.current?.soundEnabled) void enableSound()
          transition(resumeTimer)
        },
        finish: () => transition(finishTimer),
        discard: () => {
          if (!savingRef.current) {
            commit(null)
            setProblem(null)
          }
        },
        setNotes: (notes) => {
          if (current.current?.phase === 'review' && !savingRef.current)
            commit({ ...current.current, notes })
        },
        setSound: (enabled) => {
          if (current.current && !savingRef.current) {
            commit({ ...current.current, soundEnabled: enabled })
            if (enabled) void enableSound()
          }
        },
        enableSound,
        save,
      }}
    >
      {children}
    </TimerContext.Provider>
  )
}

export function useTimer() {
  const value = useContext(TimerContext)
  if (!value)
    throw new Error('Timer components need the authenticated timer provider.')
  return value
}
