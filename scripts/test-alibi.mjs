// Run: node --test scripts/test-alibi.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import Module from 'node:module'
import ts from 'typescript'
import path from 'node:path'
const filename = path.resolve('src/lib/alibi/contracts.ts')
const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
const mod = new Module(filename)
mod.filename = filename
mod.paths = Module._nodeModulePaths(path.dirname(filename))
mod._compile(compiled, filename)
const { selectCase, finalizeEvaluation, turnSchema, weights } = mod.exports
const machineFile = path.resolve('src/lib/alibi/machine.ts')
const machine = new Module(machineFile)
machine._compile(ts.transpileModule(fs.readFileSync(machineFile, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, machineFile)
const { canTransition } = machine.exports
const turns = [
  { question: 'Where were you?', answer: 'I was at the café at eight. I go there yesterday. I had an umbrella.', duration_ms: 25000, source: 'speechmatics' },
  { question: 'What about the receipt?', answer: 'I kept the café receipt and sent a message.', duration_ms: 10000, source: 'speechmatics' },
  { question: 'Who saw you?', answer: 'The waiter saw me leave.', duration_ms: 10000, source: 'speechmatics' },
]
function evaluation(score = 75) {
  return {
    criteria_scores: Object.fromEntries(Object.keys(weights).map(key => [key, score])),
    evidence_coverage: [
      { clue: 'receipt', covered: true, turn: 2, quote: 'café receipt', feedback: 'Incorporated.' },
      { clue: 'umbrella', covered: true, turn: 1, quote: 'an umbrella', feedback: 'Incorporated.' },
      { clue: 'message', covered: true, turn: 2, quote: 'sent a message', feedback: 'Incorporated.' },
    ],
    consistency_findings: [], grammar_errors: [], vocabulary_upgrades: [], recognition_uncertainties: [],
    rephrased_ideal_sentence: 'I was at the café at eight. I kept my receipt, and the waiter saw me leave.', suggestions: ['Use the past tense consistently.'],
  }
}
test('case sampling always produces three distinct clues from its own case', () => {
  const combinations = new Set()
  for (let i = 0; i < 500; i++) { const c = selectCase(); assert.equal(c.clues.length, 3); assert.equal(new Set(c.clues).size, 3); combinations.add(c.id + c.clues.join('|')) }
  assert.ok(combinations.size > 30)
})
test('score 75 passes and 74 fails, overriding any model pass flag', () => {
  for (const score of [0, 74, 75, 100]) {
    const result = finalizeEvaluation({ ...evaluation(score), score: 100, is_passed: true }, turns, ['receipt', 'umbrella', 'message'])
    assert.equal(result.score, score); assert.equal(result.is_passed, score >= 75)
  }
})
test('the prescribed five weights determine the result', () => {
  const input = evaluation()
  input.criteria_scores = { grammar: 80, consistency: 60, evidence: 100, vocabulary: 40, relevance_fluency: 90 }
  assert.equal(finalizeEvaluation(input, turns, ['receipt', 'umbrella', 'message']).score, 74)
})
test('unsupported corrections and story findings never appear', () => {
  const input = evaluation()
  input.grammar_errors = [
    { turn: 1, mistake: 'I go there yesterday.', correction: 'I went there yesterday.', explanation: 'Use the past simple.' },
    { turn: 2, mistake: 'I am guilty', correction: 'I was guilty', explanation: 'Invented.' },
  ]
  input.consistency_findings = [{ finding: 'Invented contradiction', references: [{ turn: 2, quote: 'I took the painting' }] }]
  input.vocabulary_upgrades = [{ turn: 3, original_word: 'nice', suggested_replacement: 'pleasant', reason: 'Invented.' }]
  const output = finalizeEvaluation(input, turns, ['receipt', 'umbrella', 'message'])
  assert.equal(output.grammar_errors.length, 1); assert.equal(output.consistency_findings.length, 0); assert.equal(output.vocabulary_upgrades.length, 0)
})
test('ASR uncertainty is separate from corrections', () => {
  const input = evaluation()
  input.grammar_errors = [{ turn: 1, mistake: 'I go there yesterday.', correction: 'I went there yesterday.', explanation: 'Use past simple.' }]
  input.recognition_uncertainties = [{ turn: 1, quote: 'I go there yesterday.', explanation: 'May have lost a word.' }]
  const output = finalizeEvaluation(input, turns, ['receipt', 'umbrella', 'message'])
  assert.equal(output.grammar_errors.length, 0); assert.equal(output.recognition_uncertainties.length, 1)
})
test('mismatched evidence is rejected; fabricated coverage is removed', () => {
  assert.throws(() => finalizeEvaluation(evaluation(), turns, ['other', 'umbrella', 'message']))
  const input = evaluation()
  input.evidence_coverage[0] = { clue: 'receipt', covered: true, turn: 1, quote: 'I kept the receipt', feedback: 'Unsupported quote.' }
  const output = finalizeEvaluation(input, turns, ['receipt', 'umbrella', 'message'])
  assert.equal(output.evidence_coverage[0].covered, false)
  assert.equal(output.criteria_scores.evidence, 67)
})
test('turn contracts reject empty answers and recordings over 25 seconds', () => {
  assert.equal(turnSchema.safeParse(turns[0]).success, true)
  assert.equal(turnSchema.safeParse({ ...turns[0], answer: ' ' }).success, false)
  assert.equal(turnSchema.safeParse({ ...turns[0], duration_ms: 25001 }).success, false)
})
test('the state machine cannot begin recording during playback or playback during recording', () => {
  assert.equal(canTransition('speaking', 'recording'), false)
  assert.equal(canTransition('recording', 'speaking'), false)
  assert.equal(canTransition('saving', 'recording'), false)
  assert.equal(canTransition('speaking', 'ready'), true)
  assert.equal(canTransition('ready', 'preparing'), true)
  assert.equal(canTransition('preparing', 'recording'), true)
  assert.equal(canTransition('recording', 'transcribing'), true)
})
