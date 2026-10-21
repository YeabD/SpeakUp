'use client'

import { useCallback, useEffect, useReducer, useRef } from 'react'
import { RESPONSE_MS, type Attempt, type Turn } from './contracts'
import { canTransition, type Phase } from './machine'
import { DetectiveSpeech } from './speech'

type State = { phase: Phase; attempt: Attempt | null; error: string; speechNotice: string; speechPurpose: 'question' | 'briefing' | 'verdict' | null; remaining: number; transcript: string; hasRecording: boolean }
const initial: State = { phase: 'loading', attempt: null, error: '', speechNotice: '', speechPurpose: null, remaining: RESPONSE_MS, transcript: '', hasRecording: false }
function reducer(state: State, patch: Partial<State>): State {
  if (patch.phase && !canTransition(state.phase, patch.phase)) throw new Error(`Invalid interrogation transition: ${state.phase} → ${patch.phase}`)
  return { ...state, ...patch }
}

export function useInterrogation() {
  const [state, dispatch] = useReducer(reducer, initial)
  const current = useRef(initial)
  const alive = useRef(false)
  const busy = useRef(false)
  const abort = useRef<AbortController | null>(null)
  const recorder = useRef<MediaRecorder | null>(null)
  const stream = useRef<MediaStream | null>(null)
  const context = useRef<AudioContext | null>(null)
  const analyser = useRef<AnalyserNode | null>(null)
  const speech = useRef<DetectiveSpeech | null>(null)
  const blob = useRef<Blob | null>(null)
  const duration = useRef(0)
  const deadline = useRef(0)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)
  const startId = useRef<string | null>(null)

  const update = useCallback((patch: Partial<State>) => {
    if (!alive.current) return
    current.current = reducer(current.current, patch)
    dispatch(patch)
  }, [])
  const clearTimer = useCallback(() => { if (timer.current) clearInterval(timer.current); timer.current = null }, [])
  const closeMedia = useCallback(() => {
    stream.current?.getTracks().forEach(t => { t.onended = null; t.stop() })
    stream.current = null
    analyser.current = null
    void context.current?.close().catch(() => {})
    context.current = null
  }, [])
  const request = useCallback(async <T,>(url: string, body?: object): Promise<T> => {
    const response = await fetch(url, { method: body ? 'POST' : 'GET', headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined, cache: 'no-store', signal: AbortSignal.any([abort.current!.signal, AbortSignal.timeout(55000)]) })
    const data = await response.json()
    if (!response.ok) throw new Error(data.error ?? 'The service could not complete this request.')
    return data as T
  }, [])

  useEffect(() => {
    alive.current = true
    abort.current = new AbortController()
    const controller = abort.current
    void request<{ attempt: Attempt | null }>('/api/alibi').then(data => {
      if (!controller.signal.aborted) update({ attempt: data.attempt, phase: data.attempt?.evaluation ? 'verdict' : 'briefing' })
    }).catch(e => { if (!controller.signal.aborted) update({ phase: 'briefing', error: e.message }) })
    return () => {
      alive.current = false
      controller.abort()
      speech.current?.dispose()
      speech.current = null
      clearTimer()
      if (recorder.current) { recorder.current.onstop = null; recorder.current.onerror = null; recorder.current.ondataavailable = null; if (recorder.current.state !== 'inactive') recorder.current.stop() }
      closeMedia()
    }
  }, [request, update, clearTimer, closeMedia])

  async function exclusive(work: () => Promise<void>) {
    if (busy.current || !alive.current) return
    busy.current = true
    update({ error: '' })
    try { await work() } catch (error) {
      if (alive.current) update({ error: error instanceof Error ? error.message : 'Something went wrong. Please retry.' })
    } finally { busy.current = false }
  }

  function unlockSpeech() {
    speech.current ??= new DetectiveSpeech()
    speech.current.unlock()
    // Prime the recorder's analyser context in the same gesture (including Safari).
    try {
      context.current ??= new AudioContext()
      void context.current.resume().catch(() => {})
    } catch { /* Recording exposes a recoverable error if Web Audio is unavailable. */ }
  }
  async function speak(text: string, returnPhase: 'ready' | 'verdict' | 'briefing') {
    if (recorder.current?.state === 'recording' || stream.current) throw new Error('Finish recording before playback.')
    update({ phase: 'speaking', speechNotice: '', speechPurpose: returnPhase === 'ready' ? 'question' : returnPhase })
    speech.current ??= new DetectiveSpeech()
    try {
      await speech.current.speak(text, abort.current!.signal, speechNotice => update({ speechNotice }))
    } catch (error) {
      if (!alive.current) return
      if (error instanceof Error && error.name === 'AbortError') {
        update({ phase: returnPhase === 'ready' ? 'question' : returnPhase, speechNotice: 'Playback stopped. Replay when you are ready.' })
        return
      }
      // Never strand the turn if both the remote and installed browser voices fail.
      console.warn('Detective voice playback unavailable:', error)
      update({ speechNotice: returnPhase === 'ready' ? 'Voice playback is unavailable. Read the question above; your response is starting.' : 'Voice playback is unavailable. You can read the text on screen.' })
    }
    if (!alive.current) return
    update({ phase: returnPhase })
    if (returnPhase === 'ready' && !document.hidden) await beginRecording()
  }

  async function evaluate(attempt: Attempt) {
    update({ phase: 'evaluating' })
    try {
      const saved = await request<Attempt>('/api/sessions/evaluate', { module_type: 'alibi', attempt_id: attempt.id })
      update({ attempt: saved, phase: 'verdict' })
    } catch (e) { update({ phase: 'question' }); throw e }
  }
  async function nextQuestion(attempt: Attempt) {
    if (attempt.evaluation) { update({ attempt, phase: 'verdict' }); return }
    if (attempt.turns.length === 3) return evaluate(attempt)
    update({ phase: 'fetching', transcript: '', hasRecording: false, remaining: RESPONSE_MS })
    blob.current = null
    let saved: Attempt
    try {
      saved = await request<Attempt>('/api/alibi', { action: 'question', attempt_id: attempt.id })
      update({ attempt: { ...attempt, ...saved }, phase: 'question' })
    } catch (e) { update({ phase: 'question' }); throw e }
    if (saved.evaluation) { update({ phase: 'verdict' }); return }
    if (!saved.question) throw new Error('No question was returned. Please retry.')
    await speak(saved.question, 'ready')
  }

  const prepare = () => { unlockSpeech(); return exclusive(async () => {
    update({ phase: 'loading' })
    startId.current ??= crypto.randomUUID()
    try {
      const attempt = await request<Attempt>('/api/alibi', { action: 'start', attempt_id: startId.current })
      startId.current = null
      update({ attempt, phase: attempt.evaluation ? 'verdict' : 'briefing', transcript: '', hasRecording: false })
      if (!attempt.evaluation) await readBriefing(attempt)
    } catch (e) { update({ phase: current.current.attempt?.evaluation ? 'verdict' : 'briefing' }); throw e }
  }) }
  async function readBriefing(a: Attempt) {
    await speak(`${a.case_file.title}. ${a.case_file.incident} The incident timeline: ${a.case_file.timeline.join('. ')}. Your three mandatory clues: ${a.case_file.clues.join('. ')}. Tell a clear past-tense story and keep your timeline consistent. After each question, your microphone opens automatically for twenty-five seconds.`, 'briefing')
  }
  const briefingSpeech = () => { unlockSpeech(); return exclusive(async () => { const a = current.current.attempt; if (a) await readBriefing(a) }) }
  const resume = () => { unlockSpeech(); return exclusive(async () => { const a = current.current.attempt; if (a) await nextQuestion(a) }) }
  const replay = () => { unlockSpeech(); return exclusive(async () => { const a = current.current.attempt; if (a?.question) await speak(a.question, 'ready'); else if (a) await nextQuestion(a) }) }

  async function transcribe(recording: Blob) {
    update({ phase: 'transcribing' })
    try {
      if (!recording.size) throw new Error('The recording was empty. Please record your answer again.')
      const form = new FormData()
      form.append('audio', recording, recording.type.includes('mp4') ? 'alibi.mp4' : 'alibi.webm')
      const response = await fetch('/api/stt', { method: 'POST', body: form, signal: AbortSignal.any([abort.current!.signal, AbortSignal.timeout(50000)]) })
      const data = await response.json()
      if (!response.ok || !data.transcript?.trim()) throw new Error(data.error ?? 'No speech was recognized. Try recording again.')
      update({ transcript: data.transcript.trim(), phase: 'review' })
    } catch (e) { update({ phase: 'review' }); throw e }
  }
  const finish = useCallback(() => {
    if (current.current.phase !== 'recording' || recorder.current?.state !== 'recording') return
    duration.current = Math.min(RESPONSE_MS, Math.max(0, RESPONSE_MS - (deadline.current - performance.now())))
    clearTimer()
    update({ phase: 'transcribing', remaining: Math.max(0, RESPONSE_MS - duration.current) })
    recorder.current.stop()
  }, [update, clearTimer])
  useEffect(() => {
    // Background tabs throttle JS timers. Finish on hide instead of allowing an overlong recording.
    const onVisibility = () => { if (document.hidden) finish() }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [finish])
  async function beginRecording() {
    if (!['ready', 'review'].includes(current.current.phase)) return
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) throw new Error('Recording needs a supported browser over HTTPS or localhost.')
    update({ phase: 'preparing', transcript: '', hasRecording: false, remaining: RESPONSE_MS })
    blob.current = null
    try {
      const mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: false })
      if (!alive.current) { mic.getTracks().forEach(t => t.stop()); return }
      stream.current = mic
      const ctx = context.current ?? new AudioContext()
      context.current = ctx
      await ctx.resume()
      if (!alive.current) { closeMedia(); return }
      const meter = ctx.createAnalyser()
      meter.fftSize = 256
      ctx.createMediaStreamSource(mic).connect(meter)
      analyser.current = meter
      const mimeType = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm'].find(t => MediaRecorder.isTypeSupported(t))
      const rec = new MediaRecorder(mic, mimeType ? { mimeType } : undefined)
      recorder.current = rec
      const chunks: BlobPart[] = []
      rec.ondataavailable = e => { if (e.data.size) chunks.push(e.data) }
      rec.onerror = () => {
        rec.onstop = null; clearTimer(); if (rec.state !== 'inactive') rec.stop(); closeMedia()
        update({ phase: 'ready', error: 'Microphone recording was interrupted. Please record again.' })
      }
      mic.getAudioTracks().forEach(t => { t.onended = finish })
      rec.onstart = () => {
        if (!alive.current) { rec.stop(); return }
        deadline.current = performance.now() + RESPONSE_MS
        update({ phase: 'recording' })
        timer.current = setInterval(() => {
          const remaining = Math.max(0, deadline.current - performance.now())
          update({ remaining })
          if (remaining <= 0) finish()
        }, 50)
      }
      rec.onstop = () => {
        clearTimer(); closeMedia()
        if (!alive.current) return
        const recording = new Blob(chunks, { type: rec.mimeType })
        blob.current = recording
        update({ hasRecording: recording.size > 0 })
        void exclusive(() => transcribe(recording))
      }
      rec.start(250)
    } catch (e) { closeMedia(); update({ phase: 'ready' }); throw e }
  }
  const record = () => { unlockSpeech(); return exclusive(beginRecording) }
  const retryTranscription = () => exclusive(async () => { if (blob.current) await transcribe(blob.current) })
  const save = () => { unlockSpeech(); return exclusive(async () => {
    const { attempt, transcript, phase } = current.current
    if (!attempt?.question || !transcript || phase !== 'review') return
    const turn: Turn = { question: attempt.question, answer: transcript, duration_ms: duration.current, source: 'speechmatics' }
    update({ phase: 'saving' })
    let saved: Attempt
    try {
      saved = await request<Attempt>('/api/alibi', { action: 'turn', attempt_id: attempt.id, index: attempt.turns.length, turn })
      update({ attempt: saved })
    } catch (e) { update({ phase: 'review' }); throw e }
    await nextQuestion(saved)
  }) }
  const reconstruction = () => { unlockSpeech(); return exclusive(async () => { const e = current.current.attempt?.evaluation; if (e) await speak(e.rephrased_ideal_sentence, 'verdict') }) }
  const stopPlayback = () => { speech.current?.stop() }
  return { ...state, analyser, prepare, resume, replay, record, finish, save, retryTranscription, reconstruction, stopPlayback, briefingSpeech }
}
