'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/src/lib/supabase/client'
import {
  Mic,
  Lock,
  Bell,
  Settings,
  Flame,
  Award,
  Zap,
  Volume2,
  Repeat,
  MessageSquare,
  Timer,
  CheckCircle2,
  ArrowRight,
  User as UserIcon,
} from 'lucide-react'

const MODULES = [
  {
    id: 'echo-shadowing',
    title: 'Echo-Shadowing',
    description: 'Master cadence and intonation matching through real-time audio repetition.',
    icon: Volume2,
    color: 'from-blue-500/20 to-indigo-500/20 text-blue-400 border-blue-500/30',
    level: 'Level 1',
    progress: '0/3 completed',
  },
  {
    id: 'circumlocution',
    title: 'Circumlocution',
    description: 'Explain complex concepts instantly when missing target vocabulary words.',
    icon: Repeat,
    color: 'from-purple-500/20 to-pink-500/20 text-purple-400 border-purple-500/30',
    level: 'Level 1',
    progress: '0/3 completed',
  },
  {
    id: 'conversational-ping-pong',
    title: 'Conversational Ping-Pong',
    description: 'Maintain dynamic turn-taking rhythm under cognitive interruption.',
    icon: MessageSquare,
    color: 'from-emerald-500/20 to-teal-500/20 text-emerald-400 border-emerald-500/30',
    level: 'Level 1',
    progress: '0/3 completed',
  },
  {
    id: 'compressor-432',
    title: '4/3/2 Compressor',
    description: 'Deliver escalating speech compression under time pressure: 4m -> 3m -> 2m.',
    icon: Timer,
    color: 'from-amber-500/20 to-orange-500/20 text-amber-400 border-amber-500/30',
    level: 'Level 1',
    progress: '0/3 completed',
  },
]

