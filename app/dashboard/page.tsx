'use client'

import { Button } from '@/components/ui/button'
import { VoiceIcon as Mic, StreakIcon as Flame, AchievementIcon as Award, EchoIcon, IdeaIcon, VolleyIcon, CompressIcon } from '@/components/icons/studio-icons'
import { Brand } from '@/components/shared/brand'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/src/lib/supabase/client'
import SessionRunner from '@/components/modules/SessionRunner'
import { Lock, Bell, Settings, Zap, CheckCircle2, ArrowRight, User as UserIcon, Fingerprint } from 'lucide-react'

const MODULE_CONFIGS = [
  {
    id: 'alibi',
    title: 'Alibi Interrogation',
    description: 'Defend your timeline, connect the clues, and tell a convincing story in English.',
    icon: Fingerprint,
    theme: 'studio-alibi',
    color: 'from-warning/20 to-coral/20 text-warning border-warning/30',
  },
  {
    id: 'shadowing',
    title: 'Echo-Shadowing',
    description: 'Master cadence and intonation matching through real-time audio repetition.',
    icon: EchoIcon,
    theme: 'studio-shadowing',
    color: 'from-info/20 to-primary/20 text-info border-info/30',
  },
  {
    id: 'circumlocution',
    title: 'Circumlocution',
    description: 'Explain complex concepts instantly when missing target vocabulary words.',
    icon: IdeaIcon,
    theme: 'studio-circumlocution',
    color: 'from-ai/20 to-ai/20 text-ai border-ai/30',
  },
  {
    id: 'ping_pong',
    title: 'Conversational Ping-Pong',
    description: 'Maintain dynamic turn-taking rhythm under cognitive interruption.',
    icon: VolleyIcon,
    theme: 'studio-ping-pong',
    color: 'from-success/20 to-success/20 text-success border-success/30',
  },
  {
    id: 'compressor',
    title: '4/3/2 Compressor',
    description: 'Deliver escalating speech compression under time pressure: 4m -> 3m -> 2m.',
    icon: CompressIcon,
    theme: 'studio-compressor',
    color: 'from-warning/20 to-coral/20 text-warning border-warning/30',
  },
]

