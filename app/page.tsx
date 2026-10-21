import Link from 'next/link'
import { ArrowDown, ArrowRight, Check, Sparkles } from 'lucide-react'
import { Brand } from '@/components/shared/brand'
import { StudioIcon, type StudioIconName } from '@/components/icons/studio-icons'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

const modules: { name: StudioIconName; title: string; description: string; label: string; theme: string }[] = [
  { name: 'echo', title: 'Find your rhythm', description: 'Listen, echo, and make natural cadence your own.', label: 'Echo-Shadowing', theme: 'studio-shadowing' },
  { name: 'idea', title: 'Think around the word', description: 'Find creative ways to express exactly what you mean.', label: 'Circumlocution', theme: 'studio-circumlocution' },
  { name: 'volley', title: 'Keep it flowing', description: 'Build confidence one spontaneous response at a time.', label: 'Conversational Ping-Pong', theme: 'studio-ping-pong' },
  { name: 'compress', title: 'Make every word count', description: 'Keep the meaning. Shape a clearer, sharper story.', label: '4/3/2 Compressor', theme: 'studio-compressor' },
]

export default function LandingPage() {
  return (
    <div className="studio-page min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur-xl">
        <nav aria-label="Main navigation" className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <Brand />
          <div className="flex items-center gap-2 sm:gap-5">
            <a href="#practice" className="hidden rounded-lg text-sm font-medium text-muted-foreground hover:text-primary md:block">Explore the studio</a>
            <Button variant="ghost" asChild className="hidden sm:inline-flex"><Link href="/login">Sign in</Link></Button>
            <Button asChild><Link href="/signup">Start learning <ArrowRight className="size-4" /></Link></Button>
          </div>
        </nav>
      </header>

      <main id="main-content" tabIndex={-1}>
        <section className="relative mx-auto grid max-w-7xl items-center gap-12 overflow-hidden px-5 pb-16 pt-14 sm:px-8 sm:pt-20 lg:grid-cols-[1.05fr_1fr] lg:gap-16 lg:pb-24">
          <div className="relative z-10">
            <Badge className="mb-7 gap-2 py-2"><Sparkles className="size-3.5" /> YOUR VOICE HAS POSSIBILITIES</Badge>
            <h1 className="max-w-2xl font-heading text-[clamp(2.8rem,5.3vw,4.9rem)] font-semibold leading-[1.06] tracking-[-.045em]">Big ideas.<br />Brave conversations.<br /><span className="hero-gradient">A voice that’s you.</span></h1>
            <p className="mt-7 max-w-lg text-base leading-8 text-muted-foreground sm:text-lg">A little practice can change how you show up. Find your flow with creative speaking exercises and thoughtful AI feedback.</p>
            <div className="mt-9 flex flex-wrap items-center gap-4">
              <Button size="lg" asChild className="group"><Link href="/signup">Step into your studio <ArrowRight className="transition-transform group-hover:translate-x-1" /></Link></Button>
              <Button variant="ghost" size="lg" asChild><a href="#practice">Find your practice <ArrowDown className="size-4" /></a></Button>
            </div>
            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-xs font-medium text-muted-foreground"><span className="flex items-center gap-1.5"><Check className="size-4 text-success" /> Guided practice</span><span className="flex items-center gap-1.5"><Check className="size-4 text-success" /> Personalized feedback</span><span className="flex items-center gap-1.5"><Check className="size-4 text-success" /> At your own pace</span></div>
          </div>

          <div className="voice-canvas relative mx-auto flex min-h-[420px] w-full max-w-xl items-center justify-center rounded-[2.5rem] border border-primary/15 px-7 py-16 sm:min-h-[490px]" aria-label="Explore four ways to strengthen your voice">
            <div className="voice-orbit absolute size-64 rounded-full border border-primary/15 sm:size-80" aria-hidden="true" />
            <div className="voice-orbit absolute size-44 rounded-full border border-primary/20 sm:size-56" aria-hidden="true" />
            <div className="group relative z-10 flex size-32 items-center justify-center rounded-[2.4rem] border border-primary/20 bg-primary text-primary-foreground shadow-2xl shadow-primary/20 sm:size-40"><StudioIcon name="voice" className="size-24 sm:size-28" /></div>
            <div className="voice-sticker absolute left-4 top-7 -rotate-6 bg-card text-info sm:left-7"><StudioIcon name="echo" className="size-12" /><div><span className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Find your rhythm</span><span className="font-heading text-lg font-semibold">Listen. Echo. Grow.</span></div></div>
            <div className="voice-sticker absolute bottom-8 right-3 rotate-3 bg-card text-success sm:right-5"><StudioIcon name="volley" className="size-12" /><div><span className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Build connection</span><span className="font-heading text-lg font-semibold">Let’s talk possibility.</span></div></div>
            <div className="group absolute right-6 top-28 rounded-2xl border border-ai/20 bg-card p-3 text-ai sm:right-9"><StudioIcon name="idea" className="size-12" /></div>
            <div className="group absolute bottom-28 left-7 rounded-2xl border border-coral/20 bg-card p-3 text-coral sm:left-12"><StudioIcon name="compress" className="size-12" /></div>
            <span className="absolute bottom-4 left-6 text-[10px] font-semibold uppercase tracking-[.22em] text-muted-foreground">The SpeakUp voice studio</span>
          </div>
        </section>

        <section id="practice" className="scroll-mt-24 border-y border-border bg-card/50 px-5 py-16 sm:px-8 sm:py-20">
          <div className="mx-auto max-w-7xl">
            <div className="mb-10 flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="text-xs font-bold uppercase tracking-[.2em] text-primary">FOUR WAYS TO FIND YOUR FLOW</p><h2 className="mt-3 font-heading text-3xl font-semibold tracking-tight sm:text-4xl">A practice for every possibility.</h2></div><p className="max-w-sm text-sm leading-7 text-muted-foreground">From finding the right words to speaking on the spot, build confidence through doing.</p></div>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{modules.map((module, index) => <Card key={module.name} className={`studio-module-card group flex flex-col p-6 ${module.theme}`}><div className="mb-8 flex items-start justify-between"><span className="rounded-2xl bg-module/10 p-3 text-module"><StudioIcon name={module.name} className="size-12" /></span><span className="font-heading text-xs text-muted-foreground">0{index + 1}</span></div><p className="text-[10px] font-bold uppercase tracking-wider text-module">{module.label}</p><h3 className="mb-3 mt-2 font-heading text-xl font-semibold">{module.title}</h3><p className="mb-6 flex-1 text-sm leading-7 text-muted-foreground">{module.description}</p><Button variant="ghost" asChild className="justify-between px-0 text-module hover:bg-transparent"><Link href="/signup">Give it a go <ArrowRight className="size-4" /></Link></Button></Card>)}</div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20">
          <div className="grid gap-10 lg:grid-cols-[.8fr_1.2fr]"><div><p className="text-xs font-bold uppercase tracking-[.2em] text-ai">GROW WITH EVERY SESSION</p><h2 className="mt-3 font-heading text-3xl font-semibold leading-tight sm:text-4xl">Small steps.<br /><span className="text-ai">A stronger voice.</span></h2><p className="mt-5 max-w-sm text-sm leading-7 text-muted-foreground">A supportive loop of practice, insight, and progress. Make room for learning, one session at a time.</p></div><div className="space-y-4">{[{ icon: 'echo', title: 'Practice with a purpose', text: 'Choose a module and work through a focused speaking challenge.' }, { icon: 'idea', title: 'Discover what to improve', text: 'Review your response and the feedback available for your exercise.' }, { icon: 'achievement', title: 'See your effort add up', text: 'Follow your existing session milestones, XP, and learning progress.' }].map((item, index) => <Card key={item.title} className="group flex items-center gap-5 p-5 sm:p-6"><StudioIcon name={item.icon as StudioIconName} className="size-12 text-ai" /><div><p className="mb-1 text-[10px] font-semibold text-muted-foreground">STEP 0{index + 1}</p><h3 className="font-heading text-lg font-semibold">{item.title}</h3><p className="mt-1 text-sm leading-6 text-muted-foreground">{item.text}</p></div></Card>)}</div></div>
          <div className="voice-canvas mt-16 rounded-[2rem] border border-primary/15 px-6 py-10 text-center sm:px-12"><h2 className="font-heading text-3xl font-semibold sm:text-4xl">Your next conversation starts here.</h2><p className="mb-7 mt-3 text-muted-foreground">Bring your curiosity. We’ll bring the practice.</p><Button size="lg" asChild><Link href="/signup">Start learning <ArrowRight /></Link></Button></div>
        </section>
      </main>
      <footer className="border-t border-border px-5 py-8 sm:px-8"><div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-5 sm:flex-row"><Brand /><p className="text-xs text-muted-foreground">© 2026 SpeakUp. Make space for your voice.</p><Link href="/login" className="text-sm font-semibold text-primary">Already learning? Sign in <span aria-hidden="true">↗</span></Link></div></footer>
    </div>
  )
}
