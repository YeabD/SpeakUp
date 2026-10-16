import { NextResponse } from 'next/server'
import { GoogleGenAI } from '@google/genai'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { target_word, forbidden_words, spoken_transcript } = body

    if (!target_word || !spoken_transcript) {
      return NextResponse.json({ error: 'Missing target_word or spoken_transcript' }, { status: 400 })
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY

    if (!apiKey) {
      // Fallback simulation if no API key configured
      const normalizedTranscript = spoken_transcript.toLowerCase()
      const targetLower = target_word.toLowerCase()
      const guessedCorrectly = normalizedTranscript.includes(targetLower) || normalizedTranscript.length > 30

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
      guessed_correctly: spoken_transcript.toLowerCase().includes(target_word.toLowerCase()),
      ai_guess: target_word,
      confidence: 0.8,
    })
  } catch (err: any) {
    console.error('Circumlocution guess API error:', err)
    return NextResponse.json({
      guessed_correctly: false,
      ai_guess: 'Processing...',
      confidence: 0.5,
    })
  }
}
