import { NextResponse } from 'next/server'
import { createClient } from '@/src/lib/supabase/server'

const JOBS_URL = 'https://eu1.asr.api.speechmatics.com/v2/jobs'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const apiKey = process.env.SPEECHMATICS_API_KEY?.trim()
    if (!apiKey) {
      return NextResponse.json({ error: 'Speech recognition is not configured' }, { status: 503 })
    }

    const requestData = await request.formData()
    const audio = requestData.get('audio')
    if (!(audio instanceof File) || audio.size === 0) {
      return NextResponse.json({ error: 'A recorded audio file is required' }, { status: 400 })
    }
    if (audio.size > 20 * 1024 * 1024) {
      return NextResponse.json({ error: 'The recording is too large' }, { status: 413 })
    }

    const speechmaticsData = new FormData()
    speechmaticsData.append('data_file', audio, audio.name || 'shadowing.webm')
    speechmaticsData.append('config', JSON.stringify({
      type: 'transcription',
      transcription_config: { language: 'en', model: 'enhanced' },
    }))

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 40000)
    try {
      const response = await fetch(`${JOBS_URL}?wait=30&format=txt`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}` },
        body: speechmaticsData,
        cache: 'no-store',
        signal: controller.signal,
      })
      const responseBody = await response.json().catch(() => null)
      if (!response.ok) {
        console.error('Speechmatics STT failed:', response.status, responseBody)
        return NextResponse.json({ error: 'Speech recognition failed' }, { status: 502 })
      }
      const transcript = typeof responseBody?.txt === 'string' ? responseBody.txt.trim() : ''
      if (!transcript) {
        return NextResponse.json({ error: 'Speech recognition returned no transcript' }, { status: 422 })
      }
      return NextResponse.json({ transcript, source: 'speechmatics' })
    } catch (error) {
      const timedOut = error instanceof Error && error.name === 'AbortError'
      console.error('Speechmatics STT request error:', error)
      return NextResponse.json(
        { error: timedOut ? 'Speech recognition timed out' : 'Speech recognition failed' },
        { status: timedOut ? 504 : 502 }
      )
    } finally {
      clearTimeout(timeout)
    }
  } catch (error) {
    console.error('STT route error:', error)
    return NextResponse.json({ error: 'Invalid speech recognition request' }, { status: 400 })
  }
}
