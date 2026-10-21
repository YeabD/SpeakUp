import { ArrowRight, ChevronDown } from 'lucide-react'

export function VocabularyUpgrade({ original_word, suggested_replacement, reason }: { original_word: string; suggested_replacement: string; reason: string }) {
  return <details className="group/upgrade rounded-xl border border-border bg-card/80 p-3"><summary className="flex list-none flex-wrap items-center gap-2 text-xs font-semibold"><span className="rounded-lg bg-destructive/10 px-2 py-1 text-destructive line-through">{original_word}</span><ArrowRight aria-hidden="true" className="size-3.5 text-muted-foreground" /><span className="rounded-lg bg-success/10 px-2 py-1 text-success">{suggested_replacement}</span><ChevronDown aria-hidden="true" className="ml-auto size-4 text-muted-foreground transition-transform group-open/upgrade:rotate-180" /><span className="sr-only">Why this word works better</span></summary><p className="mt-3 border-t border-border pt-3 text-xs leading-relaxed text-muted-foreground">{reason}</p></details>
}
