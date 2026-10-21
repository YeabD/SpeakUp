import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/src/lib/supabase/server'
import type { Attempt } from './contracts'
import type { Database } from '@/src/lib/supabase/database.types'

export class ApiError extends Error { constructor(message: string, public status = 500) { super(message) } }
export async function alibiServer() {
  const client = await createClient()
  const { data: { user } } = await client.auth.getUser()
  if (!user) throw new ApiError('Sign in to open your case file.', 401)
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!key || !url) throw new ApiError('Alibi persistence is not configured. Set SUPABASE_SERVICE_ROLE_KEY and apply the Alibi migration.', 503)
  const admin = createSupabaseClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  return { user, admin }
}
export async function getAttempt(admin: Awaited<ReturnType<typeof alibiServer>>['admin'], userId: string, id: string): Promise<Attempt> {
  const { data, error } = await admin.from('alibi_attempts').select('*').eq('id', id).eq('user_id', userId).single()
  if (error || !data) throw new ApiError('Case file not found.', 404)
  const { count, error: countError } = await admin.from('alibi_completions').select('*', { count: 'exact', head: true }).eq('user_id', userId)
  if (countError) throw new ApiError('Unable to load session progress.', 503)
  return { ...data, completed_sessions: count ?? 0 }
}
export function apiError(error: unknown): Response {
  console.error('Alibi API:', error)
  return Response.json({ error: error instanceof ApiError ? error.message : 'The case could not be updated. Please retry.' }, { status: error instanceof ApiError ? error.status : 500 })
}
