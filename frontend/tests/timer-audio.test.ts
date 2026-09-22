import { afterEach, describe, expect, it, vi } from 'vitest'
import { TimerBell } from '../src/lib/timer-audio'

afterEach(() => vi.unstubAllGlobals())
describe('optional completion bell', () => {
  it('degrades gracefully when audio is missing or blocked', async () => {
    vi.stubGlobal(
      'AudioContext',
      class {
        constructor() {
          throw new Error('Blocked')
        }
      },
    )
    const bell = new TimerBell()
    expect(await bell.enable()).toBe(false)
    expect(() => bell.play()).not.toThrow()
  })
  it('resumes only on enable, plays a short bell, and closes resources', async () => {
    const start = vi.fn()
    const stop = vi.fn()
    const close = vi.fn(async () => {})
    const context = {
      state: 'suspended',
      currentTime: 0,
      destination: {},
      resume: vi.fn(async () => {
        context.state = 'running'
      }),
      close,
      createOscillator: () => ({
        frequency: { value: 0 },
        connect: () => ({ connect: () => {} }),
        start,
        stop,
        disconnect: vi.fn(),
        onended: null,
      }),
      createGain: () => ({
        gain: {
          setValueAtTime: vi.fn(),
          linearRampToValueAtTime: vi.fn(),
          exponentialRampToValueAtTime: vi.fn(),
        },
        disconnect: vi.fn(),
      }),
    }
    vi.stubGlobal(
      'AudioContext',
      class {
        constructor() {
          return context
        }
      },
    )
    const bell = new TimerBell()
    bell.play()
    expect(start).not.toHaveBeenCalled()
    expect(await bell.enable()).toBe(true)
    bell.play()
    expect(start).toHaveBeenCalledTimes(3)
    expect(stop).toHaveBeenCalledWith(2.5)
    bell.close()
    expect(close).toHaveBeenCalledOnce()
    expect(bell.ready).toBe(false)
  })
})
