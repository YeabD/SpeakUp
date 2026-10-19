'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  Eye,
  EyeOff,
  Lightbulb,
  Loader2,
  Mic,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Square,
} from 'lucide-react'
import { createClient } from '@/src/lib/supabase/client'

const ROUND_SECONDS = 30
const SESSIONS_PER_LEVEL = 15

type Target = {
  target: string
  category: string
  forbidden: [string, string, string]
  nativeClue: string
  stems?: string[]
}

type Guess = { guess: string; confidence: number; correct: boolean }
type RoundResult =
  | { status: 'solved'; score: number; elapsedSeconds: number }
  | { status: 'timeout'; score: number }
  | { status: 'disqualified'; score: number; reason: string }
type RoundPhase = 'idle' | 'active' | 'solved' | 'timeout' | 'disqualified'

interface RecognitionEventLike {
  results: ArrayLike<{ 0?: { transcript: string } }>
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

const CIRCUM_CURRICULUM: Record<number, Target[]> = {
  1: [
    {
      target: 'Bicycle',
      category: 'Everyday Transport & Objects',
      forbidden: ['Wheels', 'Ride', 'Pedal'],
      stems: ["It is a vehicle that people power themselves...", 'You often see one on a cycle path...'],
      nativeClue: 'Native speakers often describe its shape, how it is powered, and where it is used before naming it.',
    },
    {
      target: 'Camera',
      category: 'Everyday Technology',
      forbidden: ['Photos', 'Lens', 'Picture'],
      stems: ['It is a device people point at a scene...', 'You might bring one on holiday to...'],
      nativeClue: 'A natural explanation focuses on capturing moments, pointing the device, and saving what you see.',
    },
    {
      target: 'Clock',
      category: 'Home & Office Objects',
      forbidden: ['Time', 'Watch', 'Hours'],
      stems: ['It is something you glance at during the day...', 'You may hear this object ticking...'],
      nativeClue: 'Native speakers may describe its face, hands, ticking sound, or position on a wall.',
    },
    {
      target: 'Umbrella',
      category: 'Weather Gear',
      forbidden: ['Rain', 'Water', 'Wet'],
      stems: ['It is a portable canopy that opens above you...', 'People carry this when the forecast is poor...'],
      nativeClue: 'A fluent workaround describes opening a portable canopy and holding it above your head in bad weather.',
    },
  ],
  2: [
    { target: 'Plumber', category: 'Professions & Trades', forbidden: ['Water', 'Pipes', 'Fix'], nativeClue: 'Native speakers describe the household problems this tradesperson solves and the tools they bring.' },
    { target: 'Chef', category: 'Professions & Trades', forbidden: ['Food', 'Kitchen', 'Cook'], nativeClue: 'A natural clue focuses on a restaurant professional who creates menus and leads a culinary team.' },
    { target: 'Architect', category: 'Professions & Trades', forbidden: ['Buildings', 'Design', 'Draw'], nativeClue: 'Native speakers might explain that this professional plans spaces before construction begins.' },
    { target: 'Librarian', category: 'Professions & Trades', forbidden: ['Books', 'Library', 'Read'], nativeClue: 'A good circumlocution describes helping visitors find information and organising items for borrowing.' },
  ],
  3: [
    { target: 'Procrastination', category: 'Abstract Ideas & Habits', forbidden: ['Wait', 'Late', 'Lazy'], nativeClue: 'Native speakers describe the habit through its consequence: putting off an important task despite knowing better.' },
    { target: 'Nostalgia', category: 'Abstract Ideas & Emotions', forbidden: ['Past', 'Memory', 'Old'], nativeClue: 'A fluent explanation describes the warm, sometimes bittersweet feeling triggered by an earlier part of life.' },
    { target: 'Ambition', category: 'Abstract Ideas & Motivation', forbidden: ['Goal', 'Future', 'Success'], nativeClue: 'Native speakers frame it as a strong inner drive to achieve something difficult or important.' },
    { target: 'Irony', category: 'Language & Situations', forbidden: ['Opposite', 'Sarcasm', 'Funny'], nativeClue: 'A natural explanation contrasts what is expected with what actually happens or what is literally said.' },
  ],
}

function pickRandomTarget(level: number, previousTarget?: string) {
  const levelList = CIRCUM_CURRICULUM[level] ?? CIRCUM_CURRICULUM[1]
  const alternatives = levelList.filter((item) => item.target !== previousTarget)
  const pool = alternatives.length > 0 ? alternatives : levelList
  return pool[Math.floor(Math.random() * pool.length)]
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function containsWholePhrase(transcript: string, phrase: string) {
  return new RegExp(`\\b${escapeRegExp(phrase)}\\b`, 'i').test(transcript)
}

function getHints(target: Target) {
  return [
    `Think about where someone encounters this within “${target.category}”.`,
    'Start with: “It is the kind of thing, person, or idea that...”',
    'Describe its purpose before describing its appearance.',
    'Explain who normally uses it—or who is affected by it.',
    'Mention a typical place or situation where it appears.',
    'Compare it with something similar, then explain the difference.',
    'Describe its shape, sound, movement, or feeling if one applies.',
    'Try: “You would need this when...”',
    'Explain the problem it solves without naming the problem directly.',
    'Give a tiny real-life scenario in one sentence.',
    'Use a relative clause: “It is something that...” or “Someone who...”',
    target.stems?.[0] ?? 'If you get stuck, move from category → context → function → example.',
  ]
}

export default function CircumlocutionSprint() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [currentLevel, setCurrentLevel] = useState(1)
  const [sessionNumber, setSessionNumber] = useState(1)
  const [currentTarget, setCurrentTarget] = useState<Target | null>(null)
  const [timeLeft, setTimeLeft] = useState(ROUND_SECONDS)
  const [phase, setPhase] = useState<RoundPhase>('idle')
  const [isRecording, setIsRecording] = useState(false)
  const [speechUnavailable, setSpeechUnavailable] = useState(false)
  const [liveTranscript, setLiveTranscript] = useState('')
  const [strikes, setStrikes] = useState<string[]>([])
  const [violatedForbiddenWord, setViolatedForbiddenWord] = useState<string | null>(null)
  const [aiGuesses, setAiGuesses] = useState<Guess[]>([])
  const [aiThinking, setAiThinking] = useState(false)
  const [roundResult, setRoundResult] = useState<RoundResult | null>(null)
  const [hintsOpen, setHintsOpen] = useState(false)
  const [answerRevealed, setAnswerRevealed] = useState(false)
  const [completionState, setCompletionState] = useState<'idle' | 'saving' | 'error'>('idle')

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const guessDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const guessAbortRef = useRef<AbortController | null>(null)
  const violationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const deadlineRef = useRef(0)
  const startedAtRef = useRef(0)
  const phaseRef = useRef<RoundPhase>('idle')
  const roundTokenRef = useRef(0)
  const completionInFlightRef = useRef(false)
  const transcriptRef = useRef('')
  const strikesRef = useRef<string[]>([])

  const stopRecording = useCallback((abort = false) => {
    const recognition = recognitionRef.current
    recognitionRef.current = null
    if (recognition) {
      recognition.onresult = null
      recognition.onend = null
      recognition.onerror = null
      try {
        if (abort) recognition.abort()
        else recognition.stop()
      } catch {
        // The browser may already have ended the recognition session.
      }
    }
    setIsRecording(false)
  }, [])

  const cancelPendingGuess = useCallback(() => {
    if (guessDebounceRef.current) clearTimeout(guessDebounceRef.current)
    guessDebounceRef.current = null
    guessAbortRef.current?.abort()
    guessAbortRef.current = null
    setAiThinking(false)
  }, [])

  const freezeRound = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = null
    cancelPendingGuess()
    stopRecording(true)
  }, [cancelPendingGuess, stopRecording])

  const finishWithSolved = useCallback(() => {
    if (phaseRef.current !== 'active') return
    phaseRef.current = 'solved'
    freezeRound()
    const elapsedSeconds = Math.min(ROUND_SECONDS, Math.max(1, Math.ceil((Date.now() - startedAtRef.current) / 1000)))
    const remaining = Math.max(0, ROUND_SECONDS - elapsedSeconds)
    setTimeLeft(remaining)
    setPhase('solved')
    setRoundResult({ status: 'solved', elapsedSeconds, score: Math.max(75, Math.min(98, 75 + Math.round((remaining / ROUND_SECONDS) * 23) - strikesRef.current.length * 5)) })
  }, [freezeRound])

  const finishWithTimeout = useCallback(() => {
    if (phaseRef.current !== 'active') return
    phaseRef.current = 'timeout'
    freezeRound()
    setTimeLeft(0)
    setPhase('timeout')
    setRoundResult({ status: 'timeout', score: 0 })
  }, [freezeRound])

  const finishWithDisqualification = useCallback((reason: string) => {
    if (phaseRef.current !== 'active') return
    phaseRef.current = 'disqualified'
    freezeRound()
    setPhase('disqualified')
    setRoundResult({ status: 'disqualified', score: 0, reason })
  }, [freezeRound])

  const resetRound = useCallback((target: Target) => {
    roundTokenRef.current += 1
    phaseRef.current = 'idle'
    freezeRound()
    if (violationTimeoutRef.current) clearTimeout(violationTimeoutRef.current)
    violationTimeoutRef.current = null
    transcriptRef.current = ''
    strikesRef.current = []
    setCurrentTarget(target)
    setTimeLeft(ROUND_SECONDS)
    setPhase('idle')
    setLiveTranscript('')
    setStrikes([])
    setViolatedForbiddenWord(null)
    setAiGuesses([])
    setRoundResult(null)
    setHintsOpen(false)
    setAnswerRevealed(false)
    setCompletionState('idle')
    completionInFlightRef.current = false
  }, [freezeRound])

  useEffect(() => {
    let active = true
    async function loadInitialData() {
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (!active) return
      if (userError || !user) {
        router.push('/signup')
        return
      }
      const { data: progressData } = await supabase
        .from('module_progress')
        .select('current_level, completed_sessions_in_level')
        .eq('user_id', user.id)
        .eq('module_id', 'circumlocution')
        .single()
      if (!active) return
      const level = Math.min(3, Math.max(1, progressData?.current_level ?? 1))
      const session = Math.min(SESSIONS_PER_LEVEL, (progressData?.completed_sessions_in_level ?? 0) + 1)
      setCurrentLevel(level)
      setSessionNumber(session)
      setCurrentTarget(pickRandomTarget(level))
      setLoading(false)
    }
    void loadInitialData()
    return () => {
      active = false
      roundTokenRef.current += 1
      if (timerRef.current) clearInterval(timerRef.current)
      if (violationTimeoutRef.current) clearTimeout(violationTimeoutRef.current)
      if (guessDebounceRef.current) clearTimeout(guessDebounceRef.current)
      guessAbortRef.current?.abort()
      guessAbortRef.current = null
      const recognition = recognitionRef.current
      recognitionRef.current = null
      if (recognition) {
        recognition.onresult = null
        recognition.onend = null
        recognition.onerror = null
        try { recognition.abort() } catch {}
      }
    }
  }, [router, supabase])

  useEffect(() => {
    if (phase !== 'active') return
    const updateTimer = () => {
      const remainingMs = deadlineRef.current - Date.now()
      if (remainingMs <= 0) {
        finishWithTimeout()
        return
      }
      setTimeLeft(Math.ceil(remainingMs / 1000))
    }
    updateTimer()
    timerRef.current = setInterval(updateTimer, 200)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [finishWithTimeout, phase])

  const requestAiGuess = useCallback((transcript: string) => {
    if (!currentTarget || phaseRef.current !== 'active') return
    const requestToken = roundTokenRef.current
    const targetAtRequest = currentTarget
    const controller = new AbortController()
    guessAbortRef.current?.abort()
    guessAbortRef.current = controller
    setAiThinking(true)
    void fetch('/api/circumlocution/guess', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({ target_word: targetAtRequest.target, forbidden_words: targetAtRequest.forbidden, spoken_transcript: transcript }),
    })
      .then(async (response) => {
        const data = await response.json()
        if (!response.ok) throw new Error(data.error ?? 'The AI guesser could not respond.')
        if (requestToken !== roundTokenRef.current || phaseRef.current !== 'active') return
        if (data.target_spoken) {
          finishWithDisqualification('You said the secret answer aloud. Describe it without naming it.')
          return
        }
        const guess: Guess = { guess: String(data.ai_guess ?? 'Still listening…'), confidence: Number(data.confidence ?? 0), correct: Boolean(data.guessed_correctly) }
        setAiGuesses((previous) => [guess, ...previous].slice(0, 4))
        if (guess.correct) finishWithSolved()
      })
      .catch((error: unknown) => {
        if (error instanceof Error && error.name !== 'AbortError') console.error('AI guess error:', error)
      })
      .finally(() => {
        if (guessAbortRef.current === controller) {
          guessAbortRef.current = null
          setAiThinking(false)
        }
      })
  }, [currentTarget, finishWithDisqualification, finishWithSolved])

  const processTranscript = useCallback((transcript: string) => {
    if (!transcript || !currentTarget || phaseRef.current !== 'active') return
    if (containsWholePhrase(transcript, currentTarget.target)) {
      finishWithDisqualification('You said the secret answer aloud. Describe it without naming it.')
      return
    }
    const newViolations = currentTarget.forbidden.filter((word) => containsWholePhrase(transcript, word) && !strikesRef.current.includes(word))
    if (newViolations.length > 0) {
      const nextStrikes = [...strikesRef.current, ...newViolations]
      strikesRef.current = nextStrikes
      setStrikes(nextStrikes)
      setViolatedForbiddenWord(newViolations.at(-1) ?? null)
      if (violationTimeoutRef.current) clearTimeout(violationTimeoutRef.current)
      violationTimeoutRef.current = setTimeout(() => setViolatedForbiddenWord(null), 1800)
      if (nextStrikes.length >= 2) {
        finishWithDisqualification(`Two taboo words were used. The latest was “${newViolations.at(-1)}”.`)
        return
      }
    }
    if (guessDebounceRef.current) clearTimeout(guessDebounceRef.current)
    guessDebounceRef.current = setTimeout(() => requestAiGuess(transcript), 700)
  }, [currentTarget, finishWithDisqualification, requestAiGuess])

  const startListening = useCallback(() => {
    if (phaseRef.current !== 'idle' && phaseRef.current !== 'active') return
    if (phaseRef.current === 'idle') {
      const now = Date.now()
      startedAtRef.current = now
      deadlineRef.current = now + ROUND_SECONDS * 1000
      phaseRef.current = 'active'
      setPhase('active')
      setTimeLeft(ROUND_SECONDS)
    }
    const speechWindow = window as typeof window & { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor }
    const Recognition = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition
    if (!Recognition) {
      setSpeechUnavailable(true)
      setIsRecording(false)
      return
    }
    setSpeechUnavailable(false)
    try {
      const recognition = new Recognition()
      const roundToken = roundTokenRef.current
      const transcriptBeforeRestart = transcriptRef.current
      recognitionRef.current = recognition
      recognition.continuous = true
      recognition.interimResults = true
      recognition.lang = 'en-US'
      recognition.onresult = (event) => {
        if (recognitionRef.current !== recognition || roundTokenRef.current !== roundToken || phaseRef.current !== 'active') return
        let transcript = ''
        for (let index = 0; index < event.results.length; index += 1) transcript += `${event.results[index][0]?.transcript ?? ''} `
        const nextTranscript = [transcriptBeforeRestart, transcript.trim()].filter(Boolean).join(' ')
        transcriptRef.current = nextTranscript
        setLiveTranscript(nextTranscript)
        processTranscript(nextTranscript)
      }
      recognition.onend = () => {
        if (recognitionRef.current !== recognition || roundTokenRef.current !== roundToken) return
        recognitionRef.current = null
        setIsRecording(false)
      }
      recognition.onerror = () => {
        if (recognitionRef.current !== recognition || roundTokenRef.current !== roundToken) return
        recognitionRef.current = null
        setIsRecording(false)
        setSpeechUnavailable(true)
      }
      recognition.start()
      setIsRecording(true)
    } catch (error) {
      console.warn('Speech recognition failed to start:', error)
      recognitionRef.current = null
      setIsRecording(false)
      setSpeechUnavailable(true)
    }
  }, [processTranscript])

  const handleRetry = () => currentTarget && resetRound(currentTarget)
  const handleSkip = () => currentTarget && resetRound(pickRandomTarget(currentLevel, currentTarget.target))

  const handleNextSession = async () => {
    if (roundResult?.status !== 'solved' || completionInFlightRef.current) return
    completionInFlightRef.current = true
    setCompletionState('saving')
    try {
      const response = await fetch('/api/sessions/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ module_type: 'circumlocution', level_number: currentLevel, session_number: sessionNumber, accuracy_score: roundResult.score }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? 'Could not save this session.')
      if (sessionNumber < SESSIONS_PER_LEVEL) {
        setSessionNumber((session) => session + 1)
        resetRound(pickRandomTarget(currentLevel, currentTarget?.target))
      } else if (currentLevel < 3) {
        const nextLevel = currentLevel + 1
        setCurrentLevel(nextLevel)
        setSessionNumber(1)
        resetRound(pickRandomTarget(nextLevel))
      } else {
        router.push('/dashboard')
      }
    } catch (error) {
      console.error('Error recording session completion:', error)
      completionInFlightRef.current = false
      setCompletionState('error')
    }
  }

  if (loading || !currentTarget) {
    return <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-400"><div className="flex items-center gap-3"><Loader2 className="h-5 w-5 animate-spin text-violet-400" /><span className="text-sm font-semibold">Preparing your next challenge…</span></div></div>
  }

  const hints = getHints(currentTarget)
  const timerPercentage = (timeLeft / ROUND_SECONDS) * 100
  const isRoundOver = phase === 'solved' || phase === 'timeout' || phase === 'disqualified'
  const nextButtonLabel = sessionNumber < SESSIONS_PER_LEVEL ? `Next Session (Session ${sessionNumber + 1} of ${SESSIONS_PER_LEVEL})` : currentLevel < 3 ? `Complete Level ${currentLevel} & Continue` : 'Finish Sprint'

  return (
    <div className="min-h-screen bg-slate-950 font-sans text-slate-50">
      <header className="sticky top-0 z-50 border-b border-slate-800/80 bg-slate-950/90 px-4 py-3 backdrop-blur-xl sm:px-6 lg:px-10">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <button type="button" onClick={() => { if (phase !== 'active' || window.confirm('Leave this active round? Your attempt will not be saved.')) { stopRecording(true); router.push('/dashboard') } }} className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900 px-3.5 py-2 text-xs font-semibold text-slate-400 transition hover:border-slate-700 hover:text-white">
            <ArrowLeft className="h-4 w-4" /><span className="hidden sm:inline">Dashboard</span>
          </button>
          <div className="min-w-0 text-center"><p className="truncate text-sm font-bold text-white sm:text-base">Circumlocution Sprint</p><p className="text-[11px] text-slate-500">Level {currentLevel} · 30-second challenge</p></div>
          <div className="min-w-[92px] text-right">
            <p className="text-xs font-bold text-slate-200">Session {sessionNumber} of {SESSIONS_PER_LEVEL}</p>
            <div className="mt-1.5 flex justify-end gap-1" aria-hidden="true">
              {Array.from({ length: SESSIONS_PER_LEVEL }, (_, index) => index + 1).map((session) => <span key={session} className={`h-1.5 rounded-full transition-all ${session < sessionNumber ? 'w-2 bg-emerald-500' : session === sessionNumber ? 'w-4 bg-violet-500' : 'w-1.5 bg-slate-800'}`} />)}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6 sm:px-6 sm:py-9">
        <section className="relative overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/80 p-5 shadow-2xl shadow-black/20 backdrop-blur-xl sm:p-8">
          <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-violet-500/10 blur-3xl" />
          <div className="relative flex flex-col items-center gap-3 text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-500/25 bg-violet-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-violet-300">Category: {currentTarget.category}</span>
            <span className="inline-flex items-center gap-2 rounded-full border border-slate-700/70 bg-slate-950/55 px-3 py-1.5 text-xs text-slate-400"><ShieldCheck className="h-3.5 w-3.5 text-amber-300" />Taboo Challenge: Describe the concept to the AI</span>
          </div>

          <div className="relative mx-auto mt-6 max-w-xl rounded-2xl border border-slate-700/60 bg-slate-950/65 p-4 text-center shadow-inner shadow-black/20">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">Private prompt · for the describer</p>
            <p className="mt-2 text-2xl font-black tracking-wide text-slate-100 sm:text-3xl">{currentTarget.target}</p>
            <p className="mt-1 text-xs text-slate-500">Describe it without saying the answer or any words below.</p>
          </div>

          <div className="relative mt-6">
            <div className="mb-3 flex items-center justify-between gap-3"><p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.15em] text-slate-400"><AlertTriangle className="h-4 w-4 text-amber-300" /> Taboo words</p><span className="text-[11px] text-slate-500">2 strikes end the attempt</span></div>
            <div className="grid grid-cols-3 gap-2 sm:gap-4">
              {currentTarget.forbidden.map((word, index) => {
                const isViolated = strikes.includes(word)
                return <div key={`${currentTarget.target}-${word}`} style={{ animationDelay: `${index * 150}ms` }} className={`circumlocution-word-in rounded-xl border px-2 py-3 text-center transition duration-300 sm:px-4 sm:py-4 ${isViolated ? 'border-rose-500/30 bg-slate-900 text-rose-200 shadow-lg shadow-rose-950/20' : 'border-slate-700/60 bg-slate-900/80 text-slate-200'} ${violatedForbiddenWord === word ? 'circumlocution-infraction' : ''}`}><p className="truncate text-xs font-bold sm:text-sm">{word}</p><p className={`mt-1 text-[9px] font-semibold uppercase tracking-wider ${isViolated ? 'text-rose-400' : 'text-slate-600'}`}>{isViolated ? 'Strike' : 'Avoid'}</p></div>
              })}
            </div>
          </div>

          <div className="relative mt-6 rounded-2xl border border-slate-800 bg-slate-950/70 p-4 sm:p-5">
            <button type="button" onClick={() => setHintsOpen((open) => !open)} aria-expanded={hintsOpen} aria-controls="circumlocution-hints" className="group mx-auto flex flex-col items-center gap-1.5 text-center">
              <Lightbulb className={`h-6 w-6 text-amber-300 ${hintsOpen ? '' : 'circumlocution-lamp-wiggle'}`} />
              <span className="flex items-center gap-1.5 text-sm font-bold text-slate-200 transition group-hover:text-amber-200">{hintsOpen ? 'Hide Hints' : 'Need a Hint?'}<ChevronDown className={`h-4 w-4 transition-transform duration-300 ${hintsOpen ? 'rotate-180' : ''}`} /></span>
              {!hintsOpen && <span className="text-[11px] text-slate-500">Optional conversation starters</span>}
            </button>
            {hintsOpen && <div id="circumlocution-hints" className="circumlocution-drawer-in mt-4 border-t border-slate-800 pt-4"><div className="grid gap-2 sm:grid-cols-2">{hints.map((hint, index) => <div key={hint} className="flex gap-2.5 rounded-xl border border-slate-800 bg-slate-900/70 p-3 text-xs leading-relaxed text-slate-300"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-400/10 text-[10px] font-bold text-amber-300">{index + 1}</span><span>{hint}</span></div>)}</div></div>}
          </div>

          <div className="relative mt-6 flex flex-col items-center justify-between gap-5 rounded-2xl border border-slate-800 bg-slate-950 p-5 sm:flex-row">
            <div className="flex items-center gap-4">
              <div className="relative flex h-20 w-20 items-center justify-center" role="timer" aria-label={`${timeLeft} seconds remaining`}>
                <svg className="h-full w-full -rotate-90" viewBox="0 0 36 36" aria-hidden="true"><path className="text-slate-800" strokeWidth="3" stroke="currentColor" fill="none" d="M18 2.0845a15.9155 15.9155 0 1 1 0 31.831 15.9155 15.9155 0 1 1 0-31.831" /><path className={`transition-all duration-300 ${timeLeft <= 7 ? 'text-rose-400' : timeLeft <= 15 ? 'text-amber-400' : 'text-violet-400'}`} strokeDasharray={`${timerPercentage}, 100`} strokeWidth="3" strokeLinecap="round" stroke="currentColor" fill="none" d="M18 2.0845a15.9155 15.9155 0 1 1 0 31.831 15.9155 15.9155 0 1 1 0-31.831" /></svg>
                <span className={`absolute text-base font-black ${timeLeft <= 7 ? 'text-rose-300' : 'text-white'}`}>{timeLeft}s</span>
              </div>
              <div><p className="text-sm font-bold text-slate-200">30-second round</p><p className="mt-1 text-xs text-slate-500">{phase === 'idle' ? 'Starts when you tap the microphone' : phase === 'active' ? `${strikes.length}/2 taboo strikes` : 'Timer frozen'}</p></div>
            </div>
            {!isRoundOver && <div className="w-full sm:w-auto">{!isRecording ? <button type="button" onClick={startListening} className="flex w-full items-center justify-center gap-2.5 rounded-2xl bg-violet-600 px-7 py-4 text-sm font-bold text-white shadow-lg shadow-violet-950/50 transition hover:bg-violet-500 active:scale-[0.98] sm:w-auto"><Mic className="h-5 w-5" />{phase === 'active' ? 'Resume Microphone' : 'Start Speaking'}</button> : <button type="button" onClick={() => stopRecording(false)} className="flex w-full items-center justify-center gap-2.5 rounded-2xl border border-slate-700 bg-slate-800 px-7 py-4 text-sm font-bold text-slate-100 transition hover:bg-slate-700 sm:w-auto"><Square className="h-4 w-4 fill-current" /> Stop Microphone</button>}</div>}
          </div>
        </section>

        <section className="grid gap-5 md:grid-cols-2">
          <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-5">
            <div className="mb-3 flex items-center justify-between text-[11px] font-bold uppercase tracking-[0.15em] text-slate-400"><span>Your clues</span><span className={isRecording ? 'text-emerald-400' : 'text-slate-600'}>{isRecording ? '● Listening' : phase === 'active' ? 'Mic paused' : 'Idle'}</span></div>
            {speechUnavailable && phase === 'active' && <p className="mb-3 rounded-xl border border-amber-500/20 bg-amber-400/5 p-3 text-xs text-amber-200">Speech recognition is unavailable in this browser. Type your clue below; the same timer and AI guesser remain active.</p>}
            <textarea value={liveTranscript} onChange={(event) => { const transcript = event.target.value; transcriptRef.current = transcript; setLiveTranscript(transcript); processTranscript(transcript) }} disabled={phase !== 'active'} aria-label="Your clue transcript" placeholder={phase === 'idle' ? 'Start the round to stream your clues…' : 'Your spoken words will appear here…'} className="h-32 w-full resize-none rounded-2xl border border-slate-800 bg-slate-950 p-4 font-mono text-sm leading-relaxed text-slate-300 outline-none transition placeholder:text-slate-700 focus:border-violet-500/40 disabled:cursor-default" />
          </div>
          <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-5">
            <div className="mb-3 flex items-center justify-between text-[11px] font-bold uppercase tracking-[0.15em] text-slate-400"><span>AI guesser</span>{aiThinking && <Loader2 className="h-4 w-4 animate-spin text-violet-400" />}</div>
            <div className="h-32 overflow-y-auto rounded-2xl border border-slate-800 bg-slate-950 p-3">{aiGuesses.length === 0 ? <div className="flex h-full items-center justify-center text-center text-sm italic text-slate-600">The AI is waiting for a useful clue…</div> : <div className="space-y-2">{aiGuesses.map((guess, index) => <div key={`${guess.guess}-${index}`} className={`flex items-center justify-between gap-3 rounded-xl border p-2.5 text-xs ${guess.correct ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-slate-800 bg-slate-900'}`}><span className="truncate font-semibold text-violet-200">“{guess.guess}”</span><span className={guess.correct ? 'font-bold text-emerald-400' : 'text-slate-500'}>{Math.round(guess.confidence * 100)}%</span></div>)}</div>}</div>
          </div>
        </section>

        {roundResult?.status === 'solved' && <section className="circumlocution-result-in overflow-hidden rounded-3xl border border-emerald-500/30 bg-emerald-950/20 p-6 shadow-2xl shadow-emerald-950/20 sm:p-8" aria-live="assertive">
          <div className="flex flex-col items-center gap-6 text-center sm:flex-row sm:text-left">
            <div className="circumlocution-success-pop flex h-20 w-20 shrink-0 items-center justify-center rounded-full border border-emerald-400/30 bg-emerald-400/10 shadow-lg shadow-emerald-950/40"><CheckCircle2 className="h-10 w-10 text-emerald-300" /></div>
            <div className="flex-1"><span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-emerald-300"><Sparkles className="h-3.5 w-3.5" /> Round complete</span><h2 className="mt-3 text-2xl font-black text-white">🎉 Target Solved!</h2><p className="mt-1 text-sm text-emerald-100/80">Correctly guessed in {roundResult.elapsedSeconds}s · Score {roundResult.score}%</p></div>
            <button type="button" onClick={() => void handleNextSession()} disabled={completionState === 'saving'} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-6 py-4 text-sm font-black text-emerald-950 shadow-lg shadow-emerald-950/30 transition hover:bg-emerald-400 disabled:cursor-wait disabled:opacity-70 sm:w-auto">{completionState === 'saving' ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />}{completionState === 'saving' ? 'Saving session…' : nextButtonLabel}{completionState !== 'saving' && <ArrowRight className="h-4 w-4" />}</button>
          </div>
          {completionState === 'error' && <p className="mt-4 rounded-xl border border-rose-500/20 bg-rose-500/5 p-3 text-center text-xs text-rose-200">We could not save the session. Your result is still here—tap the button to try again.</p>}
        </section>}

        {(roundResult?.status === 'timeout' || roundResult?.status === 'disqualified') && <section className="circumlocution-result-in rounded-3xl border border-amber-500/25 bg-slate-900/90 p-6 sm:p-8" aria-live="assertive">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-amber-500/20 bg-amber-400/10"><AlertTriangle className="h-7 w-7 text-amber-300" /></div>
            <div className="flex-1">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-amber-300">Attempt ended</p>
              <h2 className="mt-2 text-xl font-black text-white">{roundResult.status === 'timeout' ? 'Time’s up — keep the momentum.' : 'Taboo challenge stopped.'}</h2>
              <p className="mt-2 text-sm text-slate-400">{roundResult.status === 'timeout' ? 'The AI did not reach the target within 30 seconds.' : roundResult.reason}</p>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <button type="button" onClick={() => setAnswerRevealed((revealed) => !revealed)} className="flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-xs font-bold text-slate-200 transition hover:bg-slate-700">{answerRevealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}{answerRevealed ? 'Hide Secret Answer' : 'Show Secret Answer'}</button>
                <button type="button" onClick={handleRetry} className="flex items-center justify-center gap-2 rounded-xl border border-violet-500/25 bg-violet-500/10 px-4 py-3 text-xs font-bold text-violet-200 transition hover:bg-violet-500/20"><RotateCcw className="h-4 w-4" /> Retry Session</button>
                <button type="button" onClick={handleSkip} className="flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-3 text-xs font-bold text-white transition hover:bg-violet-500"><RefreshCw className="h-4 w-4" /> Skip / Change Question</button>
              </div>
              {answerRevealed && <div className="circumlocution-drawer-in mt-4 rounded-2xl border border-slate-700 bg-slate-950 p-4"><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Secret answer</p><p className="mt-1 text-lg font-black text-white">{currentTarget.target}</p><p className="mt-2 text-sm leading-relaxed text-slate-400">{currentTarget.nativeClue}</p></div>}
            </div>
          </div>
        </section>}
      </main>
    </div>
  )
}
