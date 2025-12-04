// API route for saving scores
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { score } = await request.json()

    if (typeof score !== 'number' || score < 0) {
      return NextResponse.json(
        { error: 'Invalid score. Score must be a positive number.' },
        { status: 400 }
      )
    }

    const supabase = await createSupabaseServerClient()

    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    
    if (sessionError || !session) {
      return NextResponse.json(
        { error: 'Unauthorized. Please log in to save your score.' },
        { status: 401 }
      )
    }

    const { data, error } = await supabase
      .from('scores')
      .insert([
        {
          user_id: session.user.id,
          score: Math.floor(score),
          created_at: new Date().toISOString()
        }
      ])
      .select()

    if (error) {
      console.error('Error saving score:', error)
      
      if (error.code === 'PGRST205' || error.message?.includes('Could not find the table')) {
        return NextResponse.json(
          { 
            error: 'Database table not found. Please run the migration: supabase/migrations/20250101_create_scores.sql in your Supabase SQL Editor.',
            details: error.message 
          },
          { status: 500 }
        )
      }
      
      return NextResponse.json(
        { error: 'Failed to save score. Please try again.' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('Unexpected error saving score:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred. Please try again.' },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient()
    
    const { data: scoresData, error: scoresError } = await supabase
      .from('scores')
      .select('id, score, created_at, user_id')
      .order('score', { ascending: false })
      .limit(50)

    if (scoresError) {
      console.error('Error fetching scores:', scoresError)
      
      if (scoresError.code === 'PGRST205' || scoresError.message?.includes('Could not find the table')) {
        return NextResponse.json(
          { 
            error: 'Database table not found. Please run the migration: supabase/migrations/20250101_create_scores.sql in your Supabase SQL Editor.',
            details: scoresError.message 
          },
          { status: 500 }
        )
      }
      
      return NextResponse.json(
        { error: `Failed to fetch leaderboard: ${scoresError.message}` },
        { status: 500 }
      )
    }

    if (!scoresData || scoresData.length === 0) {
      return NextResponse.json([])
    }

    const userIds = scoresData.map(score => score.user_id).filter(Boolean)
    let profilesMap = new Map()
    
    if (userIds.length > 0) {
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, username, avatar_url')
        .in('id', userIds)
      
      if (profilesError) {
        console.warn('Error fetching profiles (continuing without profiles):', profilesError)
      } else if (profilesData) {
        profilesMap = new Map(profilesData.map(profile => [profile.id, profile]))
      }
    }

    const data = scoresData.map(score => ({
      ...score,
      profiles: profilesMap.get(score.user_id) || { username: null, avatar_url: null }
    }))

    return NextResponse.json(data)
  } catch (error) {
    console.error('Unexpected error fetching leaderboard:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: `An unexpected error occurred: ${errorMessage}` },
      { status: 500 }
    )
  }
}