'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/src/lib/supabase/client'
import { Globe, Check, ArrowRight, Loader2, Sparkles } from 'lucide-react'

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
    <div className="flex flex-col min-h-screen bg-zinc-950 text-zinc-50 font-sans items-center justify-center p-6">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/25 text-indigo-300 text-xs font-semibold mb-4 tracking-wide uppercase">
            <Sparkles className="w-3.5 h-3.5" /> Single-Language Rule
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white mb-3">
            Choose Your Target Language
          </h1>
          <p className="text-zinc-400 text-base max-w-lg mx-auto">
            SpeakUp focuses your cognitive training on one active language at a time to maximize neural retention and fluency gains.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/25 text-rose-400 text-sm text-center">
            {error}
          </div>
        )}

        {/* Language Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          {LANGUAGES.map((lang) => {
            const isSelected = selectedLanguage === lang.id
            return (
              <div
                key={lang.id}
                onClick={() => setSelectedLanguage(lang.id)}
                className={`relative p-6 rounded-3xl border cursor-pointer transition-all flex flex-col justify-between ${
                  isSelected
                    ? 'bg-indigo-950/40 border-indigo-500 shadow-xl shadow-indigo-500/10 ring-2 ring-indigo-500/50'
                    : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700'
                }`}
              >
                <div className="flex items-center justify-between mb-4">
                  <span className="text-3xl">{lang.flag}</span>
                  <div
                    className={`w-6 h-6 rounded-full border flex items-center justify-center transition-colors ${
                      isSelected
                        ? 'bg-indigo-600 border-indigo-500 text-white'
                        : 'border-zinc-700 bg-zinc-950 text-transparent'
                    }`}
                  >
                    <Check className="w-3.5 h-3.5" />
                  </div>
                </div>

                <div>
                  <div className="flex items-baseline gap-2 mb-1">
                    <h3 className="text-lg font-bold text-white">{lang.name}</h3>
                    <span className="text-xs text-zinc-400 font-medium">{lang.native}</span>
                  </div>
                  <p className="text-xs text-zinc-400 leading-relaxed">{lang.description}</p>
                </div>
              </div>
            )
          })}
        </div>

        {/* Continue Button */}
        <button
          onClick={handleSaveLanguage}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-4 px-6 rounded-2xl shadow-xl shadow-indigo-600/25 transition-all hover:scale-[1.01] text-base disabled:opacity-50"
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
        </button>
      </div>
    </div>
  )
}
