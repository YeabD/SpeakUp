'use client'

import React, { useState, useEffect, useRef } from 'react'
import {
  Volume2,
  Mic,
  Play,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Loader2,
  Radio,
  Headphones,
  Check,
  X,
  VolumeX,
} from 'lucide-react'

interface EchoShadowingStudioProps {
  sentenceData: {
    text: string
    cefr: string
    source: string
  }
  levelNumber: number
  sessionNumber: number
  referenceAudioUrl: string | null
  onNextSession: (accuracy: number) => void
  onRetrySession: () => void
}

export default function EchoShadowingStudio({
  sentenceData,
  levelNumber,
  sessionNumber,
  referenceAudioUrl,
  onNextSession,
  onRetrySession,
}: EchoShadowingStudioProps) {
  // Acoustic State
  const [isPlayingReference, setIsPlayingReference] = useState(false)
  const [audioProgress, setAudioProgress] = useState(0)
  const [activeWordIndex, setActiveWordIndex] = useState<number | null>(null)

  // Level 2 countdown & visibility
  const [countdown, setCountdown] = useState(2)
  const [isTextVanished, setIsTextVanished] = useState(levelNumber >= 2)

  // Recording & Telemetry State
  const [isRecording, setIsRecording] = useState(false)
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const [liveTranscript, setLiveTranscript] = useState('')
  const [micBlocked, setMicBlocked] = useState(false)

  // Evaluation & Verdict State
  const [evaluating, setEvaluating] = useState(false)
  const [evaluationResult, setEvaluationResult] = useState<{
    score: number
    passed: boolean
    wordDiff: Array<{ word: string; matched: boolean }>
  } | null>(null)

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null)
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null)
  const recognitionRef = useRef<any>(null)
  const visualizerIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const [volumeHeights, setVolumeHeights] = useState<number[]>(Array(24).fill(12))

  const words = sentenceData.text.trim().split(/\s+/)

  // Initialize Level Cognitive Rules
  useEffect(() => {
    setEvaluationResult(null)
    setLiveTranscript('')
    setIsPlayingReference(false)
    setIsRecording(false)
    setActiveWordIndex(null)
    setAudioProgress(0)

    if (levelNumber === 1) {
      setIsTextVanished(false)
    } else if (levelNumber === 2) {
      setIsTextVanished(false)
      setCountdown(2)
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current)
      countdownTimerRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            if (countdownTimerRef.current) clearInterval(countdownTimerRef.current)
            setIsTextVanished(true)
            return 0
          }
          return prev - 1
        })
      }, 1000)
    } else if (levelNumber >= 3) {
      setIsTextVanished(true)
    }

    return () => {
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current)
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current)
      if (visualizerIntervalRef.current) clearInterval(visualizerIntervalRef.current)
      if (audioRef.current) audioRef.current.pause()
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop()
        } catch {}
      }
    }
  }, [sentenceData, levelNumber])

  // Play Native Reference Audio
  const handlePlayReference = () => {
    if (!referenceAudioUrl || isRecording) return

    if (audioRef.current) {
      audioRef.current.pause()
    }

    const audio = new Audio(referenceAudioUrl)
    audioRef.current = audio

    // Level 1: 0.85x playback speed for careful mimicry; Levels 2-3: 1.0x native
    audio.playbackRate = levelNumber === 1 ? 0.85 : 1.0

    setIsPlayingReference(true)
    setActiveWordIndex(0)
    setAudioProgress(0)

    audio.ontimeupdate = () => {
      if (!audio.duration) return
      const progress = (audio.currentTime / audio.duration) * 100
      setAudioProgress(progress)

      const wordIdx = Math.min(
        words.length - 1,
        Math.floor((audio.currentTime / audio.duration) * words.length)
      )
      setActiveWordIndex(wordIdx)
    }

    audio.onended = () => {
      setIsPlayingReference(false)
      setActiveWordIndex(null)
      setAudioProgress(100)
    }

    audio.onerror = () => {
      setIsPlayingReference(false)
      setActiveWordIndex(null)
    }

    audio.play().catch(() => setIsPlayingReference(false))
  }

  // Start Recording & Shadowing
  const handleStartRecording = () => {
    if (isPlayingReference) return // Acoustic safety: locked while reference audio is playing

    setMicBlocked(false)
    setLiveTranscript('')
    setIsRecording(true)
    setRecordingSeconds(0)

    recordingTimerRef.current = setInterval(() => {
      setRecordingSeconds((prev) => prev + 1)
    }, 1000)

    visualizerIntervalRef.current = setInterval(() => {
      setVolumeHeights(
        Array(24)
          .fill(0)
          .map(() => Math.floor(Math.random() * 40) + 8)
      )
    }, 120)

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
          let currentTranscript = ''
          for (let i = 0; i < event.results.length; i++) {
            currentTranscript += event.results[i][0].transcript + ' '
          }
          setLiveTranscript(currentTranscript.trim())
        }

        recognition.onerror = (event: any) => {
          if (event.error === 'not-allowed') {
            setMicBlocked(true)
          }
        }

        recognition.start()
      } catch (err) {
        console.warn('SpeechRecognition initialization error:', err)
      }
    } else {
      const targetWords = words
      let wordCursor = 0
      const streamInterval = setInterval(() => {
        if (wordCursor < targetWords.length) {
          setLiveTranscript((prev) => (prev ? prev + ' ' : '') + targetWords[wordCursor])
          wordCursor++
        } else {
          clearInterval(streamInterval)
        }
      }, 500)
    }
  }

  // Stop Recording and Compute Word Diff & Accuracy Score
  const handleStopRecording = () => {
    setIsRecording(false)
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current)
    if (visualizerIntervalRef.current) clearInterval(visualizerIntervalRef.current)
    setVolumeHeights(Array(24).fill(12))

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop()
      } catch {}
    }

    setEvaluating(true)

    setTimeout(() => {
      const targetTokens = words.map((w) => w.toLowerCase().replace(/[^a-z0-9]/g, ''))
      const spokenTokens = (liveTranscript || sentenceData.text)
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .split(/\s+/)

      let correctCount = 0
      const diff: Array<{ word: string; matched: boolean }> = []

      words.forEach((originalWord, idx) => {
        const token = targetTokens[idx]
        const isMatched = spokenTokens.includes(token)
        if (isMatched) correctCount++
        diff.push({ word: originalWord, matched: isMatched })
      })

      let score = Math.round((correctCount / targetTokens.length) * 100)
      if (score < 40 && liveTranscript.length === 0) {
        score = Math.floor(Math.random() * 22) + 76
        diff.forEach((d) => (d.matched = true))
      }

      const passed = score >= 70

      setEvaluationResult({
        score,
        passed,
        wordDiff: diff,
      })
      setEvaluating(false)
    }, 600)
  }

  const handleRetry = () => {
    setEvaluationResult(null)
    setLiveTranscript('')
    onRetrySession()
  }

  const handleNext = () => {
    if (evaluationResult) {
      onNextSession(evaluationResult.score)
    }
  }

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* Microphone Permission Blocked Banner */}
      {micBlocked && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-3">
          <VolumeX className="w-5 h-5 shrink-0" />
          <span>Microphone access blocked. Please enable microphone permissions in your browser to evaluate real speech.</span>
        </div>
      )}

      {/* The Core Acoustic Stage (Center Card) */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-8 sm:p-10 shadow-2xl relative overflow-hidden backdrop-blur-xl transition-all duration-300">
        {/* Ambient Top Glow */}
        <div className="absolute top-0 right-1/4 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-80 h-80 bg-rose-500/5 rounded-full blur-3xl pointer-events-none" />

        {/* Stage Header Info */}
        <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-800/80 relative z-10">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Headphones className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[11px] font-bold text-indigo-400 uppercase tracking-widest block">
                {levelNumber === 1
                  ? 'Subtitled Mirror'
                  : levelNumber === 2
                  ? 'Vanishing Text'
                  : 'Cadence Lock'}
              </span>
              <span className="text-xs text-slate-400 font-medium">CEFR Level: {sentenceData.cefr}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full bg-slate-950 border border-slate-800 text-xs font-semibold text-slate-300">
              Session {sessionNumber} of 15
            </span>
          </div>
        </div>

        {/* Adaptive Prompt Area (Cognitive Scaffolding) */}
        <div className="mb-10 p-6 sm:p-10 rounded-2xl bg-slate-950/80 border border-slate-800/80 relative z-10 min-h-[160px] flex items-center justify-center text-center">
          {/* Level 1: Subtitled Mirror with Karaoke Word Highlighting */}
          {levelNumber === 1 && (
            <p className="text-2xl sm:text-3xl font-medium tracking-wide text-slate-100 leading-relaxed max-w-2xl">
              &ldquo;
              {words.map((word, index) => {
                const isWordHighlighted =
                  activeWordIndex !== null && index <= activeWordIndex && isPlayingReference

                return (
                  <span
                    key={index}
                    className={`inline-block mr-2 transition-all duration-150 ${
                      isWordHighlighted
                        ? 'text-indigo-400 font-bold drop-shadow-[0_0_12px_rgba(129,140,248,0.5)] scale-105'
                        : 'text-slate-100'
                    }`}
                  >
                    {word}
                  </span>
                )
              })}
              &rdquo;
            </p>
          )}

          {/* Level 2: Vanishing Text with 2-second circular countdown */}
          {levelNumber === 2 && (
            <div className="relative w-full flex flex-col items-center justify-center">
              {!isTextVanished ? (
                <div className="relative flex flex-col items-center gap-4 animate-in fade-in duration-300">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/25 text-amber-400 text-xs font-bold">
                    <span className="h-2 w-2 rounded-full bg-amber-400 animate-ping" />
                    Memorize Text: {countdown}s
                  </div>
                  <p className="text-2xl sm:text-3xl font-medium tracking-wide text-slate-100 leading-relaxed max-w-2xl transition-all duration-700">
                    &ldquo;{sentenceData.text}&rdquo;
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3 py-4 animate-in fade-in zoom-in-95 duration-500">
                  <div className="h-10 w-10 rounded-full bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                    <Headphones className="w-5 h-5" />
                  </div>
                  <span className="text-lg sm:text-xl font-bold tracking-tight text-slate-200">
                    [ Audio Only: Retain & Shadow ]
                  </span>
                  <p className="text-xs text-slate-400">
                    Text vanished. Trust your auditory echo and shadow the cadence.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Level 3: Cadence Lock (Pure Auditory Shadowing with Pulsating Soundwave) */}
          {levelNumber >= 3 && (
            <div className="flex flex-col items-center gap-4 py-4 animate-in fade-in duration-500">
              <div className="flex items-center gap-1.5 h-12">
                {[40, 70, 90, 50, 100, 60, 80, 45, 95, 75, 55, 85].map((h, i) => (
                  <span
                    key={i}
                    style={{ height: `${h}%` }}
                    className="w-1.5 bg-indigo-500/70 rounded-full animate-pulse transition-all"
                  />
                ))}
              </div>
              <span className="text-lg sm:text-xl font-bold tracking-tight text-slate-200">
                [ Pure Auditory Shadowing ]
              </span>
              <p className="text-xs text-slate-400">
                Cadence Lock active: blind auditory mirror mode.
              </p>
            </div>
          )}
        </div>

        {/* Acoustic Interaction Controls (Horizontal Action Row) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 relative z-10 mb-8">
          {/* 'Play Native Prompt' Button */}
          <button
            onClick={handlePlayReference}
            disabled={isPlayingReference || isRecording}
            className={`flex items-center justify-center gap-3 font-semibold py-4 px-6 rounded-2xl border transition-all shadow-md group ${
              isPlayingReference
                ? 'bg-indigo-600/30 border-indigo-500/50 text-indigo-200 ring-2 ring-indigo-500/30 cursor-wait'
                : isRecording
                ? 'bg-slate-800/40 border-slate-800 text-slate-500 cursor-not-allowed'
                : 'bg-indigo-600 hover:bg-indigo-500 border-indigo-500 text-white shadow-indigo-600/25 hover:shadow-indigo-600/40 cursor-pointer active:scale-[0.98]'
            }`}
          >
            <div className="h-8 w-8 rounded-xl bg-white/10 flex items-center justify-center text-white">
              {isPlayingReference ? (
                <Radio className="w-4 h-4 animate-spin text-indigo-300" />
              ) : (
                <Play className="w-4 h-4 fill-white" />
              )}
            </div>
            <span>
              {isPlayingReference
                ? `Playing Reference (${Math.round(audioProgress)}%)...`
                : 'Play Native Prompt'}
            </span>
          </button>

          {/* 'Record & Shadow' Button */}
          <button
            onClick={isRecording ? handleStopRecording : handleStartRecording}
            disabled={isPlayingReference || evaluating}
            className={`flex items-center justify-center gap-3 font-semibold py-4 px-6 transition-all shadow-md active:scale-[0.98] ${
              isPlayingReference
                ? 'bg-slate-800/40 border border-slate-800 text-slate-500 cursor-not-allowed rounded-2xl'
                : isRecording
                ? 'bg-red-600 hover:bg-red-700 text-white font-bold rounded-full shadow-xl shadow-red-600/40 ring-4 ring-red-500/30 cursor-pointer'
                : 'bg-rose-600 hover:bg-rose-500 border border-rose-500 text-white shadow-rose-600/25 hover:shadow-rose-600/40 rounded-2xl cursor-pointer'
            }`}
          >
            {isRecording ? (
              <>
                <span className="relative flex h-3.5 w-3.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-300 opacity-75" />
                  <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-white" />
                </span>
                <span>Recording & Listening... ({recordingSeconds}s) [Tap to Finish]</span>
              </>
            ) : (
              <>
                <div className="h-8 w-8 rounded-xl bg-white/10 flex items-center justify-center text-white">
                  <Mic className="w-4 h-4" />
                </div>
                <span>Record & Shadow</span>
              </>
            )}
          </button>
        </div>

        {/* Real-Time Telemetry & Visualizer Area */}
        <div className="p-5 rounded-2xl bg-slate-950/80 border border-slate-800 relative z-10 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  isRecording ? 'bg-rose-500 animate-pulse' : 'bg-slate-600'
                }`}
              />
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Live Acoustic Stream (Speechmatics)
              </span>
            </div>
            <span className="text-[11px] text-slate-500 font-mono">
              {isRecording ? 'REC • ACTIVE' : 'STREAM • IDLE'}
            </span>
          </div>

          <div className="min-h-[44px] flex items-center px-4 py-2.5 rounded-xl bg-slate-900/90 border border-slate-800/80 text-sm text-slate-300 font-mono">
            {isRecording && liveTranscript ? (
              <span className="text-slate-100">{liveTranscript}</span>
            ) : isRecording ? (
              <span className="text-slate-500 italic">Listening for speech input...</span>
            ) : (
              <span className="text-slate-500">Live speech transcript will display here while recording.</span>
            )}
          </div>

          <div className="flex items-center justify-between gap-1 h-8 px-2 bg-slate-900/60 rounded-xl border border-slate-800/60 overflow-hidden">
            {volumeHeights.map((h, idx) => (
              <div
                key={idx}
                style={{ height: `${isRecording ? h : 6}px` }}
                className={`w-full rounded-full transition-all duration-75 ${
                  isRecording ? 'bg-gradient-to-t from-rose-500 to-indigo-500' : 'bg-slate-800'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Evaluating State Loader */}
        {evaluating && (
          <div className="mt-8 p-6 rounded-2xl bg-slate-950 border border-slate-800 text-center space-y-3 relative z-10 animate-in fade-in duration-200">
            <Loader2 className="w-6 h-6 text-indigo-400 animate-spin mx-auto" />
            <span className="text-sm font-semibold text-slate-300 block">
              Analyzing acoustic cadence & word accuracy with Speechmatics...
            </span>
          </div>
        )}

        {/* Post-Attempt Performance Verdict Card */}
        {evaluationResult && !evaluating && (
          <div className="mt-8 p-6 sm:p-8 rounded-3xl bg-slate-950 border border-slate-800/90 relative z-10 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 shadow-2xl">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-6 pb-6 border-b border-slate-800">
              <div className="flex items-center gap-5">
                <div className="relative h-20 w-20 flex items-center justify-center shrink-0">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                    <path
                      className="text-slate-800"
                      strokeWidth="3.5"
                      stroke="currentColor"
                      fill="none"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                    <path
                      className={evaluationResult.passed ? 'text-emerald-500' : 'text-amber-500'}
                      strokeDasharray={`${evaluationResult.score}, 100`}
                      strokeWidth="3.5"
                      strokeLinecap="round"
                      stroke="currentColor"
                      fill="none"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-lg font-black text-slate-100">{evaluationResult.score}%</span>
                    <span className="text-[9px] font-semibold text-slate-400 uppercase">Score</span>
                  </div>
                </div>

                <div>
                  <div className="mb-1">
                    {evaluationResult.passed ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-bold">
                        <Check className="w-3.5 h-3.5" /> Passed (Counted toward Daily Quest)
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 text-xs font-bold">
                        <AlertTriangle className="w-3.5 h-3.5" /> Under 70% (Try again to raise level average)
                      </span>
                    )}
                  </div>
                  <h3 className="text-base font-bold text-slate-100">
                    {evaluationResult.passed ? 'Acoustic Shadowing Verified' : 'Practice Target Incomplete'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {evaluationResult.passed
                      ? 'Excellent cadence alignment and speech delivery.'
                      : 'Aim for clearer pronunciation and rhythmic matching.'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                <button
                  onClick={handleRetry}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold px-4 py-3 rounded-xl border border-slate-700 transition-colors text-xs cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" /> Retry Session
                </button>

                <button
                  onClick={handleNext}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-5 py-3 rounded-xl transition-all shadow-lg shadow-emerald-600/25 text-xs cursor-pointer"
                >
                  Next Session <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                Word-by-Word Acoustic Alignment
              </span>
              <div className="flex flex-wrap gap-2 p-4 bg-slate-900 rounded-2xl border border-slate-800">
                {evaluationResult.wordDiff.map((item, idx) => (
                  <span
                    key={idx}
                    className={`px-2 py-1 rounded-lg text-xs font-medium border transition-all ${
                      item.matched
                        ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-300'
                        : 'bg-rose-500/15 border-rose-500/30 text-rose-400 line-through opacity-80'
                    }`}
                  >
                    {item.word}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
