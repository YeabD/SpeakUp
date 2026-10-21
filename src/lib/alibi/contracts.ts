import { z } from 'zod'

export const TOTAL_SESSIONS = 15
export const RESPONSE_MS = 25_000
export const PASS_SCORE = 75
export const caseBank = [
  { id: 'gallery', title: 'The Midnight Gallery', incident: 'A rare painting disappeared from the Westbridge Gallery during the evening reception. You were among the last guests to leave.', timeline: ['19:30 · Reception begins', '20:15 · Security camera goes offline', '20:30 · Painting reported missing'], clues: ['A café receipt stamped 20:10', 'A blue umbrella left by the gallery entrance', 'A message sent at 20:22', 'A taxi booking for 20:35', 'A guest who remembers your coat', 'A photograph taken during the reception'] },
  { id: 'station', title: 'The Station Locker', incident: 'A locked case vanished from Platform 4 at Northwick Station. Your ticket places you at the station that evening.', timeline: ['18:00 · Case placed in locker', '18:20 · Platform announcement', '18:45 · Empty locker discovered'], clues: ['A delayed train ticket', 'A coffee spilled near Platform 4', 'A call made at 18:25', 'A red scarf on a bench', 'A kiosk receipt stamped 18:15', 'A porter who checked your ticket'] },
  { id: 'hotel', title: 'The Missing Manuscript', incident: 'An unpublished manuscript disappeared from a hotel reading room. You attended a book event in the same building.', timeline: ['16:00 · Reading begins', '16:40 · Reading room briefly unattended', '17:00 · Manuscript reported missing'], clues: ['A signed book with a dedication', 'A lift that stopped on the wrong floor', 'A tea receipt stamped 16:35', 'A message about a changed meeting', 'A receptionist who lent you a pen', 'A rain-soaked jacket'] },
  { id: 'garden', title: 'The Glasshouse Mystery', incident: 'A prize orchid was removed from the glasshouse during a botanical exhibition. You were visiting the exhibition that afternoon.', timeline: ['14:00 · Exhibition opens', '14:30 · Glasshouse door found open', '15:00 · Orchid reported missing'], clues: ['A muddy shoe print', 'A guided-tour ticket for 14:20', 'A gardener carrying a watering can', 'A photograph of the fountain', 'A phone call at 14:45', 'A gift-shop receipt'] },
] as const
export type CaseFile = { id: string; title: string; incident: string; timeline: string[]; clues: string[] }
export function selectCase(): CaseFile {
  const seed = caseBank[Math.floor(Math.random() * caseBank.length)]
  const clues: string[] = [...seed.clues]
  for (let i = clues.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [clues[i], clues[j]] = [clues[j], clues[i]] }
  return { ...seed, timeline: [...seed.timeline], clues: clues.slice(0, 3) }
}
export const turnSchema = z.object({ question: z.string().min(1).max(700), answer: z.string().trim().min(1).max(5000), duration_ms: z.number().min(0).max(RESPONSE_MS), source: z.literal('speechmatics') })
export type Turn = z.infer<typeof turnSchema>
const score = z.number().min(0).max(100)
export const evaluationSchema = z.object({
  criteria_scores: z.object({ grammar: score, consistency: score, evidence: score, vocabulary: score, relevance_fluency: score }),
  evidence_coverage: z.array(z.object({ clue: z.string(), covered: z.boolean(), turn: z.number().int().min(1).max(3).nullable(), quote: z.string(), feedback: z.string() })).length(3),
  consistency_findings: z.array(z.object({ finding: z.string(), references: z.array(z.object({ turn: z.number().int().min(1).max(3), quote: z.string() })).min(1) })).max(6),
  grammar_errors: z.array(z.object({ turn: z.number().int().min(1).max(3), mistake: z.string().min(1), correction: z.string(), explanation: z.string() })).max(8),
  vocabulary_upgrades: z.array(z.object({ turn: z.number().int().min(1).max(3), original_word: z.string().min(1), suggested_replacement: z.string(), reason: z.string() })).max(6),
  recognition_uncertainties: z.array(z.object({ turn: z.number().int().min(1).max(3), quote: z.string(), explanation: z.string() })).max(6),
  rephrased_ideal_sentence: z.string().min(1).max(6000), suggestions: z.array(z.string()).min(1).max(4),
})
export type Evaluation = z.infer<typeof evaluationSchema> & { score: number; is_passed: boolean }
export type Attempt = { id: string; session_number: number; case_file: CaseFile; turns: Turn[]; question: string | null; evaluation: Evaluation | null; completed_sessions: number }
export const weights = { grammar: .30, consistency: .25, evidence: .20, vocabulary: .15, relevance_fluency: .10 }
export function finalizeEvaluation(raw: unknown, turns: Turn[], clues: string[]): Evaluation {
  const value = evaluationSchema.parse(raw)
  const contains = (turn: number, quote: string) => !!quote.trim() && turns[turn - 1].answer.toLowerCase().includes(quote.toLowerCase())
  // Require literal transcript references: unsupported feedback never reaches learners.
  value.grammar_errors = value.grammar_errors.filter(x => contains(x.turn, x.mistake) && !value.recognition_uncertainties.some(u => u.turn === x.turn && (u.quote.includes(x.mistake) || x.mistake.includes(u.quote))))
  value.vocabulary_upgrades = value.vocabulary_upgrades.filter(x => contains(x.turn, x.original_word))
  value.consistency_findings = value.consistency_findings.filter(x => x.references.every(r => contains(r.turn, r.quote)))
  value.recognition_uncertainties = value.recognition_uncertainties.filter(x => contains(x.turn, x.quote))
  if (value.evidence_coverage.some((x, i) => x.clue !== clues[i])) throw new Error('Evaluation evidence does not match the case')
  value.evidence_coverage = value.evidence_coverage.map(x => x.covered && (!x.turn || !contains(x.turn, x.quote)) ? { ...x, covered: false, turn: null, quote: '', feedback: 'No reliable transcript reference was found.' } : x)
  const coverageCeiling = Math.round(value.evidence_coverage.filter(x => x.covered).length / clues.length * 100)
  value.criteria_scores.evidence = Math.min(value.criteria_scores.evidence, coverageCeiling)
  const score = Math.round(Object.entries(weights).reduce((sum, [key, weight]) => sum + value.criteria_scores[key as keyof typeof weights] * weight, 0))
  return { ...value, score, is_passed: score >= PASS_SCORE }
}
