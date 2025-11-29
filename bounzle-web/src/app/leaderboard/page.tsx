'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth'
import { supabase } from '@/lib/supabase/client'

interface LeaderboardEntry {
  id: number;
  score: number;
  created_at: string;
  user_id: string;
  profiles: {
    username: string;
    avatar_url: string | null;
  };
}

export default function LeaderboardPage() {
  const [scores, setScores] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { user } = useSupabaseAuth()
  const [userRank, setUserRank] = useState<number | null>(null)

  useEffect(() => {
    fetchLeaderboard()
    
    // Set up realtime subscription
    const channel = supabase
      .channel('leaderboard-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'scores',
        },
        () => {
          // Add new score to the leaderboard
          fetchLeaderboard()
        }
      )
      .subscribe()

    // Clean up subscription
    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  useEffect(() => {
    if (user && scores.length > 0) {
      // Find user's rank
      const userScoreIndex = scores.findIndex(score => score.user_id === user.id)
      setUserRank(userScoreIndex >= 0 ? userScoreIndex + 1 : null)
    }
  }, [user, scores])

  const fetchLeaderboard = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/score')
      
      if (!response.ok) {
        throw new Error('Failed to fetch leaderboard')
      }
      
      const data = await response.json()
      setScores(data)
      setError(null)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred'
      setError(errorMessage)
      console.error('Leaderboard fetch error:', err)
    } finally {
      setLoading(false)
    }
  }

  const formatScore = (score: number): string => {
    return score.toLocaleString()
  }

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString)
    return date.toLocaleDateString()
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-blue-100 py-8">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-3xl md:text-4xl font-bold text-gray-800 mb-2">Leaderboard</h1>
            <p className="text-gray-600">Top scores from Bounzle players</p>
            
            {user && userRank && (
              <div className="mt-4 p-3 bg-blue-100 rounded-lg inline-block">
                <p className="text-blue-800 font-medium">
                  Your rank: <span className="font-bold">#{userRank}</span>
                </p>
              </div>
            )}
            
            <div className="mt-2 text-sm text-gray-500">
              Realtime updates enabled
            </div>
          </div>
          
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
              <p className="mt-4 text-gray-600">Loading leaderboard...</p>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-red-500 mb-4">{error}</p>
              <Button onClick={fetchLeaderboard}>Try Again</Button>
            </div>
          ) : scores.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-600">No scores yet. Be the first to play!</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
              <div className="grid grid-cols-12 gap-4 p-4 bg-blue-500 text-white font-bold">
                <div className="col-span-2">Rank</div>
                <div className="col-span-5">Player</div>
                <div className="col-span-3 text-right">Score</div>
                <div className="col-span-2 text-right">Date</div>
              </div>
              
              {scores.map((entry, index) => (
                <div 
                  key={entry.id} 
                  className={`grid grid-cols-12 gap-4 p-4 border-b ${
                    index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                  } ${user && entry.user_id === user.id ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''}`}
                >
                  <div className="col-span-2 flex items-center">
                    <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full ${
                      index === 0 ? 'bg-yellow-400 text-yellow-900' :
                      index === 1 ? 'bg-gray-300 text-gray-700' :
                      index === 2 ? 'bg-amber-600 text-amber-100' :
                      'bg-blue-100 text-blue-800'
                    } font-bold`}>
                      {index + 1}
                    </span>
                  </div>
                  <div className="col-span-5 flex items-center">
                    <div className="font-medium">
                      {entry.profiles.username || `Player ${entry.user_id.substring(0, 8)}`}
                    </div>
                  </div>
                  <div className="col-span-3 flex items-center justify-end font-bold text-lg">
                    {formatScore(entry.score)}
                  </div>
                  <div className="col-span-2 flex items-center justify-end text-gray-500 text-sm">
                    {formatDate(entry.created_at)}
                  </div>
                </div>
              ))}
            </div>
          )}
          
          <div className="mt-8 text-center">
            <Link href="/game">
              <Button className="mr-4">Play Game</Button>
            </Link>
            <Link href="/">
              <Button variant="outline">Back to Home</Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}