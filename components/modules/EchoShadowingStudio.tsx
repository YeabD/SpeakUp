'use client'

import { Button } from '@/components/ui/button'
import { VoiceIcon as Mic } from '@/components/icons/studio-icons'

import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, ArrowRight, Check, Headphones, Loader2, Play, Radio, RotateCcw, VolumeX } from 'lucide-react'

interface Props {
  sentenceData: { text: string; cefr: string; source: string }
  levelNumber: number
  sessionNumber: number
  referenceAudioUrl: string | null
  useBrowserTtsFallback: boolean
  onNextSession: (accuracy: number) => void
}
type Verdict = 'passed' | 'failed' | null
type WordDiff = { word: string; heard?: string; similarity: number; status: 'correct' | 'mispronounced' | 'omitted' }
type MispronouncedWord = { target: string; heard: string }

const normalize = (word: string) => word.toLowerCase().replace(/[^a-z0-9']/g, '').replace(/^'|'$/g, '')

function distance(left: string, right: string) {
  const row = Array.from({ length: right.length + 1 }, (_, index) => index)
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    let diagonal = row[0]
    row[0] = leftIndex
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const above = row[rightIndex]
      row[rightIndex] = Math.min(
        row[rightIndex] + 1,
        row[rightIndex - 1] + 1,
        diagonal + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1)
      )
      diagonal = above
    }
  }
  return row[right.length]
}

function phonetic(word: string) {
  const clean = normalize(word)
    .replace(/ph/g, 'f').replace(/ght/g, 't').replace(/sh/g, 's')
    .replace(/ch/g, 'c').replace(/[cq]/g, 'k').replace(/x/g, 'ks')
  if (!clean) return ''
  return (clean[0] + clean.slice(1).replace(/[aeiouy]/g, '').replace(/(.)\1+/g, '$1')).slice(0, 8)
}

function similarity(target: string, heard: string) {
  if (target === heard) return 1
  const lexical = 1 - distance(target, heard) / Math.max(target.length, heard.length, 1)
  const targetSound = phonetic(target)
  const heardSound = phonetic(heard)
  const sound = 1 - distance(targetSound, heardSound) / Math.max(targetSound.length, heardSound.length, 1)
  return Math.max(0, Math.min(1, Math.max(lexical, sound * 0.92)))
}

function evaluateSpeech(targetText: string, transcript: string, duration: number) {
  const originals = targetText.trim().split(/\s+/)
  const targets = originals.map(normalize).filter(Boolean)
  const spoken = transcript.trim().split(/\s+/).map(normalize).filter(Boolean)
  const wordDiff: WordDiff[] = []
  let cursor = 0, exactMatches = 0, pronunciationTotal = 0

  targets.forEach((target, targetIndex) => {
    let best = { score: 0, heard: '', start: cursor, width: 1 }
    for (let start = cursor; start < Math.min(spoken.length, cursor + 3); start += 1) {
      for (let width = 1; width <= 2 && start + width <= spoken.length; width += 1) {
        const heardWords = spoken.slice(start, start + width)
        const candidateScore = similarity(target, heardWords.join(''))
        if (candidateScore > best.score) best = { score: candidateScore, heard: heardWords.join(' '), start, width }
      }
    }
    if (best.score < 0.42) {
      wordDiff.push({ word: originals[targetIndex], similarity: 0, status: 'omitted' })
      return
    }
    cursor = best.start + best.width
    pronunciationTotal += best.score
    if (target === best.heard.replace(/\s/g, '')) exactMatches += 1
    wordDiff.push({
      word: originals[targetIndex], heard: best.heard, similarity: best.score,
      status: best.score >= 0.85 ? 'correct' : 'mispronounced',
    })
  })

  const coverage = targets.length ? exactMatches / targets.length : 0
  const pronunciation = targets.length ? pronunciationTotal / targets.length : 0
  const score = Math.round((coverage * 0.6 + pronunciation * 0.4) * 100)
  const enoughWords = spoken.length >= Math.ceil(targets.length * 0.3)
  const eligible = Boolean(transcript.trim()) && enoughWords && duration >= 3
  return { score, passed: eligible && score >= 75, wordDiff, coverage, pronunciation, enoughWords }
}

