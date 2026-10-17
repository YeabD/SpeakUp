import { NextResponse } from 'next/server'

const VOICES = new Set(['sarah', 'theo', 'megan', 'jack'])
function write(view: DataView, offset: number, value: string) {
  for (let index = 0; index < value.length; index += 1) view.setUint8(offset + index, value.charCodeAt(index))
}
function fallbackWav(text: string) {
  const rate = 16000
  const seconds = Math.max(3, Math.min(60, text.trim().split(/\s+/).length / 2.4))
  const samples = Math.ceil(rate * seconds)
  const buffer = new ArrayBuffer(44 + samples * 2)
  const view = new DataView(buffer)
  write(view, 0, 'RIFF'); view.setUint32(4, 36 + samples * 2, true)
  write(view, 8, 'WAVE'); write(view, 12, 'fmt ')
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true)
  view.setUint32(24, rate, true); view.setUint32(28, rate * 2, true)
  view.setUint16(32, 2, true); view.setUint16(34, 16, true)
  write(view, 36, 'data'); view.setUint32(40, samples * 2, true)
  for (let index = 0; index < samples; index += 1) {
    const time = index / rate
    const pulse = Math.floor(time * 2) % 2 === 0 ? 1 : 0
    view.setInt16(44 + index * 2, Math.round(Math.sin(2 * Math.PI * 220 * time) * 0.03 * pulse * 0x7fff), true)
  }
  return buffer
}
function fallback(text: string, reason: string) {
  const audio = fallbackWav(text)
  return new NextResponse(audio, { headers: {
    'Content-Type': 'audio/wav', 'Content-Length': String(audio.byteLength),
    'Cache-Control': 'no-store', 'X-TTS-Fallback': 'web-speech', 'X-TTS-Fallback-Reason': reason,
  } })
}
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const text = typeof body.text === 'string' ? body.text.trim() : ''
    const requestedVoice = typeof body.voice === 'string' ? body.voice.toLowerCase() : 'sarah'
    const voice = VOICES.has(requestedVoice) ? requestedVoice : 'sarah'
    if (!text) return NextResponse.json({ error: 'Missing text for TTS synthesis' }, { status: 400 })
    const apiKey = process.env.SPEECHMATICS_API_KEY?.trim()
    if (!apiKey) return fallback(text, 'missing-api-key')
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15000)
    try {
      const response = await fetch(`https://preview.tts.speechmatics.com/generate/${voice}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }), cache: 'no-store', signal: controller.signal,
      })
      if (!response.ok) {
        console.error('Speechmatics TTS failed:', response.status, (await response.text()).slice(0, 300))
        return fallback(text, `upstream-${response.status}`)
      }
      const audio = await response.arrayBuffer()
      if (audio.byteLength <= 44) return fallback(text, 'empty-audio')
      return new NextResponse(audio, { headers: {
        'Content-Type': response.headers.get('content-type') || 'audio/wav',
        'Content-Length': String(audio.byteLength), 'Cache-Control': 'no-store',
      } })
    } catch (error) {
      console.error('Speechmatics TTS request error:', error)
      return fallback(text, error instanceof Error && error.name === 'AbortError' ? 'timeout' : 'network-error')
    } finally { clearTimeout(timeout) }
  } catch (error) {
    console.error('TTS route error:', error)
    return NextResponse.json({ error: 'Invalid TTS request' }, { status: 400 })
  }
}
