// API route for saving scores
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { score } = await request.json()

    // Validate score
    if (typeof score !== 'number' || score < 0) {
      return NextResponse.json(
        { error: 'Invalid score. Score must be a positive number.' },
        { status: 400 }
      )
    }

    const supabase = await createSupabaseServerClient()

    // Get the user session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    
    if (sessionError || !session) {
      return NextResponse.json(
        { error: 'Unauthorized. Please log in to save your score.' },
        { status: 401 }
      )
    }

    // Insert score into database
    const { data, error } = await supabase
      .from('scores')
      .insert([
        {
          user_id: session.user.id,
          score: Math.floor(score), // Ensure integer score
          created_at: new Date().toISOString()
        }
      ])
      .select()

    if (error) {
      console.error('Error saving score:', error)
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

// GET endpoint to fetch leaderboard
export async function GET() {
  try {
    const supabase = await createSupabaseServerClient()
    
    // Fetch top 50 scores with user profiles
    const { data, error } = await supabase
      .from('scores')
      .select(`
        id,
        score,
        created_at,
        user_id,
        profiles(username, avatar_url)
      `)
      .order('score', { ascending: false })
      .limit(50)

    if (error) {
      console.error('Error fetching leaderboard:', error)
      return NextResponse.json(
        { error: 'Failed to fetch leaderboard. Please try again.' },
        { status: 500 }
      )
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Unexpected error fetching leaderboard:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred. Please try again.' },
      { status: 500 }
    )
  }
}