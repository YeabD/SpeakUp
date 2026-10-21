import type { ComponentProps } from 'react'
import { cn } from '@/src/lib/utils'

export function Alert({ className, ...props }: ComponentProps<'div'>) {
  return <div role="alert" data-slot="alert" className={cn('rounded-2xl border border-border bg-muted/60 p-4 text-sm leading-relaxed text-foreground', className)} {...props} />
}
