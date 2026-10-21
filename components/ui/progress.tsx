'use client'

import { Progress as ProgressPrimitive } from 'radix-ui'
import type { ComponentProps } from 'react'
import { cn } from '@/src/lib/utils'

export function Progress({ className, value = 0, ...props }: ComponentProps<typeof ProgressPrimitive.Root>) {
  const percentage = Math.min(100, Math.max(0, value ?? 0))
  return <ProgressPrimitive.Root data-slot="progress" value={percentage} className={cn('relative h-2.5 w-full overflow-hidden rounded-full bg-muted', className)} {...props}><ProgressPrimitive.Indicator className="h-full w-full flex-1 rounded-full bg-current transition-transform duration-500 ease-out" style={{ transform: `translateX(-${100 - percentage}%)` }} /></ProgressPrimitive.Root>
}
