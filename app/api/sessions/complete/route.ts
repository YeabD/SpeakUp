import { NextResponse } from 'next/server'
import { createClient } from '@/src/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { module_type, level_number, session_number, accuracy_score } = body

    if (!module_type || level_number === undefined || session_number === undefined || accuracy_score === undefined) {
      return NextResponse.json({ error: 'Missing required fields: module_type, level_number, session_number, accuracy_score' }, { status: 400 })
    }

    if (!['shadowing', 'circumlocution', 'ping_pong', 'compressor'].includes(module_type)) {
      return NextResponse.json({ error: 'Invalid module_type' }, { status: 400 })
    }

    const numericAccuracy = Number(accuracy_score)
    if (!Number.isFinite(numericAccuracy) || numericAccuracy < 0 || numericAccuracy > 100) {
      return NextResponse.json({ error: 'accuracy_score must be between 0 and 100' }, { status: 400 })
    }
    if (module_type === 'shadowing' && numericAccuracy < 75) {
      return NextResponse.json(
        { error: 'Shadowing sessions require a score of at least 75%' },
        { status: 422 }
      )
    }

    // 1. Insert session record into level_sessions
    const { error: insertError } = await supabase.from('level_sessions').insert({
      user_id: user.id,
      module_type,
      level_number,
      session_number,
      accuracy_score: numericAccuracy,
      status: 'completed',
    })

    if (insertError) {
      console.error('Error inserting level session:', insertError)
      return NextResponse.json({ error: 'Failed to record session' }, { status: 500 })
    }

    // 2. Fetch or upsert today's daily_quests record and increment respective module counter
    const today = new Date().toISOString().split('T')[0]
    
    // Check existing daily quest for user today
    const { data: existingQuest, error: questFetchError } = await supabase
      .from('daily_quests')
      .select('*')
      .eq('user_id', user.id)
      .eq('date', today)
      .single()

    let counterField = 'shadowing_count'
    if (module_type === 'circumlocution') counterField = 'circumlocution_count'
    else if (module_type === 'ping_pong') counterField = 'ping_pong_count'
    else if (module_type === 'compressor') counterField = 'compressor_count'

    let dailyQuestsUpdated = true

    if (questFetchError || !existingQuest) {
      // Insert new daily quest record for today
      const insertPayload: any = {
        user_id: user.id,
        date: today,
        quest_type: 'daily_practice',
        completed: false,
        reward_xp: 50,
        shadowing_count: 0,
        circumlocution_count: 0,
        ping_pong_count: 0,
        compressor_count: 0,
      }
      insertPayload[counterField] = 1

      const { error: questInsertErr } = await supabase.from('daily_quests').insert(insertPayload)
      if (questInsertErr) {
        console.error('Error creating daily quest:', questInsertErr)
        dailyQuestsUpdated = false
      }
    } else {
      const currentCount = (existingQuest as any)[counterField] || 0
      const updatePayload: any = {}
      updatePayload[counterField] = currentCount + 1

      // Check if all module counters reach at least 1 (or desired daily goal)
      const newShadowing = module_type === 'shadowing' ? existingQuest.shadowing_count + 1 : existingQuest.shadowing_count
      const newCircumlocution = module_type === 'circumlocution' ? existingQuest.circumlocution_count + 1 : existingQuest.circumlocution_count
      const newPingPong = module_type === 'ping_pong' ? existingQuest.ping_pong_count + 1 : existingQuest.ping_pong_count
      const newCompressor = module_type === 'compressor' ? existingQuest.compressor_count + 1 : existingQuest.compressor_count

      if (newShadowing >= 1 && newCircumlocution >= 1 && newPingPong >= 1 && newCompressor >= 1) {
        updatePayload.completed = true
      }

      const { error: questUpdateErr } = await supabase
        .from('daily_quests')
        .update(updatePayload)
        .eq('id', existingQuest.id)

      if (questUpdateErr) {
        console.error('Error updating daily quest:', questUpdateErr)
        dailyQuestsUpdated = false
      }
    }

    // 3. Query all session scores in level_sessions for this user, module, and level
    const { data: levelSessionsData, error: sessionsQueryError } = await supabase
      .from('level_sessions')
      .select('accuracy_score, session_number')
      .eq('user_id', user.id)
      .eq('module_type', module_type)
      .eq('level_number', level_number)

    if (sessionsQueryError) {
      console.error('Error querying level sessions:', sessionsQueryError)
      return NextResponse.json({ error: 'Failed to calculate module progress' }, { status: 500 })
    }

    // Calculate average accuracy and unique completed sessions count
    const sessions = levelSessionsData || []
    const totalScore = sessions.reduce((acc, curr) => acc + (curr.accuracy_score || 0), 0)
    const average_accuracy = sessions.length > 0 ? Number((totalScore / sessions.length).toFixed(2)) : accuracy_score

    // Unique completed sessions in this level
    const uniqueSessionsCompleted = new Set(sessions.map(s => s.session_number)).size

    // 4. Check level unlock if session_number === 15
    let level_unlocked = false
    let current_level_val = level_number

    if (session_number === 15) {
      if (average_accuracy >= 75.0) {
        level_unlocked = true
        current_level_val = level_number + 1
      } else {
        level_unlocked = false
      }
    }

    const completed_sessions_in_level = level_unlocked ? 0 : uniqueSessionsCompleted

    // 5. Upsert module_progress
    const { data: existingProgress, error: progressFetchErr } = await supabase
      .from('module_progress')
      .select('*')
      .eq('user_id', user.id)
      .eq('module_id', module_type)
      .single()

    if (progressFetchErr || !existingProgress) {
      await supabase.from('module_progress').insert({
        user_id: user.id,
        module_id: module_type,
        current_level: current_level_val,
        completed_sessions_in_level,
        average_accuracy,
        completed: level_unlocked,
        score: average_accuracy,
      })
    } else {
      await supabase
        .from('module_progress')
        .update({
          current_level: level_unlocked ? current_level_val : existingProgress.current_level,
          completed_sessions_in_level,
          average_accuracy,
          completed: level_unlocked || existingProgress.completed,
          score: average_accuracy,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingProgress.id)
    }

    // 6. Award XP to profile if session completed successfully
    const xpGain = Math.round(numericAccuracy / 2) // e.g., 80 accuracy -> 40 XP
    const { data: profileData } = await supabase
      .from('profiles')
      .select('total_xp')
      .eq('id', user.id)
      .single()

    if (profileData) {
      await supabase
        .from('profiles')
        .update({ total_xp: (profileData.total_xp || 0) + xpGain })
        .eq('id', user.id)
    }

    return NextResponse.json({
      success: true,
      average_accuracy,
      level_unlocked,
      daily_quests_updated: dailyQuestsUpdated,
      completed_sessions_in_level,
      current_level: current_level_val,
    })
  } catch (err: any) {
    console.error('API /api/sessions/complete error:', err)
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 })
  }
}
