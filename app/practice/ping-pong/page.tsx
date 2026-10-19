'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock3,
  Loader2,
  Mic,
  RotateCcw,
  Sparkles,
  Square,
  Volume2,
  WandSparkles,
  Zap,
} from 'lucide-react'
import { createClient } from '@/src/lib/supabase/client'

const RESPONSE_WINDOW_MS = 15_000
const PASS_SCORE = 75
const SESSIONS_PER_LEVEL = 15

type Phase = 'loading' | 'ready' | 'ai_speaking' | 'recording' | 'evaluating' | 'result'
type ConversationEntry = { role: 'ai' | 'user'; text: string }

type Evaluation = {
  score: number
  is_passed: boolean
  criteria_scores: { relevance: number; vocabulary: number; fluency: number; grammar: number }
  relevance_feedback: string
  filler_words_detected: Array<{ word: string; count: number }>
  vocabulary_upgrades: Array<{ original_word: string; suggested_replacement: string; reason: string }>
  grammar_errors: Array<{ mistake: string; correction: string; explanation: string }>
  rephrased_ideal_sentence: string
}

interface RecognitionEventLike {
  results: ArrayLike<{ isFinal: boolean; 0?: { transcript: string } }>
}

interface SpeechRecognitionLike {
  continuous: boolean
  interimResults: boolean
  lang: string
  onresult: ((event: RecognitionEventLike) => void) | null
  onend: (() => void) | null
  onerror: (() => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike

const LEVEL_NAMES: Record<number, string> = {
  1: 'Everyday Conversation',
  2: 'Reactive Remarks',
  3: 'Nuance & Counterpoints',
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)))
}

function ScoreBar({ label, score, tone }: { label: string; score: number; tone: string }) {
  const safeScore = clampScore(score)
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-xs">
        <span className="font-semibold text-slate-300">{label}</span>
        <span className="font-mono font-bold text-white">{safeScore}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-800">
        <div className={`h-full rounded-full transition-all duration-700 ${tone}`} style={{ width: `${safeScore}%` }} />
      </div>
    </div>
  )
}

