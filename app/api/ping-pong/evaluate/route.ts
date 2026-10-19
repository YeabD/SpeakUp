import { GoogleGenAI, Type } from '@google/genai'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const requestSchema = z.object({
  question: z.string().trim().min(1).max(1200),
  transcript: z.string().trim().max(5000),
  timed_out: z.boolean().optional().default(false),
})

const feedbackItemSchema = z.object({
  word: z.string(),
  count: z.number().int().min(1),
})

const evaluationSchema = z.object({
  score: z.number().min(0).max(100),
  is_passed: z.boolean(),
  criteria_scores: z.object({
    relevance: z.number().min(0).max(100),
    vocabulary: z.number().min(0).max(100),
    fluency: z.number().min(0).max(100),
    grammar: z.number().min(0).max(100),
  }),
  relevance_feedback: z.string(),
  filler_words_detected: z.array(feedbackItemSchema),
  vocabulary_upgrades: z.array(z.object({
    original_word: z.string(),
    suggested_replacement: z.string(),
    reason: z.string(),
  })),
  grammar_errors: z.array(z.object({
    mistake: z.string(),
    correction: z.string(),
    explanation: z.string(),
  })),
  rephrased_ideal_sentence: z.string(),
})

type Evaluation = z.infer<typeof evaluationSchema>

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    score: { type: Type.NUMBER, minimum: 0, maximum: 100 },
    is_passed: { type: Type.BOOLEAN },
    criteria_scores: {
      type: Type.OBJECT,
      properties: {
        relevance: { type: Type.NUMBER, minimum: 0, maximum: 100 },
        vocabulary: { type: Type.NUMBER, minimum: 0, maximum: 100 },
        fluency: { type: Type.NUMBER, minimum: 0, maximum: 100 },
        grammar: { type: Type.NUMBER, minimum: 0, maximum: 100 },
      },
      required: ['relevance', 'vocabulary', 'fluency', 'grammar'],
    },
    relevance_feedback: { type: Type.STRING },
    filler_words_detected: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          word: { type: Type.STRING },
          count: { type: Type.INTEGER, minimum: 1 },
        },
        required: ['word', 'count'],
      },
    },
    vocabulary_upgrades: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          original_word: { type: Type.STRING },
          suggested_replacement: { type: Type.STRING },
          reason: { type: Type.STRING },
        },
        required: ['original_word', 'suggested_replacement', 'reason'],
      },
    },
    grammar_errors: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          mistake: { type: Type.STRING },
          correction: { type: Type.STRING },
          explanation: { type: Type.STRING },
        },
        required: ['mistake', 'correction', 'explanation'],
      },
    },
    rephrased_ideal_sentence: { type: Type.STRING },
  },
  required: [
    'score',
    'is_passed',
    'criteria_scores',
    'relevance_feedback',
    'filler_words_detected',
    'vocabulary_upgrades',
    'grammar_errors',
    'rephrased_ideal_sentence',
  ],
}

const FILLERS = ['uh', 'um', 'umm', 'like', 'you know', 'actually', 'basically']
const UPGRADE_MAP: Record<string, { replacement: string; reason: string }> = {
  good: { replacement: 'beneficial', reason: 'Adds precision and a more confident tone.' },
  bad: { replacement: 'detrimental', reason: 'Expresses the negative impact more specifically.' },
  nice: { replacement: 'compelling', reason: 'Conveys a clearer positive quality.' },
  thing: { replacement: 'factor', reason: 'Replaces a vague noun with a more precise one.' },
  stuff: { replacement: 'resources', reason: 'Names the idea more professionally.' },
  really: { replacement: 'particularly', reason: 'Uses a more deliberate intensifier.' },
  very: { replacement: 'highly', reason: 'Strengthens emphasis without sounding repetitive.' },
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)))
}

function countFillers(transcript: string) {
  const normalized = transcript.toLowerCase()
  return FILLERS.flatMap((word) => {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const count = normalized.match(new RegExp(`\\b${escaped}\\b`, 'g'))?.length ?? 0
    return count > 0 ? [{ word, count }] : []
  })
}

