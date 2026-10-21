import type { ComponentProps } from 'react'
import { cn } from '@/src/lib/utils'

export function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  return <textarea data-slot="textarea" className={cn('flex min-h-28 w-full rounded-xl border border-input bg-background/70 px-4 py-3 text-base leading-relaxed text-foreground outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25 disabled:cursor-default disabled:opacity-70', className)} {...props} />
}
