'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/src/lib/supabase/client'
import {
  Mic,
  ArrowLeft,
  Loader2,
  Award,
  Zap,
  ShieldCheck,
  AlertOctagon,
  Sparkles,
  RotateCcw,
  ArrowRight,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Volume2,
} from 'lucide-react'

// Curriculum database for Circumlocution Sprint targets across 3 levels
const CIRCUM_CURRICULUM: Record<number, Array<{ target: string; category: string; forbidden: string[]; stems?: string[] }>> = {
  1: [
    { target: 'Bicycle', category: 'Everyday Transport & Objects', forbidden: ['Wheels', 'Ride', 'Pedal'], stems: ["It's a two-wheeled vehicle that...", "People use this for exercise when..."] },
    { target: 'Camera', category: 'Everyday Technology', forbidden: ['Photos', 'Lens', 'Picture'], stems: ["An electronic device used to capture...", "You point this object at scenery to..."] },
    { target: 'Clock', category: 'Home & Office Objects', forbidden: ['Time', 'Watch', 'Hours'], stems: ["A circular device hanging on a wall with...", "It ticks steadily to show you..."] },
    { target: 'Umbrella', category: 'Weather Gear', forbidden: ['Rain', 'Water', 'Wet'], stems: ["A handheld canopy opened above your head when...", "You carry this during a storm to..."] },
  ],
  2: [
    { target: 'Plumber', category: 'Trades & Professional Services', forbidden: ['Water', 'Pipes', 'Fix'] },
    { target: 'Chef', category: 'Culinary Arts & Hospitality', forbidden: ['Food', 'Kitchen', 'Cook'] },
    { target: 'Architect', category: 'Construction & Engineering', forbidden: ['Buildings', 'Design', 'Draw'] },
    { target: 'Librarian', category: 'Education & Public Services', forbidden: ['Books', 'Library', 'Read'] },
  ],
  3: [
    { target: 'Procrastination', category: 'Abstract Psychology & Habits', forbidden: ['Wait', 'Late', 'Lazy'] },
    { target: 'Nostalgia', category: 'Complex Emotions & Sentiments', forbidden: ['Past', 'Memory', 'Old'] },
    { target: 'Ambition', category: 'Drive & Personal Motivation', forbidden: ['Goal', 'Future', 'Success'] },
    { target: 'Irony', category: 'Linguistic & Situational Concepts', forbidden: ['Opposite', 'Sarcasm', 'Funny'] },
  ],
}

