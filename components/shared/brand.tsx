import Link from 'next/link'
import { VoiceIcon } from '@/components/icons/studio-icons'
import { cn } from '@/src/lib/utils'

export function Brand({ className }: { className?: string }) {
  return <Link href="/" className={cn('group inline-flex shrink-0 items-center gap-2.5 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', className)} aria-label="SpeakUp home"><span className="flex size-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-md shadow-primary/15"><VoiceIcon className="size-8" /></span><span className="font-heading text-2xl font-semibold tracking-tight text-foreground">Speak<span className="text-primary">Up</span><span className="ml-1 inline-block size-1.5 rounded-full bg-coral" /></span></Link>
}
