'use client'

import { Button } from '@/components/ui/button'
import { StudioBanner } from '@/components/shared/studio-banner'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/src/lib/supabase/client'
import EchoShadowingStudio from '@/components/modules/EchoShadowingStudio'
import { ArrowLeft, Loader2, ShieldCheck } from 'lucide-react'

interface CurriculumPrompt {
  text: string
  cefr: string
  source: string
}

export default function ShadowingPracticePage() {
  const [loading, setLoading] = useState(true)
  const [currentLevel, setCurrentLevel] = useState(1)
  const [sessionNumber, setSessionNumber] = useState(1)
  const [sentenceData, setSentenceData] = useState<CurriculumPrompt | null>(null)
  const [referenceAudioUrl, setReferenceAudioUrl] = useState<string | null>(null)
  const [useBrowserTtsFallback, setUseBrowserTtsFallback] = useState(false)
  const [fetchingPrompt, setFetchingPrompt] = useState(false)

  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const audioUrlRef = useRef<string | null>(null)
  const promptRequestRef = useRef(0)

  async function loadInitialData(isCancelled: () => boolean) {
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (isCancelled()) return
    if (userError || !user) {
      router.push('/signup')
      return
    }

    // Fetch module progress for shadowing
    const { data: progressData } = await supabase
      .from('module_progress')
      .select('*')
      .eq('user_id', user.id)
      .eq('module_id', 'shadowing')
      .single()
    if (isCancelled()) return

    const level = progressData?.current_level || 1
    const completedSessions = progressData?.completed_sessions_in_level || 0
    const session = completedSessions + 1

    setCurrentLevel(level)
    setSessionNumber(session > 15 ? 15 : session)

    await fetchRandomPromptAndTTS(level)
  }

  const fetchRandomPromptAndTTS = useCallback(async (level: number) => {
    const requestId = ++promptRequestRef.current
    setFetchingPrompt(true)
    try {
      const res = await fetch(`/api/curriculum/random?level=${level}`)
      if (!res.ok) throw new Error('Unable to load a curriculum prompt')
      const sentence: CurriculumPrompt = await res.json()
      if (requestId !== promptRequestRef.current) return
      setSentenceData(sentence)

      const ttsRes = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: sentence.text }),
      })

      if (!ttsRes.ok) throw new Error('Unable to synthesize reference audio')
      const audioBuffer = await ttsRes.arrayBuffer()
      if (requestId !== promptRequestRef.current) return
      const audioBlob = new Blob([audioBuffer], {
        type: ttsRes.headers.get('content-type') || 'audio/wav',
      })
      const audioUrl = URL.createObjectURL(audioBlob)
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current)
      audioUrlRef.current = audioUrl
      setReferenceAudioUrl(audioUrl)
      setUseBrowserTtsFallback(ttsRes.headers.get('x-tts-fallback') === 'web-speech')
    } catch (err) {
      if (requestId !== promptRequestRef.current) return
      console.error('Error fetching curriculum prompt or TTS:', err)
      setSentenceData((current) => current || {
        text: 'Maya visits the library before lunch. She returns two books, greets the librarian, and asks for a story about her town. Then she finds a quiet chair beside the window, opens the book, and reads carefully while rain taps against the glass.',
        cefr: 'A2',
        source: 'client_fallback',
      })
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current)
      audioUrlRef.current = null
      setReferenceAudioUrl(null)
      setUseBrowserTtsFallback(true)
    } finally {
      if (requestId === promptRequestRef.current) {
        setFetchingPrompt(false)
        setLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    loadInitialData(() => cancelled)
    return () => {
      cancelled = true
      promptRequestRef.current += 1
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current)
    }
  }, [router, supabase, fetchRandomPromptAndTTS])

  const handleCompleteSession = async (accuracy: number) => {
    if (accuracy < 75) return

    try {
      const res = await fetch('/api/sessions/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          module_type: 'shadowing',
          level_number: currentLevel,
          session_number: sessionNumber,
          accuracy_score: accuracy,
        }),
      })

      const data = await res.json()
      if (res.ok) {
        if (data.level_unlocked) {
          setCurrentLevel(data.current_level)
          setSessionNumber(1)
        } else if (sessionNumber < 15) {
          setSessionNumber((prev) => prev + 1)
        }

        await fetchRandomPromptAndTTS(data.current_level || currentLevel)
      } else {
        alert(data.error || 'Failed to complete session')
      }
    } catch (err) {
      console.error('Error completing session:', err)
      alert('Network error while completing session')
    }
  }

  if (loading || fetchingPrompt) {
    return (
      <div className="flex studio-page studio-shadowing min-h-screen bg-background items-center justify-center text-muted-foreground font-sans">
        <div role="status" className="flex items-center gap-3">
          <Loader2 className="w-6 h-6 text-primary animate-spin" />
          <span className="text-sm font-semibold">Loading curriculum prompt & synthesizing TTS audio...</span>
        </div>
      </div>
    )
  }

  const levelTitle =
    currentLevel === 1
      ? 'Subtitled Mirror'
      : currentLevel === 2
      ? 'Vanishing Text'
      : 'Cadence Lock'

  return (
    <div className="flex flex-col studio-page studio-shadowing min-h-screen bg-background text-foreground font-sans">
      {/* Top Navigation / Status Bar (Session HUD) */}
      <header className="flex flex-col md:flex-row items-center justify-between px-6 lg:px-16 py-4 border-b border-border/80 bg-background/90 backdrop-blur-md sticky top-0 z-50 gap-4">
        {/* Left: Back Navigation */}
        <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-start">
          <Button variant="ghost"
            onClick={() => router.push('/dashboard')}
            className="flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors bg-card border border-border px-3.5 py-2 rounded-xl cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" /> Dashboard
          </Button>

          {/* Target Threshold Badge */}
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-success/10 border border-success/25 text-success text-xs font-semibold">
            <ShieldCheck className="w-3.5 h-3.5" /> Passing Threshold: ≥ 75% Accuracy
          </div>
        </div>

        {/* Center: Current Curriculum Tracking Badge */}
        <div className="hidden lg:flex items-center gap-2 px-4 py-1.5 rounded-2xl bg-card border border-border text-xs font-medium text-foreground">
          <span className="text-primary font-bold">Module: Echo-Shadowing</span>
          <span className="text-muted-foreground">•</span>
          <span>Level {currentLevel}: {levelTitle}</span>
        </div>

        {/* Right: Progress Chip & Step Progress Indicator */}
        <div className="flex items-center gap-4 w-full md:w-auto justify-end">
          <div className="flex flex-col items-end">
            <span className="text-xs font-bold text-foreground">
              Session {sessionNumber} of 15
            </span>
            {/* Mini step-progress indicator */}
            <div className="flex items-center gap-1 mt-1">
              {Array.from({ length: 15 }, (_, i) => i + 1).map((num) => (
                <div
                  key={num}
                  className={`h-1.5 rounded-full transition-all ${
                    num < sessionNumber
                      ? 'w-2 bg-success'
                      : num === sessionNumber
                      ? 'w-4 bg-primary'
                      : 'w-1.5 bg-muted'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* Main Studio View */}
      <main id="main-content" tabIndex={-1} className="flex-1 px-6 py-12 max-w-5xl mx-auto w-full flex flex-col items-stretch justify-center">
        <StudioBanner module="shadowing" />
        {sentenceData && (
          <EchoShadowingStudio
            sentenceData={sentenceData}
            levelNumber={currentLevel}
            sessionNumber={sessionNumber}
            referenceAudioUrl={referenceAudioUrl}
            useBrowserTtsFallback={useBrowserTtsFallback}
            onNextSession={(acc) => handleCompleteSession(acc)}
          />
        )}
      </main>
    </div>
  )
}
