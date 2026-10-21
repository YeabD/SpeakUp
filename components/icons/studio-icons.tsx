import type { SVGProps } from 'react'
import { cn } from '@/src/lib/utils'

export type StudioIconName = 'voice' | 'echo' | 'idea' | 'volley' | 'compress' | 'achievement' | 'streak'
type Props = SVGProps<SVGSVGElement> & { name: StudioIconName; active?: boolean }

/** Original SpeakUp artwork. Animation uses CSS and follows focus/hover or an existing activity state. */
export function StudioIcon({ name, active = false, className, ...props }: Props) {
  return <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" className={cn('studio-icon', `studio-icon-${name}`, active && 'studio-icon-active', className)} {...props}>
    {name === 'voice' && <><rect x="23" y="8" width="18" height="32" rx="9" fill="currentColor" fillOpacity=".13" /><path className="icon-wave" d="M16 29v3a16 16 0 0 0 32 0v-3M32 48v8m-8 0h16" /><path d="M29 17h6m-6 7h6" /><path className="icon-spark" d="m49 11 2-5 2 5 5 2-5 2-2 5-2-5-5-2z" fill="currentColor" stroke="none" /></>}
    {name === 'echo' && <><path d="M12 35v-7a20 20 0 0 1 40 0v7" /><rect x="8" y="28" width="10" height="19" rx="5" fill="currentColor" fillOpacity=".18" /><rect x="46" y="28" width="10" height="19" rx="5" fill="currentColor" fillOpacity=".18" /><g className="icon-wave"><path d="M26 27v14m6-20v26m6-20v14" /><circle cx="32" cy="53" r="2" fill="currentColor" stroke="none" /></g></>}
    {name === 'idea' && <><path d="M23 40c0-5-9-7-9-18a18 18 0 0 1 36 0c0 11-9 13-9 18" fill="currentColor" fillOpacity=".12" /><path d="M23 40h18v7H23zm3 7v6h12v-6" /><path className="icon-draw" d="m24 25 8 7 8-7M32 32v8" /><g className="icon-spark"><path d="M6 18H2m58 0h-4M9 5 6 2m49 3 3-3" /></g></>}
    {name === 'volley' && <><path d="M7 13h28a5 5 0 0 1 5 5v11a5 5 0 0 1-5 5H21l-9 8v-8H7a5 5 0 0 1-5-5V18a5 5 0 0 1 5-5Z" fill="currentColor" fillOpacity=".14" /><path d="M45 24h11a5 5 0 0 1 5 5v13a5 5 0 0 1-5 5h-4v8l-9-8H32a5 5 0 0 1-5-5" /><circle className="icon-ball" cx="20" cy="24" r="4" fill="currentColor" stroke="none" /><path d="M45 35h8m-15 5h15" /></>}
    {name === 'compress' && <><path d="M8 9h48L39 34v18l-14 6V34Z" fill="currentColor" fillOpacity=".12" /><g className="icon-compress"><path d="M17 17h30m-25 7h20m-15 7h10" /></g><path className="icon-spark" d="M5 44h8m-4-4v8m42-9h8m-4-4v8" /></>}
    {name === 'achievement' && <><path d="m20 43-5 16 17-8 17 8-5-16" fill="currentColor" fillOpacity=".12" /><path d="m32 4 7 5 9 1 2 9 5 7-5 7-2 9-9 2-7 5-7-5-9-2-2-9-5-7 5-7 2-9 9-1Z" fill="currentColor" fillOpacity=".15" /><path className="icon-draw" d="m22 26 7 7 14-15" /></>}
    {name === 'streak' && <><path className="icon-flame" d="M35 5c3 14-12 15-9 26 4-2 7-6 8-9 10 6 17 13 14 23-3 11-20 15-29 6C6 38 19 24 21 17c1 8 4 9 5 10-1-9 6-13 9-22Z" fill="currentColor" fillOpacity=".17" /><path d="M30 41c-8 5-5 14 2 14 8 0 10-8 4-14 0 3-2 5-4 6Z" fill="currentColor" fillOpacity=".4" /></>}
  </svg>
}

type IconProps = Omit<Props, 'name'>
export function EchoIcon(props: IconProps) { return <StudioIcon name="echo" {...props} /> }
export function IdeaIcon(props: IconProps) { return <StudioIcon name="idea" {...props} /> }
export function VolleyIcon(props: IconProps) { return <StudioIcon name="volley" {...props} /> }
export function CompressIcon(props: IconProps) { return <StudioIcon name="compress" {...props} /> }
export function AchievementIcon(props: IconProps) { return <StudioIcon name="achievement" {...props} /> }
export function StreakIcon(props: IconProps) { return <StudioIcon name="streak" {...props} /> }
export function VoiceIcon(props: IconProps) { return <StudioIcon name="voice" {...props} /> }