function fallbackEvaluation(question: string, transcript: string): Evaluation {
  const words: string[] = Array.from(transcript.toLowerCase().match(/[a-z']+/g) ?? [])
  const questionWords = new Set((question.toLowerCase().match(/[a-z']+/g) ?? []).filter((word) => word.length > 3))
  const overlap = words.filter((word) => questionWords.has(word)).length
  const uniqueRatio = words.length > 0 ? new Set(words).size / words.length : 0
  const fillers = countFillers(transcript)
  const fillerCount = fillers.reduce((sum, item) => sum + item.count, 0)
  const relevance = clamp(words.length === 0 ? 0 : 42 + overlap * 9 + Math.min(25, words.length * 1.2))
  const vocabulary = clamp(words.length === 0 ? 0 : 38 + uniqueRatio * 48 + Math.min(12, words.filter((word) => word.length >= 8).length * 3))
  const fluency = clamp(words.length === 0 ? 0 : 88 - (fillerCount / Math.max(1, words.length)) * 260)
  const hasSentenceShape = /^[A-Z]/.test(transcript.trim()) && /[.!?]$/.test(transcript.trim())
  const grammar = clamp(words.length === 0 ? 0 : (hasSentenceShape ? 88 : 72))
  const score = clamp(relevance * 0.35 + vocabulary * 0.25 + fluency * 0.25 + grammar * 0.15)
  const upgrades = Object.entries(UPGRADE_MAP).flatMap(([word, suggestion]) =>
    words.includes(word) ? [{ original_word: word, suggested_replacement: suggestion.replacement, reason: suggestion.reason }] : []
  ).slice(0, 4)
  const trimmed = transcript.trim()
  const polished = trimmed
    ? `${trimmed.charAt(0).toUpperCase()}${trimmed.slice(1).replace(/[.!?]+$/, '')}.`
    : 'No response was recorded. Try again and answer the prompt in one complete, specific sentence.'

  return {
    score,
    is_passed: score >= 75,
    criteria_scores: { relevance, vocabulary, fluency, grammar },
    relevance_feedback: words.length === 0
      ? 'No answer was captured, so the prompt was not addressed.'
      : overlap > 0
        ? 'The answer engages with the prompt; add one concrete detail to make the connection stronger.'
        : 'The response needs a clearer, more direct link to the question.',
    filler_words_detected: fillers,
    vocabulary_upgrades: upgrades,
    grammar_errors: hasSentenceShape || !trimmed ? [] : [{
      mistake: trimmed,
      correction: polished,
      explanation: 'Use a capital letter and closing punctuation to form a complete written sentence.',
    }],
    rephrased_ideal_sentence: polished,
  }
}

export async function POST(request: Request) {
  try {
    const parsedRequest = requestSchema.safeParse(await request.json())
    if (!parsedRequest.success) {
      return NextResponse.json({ error: 'A valid question and transcript are required.' }, { status: 400 })
    }

    const { question, transcript, timed_out: timedOut } = parsedRequest.data
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY
    if (!apiKey) {
      const fallback = fallbackEvaluation(question, transcript)
      return NextResponse.json(timedOut ? { ...fallback, score: Math.min(74, fallback.score), is_passed: false } : fallback)
    }

    const ai = new GoogleGenAI({ apiKey })
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Evaluate this spoken English answer.\n\nQuestion: ${JSON.stringify(question)}\nUser answer: ${JSON.stringify(transcript || '[No response recorded]')}\nThe 15-second response window expired: ${timedOut ? 'yes' : 'no'}.`,
      config: {
        responseMimeType: 'application/json',
        responseSchema,
        temperature: 0.2,
        systemInstruction: `You are a rigorous conversational English evaluator. Score four criteria independently: relevance and semantic match (35%), lexical strength and vocabulary (25%), speech continuity and filler control (25%), and grammar and sentence structure (15%). The composite score must equal the rounded weighted sum. Set is_passed to true only when score is at least 75. Detect filler words including uh, um, umm, like, and you know. Keep feedback concise and preserve the user's intended meaning in the polished rewrite. Never invent errors or vocabulary upgrades when none are warranted.`,
      },
    })

    const parsedEvaluation = evaluationSchema.parse(JSON.parse(response.text ?? '{}'))
    const criteria = parsedEvaluation.criteria_scores
    const weightedScore = clamp(criteria.relevance * 0.35 + criteria.vocabulary * 0.25 + criteria.fluency * 0.25 + criteria.grammar * 0.15)
    const score = timedOut ? Math.min(74, weightedScore) : weightedScore

    return NextResponse.json({ ...parsedEvaluation, score, is_passed: !timedOut && score >= 75 })
  } catch (error) {
    console.error('Ping-pong evaluation error:', error)
    return NextResponse.json({ error: 'Unable to evaluate this response.' }, { status: 500 })
  }
}
