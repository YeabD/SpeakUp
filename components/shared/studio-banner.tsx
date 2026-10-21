import { StudioIcon, type StudioIconName } from '@/components/icons/studio-icons'

const modules: Record<string, { name: StudioIconName; title: string; subtitle: string }> = {
  shadowing: { name: 'echo', title: 'Find your rhythm.', subtitle: 'Listen closely. Make every word your own.' },
  circumlocution: { name: 'idea', title: 'A different way to say it.', subtitle: 'Let curiosity lead. There is always another way.' },
  ping_pong: { name: 'volley', title: 'Keep the conversation flowing.', subtitle: 'One thoughtful response. One stronger connection.' },
  compressor: { name: 'compress', title: 'Less noise. More meaning.', subtitle: 'Keep the ideas. Sharpen the delivery.' },
}

export function StudioBanner({ module }: { module: keyof typeof modules }) {
  const item = modules[module]
  return <div className="studio-banner group mb-7 flex items-center gap-4 rounded-3xl border border-border px-5 py-5 sm:gap-6 sm:px-7"><div className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-module/10 text-module sm:size-20"><StudioIcon name={item.name} className="size-12 sm:size-14" /></div><div><p className="mb-1 text-[10px] font-bold uppercase tracking-[.2em] text-module">The SpeakUp voice studio</p><h2 className="font-heading text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{item.title}</h2><p className="mt-1 text-sm text-muted-foreground">{item.subtitle}</p></div></div>
}
