import type { ComponentProps } from 'react'
import { cn } from '@/src/lib/utils'

export function Input({ className, type, ...props }: ComponentProps<'input'>) {
  return <input data-slot="input" type={type} className={cn('flex min-h-11 w-full rounded-xl border border-input bg-background/70 px-3.5 py-3 text-base text-foreground shadow-xs outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive', className)} {...props} />
}
