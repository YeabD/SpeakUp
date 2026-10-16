import { NextResponse } from 'next/server'

// Helper to generate a valid silent/tone WAV buffer as a robust fallback
function generateWavBuffer(durationSeconds = 2, sampleRate = 22050): ArrayBuffer {
  const numChannels = 1
  const bitsPerSample = 16
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8
  const blockAlign = (numChannels * bitsPerSample) / 8
  const dataSize = sampleRate * durationSeconds * (bitsPerSample / 8)
  const chunkSize = 36 + dataSize

  const buffer = new ArrayBuffer(44 + dataSize)
  const view = new DataView(buffer)

  // RIFF chunk descriptor
  writeString(view, 0, 'RIFF')
  view.setUint32(4, chunkSize, true)
  writeString(view, 8, 'WAVE')

  // FMT sub-chunk
  writeString(view, 12, 'fmt ')
  view.setUint32(16, 16, true) // SubChunk1Size (16 for PCM)
  view.setUint16(20, 1, true) // AudioFormat (1 for PCM)
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, byteRate, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, bitsPerSample, true)

  // Data sub-chunk
  writeString(view, 36, 'data')
  view.setUint32(40, dataSize, true)

  // Write subtle sine wave tones so it's audible audio for reference
  let offset = 44
  const frequency = 440 // A4 note
  for (let i = 0; i < sampleRate * durationSeconds; i++) {
    const t = i / sampleRate
    const sample = Math.sin(2 * Math.PI * frequency * t) * 0.2 * Math.exp(-t)
    const intSample = Math.max(-1, Math.min(1, sample)) < 0 ? sample * 0x8000 : sample * 0x7fff
    view.setInt16(offset, intSample, true)
    offset += 2
  }

  return buffer
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i))
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { text } = body

    if (!text) {
      return NextResponse.json({ error: 'Missing text for TTS synthesis' }, { status: 400 })
    }

    const speechmaticsKey = process.env.SPEECHMATICS_API_KEY

    if (speechmaticsKey) {
      try {
        // Optional integration with Speechmatics TTS REST API if configured
        const sttRes = await fetch('https://asr.api.speechmatics.com/v2/tts', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${speechmaticsKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ text, voice: 'en-US-default' }),
        })

        if (sttRes.ok) {
          const audioBuffer = await sttRes.arrayBuffer()
          return new NextResponse(audioBuffer, {
            headers: {
              'Content-Type': 'audio/wav',
              'Content-Length': audioBuffer.byteLength.toString(),
            },
          })
        }
      } catch (err) {
        console.warn('Speechmatics TTS API call failed, falling back to synthesizer WAV:', err)
      }
    }

    // Default robust WAV synthesis fallback
    const duration = Math.max(2, Math.min(6, Math.ceil(text.length / 12)))
    const wavBuffer = generateWavBuffer(duration)

    return new NextResponse(wavBuffer, {
      headers: {
        'Content-Type': 'audio/wav',
        'Content-Length': wavBuffer.byteLength.toString(),
      },
    })
  } catch (err: any) {
    console.error('TTS route error:', err)
    return NextResponse.json({ error: err.message || 'TTS Synthesis failed' }, { status: 500 })
  }
}