export default function CircumlocutionPracticePage() {
  const [loading, setLoading] = useState(true)
  const [currentLevel, setCurrentLevel] = useState(1)
  const [sessionNumber, setSessionNumber] = useState(1)

  // Game state
  const [currentTarget, setCurrentTarget] = useState<any>(null)
  const [timeLeft, setTimeLeft] = useState(60)
  const [isRecording, setIsRecording] = useState(false)
  const [liveTranscript, setLiveTranscript] = useState('')
  const [strikes, setStrikes] = useState<string[]>([])
  const [violatedForbiddenWord, setViolatedForbiddenWord] = useState<string | null>(null)

  // AI Guesser Stream state
  const [aiGuesses, setAiGuesses] = useState<Array<{ guess: string; confidence: number; correct: boolean }>>([])
  const [aiThinking, setAiThinking] = useState(false)

  // Verdict state
  const [roundResult, setRoundResult] = useState<{
    status: 'win' | 'timeout' | 'disqualified'
    score: number
    message: string
  } | null>(null)

  const router = useRouter()
  const supabase = createClient()
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const recognitionRef = useRef<any>(null)
  const guessDebounceRef = useRef<NodeJS.Timeout | null>(null)

  async function loadInitialData() {
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      router.push('/signup')
      return
    }

    const { data: progressData } = await supabase
      .from('module_progress')
      .select('*')
      .eq('user_id', user.id)
      .eq('module_id', 'circumlocution')
      .single()

    const level = progressData?.current_level || 1
    const completedSessions = progressData?.completed_sessions_in_level || 0
    const session = completedSessions + 1

    setCurrentLevel(level)
    const activeSession = session > 15 ? 15 : session
    setSessionNumber(activeSession)

    loadRandomTarget(level)
    setLoading(false)
  }

  function loadRandomTarget(level: number) {
    const levelList = CIRCUM_CURRICULUM[level] || CIRCUM_CURRICULUM[1]
    const randomItem = levelList[Math.floor(Math.random() * levelList.length)]
    setCurrentTarget(randomItem)

    const timerDuration = level === 1 ? 60 : level === 2 ? 45 : 30
    setTimeLeft(timerDuration)
    setLiveTranscript('')
    setStrikes([])
    setViolatedForbiddenWord(null)
    setAiGuesses([])
    setRoundResult(null)
    setIsRecording(false)
  }

  useEffect(() => {
    loadInitialData()
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      if (recognitionRef.current) {
        try { recognitionRef.current.stop() } catch {}
      }
    }
  }, [router, supabase])

  // Timer countdown effect
  useEffect(() => {
    if (isRecording && timeLeft > 0 && !roundResult) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            if (timerRef.current) clearInterval(timerRef.current)
            handleRoundTimeout()
            return 0
          }
          return prev - 1
        })
      }, 1000)
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [isRecording, timeLeft, roundResult])

  // Check transcription against forbidden words in real-time
  useEffect(() => {
    if (!liveTranscript || !currentTarget || roundResult) return

    const lowerTranscript = liveTranscript.toLowerCase()
    currentTarget.forbidden.forEach((forbidden: string) => {
      const lowerForbidden = forbidden.toLowerCase()
      // Check word boundary match
      const regex = new RegExp(`\\b${lowerForbidden}\\b`, 'i')
      if (regex.test(lowerTranscript) && !strikes.includes(forbidden)) {
        // Forbidden word violation triggered!
        const newStrikes = [...strikes, forbidden]
        setStrikes(newStrikes)
        setViolatedForbiddenWord(forbidden)

        setTimeout(() => setViolatedForbiddenWord(null), 2500)

        if (newStrikes.length >= 2) {
          handleDisqualification(forbidden)
        }
      }
    })

    // Debounced call to AI guesser API
    if (guessDebounceRef.current) clearTimeout(guessDebounceRef.current)
    guessDebounceRef.current = setTimeout(() => {
      fetchAiGuess(liveTranscript)
    }, 800)

  }, [liveTranscript])

  const fetchAiGuess = async (transcript: string) => {
    if (!currentTarget || roundResult) return
    setAiThinking(true)
    try {
      const res = await fetch('/api/circumlocution/guess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_word: currentTarget.target,
          forbidden_words: currentTarget.forbidden,
          spoken_transcript: transcript,
        }),
      })

      const data = await res.json()
      if (res.ok) {
        setAiGuesses((prev) => [
          { guess: data.ai_guess, confidence: data.confidence, correct: data.guessed_correctly },
          ...prev.slice(0, 3),
        ])

        if (data.guessed_correctly) {
          handleRoundWin()
        }
      }
    } catch (err) {
      console.error('AI guess error:', err)
    } finally {
      setAiThinking(false)
    }
  }

  const handleStartRecording = () => {
    if (roundResult || isRecording) return
    setIsRecording(true)

    const windowWithSpeech = window as any
    const SpeechRecognition =
      windowWithSpeech.SpeechRecognition || windowWithSpeech.webkitSpeechRecognition

    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition()
        recognitionRef.current = recognition
        recognition.continuous = true
        recognition.interimResults = true
        recognition.lang = 'en-US'

        recognition.onresult = (event: any) => {
          let t = ''
          for (let i = 0; i < event.results.length; i++) {
            t += event.results[i][0].transcript + ' '
          }
          setLiveTranscript(t.trim())
        }

        recognition.start()
      } catch (err) {
        console.warn('SpeechRecognition failed:', err)
      }
    } else {
      // Simulation fallback for typing/speaking
      const sampleClues = [
        `It is a common thing that people use when they need to transport themselves across town...`,
        `You find this person in professional environments dealing with emergency leaks...`,
        `This describes a mental habit of delaying urgent tasks until the very last second...`,
      ]
      setLiveTranscript(sampleClues[currentLevel - 1] || sampleClues[0])
    }
  }

  const handleStopRecording = () => {
    setIsRecording(false)
    if (recognitionRef.current) {
      try { recognitionRef.current.stop() } catch {}
    }
  }

  const handleRoundWin = () => {
    if (roundResult) return
    handleStopRecording()
    const accuracy = Math.min(98, Math.max(75, Math.round(85 + (timeLeft / 60) * 15)))
    setRoundResult({
      status: 'win',
      score: accuracy,
      message: `🎉 Target Solved in ${60 - timeLeft}s!`,
    })
    submitSessionCompletion(accuracy)
  }

  const handleRoundTimeout = () => {
    if (roundResult) return
    handleStopRecording()
    setRoundResult({
      status: 'timeout',
      score: 45,
      message: '⏳ Time Expired — The AI couldn’t guess the word in time.',
    })
    submitSessionCompletion(45)
  }

  const handleDisqualification = (forbiddenWord: string) => {
    if (roundResult) return
    handleStopRecording()
    setRoundResult({
      status: 'disqualified',
      score: 30,
      message: `🚫 Rule Violation — You uttered taboo word ('${forbiddenWord}').`,
    })
    submitSessionCompletion(30)
  }

  const submitSessionCompletion = async (score: number) => {
    try {
      await fetch('/api/sessions/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          module_type: 'circumlocution',
          level_number: currentLevel,
          session_number: sessionNumber,
          accuracy_score: score,
        }),
      })
    } catch (err) {
      console.error('Error recording session completion:', err)
    }
  }

  const handleNextSession = () => {
    if (sessionNumber < 15) {
      setSessionNumber((prev) => prev + 1)
    } else {
      setCurrentLevel((prev) => prev + 1)
      setSessionNumber(1)
    }
    loadRandomTarget(currentLevel)
  }

  if (loading) {
    return (
      <div className="flex min-h-screen bg-slate-950 items-center justify-center text-slate-400 font-sans">
        <div className="flex items-center gap-3">
          <Loader2 className="w-6 h-6 text-purple-500 animate-spin" />
          <span className="text-sm font-semibold">Loading Circumlocution Taboo Arena...</span>
        </div>
      </div>
    )
  }

  const maxTimer = currentLevel === 1 ? 60 : currentLevel === 2 ? 45 : 30
  const timerPercentage = (timeLeft / maxTimer) * 100

  return (
    <div className="flex flex-col min-h-screen bg-slate-950 text-slate-50 font-sans">
      {/* Top Navigation & Session HUD */}
      <header className="flex flex-col md:flex-row items-center justify-between px-6 lg:px-16 py-4 border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-md sticky top-0 z-50 gap-4">
        {/* Left: Back Navigation */}
        <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-start">
          <button
            onClick={() => {
              if (confirm('Leave current round? Unsaved progress will be lost.')) {
                router.push('/dashboard')
              }
            }}
            className="flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors bg-slate-900 border border-slate-800 px-3.5 py-2 rounded-xl cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" /> Dashboard
          </button>

          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/25 text-purple-300 text-xs font-semibold">
            <ShieldCheck className="w-3.5 h-3.5" /> Target: AI Guess & 0 Taboo Words
          </div>
        </div>

        {/* Center: Module & Level Badge */}
        <div className="hidden lg:flex items-center gap-2 px-4 py-1.5 rounded-2xl bg-slate-900 border border-slate-800 text-xs font-medium text-slate-300">
          <span className="text-purple-400 font-bold">Module: Circumlocution Sprint</span>
          <span className="text-slate-600">•</span>
          <span>Level {currentLevel}: {currentTarget?.category}</span>
        </div>

        {/* Right: Session Stepper */}
        <div className="flex items-center gap-4 w-full md:w-auto justify-end">
          <div className="flex flex-col items-end">
            <span className="text-xs font-bold text-slate-200">
              Session {sessionNumber} of 15
            </span>
            <div className="flex items-center gap-1 mt-1">
              {Array.from({ length: 15 }, (_, i) => i + 1).map((num) => (
                <div
                  key={num}
                  className={`h-1.5 rounded-full transition-all ${
                    num < sessionNumber
                      ? 'w-2 bg-emerald-500'
                      : num === sessionNumber
                      ? 'w-4 bg-purple-500'
                      : 'w-1.5 bg-slate-800'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* Main Arena */}
      <main className="flex-1 px-6 py-10 max-w-4xl mx-auto w-full space-y-8">
        {/* The Secret Target Arena Card */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-8 sm:p-10 shadow-2xl relative overflow-hidden backdrop-blur-xl">
          <div className="absolute top-0 right-1/4 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* Category & Secret Target */}
          <div className="text-center space-y-3 mb-8 relative z-10">
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-300 text-xs font-bold uppercase tracking-widest">
              Category: {currentTarget?.category}
            </span>
            <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-wide uppercase">
              Secret Target: <span className="text-purple-400 underline decoration-purple-500/50 underline-offset-8">[ {currentTarget?.target} ]</span>
            </h1>
          </div>

          {/* Red Zone: Forbidden (Taboo) Words */}
          <div className="mb-8 p-6 rounded-2xl bg-rose-950/20 border border-rose-500/30 relative z-10 space-y-4">
            <div className="flex items-center gap-2 text-rose-400 font-bold text-xs uppercase tracking-wider">
              <AlertOctagon className="w-4 h-4" /> RED ZONE • Taboo Words (Do NOT Utter)
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {currentTarget?.forbidden.map((word: string) => {
                const isViolated = violatedForbiddenWord === word || strikes.includes(word)
                return (
                  <div
                    key={word}
                    className={`flex items-center justify-between p-3.5 rounded-xl border transition-all ${
                      isViolated
                        ? 'bg-rose-900/80 border-rose-500 text-rose-100 animate-bounce ring-2 ring-rose-500'
                        : 'bg-slate-950/80 border-rose-500/30 text-rose-300'
                    }`}
                  >
                    <span className="font-bold text-sm tracking-wide">✕ {word}</span>
                    <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-rose-500/20 text-rose-300">
                      Forbidden
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Level 1 Scaffolding Stems */}
          {currentLevel === 1 && currentTarget?.stems && (
            <div className="mb-8 p-5 rounded-2xl bg-slate-950/80 border border-slate-800 relative z-10 space-y-2">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Starter Description Stems (Level 1 Hint)
              </span>
              <ul className="space-y-1.5 text-sm text-slate-300 italic">
                {currentTarget.stems.map((stem: string, i: number) => (
                  <li key={i}>• &ldquo;{stem}&rdquo;</li>
                ))}
              </ul>
            </div>
          )}

          {/* Timer & Mic Controls */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6 p-6 rounded-2xl bg-slate-950 border border-slate-800 relative z-10">
            {/* Circular Pressure Timer */}
            <div className="flex items-center gap-4">
              <div className="relative h-16 w-16 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                  <path
                    className="text-slate-800"
                    strokeWidth="3.5"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  <path
                    className={timeLeft <= 10 ? 'text-rose-500 animate-pulse' : timeLeft <= 20 ? 'text-amber-500' : 'text-purple-500'}
                    strokeDasharray={`${timerPercentage}, 100`}
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className={`text-sm font-black ${timeLeft <= 10 ? 'text-rose-400 animate-bounce' : 'text-slate-100'}`}>
                    {timeLeft}s
                  </span>
                </div>
              </div>
              <div>
                <span className="text-xs font-bold text-slate-300 block">Round Timer</span>
                <span className="text-[11px] text-slate-500">Strikes: {strikes.length}/2</span>
              </div>
            </div>

            {/* Mic Record Button */}
            <div className="w-full sm:w-auto">
              {!isRecording ? (
                <button
                  onClick={handleStartRecording}
                  disabled={!!roundResult}
                  className="w-full sm:w-auto flex items-center justify-center gap-3 bg-purple-600 hover:bg-purple-500 text-white font-bold py-4 px-8 rounded-2xl transition-all shadow-lg shadow-purple-600/30 cursor-pointer active:scale-95"
                >
                  <Mic className="w-5 h-5 animate-pulse" /> Start Speaking & Describe
                </button>
              ) : (
                <button
                  onClick={handleStopRecording}
                  className="w-full sm:w-auto flex items-center justify-center gap-3 bg-rose-600 hover:bg-rose-500 text-white font-bold py-4 px-8 rounded-2xl transition-all shadow-lg shadow-rose-600/30 cursor-pointer animate-pulse"
                >
                  <span className="h-3 w-3 rounded-full bg-white animate-ping" /> Stop / Finish Round
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Live AI Guesser Stream & Transcript */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Transcript Ticker */}
          <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-wider">
              <span>Your Spoken Clues</span>
              <span className={isRecording ? 'text-rose-400 animate-pulse' : 'text-slate-600'}>
                {isRecording ? '● Live Stream' : 'Idle'}
              </span>
            </div>
            <div className="h-32 p-4 rounded-2xl bg-slate-950 border border-slate-800 overflow-y-auto text-sm text-slate-300 font-mono">
              {liveTranscript || <span className="text-slate-600 italic">Start speaking to stream clues...</span>}
            </div>
          </div>

          {/* AI Guesser Feed */}
          <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-wider">
              <span>AI Guesser Stream</span>
              {aiThinking && <Loader2 className="w-3.5 h-3.5 text-purple-400 animate-spin" />}
            </div>
            <div className="h-32 p-4 rounded-2xl bg-slate-950 border border-slate-800 overflow-y-auto space-y-2">
              {aiGuesses.length === 0 ? (
                <span className="text-slate-600 italic text-sm">AI is listening for your description...</span>
              ) : (
                aiGuesses.map((g, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 rounded-xl bg-slate-900 border border-slate-800 text-xs">
                    <span className="font-semibold text-purple-300">AI: &ldquo;{g.guess}&rdquo;</span>
                    <span className={g.correct ? 'text-emerald-400 font-bold' : 'text-slate-400'}>
                      {Math.round(g.confidence * 100)}% match
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Post-Round Evaluation Verdict Card */}
        {roundResult && (
          <div className="p-8 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-6 pb-6 border-b border-slate-800">
              <div className="flex items-center gap-5">
                <div className="h-16 w-16 rounded-2xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400 text-2xl font-black">
                  {roundResult.score}%
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white mb-1">{roundResult.message}</h3>
                  <p className="text-xs text-slate-400">
                    {roundResult.status === 'win'
                      ? 'Brilliant circumlocution! You described the target instantly.'
                      : 'Review the taboo violations or try describing with different synonyms.'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                <button
                  onClick={() => loadRandomTarget(currentLevel)}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold px-5 py-3.5 rounded-xl border border-slate-700 transition-colors text-xs cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" /> Retry Round
                </button>
                <button
                  onClick={handleNextSession}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-500 text-white font-semibold px-6 py-3.5 rounded-xl transition-all shadow-lg shadow-purple-600/25 text-xs cursor-pointer"
                >
                  Next Session <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Linguistic Feedback */}
            <div className="space-y-4">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                Linguistic Feedback & Alternative Phrasing
              </span>
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-xs text-slate-300 space-y-2">
                <p>• <strong className="text-purple-300">Native Alternative:</strong> &ldquo;Instead of naming the prohibited words, native speakers often frame definitions using categorical properties (e.g., 'It belongs to the classification of...').&rdquo;</p>
                <p>• <strong className="text-purple-300">Fluency Tip:</strong> Keep sentences flowing even when encountering a taboo block by pivoting to physical function or context.</p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