export default function EchoShadowingStudio({
  sentenceData, levelNumber, sessionNumber, referenceAudioUrl, useBrowserTtsFallback, onNextSession,
}: Props) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [audioProgress, setAudioProgress] = useState(0)
  const [activeWordIndex, setActiveWordIndex] = useState<number | null>(null)
  const [countdown, setCountdown] = useState(5)
  const [isTextVanished, setIsTextVanished] = useState(levelNumber >= 2)
  const [isPreparingRecording, setIsPreparingRecording] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const [liveTranscript, setLiveTranscript] = useState('')
  const [micBlocked, setMicBlocked] = useState(false)
  const [evaluating, setEvaluating] = useState(false)
  const [score, setScore] = useState<number | null>(null)
  const [verdict, setVerdict] = useState<Verdict>(null)
  const [wordDiff, setWordDiff] = useState<WordDiff[]>([])
  const [missedWords, setMissedWords] = useState<string[]>([])
  const [mispronouncedWords, setMispronouncedWords] = useState<MispronouncedWord[]>([])
  const [failureReason, setFailureReason] = useState('')
  const [volumeHeights, setVolumeHeights] = useState<number[]>(Array(24).fill(8))

  const words = sentenceData.text.trim().split(/\s+/)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const recognitionRef = useRef<any>(null)
  const transcriptRef = useRef('')
  const startedAtRef = useRef(0)
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const visualizerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    setIsPlaying(false); setAudioProgress(0); setActiveWordIndex(null)
    setIsRecording(false); setRecordingSeconds(0); setLiveTranscript('')
    setScore(null); setVerdict(null); setWordDiff([])
    setMissedWords([]); setMispronouncedWords([]); setFailureReason('')
    transcriptRef.current = ''

    if (levelNumber === 1) {
      setIsTextVanished(false)
    } else if (levelNumber === 2) {
      setIsTextVanished(false)
      setCountdown(5)
      countdownRef.current = setInterval(() => {
        setCountdown(previous => {
          if (previous <= 1) {
            if (countdownRef.current) clearInterval(countdownRef.current)
            setIsTextVanished(true)
            return 0
          }
          return previous - 1
        })
      }, 1000)
    } else {
      setIsTextVanished(true)
    }

    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current)
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current)
      if (visualizerRef.current) clearInterval(visualizerRef.current)
      audioRef.current?.pause()
      window.speechSynthesis?.cancel()
      try { recognitionRef.current?.stop() } catch {}
      if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
      streamRef.current?.getTracks().forEach(track => track.stop())
    }
  }, [sentenceData, levelNumber])

  function resetAttempt() {
    setScore(null); setVerdict(null); setWordDiff([])
    setMissedWords([]); setMispronouncedWords([]); setFailureReason('')
    setLiveTranscript(''); setRecordingSeconds(0)
    transcriptRef.current = ''
  }

  function finishPlayback() {
    setIsPlaying(false)
    setActiveWordIndex(null)
  }

  async function handlePlayReference() {
    if (isRecording || isPlaying) return
    setAudioProgress(0)
    setActiveWordIndex(0)

    if (useBrowserTtsFallback || !referenceAudioUrl) {
      if (!('speechSynthesis' in window)) return finishPlayback()
      window.speechSynthesis.cancel()
      const utterance = new SpeechSynthesisUtterance(sentenceData.text)
      utterance.lang = 'en-US'
      utterance.rate = levelNumber === 1 ? 0.85 : 1
      utterance.onboundary = event => {
        const spokenPrefix = sentenceData.text.slice(0, event.charIndex)
        const index = Math.max(0, spokenPrefix.trim().split(/\s+/).length - 1)
        setActiveWordIndex(Math.min(words.length - 1, index))
        setAudioProgress(Math.round((event.charIndex / sentenceData.text.length) * 100))
      }
      utterance.onend = () => { setAudioProgress(100); finishPlayback() }
      utterance.onerror = finishPlayback
      setIsPlaying(true)
      window.speechSynthesis.speak(utterance)
      return
    }

    const audio = audioRef.current || new Audio()
    audioRef.current = audio
    audio.pause()
    audio.src = referenceAudioUrl
    audio.currentTime = 0
    audio.playbackRate = levelNumber === 1 ? 0.85 : 1
    audio.ontimeupdate = () => {
      if (!Number.isFinite(audio.duration) || audio.duration <= 0) return
      const progress = audio.currentTime / audio.duration
      setAudioProgress(progress * 100)
      setActiveWordIndex(Math.min(words.length - 1, Math.floor(progress * words.length)))
    }
    audio.onended = () => { setAudioProgress(100); finishPlayback() }
    audio.onerror = finishPlayback
    setIsPlaying(true)
    try {
      await audio.play()
    } catch (error) {
      console.error('Reference audio playback failed:', error)
      finishPlayback()
    }
  }

  async function handleStartRecording() {
    if (isPlaying || isRecording || isPreparingRecording) return
    resetAttempt()
    setMicBlocked(false)
    setIsPreparingRecording(true)
    try {
      if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
        throw new Error('Audio recording is not supported by this browser')
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      chunksRef.current = []
      const preferredType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : ''
      const recorder = new MediaRecorder(stream, preferredType ? { mimeType: preferredType } : undefined)
      recorderRef.current = recorder
      recorder.ondataavailable = event => {
        if (event.data.size > 0) chunksRef.current.push(event.data)
      }
      recorder.start(250)

      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition()
        recognitionRef.current = recognition
        recognition.continuous = true
        recognition.interimResults = true
        recognition.lang = 'en-US'
        recognition.onresult = (event: any) => {
          let transcript = ''
          for (let index = 0; index < event.results.length; index += 1) {
            transcript += `${event.results[index][0].transcript} `
          }
          transcriptRef.current = transcript.trim()
          setLiveTranscript(transcriptRef.current)
        }
        recognition.onerror = (event: any) => {
          if (event.error === 'not-allowed') setMicBlocked(true)
        }
        recognition.start()
      }

      startedAtRef.current = Date.now()
      setRecordingSeconds(0)
      setIsRecording(true)
      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds(Math.floor((Date.now() - startedAtRef.current) / 1000))
      }, 250)
      visualizerRef.current = setInterval(() => {
        setVolumeHeights(Array.from({ length: 24 }, () => Math.floor(Math.random() * 36) + 8))
      }, 120)
    } catch (error) {
      console.error('Microphone initialization failed:', error)
      setMicBlocked(true)
      streamRef.current?.getTracks().forEach(track => track.stop())
    } finally {
      setIsPreparingRecording(false)
    }
  }

  function stopRecorder() {
    const recorder = recorderRef.current
    if (!recorder || recorder.state === 'inactive') {
      return Promise.resolve(new Blob(chunksRef.current, { type: recorder?.mimeType || 'audio/webm' }))
    }
    return new Promise<Blob>(resolve => {
      recorder.onstop = () => resolve(new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' }))
      recorder.stop()
    })
  }

  async function handleStopRecording() {
    if (!isRecording || evaluating) return
    const duration = (Date.now() - startedAtRef.current) / 1000
    setIsRecording(false)
    setRecordingSeconds(Math.floor(duration))
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current)
    if (visualizerRef.current) clearInterval(visualizerRef.current)
    setVolumeHeights(Array(24).fill(8))
    try { recognitionRef.current?.stop() } catch {}

    setEvaluating(true)
    const audio = await stopRecorder()
    streamRef.current?.getTracks().forEach(track => track.stop())

    let transcript = transcriptRef.current.trim()
    if (duration >= 3 && audio.size > 0) {
      try {
        const data = new FormData()
        data.append('audio', audio, 'shadowing.webm')
        const response = await fetch('/api/stt', { method: 'POST', body: data })
        if (response.ok) {
          const result = await response.json()
          if (typeof result.transcript === 'string') transcript = result.transcript.trim()
        } else {
          console.warn('Speechmatics STT unavailable; using browser transcript fallback')
          transcript = transcriptRef.current.trim()
        }
      } catch (error) {
        console.error('Speech transcription failed:', error)
        transcript = transcriptRef.current.trim()
      }
    }

    setLiveTranscript(transcript)
    transcriptRef.current = transcript
    const result = evaluateSpeech(sentenceData.text, transcript, duration)
    setScore(result.score)
    setVerdict(result.passed ? 'passed' : 'failed')
    setWordDiff(result.wordDiff)
    setMissedWords(result.wordDiff.filter(item => item.status === 'omitted').map(item => item.word))
    setMispronouncedWords(result.wordDiff
      .filter(item => item.status === 'mispronounced')
      .map(item => ({ target: item.word, heard: item.heard || '' })))

    if (duration < 3) setFailureReason('Record for at least 3 seconds before submitting.')
    else if (!transcript) setFailureReason('No speech was detected. Please record the full passage.')
    else if (!result.enoughWords) setFailureReason('Fewer than 30% of the target words were detected.')
    else if (!result.passed) setFailureReason('The combined coverage and pronunciation score must reach 75%.')
    else setFailureReason('')
    setEvaluating(false)
  }

  function handleNext() {
    if (verdict === 'passed' && score !== null && score >= 75) onNextSession(score)
  }

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {micBlocked && (
        <div className="p-4 rounded-2xl bg-destructive/10 border border-destructive/30 text-destructive text-xs flex items-center gap-3">
          <VolumeX className="w-5 h-5 shrink-0" />
          Microphone access is unavailable. Enable it and retry in a supported browser.
        </div>
      )}

      <div className="bg-card/90 border border-border rounded-3xl p-6 sm:p-10 shadow-sm">
        <div className="flex items-center justify-between mb-8 pb-4 border-b border-border">
          <div role="status" className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center text-primary">
              <Headphones className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[11px] font-bold text-primary uppercase tracking-widest block">
                {levelNumber === 1 ? 'Subtitled Mirror' : levelNumber === 2 ? 'Vanishing Text' : 'Cadence Lock'}
              </span>
              <span className="text-xs text-muted-foreground">CEFR {sentenceData.cefr} - Session {sessionNumber} of 15</span>
            </div>
          </div>
          <span className="text-xs font-bold text-success">Pass at 75%</span>
        </div>

        <div className="mb-8 p-6 sm:p-8 rounded-2xl bg-background border border-border min-h-40 flex items-center justify-center text-center">
          {levelNumber === 1 && (
            <p className="text-xl sm:text-2xl font-medium leading-relaxed">
              {words.map((word, index) => (
                <span key={index} className={`inline-block mr-2 ${isPlaying && activeWordIndex !== null && index <= activeWordIndex ? 'text-primary font-bold' : 'text-foreground'}`}>
                  {word}
                </span>
              ))}
            </p>
          )}
          {levelNumber === 2 && (!isTextVanished ? (
            <div className="space-y-4">
              <span className="inline-flex px-3 py-1 rounded-full bg-warning/10 border border-warning/25 text-warning text-xs font-bold">
                Memorize text: {countdown}s
              </span>
              <p className="text-xl sm:text-2xl leading-relaxed text-foreground">{sentenceData.text}</p>
            </div>
          ) : (
            <div className="space-y-3 text-foreground"><Headphones className="w-8 h-8 mx-auto text-primary" /><p>Audio only: retain and shadow.</p></div>
          ))}
          {levelNumber >= 3 && (
            <div className="space-y-3 text-foreground"><Radio className="w-9 h-9 mx-auto text-primary studio-attention" /><p>Pure auditory shadowing - cadence lock active.</p></div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <Button variant="ghost"
            onClick={handlePlayReference}
            disabled={isPlaying || isRecording || isPreparingRecording}
            className="flex items-center justify-center gap-3 bg-primary disabled:bg-muted disabled:text-muted-foreground text-foreground font-semibold py-4 px-6 rounded-2xl"
          >
            {isPlaying ? <Radio className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
            {isPlaying ? `Playing reference (${Math.round(audioProgress)}%)` : 'Play native prompt'}
          </Button>
          <Button variant="ghost"
            onClick={isRecording ? handleStopRecording : handleStartRecording}
            disabled={isPlaying || evaluating || isPreparingRecording}
            className={`flex items-center justify-center gap-3 text-foreground font-semibold py-4 px-6 rounded-2xl disabled:bg-muted disabled:text-muted-foreground ${isRecording ? 'bg-destructive' : 'bg-destructive'}`}
          >
            {isPreparingRecording ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mic active={isRecording} className="w-4 h-4" />}
            {isPreparingRecording ? 'Opening microphone...' : isRecording ? `Stop and evaluate (${recordingSeconds}s)` : 'Record and shadow'}
          </Button>
        </div>

        <div className="p-5 rounded-2xl bg-background border border-border space-y-4">
          <div className="flex justify-between text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            <span>{isRecording ? 'Live speech stream' : 'Transcript'}</span>
            <span>{isRecording ? 'REC - ACTIVE' : 'IDLE'}</span>
          </div>
          <div className="min-h-11 p-3 rounded-xl bg-card text-sm text-foreground font-mono">
            {liveTranscript || (isRecording ? 'Listening for speech...' : 'Your transcript will appear here.')}
          </div>
          <div className="flex items-center gap-1 h-8 overflow-hidden">
            {volumeHeights.map((height, index) => (
              <div key={index} style={{ height: `${isRecording ? height : 6}px` }} className="w-full rounded-full bg-gradient-to-t from-destructive to-primary" />
            ))}
          </div>
        </div>

        {evaluating && (
          <div className="mt-6 p-5 rounded-2xl bg-background border border-border text-center text-sm text-foreground">
            <Loader2 className="w-6 h-6 text-primary animate-spin mx-auto mb-2" />
            Transcribing and evaluating coverage and pronunciation...
          </div>
        )}

        {verdict && score !== null && !evaluating && (
          <div className="mt-6 p-6 rounded-3xl bg-background border border-border space-y-6">
            <div className="flex flex-col sm:flex-row justify-between gap-5 pb-5 border-b border-border">
              <div className="flex items-center gap-4">
                <div className={`h-16 w-16 rounded-full border-4 flex items-center justify-center text-lg font-black ${verdict === 'passed' ? 'border-success text-success' : 'border-warning text-warning'}`}>
                  {score}%
                </div>
                <div>
                  <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold ${verdict === 'passed' ? 'bg-success/15 text-success' : 'bg-warning/15 text-warning'}`}>
                    {verdict === 'passed' ? <Check className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                    {verdict === 'passed' ? 'Passed' : 'Needs retry'}
                  </span>
                  <p className="mt-2 text-sm text-foreground">
                    {verdict === 'passed' ? 'Coverage and pronunciation meet the 75% gate.' : failureReason}
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <Button variant="ghost" onClick={resetAttempt} className="flex items-center gap-2 bg-muted hover:bg-muted px-4 py-3 rounded-xl text-xs font-semibold">
                  <RotateCcw className="w-4 h-4" /> Retry
                </Button>
                <Button variant="ghost"
                  onClick={handleNext}
                  disabled={verdict !== 'passed' || score < 75}
                  className="flex items-center gap-2 bg-success disabled:bg-muted disabled:text-muted-foreground px-4 py-3 rounded-xl text-xs font-semibold"
                >
                  Next session <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="p-4 rounded-2xl bg-destructive/5 border border-destructive/20">
                <h4 className="text-xs font-bold uppercase tracking-wider text-destructive mb-2">Missed / omitted words</h4>
                <p className="text-sm text-foreground">{missedWords.length ? missedWords.join(', ') : 'None'}</p>
              </div>
              <div className="p-4 rounded-2xl bg-warning/5 border border-warning/20">
                <h4 className="text-xs font-bold uppercase tracking-wider text-warning mb-2">Mispronounced / slurred words</h4>
                {mispronouncedWords.length ? mispronouncedWords.map((item, index) => (
                  <p key={index} className="text-sm text-foreground">
                    Target: <strong>{item.target}</strong> - Heard: <strong>{item.heard}</strong>
                  </p>
                )) : <p className="text-sm text-foreground">None</p>}
              </div>
            </div>

            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Interactive word diff</h4>
              <div className="flex flex-wrap gap-2 p-4 bg-card rounded-2xl border border-border">
                {wordDiff.map((item, index) => (
                  <span
                    key={index}
                    title={item.heard ? `Heard: ${item.heard} - ${Math.round(item.similarity * 100)}% match` : 'Not detected'}
                    className={`px-2 py-1 rounded text-sm ${item.status === 'correct'
                      ? 'text-success bg-success/10'
                      : item.status === 'mispronounced'
                      ? 'text-warning bg-warning/10 underline decoration-warning decoration-2 underline-offset-4'
                      : 'text-destructive bg-destructive/10 line-through'}`}
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
