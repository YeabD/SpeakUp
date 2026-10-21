'use client'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'

import { useState } from 'react'
import { CheckCircle2, AlertTriangle, ArrowRight, Loader2 } from 'lucide-react'

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
    <Dialog open={isOpen} onOpenChange={(open: boolean) => { if (!open) onClose() }}>
      <DialogContent>
        <DialogDescription className="sr-only">Practice session controls and completion results for {module.title}.</DialogDescription>
        {/* Glow accent */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="flex items-center justify-between mb-6 relative z-10">
          <div>
            <span className="text-xs font-semibold text-primary uppercase tracking-wider block mb-1">
              Active Session Runner
            </span>
            <DialogTitle className="font-heading text-xl font-bold text-foreground tracking-tight">{module.title}</DialogTitle>
          </div>
        </div>

        {!result ? (
          <div className="space-y-6 relative z-10">
            {/* Session Info Badge Bar */}
            <div className="grid grid-cols-3 gap-3 bg-background p-4 rounded-2xl border border-border text-center">
              <div>
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider block font-semibold">Level</span>
                <span className="text-sm font-bold text-foreground">Level {currentLevel}</span>
              </div>
              <div className="border-x border-border">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider block font-semibold">Session</span>
                <span className="text-sm font-bold text-primary">Session {sessionNum} of 15</span>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider block font-semibold">Target</span>
                <span className="text-sm font-bold text-success">≥ 70%</span>
              </div>
            </div>

            <p className="text-muted-foreground text-sm leading-relaxed">
              {module.description}
            </p>

            {/* Session Simulator controls */}
            <div className="space-y-3 bg-background p-4 rounded-2xl border border-border">
              <div className="flex items-center justify-between text-xs font-medium text-foreground">
                <span>Select Session Index (1 - 15):</span>
                <select
                  aria-label="Session index"
                  value={sessionNum}
                  onChange={(e) => setSessionNum(Number(e.target.value))}
                  className="bg-card border border-border text-foreground rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:border-primary"
                >
                  {Array.from({ length: 15 }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>
                      Session {n} {n === 15 ? '(Milestone / Level Boss)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5 pt-2">
                <div className="flex items-center justify-between text-xs font-medium text-foreground">
                  <span>Simulated Accuracy Score:</span>
                  <span className="text-primary font-bold">{accuracy}%</span>
                </div>
                <input
                  aria-label="Simulated accuracy score"
                  type="range"
                  min="40"
                  max="100"
                  value={accuracy}
                  onChange={(e) => setAccuracy(Number(e.target.value))}
                  className="w-full accent-primary cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>40% (Fail)</span>
                  <span>70% (Passing Threshold)</span>
                  <span>100% (Perfect)</span>
                </div>
              </div>
            </div>

            <Button variant="ghost"
              onClick={handleCompleteSession}
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary text-foreground font-semibold py-3.5 px-4 rounded-2xl transition-all shadow-lg shadow-primary/25 disabled:opacity-50 text-sm"
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
            </Button>
          </div>
        ) : (
          <div className="space-y-6 relative z-10 text-center py-4">
            <div className="h-16 w-16 bg-success/10 border border-success/25 rounded-full flex items-center justify-center mx-auto text-success">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div>
              <h3 className="text-xl font-bold text-foreground mb-1">Session Completed!</h3>
              <p className="text-muted-foreground text-sm">
                Your performance has been analyzed and recorded successfully.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 bg-background p-4 rounded-2xl border border-border text-left">
              <div>
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider block font-semibold">Average Accuracy</span>
                <span className="text-lg font-bold text-primary">{result.average_accuracy}%</span>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider block font-semibold">Status</span>
                <span className="text-sm font-semibold text-success flex items-center gap-1">
                  {result.level_unlocked ? '🚀 Level Unlocked!' : 'Progress Saved'}
                </span>
              </div>
            </div>

            {sessionNum === 15 && !result.level_unlocked && (
              <div className="p-3 bg-warning/10 border border-warning/25 rounded-xl text-warning text-xs text-left flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  Average accuracy ({result.average_accuracy}%) is below the 70% threshold required to unlock Level {currentLevel + 1}. Please retry low-scoring sessions!
                </span>
              </div>
            )}

            <Button variant="ghost"
              onClick={() => {
                setResult(null)
                onClose()
              }}
              className="w-full bg-muted hover:bg-muted text-foreground font-semibold py-3.5 rounded-2xl transition-all text-sm"
            >
              Return to Dashboard
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
