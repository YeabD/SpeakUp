import Link from 'next/link'
import { Sparkles, Zap, Mic, ShieldCheck, ArrowRight, BarChart3, Award } from 'lucide-react'

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen bg-zinc-950 text-zinc-50 font-sans selection:bg-indigo-500 selection:text-white">
      {/* Navigation Header */}
      <header className="flex items-center justify-between px-6 lg:px-16 py-6 border-b border-zinc-800/60 backdrop-blur-md sticky top-0 z-50 bg-zinc-950/80">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Mic className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
            SpeakUp
          </span>
        </div>
        <div className="flex items-center gap-4">
          <Link
            href="/signup"
            className="text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl shadow-lg shadow-indigo-600/20 transition-all hover:scale-[1.02]"
          >
            Start Learning
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden px-6 lg:px-16 pt-24 pb-20 max-w-7xl mx-auto w-full text-center lg:text-left flex flex-col lg:flex-row items-center gap-12">
        <div className="flex-1 flex flex-col items-center lg:items-start">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/25 text-indigo-300 text-xs font-semibold mb-6 tracking-wide uppercase">
            <Sparkles className="w-3.5 h-3.5" /> Next-Gen Speech Mastery
          </div>
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-white leading-[1.1] mb-6">
            Command Any Room with <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">Cognitive Precision</span>
          </h1>
          <p className="text-lg sm:text-xl text-zinc-400 max-w-2xl mb-10 leading-relaxed font-normal">
            Move beyond superficial tips. SpeakUp trains your brain for high-pressure delivery through cognitive load drills, real-time latency window scoring, and advanced AI evaluation.
          </p>
          <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
            <Link
              href="/signup"
              className="w-full sm:w-auto flex items-center justify-center gap-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-8 py-4 rounded-2xl shadow-xl shadow-indigo-600/25 transition-all hover:scale-[1.02] text-base group"
            >
              Start Learning
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </div>

        {/* Hero Visual Preview: Fluency Belts & Heatmap Preview */}
        <div className="flex-1 w-full max-w-xl">
          <div className="relative rounded-3xl p-6 bg-gradient-to-b from-zinc-900 to-zinc-950 border border-zinc-800 shadow-2xl overflow-hidden group">
            <div className="absolute top-0 right-0 -mt-12 -mr-12 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
            
            <div className="flex items-center justify-between mb-6">
              <span className="text-xs font-semibold text-zinc-400 tracking-wider uppercase">Live Telemetry Preview</span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Active Session
              </span>
            </div>

            {/* Fluency Belts Preview */}
            <div className="mb-6 p-4 rounded-2xl bg-zinc-950/80 border border-zinc-800/80">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-zinc-300 flex items-center gap-2">
                  <Award className="w-4 h-4 text-amber-400" /> Fluency Belt Progression
                </span>
                <span className="text-xs text-indigo-400 font-semibold">Black Belt Level</span>
              </div>
              <div className="grid grid-cols-5 gap-2">
                <div className="h-3 rounded-full bg-zinc-700" title="White Belt" />
                <div className="h-3 rounded-full bg-yellow-600" title="Yellow Belt" />
                <div className="h-3 rounded-full bg-emerald-600" title="Green Belt" />
                <div className="h-3 rounded-full bg-indigo-600 ring-2 ring-indigo-400" title="Blue Belt (Current)" />
                <div className="h-3 rounded-full bg-zinc-800" title="Black Belt" />
              </div>
            </div>

            {/* Pause Duration Heatmap Preview */}
            <div className="p-4 rounded-2xl bg-zinc-950/80 border border-zinc-800/80">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-zinc-300 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-indigo-400" /> Pause Duration Heatmap
                </span>
                <span className="text-xs text-zinc-400">Optimal Pace</span>
              </div>
              <div className="flex items-center gap-1.5 h-10 px-2 bg-zinc-900 rounded-xl">
                <div className="flex-1 h-5 bg-emerald-500/80 rounded" title="Flow (0.2s)" />
                <div className="flex-1 h-3 bg-emerald-500/80 rounded" title="Flow (0.4s)" />
                <div className="flex-1 h-8 bg-amber-500/80 rounded" title="Noticeable Pause (1.2s)" />
                <div className="flex-1 h-4 bg-emerald-500/80 rounded" title="Flow (0.3s)" />
                <div className="flex-1 h-10 bg-rose-500/80 rounded" title="Excessive Hesitation (2.5s)" />
                <div className="flex-1 h-3 bg-emerald-500/80 rounded" title="Flow (0.2s)" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Differentiators Section */}
      <section className="px-6 lg:px-16 py-24 bg-zinc-900/40 border-t border-zinc-800/60">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white mb-4">
              Engineered for Elite Communication
            </h2>
            <p className="text-zinc-400 text-lg">
              Our methodology combines cognitive psychology with real-time speech analytics to build unshakable verbal composure.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Card 1 */}
            <div className="p-8 rounded-3xl bg-zinc-900 border border-zinc-800/80 hover:border-indigo-500/50 transition-all group">
              <div className="h-12 w-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/25 flex items-center justify-center text-indigo-400 mb-6 group-hover:scale-110 transition-transform">
                <Zap className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">Cognitive Load Training</h3>
              <p className="text-zinc-400 text-sm leading-relaxed">
                Simulate complex audience questions, unexpected interruptions, and high-pressure topic switches while maintaining vocal control and structured thinking.
              </p>
            </div>

            {/* Card 2 */}
            <div className="p-8 rounded-3xl bg-zinc-900 border border-zinc-800/80 hover:border-indigo-500/50 transition-all group">
              <div className="h-12 w-12 rounded-2xl bg-purple-500/10 border border-purple-500/25 flex items-center justify-center text-purple-400 mb-6 group-hover:scale-110 transition-transform">
                <BarChart3 className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">Latency-Window Scoring</h3>
              <p className="text-zinc-400 text-sm leading-relaxed">
                Measure response latency and hesitation windows down to the millisecond. Eliminate verbal fillers and awkward silences before they disrupt your flow.
              </p>
            </div>

            {/* Card 3 */}
            <div className="p-8 rounded-3xl bg-zinc-900 border border-zinc-800/80 hover:border-indigo-500/50 transition-all group">
              <div className="h-12 w-12 rounded-2xl bg-pink-500/10 border border-pink-500/25 flex items-center justify-center text-pink-400 mb-6 group-hover:scale-110 transition-transform">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">Unlocked 8-Minute Open Mic</h3>
              <p className="text-zinc-400 text-sm leading-relaxed">
                Progress through milestone levels to unlock extended unscripted speaking rooms. Receive deep AI evaluations on pacing, persuasiveness, and cadence.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto px-6 lg:px-16 py-8 border-t border-zinc-800/60 text-center text-sm text-zinc-500">
        <p>&copy; 2026 SpeakUp AI. All rights reserved.</p>
      </footer>
    </div>
  )
}