export default function DashboardPage() {
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function loadProfile() {
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) {
        router.push('/signup')
        return
      }

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (profileError || !profileData || !profileData.active_language) {
        router.push('/onboarding/language')
        return
      }

      setProfile(profileData)
      setLoading(false)
    }

    loadProfile()
  }, [router, supabase])

  if (loading) {
    return (
      <div className="flex min-h-screen bg-zinc-950 items-center justify-center text-zinc-400">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
          <span>Loading your dashboard...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen bg-zinc-950 text-zinc-50 font-sans">
      {/* Top Navigation Bar */}
      <header className="flex items-center justify-between px-6 lg:px-16 py-4 border-b border-zinc-800/60 bg-zinc-950/80 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-md shadow-indigo-500/20">
              <Mic className="w-4 h-4 text-white" />
            </div>
            <span className="text-lg font-bold tracking-tight text-white hidden sm:inline">
              SpeakUp
            </span>
          </div>

          {/* Active Language & Fluency Belt Badges */}
          <div className="hidden md:flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-xs font-medium text-zinc-300">
              🌐 <span className="capitalize">{profile?.active_language || 'English'}</span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/25 text-xs font-semibold text-indigo-300">
              <Award className="w-3.5 h-3.5 text-indigo-400" /> Blue Belt
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded-full text-xs font-medium text-amber-400">
            <Flame className="w-3.5 h-3.5 fill-amber-400" />
            <span>{profile?.streak_count || 0} Day Streak</span>
          </div>

          <button
            type="button"
            className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white transition-colors relative"
            title="Notifications"
          >
            <Bell className="w-4 h-4" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
          </button>

          <button
            type="button"
            className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white transition-colors"
            title="Settings"
          >
            <Settings className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2.5 pl-2 border-l border-zinc-800">
            <div className="h-9 w-9 rounded-full bg-gradient-to-tr from-zinc-800 to-zinc-700 flex items-center justify-center text-white text-xs font-bold border border-zinc-700">
              {profile?.username?.[0]?.toUpperCase() || <UserIcon className="w-4 h-4" />}
            </div>
            <span className="text-sm font-semibold text-zinc-200 hidden lg:inline">
              {profile?.username || 'Speaker'}
            </span>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 px-6 lg:px-16 py-10 max-w-7xl mx-auto w-full">
        {/* Welcome Banner */}
        <div className="mb-10 p-8 rounded-3xl bg-gradient-to-r from-indigo-950/40 via-purple-950/20 to-zinc-900 border border-indigo-500/20 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div>
              <span className="text-xs font-semibold text-indigo-400 tracking-wider uppercase mb-2 block">
                Daily Training Hub
              </span>
              <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight mb-2">
                Welcome back, {profile?.username || 'Speaker'}! 👋
              </h1>
              <p className="text-zinc-400 text-sm max-w-xl">
                Complete your daily module sessions to maintain your streak, earn XP, and unlock unscripted Open Mic rooms.
              </p>
            </div>
            <div className="flex items-center gap-4 bg-zinc-900/80 border border-zinc-800 p-4 rounded-2xl backdrop-blur-sm">
              <div className="h-12 w-12 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-center text-amber-400">
                <Zap className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xs text-zinc-400 font-medium block">Total XP Earned</span>
                <span className="text-xl font-bold text-white">{profile?.total_xp || 0} XP</span>
              </div>
            </div>
          </div>
        </div>

        {/* Blocked Open Mic Card */}
        <div className="mb-12 p-6 sm:p-8 rounded-3xl bg-zinc-900/90 border border-zinc-800 relative overflow-hidden group hover:border-zinc-700 transition-all">
          <div className="absolute top-0 right-0 -mt-8 -mr-8 w-48 h-48 bg-rose-500/5 rounded-full blur-2xl pointer-events-none" />
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 relative z-10">
            <div className="flex items-start gap-5">
              <div className="h-14 w-14 rounded-2xl bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-400 shrink-0">
                <Lock className="w-7 h-7 text-amber-400" />
              </div>
              <div>
                <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/25 text-amber-400 text-xs font-semibold mb-2">
                  <Lock className="w-3 h-3" /> Locked Feature
                </div>
                <h2 className="text-xl font-bold text-white mb-1">Open Mic (Free AI Chat)</h2>
                <p className="text-zinc-400 text-sm">
                  Complete 3 sessions across each module to unlock Open Mic
                </p>
              </div>
            </div>
            <button
              disabled
              className="flex items-center justify-center gap-2 bg-zinc-800/50 border border-zinc-700/50 text-zinc-500 font-semibold px-6 py-3.5 rounded-2xl text-sm cursor-not-allowed"
            >
              Locked <Lock className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Daily Quests & Modules Grid */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-white tracking-tight">Core Practice Modules</h2>
            <span className="text-xs text-zinc-400 font-medium">Daily Target: 0/3 Completed</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {MODULES.map((mod) => {
              const IconComponent = mod.icon
              return (
                <div
                  key={mod.id}
                  className="p-6 sm:p-8 rounded-3xl bg-zinc-900 border border-zinc-800 hover:border-indigo-500/50 transition-all flex flex-col justify-between group"
                >
                  <div>
                    <div className="flex items-center justify-between mb-6">
                      <div className={`h-12 w-12 rounded-2xl border flex items-center justify-center ${mod.color}`}>
                        <IconComponent className="w-6 h-6" />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="px-3 py-1 rounded-full bg-zinc-950 border border-zinc-800 text-xs font-semibold text-zinc-300">
                          {mod.level}
                        </span>
                        <span className="px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/25 text-xs font-semibold text-indigo-300">
                          {mod.progress}
                        </span>
                      </div>
                    </div>

                    <h3 className="text-xl font-bold text-white mb-2 group-hover:text-indigo-400 transition-colors">
                      {mod.title}
                    </h3>
                    <p className="text-zinc-400 text-sm leading-relaxed mb-6">
                      {mod.description}
                    </p>
                  </div>

                  <button
                    onClick={() => router.push(`/practice/${mod.id}`)}
                    className="w-full flex items-center justify-center gap-2 bg-zinc-800 hover:bg-indigo-600 text-zinc-200 hover:text-white font-semibold py-3.5 px-4 rounded-2xl border border-zinc-700 hover:border-indigo-500 transition-all text-sm group/btn"
                  >
                    Start Session <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      </main>
    </div>
  )
}
