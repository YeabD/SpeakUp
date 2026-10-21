import { NextResponse } from 'next/server'

export const maxDuration = 30
const VOICES = new Set(['sarah', 'theo', 'megan', 'jack'])
function fallback(error: string, code: string, status: number) {
  return NextResponse.json({ error, code, fallback: 'web-speech' }, {
    status, headers: { 'Cache-Control': 'no-store', 'X-TTS-Fallback': 'web-speech', 'X-TTS-Fallback-Reason': code },
  })
}
export async function POST(request: Request) {
  let body
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid TTS request' }, { status: 400 }) }
  const text = typeof body?.text === 'string' ? body.text.trim() : ''
  const requestedVoice = typeof body?.voice === 'string' ? body.voice.toLowerCase() : 'sarah'
  const voice = VOICES.has(requestedVoice) ? requestedVoice : 'sarah'
  if (!text || text.length > 10000) return NextResponse.json({ error: 'TTS text must contain 1–10000 characters' }, { status: 400 })
  const apiKey = process.env.SPEECHMATICS_API_KEY?.trim()
  if (!apiKey) {
    console.error('TTS: Missing SPEECHMATICS_API_KEY')
    return fallback('Missing SPEECHMATICS_API_KEY', 'missing-api-key', 500)
  }
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15000)
  try {
    const response = await fetch(`https://preview.tts.speechmatics.com/generate/${voice}?output_format=wav_16000`, {
      method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', Accept: 'audio/wav' },
      body: JSON.stringify({ text }), cache: 'no-store', signal: AbortSignal.any([controller.signal, request.signal]),
    })
    if (!response.ok) {
      console.error('Speechmatics TTS upstream HTTP error:', response.status)
      return fallback('Speechmatics speech is temporarily unavailable', `upstream-${response.status}`, 502)
    }
    const audio = await response.arrayBuffer()
    const header = new Uint8Array(audio, 0, Math.min(audio.byteLength, 12))
    const signature = String.fromCharCode(...header)
    if (audio.byteLength <= 44 || !signature.startsWith('RIFF') || signature.slice(8, 12) !== 'WAVE') {
      console.error('Speechmatics TTS returned invalid WAV audio')
      return fallback('Speechmatics returned invalid audio', 'invalid-audio', 502)
    }
    return new NextResponse(audio, { headers: {
      'Content-Type': 'audio/wav', 'Content-Length': String(audio.byteLength), 'Cache-Control': 'no-store',
    } })
  } catch {
    const timedOut = controller.signal.aborted
    console.error(timedOut ? 'Speechmatics TTS timed out' : 'Speechmatics TTS network request failed')
    return fallback(timedOut ? 'Speechmatics speech timed out' : 'Speechmatics speech request failed', timedOut ? 'timeout' : 'network-error', timedOut ? 504 : 502)
  } finally { clearTimeout(timeout) }
}
