import { NextResponse } from 'next/server'
import { GoogleGenAI } from '@google/genai'

type GuessRequest = {
  target_word?: unknown
  forbidden_words?: unknown
  spoken_transcript?: unknown
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as GuessRequest
    const { target_word, forbidden_words, spoken_transcript } = body

    if (
      typeof target_word !== 'string' ||
      typeof spoken_transcript !== 'string' ||
      !isStringArray(forbidden_words) ||
      target_word.length > 80 ||
      spoken_transcript.length > 4000 ||
      forbidden_words.length > 10 ||
      forbidden_words.some((word) => word.length > 80)
    ) {
      return NextResponse.json({ error: 'Invalid circumlocution request' }, { status: 400 })
    }

    const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const targetSpoken = new RegExp(`\\b${escapeRegExp(String(target_word))}\\b`, 'i').test(String(spoken_transcript))

    // Saying the answer is never a valid win in a circumlocution challenge.
    if (targetSpoken) {
      return NextResponse.json({
        guessed_correctly: false,
        target_spoken: true,
        ai_guess: target_word,
        confidence: 1,
      })
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY

    if (!apiKey) {
      // Fallback simulation if no API key configured
      const normalizedTranscript = spoken_transcript.toLowerCase()
      const clueTerms = spoken_transcript.trim().split(/\s+/).filter(Boolean)
      const guessedCorrectly = normalizedTranscript.length > 45 && clueTerms.length >= 8

      return NextResponse.json({
        guessed_correctly: guessedCorrectly,
        ai_guess: guessedCorrectly ? target_word : `Could it be related to ${target_word.slice(0, 3)}... ?`,
        confidence: guessedCorrectly ? 0.95 : 0.65,
      })
    }

    const ai = new GoogleGenAI({ apiKey })

    const prompt = `You are playing Taboo as the guesser in a language learning game.
Target Secret Word: "${target_word}"
Forbidden Words (Taboo): ${JSON.stringify(forbidden_words || [])}
User Spoken Description: "${spoken_transcript}"

Task: Read the user's description. Determine if they are successfully describing the target word without violating taboo rules.
The round is invalid if the user directly says the target word; never mark that as correct.
Guess what single word they are describing based strictly on their clues.
Return ONLY valid JSON in this exact format:
{
  "guessed_correctly": boolean,
  "ai_guess": "string (your best guess at the secret word or related entity)",
  "confidence": number (between 0.0 and 1.0)
}`

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    })

    const textOutput = response.text || ''
    const jsonMatch = textOutput.match(/\{[\s\S]*\}/)

    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      return NextResponse.json(parsed)
    }

    return NextResponse.json({
      guessed_correctly: false,
      ai_guess: 'Still listening…',
      confidence: 0.25,
    })
  } catch (error: unknown) {
    console.error('Circumlocution guess API error:', error)
    return NextResponse.json({
      guessed_correctly: false,
      ai_guess: 'Processing...',
      confidence: 0.5,
    })
  }
}
