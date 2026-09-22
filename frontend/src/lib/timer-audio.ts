// A short synthesized bell: no audio files, autoplay, or external requests.
export class TimerBell {
  private context: AudioContext | null = null

  get ready() {
    return this.context?.state === 'running'
  }

  async enable() {
    try {
      this.context ??= new AudioContext()
      if (this.context.state === 'suspended') await this.context.resume()
      return this.ready
    } catch {
      return false
    }
  }

  play() {
    if (!this.context || !this.ready) return
    const context = this.context
    try {
      const now = context.currentTime
      for (const [frequency, volume] of [
        [528, 0.12],
        [1058, 0.035],
        [1588, 0.015],
      ]) {
        const tone = context.createOscillator()
        const gain = context.createGain()
        tone.frequency.value = frequency
        gain.gain.setValueAtTime(0, now)
        gain.gain.linearRampToValueAtTime(volume, now + 0.025)
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 2.4)
        tone.connect(gain).connect(context.destination)
        tone.start(now)
        tone.stop(now + 2.5)
        tone.onended = () => {
          tone.disconnect()
          gain.disconnect()
        }
      }
    } catch {
      /* Audio is optional; timer state must still finish. */
    }
  }

  close() {
    if (this.context) void this.context.close().catch(() => {})
    this.context = null
  }
}
