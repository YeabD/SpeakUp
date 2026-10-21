export type Phase = 'loading' | 'briefing' | 'fetching' | 'question' | 'speaking' | 'ready' | 'preparing' | 'recording' | 'transcribing' | 'review' | 'saving' | 'evaluating' | 'verdict'

const transitions: Record<Phase, readonly Phase[]> = {
  loading: ['briefing', 'verdict'],
  briefing: ['loading', 'fetching', 'evaluating', 'verdict', 'speaking'],
  fetching: ['question'],
  question: ['fetching', 'speaking', 'evaluating', 'verdict'],
  speaking: ['ready', 'question', 'verdict', 'briefing'],
  ready: ['preparing'],
  preparing: ['recording', 'ready'],
  recording: ['transcribing', 'ready'],
  transcribing: ['review', 'ready'],
  review: ['saving', 'preparing', 'transcribing'],
  saving: ['review', 'fetching', 'evaluating', 'verdict'],
  evaluating: ['verdict', 'question'],
  verdict: ['loading', 'speaking'],
}
export function canTransition(from: Phase, to: Phase) { return from === to || transitions[from].includes(to) }
