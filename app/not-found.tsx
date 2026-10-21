import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Brand } from '@/components/shared/brand'
import { StudioIcon } from '@/components/icons/studio-icons'
import { Button } from '@/components/ui/button'

export default function NotFound() {
  return <main id="main-content" tabIndex={-1} className="studio-page flex min-h-screen flex-col items-center justify-center gap-7 bg-background px-6 py-16 text-center text-foreground"><Brand /><div className="group flex size-32 items-center justify-center rounded-[2rem] border border-ai/20 bg-ai/10 text-ai"><StudioIcon name="idea" className="size-24" /></div><div><p className="text-xs font-semibold uppercase tracking-[.2em] text-ai">404 · A little detour</p><h1 className="mt-4 font-heading text-4xl font-semibold tracking-tight">Let’s find your way back.</h1><p className="mx-auto mt-4 max-w-md text-sm leading-7 text-muted-foreground">This page isn’t part of the conversation. Your next learning moment is waiting back at SpeakUp.</p></div><Button asChild><Link href="/"><ArrowLeft /> Back to SpeakUp</Link></Button></main>
}
