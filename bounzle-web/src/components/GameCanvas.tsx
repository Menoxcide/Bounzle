'use client';
/// <reference lib="dom" />

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
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
import { saveCheckpoint, loadCheckpoints, clearCheckpoints, findCheckpointBefore } from '@/lib/gameStateStorage';
import { GameStateSnapshot } from '@/bounzle-game/types';

export default function GameCanvas() {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const { toast } = useToast();
  const { user } = useSupabaseAuth();
  const { saveScore } = useHighScores();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [finalScore, setFinalScore] = useState(0);
  const [rank, setRank] = useState<number | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [continueCount, setContinueCount] = useState(0);
  const [isSavingScore, setIsSavingScore] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const retryCountRef = useRef(0);
  const sessionIdRef = useRef<string>(`session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
  const hasRecordedGameOverRef = useRef(false);
  const isInitializingRef = useRef(false);
  const gameInitializedRef = useRef(false);

  const { generateLevel } = useLevelGenerator();

  const userRef = useRef(user);
  const saveScoreRef = useRef(saveScore);
  const toastRef = useRef(toast);

  useEffect(() => {
    userRef.current = user;
    saveScoreRef.current = saveScore;
    toastRef.current = toast;
  }, [user, saveScore, toast]);

  const handleScoreUpdate = useCallback((score: number) => {
    console.log('Score updated:', score);
  }, []);

  const handleCheckpointSave = useCallback(async (snapshot: GameStateSnapshot) => {
    try {
      await saveCheckpoint(userRef.current?.id || null, sessionIdRef.current, snapshot);
    } catch (error) {
      console.error('Failed to save checkpoint:', error);
    }
  }, []);

  const handleGameOver = useCallback(async (score: number, isRetry: boolean = false) => {
    if (!isRetry && hasRecordedGameOverRef.current) {
      console.log('[GameCanvas] handleGameOver called but already recorded, ignoring');
      return;
    }

    console.log('[GameCanvas] handleGameOver called with score:', score, isRetry ? '(retry)' : '');
    setFinalScore(score);
    setSaveError(null);

    const currentUser = userRef.current;
    
    if (currentUser) {
      setIsDialogOpen(true);
      setIsSavingScore(true);
      
      try {
        const newRank = await saveScoreRef.current(currentUser.id, score);
        setRank(newRank);
        setIsSavingScore(false);
        
        hasRecordedGameOverRef.current = true;
        
        console.log('[GameCanvas] Score saved successfully');
        toastRef.current({
          title: "Game Over!",
          description: `Your score: ${score}${newRank ? ` - Rank: #${newRank}` : ''}`,
        });
      } catch (error) {
        setIsSavingScore(false);
        const errorMessage = error instanceof Error ? error.message : 'Failed to save score';
        console.error('[GameCanvas] Failed to save score:', error);
        setSaveError(errorMessage);
        
        if (retryCountRef.current < 3) {
          toastRef.current({
            title: "Score Save Failed",
            description: `${errorMessage}. You can retry from the dialog.`,
            variant: "destructive",
          });
        } else {
          hasRecordedGameOverRef.current = true;
          toastRef.current({
            title: "Score Save Failed",
            description: `Unable to save score after multiple attempts: ${errorMessage}`,
            variant: "destructive",
          });
        }
      }
    } else {
      console.log('[GameCanvas] No user logged in, skipping score save');
      hasRecordedGameOverRef.current = true;
      setIsDialogOpen(true);
      
      toastRef.current({
        title: "Game Over!",
        description: `Your score: ${score}. Log in to save your score to the leaderboard!`,
      });
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    const timeoutIds: Set<NodeJS.Timeout> = new Set();
    let idleCallbackId: number | null = null;
    
    const clearAllTimeouts = () => {
      for (const id of timeoutIds) {
        clearTimeout(id);
      }
      timeoutIds.clear();
      if (idleCallbackId !== null && typeof window !== 'undefined' && 'cancelIdleCallback' in window) {
        window.cancelIdleCallback(idleCallbackId);
        idleCallbackId = null;
      }
    };
    
    const initAdMob = async () => {
      try {
        await admobService.initialize();
        if (isMounted) {
          const showAdTimeoutId = setTimeout(() => {
            timeoutIds.delete(showAdTimeoutId);
            if (isMounted) {
              if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
                idleCallbackId = window.requestIdleCallback(() => {
                  idleCallbackId = null;
                  if (isMounted && typeof window !== 'undefined' && window.adsbygoogle) {
                    admobService.showBannerAd();
                  }
                }, { timeout: 2000 });
              } else {
                const fallbackTimeoutId = setTimeout(() => {
                  timeoutIds.delete(fallbackTimeoutId);
                  if (isMounted && typeof window !== 'undefined' && window.adsbygoogle) {
                    admobService.showBannerAd();
                  }
                }, 500);
                timeoutIds.add(fallbackTimeoutId);
              }
            }
          }, 500);
          timeoutIds.add(showAdTimeoutId);
        }
      } catch (error) {
        console.error('Failed to initialize AdMob:', error);
      }
    };

    const initTimeoutId = setTimeout(initAdMob, 100);
    timeoutIds.add(initTimeoutId);

    return () => {
      isMounted = false;
      clearAllTimeouts();
      admobService.hideBannerAd();
    };
  }, []);

  useEffect(() => {
    if (!canvasRef.current) {
      console.warn('[GameCanvas] Canvas ref not available');
      return;
    }

    if (isInitializingRef.current) {
      console.warn('[GameCanvas] Game initialization already in progress, skipping');
      return;
    }

    if (gameInitializedRef.current) {
      console.warn('[GameCanvas] Game already initialized, skipping');
      return;
    }

    if (gameRef.current) {
      console.warn('[GameCanvas] Destroying existing game instance before creating new one');
      try {
        gameRef.current.destroy();
      } catch (error) {
        console.error('[GameCanvas] Error destroying existing game:', error);
      }
      gameRef.current = null;
    }

    isInitializingRef.current = true;
    console.log('[GameCanvas] Initializing game...');

    const rafId = requestAnimationFrame(() => {
      if (!canvasRef.current || gameInitializedRef.current) {
        isInitializingRef.current = false;
        return;
      }

      const canvas = canvasRef.current;
      const game = new Game(canvas, {
        onGameOver: handleGameOver,
        onScoreUpdate: handleScoreUpdate,
        onCheckpointSave: handleCheckpointSave
      });

      gameRef.current = game;
      gameInitializedRef.current = true;
      isInitializingRef.current = false;
      console.log('[GameCanvas] Game initialized successfully');
    });

    return () => {
      cancelAnimationFrame(rafId);
      isInitializingRef.current = false;
      
      console.log('[GameCanvas] Cleaning up game...');
      if (gameRef.current) {
        try {
          gameRef.current.destroy();
          gameRef.current = null;
          gameInitializedRef.current = false;
          console.log('[GameCanvas] Game destroyed successfully');
        } catch (error) {
          console.error('[GameCanvas] Error destroying game during cleanup:', error);
        }
      }
    };
  }, [handleGameOver, handleScoreUpdate, handleCheckpointSave]);


  useEffect(() => {
    if (!gameRef.current) return;

    const handleLevelGeneration = async () => {
      if (gameRef.current) {
        try {
          const lastGapY = gameRef.current.getLastGapY();
          const canvasHeight = gameRef.current.getCanvasHeight();
          const checkpoint = Math.floor(gameRef.current.getScore() / 20);
          
          const levelData = await generateLevel(
            Math.floor(Math.random() * 10000),
            checkpoint,
            lastGapY,
            canvasHeight
          );
          
          if (levelData && gameRef.current) {
            gameRef.current.loadLevelData(levelData);
          }
        } catch (error) {
          console.error('Failed to generate level:', error);
        }
      }
    };

    handleLevelGeneration();

    return () => {};
  }, [generateLevel]);

  const restartGame = async () => {
    if (gameRef.current) {
      try {
        await clearCheckpoints(user?.id || null, sessionIdRef.current);
      } catch (error) {
        console.error('Failed to clear checkpoints:', error);
      }
      
      sessionIdRef.current = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      hasRecordedGameOverRef.current = false;
      
      gameRef.current.start();
      setIsDialogOpen(false);
      setRank(null);
      setContinueCount(0);
      setSaveError(null);
      setRetryCount(0);
      retryCountRef.current = 0;
      setIsSavingScore(false);
    }
  };

  const handleContinue = async () => {
    if (gameRef.current && continueCount < 3) {
      try {
        const checkpoints = await loadCheckpoints(user?.id || null, sessionIdRef.current);
        
        console.log('Loaded checkpoints:', checkpoints.length, checkpoints.map(cp => ({
          score: cp.score,
          timestamp: new Date(cp.timestamp).toISOString(),
          checkpointId: cp.checkpointId
        })));
        
        if (checkpoints.length === 0) {
          console.warn('No checkpoints available, using default continue');
          gameRef.current.continue();
          setIsDialogOpen(false);
          setContinueCount(prev => prev + 1);
          hasRecordedGameOverRef.current = false;
          toast({
            title: "Continue!",
            description: `You've continued! (${continueCount + 1}/3)`,
          });
          return;
        }
        
        const deathTimestamp = gameRef.current.getDeathTimestamp() || Date.now();
        console.log('Death timestamp:', new Date(deathTimestamp).toISOString());
        
        const checkpoint = findCheckpointBefore(checkpoints, deathTimestamp, 2);
        
        hasRecordedGameOverRef.current = false;
        
        if (checkpoint) {
          console.log('Using checkpoint:', {
            score: checkpoint.score,
            timestamp: new Date(checkpoint.timestamp).toISOString(),
            ballPosition: checkpoint.ball.position,
            obstaclesCount: checkpoint.obstacles.length
          });
          
          try {
            gameRef.current.continue(checkpoint);
            toast({
              title: "Continue!",
              description: `Resumed from checkpoint! Score: ${checkpoint.score} (${continueCount + 1}/3)`,
            });
          } catch (error) {
            console.error('Error restoring from checkpoint:', error);
            gameRef.current.continue();
            toast({
              title: "Continue!",
              description: `You've continued! (${continueCount + 1}/3)`,
            });
          }
        } else {
          console.warn('No valid checkpoint found, using default continue');
          gameRef.current.continue();
          toast({
            title: "Continue!",
            description: `You've continued! (${continueCount + 1}/3)`,
          });
        }

        setIsDialogOpen(false);
        setContinueCount(prev => prev + 1);
      } catch (error) {
        console.error('Failed to continue from checkpoint:', error);
        gameRef.current.continue();
        setIsDialogOpen(false);
        setContinueCount(prev => prev + 1);
        hasRecordedGameOverRef.current = false;
        toast({
          title: "Continue!",
          description: `You've continued! (${continueCount + 1}/3)`,
        });
      }
    }
  };

  const toggleMute = () => {
    if (gameRef.current) {
      gameRef.current.setSoundEnabled(!isMuted);
      setIsMuted(!isMuted);
    }
  };

  const handleReward = () => {
    handleContinue();
  };

  const handleRetrySaveScore = async () => {
    if (finalScore > 0 && userRef.current) {
      retryCountRef.current += 1;
      setRetryCount(retryCountRef.current);
      await handleGameOver(finalScore, true);
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
        className="absolute bottom-4 right-4 bg-slate-800/80 backdrop-blur-sm"
        onClick={toggleMute}
      >
        {isMuted ? '🔇' : '🔊'}
      </Button>
      
      {/* Game Over Dialog */}
      <Dialog 
        open={isDialogOpen} 
        onOpenChange={(open) => {
          if (!open) {
            return;
          }
          setIsDialogOpen(open);
        }}
      >
        <DialogContent 
          className="bg-slate-800 border-slate-700"
          showCloseButton={false}
          onInteractOutside={(e) => {
            e.preventDefault();
          }}
          onEscapeKeyDown={(e) => {
            e.preventDefault();
          }}
        >
          <DialogHeader>
            <DialogTitle className="text-white">Game Over</DialogTitle>
            <DialogDescription className="text-slate-400">
              Your final score and leaderboard rank.
            </DialogDescription>
          </DialogHeader>
          <CardContent className="space-y-4">
            <div className="text-center py-4">
              <p className="text-2xl font-bold text-white">Score: {finalScore}</p>
              {isSavingScore && (
                <p className="text-sm text-slate-400 mt-2">
                  Saving score...
                </p>
              )}
              {rank && !isSavingScore && (
                <p className="text-lg text-purple-400 mt-2">
                  Your rank: #{rank}
                </p>
              )}
              {saveError && !isSavingScore && (
                <div className="mt-2 space-y-2">
                  <p className="text-sm text-red-400">
                    Failed to save score: {saveError}
                  </p>
                  {retryCount < 3 && (
                    <Button
                      onClick={handleRetrySaveScore}
                      variant="outline"
                      size="sm"
                      className="text-xs border-red-400 text-red-400 hover:bg-red-400/10"
                    >
                      Retry ({3 - retryCount} attempts left)
                    </Button>
                  )}
                </div>
              )}
            </div>
            
            <div className="flex flex-col gap-3">
              <RewardedAdButton 
                onReward={handleReward} 
                disabled={continueCount >= 3}
                continueCount={continueCount}
              />
              
              <Button 
                onClick={restartGame}
                className="bg-purple-600 hover:bg-purple-700 text-white"
              >
                Play Again
              </Button>
              
              <Button 
                variant="outline" 
                onClick={() => {
                  router.push('/');
                }}
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