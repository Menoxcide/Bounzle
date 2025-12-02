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
  const sessionIdRef = useRef<string>(`session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
  const hasRecordedGameOverRef = useRef(false);
  const isInitializingRef = useRef(false); // Prevent multiple initializations
  const gameInitializedRef = useRef(false); // Track if game has been initialized

  // Handle level generation
  const { generateLevel } = useLevelGenerator();

  // Use refs for callbacks to prevent re-initialization
  const userRef = useRef(user);
  const saveScoreRef = useRef(saveScore);
  const toastRef = useRef(toast);

  // Update refs when values change
  useEffect(() => {
    userRef.current = user;
    saveScoreRef.current = saveScore;
    toastRef.current = toast;
  }, [user, saveScore, toast]);

  const handleScoreUpdate = useCallback((score: number) => {
    // Score is displayed in the game itself
    console.log('Score updated:', score);
  }, []);

  // Handle checkpoint saving - use ref to access current user
  const handleCheckpointSave = useCallback(async (snapshot: GameStateSnapshot) => {
    try {
      await saveCheckpoint(userRef.current?.id || null, sessionIdRef.current, snapshot);
    } catch (error) {
      console.error('Failed to save checkpoint:', error);
      // Don't show error to user - checkpoint saving is non-critical
    }
  }, []); // Empty deps - use ref instead

  const handleGameOver = useCallback(async (score: number) => {
    // Prevent multiple game over side-effects from firing (e.g. duplicate callbacks)
    if (hasRecordedGameOverRef.current) {
      console.log('[GameCanvas] handleGameOver called but already recorded, ignoring');
      return;
    }
    hasRecordedGameOverRef.current = true;

    console.log('[GameCanvas] handleGameOver called with score:', score);
    setFinalScore(score);
    
    // Use setTimeout to ensure dialog opens after React state update
    // Also add a small delay to ensure the game state has fully transitioned
    setTimeout(() => {
      console.log('[GameCanvas] Opening game over dialog');
      setIsDialogOpen(true);
    }, 100); // Increased delay slightly to ensure state is ready

    // Save score to Supabase (only save once per game session, not on each continue)
    // We'll track if we've already saved for this game session
    const currentUser = userRef.current;
    if (currentUser) {
      try {
        const newRank = await saveScoreRef.current(currentUser.id, score);
        setRank(newRank);
      } catch (error) {
        console.error('Failed to save score:', error);
      }
    }

    // Show game over toast
    toastRef.current({
      title: "Game Over!",
      description: `Your score: ${score}`,
    });
  }, []); // Empty deps - use refs instead

  // Initialize AdMob
  useEffect(() => {
    let isMounted = true;
    let timeoutId: NodeJS.Timeout | null = null;
    
    const initAdMob = async () => {
      try {
        await admobService.initialize();
        // Only show ad if component is still mounted and initialization succeeded
        if (isMounted) {
          // Wait a bit more to ensure adsbygoogle is fully ready
          timeoutId = setTimeout(() => {
            if (isMounted) {
              // Use requestIdleCallback to show ad without blocking
              if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
                window.requestIdleCallback(() => {
                  if (isMounted && typeof window !== 'undefined' && window.adsbygoogle) {
                    admobService.showBannerAd();
                  }
                }, { timeout: 2000 });
              } else {
                setTimeout(() => {
                  if (isMounted && typeof window !== 'undefined' && window.adsbygoogle) {
                    admobService.showBannerAd();
                  }
                }, 500);
              }
            }
          }, 500);
        }
      } catch (error) {
        console.error('Failed to initialize AdMob:', error);
        // Don't show ad if initialization failed
      }
    };

    // Delay initialization slightly to avoid blocking initial render
    timeoutId = setTimeout(initAdMob, 100);

    // Cleanup AdMob when component unmounts
    return () => {
      isMounted = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      admobService.hideBannerAd();
    };
  }, []);

  // Initialize game - only once, no dependencies on callbacks
  useEffect(() => {
    if (!canvasRef.current) {
      console.warn('[GameCanvas] Canvas ref not available');
      return;
    }

    // Prevent multiple initializations (handles React Strict Mode double-invoke)
    if (isInitializingRef.current) {
      console.warn('[GameCanvas] Game initialization already in progress, skipping');
      return;
    }

    if (gameInitializedRef.current) {
      console.warn('[GameCanvas] Game already initialized, skipping');
      return;
    }

    // Check if game already exists and destroy it first
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

    // Use requestAnimationFrame to defer initialization and avoid blocking
    const rafId = requestAnimationFrame(() => {
      try {
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
      } catch (error) {
        console.error('[GameCanvas] Error initializing game:', error);
        isInitializingRef.current = false;
        gameInitializedRef.current = false;
      }
    });

    // Clean up
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
  }, [handleGameOver, handleScoreUpdate, handleCheckpointSave]); // Dependencies added to satisfy exhaustive-deps rule


  useEffect(() => {
    if (!gameRef.current) return;

    const handleLevelGeneration = async () => {
      if (gameRef.current) {
        try {
          // Get current game state for smooth transitions
          const lastGapY = gameRef.current.getLastGapY();
          const canvasHeight = gameRef.current.getCanvasHeight();
          const checkpoint = Math.floor(gameRef.current.getScore() / 20); // Increment checkpoint every 20 points
          
          // Generate level data with context for smooth transitions
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
          // Game will use procedural generation as fallback
        }
      }
    };

    // Generate initial level immediately (game will start with procedural obstacles if this fails)
    handleLevelGeneration();

    // Disable periodic regeneration to keep walls stable once generated.
    // Additional chunks will be generated procedurally on the client as needed.
    return () => {};
  }, [generateLevel]);

  const restartGame = async () => {
    if (gameRef.current) {
      // Clear old checkpoints when starting new game
      try {
        await clearCheckpoints(user?.id || null, sessionIdRef.current);
      } catch (error) {
        console.error('Failed to clear checkpoints:', error);
      }
      
      // Generate new session ID for new game
      sessionIdRef.current = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      // Allow game-over side effects again for the new run
      hasRecordedGameOverRef.current = false;
      
      gameRef.current.start();
      setIsDialogOpen(false);
      setRank(null);
      setContinueCount(0); // Reset continue count on new game
    }
  };

  const handleContinue = async () => {
    if (gameRef.current && continueCount < 3) {
      try {
        // Load checkpoints from storage
        const checkpoints = await loadCheckpoints(user?.id || null, sessionIdRef.current);
        
        console.log('Loaded checkpoints:', checkpoints.length, checkpoints.map(cp => ({
          score: cp.score,
          timestamp: new Date(cp.timestamp).toISOString(),
          checkpointId: cp.checkpointId
        })));
        
        if (checkpoints.length === 0) {
          // No checkpoints available, fall back to default continue behavior
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
        
        // Get death timestamp from game
        const deathTimestamp = gameRef.current.getDeathTimestamp() || Date.now();
        console.log('Death timestamp:', new Date(deathTimestamp).toISOString());
        
        // Find checkpoint from 2 seconds before death (gives player a safety buffer)
        const checkpoint = findCheckpointBefore(checkpoints, deathTimestamp, 2);
        
        // Set hasRecordedGameOverRef BEFORE calling continue to ensure proper state
        hasRecordedGameOverRef.current = false;
        
        if (checkpoint) {
          console.log('Using checkpoint:', {
            score: checkpoint.score,
            timestamp: new Date(checkpoint.timestamp).toISOString(),
            ballPosition: checkpoint.ball.position,
            obstaclesCount: checkpoint.obstacles.length
          });
          
          try {
            // Restore from checkpoint - this will restore score, ball position, obstacles, etc.
            gameRef.current.continue(checkpoint);
            toast({
              title: "Continue!",
              description: `Resumed from checkpoint! Score: ${checkpoint.score} (${continueCount + 1}/3)`,
            });
          } catch (error) {
            console.error('Error restoring from checkpoint:', error);
            // Fallback to default continue
            gameRef.current.continue();
            toast({
              title: "Continue!",
              description: `You've continued! (${continueCount + 1}/3)`,
            });
          }
        } else {
          // Fallback to default continue
          console.warn('No valid checkpoint found, using default continue');
          gameRef.current.continue();
          toast({
            title: "Continue!",
            description: `You've continued! (${continueCount + 1}/3)`,
          });
        }

        setIsDialogOpen(false);
        setContinueCount(prev => prev + 1);
        
        // DO NOT clear checkpoints after continue - they should persist until restart
        // This allows multiple continues to work properly
        
        // DO NOT clear checkpoints after continue - they should persist until restart
        // This allows multiple continues to work properly
      } catch (error) {
        console.error('Failed to continue from checkpoint:', error);
        // Fallback to default continue behavior
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
    // Watch Ad now grants continue ability instead of extra time
    handleContinue();
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
          // Prevent closing dialog by clicking outside or pressing Escape
          // Only allow closing via explicit button handlers (restartGame, handleContinue)
          // This prevents breaking the game state when clicking outside the dialog
          if (!open) {
            // Don't allow closing - user must choose an option (Watch Ad, Play Again, or Close)
            // The dialog will only close when restartGame() or handleContinue() is called
            return;
          }
          // Only allow opening (shouldn't happen programmatically, but handle it)
          setIsDialogOpen(open);
        }}
      >
        <DialogContent 
          className="bg-slate-800 border-slate-700"
          showCloseButton={false}
          onInteractOutside={(e) => {
            // Prevent closing dialog when clicking outside
            e.preventDefault();
          }}
          onEscapeKeyDown={(e) => {
            // Prevent closing dialog with Escape key - user must choose an option
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
              {rank && (
                <p className="text-lg text-purple-400 mt-2">
                  Your rank: #{rank}
                </p>
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
                  // Navigate back to main menu
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