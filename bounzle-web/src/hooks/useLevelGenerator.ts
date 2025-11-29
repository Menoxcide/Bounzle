// Hook for fetching AI-generated level data
import { useState, useCallback } from 'react';
import { LevelData } from '@/bounzle-game/types';

interface UseLevelGeneratorReturn {
  generateLevel: (
    seed: number,
    checkpoint: number,
    previousGapY?: number,
    canvasHeight?: number
  ) => Promise<LevelData | null>;
  isLoading: boolean;
  error: string | null;
}

export const useLevelGenerator = (): UseLevelGeneratorReturn => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateLevel = useCallback(async (
    seed: number,
    checkpoint: number,
    previousGapY?: number,
    canvasHeight?: number
  ) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/level', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          seed,
          checkpoint,
          previousGapY,
          canvasHeight
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate level');
      }

      const levelData: LevelData = await response.json();
      return levelData;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      console.error('Level generation error:', err);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { generateLevel, isLoading, error };
};