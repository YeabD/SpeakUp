'use client'

import { useTheme } from 'next-themes'
import { DropdownMenu } from 'radix-ui'
import { Check, Monitor, Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  return <DropdownMenu.Root><DropdownMenu.Trigger asChild><Button variant="outline" size="icon" aria-label="Choose color theme" className="relative rounded-full"><Sun className="rotate-0 scale-100 transition-transform duration-300 dark:-rotate-90 dark:scale-0" /><Moon className="absolute rotate-90 scale-0 transition-transform duration-300 dark:rotate-0 dark:scale-100" /></Button></DropdownMenu.Trigger><DropdownMenu.Portal><DropdownMenu.Content align="end" sideOffset={8} className="z-[60] min-w-40 rounded-2xl border border-border bg-popover p-1.5 text-popover-foreground shadow-xl data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-top-2"><DropdownMenu.Label className="px-3 py-2 text-xs font-semibold text-muted-foreground">Your studio, your light</DropdownMenu.Label><DropdownMenu.RadioGroup value={theme ?? 'system'} onValueChange={setTheme}>{[{ value: 'light', label: 'Light', Icon: Sun }, { value: 'dark', label: 'Dark', Icon: Moon }, { value: 'system', label: 'System', Icon: Monitor }].map(({ value, label, Icon }) => <DropdownMenu.RadioItem key={value} value={value} className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm outline-none focus:bg-accent"><Icon className="size-4" />{label}<DropdownMenu.ItemIndicator className="ml-auto"><Check className="size-4 text-primary" /></DropdownMenu.ItemIndicator></DropdownMenu.RadioItem>)}</DropdownMenu.RadioGroup></DropdownMenu.Content></DropdownMenu.Portal></DropdownMenu.Root>
}
