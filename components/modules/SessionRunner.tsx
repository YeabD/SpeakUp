'use client'

import { useState } from 'react'
import { X, Mic, CheckCircle2, AlertTriangle, ArrowRight, Loader2, Award, Zap } from 'lucide-react'

interface SessionRunnerProps {
  module: {
    id: string
    title: string
    description: string
  }
  currentLevel?: number
  currentSession?: number
  isOpen: boolean
  onClose: () => void
  onCompleted: (result: any) => void
}

export default function SessionRunner({
  module,
  currentLevel = 1,
  currentSession = 1,
  isOpen,
  onClose,
  onCompleted,
}: SessionRunnerProps) {
  const [sessionNum, setSessionNum] = useState(currentSession)
  const [accuracy, setAccuracy] = useState(82)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<any>(null)

  if (!isOpen) return null

  const handleCompleteSession = async () => {
    setSubmitting(true)
    try {
      const res = await fetch('/api/sessions/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          module_type: module.id,
          level_number: currentLevel,
          session_number: sessionNum,
          accuracy_score: accuracy,
        }),
      })

      const data = await res.json()
      if (res.ok) {
        setResult(data)
        onCompleted(data)
      } else {
        alert(data.error || 'Failed to complete session')
      }
    } catch (err) {
      console.error(err)
      alert('Network error while completing session')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl max-w-lg w-full p-6 sm:p-8 relative overflow-hidden shadow-2xl">
        {/* Glow accent */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="flex items-center justify-between mb-6 relative z-10">
          <div>
            <span className="text-xs font-semibold text-indigo-400 uppercase tracking-wider block mb-1">
              Active Session Runner
            </span>
            <h2 className="text-xl font-bold text-white tracking-tight">{module.title}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {!result ? (
          <div className="space-y-6 relative z-10">
            {/* Session Info Badge Bar */}
            <div className="grid grid-cols-3 gap-3 bg-zinc-950 p-4 rounded-2xl border border-zinc-800 text-center">
              <div>
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider block font-semibold">Level</span>
                <span className="text-sm font-bold text-white">Level {currentLevel}</span>
              </div>
              <div className="border-x border-zinc-800">
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider block font-semibold">Session</span>
                <span className="text-sm font-bold text-indigo-400">Session {sessionNum} of 15</span>
              </div>
              <div>
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider block font-semibold">Target</span>
                <span className="text-sm font-bold text-emerald-400">≥ 70%</span>
              </div>
            </div>

            <p className="text-zinc-400 text-sm leading-relaxed">
              {module.description}
            </p>

            {/* Session Simulator controls */}
            <div className="space-y-3 bg-zinc-950 p-4 rounded-2xl border border-zinc-800">
              <div className="flex items-center justify-between text-xs font-medium text-zinc-300">
                <span>Select Session Index (1 - 15):</span>
                <select
                  value={sessionNum}
                  onChange={(e) => setSessionNum(Number(e.target.value))}
                  className="bg-zinc-900 border border-zinc-700 text-white rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:border-indigo-500"
                >
                  {Array.from({ length: 15 }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>
                      Session {n} {n === 15 ? '(Milestone / Level Boss)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5 pt-2">
                <div className="flex items-center justify-between text-xs font-medium text-zinc-300">
                  <span>Simulated Accuracy Score:</span>
                  <span className="text-indigo-400 font-bold">{accuracy}%</span>
                </div>
                <input
                  type="range"
                  min="40"
                  max="100"
                  value={accuracy}
                  onChange={(e) => setAccuracy(Number(e.target.value))}
                  className="w-full accent-indigo-500 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-zinc-500">
                  <span>40% (Fail)</span>
                  <span>70% (Passing Threshold)</span>
                  <span>100% (Perfect)</span>
                </div>
              </div>
            </div>

            <button
              onClick={handleCompleteSession}
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-3.5 px-4 rounded-2xl transition-all shadow-lg shadow-indigo-600/25 disabled:opacity-50 text-sm"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Evaluating Session...
                </>
              ) : (
                <>
                  Submit & Complete Session <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        ) : (
          <div className="space-y-6 relative z-10 text-center py-4">
            <div className="h-16 w-16 bg-emerald-500/10 border border-emerald-500/25 rounded-full flex items-center justify-center mx-auto text-emerald-400">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div>
              <h3 className="text-xl font-bold text-white mb-1">Session Completed!</h3>
              <p className="text-zinc-400 text-sm">
                Your performance has been analyzed and recorded successfully.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 bg-zinc-950 p-4 rounded-2xl border border-zinc-800 text-left">
              <div>
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider block font-semibold">Average Accuracy</span>
                <span className="text-lg font-bold text-indigo-400">{result.average_accuracy}%</span>
              </div>
              <div>
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider block font-semibold">Status</span>
                <span className="text-sm font-semibold text-emerald-400 flex items-center gap-1">
                  {result.level_unlocked ? '🚀 Level Unlocked!' : 'Progress Saved'}
                </span>
              </div>
            </div>

            {sessionNum === 15 && !result.level_unlocked && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/25 rounded-xl text-amber-300 text-xs text-left flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  Average accuracy ({result.average_accuracy}%) is below the 70% threshold required to unlock Level {currentLevel + 1}. Please retry low-scoring sessions!
                </span>
              </div>
            )}

            <button
              onClick={() => {
                setResult(null)
                onClose()
              }}
              className="w-full bg-zinc-800 hover:bg-zinc-700 text-white font-semibold py-3.5 rounded-2xl transition-all text-sm"
            >
              Return to Dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
