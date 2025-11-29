// Hook for fetching high scores
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';

export interface HighScore {
  id: number;
  score: number;
  created_at: string;
  user_id: string;
  profiles: {
    username: string | null;
    avatar_url: string | null;
  };
}

export const useHighScores = (limit: number = 10) => {
  const [scores, setScores] = useState<HighScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHighScores = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Use API route instead of direct Supabase query to avoid join syntax issues
      const response = await fetch('/api/score');
      
      if (!response.ok) {
        throw new Error(`Failed to fetch leaderboard: ${response.statusText}`);
      }

      const data = await response.json();
      
      // Transform data to match HighScore interface and limit results
      const transformedData = (data || [])
        .slice(0, limit)
        .map((item: any) => ({
          ...item,
          profiles: item.profiles || { username: null, avatar_url: null }
        }));
      
      setScores(transformedData);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      console.error('High scores fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    fetchHighScores();
    
    // Set up realtime subscription for score updates
    const channel = supabase
      .channel('high-scores-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'scores',
        },
        () => {
          // Refresh scores when new ones are added
          fetchHighScores();
        }
      )
      .subscribe();

    // Clean up subscription
    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchHighScores]);

  const saveScore = async (userId: string, score: number): Promise<number> => {
    try {
      // Use API route to save score
      const response = await fetch('/api/score', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ score }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save score');
      }

      // Fetch all scores to calculate rank
      const allScoresResponse = await fetch('/api/score');
      if (!allScoresResponse.ok) {
        throw new Error('Failed to fetch scores for rank calculation');
      }

      const allScores = await allScoresResponse.json();
      
      // Calculate rank by counting scores higher than this one
      const rank = allScores.filter((s: HighScore) => s.score > score).length + 1;

      // Refresh the high scores list
      await fetchHighScores();

      return rank;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      console.error('Save score error:', err);
      throw new Error(`Failed to save score: ${errorMessage}`);
    }
  };

  return { scores, loading, error, refresh: fetchHighScores, saveScore };
};