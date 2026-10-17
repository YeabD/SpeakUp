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
  RotateCcw,
  ArrowRight,
  CheckCircle2,
  XCircle,
  Volume2,
  VolumeX,
  Play,
  Flame,
  Clock,
  Sparkles,
  Activity,
  Send
} from 'lucide-react'

type GameState =
  | 'IDLE'
  | 'AI_SPEAKING'
  | 'LATENCY_COUNTDOWN'
  | 'USER_SPEAKING'
  | 'EVALUATING_VOLLEY'
  | 'SESSION_COMPLETE'
  | 'SESSION_FAULT'

export default function ConversationalPingPongPage() {
  const [loading, setLoading] = useState(true)
  const [currentLevel, setCurrentLevel] = useState(1)
  const [sessionNumber, setSessionNumber] = useState(1)

  // Game flow state
  const [gameState, setGameState] = useState<GameState>('IDLE')
  const [turnIndex, setTurnIndex] = useState(0)
  const [conversationHistory, setConversationHistory] = useState<Array<{ role: 'ai' | 'user'; text: string }>>([])
  const [currentAIPrompt, setCurrentAIPrompt] = useState('')
  const [userTranscript, setUserTranscript] = useState('')
  const [isTTSPlaying, setIsTTSPlaying] = useState(false)

  // Latency & Telemetry
  const [aiEndedAt, setAiEndedAt] = useState<number>(0)
  const [userStartedAt, setUserStartedAt] = useState<number>(0)
  const [currentLatencyMs, setCurrentLatencyMs] = useState<number | null>(null)
  const [latencies, setLatencies] = useState<number[]>([])
  const [wpm, setWpm] = useState<number>(130)

  // Session stats & verdict
  const [verdictData, setVerdictData] = useState<{
    success: boolean
    averageLatency: number
    accuracy: number
    message: string
    feedback: string
  } | null>(null)

  const router = useRouter()
  const supabase = createClient()

  // Refs for audio and speech recognition
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const recognitionRef = useRef<any>(null)
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null)
  const [countdownTimeLeft, setCountdownTimeLeft] = useState<number>(4.0)

  // Level rules configuration
  const levelConfig = {
    1: {
      name: 'Predictable Questions & Starters',
      targetRallies: 4,
      windowSecs: 4.0,
      starters: [
        'Well, to be honest...',
        'Generally speaking, I usually...',
        'It really depends, but...'
      ]
    },
    2: {
      name: 'Unprompted Reactions & Remarks',
      targetRallies: 5,
      windowSecs: 2.5,
      starters: []
    },
    3: {
      name: 'Counter-Arguments & Nuance',
      targetRallies: 6,
      windowSecs: 1.5,
      starters: []
    }
  }[currentLevel] || {
    name: 'Predictable Questions & Starters',
    targetRallies: 4,
    windowSecs: 4.0,
    starters: []
  }

  // Load user progress & initialize session
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
      .eq('module_id', 'ping_pong')
      .single()

    const level = progressData?.current_level || 1
    const completedSessions = progressData?.completed_sessions_in_level || 0
    const session = completedSessions + 1

    setCurrentLevel(level)
    const activeSession = session > 15 ? 15 : session
    setSessionNumber(activeSession)

    startNewRally(level, activeSession, 0, [])
  }

  async function startNewRally(level: number, session: number, tIdx: number, history: Array<{ role: 'ai' | 'user'; text: string }>) {
    setLoading(true)
    setTurnIndex(tIdx)
    setUserTranscript('')
    setCurrentLatencyMs(null)
    setVerdictData(null)

    try {
      const res = await fetch('/api/ping-pong/turn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          level_number: level,
          session_number: session,
          turn_index: tIdx,
          conversation_history: history,
          user_last_input: history.length > 0 ? history[history.length - 1].text : ''
        })
      })

      const data = await res.json()
      const aiText = data.ai_reply || 'Could you elaborate on your thoughts?'
      setCurrentAIPrompt(aiText)

      // Synthesize TTS & Play
      await playAITTS(aiText, level, history, tIdx)
    } catch (err) {
      console.error('Failed to fetch AI turn:', err)
      const fallback = 'That is quite fascinating! How does that affect your daily routine?'
      setCurrentAIPrompt(fallback)
      await playAITTS(fallback, level, history, tIdx)
    } finally {
      setLoading(false)
    }
  }

  async function playAITTS(text: string, level: number, history: Array<{ role: 'ai' | 'user'; text: string }>, tIdx: number) {
    setGameState('AI_SPEAKING')
    setIsTTSPlaying(true)

    try {
      const ttsRes = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })

      if (ttsRes.ok) {
        const blob = await ttsRes.blob()
        const audioUrl = URL.createObjectURL(blob)
        if (audioRef.current) {
          audioRef.current.pause()
        }
        const audio = new Audio(audioUrl)
        audioRef.current = audio

        audio.onended = () => {
          setIsTTSPlaying(false)
          triggerLatencyCountdown(level, text, history, tIdx)
        }
        audio.onerror = () => {
          setIsTTSPlaying(false)
          triggerLatencyCountdown(level, text, history, tIdx)
        }

        await audio.play().catch(() => {
          setIsTTSPlaying(false)
          triggerLatencyCountdown(level, text, history, tIdx)
        })
      } else {
        setIsTTSPlaying(false)
        setTimeout(() => triggerLatencyCountdown(level, text, history, tIdx), 1500)
      }
    } catch (e) {
      setIsTTSPlaying(false)
      setTimeout(() => triggerLatencyCountdown(level, text, history, tIdx), 1500)
    }
  }

  function triggerLatencyCountdown(level: number, aiText: string, history: Array<{ role: 'ai' | 'user'; text: string }>, tIdx: number) {
    const config = level === 1 ? { windowSecs: 4.0 } : level === 2 ? { windowSecs: 2.5 } : { windowSecs: 1.5 }
    setGameState('LATENCY_COUNTDOWN')
    setCountdownTimeLeft(config.windowSecs)
    setAiEndedAt(performance.now())

    // Start countdown timer interval
    const intervalMs = 50
    const decrement = intervalMs / 1000
    let timeLeft = config.windowSecs

    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current)

    countdownTimerRef.current = setInterval(() => {
      timeLeft -= decrement
      if (timeLeft <= 0) {
        if (countdownTimerRef.current) clearInterval(countdownTimerRef.current)
        setCountdownTimeLeft(0)
        // Fault: Timed out without user starting speech
        handleSessionFault('Reaction window expired! Hesitation limit exceeded.')
        return
      }
      setCountdownTimeLeft(Number(timeLeft.toFixed(1)))
    }, intervalMs)

    // Start Speech Recognition to listen for user's voice
    startSpeechRecognition(aiText, history, tIdx, config.windowSecs * 1000)
  }

  function startSpeechRecognition(aiText: string, history: Array<{ role: 'ai' | 'user'; text: string }>, tIdx: number, windowLimitMs: number) {
    const windowWithSpeech = window as any
    const SpeechRecognition = windowWithSpeech.SpeechRecognition || windowWithSpeech.webkitSpeechRecognition

    if (!SpeechRecognition) {
      // Fallback simulation if SpeechRecognition not supported in browser
      console.warn('SpeechRecognition API not available in browser. Simulating voice input.')
      return
    }

    try {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop() } catch {}
      }

      const recognition = new SpeechRecognition()
      recognitionRef.current = recognition
      recognition.continuous = true
      recognition.interimResults = true
      recognition.lang = 'en-US'

      let speechDetected = false

      recognition.onresult = (event: any) => {
        let interim = ''
        let final = ''

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            final += event.results[i][0].transcript
          } else {
            interim += event.results[i][0].transcript
          }
        }

        const transcript = (final + ' ' + interim).trim()
        if (transcript.length > 0 && !speechDetected) {
          speechDetected = true
          const startedAt = performance.now()
          setUserStartedAt(startedAt)
          const latency = Math.round(startedAt - aiEndedAt)

          if (countdownTimerRef.current) clearInterval(countdownTimerRef.current)

          // Check if latency exceeded allowed window
          if (latency > windowLimitMs) {
            try { recognition.stop() } catch {}
            handleSessionFault(`Reaction too slow! Latency was ${(latency / 1000).toFixed(1)}s (Target < ${(windowLimitMs / 1000).toFixed(1)}s)`)
            return
          }

          setCurrentLatencyMs(latency)
          setGameState('USER_SPEAKING')
        }

        setUserTranscript(transcript)
      }

      recognition.onerror = (err: any) => {
        console.warn('Speech recognition error:', err)
      }

      recognition.onend = () => {
        // If user was speaking, evaluate volley after short pause or silence
      }

      recognition.start()
    } catch (e) {
      console.error('Failed to start speech recognition:', e)
    }
  }

  function handleUserSubmitReturn(customText?: string) {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop() } catch {}
    }
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current)

    const finalTranscript = customText !== undefined ? customText : userTranscript
    if (!finalTranscript.trim()) {
      handleSessionFault('No response recorded.')
      return
    }

    const latency = currentLatencyMs || Math.round(performance.now() - aiEndedAt)
    const newLatencies = [...latencies, latency]
    setLatencies(newLatencies)

    const newHistory = [
      ...conversationHistory,
      { role: 'ai' as const, text: currentAIPrompt },
      { role: 'user' as const, text: finalTranscript }
    ]
    setConversationHistory(newHistory)

    // Check if target rallies completed
    const target = levelConfig.targetRallies
    const nextTurn = turnIndex + 1

    if (nextTurn >= target) {
      // Session Success!
      handleSessionSuccess(newLatencies, newHistory)
    } else {
      // Continue next volley
      startNewRally(currentLevel, sessionNumber, nextTurn, newHistory)
    }
  }

  function handleSessionFault(reason: string) {
    setGameState('SESSION_FAULT')
    if (recognitionRef.current) {
      try { recognitionRef.current.stop() } catch {}
    }
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current)
    if (audioRef.current) audioRef.current.pause()

    setVerdictData({
      success: false,
      averageLatency: latencies.length > 0 ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : 2500,
      accuracy: 45,
      message: reason,
      feedback: 'Rally dropped due to hesitation or latency window expiration. Stay sharp on conversational pacing!'
    })
  }

  async function handleSessionSuccess(finalLatencies: number[], finalHistory: Array<{ role: 'ai' | 'user'; text: string }>) {
    setGameState('SESSION_COMPLETE')
    if (recognitionRef.current) {
      try { recognitionRef.current.stop() } catch {}
    }
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current)

    const avgLat = Math.round(finalLatencies.reduce((a, b) => a + b, 0) / finalLatencies.length)
    // Calculate accuracy based on average latency vs target window
    const targetLimitMs = currentLevel === 1 ? 4000 : currentLevel === 2 ? 2500 : 1500
    const accuracy = Math.max(60, Math.min(100, Math.round(100 - ((avgLat / targetLimitMs) * 35))))

    const verdict = {
      success: true,
      averageLatency: avgLat,
      accuracy,
      message: `${levelConfig.targetRallies}/${levelConfig.targetRallies} Volleys Completed Successfully!`,
      feedback: currentLevel === 1
        ? 'Great cadence! Effective use of starter phrases for smooth conversational entry.'
        : currentLevel === 2
        ? 'Excellent reactive agility! Natural acknowledgers used before expanding ideas.'
        : 'Masterful conversational fencing! Lightning-fast reaction speed with balanced concession markers.'
    }
    setVerdictData(verdict)

    // Post to API session complete
    try {
      await fetch('/api/sessions/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          module_type: 'ping_pong',
          level_number: currentLevel,
          session_number: sessionNumber,
          accuracy_score: accuracy
        })
      })
    } catch (err) {
      console.error('Failed to record session completion:', err)
    }
  }

  function handleStarterChipClick(chip: string) {
    if (gameState === 'LATENCY_COUNTDOWN' || gameState === 'USER_SPEAKING') {
      const combined = `${chip} ${userTranscript}`.trim()
      setUserTranscript(combined)
      if (gameState === 'LATENCY_COUNTDOWN') {
        if (countdownTimerRef.current) clearInterval(countdownTimerRef.current)
        const startedAt = performance.now()
        setUserStartedAt(startedAt)
        const latency = Math.round(startedAt - aiEndedAt)
        setCurrentLatencyMs(latency)
        setGameState('USER_SPEAKING')
      }
    }
  }

  useEffect(() => {
    loadInitialData()
    return () => {
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current)
      if (recognitionRef.current) {
        try { recognitionRef.current.stop() } catch {}
      }
      if (audioRef.current) audioRef.current.pause()
    }
  }, [])

  if (loading && gameState === 'IDLE') {
    return (
      <div className="flex min-h-screen bg-slate-950 items-center justify-center text-slate-400 font-sans">
        <div className="flex items-center gap-3">
          <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
          <span className="text-sm font-semibold">Initializing Conversational Ping-Pong Reactivity Engine...</span>
        </div>
      </div>
    )
  }

  const averageLatency = latencies.length > 0 ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : 0

  return (
    <div className="flex flex-col min-h-screen bg-slate-950 text-slate-50 font-sans">
      {/* Top Header & Rally HUD */}
      <header className="flex flex-col md:flex-row items-center justify-between px-6 lg:px-16 py-4 border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-md sticky top-0 z-50 gap-4">
        {/* Left: Back & Badge */}
        <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-start">
          <button
            onClick={() => router.push('/dashboard')}
            className="flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors bg-slate-900 border border-slate-800 px-3.5 py-2 rounded-xl cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" /> Dashboard
          </button>

          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs font-semibold">
            <Zap className="w-4 h-4 text-indigo-400" />
            <span>Conversational Ping-Pong • Level {currentLevel}: {levelConfig.name}</span>
          </div>
        </div>

        {/* Center: 15-Session Pill Bar */}
        <div className="hidden xl:flex items-center gap-1.5">
          {Array.from({ length: 15 }).map((_, i) => {
            const num = i + 1
            const isCompleted = num < sessionNumber
            const isCurrent = num === sessionNumber
            return (
              <div
                key={num}
                title={`Session ${num}`}
                className={`w-6 h-2 rounded-full transition-all ${
                  isCompleted
                    ? 'bg-emerald-500'
                    : isCurrent
                    ? 'bg-indigo-500 ring-2 ring-indigo-500/30 animate-pulse'
                    : 'bg-slate-800'
                }`}
              />
            )
          })}
          <span className="text-xs font-medium text-slate-400 ml-2">Session {sessionNumber}/15</span>
        </div>

        {/* Right: Rally Scoreboard Meter */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-300 shadow-inner">
            <Flame className="w-4 h-4 text-amber-400 animate-pulse" />
            <span>Rally: {turnIndex + 1} / {levelConfig.targetRallies} Volleys</span>
          </div>
        </div>
      </header>

      {/* Main Content Arena */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8 py-8 max-w-5xl mx-auto w-full">
        {gameState === 'SESSION_COMPLETE' || gameState === 'SESSION_FAULT' ? (
          /* Post-Session Performance Verdict Card */
          <div className="w-full bg-slate-900/95 border border-slate-800 rounded-3xl p-6 sm:p-10 shadow-2xl relative overflow-hidden animate-in fade-in zoom-in duration-300">
            <div className={`absolute top-0 right-0 -mt-12 -mr-12 w-64 h-64 rounded-full blur-3xl pointer-events-none ${verdictData?.success ? 'bg-emerald-500/10' : 'bg-rose-500/10'}`} />

            <div className="flex items-center gap-3 mb-6">
              <div className={`p-3 rounded-2xl border ${verdictData?.success ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-rose-500/10 border-rose-500/30 text-rose-400'}`}>
                {verdictData?.success ? <Award className="w-8 h-8" /> : <XCircle className="w-8 h-8" />}
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">
                  {verdictData?.success ? 'Rally Completed Successfully!' : 'Rally Dropped (Fault)'}
                </h2>
                <p className="text-sm text-slate-400">{verdictData?.message}</p>
              </div>
            </div>

            {/* Metrics Breakdown Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
              <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4 text-center">
                <span className="text-xs font-medium text-slate-400 block mb-1">Accuracy Score</span>
                <span className={`text-2xl font-bold ${verdictData?.success ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {verdictData?.accuracy}%
                </span>
              </div>
              <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4 text-center">
                <span className="text-xs font-medium text-slate-400 block mb-1">Average Latency</span>
                <span className="text-2xl font-bold text-indigo-400">
                  {averageLatency}ms
                </span>
                <span className="text-[10px] text-slate-500 block mt-0.5">Target &lt; {levelConfig.windowSecs * 1000}ms</span>
              </div>
              <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4 text-center">
                <span className="text-xs font-medium text-slate-400 block mb-1">Volleys Completed</span>
                <span className="text-2xl font-bold text-white">
                  {turnIndex} / {levelConfig.targetRallies}
                </span>
              </div>
            </div>

            {/* Turn-by-Turn Latency Bar Visualizer */}
            <div className="mb-8 bg-slate-950/80 border border-slate-800/80 rounded-2xl p-5">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
                <Activity className="w-4 h-4 text-indigo-400" /> Turn-by-Turn Reaction Latency (ms)
              </h3>
              <div className="flex items-end gap-3 h-28 pt-4 px-2 border-b border-slate-800">
                {latencies.map((lat, idx) => {
                  const maxLimit = levelConfig.windowSecs * 1000
                  const heightPercent = Math.min(100, Math.max(15, (lat / maxLimit) * 100))
                  const isGood = lat <= maxLimit
                  return (
                    <div key={idx} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group">
                      <span className="text-[10px] text-slate-400 font-mono opacity-0 group-hover:opacity-100 transition-opacity">{lat}ms</span>
                      <div
                        style={{ height: `${heightPercent}%` }}
                        className={`w-full rounded-t-lg transition-all ${isGood ? 'bg-indigo-500 hover:bg-indigo-400' : 'bg-rose-500 hover:bg-rose-400'}`}
                      />
                      <span className="text-[11px] font-semibold text-slate-400">V{idx + 1}</span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Discourse & Transition Feedback */}
            <div className="bg-indigo-500/10 border border-indigo-500/25 rounded-2xl p-4 mb-8 flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-semibold text-indigo-300 mb-1">Discourse & Pacing Feedback</h4>
                <p className="text-xs text-slate-300 leading-relaxed">{verdictData?.feedback}</p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-end gap-4">
              <button
                onClick={() => startNewRally(currentLevel, sessionNumber, 0, [])}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-sm transition-all cursor-pointer border border-slate-700"
              >
                <RotateCcw className="w-4 h-4" /> Retry Rally
              </button>
              <button
                onClick={() => {
                  if (sessionNumber < 15) {
                    setSessionNumber(prev => prev + 1)
                  }
                  startNewRally(currentLevel, sessionNumber >= 15 ? 15 : sessionNumber + 1, 0, [])
                }}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition-all shadow-lg shadow-indigo-600/25 cursor-pointer"
              >
                <span>Next Session ({sessionNumber >= 15 ? 15 : sessionNumber + 1}/15)</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          /* Active Ping-Pong Volley Stage (Center Arena) */
          <div className="w-full bg-slate-900/90 border border-slate-800/90 rounded-3xl p-6 sm:p-10 shadow-2xl relative overflow-hidden">
            {/* Background ambient glow */}
            <div className="absolute top-0 right-0 -mt-16 -mr-16 w-72 h-72 rounded-full blur-3xl pointer-events-none bg-indigo-500/10" />

            {/* AI Turn Side (The Serve) */}
            <div className="mb-8 bg-slate-950/70 border border-slate-800/80 rounded-2xl p-6 relative">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${isTTSPlaying ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-400 animate-pulse' : 'bg-slate-800 border-slate-700 text-slate-300'}`}>
                    {isTTSPlaying ? <Volume2 className="w-5 h-5 animate-bounce" /> : <Play className="w-5 h-5" />}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <span>AI Conversation Partner</span>
                      {isTTSPlaying && <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-normal">Speaking...</span>}
                    </h3>
                    <span className="text-xs text-slate-400">Volley #{turnIndex + 1} of {levelConfig.targetRallies}</span>
                  </div>
                </div>

                <button
                  onClick={() => playAITTS(currentAIPrompt, currentLevel, conversationHistory, turnIndex)}
                  disabled={isTTSPlaying}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors cursor-pointer disabled:opacity-50"
                >
                  <Volume2 className="w-3.5 h-3.5" /> Replay Serve
                </button>
              </div>

              {/* AI Prompt Speech Bubble */}
              <div className="text-lg sm:text-xl font-medium text-white leading-relaxed pl-3 border-l-2 border-indigo-500">
                "{currentAIPrompt}"
              </div>
            </div>

            {/* Reaction Pressure Gauge (High-Stakes Countdown) */}
            <div className="mb-8 bg-slate-950/90 border border-slate-800 rounded-2xl p-5 text-center relative overflow-hidden">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-indigo-400" /> Reaction Latency Window ({levelConfig.windowSecs}s Limit)
                </span>
                <span className={`text-sm font-bold font-mono ${countdownTimeLeft > 2 ? 'text-indigo-400' : countdownTimeLeft > 1 ? 'text-amber-400' : 'text-rose-500 animate-pulse'}`}>
                  {gameState === 'USER_SPEAKING' ? (
                    <span className="text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4" /> ✓ Lag: {currentLatencyMs || 0}ms
                    </span>
                  ) : gameState === 'AI_SPEAKING' ? (
                    'AI Speaking...'
                  ) : (
                    `REACT NOW! ${countdownTimeLeft.toFixed(1)}s`
                  )}
                </span>
              </div>

              {/* Shrinking Progress Bar */}
              <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-700/50">
                <div
                  style={{
                    width: `${Math.max(0, Math.min(100, (countdownTimeLeft / levelConfig.windowSecs) * 100))}%`
                  }}
                  className={`h-full rounded-full transition-all duration-75 ${
                    countdownTimeLeft > levelConfig.windowSecs * 0.5
                      ? 'bg-indigo-500'
                      : countdownTimeLeft > levelConfig.windowSecs * 0.25
                      ? 'bg-amber-500'
                      : 'bg-rose-500 animate-pulse'
                  }`}
                />
              </div>
            </div>

            {/* User Turn Side (The Return) */}
            <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-6 relative mb-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${gameState === 'USER_SPEAKING' ? 'bg-rose-500/20 border-rose-500/50 text-rose-400 animate-pulse ring-4 ring-rose-500/20' : 'bg-slate-800 border-slate-700 text-slate-400'}`}>
                    <Mic className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Your Return (Spoken Response)</h3>
                    <span className="text-xs text-slate-400">
                      {gameState === 'USER_SPEAKING' ? 'Listening to your vocal response...' : gameState === 'AI_SPEAKING' ? 'Locked (Waiting for AI serve)' : 'Speak immediately to keep rally alive!'}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => handleUserSubmitReturn()}
                  disabled={!userTranscript.trim()}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-semibold text-xs transition-all shadow-md cursor-pointer disabled:cursor-not-allowed"
                >
                  <span>Send Return</span>
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Real-time Transcription Ticker */}
              <div className="min-h-[90px] bg-slate-900 border border-slate-800 rounded-xl p-4 text-white text-base font-medium flex items-center">
                {userTranscript ? (
                  <span className="leading-relaxed">{userTranscript}</span>
                ) : (
                  <span className="text-slate-500 italic">
                    {gameState === 'LATENCY_COUNTDOWN' ? 'Start speaking now into your microphone...' : 'Type or speak your conversational return...'}
                  </span>
                )}
              </div>

              {/* Level 1 Starter Chips Row */}
              {currentLevel === 1 && levelConfig.starters.length > 0 && (
                <div className="mt-4">
                  <span className="text-xs font-semibold text-slate-400 block mb-2">Quick Starter Chips:</span>
                  <div className="flex flex-wrap gap-2">
                    {levelConfig.starters.map((chip, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleStarterChipClick(chip)}
                        className="px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-medium text-indigo-300 transition-colors cursor-pointer"
                      >
                        {chip}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Telemetry Strip */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-4 py-3 rounded-2xl bg-slate-950/80 border border-slate-800/80 text-xs text-slate-300">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-indigo-400" />
                <span>Current Volley Latency: <strong className="text-white font-mono">{currentLatencyMs !== null ? `${currentLatencyMs}ms` : '---'}</strong></span>
                <span className="text-slate-600">•</span>
                <span>Average: <strong className="text-indigo-300 font-mono">{averageLatency}ms</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-400" />
                <span>Pace: <strong className="text-white font-mono">{wpm} WPM</strong></span>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