export default function ConversationalPingPongPage() {
  const router = useRouter()
  const supabase = createClient()
  const [phase, setPhase] = useState<Phase>('loading')
  const [currentLevel, setCurrentLevel] = useState(1)
  const [sessionNumber, setSessionNumber] = useState(1)
  const [question, setQuestion] = useState('')
  const [promptRevealed, setPromptRevealed] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [timeLeftMs, setTimeLeftMs] = useState(RESPONSE_WINDOW_MS)
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null)
  const [speechUnavailable, setSpeechUnavailable] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'error'>('idle')
  const [conversationHistory, setConversationHistory] = useState<ConversationEntry[]>([])

  const phaseRef = useRef<Phase>('loading')
  const transcriptRef = useRef('')
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const audioUrlRef = useRef<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const deadlineRef = useRef(0)
  const turnTokenRef = useRef(0)
  const saveInFlightRef = useRef(false)

  const transitionTo = useCallback((nextPhase: Phase) => {
    phaseRef.current = nextPhase
    setPhase(nextPhase)
  }, [])

  const clearTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = null
  }, [])

  const stopRecognition = useCallback((abort = false) => {
    const recognition = recognitionRef.current
    recognitionRef.current = null
    if (!recognition) return
    recognition.onresult = null
    recognition.onend = null
    recognition.onerror = null
    try {
      if (abort) recognition.abort()
      else recognition.stop()
    } catch {
      // The browser may already have stopped recognition.
    }
  }, [])

  const stopAudio = useCallback(() => {
    const audio = audioRef.current
    audioRef.current = null
    if (audio) {
      audio.onended = null
      audio.onerror = null
      audio.pause()
    }
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current)
    audioUrlRef.current = null
  }, [])

  const prepareQuestion = useCallback(async (level: number, session: number, history: ConversationEntry[], token: number) => {
    const response = await fetch('/api/ping-pong/turn', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        level_number: level,
        session_number: session,
        turn_index: history.filter((entry) => entry.role === 'user').length,
        conversation_history: history,
        user_last_input: history.at(-1)?.role === 'user' ? history.at(-1)?.text : '',
      }),
    })
    const data = await response.json()
    if (!response.ok) throw new Error(data.error ?? 'Unable to prepare the next volley.')
    if (turnTokenRef.current !== token) return
    setQuestion(String(data.ai_reply || 'What is one small change that would improve your daily routine?'))
    setPromptRevealed(false)
    setTranscript('')
    transcriptRef.current = ''
    setTimeLeftMs(RESPONSE_WINDOW_MS)
    setEvaluation(null)
    setErrorMessage('')
    setSaveState('idle')
    saveInFlightRef.current = false
    transitionTo('ready')
  }, [transitionTo])

  const resetVolley = useCallback(() => {
    turnTokenRef.current += 1
    clearTimer()
    stopRecognition(true)
    stopAudio()
    setPromptRevealed(false)
    setTranscript('')
    transcriptRef.current = ''
    setTimeLeftMs(RESPONSE_WINDOW_MS)
    setEvaluation(null)
    setErrorMessage('')
    setSaveState('idle')
    saveInFlightRef.current = false
    transitionTo('ready')
  }, [clearTimer, stopAudio, stopRecognition, transitionTo])

  const finishSpeaking = useCallback(async (timedOut = false) => {
    if (phaseRef.current !== 'recording') return
    const token = turnTokenRef.current
    transitionTo('evaluating')
    clearTimer()
    stopRecognition()
    setTimeLeftMs(timedOut ? 0 : Math.max(0, deadlineRef.current - performance.now()))

    try {
      const response = await fetch('/api/ping-pong/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, transcript: transcriptRef.current.trim(), timed_out: timedOut }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? 'The response could not be evaluated.')
      if (turnTokenRef.current !== token) return
      setEvaluation(data as Evaluation)
      transitionTo('result')
    } catch (error) {
      if (turnTokenRef.current !== token) return
      console.error('Ping-pong evaluation failed:', error)
      setErrorMessage(error instanceof Error ? error.message : 'The response could not be evaluated.')
      transitionTo('result')
    }
  }, [clearTimer, question, stopRecognition, transitionTo])

  const startResponseWindow = useCallback((token: number) => {
    if (turnTokenRef.current !== token || phaseRef.current !== 'ai_speaking') return
    stopAudio()
    transcriptRef.current = ''
    setTranscript('')
    setTimeLeftMs(RESPONSE_WINDOW_MS)
    setSpeechUnavailable(false)
    transitionTo('recording')
    deadlineRef.current = performance.now() + RESPONSE_WINDOW_MS

    const speechWindow = window as typeof window & { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor }
    const Recognition = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition
    if (!Recognition) {
      setSpeechUnavailable(true)
    } else {
      try {
        const recognition = new Recognition()
        recognitionRef.current = recognition
        recognition.continuous = true
        recognition.interimResults = true
        recognition.lang = 'en-US'
        recognition.onresult = (event) => {
          if (turnTokenRef.current !== token || phaseRef.current !== 'recording') return
          let nextTranscript = ''
          for (let index = 0; index < event.results.length; index += 1) nextTranscript += `${event.results[index][0]?.transcript ?? ''} `
          nextTranscript = nextTranscript.trim()
          transcriptRef.current = nextTranscript
          setTranscript(nextTranscript)
        }
        recognition.onend = () => {
          if (recognitionRef.current === recognition) recognitionRef.current = null
        }
        recognition.onerror = () => {
          if (recognitionRef.current !== recognition) return
          recognitionRef.current = null
          setSpeechUnavailable(true)
        }
        recognition.start()
      } catch (error) {
        console.warn('Speech recognition failed to start:', error)
        recognitionRef.current = null
        setSpeechUnavailable(true)
      }
    }

    clearTimer()
    timerRef.current = setInterval(() => {
      const remaining = deadlineRef.current - performance.now()
      if (remaining <= 0) {
        clearTimer()
        setTimeLeftMs(0)
        void finishSpeaking(true)
        return
      }
      setTimeLeftMs(remaining)
    }, 100)
  }, [clearTimer, finishSpeaking, stopAudio, transitionTo])

  const startVolley = useCallback(async () => {
    if (phaseRef.current !== 'ready' || !question) return
    const token = turnTokenRef.current
    setPromptRevealed(true)
    setErrorMessage('')
    transitionTo('ai_speaking')
    try {
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: question, voice: 'sarah' }),
      })
      if (!response.ok) throw new Error('Unable to read the prompt aloud.')
      const blob = await response.blob()
      if (turnTokenRef.current !== token) return
      const audioUrl = URL.createObjectURL(blob)
      audioUrlRef.current = audioUrl
      const audio = new Audio(audioUrl)
      audioRef.current = audio
      let responseWindowStarted = false
      const handleAudioEnd = () => {
        if (responseWindowStarted) return
        responseWindowStarted = true
        startResponseWindow(token)
      }
      audio.onended = handleAudioEnd
      audio.onerror = handleAudioEnd
      await audio.play().catch(handleAudioEnd)
    } catch (error) {
      console.warn('Prompt audio failed:', error)
      startResponseWindow(token)
    }
  }, [question, startResponseWindow, transitionTo])

  const handleNextSession = useCallback(async () => {
    if (!evaluation?.is_passed || evaluation.score < PASS_SCORE || saveInFlightRef.current) return
    saveInFlightRef.current = true
    setSaveState('saving')
    try {
      const response = await fetch('/api/sessions/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ module_type: 'ping_pong', level_number: currentLevel, session_number: sessionNumber, accuracy_score: evaluation.score }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? 'Unable to save this session.')
      const completedHistory: ConversationEntry[] = [
        ...conversationHistory,
        { role: 'ai', text: question },
        { role: 'user', text: transcriptRef.current },
      ]
      setConversationHistory(completedHistory)
      if (sessionNumber >= SESSIONS_PER_LEVEL) {
        router.push('/dashboard')
        return
      }
      const nextSession = sessionNumber + 1
      setSessionNumber(nextSession)
      setPromptRevealed(false)
      transitionTo('loading')
      turnTokenRef.current += 1
      const nextToken = turnTokenRef.current
      try {
        await prepareQuestion(currentLevel, nextSession, completedHistory, nextToken)
      } catch (error) {
        console.error('Failed to prepare the next ping-pong prompt:', error)
        if (turnTokenRef.current !== nextToken) return
        setQuestion('What is one recent experience that changed the way you think?')
        setTranscript('')
        transcriptRef.current = ''
        setTimeLeftMs(RESPONSE_WINDOW_MS)
        setEvaluation(null)
        setSaveState('idle')
        saveInFlightRef.current = false
        transitionTo('ready')
      }
    } catch (error) {
      console.error('Failed to save ping-pong session:', error)
      saveInFlightRef.current = false
      setSaveState('error')
    }
  }, [conversationHistory, currentLevel, evaluation, prepareQuestion, question, router, sessionNumber, transitionTo])

  useEffect(() => {
    let active = true
    const token = ++turnTokenRef.current
    async function initialize() {
      try {
        const { data: { user }, error: userError } = await supabase.auth.getUser()
        if (!active) return
        if (userError || !user) {
          router.push('/signup')
          return
        }
        const { data: progressData } = await supabase.from('module_progress').select('current_level, completed_sessions_in_level').eq('user_id', user.id).eq('module_id', 'ping_pong').single()
        if (!active) return
        const level = Math.min(3, Math.max(1, progressData?.current_level ?? 1))
        const session = Math.min(SESSIONS_PER_LEVEL, (progressData?.completed_sessions_in_level ?? 0) + 1)
        setCurrentLevel(level)
        setSessionNumber(session)
        await prepareQuestion(level, session, [], token)
      } catch (error) {
        if (!active) return
        console.error('Failed to initialize ping-pong:', error)
        setQuestion('What is one small change that would improve your daily routine?')
        setErrorMessage('The live prompt service was unavailable, so a practice prompt was loaded instead.')
        transitionTo('ready')
      }
    }
    void initialize()
    return () => {
      active = false
      turnTokenRef.current += 1
      clearTimer()
      stopRecognition(true)
      stopAudio()
    }
  }, [clearTimer, prepareQuestion, router, stopAudio, stopRecognition, supabase, transitionTo])

  const secondsLeft = timeLeftMs / 1000
  const timerPercent = Math.max(0, Math.min(100, (timeLeftMs / RESPONSE_WINDOW_MS) * 100))
  const timerTone = secondsLeft >= 8 ? 'text-indigo-400' : secondsLeft >= 3 ? 'text-amber-400' : 'text-rose-500'
  const timerTrack = secondsLeft >= 8 ? 'stroke-indigo-500' : secondsLeft >= 3 ? 'stroke-amber-500' : 'stroke-rose-500'
  const isBusy = phase === 'ai_speaking' || phase === 'recording' || phase === 'evaluating'

  if (phase === 'loading' && !question) {
    return <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-400"><div className="flex items-center gap-3 text-sm font-semibold"><Loader2 className="h-5 w-5 animate-spin text-indigo-400" /> Preparing your next volley…</div></div>
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-slate-950/90 px-4 py-3 backdrop-blur-xl sm:px-6 lg:px-10">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <button type="button" onClick={() => { if (!isBusy || window.confirm('Leave this active volley? Your response will not be saved.')) router.push('/dashboard') }} className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900 px-3.5 py-2 text-xs font-bold text-slate-400 transition hover:border-slate-700 hover:text-white"><ArrowLeft className="h-4 w-4" /> <span className="hidden sm:inline">Dashboard</span></button>
          <div className="min-w-0 text-center"><p className="truncate text-sm font-black text-white sm:text-base">Conversational Ping-Pong</p><p className="text-[11px] text-slate-500">Level {currentLevel} · {LEVEL_NAMES[currentLevel] ?? LEVEL_NAMES[1]}</p></div>
          <div className="min-w-[100px] text-right"><p className="text-xs font-bold text-slate-200">Session {sessionNumber} of {SESSIONS_PER_LEVEL}</p><div className="mt-1.5 flex justify-end gap-1" aria-hidden="true">{Array.from({ length: SESSIONS_PER_LEVEL }, (_, index) => index + 1).map((session) => <span key={session} className={`h-1.5 rounded-full ${session < sessionNumber ? 'w-2 bg-emerald-500' : session === sessionNumber ? 'w-4 bg-indigo-500' : 'w-1.5 bg-slate-800'}`} />)}</div></div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6 sm:px-6 sm:py-9">
        <section className="relative overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/85 p-5 shadow-2xl shadow-black/20 sm:p-8">
          <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-indigo-500/10 blur-3xl" />
          <div className="relative flex flex-wrap items-center justify-between gap-3"><div><span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-500/25 bg-indigo-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-indigo-300"><Zap className="h-3.5 w-3.5" /> AI serve</span><h1 className="mt-3 text-xl font-black text-white sm:text-2xl">Listen, respond, keep the volley alive.</h1></div><span className="rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-xs font-semibold text-slate-400">Pass mark: {PASS_SCORE}%</span></div>

          <div className="relative mt-6 rounded-2xl border border-slate-700/70 bg-slate-950/75 p-5 sm:p-7">
            <div className="mb-4 flex items-center justify-between gap-3"><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-slate-400"><Volume2 className={`h-4 w-4 ${phase === 'ai_speaking' ? 'animate-pulse text-indigo-300' : 'text-slate-500'}`} />{phase === 'ai_speaking' ? 'Reading the prompt' : 'Conversation prompt'}</div>{phase === 'ai_speaking' && <span className="text-xs font-bold text-indigo-300">Timer paused</span>}</div>
            <div className="relative min-h-28">
              <blockquote aria-hidden={!promptRevealed} className={`border-l-2 border-indigo-500 pl-4 text-lg font-semibold leading-relaxed text-white transition-all duration-500 sm:text-2xl ${promptRevealed ? 'filter-none opacity-100' : 'select-none blur-md opacity-60'}`}>“{question || 'Your conversation prompt is being prepared.'}”</blockquote>
              {!promptRevealed && <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-slate-950/20"><div className="text-center"><p className="text-xs font-bold uppercase tracking-[0.16em] text-indigo-200">Prompt hidden</p><p className="mt-1 text-xs text-slate-400">Reveal it only when you are ready to listen.</p></div></div>}
            </div>
            {phase === 'ready' && <button type="button" onClick={() => void startVolley()} disabled={!question} className="mt-6 flex w-full animate-pulse items-center justify-center gap-2.5 rounded-2xl bg-indigo-600 px-6 py-4 text-sm font-black text-white shadow-lg shadow-indigo-950/40 transition hover:bg-indigo-500 disabled:cursor-wait disabled:opacity-50"><Volume2 className="h-5 w-5" /> Start Volley</button>}
          </div>

          <div className="relative mt-6 grid gap-5 lg:grid-cols-[180px_1fr]">
            <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-800 bg-slate-950/75 p-5">
              <div className={`relative h-32 w-32 ${secondsLeft < 3 && phase === 'recording' ? 'animate-pulse' : ''}`} role="timer" aria-label={`${secondsLeft.toFixed(1)} seconds remaining`}>
                <svg className="h-full w-full -rotate-90" viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="52" fill="none" strokeWidth="8" className="stroke-slate-800" /><circle cx="60" cy="60" r="52" fill="none" strokeWidth="8" strokeLinecap="round" pathLength="100" strokeDasharray="100" strokeDashoffset={100 - timerPercent} className={`transition-all duration-100 ${timerTrack}`} /></svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center"><span className={`font-mono text-2xl font-black ${phase === 'recording' ? timerTone : 'text-slate-500'}`}>{secondsLeft.toFixed(1)}s</span><span className="text-[10px] font-bold uppercase tracking-wider text-slate-600">response</span></div>
              </div>
              <p className="mt-3 text-center text-xs font-semibold text-slate-400">{phase === 'ready' ? 'Paused until Start Volley' : phase === 'ai_speaking' ? 'Paused while AI speaks' : phase === 'recording' ? 'Microphone active' : phase === 'evaluating' ? 'Timer frozen' : '15-second window'}</p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950/75 p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-3"><div className={`flex h-11 w-11 items-center justify-center rounded-xl border ${phase === 'recording' ? 'border-rose-500/40 bg-rose-500/15 text-rose-300 ring-4 ring-rose-500/10' : 'border-slate-700 bg-slate-800 text-slate-500'}`}><Mic className={`h-5 w-5 ${phase === 'recording' ? 'animate-pulse' : ''}`} /></div><div><h2 className="text-sm font-bold text-white">Your response</h2><p className="text-xs text-slate-500">{phase === 'recording' ? 'Speak naturally, then finish early if you are done.' : 'The microphone opens after the prompt audio ends.'}</p></div></div>{phase === 'recording' && <button type="button" onClick={() => void finishSpeaking(false)} className="flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-5 py-3 text-xs font-black text-white transition hover:bg-rose-500"><Square className="h-3.5 w-3.5 fill-current" /> Finish Speaking</button>}</div>
              {speechUnavailable && phase === 'recording' && <p className="mt-4 rounded-xl border border-amber-500/20 bg-amber-400/5 p-3 text-xs text-amber-200">Browser speech recognition is unavailable. Type your response below before the same 15-second timer expires.</p>}
              <textarea value={transcript} onChange={(event) => { const nextTranscript = event.target.value; transcriptRef.current = nextTranscript; setTranscript(nextTranscript) }} disabled={phase !== 'recording'} aria-label="Your response transcript" placeholder={phase === 'recording' ? 'Your words will appear here…' : 'Waiting for your response window…'} className="mt-4 h-32 w-full resize-none rounded-xl border border-slate-800 bg-slate-900 p-4 text-sm leading-relaxed text-slate-200 outline-none transition placeholder:text-slate-600 focus:border-indigo-500/50 disabled:cursor-default disabled:opacity-70" />
              {phase === 'evaluating' && <div className="mt-4 flex items-center justify-center gap-2 rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-4 text-sm font-bold text-indigo-200"><Loader2 className="h-4 w-4 animate-spin" /> Evaluating relevance, vocabulary, fluency, and grammar…</div>}
            </div>
          </div>
        </section>

        {phase === 'result' && evaluation && (
          <section className={`overflow-hidden rounded-3xl border p-5 shadow-2xl sm:p-8 ${evaluation.is_passed ? 'border-emerald-500/30 bg-emerald-950/15' : 'border-rose-500/25 bg-slate-900/90'}`} aria-live="polite">
            <div className="grid gap-6 lg:grid-cols-[190px_1fr]">
              <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-800 bg-slate-950/70 p-5 text-center"><div className={`flex h-28 w-28 items-center justify-center rounded-full border-8 ${evaluation.is_passed ? 'border-emerald-500/25 text-emerald-300' : 'border-rose-500/25 text-rose-300'}`}><span className="text-3xl font-black">{clampScore(evaluation.score)}%</span></div><span className={`mt-4 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-black ${evaluation.is_passed ? 'bg-emerald-500/10 text-emerald-300' : 'bg-rose-500/10 text-rose-300'}`}>{evaluation.is_passed ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}{evaluation.is_passed ? 'Passed! Great response.' : 'Under 75% — Keep Practicing!'}</span></div>
              <div><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Composite evaluation</p><h2 className="mt-2 text-2xl font-black text-white">{evaluation.is_passed ? 'Volley returned.' : 'Build a stronger return.'}</h2><p className="mt-2 text-sm leading-relaxed text-slate-400">{evaluation.relevance_feedback}</p><div className="mt-6 grid gap-4 sm:grid-cols-3"><ScoreBar label="Relevance" score={evaluation.criteria_scores.relevance} tone="bg-indigo-500" /><ScoreBar label="Vocabulary" score={evaluation.criteria_scores.vocabulary} tone="bg-violet-500" /><ScoreBar label="Fluency" score={evaluation.criteria_scores.fluency} tone="bg-cyan-500" /></div></div>
            </div>

            <div className="mt-6 grid gap-5 lg:grid-cols-2">
              <article className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5 lg:col-span-2"><h3 className="flex items-center gap-2 text-sm font-black text-white"><Sparkles className="h-4 w-4 text-indigo-300" /> What You Said vs. Native Polish</h3><div className="mt-4 grid gap-3 md:grid-cols-2"><div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Your response</p><p className="mt-2 text-sm leading-relaxed text-slate-300">{transcript || 'No response recorded.'}</p></div><div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-4"><p className="text-[10px] font-bold uppercase tracking-wider text-indigo-300">Native polish</p><p className="mt-2 text-sm leading-relaxed text-indigo-100">{evaluation.rephrased_ideal_sentence}</p></div></div></article>
              <article className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5"><h3 className="flex items-center gap-2 text-sm font-black text-white"><WandSparkles className="h-4 w-4 text-violet-300" /> Vocabulary Upgrades</h3><div className="mt-4 space-y-3">{evaluation.vocabulary_upgrades.length > 0 ? evaluation.vocabulary_upgrades.map((upgrade, index) => <div key={`${upgrade.original_word}-${index}`} className="rounded-xl border border-slate-800 bg-slate-900/80 p-3"><div className="flex flex-wrap items-center gap-2 text-xs font-bold"><span className="rounded-lg bg-rose-500/10 px-2 py-1 text-rose-200 line-through">{upgrade.original_word}</span><ArrowRight className="h-3.5 w-3.5 text-slate-600" /><span className="rounded-lg bg-emerald-500/10 px-2 py-1 text-emerald-200">{upgrade.suggested_replacement}</span></div><p className="mt-2 text-xs leading-relaxed text-slate-500">{upgrade.reason}</p></div>) : <p className="rounded-xl bg-slate-900/70 p-3 text-xs text-slate-500">Your vocabulary was already appropriately specific.</p>}</div></article>
              <article className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5"><h3 className="flex items-center gap-2 text-sm font-black text-white"><Clock3 className="h-4 w-4 text-amber-300" /> Grammar & Fillers</h3><div className="mt-4"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Fillers detected</p><div className="mt-2 flex flex-wrap gap-2">{evaluation.filler_words_detected.length > 0 ? evaluation.filler_words_detected.map((filler) => <span key={filler.word} className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-xs font-bold text-amber-200">{filler.word} × {filler.count}</span>) : <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-xs font-bold text-emerald-200">No fillers detected</span>}</div></div><div className="mt-5 space-y-3">{evaluation.grammar_errors.length > 0 ? evaluation.grammar_errors.map((item, index) => <div key={`${item.mistake}-${index}`} className="rounded-xl border border-slate-800 bg-slate-900/80 p-3 text-xs"><p className="text-rose-200"><span className="font-bold">Adjust:</span> {item.mistake}</p><p className="mt-1 text-emerald-200"><span className="font-bold">Use:</span> {item.correction}</p><p className="mt-2 leading-relaxed text-slate-500">{item.explanation}</p></div>) : <p className="rounded-xl bg-slate-900/70 p-3 text-xs text-slate-500">No material grammar adjustments were needed.</p>}</div></article>
            </div>

            {saveState === 'error' && <p className="mt-5 rounded-xl border border-rose-500/20 bg-rose-500/5 p-3 text-center text-xs text-rose-200">The passing score could not be saved. Try the Next Session button again.</p>}
            <div className="mt-6 flex flex-col justify-end gap-3 sm:flex-row"><button type="button" onClick={resetVolley} className={`flex items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-black transition ${evaluation.is_passed ? 'border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700' : 'bg-rose-600 text-white hover:bg-rose-500'}`}><RotateCcw className="h-4 w-4" /> Retry Volley</button>{evaluation.is_passed && <button type="button" onClick={() => void handleNextSession()} disabled={saveState === 'saving'} className="flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-6 py-3 text-sm font-black text-emerald-950 transition hover:bg-emerald-400 disabled:cursor-wait disabled:opacity-70">{saveState === 'saving' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}{saveState === 'saving' ? 'Saving…' : sessionNumber < SESSIONS_PER_LEVEL ? `Next Volley / Session (${sessionNumber + 1} of ${SESSIONS_PER_LEVEL})` : 'Finish Level'}{saveState !== 'saving' && <ArrowRight className="h-4 w-4" />}</button>}</div>
          </section>
        )}

        {phase === 'result' && !evaluation && <section className="rounded-3xl border border-rose-500/25 bg-slate-900 p-6 text-center"><AlertTriangle className="mx-auto h-8 w-8 text-rose-300" /><h2 className="mt-3 text-lg font-black text-white">Evaluation unavailable</h2><p className="mt-1 text-sm text-slate-400">{errorMessage || 'Please retry this volley.'}</p><button type="button" onClick={resetVolley} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-rose-600 px-6 py-3 text-sm font-black text-white hover:bg-rose-500"><RotateCcw className="h-4 w-4" /> Retry Volley</button></section>}
      </main>
    </div>
  )
}
