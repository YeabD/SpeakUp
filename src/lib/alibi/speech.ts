// Owns both speech backends. Cancellation stops audible output before a turn can record.
export class DetectiveSpeech {
  private context: AudioContext | null = null
  private cancel: AbortController | null = null

  unlock() {
    // Run synchronously from a click, before fetching the question or audio.
    try {
      if (!this.context || this.context.state === 'closed') this.context = new AudioContext()
      void this.context.resume().catch(() => {})
    } catch { /* HTMLAudio and browser speech may still work without Web Audio. */ }
    window.speechSynthesis?.resume()
  }

  stop() { this.cancel?.abort() }
  dispose() {
    this.stop()
    void this.context?.close().catch(() => {})
    this.context = null
  }

  async speak(text: string, signal: AbortSignal, onFallback: (message: string) => void) {
    this.stop()
    const controller = new AbortController()
    this.cancel = controller
    const playbackSignal = AbortSignal.any([signal, controller.signal])
    try {
      try {
        const response = await fetch('/api/tts', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, voice: 'sarah' }),
          signal: AbortSignal.any([playbackSignal, AbortSignal.timeout(20000)]),
        })
        if (!response.ok || response.headers.has('X-TTS-Fallback')) throw new Error(`TTS unavailable (${response.status})`)
        const bytes = await response.arrayBuffer()
        if (bytes.byteLength <= 44 || !response.headers.get('Content-Type')?.startsWith('audio/')) throw new Error('TTS returned no playable audio')
        playbackSignal.throwIfAborted()
        try { await this.playAudio(bytes, playbackSignal) }
        catch (error) {
          playbackSignal.throwIfAborted()
          console.warn('Audio play was prevented or failed; trying unlocked Web Audio:', error)
          await this.playBuffer(bytes, playbackSignal)
        }
      } catch (error) {
        playbackSignal.throwIfAborted()
        console.warn('Detective TTS unavailable; trying browser speech:', error)
        onFallback('Using your browser’s voice for Detective Vale.')
        await this.playBrowserSpeech(text, playbackSignal)
      }
    } finally { if (this.cancel === controller) this.cancel = null }
  }

  private async playAudio(bytes: ArrayBuffer, signal: AbortSignal) {
    const url = URL.createObjectURL(new Blob([bytes], { type: 'audio/wav' }))
    const player = new Audio(url)
    try {
      await this.untilEnded(signal, done => {
        player.onended = () => done()
        player.onerror = () => done(new Error('Audio playback failed'))
        player.onpause = () => { if (!player.ended) done(new Error('Audio playback was interrupted')) }
        void player.play().catch(error => done(error))
        return () => { player.onended = null; player.onerror = null; player.onpause = null; player.pause(); player.removeAttribute('src'); player.load() }
      })
    } finally { URL.revokeObjectURL(url) }
  }

  private async playBuffer(bytes: ArrayBuffer, signal: AbortSignal) {
    if (!this.context || this.context.state !== 'running') throw new Error('Browser audio is locked')
    const decoded = await this.context.decodeAudioData(bytes.slice(0))
    signal.throwIfAborted()
    const source = this.context.createBufferSource()
    source.buffer = decoded
    source.connect(this.context.destination)
    await this.untilEnded(signal, done => {
      source.onended = () => done()
      source.start()
      return () => { source.onended = null; source.stop(); source.disconnect() }
    })
  }

  private async playBrowserSpeech(text: string, signal: AbortSignal) {
    if (!('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) throw new Error('Browser speech is unavailable')
    const synthesis = window.speechSynthesis
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'en-GB'
    utterance.rate = 1
    utterance.volume = 1
    const voices = synthesis.getVoices()
    const voice = voices.find(v => v.lang === 'en-GB') ?? voices.find(v => v.lang.startsWith('en'))
    if (voice) utterance.voice = voice
    await this.untilEnded(signal, done => {
      const startupTimeout = setTimeout(() => done(new Error('Browser speech did not start')), 8000)
      utterance.onstart = () => clearTimeout(startupTimeout)
      utterance.onend = () => done()
      utterance.onerror = event => done(new Error(`Browser speech failed: ${event.error}`))
      // Retain the utterance through cleanup so it cannot be collected before onend.
      const cleanup = () => { clearTimeout(startupTimeout); utterance.onstart = null; utterance.onend = null; utterance.onerror = null; synthesis.cancel() }
      try { synthesis.cancel(); synthesis.resume(); synthesis.speak(utterance) }
      catch (error) { cleanup(); throw error }
      return cleanup
    })
  }

  private untilEnded(signal: AbortSignal, start: (done: (error?: Error) => void) => () => void) {
    return new Promise<void>((resolve, reject) => {
      signal.throwIfAborted()
      let cleanup: (() => void) | undefined
      let settled = false
      const onAbort = () => done(new DOMException('Playback stopped', 'AbortError'))
      const timeout = setTimeout(() => done(new Error('Speech playback timed out')), 120000)
      const done = (error?: Error) => {
        if (settled) return
        settled = true
        clearTimeout(timeout)
        signal.removeEventListener('abort', onAbort)
        cleanup?.()
        if (error) reject(error); else resolve()
      }
      signal.addEventListener('abort', onAbort, { once: true })
      try {
        cleanup = start(done)
        if (settled) cleanup()
      } catch (error) { done(error instanceof Error ? error : new Error('Speech playback failed')) }
    })
  }
}
