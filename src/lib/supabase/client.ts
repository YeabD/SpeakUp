import { createBrowserClient } from '@supabase/ssr'
import { Database } from './database.types'

let client: ReturnType<typeof createBrowserClient<Database>> | null = null

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key'

  if (!client) {
    client = createBrowserClient<Database>(supabaseUrl, supabaseKey)
  }
  return client
}
