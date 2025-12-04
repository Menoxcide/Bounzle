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

interface ScoreApiResponse {
  id: number;
  score: number;
  created_at: string;
  user_id: string;
  profiles: {
    username: string | null;
    avatar_url: string | null;
  } | null;
}

export const useHighScores = (limit: number = 10) => {
  const [scores, setScores] = useState<HighScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHighScores = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/score');
      
      if (!response.ok) {
        let errorMessage = `Failed to fetch leaderboard: ${response.statusText}`;
        try {
          const errorData = await response.json();
          if (errorData?.error) {
            errorMessage = errorData.error;
          }
        } catch {
        }
        
        setError(errorMessage);
        setScores([]);
        return;
      }

      const data = await response.json() as ScoreApiResponse[];
      
      const transformedData = (data || [])
        .slice(0, limit)
        .map((item: ScoreApiResponse): HighScore => ({
          ...item,
          profiles: item.profiles || { username: null, avatar_url: null }
        }));
      
      setScores(transformedData);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      setScores([]);
      if (process.env.NODE_ENV === 'development') {
        console.warn('High scores fetch error:', err);
      }
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    fetchHighScores();
    
    let channel: ReturnType<typeof supabase.channel> | null = null;
    
    try {
      channel = supabase
        .channel('high-scores-changes')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'scores',
          },
          () => {
            fetchHighScores();
          }
        )
        .subscribe((status) => {
          if (status === 'CHANNEL_ERROR') {
            if (process.env.NODE_ENV === 'development') {
              console.warn('Realtime subscription error - continuing without realtime updates');
            }
          }
        });
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('Failed to set up realtime subscription:', err);
      }
    }

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [fetchHighScores]);

  const saveScore = async (userId: string, score: number): Promise<number> => {
    try {
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

      const allScoresResponse = await fetch('/api/score');
      if (!allScoresResponse.ok) {
        throw new Error('Failed to fetch scores for rank calculation');
      }

      const allScores = await allScoresResponse.json() as HighScore[];
      
      const rank = allScores.filter((s) => s.score > score).length + 1;

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