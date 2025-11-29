// Hook for fetching high scores
import { useState, useEffect, useCallback } from 'react';
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

  const fetchHighScores = useCallback(async () => {
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

      // Transform data to match HighScore interface
      // Supabase returns profiles as an array, but we expect a single object
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const transformedData = (data || []).map((item: any) => ({
        ...item,
        profiles: Array.isArray(item.profiles) && item.profiles.length > 0 
          ? item.profiles[0] 
          : item.profiles || { username: '', avatar_url: null }
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
      // Insert the score
      const { error: insertError } = await supabase
        .from('scores')
        .insert({ user_id: userId, score });

      if (insertError) {
        throw insertError;
      }

      // Calculate rank by counting scores higher than this one
      const { data, error: rankError } = await supabase
        .from('scores')
        .select('id')
        .gt('score', score)
        .order('score', { ascending: false });

      if (rankError) {
        throw rankError;
      }

      // Rank is the number of scores higher + 1
      const rank = (data?.length || 0) + 1;

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