// Hook for fetching high scores
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';

export interface HighScore {
  id: number;
  score: number;
  created_at: string;
  user_id: string;
  profiles: {
    username: string;
    avatar_url: string | null;
  };
}

export const useHighScores = (limit: number = 10) => {
  const [scores, setScores] = useState<HighScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchHighScores();
    
    // Set up realtime subscription
    const channel = supabase
      .channel('high-scores-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'scores',
        },
        (payload) => {
          // Refresh scores when new ones are added
          fetchHighScores();
        }
      )
      .subscribe();

    // Clean up subscription
    return () => {
      supabase.removeChannel(channel);
    };
  }, [limit]);

  const fetchHighScores = async () => {
    try {
      setLoading(true);
      setError(null);
      
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
        .limit(limit);

      if (error) {
        throw error;
      }

      setScores(data || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      console.error('High scores fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  return { scores, loading, error, refresh: fetchHighScores };
};