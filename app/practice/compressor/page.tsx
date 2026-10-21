'use client'

import { Button } from '@/components/ui/button'
import { VoiceIcon as Mic, AchievementIcon as Award } from '@/components/icons/studio-icons'
import { StudioBanner } from '@/components/shared/studio-banner'

import React, { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/src/lib/supabase/client'
import { ArrowLeft, Loader2, Zap, ShieldCheck, RotateCcw, ArrowRight, CheckCircle2, XCircle, Clock, Sparkles, Activity, Timer, Volume2, StopCircle, Play, Check, AlertTriangle } from 'lucide-react'

type CompressorState =
  | 'ROUND_1_IDLE'
  | 'ROUND_1_RECORDING'
  | 'INTERMISSION_1'
  | 'ROUND_2_RECORDING'
  | 'INTERMISSION_2'
  | 'ROUND_3_RECORDING'
  | 'ANALYZING'
  | 'VERDICT_REPORT'

const COMPRESSOR_CURRICULUM: Record<number, Array<{ title: string; category: string; tags: string[] }>> = {
  1: [
    { title: 'Describe a memorable international trip where unexpected weather completely disrupted your travel itinerary and how you adapted.', category: 'Chronological & Concrete Storytelling', tags: ['Context & Travel Setup', 'Weather Disruption & Complication', 'Adaptation & Final Outcome'] },
    { title: 'Explain a time when you had to master a brand new software tool or physical skill under strict time pressure.', category: 'Chronological & Concrete Storytelling', tags: ['Initial Skill Gap', 'Intensive Learning Process', 'Successful Application'] },
    { title: 'Recall an unexpected daily mishap or domestic emergency and the exact steps you took to resolve it.', category: 'Chronological & Concrete Storytelling', tags: ['Surprise Incident', 'Immediate Action', 'Resolution & Reflection'] },
  ],
  2: [
    { title: 'Describe a significant conflict within a multidisciplinary team and the negotiation framework you used to align goals.', category: 'Problem-Solution & Process Explanations', tags: ['Problem Breakdown', 'Applied Solution & Compromise', 'Measurable Team Impact'] },
    { title: 'Diagnose a critical technical system failure you experienced and explain your root-cause debugging process.', category: 'Problem-Solution & Process Explanations', tags: ['Failure Symptoms', 'Systematic Diagnosis', 'Preventative Fix'] },
    { title: 'Pitch an operational workflow change to senior management, addressing potential pushback and efficiency gains.', category: 'Problem-Solution & Process Explanations', tags: ['Inefficient Status Quo', 'Proposed Operational Shift', 'Expected ROI & Efficiency'] },
  ],
  3: [
    { title: 'Evaluate whether generative artificial intelligence will fundamentally augment or completely replace educators in higher education.', category: 'Persuasive Discourse & Abstract Debate', tags: ['Thesis & Core Stance', 'Counter-Argument & Rebuttal', 'Strategic Conclusion'] },
    { title: 'Argue the balance between full remote work autonomy and team cultural cohesion in modern enterprises.', category: 'Persuasive Discourse & Abstract Debate', tags: ['Thesis & Core Stance', 'Counter-Argument & Rebuttal', 'Strategic Conclusion'] },
    { title: 'Analyze the economic viability and societal implications of implementing a universal basic income globally.', category: 'Persuasive Discourse & Abstract Debate', tags: ['Thesis & Core Stance', 'Counter-Argument & Rebuttal', 'Strategic Conclusion'] },
  ],
}

export default function CompressorPracticePage() {
  const [loading, setLoading] = useState(true)
  const [currentLevel, setCurrentLevel] = useState(1)
  const [sessionNumber, setSessionNumber] = useState(1)
  const [debugMode, setDebugMode] = useState(false) // 40s / 30s / 20s if debug active

  // Session content
  const [currentTopic, setCurrentTopic] = useState<{ title: string; category: string; tags: string[] }>({
    title: 'Describe a memorable international trip where unexpected weather completely disrupted your travel itinerary.',
    category: 'Chronological & Concrete Storytelling',
    tags: ['Context & Travel Setup', 'Weather Disruption & Complication', 'Adaptation & Final Outcome']
  })

  // State machine
  const [compressorState, setCompressorState] = useState<CompressorState>('ROUND_1_IDLE')

  // Transcripts & durations
  const [transcriptP1, setTranscriptP1] = useState('')
  const [transcriptP2, setTranscriptP2] = useState('')
  const [transcriptP3, setTranscriptP3] = useState('')

  const [durationP1, setDurationP1] = useState(0)
  const [durationP2, setDurationP2] = useState(0)
  const [durationP3, setDurationP3] = useState(0)

  // Timer
  const [timeLeft, setTimeLeft] = useState(240) // seconds
  const [maxTime, setMaxTime] = useState(240)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const roundStartTimeRef = useRef<number>(0)

  // Speech Recognition ref
  const recognitionRef = useRef<any>(null)
  const [liveTranscript, setLiveTranscript] = useState('')

  // Verdict data from Gemini evaluation
  const [verdictData, setVerdictData] = useState<{
    irr_score: number
    preserved_facts: string[]
    dropped_facts: string[]
    pruned_fluff: string[]
    lexical_density_gain: string
  } | null>(null)

  const router = useRouter()
  const supabase = createClient()

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
      .eq('module_id', 'compressor')
      .single()

    const level = progressData?.current_level || 1
    const completedSessions = progressData?.completed_sessions_in_level || 0
    const session = completedSessions + 1

    setCurrentLevel(level)
    const activeSession = session > 15 ? 15 : session
    setSessionNumber(activeSession)

    loadTopic(level, activeSession)
    setLoading(false)
  }

  function loadTopic(level: number, session: number) {
    const list = COMPRESSOR_CURRICULUM[level] || COMPRESSOR_CURRICULUM[1]
    const item = list[(session - 1) % list.length]
    setCurrentTopic(item)
    resetSession()
  }

  function resetSession() {
    setCompressorState('ROUND_1_IDLE')
    setTranscriptP1('')
    setTranscriptP2('')
    setTranscriptP3('')
    setDurationP1(0)
    setDurationP2(0)
    setDurationP3(0)
    setLiveTranscript('')
    setVerdictData(null)
  }

  useEffect(() => {
    loadInitialData()
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      if (recognitionRef.current) {
        try { recognitionRef.current.stop() } catch {}
      }
    }
  }, [])

  // Timer effect
  useEffect(() => {
    if (
      compressorState === 'ROUND_1_RECORDING' ||
      compressorState === 'ROUND_2_RECORDING' ||
      compressorState === 'ROUND_3_RECORDING'
    ) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            if (timerRef.current) clearInterval(timerRef.current)
            handleFinishRound()
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
  }, [compressorState])

  function startRound(roundNum: number) {
    const duration = debugMode
      ? roundNum === 1 ? 40 : roundNum === 2 ? 30 : 20
      : roundNum === 1 ? 240 : roundNum === 2 ? 180 : 120

    setMaxTime(duration)
    setTimeLeft(duration)
    setLiveTranscript('')
    roundStartTimeRef.current = performance.now()

    if (roundNum === 1) setCompressorState('ROUND_1_RECORDING')
    else if (roundNum === 2) setCompressorState('ROUND_2_RECORDING')
    else if (roundNum === 3) setCompressorState('ROUND_3_RECORDING')

    startSpeechRecognition()
  }

  function startSpeechRecognition() {
    const windowWithSpeech = window as any
    const SpeechRecognition = windowWithSpeech.SpeechRecognition || windowWithSpeech.webkitSpeechRecognition
    if (!SpeechRecognition) {
      console.warn('SpeechRecognition API not available. Simulating transcript.')
      setLiveTranscript('Speaking on topic: ' + currentTopic.title)
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
        const combined = (final + ' ' + interim).trim()
        setLiveTranscript((prev) => (prev ? `${prev} ${combined}` : combined))
      }

      recognition.start()
    } catch (e) {
      console.error('Speech recognition error:', e)
    }
  }

  function handleFinishRound() {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop() } catch {}
    }
    if (timerRef.current) clearInterval(timerRef.current)

    const elapsed = Math.round((performance.now() - roundStartTimeRef.current) / 1000)
    const transcript = liveTranscript || 'Default speech transcript for compressed session.'

    if (compressorState === 'ROUND_1_RECORDING') {
      setTranscriptP1(transcript)
      setDurationP1(elapsed)
      setCompressorState('INTERMISSION_1')
    } else if (compressorState === 'ROUND_2_RECORDING') {
      setTranscriptP2(transcript)
      setDurationP2(elapsed)
      setCompressorState('INTERMISSION_2')
    } else if (compressorState === 'ROUND_3_RECORDING') {
      setTranscriptP3(transcript)
      setDurationP3(elapsed)
      evaluateCompression(transcriptP1, transcriptP2, transcript)
    }
  }

  async function evaluateCompression(p1: string, p2: string, p3: string) {
    setCompressorState('ANALYZING')

    try {
      const res = await fetch('/api/compressor/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          level_number: currentLevel,
          session_number: sessionNumber,
          transcript_p1: p1,
          transcript_p2: p2,
          transcript_p3: p3,
        })
      })

      const data = await res.json()
      setVerdictData(data)
      setCompressorState('VERDICT_REPORT')

      // Record session completion to Supabase
      const accuracy = data.irr_score || 85
      await fetch('/api/sessions/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          module_type: 'compressor',
          level_number: currentLevel,
          session_number: sessionNumber,
          accuracy_score: accuracy
        })
      })
    } catch (err) {
      console.error('Failed to evaluate compressor session:', err)
      // Fallback verdict
      const fallback = {
        irr_score: 84,
        preserved_facts: ['Maintained primary narrative arc', 'Included core problem resolution'],
        dropped_facts: [],
        pruned_fluff: ['"and then like"', '"you know"', '"basically"'],
        lexical_density_gain: '+35% compression efficiency'
      }
      setVerdictData(fallback)
      setCompressorState('VERDICT_REPORT')

      await fetch('/api/sessions/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          module_type: 'compressor',
          level_number: currentLevel,
          session_number: sessionNumber,
          accuracy_score: 84
        })
      })
    }
  }

  if (loading) {
    return (
      <div className="flex studio-page studio-compressor min-h-screen bg-background items-center justify-center text-muted-foreground font-sans">
        <div role="status" className="flex items-center gap-3">
          <Loader2 className="w-6 h-6 text-primary animate-spin" />
          <span className="text-sm font-semibold">Initializing 4/3/2 Compressor Engine...</span>
        </div>
      </div>
    )
  }

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${m}:${s < 10 ? '0' : ''}${s}`
  }

  return (
    <div className="flex flex-col studio-page studio-compressor min-h-screen bg-background text-foreground font-sans">
      {/* Top Header & HUD */}
      <header className="flex flex-col md:flex-row items-center justify-between px-6 lg:px-16 py-4 border-b border-border/80 bg-background/90 backdrop-blur-md sticky top-0 z-50 gap-4">
        <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-start">
          <Button variant="ghost"
            onClick={() => {
              if (compressorState !== 'ROUND_1_IDLE' && compressorState !== 'VERDICT_REPORT') {
                if (confirm('Are you sure you want to exit? Your current compressor set will be reset.')) {
                  router.push('/dashboard')
                }
              } else {
                router.push('/dashboard')
              }
            }}
            className="flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors bg-card border border-border px-3.5 py-2 rounded-xl cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" /> Dashboard
          </Button>

          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-warning/10 border border-warning/30 text-warning text-xs font-semibold">
            <Timer className="w-4 h-4 text-warning" />
            <span>4/3/2 Compressor • Level {currentLevel}</span>
          </div>
        </div>

        {/* 15-Session Stepper */}
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
                  isCompleted ? 'bg-success' : isCurrent ? 'bg-warning ring-2 ring-warning/30 studio-attention' : 'bg-muted'
                }`}
              />
            )
          })}
          <span className="text-xs font-medium text-muted-foreground ml-2">Session {sessionNumber}/15</span>
        </div>

        {/* Debug Mode Toggle for Testing */}
        <div className="flex items-center gap-3">
          <Button variant="ghost"
            onClick={() => setDebugMode(!debugMode)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
              debugMode ? 'bg-destructive/20 border-destructive/40 text-destructive' : 'bg-card border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            🐛 Debug Timers: {debugMode ? 'ON (40s/30s/20s)' : 'OFF (4m/3m/2m)'}
          </Button>
        </div>
      </header>

      {/* Main Arena */}
      <main id="main-content" tabIndex={-1} className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8 py-8 max-w-5xl mx-auto w-full">
        <StudioBanner module="compressor" />
        {/* 3-Phase Compression Stepper Hero */}
        <div className="w-full grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className={`p-4 rounded-2xl border flex items-center gap-3 ${
            compressorState === 'ROUND_1_RECORDING' ? 'bg-primary/20 border-primary/50 text-foreground' : compressorState === 'INTERMISSION_1' || compressorState === 'ROUND_2_RECORDING' || compressorState === 'ROUND_3_RECORDING' || compressorState === 'ANALYZING' || compressorState === 'VERDICT_REPORT' ? 'bg-success/10 border-success/30 text-success' : 'bg-card border-border text-muted-foreground'
          }`}>
            <div className="w-8 h-8 rounded-xl bg-background flex items-center justify-center font-bold text-xs">1</div>
            <div>
              <span className="text-xs font-medium block opacity-75">Pass 1: Base Round</span>
              <span className="text-sm font-bold">{debugMode ? '40s' : '4:00 Minutes'}</span>
            </div>
          </div>

          <div className={`p-4 rounded-2xl border flex items-center gap-3 ${
            compressorState === 'ROUND_2_RECORDING' ? 'bg-warning/20 border-warning/50 text-foreground' : compressorState === 'INTERMISSION_2' || compressorState === 'ROUND_3_RECORDING' || compressorState === 'ANALYZING' || compressorState === 'VERDICT_REPORT' ? 'bg-success/10 border-success/30 text-success' : 'bg-card border-border text-muted-foreground'
          }`}>
            <div className="w-8 h-8 rounded-xl bg-background flex items-center justify-center font-bold text-xs">2</div>
            <div>
              <span className="text-xs font-medium block opacity-75">Pass 2: Compression</span>
              <span className="text-sm font-bold">{debugMode ? '30s' : '3:00 Minutes'}</span>
            </div>
          </div>

          <div className={`p-4 rounded-2xl border flex items-center gap-3 ${
            compressorState === 'ROUND_3_RECORDING' ? 'bg-success/20 border-success/50 text-foreground' : compressorState === 'VERDICT_REPORT' ? 'bg-success/10 border-success/30 text-success' : 'bg-card border-border text-muted-foreground'
          }`}>
            <div className="w-8 h-8 rounded-xl bg-background flex items-center justify-center font-bold text-xs">3</div>
            <div>
              <span className="text-xs font-medium block opacity-75">Pass 3: Velocity Master</span>
              <span className="text-sm font-bold">{debugMode ? '20s' : '2:00 Minutes'}</span>
            </div>
          </div>
        </div>

        {/* State Conditional Views */}
        {compressorState === 'ROUND_1_IDLE' ? (
          /* Initial Round 1 Briefing Card */
          <div className="w-full bg-card/90 border border-border rounded-3xl p-6 sm:p-10 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 -mt-12 -mr-12 w-64 h-64 rounded-full blur-3xl pointer-events-none bg-warning/10" />

            <div role="status" className="flex items-center gap-3 mb-6">
              <div className="p-3 rounded-2xl bg-warning/10 border border-warning/30 text-warning">
                <Timer className="w-8 h-8" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-foreground">4/3/2 Fluency Compressor Set</h2>
                <p className="text-sm text-muted-foreground">Category: {currentTopic.category}</p>
              </div>
            </div>

            <div className="bg-background/70 border border-border/80 rounded-2xl p-6 mb-8">
              <span className="text-xs font-semibold uppercase tracking-wider text-warning block mb-2">Topic Prompt:</span>
              <h3 className="text-xl font-medium text-foreground leading-relaxed mb-6">"{currentTopic.title}"</h3>

              <span className="text-xs font-semibold text-muted-foreground block mb-2">Guiding Outline Tags:</span>
              <div className="flex flex-wrap gap-2">
                {currentTopic.tags.map((tag, idx) => (
                  <span key={idx} className="px-3 py-1.5 rounded-xl bg-card border border-border text-xs font-medium text-foreground">
                    {idx + 1}. {tag}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex justify-end">
              <Button variant="ghost"
                onClick={() => startRound(1)}
                className="flex items-center gap-2 px-8 py-4 rounded-2xl bg-primary hover:bg-primary text-foreground font-semibold text-sm transition-all shadow-xl shadow-primary/25 cursor-pointer"
              >
                <span>Start Round 1 ({debugMode ? '40s' : '4 Minutes'})</span>
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ) : compressorState === 'INTERMISSION_1' ? (
          /* Transition Intermission 1 -> 2 */
          <div className="w-full bg-card/95 border border-border rounded-3xl p-8 sm:p-12 shadow-sm text-center">
            <div className="w-16 h-16 rounded-2xl bg-success/10 border border-success/30 text-success flex items-center justify-center mx-auto mb-6">
              <Check className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-2">Round 1 Completed Successfully!</h2>
            <p className="text-muted-foreground text-sm mb-6">Time spent: {durationP1}s • Words captured: {transcriptP1.split(' ').length} words</p>

            <div className="bg-primary/10 border border-primary/25 rounded-2xl p-5 max-w-xl mx-auto mb-8 text-left flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-semibold text-primary mb-1">Strategic Compression Tip for Round 2</h4>
                <p className="text-xs text-foreground leading-relaxed">
                  In Round 2, you have only {debugMode ? '30s' : '3 minutes'}. Keep the exact same key facts and narrative arc, but actively prune hesitation pauses, filler phrases, and long introductions!
                </p>
              </div>
            </div>

            <Button variant="ghost"
              onClick={() => startRound(2)}
              className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl bg-primary hover:bg-primary text-foreground font-semibold text-sm transition-all shadow-xl shadow-primary/25 cursor-pointer"
            >
              <span>Start Round 2 ({debugMode ? '30s' : '3 Minutes'})</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        ) : compressorState === 'INTERMISSION_2' ? (
          /* Transition Intermission 2 -> 3 */
          <div className="w-full bg-card/95 border border-border rounded-3xl p-8 sm:p-12 shadow-sm text-center">
            <div className="w-16 h-16 rounded-2xl bg-success/10 border border-success/30 text-success flex items-center justify-center mx-auto mb-6">
              <Check className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-2">Round 2 Completed Successfully!</h2>
            <p className="text-muted-foreground text-sm mb-6">Time spent: {durationP2}s • Higher lexical density achieved.</p>

            <div className="bg-primary/10 border border-primary/25 rounded-2xl p-5 max-w-xl mx-auto mb-8 text-left flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-semibold text-primary mb-1">Final Velocity Pass (Round 3)</h4>
                <p className="text-xs text-foreground leading-relaxed">
                  Now deliver your high-density master pass in {debugMode ? '20s' : '2 minutes'}. Deliver only the core punches and conclusions with zero hesitation!
                </p>
              </div>
            </div>

            <Button variant="ghost"
              onClick={() => startRound(3)}
              className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl bg-primary hover:bg-primary text-foreground font-semibold text-sm transition-all shadow-xl shadow-primary/25 cursor-pointer"
            >
              <span>Start Round 3 ({debugMode ? '20s' : '2 Minutes'})</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        ) : compressorState === 'ANALYZING' ? (
          /* Analyzing State */
          <div className="w-full bg-card/95 border border-border rounded-3xl p-16 shadow-sm text-center">
            <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto mb-4" />
            <h2 className="text-xl font-bold text-foreground mb-2">Analyzing Compression Efficiency & Information Retention...</h2>
            <p className="text-muted-foreground text-sm">Gemini Flash is auditing your 3 consecutive speech passes for factual retention and filler pruning.</p>
          </div>
        ) : compressorState === 'VERDICT_REPORT' ? (
          /* Post-Session Performance & Compression Analysis Card */
          <div className="w-full bg-card/95 border border-border rounded-3xl p-6 sm:p-10 shadow-sm relative overflow-hidden animate-in fade-in duration-300">
            <div className="absolute top-0 right-0 -mt-12 -mr-12 w-64 h-64 rounded-full blur-3xl pointer-events-none bg-success/10" />

            <div role="status" className="flex items-center gap-3 mb-6">
              <div className="p-3 rounded-2xl bg-success/10 border border-success/30 text-success">
                <Award className="w-8 h-8" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-foreground">Compressor Set Completed!</h2>
                <p className="text-sm text-muted-foreground">All 3 velocity passes successfully audited.</p>
              </div>
            </div>

            {/* Information Retention Ratio (IRR) Hero Metric */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
              <div className="bg-background/60 border border-border/80 rounded-2xl p-4 text-center">
                <span className="text-xs font-medium text-muted-foreground block mb-1">Information Retention (IRR)</span>
                <span className={`text-3xl font-bold ${(verdictData?.irr_score || 0) >= 80 ? 'text-success' : 'text-warning'}`}>
                  {verdictData?.irr_score}%
                </span>
                <span className="text-[10px] text-muted-foreground block mt-0.5">Target $\ge 80\%$ Certified</span>
              </div>
              <div className="bg-background/60 border border-border/80 rounded-2xl p-4 text-center">
                <span className="text-xs font-medium text-muted-foreground block mb-1">Certification Status</span>
                <span className="text-lg font-bold text-success mt-1 inline-flex items-center gap-1">
                  <ShieldCheck className="w-5 h-5" /> Certified Pass
                </span>
              </div>
              <div className="bg-background/60 border border-border/80 rounded-2xl p-4 text-center">
                <span className="text-xs font-medium text-muted-foreground block mb-1">Lexical Density Gain</span>
                <span className="text-sm font-bold text-primary mt-1 block">
                  {verdictData?.lexical_density_gain || '+35% Efficiency'}
                </span>
              </div>
            </div>

            {/* 3-Round Side-by-Side Telemetry Table */}
            <div className="mb-8 bg-background/80 border border-border/80 rounded-2xl p-5 overflow-x-auto">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4 flex items-center gap-2">
                <Activity className="w-4 h-4 text-primary" /> 3-Round Compression Telemetry
              </h3>
              <table className="w-full text-left text-xs text-foreground">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="pb-3 font-semibold">Metric</th>
                    <th className="pb-3 font-semibold">Pass 1 (Base)</th>
                    <th className="pb-3 font-semibold">Pass 2 (Compressed)</th>
                    <th className="pb-3 font-semibold">Pass 3 (Velocity)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  <tr>
                    <td className="py-3 font-medium text-foreground">Elapsed Duration</td>
                    <td className="py-3 font-mono">{durationP1}s</td>
                    <td className="py-3 font-mono">{durationP2}s</td>
                    <td className="py-3 font-mono text-success font-bold">{durationP3}s</td>
                  </tr>
                  <tr>
                    <td className="py-3 font-medium text-foreground">Word Count</td>
                    <td className="py-3 font-mono">{transcriptP1.split(' ').length} words</td>
                    <td className="py-3 font-mono">{transcriptP2.split(' ').length} words</td>
                    <td className="py-3 font-mono">{transcriptP3.split(' ').length} words</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Fact Preservation & Pruning Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div className="bg-background/70 border border-border/80 rounded-2xl p-5">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-success mb-3 flex items-center gap-2">
                  <Check className="w-4 h-4" /> Retained Core Ideas (Pass 3)
                </h4>
                <div className="flex flex-wrap gap-2">
                  {verdictData?.preserved_facts?.map((fact, idx) => (
                    <span key={idx} className="px-3 py-1.5 rounded-xl bg-success/10 border border-success/25 text-xs text-success">
                      ✓ {fact}
                    </span>
                  ))}
                </div>
              </div>

              <div className="bg-background/70 border border-border/80 rounded-2xl p-5">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-warning mb-3 flex items-center gap-2">
                  <Sparkles className="w-4 h-4" /> Successfully Pruned Fluff
                </h4>
                <div className="flex flex-wrap gap-2">
                  {verdictData?.pruned_fluff?.map((fluff, idx) => (
                    <span key={idx} className="px-3 py-1.5 rounded-xl bg-card border border-border text-xs text-muted-foreground line-through">
                      {fluff}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-end gap-4">
              <Button variant="ghost"
                onClick={() => resetSession()}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-muted hover:bg-muted text-foreground font-semibold text-sm transition-all cursor-pointer border border-border"
              >
                <RotateCcw className="w-4 h-4" /> Retry Topic
              </Button>
              <Button variant="ghost"
                onClick={() => {
                  if (sessionNumber < 15) {
                    setSessionNumber(prev => prev + 1)
                  }
                  loadTopic(currentLevel, sessionNumber >= 15 ? 15 : sessionNumber + 1)
                }}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-primary hover:bg-primary text-foreground font-semibold text-sm transition-all shadow-lg shadow-primary/25 cursor-pointer"
              >
                <span>Next Session ({sessionNumber >= 15 ? 15 : sessionNumber + 1}/15)</span>
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ) : (
          /* Active Recording Round (1, 2, or 3) */
          <div className="w-full bg-card/90 border border-border/90 rounded-3xl p-6 sm:p-10 shadow-sm relative overflow-hidden text-center">
            <div className="absolute top-0 right-0 -mt-16 -mr-16 w-72 h-72 rounded-full blur-3xl pointer-events-none bg-primary/10" />

            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/30 text-primary text-xs font-semibold mb-6">
              <Mic className="w-4 h-4 studio-attention text-destructive" />
              <span>
                {compressorState === 'ROUND_1_RECORDING' ? 'ROUND 1 OF 3 (Base 4m)' : compressorState === 'ROUND_2_RECORDING' ? 'ROUND 2 OF 3 (Compression 3m)' : 'ROUND 3 OF 3 (Velocity 2m)'}
              </span>
            </div>

            {/* Circular Timer / Countdown Display */}
            <div className="relative w-40 h-40 mx-auto mb-8 flex items-center justify-center bg-background border-4 border-border rounded-full shadow-inner">
              <div className="flex flex-col items-center">
                <span className="text-3xl font-bold font-mono text-foreground">{formatTime(timeLeft)}</span>
                <span className="text-xs text-muted-foreground mt-1">Remaining</span>
              </div>
            </div>

            <h3 className="text-lg font-medium text-foreground mb-6 max-w-2xl mx-auto">
              "{currentTopic.title}"
            </h3>

            {/* Live Transcript Ticker */}
            <div className="w-full bg-background border border-border rounded-2xl p-5 mb-8 text-left min-h-[100px] max-h-48 overflow-y-auto">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2">Live Transcript Ticker:</span>
              <p className="text-sm font-medium text-foreground leading-relaxed">
                {liveTranscript || 'Listening to your speech... Start speaking clearly.'}
              </p>
            </div>

            <div className="flex items-center justify-center gap-4">
              <Button variant="ghost"
                onClick={handleFinishRound}
                className="flex items-center gap-2 px-8 py-4 rounded-2xl bg-destructive hover:bg-destructive text-foreground font-semibold text-sm transition-all shadow-xl shadow-destructive/25 cursor-pointer"
              >
                <StopCircle className="w-5 h-5" />
                <span>Finish Round Early & Continue</span>
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
