'use client'

import { Button } from '@/components/ui/button'
import { Brand } from '@/components/shared/brand'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/src/lib/supabase/client'
import { Check, ArrowRight, Loader2, Sparkles } from 'lucide-react'

const LANGUAGES = [
  { id: 'english', name: 'English', native: 'English', flag: '🇺🇸', description: 'Master professional articulation & cognitive pacing.' },
  { id: 'spanish', name: 'Spanish', native: 'Español', flag: '🇪🇸', description: 'Develop fluency, rhythm, and spontaneous expression.' },
  { id: 'german', name: 'German', native: 'Deutsch', flag: '🇩🇪', description: 'Refine precision, structure, and complex phrasing.' },
  { id: 'french', name: 'French', native: 'Français', flag: '🇫🇷', description: 'Enhance cadence, modulation, and vocal elegance.' },
]

export default function ChooseLanguagePage() {
  const [selectedLanguage, setSelectedLanguage] = useState<string>('english')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  const handleSaveLanguage = async () => {
    setLoading(true)
    setError(null)

    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) {
        router.push('/signup')
        return
      }

      const { error: updateError } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          active_language: selectedLanguage,
          updated_at: new Date().toISOString(),
        })

      if (updateError) {
        setError(updateError.message)
        setLoading(false)
        return
      }

      router.push('/dashboard')
    } catch (err: any) {
      setError(err?.message || 'Failed to update active language.')
      setLoading(false)
    }
  }

  return (
    <main id="main-content" tabIndex={-1} className="flex flex-col studio-page min-h-screen bg-background text-foreground font-sans items-center justify-center p-6">
      <div className="w-full max-w-2xl">
        <div className="mb-9 flex justify-center"><Brand /></div>
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary/10 border border-primary/25 text-primary text-xs font-semibold mb-4 tracking-wide uppercase">
            <Sparkles className="w-3.5 h-3.5" /> Single-Language Rule
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground mb-3">
            A world of conversation awaits.
          </h1>
          <p className="text-muted-foreground text-base max-w-lg mx-auto">
            SpeakUp focuses your cognitive training on one active language at a time to maximize neural retention and fluency gains.
          </p>
        </div>

        {error && (
          <div role="alert" className="mb-6 p-4 rounded-2xl bg-destructive/10 border border-destructive/25 text-destructive text-sm text-center">
            {error}
          </div>
        )}

        {/* Language Grid */}
        <fieldset className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          <legend className="sr-only">Choose your target language</legend>
          {LANGUAGES.map((lang) => {
            const isSelected = selectedLanguage === lang.id
            return (
              <label
                key={lang.id}
                className={`group relative p-6 rounded-3xl border cursor-pointer transition-all flex flex-col justify-between focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background ${
                  isSelected
                    ? 'bg-primary/5 border-primary shadow-sm ring-1 ring-primary/40'
                    : 'bg-card border-border hover:border-border'
                }`}
              >
                <input className="sr-only" type="radio" name="language" value={lang.id} checked={isSelected} onChange={() => setSelectedLanguage(lang.id)} />
                <div className="flex items-center justify-between mb-4">
                  <span className="text-3xl">{lang.flag}</span>
                  <div
                    className={`w-6 h-6 rounded-full border flex items-center justify-center transition-colors ${
                      isSelected
                        ? 'bg-primary border-primary text-primary-foreground'
                        : 'border-border bg-background text-transparent'
                    }`}
                  >
                    <Check className="w-3.5 h-3.5" />
                  </div>
                </div>

                <div>
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="font-heading text-lg font-bold text-foreground">{lang.name}</span>
                    <span className="text-xs text-muted-foreground font-medium">{lang.native}</span>
                  </div>
                  <span className="text-xs text-muted-foreground leading-relaxed">{lang.description}</span>
                </div>
              </label>
            )
          })}
        </fieldset>

        {/* Continue Button */}
        <Button variant="ghost"
          onClick={handleSaveLanguage}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary text-foreground font-semibold py-4 px-6 rounded-2xl shadow-xl shadow-primary/25 transition-all hover:scale-[1.01] text-base disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" /> Saving language & entering dashboard...
            </>
          ) : (
            <>
              Continue to Dashboard <ArrowRight className="w-5 h-5" />
            </>
          )}
        </Button>
      </div>
    </main>
  )
}