export default function DashboardPage() {
  const [profile, setProfile] = useState<any>(null)
  const [moduleProgress, setModuleProgress] = useState<Record<string, any>>({})
  const [dailyQuests, setDailyQuests] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [selectedModule, setSelectedModule] = useState<any>(null)
  const [isRunnerOpen, setIsRunnerOpen] = useState(false)

  const router = useRouter()
  const supabase = createClient()

  async function loadDashboardData() {
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

    // Fetch module progress
    const { data: progressData } = await supabase
      .from('module_progress')
      .select('*')
      .eq('user_id', user.id)

    const progressMap: Record<string, any> = {}
    if (progressData) {
      progressData.forEach((p) => {
        progressMap[p.module_id] = p
      })
    }
    setModuleProgress(progressMap)

    // Fetch today's daily quest
    const today = new Date().toISOString().split('T')[0]
    const { data: questData } = await supabase
      .from('daily_quests')
      .select('*')
      .eq('user_id', user.id)
      .eq('date', today)
      .single()

    if (questData) {
      setDailyQuests(questData)
    }

    setLoading(false)
  }

  useEffect(() => {
    loadDashboardData()
  }, [router, supabase])

  const handleOpenModule = (mod: any) => {
    if (mod.id === 'alibi') {
      router.push('/practice/alibi')
      return
    }
    if (mod.id === 'shadowing') {
      router.push('/practice/shadowing')
      return
    }
    if (mod.id === 'circumlocution') {
      router.push('/practice/circumlocution')
      return
    }
    if (mod.id === 'ping_pong') {
      router.push('/practice/ping-pong')
      return
    }
    if (mod.id === 'compressor') {
      router.push('/practice/compressor')
      return
    }
    setSelectedModule(mod)
    setIsRunnerOpen(true)
  }

  const handleSessionCompleted = () => {
    loadDashboardData()
  }

  if (loading) {
    return (
      <div className="flex studio-page min-h-screen bg-background items-center justify-center text-muted-foreground">
        <div role="status" className="flex items-center gap-3">
          <div className="w-5 h-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <span>Loading your dashboard...</span>
        </div>
      </div>
    )
  }

  // Calculate total completed modules / daily quest count
  const completedModulesCount = Object.values(moduleProgress).filter((p: any) => p.completed).length
  const coreModulesCompleted = ['shadowing', 'circumlocution', 'ping_pong', 'compressor'].filter(id => moduleProgress[id]?.completed).length
  const isOpenMicUnlocked = coreModulesCompleted >= 4 || (dailyQuests && dailyQuests.completed)
  const dailyModulesCount = ['shadowing_count', 'circumlocution_count', 'ping_pong_count', 'compressor_count'].filter((field) => (dailyQuests?.[field] || 0) > 0).length

  return (
    <div className="flex flex-col studio-page min-h-screen bg-background text-foreground font-sans">
      {/* Top Navigation Bar */}
      <header className="flex flex-wrap items-center justify-between gap-3 px-4 lg:px-10 py-4 border-b border-border bg-background/90 backdrop-blur-xl sticky top-0 z-40">
        <div className="flex items-center gap-6">
          <Brand />

          {/* Active Language & Fluency Belt Badges */}
          <div className="hidden md:flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-card border border-border text-xs font-medium text-foreground">
              🌐 <span className="capitalize">{profile?.active_language || 'English'}</span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/25 text-xs font-semibold text-primary">
              <Award className="w-3.5 h-3.5 text-primary" /> Blue Belt
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          <div className="flex items-center gap-2 bg-card border border-border px-3 py-1.5 rounded-full text-xs font-medium text-warning">
            <Flame className="w-3.5 h-3.5 fill-warning" />
            <span>{profile?.streak_count || 0} Day Streak</span>
          </div>

          <Button variant="ghost"
            type="button"
            className="p-2 rounded-xl bg-card border border-border text-muted-foreground hover:text-foreground transition-colors relative"
            title="Notifications"
            aria-label="Notifications"
          >
            <Bell className="w-4 h-4" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-primary studio-attention" />
          </Button>

          <Button variant="ghost"
            type="button"
            className="p-2 rounded-xl bg-card border border-border text-muted-foreground hover:text-foreground transition-colors"
            title="Settings"
            aria-label="Settings"
          >
            <Settings className="w-4 h-4" />
          </Button>

          <div className="flex items-center gap-2.5 pl-2 border-l border-border">
            <div className="h-9 w-9 rounded-full bg-gradient-to-tr from-muted to-muted flex items-center justify-center text-foreground text-xs font-bold border border-border">
              {profile?.username?.[0]?.toUpperCase() || <UserIcon className="w-4 h-4" />}
            </div>
            <span className="text-sm font-semibold text-foreground hidden lg:inline">
              {profile?.username || 'Speaker'}
            </span>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main id="main-content" tabIndex={-1} className="flex-1 px-4 sm:px-8 py-8 sm:py-10 max-w-7xl mx-auto w-full">
        {/* Welcome Banner */}
        <div className="voice-canvas mb-7 p-6 sm:p-9 rounded-[2rem] border border-primary/15 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div>
              <span className="text-xs font-semibold text-primary tracking-wider uppercase mb-2 block">
                YOUR DAILY DOSE OF POSSIBILITY
              </span>
              <h1 className="text-3xl sm:text-4xl font-semibold text-foreground tracking-tight mb-3">
                Welcome back, {profile?.username || 'Speaker'}! 👋
              </h1>
              <p className="text-muted-foreground text-sm max-w-xl">
                Make a little room for your voice today. Explore, practice, and let your confidence grow with every session.
              </p>
            </div>
            <div className="flex items-center gap-4 bg-card/80 border border-border p-4 rounded-2xl backdrop-blur-sm">
              <div className="h-12 w-12 rounded-xl bg-warning/10 border border-warning/25 flex items-center justify-center text-warning">
                <Zap className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xs text-muted-foreground font-medium block">Total XP Earned</span>
                <span className="text-xl font-bold text-foreground">{profile?.total_xp || 0} XP</span>
              </div>
            </div>
          </div>
        </div>

        <div className="mb-7 grid gap-4 sm:grid-cols-3">
          <Card className="group flex items-center gap-4 p-5"><Flame className="size-12 text-warning" /><div><p className="text-xs text-muted-foreground">Keep showing up</p><p className="font-heading text-2xl font-semibold">{profile?.streak_count || 0} <span className="text-sm font-medium text-warning">day streak</span></p></div></Card>
          <Card className="group flex items-center gap-4 p-5"><Award className="size-12 text-ai" /><div><p className="text-xs text-muted-foreground">Milestones reached</p><p className="font-heading text-2xl font-semibold">{completedModulesCount}<span className="ml-2 text-sm font-medium text-muted-foreground">completed modules</span></p></div></Card>
          <Card className="p-5"><div className="mb-3 flex items-center justify-between gap-3"><p className="text-xs font-medium text-muted-foreground">Today’s practice</p><p className="font-heading text-lg font-semibold text-success">{dailyModulesCount} / 4</p></div><Progress value={dailyModulesCount / 4 * 100} aria-label="Today's completed practice modules" className="text-success" /><p className="mt-2 text-xs text-muted-foreground">Every session moves you forward.</p></Card>
        </div>

        {/* Open Mic Card (Unlocked or Locked) */}
        <div className={`mb-12 p-6 sm:p-8 rounded-3xl bg-card/90 border relative overflow-hidden transition-all ${isOpenMicUnlocked ? 'border-success/50 hover:border-success' : 'border-border group hover:border-border'}`}>
          <div className={`absolute top-0 right-0 -mt-8 -mr-8 w-48 h-48 rounded-full blur-2xl pointer-events-none ${isOpenMicUnlocked ? 'bg-success/10' : 'bg-destructive/5'}`} />
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 relative z-10">
            <div className="flex items-start gap-5">
              <div className={`h-14 w-14 rounded-2xl border flex items-center justify-center shrink-0 ${isOpenMicUnlocked ? 'bg-success/10 border-success/30 text-success' : 'bg-muted border-border text-muted-foreground'}`}>
                {isOpenMicUnlocked ? <Mic className="w-7 h-7" /> : <Lock className="w-7 h-7 text-warning" />}
              </div>
              <div>
                <div className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-semibold mb-2 ${isOpenMicUnlocked ? 'bg-success/10 border border-success/25 text-success' : 'bg-warning/10 border border-warning/25 text-warning'}`}>
                  {isOpenMicUnlocked ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Lock className="w-3 h-3" />}
                  {isOpenMicUnlocked ? 'Unlocked & Ready' : 'Locked Feature'}
                </div>
                <h2 className="text-xl font-bold text-foreground mb-1">Open Mic (Free AI Chat)</h2>
                <p className="text-muted-foreground text-sm">
                  {isOpenMicUnlocked ? 'Practice unscripted conversation with real-time AI feedback.' : 'Complete sessions across modules to unlock Open Mic'}
                </p>
              </div>
            </div>
            <Button variant="ghost"
              onClick={() => isOpenMicUnlocked && router.push('/open-mic')}
              disabled={!isOpenMicUnlocked}
              className={`flex items-center justify-center gap-2 font-semibold px-6 py-3.5 rounded-2xl text-sm transition-all ${isOpenMicUnlocked ? 'bg-success hover:bg-success text-foreground shadow-lg shadow-success/20 cursor-pointer' : 'bg-muted/50 border border-border/50 text-muted-foreground cursor-not-allowed'}`}
            >
              {isOpenMicUnlocked ? 'Launch Open Mic' : 'Locked'} {isOpenMicUnlocked ? <ArrowRight className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
            </Button>
          </div>
        </div>

        {/* Daily Quests & Modules Grid */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-foreground tracking-tight">Core Practice Modules</h2>
            <span className="text-xs text-muted-foreground font-medium">
              Daily Quests: {((dailyQuests?.shadowing_count || 0) > 0 ? 1 : 0) + ((dailyQuests?.circumlocution_count || 0) > 0 ? 1 : 0) + ((dailyQuests?.ping_pong_count || 0) > 0 ? 1 : 0) + ((dailyQuests?.compressor_count || 0) > 0 ? 1 : 0)}/4 Modules Today
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {MODULE_CONFIGS.map((mod) => {
              const IconComponent = mod.icon
              const prog = moduleProgress[mod.id] || {}
              const currentLevel = prog.current_level || 1
              const completedSessions = prog.completed_sessions_in_level || 0

              return (
                <div
                  key={mod.id}
                    className={`studio-module-card ${mod.theme} p-6 sm:p-8 rounded-3xl bg-card border border-border flex flex-col justify-between group`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-6">
                      <div className="size-20 rounded-3xl bg-module/10 text-module flex items-center justify-center">
                        <IconComponent className="size-14" />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="px-3 py-1 rounded-full bg-background border border-border text-xs font-semibold text-foreground">
                          Level {currentLevel}
                        </span>
                        <span className="px-3 py-1 rounded-full bg-primary/10 border border-primary/25 text-xs font-semibold text-primary">
                          {completedSessions}/15 completed
                        </span>
                      </div>
                    </div>

                    <h3 className="text-2xl font-semibold text-foreground mb-2 group-hover:text-module transition-colors">
                      {mod.title}
                    </h3>
                    <p className="text-muted-foreground text-sm leading-relaxed mb-6">
                      {mod.description}
                    </p>
                  </div>

                  <div className="mb-5"><div className="mb-2 flex justify-between text-xs text-muted-foreground"><span>Level {currentLevel} journey</span><span>{completedSessions} / 15 sessions</span></div><Progress value={completedSessions / 15 * 100} aria-label={`${mod.title} level progress`} className="text-module" /></div>
                  <Button variant="ghost"
                    onClick={() => handleOpenModule(mod)}
                    className="w-full flex items-center justify-center gap-2 bg-muted hover:bg-primary text-foreground hover:text-foreground font-semibold py-3.5 px-4 rounded-2xl border border-border hover:border-primary transition-all text-sm group/btn"
                  >
                    Start Session <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
                  </Button>
                </div>
              )
            })}
          </div>
        </div>
      </main>

      {/* Session Runner Modal */}
      {selectedModule && (
        <SessionRunner
          module={selectedModule}
          currentLevel={moduleProgress[selectedModule.id]?.current_level || 1}
          currentSession={(moduleProgress[selectedModule.id]?.completed_sessions_in_level || 0) + 1}
          isOpen={isRunnerOpen}
          onClose={() => {
            setIsRunnerOpen(false)
            setSelectedModule(null)
          }}
          onCompleted={handleSessionCompleted}
        />
      )}
    </div>
  )
}
