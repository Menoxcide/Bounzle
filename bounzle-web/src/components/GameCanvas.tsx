'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Game from '@/bounzle-game/Game';
import { useLevelGenerator } from '@/hooks/useLevelGenerator';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { useHighScores } from '@/hooks/useHighScores';
import { admobService } from '@/lib/admob';
import RewardedAdButton from '@/components/RewardedAdButton';

export default function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const { toast } = useToast();
  const { user } = useSupabaseAuth();
  const { saveScore } = useHighScores();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [finalScore, setFinalScore] = useState(0);
  const [rank, setRank] = useState<number | null>(null);
  const [isMuted, setIsMuted] = useState(false);

  // Handle level generation
  const { generateLevel } = useLevelGenerator();

  const handleScoreUpdate = useCallback((score: number) => {
    // Score is displayed in the game itself
    console.log('Score updated:', score);
  }, []);

  const handleGameOver = useCallback(async (score: number) => {
    setFinalScore(score);
    setIsDialogOpen(true);

    // Save score to Supabase
    if (user) {
      try {
        const newRank = await saveScore(user.id, score);
        setRank(newRank);
      } catch (error) {
        console.error('Failed to save score:', error);
      }
    }

    // Show game over toast
    toast({
      title: "Game Over!",
      description: `Your score: ${score}`,
    });
  }, [user, saveScore, toast]);

  // Initialize AdMob
  useEffect(() => {
    const initAdMob = async () => {
      try {
        await admobService.initialize();
        admobService.showBannerAd();
      } catch (error) {
        console.error('Failed to initialize AdMob:', error);
      }
    };

    initAdMob();

    // Cleanup AdMob when component unmounts
    return () => {
      admobService.hideBannerAd();
    };
  }, []);

  // Initialize game
  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const game = new Game(canvas, {
      onGameOver: handleGameOver,
      onScoreUpdate: handleScoreUpdate
    });

    gameRef.current = game;

    // Clean up
    return () => {
      game.destroy();
    };
  }, [handleGameOver, handleScoreUpdate]);

  useEffect(() => {
    if (!gameRef.current) return;

    const handleLevelGeneration = async () => {
      if (gameRef.current) {
        try {
          // Generate level data (game will use procedural generation as fallback)
          const levelData = await generateLevel(Math.floor(Math.random() * 10000), 0);
          if (levelData && gameRef.current) {
            gameRef.current.loadLevelData(levelData);
          }
        } catch (error) {
          console.error('Failed to generate level:', error);
          // Game will use procedural generation as fallback
        }
      }
    };

    // Generate initial level immediately (game will start with procedural obstacles if this fails)
    handleLevelGeneration();

    // Set up interval for continuous level generation (every 10 seconds)
    const interval = setInterval(() => {
      if (gameRef.current && gameRef.current.getStatus() === 'playing') {
        handleLevelGeneration();
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [generateLevel]);

  const restartGame = () => {
    if (gameRef.current) {
      gameRef.current.start();
      setIsDialogOpen(false);
      setRank(null);
    }
  };

  const toggleMute = () => {
    if (gameRef.current) {
      gameRef.current.setSoundEnabled(!isMuted);
      setIsMuted(!isMuted);
    }
  };

  const handleReward = (seconds: number) => {
    if (gameRef.current) {
      gameRef.current.addExtraTime(seconds);
      toast({
        title: "Extra Time!",
        description: `You gained ${seconds} extra seconds!`,
      });
    }
  };

  return (
    <div className="relative w-full h-screen overflow-hidden bg-gradient-to-b from-slate-900 to-slate-800">
      <canvas 
        ref={canvasRef} 
        className="w-full h-full"
        style={{ imageRendering: 'pixelated' }}
      />
      
      {/* Mute button */}
      <Button
        variant="outline"
        size="icon"
        className="absolute top-4 right-4 bg-slate-800/80 backdrop-blur-sm"
        onClick={toggleMute}
      >
        {isMuted ? '🔇' : '🔊'}
      </Button>
      
      {/* Game Over Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="bg-slate-800 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white">Game Over</DialogTitle>
            <DialogDescription className="text-slate-400">
              Your final score and leaderboard rank.
            </DialogDescription>
          </DialogHeader>
          <CardContent className="space-y-4">
            <div className="text-center py-4">
              <p className="text-2xl font-bold text-white">Score: {finalScore}</p>
              {rank && (
                <p className="text-lg text-purple-400 mt-2">
                  Your rank: #{rank}
                </p>
              )}
            </div>
            
            <div className="flex flex-col gap-3">
              <RewardedAdButton onReward={handleReward} />
              
              <Button 
                onClick={restartGame}
                className="bg-purple-600 hover:bg-purple-700 text-white"
              >
                Play Again
              </Button>
              
              <Button 
                variant="outline" 
                onClick={() => setIsDialogOpen(false)}
                className="border-slate-600 text-slate-300 hover:bg-slate-700"
              >
                Close
              </Button>
            </div>
          </CardContent>
        </DialogContent>
      </Dialog>
    </div>
  );
}