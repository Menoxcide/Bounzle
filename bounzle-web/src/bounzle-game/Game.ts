// Main game class
/// <reference lib="dom" />

import { Renderer } from './renderer';
import { InputHandler } from './input';
import { updateBallPosition, applyJumpForce, checkCollision, checkBoundaryCollision, SCROLL_SPEED } from './physics';
import { Ball, Obstacle, GameStatus, LevelChunk, LevelData, ThemeKey, GameStateSnapshot, PowerUp, PowerUpType, GapType, WallStyle, RandomEvent, RandomEventType, StyleNotification } from './types';
import { getTheme, getRandomThemeKey } from './themes';
import { ParticleSystem, Particle } from './particles';
import { SoundManager } from './sound';
import { getConfigForDifficulty, selectFromProbabilities, randomInRange, getRandomColorFromPalette, GameConfig } from './config';
import { StyleMeter, ComboTracker } from './styleSystem';

export default class Game {
  private canvas: HTMLCanvasElement;
  private renderer: Renderer;
  private inputHandler: InputHandler;
  private animationFrameId: number | null = null;
  private resizeRafId: number | null = null; // RAF ID for resize operations to avoid forced reflows
  private errorRecoveryTimeoutId: NodeJS.Timeout | null = null; // Timeout ID for error recovery
  private resizeHandler: () => void; // Bound resize handler for cleanup
  private isLoopRunning: boolean = false; // Track if game loop is currently running
  private particleSystem: ParticleSystem;
  private soundManager: SoundManager;
  private styleMeter: StyleMeter;
  private comboTracker: ComboTracker;
  private styleNotifications: StyleNotification[] = [];
  private perfectRunObstacleCount: number = 0;
  
  // Game state
  private ball: Ball;
  private obstacles: Obstacle[] = [];
  private horizontalWalls: Obstacle[] = []; // Procedural horizontal walls at various Y positions with gaps
  private powerUps: PowerUp[] = []; // Standalone power-ups
  private lastHorizontalWallX: number = 0; // Track last horizontal wall X position for generation
  private score: number = 0;
  private status: GameStatus = 'idle';
  private lastTime: number = 0;
  private currentTheme: ThemeKey = 'normal';
  private lastThemeChangeScore: number = 0;
  
  // Performance monitoring
  private frameCount: number = 0;
  private lastPerformanceLog: number = 0;
  private readonly PERFORMANCE_LOG_INTERVAL_MS: number = 5000; // Log every 5 seconds
  private currentLevel: number = 1;
  private lastLevelCheck: number = 0;
  
  // Difficulty scaling
  private difficulty: number = 1;
  private lastDifficultyIncreaseScore: number = 0;
  
  // Screen shake
  private shakeIntensity: number = 0;
  private shakeDuration: number = 0;
  private shakeX: number = 0;
  private shakeY: number = 0;
  
  // Camera offset for following ball vertically through gaps
  private cameraOffsetY: number = 0;
  private targetCameraOffsetY: number = 0;
  private readonly CAMERA_FOLLOW_SPEED: number = 0.15; // Smooth camera following
  private lastCameraLogOffset: number = 0; // Track last logged camera offset for throttling
  
  // Track previous ball position for gap passing detection
  private previousBallPosition: { x: number; y: number } = { x: 0, y: 0 };

  // Start countdown
  private readonly START_DELAY_MS = 5000;
  private startDelayRemainingMs: number = 0;
  private gameStartTime: number = 0; // Track when game actually started playing
  private ballStartX: number = 100; // Track ball's starting X position for grace period check
  
  // Extra time from rewarded ads
  private extraTime: number = 0;
  
  // Power-up effects
  private slowMotionActive: boolean = false;
  private slowMotionEndTime: number = 0;
  private readonly SLOW_MOTION_DURATION_MS = 5000; // 5 seconds
  private speedBoostActive: boolean = false;
  private speedBoostEndTime: number = 0;
  private readonly SPEED_BOOST_DURATION_MS = 5000; // 5 seconds
  private shieldCount: number = 0;
  private magnetActive: boolean = false;
  private magnetEndTime: number = 0;
  private readonly MAGNET_DURATION_MS = 10000; // 10 seconds
  private readonly MAGNET_RADIUS: number = 100; // 100px radius
  private scoreMultiplier: number = 1;
  private scoreMultiplierEndTime: number = 0;
  private readonly SCORE_MULTIPLIER_DURATION_MS = 10000; // 10 seconds
  private gravityFlipActive: boolean = false;
  private gravityFlipEndTime: number = 0;
  private readonly GRAVITY_FLIP_DURATION_MS = 5000; // 5 seconds
  private originalGravityScale: number = 1;
  
  // Random events
  private activeEvents: RandomEvent[] = [];
  private lastEventCheck: number = 0;
  private readonly EVENT_CHECK_INTERVAL_MS = 30000; // Check every 30 seconds
  private readonly EVENT_SCORE_MILESTONE: number = 50; // Trigger event every 50 points
  
  // Debug logging (set to false to disable)
  private readonly DEBUG_MODE: boolean = false; // Disabled for production performance
  
  // Level generation
  private levelChunks: LevelChunk[] = [];
  private currentChunkIndex: number = 0;
  private consumedChunkCount: number = 0; // Track how many chunks have been converted to obstacles
  private checkpoint: number = 0;
  private lastObstacleX: number = 0;
  private obstacleSpacing: number = 2400; // Distance between obstacles (will be updated from config)
  private lastGapY: number = 0.5; // Track last gap position for smooth transitions
  private lastHorizontalWallY: { top: number; bottom: number } = { top: 0, bottom: 0 }; // Track last horizontal wall positions
  
  // Zone system for wall generation
  private currentZoneType: 'barrier' | 'corridor' | 'maze' = 'barrier';
  private zoneWallCount: number = 0; // Track walls in current zone
  private zoneStartX: number = 0; // Track where current zone started

  private readonly HORIZONTAL_GRID_SPACING: number = 380;
  private readonly WALL_THICKNESS: number = 60;
  private readonly GRID_BUFFER_MULTIPLIER: number = 3;
  private needsObstacleGeneration: boolean = true; // Flag to track if generation is needed
  private lastGenerationCheck: number = 0; // Track last generation check time
  private lastLevelTransitionCheck: number = 0; // Track when we last checked for level transitions
  
  // Checkpoint system
  private checkpoints: GameStateSnapshot[] = [];
  private lastCheckpointSave: number = 0;
  private readonly CHECKPOINT_INTERVAL_MS = 2500; // Save checkpoint every 2.5 seconds
  private deathTimestamp: number = 0; // Track when game over occurred
  private pendingCheckpointIdleCallback: number | null = null; // Track pending idle callback
  private pendingCheckpointTimeout: NodeJS.Timeout | null = null; // Track pending timeout
  
  // Survival time scoring
  private lastSurvivalScoreTime: number = 0;
  private readonly SURVIVAL_SCORE_INTERVAL_MS = 1000; // 1 second
  
  // Throttling for debug logs
  private lastWallGenerationLog: number = 0;
  private readonly WALL_LOG_THROTTLE_MS = 1000; // Log wall generation issues max once per second
  
  // Callbacks
  private onGameOver?: (score: number) => void;
  private onScoreUpdate?: (score: number) => void;
  private onCheckpointSave?: (snapshot: GameStateSnapshot) => void;
  
  constructor(canvas: HTMLCanvasElement, callbacks?: { onGameOver?: (score: number) => void, onScoreUpdate?: (score: number) => void, onCheckpointSave?: (snapshot: GameStateSnapshot) => void }) {
    this.canvas = canvas;
    this.renderer = new Renderer(canvas);
    this.particleSystem = new ParticleSystem();
    this.soundManager = new SoundManager();
    this.styleMeter = new StyleMeter();
    this.comboTracker = new ComboTracker();
    this.inputHandler = new InputHandler(canvas, this.handleTap.bind(this));
    
    if (callbacks) {
      this.onGameOver = callbacks.onGameOver;
      this.onScoreUpdate = callbacks.onScoreUpdate;
      this.onCheckpointSave = callbacks.onCheckpointSave;
    }
    
    this.ball = {
      position: { x: 100, y: this.canvas.height / 2 },
      velocity: { x: 0, y: 0 },
      radius: 20,
      gravityScale: 1
    };
    
    this.resizeHandler = this.resize.bind(this);
    this.resize();
    window.addEventListener('resize', this.resizeHandler);

    this.horizontalWalls = [];
    if (this.DEBUG_MODE) {
      console.log('[GAME_DEBUG] Horizontal walls initialized as empty array in constructor');
    }

    this.status = 'idle';
    if (this.DEBUG_MODE) {
      console.log('[GAME_DEBUG] ===== GAME INITIALIZED =====');
      console.log('[GAME_DEBUG] Canvas dimensions:', { width: this.canvas.width, height: this.canvas.height });
      console.log('[GAME_DEBUG] Ball starting position:', { x: this.ball.position.x, y: this.ball.position.y });
      console.log('[GAME_DEBUG] Ball radius:', this.ball.radius);
      console.log('[GAME_DEBUG] Initial status:', this.status);
      console.log('[GAME_DEBUG] Horizontal walls count:', this.horizontalWalls.length);
      console.log('[GAME_DEBUG] =============================');
    }

    this.lastTime = performance.now();
    this.lastPerformanceLog = this.lastTime;
    if (!this.isLoopRunning && this.animationFrameId === null) {
      this.isLoopRunning = true;
      this.animationFrameId = requestAnimationFrame(this.gameLoop.bind(this));
      if (this.DEBUG_MODE) {
        console.log('[Game] Game initialized in constructor, status:', this.status);
        console.log('[Game] Game loop started in constructor');
      }
    } else if (this.DEBUG_MODE) {
      console.warn('[Game] Game loop already running in constructor, animationFrameId:', this.animationFrameId);
    }
  }
  
  private resize(): void {
    // Use requestAnimationFrame to batch resize operations and avoid forced reflows
    if (this.resizeRafId !== null) {
      cancelAnimationFrame(this.resizeRafId);
    }
    
    this.resizeRafId = requestAnimationFrame(() => {
      this.resizeRafId = null;
      
      // Cache the rect to avoid multiple getBoundingClientRect calls
      const rect = this.canvas.parentElement?.getBoundingClientRect();
      if (rect) {
        this.renderer.resize(rect.width, rect.height);
        
        // Reset ball position on resize
        this.ball.position = { x: 100, y: this.canvas.height / 2 };
        // Clear horizontal walls on resize and let them regenerate when needed
        this.horizontalWalls = [];
  
      }
    });
  }
  
  private handleTap(): void {
    // IMPORTANT: Ignore ALL taps when game is over - player must use dialog buttons
    // This prevents breaking the game state when clicking outside the dialog
    if (this.status === 'gameOver') {
      return; // Completely ignore taps during game over - dialog handles all interaction
    }
    
    if (this.status === 'playing') {
      applyJumpForce(this.ball);
      
      // Play sound effect
      this.soundManager.playBeep(440, 0.1);
      
      // Add particle effect when tapping - use spark particles
      this.particleSystem.addExplosion(
        this.ball.position.x, 
        this.ball.position.y, 
        getTheme(this.currentTheme).ballColor, 
        8,
        'spark'
      );
    } else if (this.status === 'idle') {
      // Only allow starting from idle state, not from gameOver
      // Game over state should be handled by dialog buttons (continue/restart)
      this.start();
    } else if (this.status === 'starting') {
      // Ignore taps during the get-ready countdown so the player
      // has a consistent window before walls appear.
    } else if (this.status === 'paused') {
      this.resume();
    }
  }
  
  start(): void {
    if (this.status === 'playing' || this.status === 'starting') {
      if (this.DEBUG_MODE) {
        console.log('[Game] start() called but game already in progress, status:', this.status);
      }
      return;
    }
    
    if (this.DEBUG_MODE) {
      console.log('[Game] Starting game, previous status:', this.status);
    }
    
    // Enter a short \"get ready\" phase before walls spawn
    const previousStatus = this.status;
    this.status = 'starting';
    
    console.log('[GAME_DEBUG] ===== STATE TRANSITION =====');
    console.log('[GAME_DEBUG] Previous status:', previousStatus);
    console.log('[GAME_DEBUG] New status: starting');
    console.log('[GAME_DEBUG] Ball position:', { x: this.ball.position.x, y: this.ball.position.y });
    console.log('[GAME_DEBUG] ============================');
    
    if (this.DEBUG_MODE) {
      console.log('[Game] Status changed:', previousStatus, '->', this.status);
    }
    this.score = 0;
    this.difficulty = 1;
    this.lastDifficultyIncreaseScore = 0;
    this.extraTime = 0;
    this.lastThemeChangeScore = 0;
    this.styleMeter.reset();
    this.comboTracker.reset();
    this.styleNotifications = [];
    this.perfectRunObstacleCount = 0;
    this.currentTheme = 'normal';
    this.renderer.setTheme(this.currentTheme);
    this.currentLevel = 1;
    this.lastLevelCheck = 0;
    this.renderer.setLevel(this.currentLevel);
    this.particleSystem.clear();
    this.shakeIntensity = 0;
    this.shakeDuration = 0;
    this.shakeX = 0;
    this.shakeY = 0;
    this.gameStartTime = 0; // Reset game start time
    this.lastSurvivalScoreTime = 0; // Reset survival scoring timer
    
    // Reset zone system
    this.currentZoneType = 'barrier';
    this.zoneWallCount = 0;
    this.zoneStartX = 0;
    
    if (this.onScoreUpdate) this.onScoreUpdate(this.score);
    this.obstacles = [];
    this.horizontalWalls = [];
    this.powerUps = [];
    this.levelChunks = [];
    this.currentChunkIndex = 0;
    this.consumedChunkCount = 0;
    this.checkpoint = 0;
    this.lastObstacleX = this.canvas.width;
    this.lastHorizontalWallX = 0; // Initialize to 0 so generation starts immediately
    this.lastHorizontalWallY = { top: 0, bottom: 0 };
    this.ball.position = { x: 100, y: this.canvas.height / 2 };
    this.ball.velocity = { x: 0, y: 0 };
    this.ballStartX = 100; // Track starting position for grace period
    this.previousBallPosition = { x: 100, y: this.canvas.height / 2 }; // Initialize previous position
    this.slowMotionActive = false;
    this.slowMotionEndTime = 0;
    this.speedBoostActive = false;
    this.speedBoostEndTime = 0;
    this.shieldCount = 0;
    this.magnetActive = false;
    this.magnetEndTime = 0;
    this.scoreMultiplier = 1;
    this.scoreMultiplierEndTime = 0;
    this.gravityFlipActive = false;
    this.gravityFlipEndTime = 0;
    this.originalGravityScale = 1;
    this.activeEvents = [];
    this.lastEventCheck = 0;
    
    // Reset camera offset
    this.cameraOffsetY = 0;
    this.targetCameraOffsetY = 0;
    
    // Initialize procedural horizontal walls system (no initial walls - they'll be generated ahead)
    this.horizontalWalls = [];
    
    // NOTE: We don't generate grid rows for horizontal walls - they are static at top and bottom
    // Only vertical obstacles use the grid system
    
    // Note: We don't create initial gaps in horizontal walls because:
    // - Ball starts in the middle of the screen
    // - Horizontal walls are at top and bottom edges
    // - Ball only collides with horizontal walls when it moves up/down to hit them
    // - Gaps will be created dynamically when ball approaches the walls
    
    // Clear checkpoints when starting new game
    this.checkpoints = [];
    this.lastCheckpointSave = 0;
    this.deathTimestamp = 0;

    // Prepare for delayed obstacle generation
    this.needsObstacleGeneration = true;
    this.startDelayRemainingMs = this.START_DELAY_MS;
    
    // Play start sound
    this.soundManager.playPop();
    
    // Ensure the game loop is running
    if (!this.isLoopRunning && this.animationFrameId === null) {
      this.isLoopRunning = true;
      this.lastTime = performance.now();
      this.lastCheckpointSave = this.lastTime;
      this.animationFrameId = requestAnimationFrame(this.gameLoop.bind(this));
      if (this.DEBUG_MODE) {
        console.log('[Game] Game loop started in start()');
      }
    } else if (this.DEBUG_MODE && (this.isLoopRunning || this.animationFrameId !== null)) {
      console.log('[Game] Game loop already running, skipping start() call');
    }
  }
  
  pause(): void {
    if (this.status === 'playing') {
      this.status = 'paused';
      if (this.animationFrameId) {
        cancelAnimationFrame(this.animationFrameId);
        this.animationFrameId = null;
        this.isLoopRunning = false;
        if (this.DEBUG_MODE) {
          console.log('[Game] Game loop paused');
        }
      }
    }
  }
  
  resume(): void {
    if (this.status === 'paused') {
      this.status = 'playing';
      this.lastTime = performance.now();
      // Only start loop if not already running
      if (!this.isLoopRunning && this.animationFrameId === null) {
        this.isLoopRunning = true;
        this.animationFrameId = requestAnimationFrame(this.gameLoop.bind(this));
        if (this.DEBUG_MODE) {
          console.log('[Game] Game loop resumed');
        }
      } else if (this.DEBUG_MODE && (this.isLoopRunning || this.animationFrameId !== null)) {
        console.log('[Game] Game loop already running, skipping resume() call');
      }
    }
  }

  continue(snapshot?: GameStateSnapshot): void {
    if (this.status === 'playing') {
      if (this.DEBUG_MODE) {
        console.log('[Game] continue() called but game already playing, ignoring');
      }
      return;
    }

    if (this.DEBUG_MODE) {
      console.log('[Game] continue() called, previous status:', this.status, 'hasSnapshot:', !!snapshot);
    }

    if (snapshot) {
      try {
        if (!snapshot.ball || !snapshot.ball.position) {
          console.error('[Game] Invalid checkpoint snapshot - missing ball data');
          this.ball.position.x = 100;
          this.ball.position.y = this.canvas.height / 2;
          this.ball.velocity = { x: 0, y: 0 };
        } else {
          this.restoreFromCheckpoint(snapshot);
          if (this.DEBUG_MODE) {
            console.log('[Game] Successfully restored from checkpoint, score:', this.score);
          }
        }
      } catch (error) {
        console.error('[Game] Error restoring from checkpoint:', error);
        this.ball.position.x = 100;
        this.ball.position.y = this.canvas.height / 2;
        this.ball.velocity = { x: 0, y: 0 };
      }
    } else {
      this.ball.position.x = 100;
      this.ball.position.y = this.canvas.height / 2;
      this.ball.velocity = { x: 0, y: 0 };
    }
    
    // Update ballStartX for grace period tracking
    this.ballStartX = this.ball.position.x;
    // Initialize previous position
    this.previousBallPosition = { x: this.ball.position.x, y: this.ball.position.y };
    
    // Change status to playing AFTER restoring state
    this.status = 'playing';
    
    // Clear any screen shake
    this.shakeIntensity = 0;
    this.shakeDuration = 0;
    this.shakeX = 0;
    this.shakeY = 0;
    
    // Reset death timestamp so we can track new deaths
    this.deathTimestamp = 0;
    
    // Reset camera offset
    this.cameraOffsetY = 0;
    this.targetCameraOffsetY = 0;
    
    // Reset game start time to give immunity period after continuing
    // This ensures the grace period logic applies after continue
    this.gameStartTime = performance.now();
    this.lastSurvivalScoreTime = 0; // Reset survival scoring timer
    
    // Reset zone generation state to prevent duplicate wall generation
    // Calculate zone start from restored walls if they exist
    if (this.horizontalWalls.length > 0) {
      const validWalls = this.horizontalWalls.filter(w => w && w.position);
      if (validWalls.length > 0) {
        // Find rightmost wall position - all walls span full width
        const wallPositions = validWalls.map(w => {
          // Wall spans from position.x to position.x + width
          return w.position.x + w.width;
        });
        const rightmostWallX = Math.max(...wallPositions, this.lastHorizontalWallX || this.canvas.width);
        this.zoneStartX = rightmostWallX;
        this.zoneWallCount = validWalls.length; // Count existing walls as part of zone
      } else {
        this.zoneStartX = this.lastHorizontalWallX || this.canvas.width;
        this.zoneWallCount = 0;
      }
    } else {
      this.zoneStartX = this.lastHorizontalWallX || this.canvas.width;
      this.zoneWallCount = 0;
    }
    
    // Resume game loop - ensure it's running
    this.lastTime = performance.now();
    this.lastCheckpointSave = this.lastTime;
    
    // Always ensure the game loop is running after continue
    if (!this.isLoopRunning || this.animationFrameId === null) {
      this.isLoopRunning = true;
      this.animationFrameId = requestAnimationFrame(this.gameLoop.bind(this));
      if (this.DEBUG_MODE) {
        console.log('[Game] Game loop started in continue()');
      }
    } else if (this.DEBUG_MODE) {
      console.log('[Game] Game loop already running, continuing with existing loop');
    }
    
    // Play continue sound
    this.soundManager.playPop();
    
    // Add particle effect for continue
    this.particleSystem.addExplosion(
      this.ball.position.x, 
      this.ball.position.y, 
      '#10b981', // green for continue
      15
    );
  }
  
  // Save current game state as checkpoint
  saveCheckpoint(): GameStateSnapshot {
    const snapshot: GameStateSnapshot = {
      ball: {
        position: { ...this.ball.position },
        velocity: { ...this.ball.velocity },
        radius: this.ball.radius,
        gravityScale: this.ball.gravityScale
      },
      obstacles: this.obstacles.map(obs => ({
        position: { ...obs.position },
        width: obs.width,
        height: obs.height,
        gapY: obs.gapY,
        gapHeight: obs.gapHeight,
        orientation: obs.orientation,
        gapX: obs.gapX,
        gapWidth: obs.gapWidth,
        obstacleType: obs.obstacleType,
        wallStyle: obs.wallStyle,
        wallColor: obs.wallColor,
        theme: obs.theme,
        passed: obs.passed,
        isLevelTransition: obs.isLevelTransition,
        powerUp: obs.powerUp ? {
          position: { ...obs.powerUp.position },
          type: obs.powerUp.type,
          size: obs.powerUp.size,
          collected: obs.powerUp.collected,
          rotation: obs.powerUp.rotation,
          pulseScale: obs.powerUp.pulseScale,
        } : undefined
      })),
      horizontalWalls: this.horizontalWalls.map(wall => ({
        position: { ...wall.position },
        width: wall.width,
        height: wall.height,
        gapY: wall.gapY,
        gapHeight: wall.gapHeight,
        orientation: wall.orientation,
        gapX: wall.gapX,
        gapWidth: wall.gapWidth,
        gapType: wall.gapType,
        obstacleType: wall.obstacleType,
        wallStyle: wall.wallStyle,
        wallColor: wall.wallColor,
        theme: wall.theme,
        passed: wall.passed,
        isLevelTransition: wall.isLevelTransition,
        powerUp: wall.powerUp ? {
          position: { ...wall.powerUp.position },
          type: wall.powerUp.type,
          size: wall.powerUp.size,
          collected: wall.powerUp.collected,
          rotation: wall.powerUp.rotation,
          pulseScale: wall.powerUp.pulseScale,
        } : undefined
      })),
      powerUps: this.powerUps.map(pu => ({
        position: { ...pu.position },
        type: pu.type,
        size: pu.size,
        collected: pu.collected,
        rotation: pu.rotation,
        pulseScale: pu.pulseScale,
      })),
      score: this.score,
      difficulty: this.difficulty,
      currentTheme: this.currentTheme,
      levelChunks: [...this.levelChunks],
      currentChunkIndex: this.currentChunkIndex,
      consumedChunkCount: this.consumedChunkCount,
      lastObstacleX: this.lastObstacleX,
      lastGapY: this.lastGapY,
      lastHorizontalWallX: this.lastHorizontalWallX,
      lastHorizontalWallY: { ...this.lastHorizontalWallY },
      cameraOffsetY: this.cameraOffsetY,
      timestamp: Date.now(),
      checkpointId: `checkpoint_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      slowMotionActive: this.slowMotionActive,
      slowMotionEndTime: this.slowMotionEndTime,
      speedBoostActive: this.speedBoostActive,
      speedBoostEndTime: this.speedBoostEndTime,
      shieldCount: this.shieldCount,
      magnetActive: this.magnetActive,
      magnetEndTime: this.magnetEndTime,
      scoreMultiplier: this.scoreMultiplier,
      scoreMultiplierEndTime: this.scoreMultiplierEndTime,
      gravityFlipActive: this.gravityFlipActive,
      gravityFlipEndTime: this.gravityFlipEndTime,
      activeEvents: [...this.activeEvents],
    };
    
    // Debug logging for checkpoint saving
    if (this.DEBUG_MODE) {
      console.log(`[DEBUG] Saving checkpoint: score=${snapshot.score}, ball=(${snapshot.ball.position.x.toFixed(1)}, ${snapshot.ball.position.y.toFixed(1)}), obstacles=${snapshot.obstacles.length}`);
    }
    
    // Add to local checkpoints array (keep last 10)
    this.checkpoints.push(snapshot);
    if (this.checkpoints.length > 10) {
      this.checkpoints.shift(); // Remove oldest
    }
    
    // Notify callback for external storage
    if (this.onCheckpointSave) {
      this.onCheckpointSave(snapshot);
    }
    
    return snapshot;
  }
  
  // Restore game state from checkpoint
  restoreFromCheckpoint(snapshot: GameStateSnapshot): void {
    if (this.DEBUG_MODE) {
      console.log(`[DEBUG] Restoring checkpoint: score=${snapshot.score}, ball=(${snapshot.ball.position.x.toFixed(1)}, ${snapshot.ball.position.y.toFixed(1)}), obstacles=${snapshot.obstacles.length}`);
    }
    
    // Restore ball
    this.ball = {
      position: { ...snapshot.ball.position },
      velocity: { ...snapshot.ball.velocity },
      radius: snapshot.ball.radius,
      gravityScale: snapshot.ball.gravityScale
    };
    
    // Restore obstacles
    this.obstacles = snapshot.obstacles.map(obs => ({
      position: { ...obs.position },
      width: obs.width,
      height: obs.height,
      gapY: obs.gapY,
      gapHeight: obs.gapHeight,
      orientation: obs.orientation,
      gapX: obs.gapX,
      gapWidth: obs.gapWidth,
      obstacleType: obs.obstacleType,
      wallStyle: obs.wallStyle,
      wallColor: obs.wallColor,
      theme: obs.theme,
      passed: obs.passed,
      isLevelTransition: obs.isLevelTransition,
      powerUp: obs.powerUp ? {
        position: { ...obs.powerUp.position },
        type: obs.powerUp.type,
        size: obs.powerUp.size,
        collected: obs.powerUp.collected,
        rotation: obs.powerUp.rotation,
        pulseScale: obs.powerUp.pulseScale,
      } : undefined
    }));
    
    // Restore horizontal walls
    if (snapshot.horizontalWalls && snapshot.horizontalWalls.length > 0) {
      this.horizontalWalls = snapshot.horizontalWalls.map(wall => ({
        position: { ...wall.position },
        width: wall.width,
        height: wall.height,
        gapY: wall.gapY,
        gapHeight: wall.gapHeight,
        orientation: wall.orientation,
        gapX: wall.gapX, // Preserve gap X position
        gapWidth: wall.gapWidth, // Preserve gap width
        gapType: wall.gapType, // Preserve gap type
        obstacleType: wall.obstacleType,
        wallStyle: wall.wallStyle,
        wallColor: wall.wallColor,
        theme: wall.theme,
        passed: wall.passed,
        isLevelTransition: wall.isLevelTransition,
        powerUp: wall.powerUp ? {
          position: { ...wall.powerUp.position },
          type: wall.powerUp.type,
          size: wall.powerUp.size,
          collected: wall.powerUp.collected,
          rotation: wall.powerUp.rotation,
          pulseScale: wall.powerUp.pulseScale,
        } : undefined
      }));
      
      // All horizontal walls should span full width for rendering
      // Preserve position.x from checkpoint (it represents scroll position)
      // Ensure width is canvas.width for all walls
      for (const wall of this.horizontalWalls) {
        // All walls span full width
        wall.width = this.canvas.width;
        // position.x is preserved from checkpoint (represents current scroll position)
        // gapX is also preserved and will scroll with position.x in update loop
      }
      
      // Calculate lastHorizontalWallX from restored walls to prevent duplicate generation
      const validWalls = this.horizontalWalls.filter(w => w && w.position);
      if (validWalls.length > 0) {
        // Find the rightmost wall position - all walls span full width
        const rightmostWallX = Math.max(...validWalls.map(w => {
          // Wall spans from position.x to position.x + width
          return w.position.x + w.width;
        }));
        // Use the restored lastHorizontalWallX if available, otherwise calculate from walls
        this.lastHorizontalWallX = snapshot.lastHorizontalWallX || Math.max(rightmostWallX, this.canvas.width);
      } else {
        this.lastHorizontalWallX = snapshot.lastHorizontalWallX || this.canvas.width;
      }
      
      if (this.DEBUG_MODE) {
        console.log(`[Game] Restored ${this.horizontalWalls.length} horizontal walls with gaps`);
        console.log(`[Game] Set lastHorizontalWallX to ${this.lastHorizontalWallX.toFixed(1)} after restore`);
        if (this.horizontalWalls.length > 0) {
          const firstWall = this.horizontalWalls[0];
          console.log(`[Game] First wall: position.x=${firstWall.position.x.toFixed(1)}, width=${firstWall.width}, gapX=${firstWall.gapX?.toFixed(1) || 'none'}`);
        }
      }
    } else {
      // Initialize with empty array if no walls in checkpoint
      // This matches the behavior in constructor and start methods
      this.horizontalWalls = [];
      this.lastHorizontalWallX = snapshot.lastHorizontalWallX || this.canvas.width;
      if (this.DEBUG_MODE) {
        console.log('[Game] Initialized horizontal walls as empty array in restoreFromCheckpoint');
      }
    }
    
    // Restore camera offset
    this.cameraOffsetY = snapshot.cameraOffsetY || 0;
    this.targetCameraOffsetY = this.cameraOffsetY;
    
    // Restore power-ups
    this.powerUps = snapshot.powerUps ? snapshot.powerUps.map(pu => ({
      position: { ...pu.position },
      type: pu.type,
      size: pu.size,
      collected: pu.collected,
      rotation: pu.rotation,
      pulseScale: pu.pulseScale,
    })) : [];
    
    // Restore game state - IMPORTANT: Restore score BEFORE calling onScoreUpdate
    this.score = snapshot.score;
    this.difficulty = snapshot.difficulty;
    this.currentTheme = snapshot.currentTheme;
    this.renderer.setTheme(this.currentTheme);
    
    // Restore slow motion state
    this.slowMotionActive = snapshot.slowMotionActive || false;
    this.slowMotionEndTime = snapshot.slowMotionEndTime || 0;
    this.speedBoostActive = snapshot.speedBoostActive || false;
    this.speedBoostEndTime = snapshot.speedBoostEndTime || 0;
    this.shieldCount = snapshot.shieldCount || 0;
    this.magnetActive = snapshot.magnetActive || false;
    this.magnetEndTime = snapshot.magnetEndTime || 0;
    this.scoreMultiplier = snapshot.scoreMultiplier || 1;
    this.scoreMultiplierEndTime = snapshot.scoreMultiplierEndTime || 0;
    this.gravityFlipActive = snapshot.gravityFlipActive || false;
    this.gravityFlipEndTime = snapshot.gravityFlipEndTime || 0;
    this.originalGravityScale = this.ball.gravityScale;
    this.activeEvents = snapshot.activeEvents || [];
    this.lastEventCheck = performance.now();
    
    // Restore level generation state
    this.levelChunks = [...snapshot.levelChunks];
    this.currentChunkIndex = snapshot.currentChunkIndex;
    this.consumedChunkCount = snapshot.consumedChunkCount;
    this.lastObstacleX = snapshot.lastObstacleX;
    this.lastGapY = snapshot.lastGapY;
    this.lastHorizontalWallX = snapshot.lastHorizontalWallX || this.canvas.width;
    this.lastHorizontalWallY = snapshot.lastHorizontalWallY || { top: 0, bottom: 0 };
    
    // Update score callback AFTER all state is restored
    if (this.onScoreUpdate) {
      this.onScoreUpdate(this.score);
    }
    
    // Clear particles and reset effects
    this.particleSystem.clear();
    this.extraTime = 0;
    
    if (this.DEBUG_MODE) {
      console.log(`[DEBUG] Restored checkpoint: score=${this.score}, ball=(${this.ball.position.x.toFixed(1)}, ${this.ball.position.y.toFixed(1)}), obstacles=${this.obstacles.length}`);
    }
  }
  
  // Get checkpoints (for external access)
  getCheckpoints(): GameStateSnapshot[] {
    return [...this.checkpoints];
  }
  
  // Get death timestamp
  getDeathTimestamp(): number {
    return this.deathTimestamp;
  }
  
  // Add extra time from rewarded ad
  addExtraTime(seconds: number): void {
    this.extraTime += seconds;
    // Play a sound effect for the reward
    this.soundManager.playCoin();
  }
  
  // Trigger screen shake
  private triggerShake(intensity: number = 5, duration: number = 10): void {
    this.shakeIntensity = intensity;
    this.shakeDuration = duration;
  }
  
  // Increase difficulty based on score
  private increaseDifficulty(): void {
    // Increase difficulty every 10 points
    if (this.score >= this.lastDifficultyIncreaseScore + 10) {
      this.difficulty += 0.1;
      this.lastDifficultyIncreaseScore = this.score;
      
      // Play a sound effect for difficulty increase
      this.soundManager.playBeep(880, 0.1);
    }
  }
  
  // Get adjusted scroll speed based on difficulty and slow motion
  private getAdjustedScrollSpeed(): number {
    const speed = SCROLL_SPEED * this.difficulty;
    let speedMultiplier = 1.0;
    
    // Apply slow motion effect - only if valid and active
    if (this.slowMotionActive && this.slowMotionEndTime > 0 && performance.now() < this.slowMotionEndTime) {
      speedMultiplier *= 0.5; // Reduce speed to 50%
      if (this.DEBUG_MODE && Math.random() < 0.01) { // Log occasionally to avoid spam
        console.log('[Game] Slow motion active, scroll speed reduced to 50%');
      }
    }
    
    // Apply random event speed modifiers
    for (const event of this.activeEvents) {
      if (event.type === 'speedZone') {
        speedMultiplier *= 1.5; // 50% faster
      } else if (event.type === 'slowZone') {
        speedMultiplier *= 0.7; // 30% slower
      }
    }
    
    // Apply speed boost power-up
    if (this.speedBoostActive) {
      speedMultiplier *= 2.0; // 2x faster
    }
    
    return speed * speedMultiplier;
  }
  
  // Get adjusted gap height based on difficulty
  private getAdjustedGapHeight(baseGapHeight: number): number {
    // Make gaps smaller as difficulty increases
    // At difficulty 1, gap is 100% of base. At difficulty 2, gap is 80%, etc.
    const gapMultiplier = Math.max(1.0 - (this.difficulty - 1) * 0.15, 0.3);
    return baseGapHeight * gapMultiplier;
  }

  // Map difficulty (which increases by 0.1) to an integer level.
  // Difficulty 1.0 -> Level 1, 1.1 -> Level 2, etc.
  private getLevelNumber(): number {
    const level = Math.round((this.difficulty - 1) * 10) + 1;
    return Math.max(1, level);
  }

  // Check if level has changed and update background
  private checkLevelChange(): void {
    const newLevel = this.getLevelNumber();
    if (newLevel !== this.currentLevel) {
      const previousLevel = this.currentLevel;
      this.currentLevel = newLevel;
      this.renderer.setLevel(this.currentLevel);
      
      // Enhanced particle effect when level/biome changes
      if (previousLevel !== newLevel) {
        // Create transition particles across the screen
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        
        // Main burst at center
        this.particleSystem.addEnergyBurst(centerX, centerY, '#8b5cf6', 30);
        
        // Additional bursts at corners for dramatic effect
        this.particleSystem.addBurst(0, 0, '#8b5cf6', 15);
        this.particleSystem.addBurst(this.canvas.width, 0, '#8b5cf6', 15);
        this.particleSystem.addBurst(0, this.canvas.height, '#8b5cf6', 15);
        this.particleSystem.addBurst(this.canvas.width, this.canvas.height, '#8b5cf6', 15);
        
        // Star burst effect
        this.particleSystem.addStarBurst(centerX, centerY, '#fbbf24', 20);
      }
      
      // Play level change sound
      this.soundManager.playBeep(660, 0.15);
    }
  }

  // Level-based multiplier for gap height.
  // Level 1–10: 2.0x base gap, then slightly smaller every 10 levels,
  // clamped so it never goes below 1.0x.
  private getGapSizeMultiplier(level: number): number {
    const bandIndex = Math.floor((level - 1) / 10); // 0 for levels 1–10, 1 for 11–20, etc.
    const rawMultiplier = 2.0 - bandIndex * 0.1;
    return Math.max(1.0, rawMultiplier);
  }
  
  // Check collision between ball and power-up
  private checkPowerUpCollision(ball: Ball, powerUp: PowerUp): boolean {
    if (powerUp.collected) return false;
    
    const dx = ball.position.x - powerUp.position.x;
    const dy = ball.position.y - powerUp.position.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const minDistance = ball.radius + powerUp.size;
    
    return distance < minDistance;
  }
  
  // Collect a power-up and apply its effect
  private collectPowerUp(powerUp: PowerUp): void {
    if (powerUp.collected) return;
    
    powerUp.collected = true;
    
    // Add style points for power-up collection
    const currentTime = performance.now();
    const comboMultiplier = this.comboTracker.getTotalMultiplier();
    this.styleMeter.addPowerUpCollection(comboMultiplier);
    this.comboTracker.addPowerUpCombo(currentTime);
    
    // Add notification
    this.addStyleNotification('POWER-UP!', '#8b5cf6');
    
    switch (powerUp.type) {
      case 'score':
        // Add bonus score
        const scoreBonus = Math.floor(10 * this.difficulty);
        this.score += scoreBonus;
        if (this.onScoreUpdate) this.onScoreUpdate(this.score);
        
        // Play coin sound
        this.soundManager.playCoin();
        
        // Add enhanced particle effect - use star particles for score
        this.particleSystem.addExplosion(
          powerUp.position.x,
          powerUp.position.y,
          '#fbbf24', // amber-400
          12,
          'star'
        );
        break;
        
      case 'life':
        // Add extra time (similar to rewarded ad)
        this.extraTime += 10; // 10 seconds of extra time
        
        // Play coin sound
        this.soundManager.playCoin();
        
        // Add enhanced particle effect - use glow particles for life
        this.particleSystem.addBurst(
          powerUp.position.x,
          powerUp.position.y,
          '#10b981', // green-500
          18
        );
        break;
        
      case 'slowmo':
        // Activate slow motion
        this.slowMotionActive = true;
        this.slowMotionEndTime = performance.now() + this.SLOW_MOTION_DURATION_MS;
        
        // Play special sound (higher pitch for slowmo)
        this.soundManager.playBeep(1100, 0.25);
        
        // Add enhanced particle effect - use energy particles for slowmo
        this.particleSystem.addExplosion(
          powerUp.position.x,
          powerUp.position.y,
          '#8b5cf6', // purple-500
          20,
          'energy'
        );
        break;
        
      case 'speedboost':
        // Activate speed boost
        this.speedBoostActive = true;
        this.speedBoostEndTime = performance.now() + this.SPEED_BOOST_DURATION_MS;
        
        // Play special sound
        this.soundManager.playBeep(800, 0.3);
        
        // Add enhanced particle effect - use spark particles for speed boost
        this.particleSystem.addExplosion(
          powerUp.position.x,
          powerUp.position.y,
          '#f59e0b', // amber-500
          18,
          'spark'
        );
        break;
        
      case 'shield':
        // Add shield (stackable)
        this.shieldCount++;
        
        // Play coin sound
        this.soundManager.playCoin();
        
        // Add enhanced particle effect - use glow particles for shield
        this.particleSystem.addBurst(
          powerUp.position.x,
          powerUp.position.y,
          '#3b82f6', // blue-500
          20
        );
        break;
        
      case 'magnet':
        // Activate magnet
        this.magnetActive = true;
        this.magnetEndTime = performance.now() + this.MAGNET_DURATION_MS;
        
        // Play special sound
        this.soundManager.playBeep(600, 0.3);
        
        // Add enhanced particle effect - use energy particles for magnet
        this.particleSystem.addExplosion(
          powerUp.position.x,
          powerUp.position.y,
          '#06b6d4', // cyan-500
          18,
          'energy'
        );
        break;
        
      case 'doublescore':
        // Activate score multiplier
        this.scoreMultiplier = 2;
        this.scoreMultiplierEndTime = performance.now() + this.SCORE_MULTIPLIER_DURATION_MS;
        
        // Play special sound
        this.soundManager.playBeep(1000, 0.3);
        
        // Add enhanced particle effect - use burst for double score
        this.particleSystem.addBurst(
          powerUp.position.x,
          powerUp.position.y,
          '#fbbf24', // amber-400
          25
        );
        break;
        
      case 'gravityflip':
        // Activate gravity flip
        this.gravityFlipActive = true;
        this.gravityFlipEndTime = performance.now() + this.GRAVITY_FLIP_DURATION_MS;
        this.originalGravityScale = this.ball.gravityScale;
        this.ball.gravityScale = -this.ball.gravityScale;
        
        // Play special sound
        this.soundManager.playBeep(500, 0.4);
        
        // Add enhanced particle effect - use energy particles for gravity flip
        this.particleSystem.addExplosion(
          powerUp.position.x,
          powerUp.position.y,
          '#ec4899', // pink-500
          20,
          'energy'
        );
        break;
    }
  }
  
  // Generate a power-up at the specified position
  private generatePowerUp(x: number, y: number, config: GameConfig): PowerUp {
    const type = selectFromProbabilities(config.powerUps.typeProbabilities);
    
    return {
      position: { x, y },
      type: type as PowerUpType,
      size: config.powerUps.size,
      collected: false,
      rotation: 0,
      pulseScale: 1.0,
    };
  }
  
  // Generate a procedural obstacle (fallback when chunks aren't available)
  private generateProceduralObstacle(): Obstacle {
    const config = getConfigForDifficulty(this.difficulty);
    
    // Generate random gap position - allow gaps anywhere on screen with margins for playability
    // Use wider range (10% to 90% of screen) for more variety
    const margin = this.canvas.height * 0.1;
    const minGapY = margin;
    const maxGapY = this.canvas.height - margin;
    // Add more randomness - use full range instead of just middle 60%
    const gapY = minGapY + Math.random() * (maxGapY - minGapY);
    
    // Get gap height from config range
    const normalizedGapHeight = randomInRange(config.walls.gapHeightMin, config.walls.gapHeightMax);
    let gapHeight = normalizedGapHeight * this.canvas.height;
    
    // Ensure minimum gap height for playability
    const minGapHeight = 120; // Minimum 120px gap
    gapHeight = Math.max(gapHeight, minGapHeight);

    // Apply level-based scaling so early levels are easier
    const level = this.getLevelNumber();
    const gapMultiplier = this.getGapSizeMultiplier(level);
    let finalGapHeight = gapHeight * gapMultiplier;
    finalGapHeight = Math.max(finalGapHeight, minGapHeight);
    
    // Get random width from config range
    const width = randomInRange(config.walls.widthMin, config.walls.widthMax);
    
    // Select wall style based on config probabilities
    const wallStyle = selectFromProbabilities(config.walls.styleProbabilities);
    
    // Select random color from palette
    const wallColor = getRandomColorFromPalette(config.walls.colorPalette);
    
    // Map wall style to obstacle type for backward compatibility
    let obstacleType: 'pipe' | 'spike' | 'moving' = 'pipe';
    if (wallStyle === 'spike') obstacleType = 'spike';
    else if (wallStyle === 'moving') obstacleType = 'moving';
    
    // Potentially spawn a power-up in the gap center
    let powerUp: PowerUp | undefined = undefined;
    if (Math.random() < config.powerUps.spawnChance) {
      // Calculate power-up position (centered in gap with some offset for challenge)
      const offsetRange = config.powerUps.offsetRange * finalGapHeight;
      const offsetY = randomInRange(-offsetRange, offsetRange);
      const powerUpX = this.lastObstacleX + width / 2;
      const powerUpY = gapY + offsetY;
      
      powerUp = this.generatePowerUp(powerUpX, powerUpY, config);
    }
    
    return {
      position: { x: this.lastObstacleX, y: 0 },
      width: Math.round(width),
      height: this.canvas.height,
      gapY: gapY,
      gapHeight: finalGapHeight,
      obstacleType: obstacleType,
      wallStyle: wallStyle,
      wallColor: wallColor,
      theme: this.currentTheme,
      passed: false,
      powerUp: powerUp
    };
  }
  
  // Generate a horizontal wall (top or bottom)
  private generateHorizontalWall(isTop: boolean, config: GameConfig, x: number): Obstacle {
    // Determine if this should be a level transition gap
    const shouldCreateLevelTransition = this.shouldCreateLevelTransitionGap();
    
    // Wall height (thickness)
    const wallHeight = randomInRange(40, 80);
    
    // For horizontal walls, we need gapX and gapWidth (similar to gapY and gapHeight for vertical)
    // Generate random gap position (keep it in the middle 60% of screen width)
    const gapX = (Math.random() * 0.6 + 0.2) * this.canvas.width;
    
    // Get gap width from config range (using gapHeight config as reference, but for width)
    const normalizedGapWidth = randomInRange(config.walls.gapHeightMin, config.walls.gapHeightMax);
    let gapWidth = normalizedGapWidth * this.canvas.width;
    
    // Ensure minimum gap width for playability
    const minGapWidth = 120; // Minimum 120px gap
    gapWidth = Math.max(gapWidth, minGapWidth);
    
    // Apply level-based scaling so early levels are easier
    const level = this.getLevelNumber();
    const gapMultiplier = this.getGapSizeMultiplier(level);
    let finalGapWidth = gapWidth * gapMultiplier;
    finalGapWidth = Math.max(finalGapWidth, minGapWidth);
    
    // If this is a level transition, make the gap larger and more visible
    if (shouldCreateLevelTransition) {
      finalGapWidth = Math.max(finalGapWidth * 1.5, minGapWidth * 1.5);
    }
    
    // Wall width (how far it extends horizontally)
    const wallWidth = randomInRange(config.walls.widthMin * 2, config.walls.widthMax * 2);
    
    // Select wall style based on config probabilities
    const wallStyle = selectFromProbabilities(config.walls.styleProbabilities);
    
    // Select random color from palette
    const wallColor = getRandomColorFromPalette(config.walls.colorPalette);
    
    // Map wall style to obstacle type for backward compatibility
    let obstacleType: 'pipe' | 'spike' | 'moving' = 'pipe';
    if (wallStyle === 'spike') obstacleType = 'spike';
    else if (wallStyle === 'moving') obstacleType = 'moving';
    
    // Position: top wall at y=0, bottom wall at y=canvas.height - wallHeight
    const y = isTop ? 0 : this.canvas.height - wallHeight;
    
    return {
      position: { x: x, y: y },
      width: Math.round(wallWidth),
      height: Math.round(wallHeight),
      gapY: 0, // Not used for horizontal walls
      gapHeight: 0, // Not used for horizontal walls
      orientation: 'horizontal',
      gapX: gapX,
      gapWidth: finalGapWidth,
      obstacleType: obstacleType,
      wallStyle: wallStyle,
      wallColor: wallColor,
      theme: this.currentTheme,
      passed: false,
      isLevelTransition: shouldCreateLevelTransition
    };
  }
  
  // Check if we should create a level transition gap (randomly, occasionally)
  private shouldCreateLevelTransitionGap(): boolean {
    // Random chance: 10-15% per level
    const chance = 0.12; // 12% chance
    return Math.random() < chance;
  }
  
  // Load level data from AI generation
  loadLevelData(levelData: LevelData): void {
    // Append new chunks to existing ones (don't clear)
    this.levelChunks = [...this.levelChunks, ...levelData.chunks];
    
    // Validate and log horizontal walls in chunks
    if (this.DEBUG_MODE) {
      const chunksWithWalls = levelData.chunks.filter(chunk => chunk.horizontalWalls && chunk.horizontalWalls.length > 0);
      const totalWalls = levelData.chunks.reduce((sum, chunk) => sum + (chunk.horizontalWalls?.length || 0), 0);
      console.log(`[Game] Loaded ${levelData.chunks.length} chunks: ${chunksWithWalls.length} have horizontal walls (${totalWalls} total walls)`);
      if (chunksWithWalls.length < levelData.chunks.length) {
        const chunksWithoutWalls = levelData.chunks.filter(chunk => !chunk.horizontalWalls || chunk.horizontalWalls.length === 0);
        console.warn(`[Game] ${chunksWithoutWalls.length} chunks have no horizontal walls. Chunk indices:`, 
          chunksWithoutWalls.map((_, idx) => levelData.chunks.indexOf(chunksWithoutWalls[idx])));
      }
    }
    
    // Don't call generateObstaclesFromChunks() immediately
    // Let the update loop handle generation naturally when needed
    // This prevents premature regeneration of obstacles
  }
  
  // Get the last gap position (normalized 0-1) for smooth level transitions
  getLastGapY(): number {
    return this.lastGapY;
  }
  
  // Get canvas height for level generation
  getCanvasHeight(): number {
    return this.canvas.height;
  }
  
  private generateObstaclesFromChunks(): void {
    const config = getConfigForDifficulty(this.difficulty);
    
    // Find the rightmost obstacle position
    let rightmostX = this.lastObstacleX || this.canvas.width;
    if (this.obstacles.length > 0) {
      const validObstacles = this.obstacles.filter(o => o && o.position);
      if (validObstacles.length > 0) {
        rightmostX = Math.max(...validObstacles.map(o => o.position.x + o.width));
      } else {
        rightmostX = this.lastObstacleX || this.canvas.width;
      }
    }
    
    // For initial generation (when obstacles array is empty), start closer to screen
    // This ensures walls appear immediately after countdown
    if (this.obstacles.length === 0) {
      rightmostX = this.canvas.width;
      this.lastObstacleX = rightmostX;
    }
    
    // Only generate obstacles that are far enough ahead (2x canvas width minimum)
    // This prevents regeneration of obstacles before the ball reaches them
    const minDistanceAhead = this.canvas.width * 2;
    const targetDistance = this.ball.position.x + minDistanceAhead;
    
    // Generate obstacles until rightmost obstacle is far enough ahead
    // Limit generation to prevent infinite loops
    let generationCount = 0;
    const maxGenerations = 20;
    
    // Only generate if rightmost obstacle is not far enough ahead
    while (rightmostX < targetDistance && generationCount < maxGenerations) {
      generationCount++;
      let obstacle: Obstacle;
      
      // For the first obstacle, use reduced spacing to appear sooner after countdown
      // This ensures walls appear immediately after the countdown ends
      const isFirstObstacle = this.obstacles.length === 0;
      const spacingForThisObstacle = isFirstObstacle 
        ? Math.min(this.obstacleSpacing, this.canvas.width * 0.5) // First obstacle appears closer
        : this.obstacleSpacing;
      
      // Use chunks if available (based on consumed count, not currentChunkIndex)
      if (this.consumedChunkCount < this.levelChunks.length) {
        const chunk = this.levelChunks[this.consumedChunkCount];
        
        // Convert normalized values to pixel values
        // Add randomness to chunk gap position for more variety (±15% variation)
        const baseGapY = chunk.gapY * this.canvas.height;
        const variationRange = this.canvas.height * 0.15; // 15% of screen height variation
        const gapY = Math.max(
          this.canvas.height * 0.1, // Keep within 10% margin from edges
          Math.min(
            this.canvas.height * 0.9,
            baseGapY + (Math.random() - 0.5) * variationRange
          )
        );
        
        // Use config range for gap height, but allow chunk to influence it
        const baseGapHeight = chunk.gapHeight;
        // Clamp chunk gap height to config range
        const clampedGapHeight = Math.max(
          config.walls.gapHeightMin,
          Math.min(config.walls.gapHeightMax, baseGapHeight)
        );
        let gapHeight = clampedGapHeight * this.canvas.height;
        
        // Ensure minimum gap height
        const minGapHeight = 120;
        gapHeight = Math.max(gapHeight, minGapHeight);

        // Apply level-based scaling so early levels are easier
        const level = this.getLevelNumber();
        const gapMultiplier = this.getGapSizeMultiplier(level);
        let finalGapHeight = gapHeight * gapMultiplier;
        finalGapHeight = Math.max(finalGapHeight, minGapHeight);
        
        // Apply config variations: width, color, style
        const width = randomInRange(config.walls.widthMin, config.walls.widthMax);
        const wallColor = getRandomColorFromPalette(config.walls.colorPalette);
        const wallStyle = selectFromProbabilities(config.walls.styleProbabilities);
        
        // Map wall style to obstacle type for backward compatibility
        let obstacleType: 'pipe' | 'spike' | 'moving' = chunk.obstacleType || 'pipe';
        if (wallStyle === 'spike') obstacleType = 'spike';
        else if (wallStyle === 'moving') obstacleType = 'moving';
        else if (wallStyle === 'pipe') obstacleType = 'pipe';
        
        // Potentially spawn a power-up in the gap center
        let powerUp: PowerUp | undefined = undefined;
        if (Math.random() < config.powerUps.spawnChance) {
          // Calculate power-up position (centered in gap with some offset for challenge)
          const offsetRange = config.powerUps.offsetRange * finalGapHeight;
          const offsetY = randomInRange(-offsetRange, offsetRange);
          const powerUpX = rightmostX + spacingForThisObstacle + width / 2;
          const powerUpY = gapY + offsetY;
          
          powerUp = this.generatePowerUp(powerUpX, powerUpY, config);
        }
        
        obstacle = {
          position: { x: rightmostX + spacingForThisObstacle, y: 0 },
          width: Math.round(width),
          height: this.canvas.height,
          gapY: gapY,
          gapHeight: finalGapHeight,
          obstacleType: obstacleType,
          wallStyle: wallStyle,
          wallColor: wallColor,
          theme: chunk.theme || this.currentTheme,
          passed: false,
          powerUp: powerUp
        };
        
        // Update last gap position (normalized)
        this.lastGapY = chunk.gapY;
        
        // Generate horizontal walls from this chunk immediately (AI-based, like vertical obstacles)
        const obstacleX = rightmostX + spacingForThisObstacle;
        this.generateHorizontalWallsForChunk(chunk, obstacleX, config);
        
        // Increment consumed chunk count - this chunk is now used
        this.consumedChunkCount++;
      } else {
        // Generate procedurally when chunks run out
        obstacle = this.generateProceduralObstacle();
        obstacle.position.x = rightmostX + spacingForThisObstacle;
        
        // Update last gap position (normalized)
        this.lastGapY = obstacle.gapY / this.canvas.height;
        
        // ALWAYS generate procedural horizontal wall when generating procedural vertical obstacle
        // This ensures horizontal walls are ALWAYS generated alongside vertical obstacles
        // Use the same X position as the vertical obstacle to maintain alignment
        try {
          this.generateProceduralHorizontalWallAtX(obstacle.position.x, config);
        } catch (error) {
          console.error('[Game] Error generating procedural horizontal wall in generateObstaclesFromChunks:', error);
          // Continue - wall generation will retry next time
        }
      }
      
      // Only add new obstacles, never modify existing ones
      this.obstacles.push(obstacle);
      rightmostX = obstacle.position.x + obstacle.width;
      this.lastObstacleX = rightmostX;
      
      if (this.DEBUG_MODE) {
        console.log(`[DEBUG] Generated obstacle ${this.obstacles.length - 1}: x=${obstacle.position.x.toFixed(1)}, gapY=${obstacle.gapY.toFixed(2)}, gapHeight=${obstacle.gapHeight.toFixed(2)}`);
      }
    }
    
    // Mark that we've generated obstacles
    this.needsObstacleGeneration = false;
  }
  
  // Generate horizontal walls for a single AI chunk (called when chunk is consumed)
  private generateHorizontalWallsForChunk(chunk: LevelChunk, obstacleX: number, config: GameConfig): void {
    // Generate horizontal walls from AI chunk data (like vertical obstacles)
    if (!chunk.horizontalWalls || chunk.horizontalWalls.length === 0) {
      // If chunk doesn't have horizontal walls data, generate procedurally instead
      // This ensures horizontal walls are ALWAYS generated when vertical obstacles are generated
      if (this.DEBUG_MODE) {
        console.log(`[Game] Chunk ${this.consumedChunkCount} has no horizontalWalls data - generating procedurally at X=${obstacleX.toFixed(1)}`);
      }
      this.generateProceduralHorizontalWallAtX(obstacleX, config);
      return;
    }
    
    // Calculate spacing for horizontal walls - use same spacing as vertical obstacles
    // Horizontal walls should be spaced independently along X-axis
    const horizontalWallSpacing = config.walls.spacing;
    
    // Start positioning from lastHorizontalWallX, or use obstacleX if no walls exist yet
    let currentWallX = this.horizontalWalls.length === 0 
      ? Math.max(this.lastHorizontalWallX || 0, obstacleX)
      : Math.max(this.lastHorizontalWallX || 0, this.ball.position.x);
    
    // Generate each horizontal wall from the chunk
    for (const wallData of chunk.horizontalWalls) {
      // Convert normalized values to pixels
      const wallY = wallData.wallY * this.canvas.height;
      
      // Ensure wall is within screen bounds (with margin)
      if (wallY < 20 || wallY > this.canvas.height - 20) {
        if (this.DEBUG_MODE) {
          console.log(`[Game] Skipping horizontal wall at Y=${wallY.toFixed(1)} - out of bounds`);
        }
        continue;
      }
      
      // Position wall independently along X-axis with proper spacing
      // If this is not the first wall in this chunk, add spacing
      const wallIndex = chunk.horizontalWalls.indexOf(wallData);
      if (wallIndex > 0) {
        currentWallX += horizontalWallSpacing;
      }
      
      // Gap X is normalized (0-1) relative to wall width, convert to absolute position
      const gapX = currentWallX + (wallData.gapX * this.canvas.width);
      const gapWidth = wallData.gapWidth * this.canvas.width;
      
      // Ensure gap width is reasonable (minimum 200px for playability)
      const minGapWidth = 200;
      const finalGapWidth = Math.max(minGapWidth, gapWidth);
      
      // Ensure gap X is within wall bounds
      const wallLeft = currentWallX;
      const wallRight = currentWallX + this.canvas.width;
      const gapLeft = gapX - finalGapWidth / 2;
      const gapRight = gapX + finalGapWidth / 2;
      
      // Adjust gap X if it goes outside wall bounds
      let adjustedGapX = gapX;
      if (gapLeft < wallLeft + 50) {
        adjustedGapX = wallLeft + 50 + finalGapWidth / 2;
      } else if (gapRight > wallRight - 50) {
        adjustedGapX = wallRight - 50 - finalGapWidth / 2;
      }
      
      // Check if we already have a wall at this Y position with overlapping X range
      // Since walls span full width, check for X overlap, not just proximity
      const existingWall = this.horizontalWalls.find(w => {
        if (!w) return false;
        // Check if Y positions are similar (within 20px tolerance)
        const yMatch = Math.abs(w.position.y - wallY) < 20;
        if (!yMatch) return false;
        
        // Check if X ranges overlap (walls span full width)
        const existingLeft = w.position.x;
        const existingRight = w.position.x + w.width;
        const newLeft = currentWallX;
        const newRight = currentWallX + this.canvas.width;
        
        // Overlap if: existingLeft < newRight AND existingRight > newLeft
        const xOverlap = existingLeft < newRight && existingRight > newLeft;
        return xOverlap;
      });
      
      if (existingWall) {
        if (this.DEBUG_MODE) {
          console.log(`[Game] Skipping duplicate horizontal wall at Y=${wallY.toFixed(1)}, X=${currentWallX.toFixed(1)} - overlaps with existing wall`);
        }
        continue; // Skip if wall already exists at this position
      }
      
      // Apply config variations: color, style (matching vertical obstacles)
      const wallColor = getRandomColorFromPalette(config.walls.colorPalette);
      const wallStyle = selectFromProbabilities(config.walls.styleProbabilities);
      
      // Map wall style to obstacle type
      let obstacleType: 'pipe' | 'spike' | 'moving' = chunk.obstacleType || 'pipe';
      if (wallStyle === 'spike') obstacleType = 'spike';
      else if (wallStyle === 'moving') obstacleType = 'moving';
      else if (wallStyle === 'pipe') obstacleType = 'pipe';
      
      // Create horizontal wall obstacle
      const wallHeight = 60; // Match wall height from generateWallZone
      const wall: Obstacle = {
        position: { x: currentWallX, y: wallY },
        width: this.canvas.width, // Horizontal walls span full width
        height: wallHeight,
        gapX: adjustedGapX,
        gapWidth: finalGapWidth,
        gapY: 0, // Not used for horizontal walls
        gapHeight: 0, // Not used for horizontal walls
        orientation: 'horizontal',
        obstacleType: obstacleType,
        wallStyle: wallStyle,
        wallColor: wallColor,
        theme: chunk.theme || this.currentTheme,
        passed: false
      };
      
      this.horizontalWalls.push(wall);
      
      // Update lastHorizontalWallX to track the rightmost edge of generated walls
      // This ensures proper spacing for next generation
      this.lastHorizontalWallX = Math.max(this.lastHorizontalWallX, currentWallX + this.canvas.width);
      
      if (this.DEBUG_MODE) {
        console.log(`[Game] Generated horizontal wall from AI chunk: X=${currentWallX.toFixed(1)}, Y=${wallY.toFixed(1)}, gapX=${adjustedGapX.toFixed(1)}, gapWidth=${finalGapWidth.toFixed(1)}, lastHorizontalWallX=${this.lastHorizontalWallX.toFixed(1)}`);
      }
    }
  }
  
  // Generate a single procedural horizontal wall at a specific X position
  // This ensures horizontal walls are always generated alongside vertical obstacles
  private generateProceduralHorizontalWallAtX(wallX: number, config: GameConfig): void {
    const wallHeight = 60;
    const minGapWidth = 200;
    
    // Find a valid Y position that doesn't overlap with existing walls or block vertical gaps
    const margin = this.canvas.height * 0.1;
    const minY = margin;
    const maxY = this.canvas.height - margin - wallHeight;
    
    // Helper to check if a Y position would overlap or block gaps
    const wouldOverlap = (testY: number): boolean => {
      const testTop = testY;
      const testBottom = testY + wallHeight;
      const minVerticalSpacing = wallHeight + 300;
      
      // Check against existing horizontal walls
      for (const existingWall of this.horizontalWalls) {
        if (!existingWall || !existingWall.position) continue;
        const distanceX = Math.abs(existingWall.position.x - wallX);
        if (distanceX > this.canvas.width * 2) continue;
        
        const existingTop = existingWall.position.y;
        const existingBottom = existingWall.position.y + existingWall.height;
        if (!(testBottom < existingTop - minVerticalSpacing || testTop > existingBottom + minVerticalSpacing)) {
          return true;
        }
      }
      
      // Check if it would block vertical gaps
      if (this.checkWallBlocksVerticalGap(testY, wallHeight, wallX, this.canvas.width)) {
        return true;
      }
      
      return false;
    };
    
    // Find a valid Y position
    let wallY: number | undefined;
    let attempts = 0;
    const MAX_ATTEMPTS = 50;
    
    while (attempts < MAX_ATTEMPTS) {
      const testY = minY + Math.random() * (maxY - minY);
      if (!wouldOverlap(testY)) {
        wallY = testY;
        break;
      }
      attempts++;
    }
    
    // Fallback: use center if no valid position found
    if (wallY === undefined) {
      wallY = this.canvas.height / 2 - wallHeight / 2;
    }
    
    // Generate gap for the wall
    const wallLeft = wallX;
    const wallRight = wallX + this.canvas.width;
    const gapMargin = this.canvas.width * 0.25;
    const gapCenterRange = this.canvas.width * 0.5;
    const gapCenterStart = wallLeft + gapMargin;
    let gapX = gapCenterStart + Math.random() * gapCenterRange;
    
    // Gap width
    const level = this.getLevelNumber();
    const gapSizeMultiplier = Math.max(0.75, 1.0 - (level - 1) * 0.03);
    const normalizedGapWidth = randomInRange(config.walls.gapHeightMin, config.walls.gapHeightMax);
    let gapWidth = normalizedGapWidth * this.canvas.width * gapSizeMultiplier;
    gapWidth = Math.max(gapWidth, minGapWidth);
    gapWidth = Math.min(gapWidth, this.canvas.width * 0.8);
    
    // Ensure gap is within wall bounds
    const gapLeft = gapX - gapWidth / 2;
    const gapRight = gapX + gapWidth / 2;
    const marginFromEdge = gapWidth / 2 + 10;
    
    if (gapLeft < wallLeft + marginFromEdge) {
      gapX = wallLeft + marginFromEdge;
    } else if (gapRight > wallRight - marginFromEdge) {
      gapX = wallRight - marginFromEdge;
    }
    
    // Determine gap type
    const gapTypeRoll = Math.random();
    let gapType: GapType = 'none';
    if (gapTypeRoll < 0.15) {
      gapType = 'powerup';
      gapWidth = Math.max(gapWidth * 0.9, minGapWidth);
    } else if (gapTypeRoll < 0.25) {
      gapType = 'shortcut';
      gapWidth = Math.max(gapWidth * 0.85, minGapWidth);
    }
    
    // Create wall
    const wallStyle = selectFromProbabilities(config.walls.styleProbabilities) as WallStyle;
    const wallColor = getRandomColorFromPalette(config.walls.colorPalette);
    let obstacleType: 'pipe' | 'spike' | 'moving' = 'pipe';
    if (wallStyle === 'spike') obstacleType = 'spike';
    else if (wallStyle === 'moving') obstacleType = 'moving';
    
    const wall: Obstacle = {
      position: { x: wallX, y: wallY },
      width: this.canvas.width,
      height: wallHeight,
      gapY: 0,
      gapHeight: 0,
      orientation: 'horizontal',
      gapX: gapX,
      gapWidth: gapWidth,
      gapType: gapType,
      obstacleType: obstacleType,
      wallStyle: wallStyle,
      wallColor: wallColor,
      theme: this.currentTheme,
      passed: false
    };
    
    // Add power-up if it's a power-up gap
    if (gapType === 'powerup' && Math.random() < config.powerUps.spawnChance * 1.5) {
      wall.powerUp = this.generatePowerUp(gapX, wallY + wallHeight / 2, config);
    }
    
    this.horizontalWalls.push(wall);
    
    // Update lastHorizontalWallX
    this.lastHorizontalWallX = Math.max(this.lastHorizontalWallX, wallX + this.canvas.width);
    
    if (this.DEBUG_MODE) {
      console.log(`[Game] Generated procedural horizontal wall at X=${wallX.toFixed(1)}, Y=${wallY.toFixed(1)}, gapX=${gapX.toFixed(1)}, gapWidth=${gapWidth.toFixed(1)}`);
    }
  }
  
  // Generate procedural horizontal walls (fallback when AI chunks run out or don't have horizontal walls)
  private generateProceduralHorizontalWalls(): void {
    // Generate procedurally when:
    // 1. No chunks exist (levelChunks.length === 0), OR
    // 2. All chunks have been consumed (consumedChunkCount >= levelChunks.length), OR
    // 3. Chunks exist but don't have horizontal walls data (fallback generation)
    // The distance/count checks below will prevent over-generation
    
    // Note: We no longer block procedural generation when chunks are available,
    // because chunks may not always have horizontal walls data. The existing
    // distance and count checks ensure we don't generate too many walls.
    
    const config = getConfigForDifficulty(this.difficulty);
    
    // Check if remaining chunks have horizontal walls data
    // If chunks exist but don't have horizontal walls, we need continuous procedural generation
    const hasChunksWithoutWalls = this.levelChunks.length > 0 && 
      this.consumedChunkCount < this.levelChunks.length &&
      this.levelChunks.slice(this.consumedChunkCount).some(chunk => 
        !chunk.horizontalWalls || chunk.horizontalWalls.length === 0
      );
    
    // Calculate rightmostX from existing walls first, then fall back to lastHorizontalWallX or ball position
    // This ensures we always start generation from a valid position, not X=0
    let rightmostX: number;
    
    if (this.horizontalWalls.length > 0) {
      // Calculate from existing walls - find the rightmost wall edge
      const wallPositions = this.horizontalWalls
        .filter(w => w && w.position)
        .map(w => w.position.x + w.width);
      rightmostX = Math.max(...wallPositions, this.lastHorizontalWallX || 0);
    } else {
      // No walls exist - use ball position or lastHorizontalWallX, whichever is greater
      // This ensures generation starts from the ball's position, not X=0
      rightmostX = Math.max(
        this.lastHorizontalWallX || 0,
        this.ball.position.x
      );
    }
    
    // Ensure rightmostX is always at least the ball's position to prevent starting at X=0
    rightmostX = Math.max(rightmostX, this.ball.position.x);
    
    // Minimum wall count threshold
    // Horizontal walls should appear as often or more often than vertical obstacles
    const MIN_WALL_COUNT = 0; // No minimum - let density control generation
    const wallsAheadOfBall = this.horizontalWalls.filter(w => w && w.position.x > this.ball.position.x).length;
    
    // Calculate target distance with buffer (needed for generation and logging)
    // Match vertical obstacle generation threshold (2.0x canvas width)
    const minDistanceAhead = this.canvas.width * 2.0; // Match vertical obstacles - generate frequently
    const targetDistance = this.ball.position.x + minDistanceAhead;
    
    // Add buffer to ensure continuous generation - much smaller buffer
    const GENERATION_BUFFER = this.canvas.width * 0.5; // Small buffer
    const targetDistanceWithBuffer = targetDistance + GENERATION_BUFFER;
    
    // Critical: Always generate if we have no walls
    if (this.horizontalWalls.length === 0) {
      if (this.DEBUG_MODE) {
        console.log(`[Game] No walls exist - forcing generation. ballX: ${this.ball.position.x.toFixed(1)}`);
      }
      // Force generation regardless of rightmostX
    } else {
      // Only generate if we need more walls ahead of the ball
      // Check if we already have enough walls ahead
      // Match vertical obstacle generation frequency - generate frequently
      
      // Generate if:
      // 1. We don't have enough walls ahead, OR
      // 2. Last generation point is less than target distance (with buffer), OR
      // 3. Chunks exist but don't have horizontal walls (need continuous generation)
      const needsMoreWalls = this.horizontalWalls.length < MIN_WALL_COUNT || wallsAheadOfBall < MIN_WALL_COUNT;
      const needsMoreDistance = rightmostX < targetDistanceWithBuffer;
      
      // If chunks exist but don't have horizontal walls, always generate to ensure continuous walls
      if (!needsMoreWalls && !needsMoreDistance && !hasChunksWithoutWalls) {
        if (this.DEBUG_MODE) {
          console.log(`[Game] Skipping wall generation - last generation at ${rightmostX.toFixed(1)}, target is ${targetDistanceWithBuffer.toFixed(1)}, ballX: ${this.ball.position.x.toFixed(1)}, walls ahead: ${wallsAheadOfBall}`);
        }
        return;
      }
      
      // If chunks don't have horizontal walls, ensure we generate continuously
      if (hasChunksWithoutWalls && this.DEBUG_MODE) {
        console.log(`[Game] Chunks without horizontal walls detected - ensuring continuous generation. rightmostX: ${rightmostX.toFixed(1)}, target: ${targetDistanceWithBuffer.toFixed(1)}`);
      }
    }
    
    // Determine zone type based on difficulty/level
    const level = this.currentLevel || 1;
    const zoneLength = this.canvas.width * 4; // Zone spans 4 screen widths (longer zones)
    
    // Check if we need to start a new zone
    if (this.zoneWallCount === 0 || rightmostX - this.zoneStartX >= zoneLength) {
      this.zoneStartX = rightmostX;
      this.zoneWallCount = 0;
      // Select zone type based on level - simpler progression
      if (level <= 2) {
        // Early levels: simple barriers only
        this.currentZoneType = 'barrier';
      } else if (level <= 5) {
        // Mid levels: mix of barrier and corridor
        this.currentZoneType = Math.random() < 0.6 ? 'barrier' : 'corridor';
      } else {
        // Higher levels: all types, but still mostly barrier/corridor
        const zoneRoll = Math.random();
        if (zoneRoll < 0.5) {
          this.currentZoneType = 'barrier';
        } else if (zoneRoll < 0.85) {
          this.currentZoneType = 'corridor';
        } else {
          this.currentZoneType = 'maze';
        }
      }
    }
    
    // Generate walls based on zone type - generate enough to reach target distance (with buffer)
    // Removed + this.canvas.width to prevent generating excess walls beyond target
    const result = this.generateWallZone(rightmostX, targetDistanceWithBuffer, config, level);
    const wallsGenerated = result.count;
    const newRightmostX = result.rightmostX;
    
    this.zoneWallCount += wallsGenerated;
    
    // Update lastHorizontalWallX to where we just finished generating walls
    // This is the rightmost X position where walls were created (in world coordinates)
    // This value doesn't change as walls scroll left - it's our generation checkpoint
    if (wallsGenerated > 0) {
      // Update to the rightmost X position where we generated walls
      this.lastHorizontalWallX = Math.max(this.lastHorizontalWallX, newRightmostX);
    }
    
    if (this.DEBUG_MODE) {
      if (wallsGenerated > 0) {
        console.log(`[Game] Generated ${wallsGenerated} horizontal walls, lastHorizontalWallX now: ${this.lastHorizontalWallX.toFixed(1)}, ballX: ${this.ball.position.x.toFixed(1)}, targetDistance: ${targetDistanceWithBuffer.toFixed(1)}, totalWalls: ${this.horizontalWalls.length}`);
      } else {
        // Throttle "No walls generated" log to prevent spam - only log once per second max
        const now = performance.now();
        if (now - this.lastWallGenerationLog >= this.WALL_LOG_THROTTLE_MS) {
          console.log(`[Game] No walls generated - rightmostX: ${rightmostX.toFixed(1)}, target: ${targetDistanceWithBuffer.toFixed(1)}, totalWalls: ${this.horizontalWalls.length}`);
          this.lastWallGenerationLog = now;
        }
      }
    }
  }
  
  // Check if a horizontal wall overlaps with a vertical obstacle
  private checkWallObstacleOverlap(wallY: number, wallHeight: number, obstacle: Obstacle): boolean {
    if (!obstacle || obstacle.orientation === 'horizontal') return false;
    
    // Check if wall's Y range overlaps with obstacle's gap area
    const wallTop = wallY;
    const wallBottom = wallY + wallHeight;
    
    // Vertical obstacle spans full height with a gap
    const gapTop = obstacle.position.y + obstacle.gapY - obstacle.gapHeight / 2;
    const gapBottom = obstacle.position.y + obstacle.gapY + obstacle.gapHeight / 2;
    
    // Check if wall overlaps with the solid parts of the obstacle (not the gap)
    // Wall overlaps if it's in the top solid section or bottom solid section
    const topSectionBottom = gapTop;
    const bottomSectionTop = gapBottom;
    
    // Check if wall overlaps with top section
    const overlapsTop = wallBottom > obstacle.position.y && wallTop < topSectionBottom;
    
    // Check if wall overlaps with bottom section
    const overlapsBottom = wallBottom > bottomSectionTop && wallTop < (obstacle.position.y + obstacle.height);
    
    return overlapsTop || overlapsBottom;
  }
  
  // Find nearby vertical obstacles that a horizontal wall could connect to
  private findNearbyVerticalObstacles(wallX: number, wallY: number, searchRadius: number = 200): Obstacle[] {
    return this.obstacles.filter(obs => {
      if (!obs || obs.orientation === 'horizontal') return false;
      
      // Check if obstacle is within search radius horizontally
      const distanceX = Math.abs(obs.position.x - wallX);
      return distanceX <= searchRadius;
    });
  }
  
  // Find vertical obstacles whose X position overlaps with the horizontal wall's X range
  private findVerticalObstaclesAtX(wallX: number, wallWidth: number, searchRadius: number = 100): Obstacle[] {
    const wallLeft = wallX;
    const wallRight = wallX + wallWidth;
    
    return this.obstacles.filter(obs => {
      if (!obs || obs.orientation === 'horizontal') return false;
      if (typeof obs.gapY !== 'number' || typeof obs.gapHeight !== 'number') return false;
      
      // Check if obstacle's X position overlaps with wall's X range
      const obstacleLeft = obs.position.x;
      const obstacleRight = obs.position.x + obs.width;
      
      // Obstacle overlaps if it's within search radius or directly overlaps
      const distanceX = Math.min(
        Math.abs(obstacleLeft - wallLeft),
        Math.abs(obstacleRight - wallRight),
        Math.abs(obstacleLeft - wallRight),
        Math.abs(obstacleRight - wallLeft)
      );
      
      return distanceX <= searchRadius || 
             (obstacleLeft < wallRight && obstacleRight > wallLeft);
    });
  }
  
  // Check if a horizontal wall blocks any vertical obstacle's gap
  private checkWallBlocksVerticalGap(wallY: number, wallHeight: number, wallX: number, wallWidth: number): boolean {
    const wallTop = wallY;
    const wallBottom = wallY + wallHeight;
    
    // Find vertical obstacles at this X position
    const obstaclesAtX = this.findVerticalObstaclesAtX(wallX, wallWidth);
    
    for (const obstacle of obstaclesAtX) {
      if (!obstacle || typeof obstacle.gapY !== 'number' || typeof obstacle.gapHeight !== 'number') continue;
      
      // Calculate vertical obstacle's gap boundaries
      const gapTop = obstacle.position.y + obstacle.gapY - obstacle.gapHeight / 2;
      const gapBottom = obstacle.position.y + obstacle.gapY + obstacle.gapHeight / 2;
      
      // Check if horizontal wall overlaps with the gap area
      // Wall blocks gap if it overlaps with the gap's Y range
      const overlapsGap = !(wallBottom < gapTop || wallTop > gapBottom);
      
      if (overlapsGap) {
        return true; // Wall blocks this gap
      }
    }
    
    return false; // Wall doesn't block any gaps
  }
  
  // Generate a wall zone based on zone type
  private generateWallZone(startX: number, targetDistance: number, config: GameConfig, level: number): { count: number; rightmostX: number } {
    const wallHeight = 60;
    const minGapWidth = 200; // Increased minimum gap for playability
    // Significantly increased minimum vertical spacing to ensure large navigable paths
    // Ball needs substantial room to move vertically between walls
    const minVerticalSpacing = wallHeight + 300; // Increased to 300px for much better navigation
    let wallsGenerated = 0;
    let currentX = startX;
    
    // Zone-specific parameters
    // Horizontal walls should appear as often or more often than vertical obstacles
    // Use config.walls.spacing as base (same as vertical obstacles) with zone-specific multipliers
    let wallSpacing: number; // Horizontal spacing - matches or exceeds vertical obstacle frequency
    let gapSizeMultiplier: number;
    let maxWallsPerScreen: number; // Maximum walls per screen width - increased to match/exceed vertical obstacles
    
    // Base spacing from config (same as vertical obstacles use)
    const baseSpacing = config.walls.spacing;
    
    switch (this.currentZoneType) {
      case 'barrier':
        // Barrier: Walls appear frequently, matching vertical obstacle frequency
        wallSpacing = baseSpacing * 0.9; // Slightly more frequent than vertical obstacles
        gapSizeMultiplier = Math.max(0.8, 1.0 - (level - 1) * 0.02);
        maxWallsPerScreen = 0.7; // 0.7 walls per screen width - appears frequently
        break;
      case 'corridor':
        // Corridor: Connect to vertical obstacles - frequent walls
        wallSpacing = baseSpacing * 0.8; // More frequent than vertical obstacles
        gapSizeMultiplier = Math.max(0.75, 1.0 - (level - 1) * 0.03);
        maxWallsPerScreen = 0.8; // 0.8 walls per screen width - appears very frequently
        break;
      case 'maze':
        // Maze: Most frequent walls for maze-like navigation
        wallSpacing = baseSpacing * 0.7; // Most frequent - exceeds vertical obstacle frequency
        gapSizeMultiplier = Math.max(0.7, 1.0 - (level - 1) * 0.04);
        maxWallsPerScreen = 1.0; // 1.0 walls per screen width - appears as often as vertical obstacles or more
        break;
    }
    
    // Track all wall Y positions to ensure no vertical overlap
    const usedYPositions: Array<{ y: number; height: number }> = [];
    
    // Helper to check if a Y position would overlap with existing walls
    // Checks both walls in current generation AND all existing walls on screen AND vertical obstacle gaps
    const wouldOverlap = (testY: number, testHeight: number, testX?: number): boolean => {
      const testTop = testY;
      const testBottom = testY + testHeight;
      const minSpacing = minVerticalSpacing; // Use the minimum spacing constant
      
      // Check against walls in current generation
      for (const existing of usedYPositions) {
        const existingTop = existing.y;
        const existingBottom = existing.y + existing.height;
        
        // Check for overlap (with minimum spacing buffer to ensure navigable gaps)
        // This ensures there's always enough vertical space for the ball to pass between walls
        if (!(testBottom < existingTop - minSpacing || testTop > existingBottom + minSpacing)) {
          return true;
        }
      }
      
      // Check against all existing horizontal walls on screen
      // Only check walls that are near the test X position (within reasonable range)
      for (const existingWall of this.horizontalWalls) {
        if (!existingWall || !existingWall.position) continue;
        
        // If testX is provided, only check walls near that X position
        if (testX !== undefined) {
          const distanceX = Math.abs(existingWall.position.x - testX);
          // Only check walls within 2 screen widths
          if (distanceX > this.canvas.width * 2) continue;
        }
        
        const existingTop = existingWall.position.y;
        const existingBottom = existingWall.position.y + existingWall.height;
        
        // Check for overlap (with minimum spacing buffer to ensure navigable gaps)
        // Critical: This spacing ensures the ball can always navigate vertically between walls
        if (!(testBottom < existingTop - minSpacing || testTop > existingBottom + minSpacing)) {
          return true;
        }
      }
      
      // Check if this position would block any vertical obstacle gaps
      // Only check if testX is provided (we need X position to check vertical obstacles)
      if (testX !== undefined) {
        const testWallWidth = this.canvas.width; // Horizontal walls span full screen width
        if (this.checkWallBlocksVerticalGap(testY, testHeight, testX, testWallWidth)) {
          return true; // This position would block a vertical gap
        }
      }
      
      return false;
    };
    
    // Helper to find a valid Y position - improved to always find valid position
    const findValidYPosition = (preferredY?: number, testX?: number): number => {
      const margin = this.canvas.height * 0.1;
      const minY = margin;
      const maxY = this.canvas.height - margin - wallHeight;
      
      // Ensure we have valid range
      if (maxY <= minY) {
        // Canvas too small, use center
        return this.canvas.height / 2 - wallHeight / 2;
      }
      
      // Try preferred Y first if provided
      if (preferredY !== undefined) {
        const clampedY = Math.max(minY, Math.min(maxY, preferredY));
        if (!wouldOverlap(clampedY, wallHeight, testX)) {
          return clampedY;
        }
      }
      
      // Try random positions until we find one that doesn't overlap
      let attempts = 0;
      const MAX_RANDOM_ATTEMPTS = 50; // Increased attempts
      while (attempts < MAX_RANDOM_ATTEMPTS) {
        const testY = minY + Math.random() * (maxY - minY);
        if (!wouldOverlap(testY, wallHeight, testX)) {
          return testY;
        }
        attempts++;
      }
      
      // Fallback: systematically search for non-overlapping position
      // Use smaller step size for better coverage
      const stepSize = Math.max(10, (maxY - minY) / 50); // At least 50 positions to check
      let bestY = minY;
      let maxDistance = 0;
      let foundNonOverlapping = false;
      
      for (let y = minY; y <= maxY; y += stepSize) {
        // Prefer non-overlapping positions
        if (!wouldOverlap(y, wallHeight, testX)) {
          if (!foundNonOverlapping) {
            foundNonOverlapping = true;
            bestY = y;
            maxDistance = Infinity; // Reset to prioritize non-overlapping
          }
          // Among non-overlapping positions, pick the one with max distance from existing walls
          let minDistance = Infinity;
          for (const existing of usedYPositions) {
            const existingCenter = existing.y + existing.height / 2;
            const testCenter = y + wallHeight / 2;
            const distance = Math.abs(testCenter - existingCenter);
            minDistance = Math.min(minDistance, distance);
          }
          // Also check against existing walls
          for (const existingWall of this.horizontalWalls) {
            if (!existingWall || !existingWall.position) continue;
            if (testX !== undefined) {
              const distanceX = Math.abs(existingWall.position.x - testX);
              if (distanceX > this.canvas.width * 2) continue;
            }
            const existingCenter = existingWall.position.y + existingWall.height / 2;
            const testCenter = y + wallHeight / 2;
            const distance = Math.abs(testCenter - existingCenter);
            minDistance = Math.min(minDistance, distance);
          }
          if (minDistance > maxDistance) {
            maxDistance = minDistance;
            bestY = y;
          }
        } else if (!foundNonOverlapping) {
          // If no non-overlapping position found yet, track the best overlapping one
          let minDistance = Infinity;
          for (const existing of usedYPositions) {
            const existingCenter = existing.y + existing.height / 2;
            const testCenter = y + wallHeight / 2;
            const distance = Math.abs(testCenter - existingCenter);
            minDistance = Math.min(minDistance, distance);
          }
          // Also check against existing walls
          for (const existingWall of this.horizontalWalls) {
            if (!existingWall || !existingWall.position) continue;
            if (testX !== undefined) {
              const distanceX = Math.abs(existingWall.position.x - testX);
              if (distanceX > this.canvas.width * 2) continue;
            }
            const existingCenter = existingWall.position.y + existingWall.height / 2;
            const testCenter = y + wallHeight / 2;
            const distance = Math.abs(testCenter - existingCenter);
            minDistance = Math.min(minDistance, distance);
          }
          if (minDistance > maxDistance) {
            maxDistance = minDistance;
            bestY = y;
          }
        }
      }
      
      // Final validation: ensure returned position respects minimum spacing
      // If we found a non-overlapping position, use it
      if (foundNonOverlapping) {
        return bestY;
      }
      
      // If we couldn't find non-overlapping, ensure minimum spacing from closest wall
      // This prevents impossible navigation paths
      const finalY = bestY;
      let minSpacingToClosest = Infinity;
      for (const existing of usedYPositions) {
        const existingTop = existing.y;
        const existingBottom = existing.y + existing.height;
        const testTop = finalY;
        const testBottom = finalY + wallHeight;
        const spacing = Math.min(
          Math.abs(testBottom - existingTop),
          Math.abs(testTop - existingBottom)
        );
        minSpacingToClosest = Math.min(minSpacingToClosest, spacing);
      }
      
      // If spacing is too small, adjust position
      if (minSpacingToClosest < minVerticalSpacing) {
        // Try to find a position with better spacing
        for (let y = minY; y <= maxY; y += stepSize) {
          let minSpacing = Infinity;
          for (const existing of usedYPositions) {
            const existingTop = existing.y;
            const existingBottom = existing.y + existing.height;
            const testTop = y;
            const testBottom = y + wallHeight;
            const spacing = Math.min(
              Math.abs(testBottom - existingTop),
              Math.abs(testTop - existingBottom)
            );
            minSpacing = Math.min(minSpacing, spacing);
          }
          if (minSpacing >= minVerticalSpacing) {
            return y;
          }
        }
      }
      
      return finalY;
    };
    
    // Generate walls continuously until we reach the target distance
    // Limit density: calculate max walls based on distance and maxWallsPerScreen
    const distanceToCover = targetDistance - startX;
    const maxWallsForDistance = Math.floor((distanceToCover / this.canvas.width) * maxWallsPerScreen);
    // Let density control generation - walls appear frequently to match/exceed vertical obstacles
    let maxWallsGenerated = Math.max(1, maxWallsForDistance); // Minimum of 1 wall to ensure generation
    // Cap maximum to prevent any accidental over-generation, but allow more walls
    maxWallsGenerated = Math.min(maxWallsGenerated, 10); // Increased cap to allow more frequent generation
    
    // Generate walls continuously until we reach the target distance
    // Limit total walls based on density settings to match/exceed vertical obstacle frequency
    while (currentX < targetDistance && wallsGenerated < maxWallsGenerated) {
      
      let wallY: number;
      let connectedObstacle: Obstacle | null = null;
      
      // CRITICAL: Horizontal walls should ONLY create helpful platforms, not obstacles
      // Only generate walls that align with vertical obstacle gaps to create traversable paths
      const nearbyObstacles = this.findNearbyVerticalObstacles(currentX, 0, 1000); // Large search radius
      
      if (nearbyObstacles.length > 0) {
        // Find obstacles whose gaps we can align with to create platforms
        const alignableObstacles = nearbyObstacles.filter(obs => {
          if (typeof obs.gapY !== 'number' || typeof obs.gapHeight !== 'number') return false;
          const gapCenterY = obs.position.y + obs.gapY;
          // Check if we can place a wall at this gap position without blocking
          const testWallY = gapCenterY - wallHeight / 2;
          // Wall should be positioned to create a platform AT the gap, not block it
          // The wall should be slightly above or below the gap center to create a landing platform
          return !this.checkWallBlocksVerticalGap(testWallY, wallHeight, currentX, this.canvas.width);
        });
        
        if (alignableObstacles.length > 0) {
          // Prefer aligning with gaps - this creates platforms that help traversal
          const obstacle = alignableObstacles[Math.floor(Math.random() * alignableObstacles.length)];
          const obstacleGapCenterY = obstacle.position.y + obstacle.gapY;
          // Align wall center with obstacle gap center to create a platform
          wallY = obstacleGapCenterY - wallHeight / 2;
          connectedObstacle = obstacle;
          
          // Ensure wall doesn't block the gap (shouldn't happen, but double-check)
          if (this.checkWallBlocksVerticalGap(wallY, wallHeight, currentX, this.canvas.width)) {
            // If it would block, skip this wall entirely - don't generate random walls
            if (this.DEBUG_MODE) {
              console.log(`[Game] Skipping horizontal wall - cannot align with gap without blocking`);
            }
            currentX += wallSpacing;
            continue;
          }
        } else {
          // No alignable obstacles - always generate fallback wall to ensure continuous generation
          // Generate a wall at a safe Y position as fallback
          wallY = findValidYPosition(undefined, currentX);
          if (this.DEBUG_MODE) {
            console.log(`[Game] Generating fallback horizontal wall - no alignable obstacles, wallY: ${wallY.toFixed(1)}`);
          }
        }
      } else {
        // No nearby obstacles - always generate fallback wall to ensure continuous generation
        // This ensures walls are always generated even when there are no vertical obstacles nearby
        wallY = findValidYPosition(undefined, currentX);
        if (this.DEBUG_MODE) {
          console.log(`[Game] Generating fallback horizontal wall - no vertical obstacles nearby, wallY: ${wallY.toFixed(1)}`);
        }
      }
      
      // Ensure wall doesn't overlap (double-check with current X position)
      // If overlap detected, try to find a different position before giving up
      let attempts = 0;
      const MAX_RETRY_ATTEMPTS = 10; // Increased attempts to find non-blocking position
      const wallWidth = this.canvas.width; // Horizontal walls span full screen width
      
      while ((wouldOverlap(wallY, wallHeight, currentX) || 
              this.checkWallBlocksVerticalGap(wallY, wallHeight, currentX, wallWidth)) && 
             attempts < MAX_RETRY_ATTEMPTS) {
        // Try finding a different Y position that doesn't block gaps
        wallY = findValidYPosition(undefined, currentX);
        attempts++;
      }
      
      // If wall still blocks a gap after retries, try to find a better position
      // Try multiple times to find a position that doesn't block gaps
      if (this.checkWallBlocksVerticalGap(wallY, wallHeight, currentX, wallWidth)) {
        let gapBlockingAttempts = 0;
        const MAX_GAP_BLOCKING_ATTEMPTS = 30; // Increased attempts to find non-blocking position
        while (this.checkWallBlocksVerticalGap(wallY, wallHeight, currentX, wallWidth) && gapBlockingAttempts < MAX_GAP_BLOCKING_ATTEMPTS) {
          wallY = findValidYPosition(undefined, currentX);
          gapBlockingAttempts++;
        }
        
        // If we still can't find a non-blocking position after many attempts, 
        // only skip if we've already generated several walls (to ensure we generate at least some walls)
        if (this.checkWallBlocksVerticalGap(wallY, wallHeight, currentX, wallWidth) && wallsGenerated >= 3) {
          if (this.DEBUG_MODE) {
            console.log(`[Game] Skipping horizontal wall at X=${currentX.toFixed(1)}, Y=${wallY.toFixed(1)} - blocks vertical gap after ${gapBlockingAttempts} attempts`);
          }
          // Skip to next iteration without generating this wall
          currentX += wallSpacing;
          continue;
        }
        
        // Otherwise, generate the wall even if it blocks a gap (better than no walls at all)
        if (this.DEBUG_MODE && gapBlockingAttempts > 0) {
          console.log(`[Game] Generated wall despite potential gap blocking after ${gapBlockingAttempts} attempts`);
        }
      }
      
      // Record this wall's Y position
      usedYPositions.push({ y: wallY, height: wallHeight });
      
      // Generate gap for this wall - ensure it's always navigable
      // Wall spans from currentX to currentX + this.canvas.width (full screen width)
      const wallLeft = currentX;
      const wallRight = currentX + this.canvas.width;
      // wallWidth already declared above
      
      let gapX: number;
      if (connectedObstacle) {
        // For seamless connection, align gap precisely with vertical obstacle's center
        // This creates a continuous path through the connected structure
        gapX = connectedObstacle.position.x + connectedObstacle.width / 2;
        // Keep gap within wall bounds but prefer alignment with obstacle
        gapX = Math.max(wallLeft + minGapWidth / 2, Math.min(wallRight - minGapWidth / 2, gapX));
      } else {
        // Place gap in a good position (not too close to edges)
        // Use middle 50% of wall, with margins from edges
        const margin = wallWidth * 0.25; // 25% margin from each edge
        const gapCenterRange = wallWidth * 0.5; // Middle 50% of wall
        const gapCenterStart = wallLeft + margin;
        gapX = gapCenterStart + Math.random() * gapCenterRange;
      }
      
      // Gap width - ensure it's always large enough
      const normalizedGapWidth = randomInRange(config.walls.gapHeightMin, config.walls.gapHeightMax);
      let gapWidth = normalizedGapWidth * this.canvas.width * gapSizeMultiplier;
      
      // Critical: Ensure gap is navigable by checking against ball radius
      const ballRadius = this.ball.radius || 15; // Default to 15px if not set
      const minNavigableGapWidth = Math.max(minGapWidth, ballRadius * 2.5); // Safety margin for navigation
      gapWidth = Math.max(gapWidth, minNavigableGapWidth); // Enforce absolute minimum
      
      // Ensure gap width doesn't exceed wall width (with margin)
      const maxGapWidth = wallWidth * 0.8; // Max 80% of wall width
      gapWidth = Math.min(gapWidth, maxGapWidth);
      
      // Ensure gap doesn't go outside wall bounds - use wall's actual bounds
      const gapLeft = gapX - gapWidth / 2;
      const gapRight = gapX + gapWidth / 2;
      const marginFromEdge = gapWidth / 2 + 10; // 10px safety margin
      
      if (gapLeft < wallLeft + marginFromEdge) {
        // Gap too close to left edge, shift right
        gapX = wallLeft + marginFromEdge;
      } else if (gapRight > wallRight - marginFromEdge) {
        // Gap too close to right edge, shift left
        gapX = wallRight - marginFromEdge;
      }
      
      // Final validation: ensure gap is fully within wall bounds
      const finalGapLeft = gapX - gapWidth / 2;
      const finalGapRight = gapX + gapWidth / 2;
      if (finalGapLeft < wallLeft || finalGapRight > wallRight) {
        // If still out of bounds, center it in the wall
        gapX = (wallLeft + wallRight) / 2;
      }
      
      // Determine gap type (less frequent special gaps for better playability)
      const gapTypeRoll = Math.random();
      let gapType: GapType = 'none';
      if (gapTypeRoll < 0.15) {
        gapType = 'powerup';
        // Reduce size but ensure it's still navigable
        gapWidth = Math.max(gapWidth * 0.9, minNavigableGapWidth);
      } else if (gapTypeRoll < 0.25) {
        gapType = 'shortcut';
        // Reduce size but ensure it's still navigable
        gapWidth = Math.max(gapWidth * 0.85, minNavigableGapWidth);
      } else if (gapTypeRoll < 0.28) {
        gapType = 'level-transition';
        gapWidth = Math.min(gapWidth * 1.3, maxGapWidth); // Larger but capped
      }
      
      // Final safety check: ensure gap width is still navigable after type adjustments
      gapWidth = Math.max(gapWidth, minNavigableGapWidth);
      
      // Log warning if gap is at minimum (for debugging)
      if (this.DEBUG_MODE && gapWidth <= minNavigableGapWidth * 1.1) {
        console.log(`[Game] Gap at minimum navigable size: ${gapWidth.toFixed(1)}px (ball radius: ${ballRadius}px)`);
      }
      
      // Create wall
      const wallStyle: WallStyle = connectedObstacle?.wallStyle || (selectFromProbabilities(config.walls.styleProbabilities) as WallStyle);
      const wallColor = connectedObstacle?.wallColor || getRandomColorFromPalette(config.walls.colorPalette);
      let obstacleType: 'pipe' | 'spike' | 'moving' = connectedObstacle?.obstacleType || 'pipe';
      if (wallStyle === 'spike') obstacleType = 'spike';
      else if (wallStyle === 'moving') obstacleType = 'moving';
      
      const wall: Obstacle = {
        position: { x: currentX, y: wallY },
        width: this.canvas.width,
        height: wallHeight,
        gapY: 0,
        gapHeight: 0,
        orientation: 'horizontal',
        gapX: gapX,
        gapWidth: gapWidth,
        gapType: gapType,
        obstacleType: obstacleType,
        wallStyle: wallStyle,
        wallColor: wallColor,
        theme: this.currentTheme,
        passed: false,
        isLevelTransition: gapType === 'level-transition',
        connectedObstacleId: connectedObstacle ? this.obstacles.indexOf(connectedObstacle) : undefined,
        connectionType: connectedObstacle ? 'seamless' : undefined
      };
      
      // Add power-up if it's a power-up gap
      if (gapType === 'powerup' && Math.random() < config.powerUps.spawnChance * 1.5) {
        wall.powerUp = this.generatePowerUp(
          gapX,
          wallY + wallHeight / 2,
          config
        );
      }
      
      this.horizontalWalls.push(wall);
      wallsGenerated++;
      currentX += wallSpacing;
    }
    
    // Safety check: ensure at least one wall was generated
    if (wallsGenerated === 0 && this.horizontalWalls.length === 0) {
      // Emergency fallback: generate at least one wall to prevent empty state
      const emergencyWallY = this.canvas.height / 2 - wallHeight / 2;
      const emergencyGapX = startX + this.canvas.width / 2;
      const ballRadius = this.ball.radius || 15;
      const emergencyGapWidth = Math.max(minGapWidth, ballRadius * 2.5);
      
      const emergencyWall: Obstacle = {
        position: { x: startX, y: emergencyWallY },
        width: this.canvas.width,
        height: wallHeight,
        gapY: 0,
        gapHeight: 0,
        orientation: 'horizontal',
        gapX: emergencyGapX,
        gapWidth: emergencyGapWidth,
        gapType: 'none',
        obstacleType: 'pipe',
        wallStyle: 'pipe',
        wallColor: getRandomColorFromPalette(config.walls.colorPalette),
        theme: this.currentTheme,
        passed: false,
        isLevelTransition: false
      };
      
      this.horizontalWalls.push(emergencyWall);
      wallsGenerated = 1;
      
      if (this.DEBUG_MODE) {
        console.warn(`[Game] Emergency wall generated - no walls were created in normal flow`);
      }
    }
    
    // Return both count and rightmost X position reached
    // The rightmost X is the right edge of the last wall generated
    const rightmostX = wallsGenerated > 0 ? currentX - wallSpacing + this.canvas.width : startX;
    
    // Validation: log warning if no walls generated
    if (wallsGenerated === 0 && this.DEBUG_MODE) {
      console.warn(`[Game] No walls generated in generateWallZone. startX: ${startX}, targetDistance: ${targetDistance}, currentX: ${currentX}`);
    }
    
    return { count: wallsGenerated, rightmostX };
  }
  
  // Generate a Y position for a horizontal wall
  private generateWallYPosition(): number {
    // Generate walls at various Y positions throughout the canvas
    // Avoid placing walls too close to top/bottom edges (leave 10% margin)
    const margin = this.canvas.height * 0.1;
    const minY = margin;
    const maxY = this.canvas.height - margin;
    
    // Use a pattern that ensures variety but maintains playability
    // Alternate between upper, middle, and lower sections
    const section = Math.floor(Math.random() * 3); // 0 = upper, 1 = middle, 2 = lower
    const sectionHeight = (maxY - minY) / 3;
    const sectionMinY = minY + section * sectionHeight;
    const sectionMaxY = sectionMinY + sectionHeight;
    
    return sectionMinY + Math.random() * (sectionMaxY - sectionMinY);
  }
  
  // Legacy method - kept for backward compatibility but no longer used
  private initializeHorizontalWalls(): void {
    const config = getConfigForDifficulty(this.difficulty);
    
    // Wall height (thickness)
    const wallHeight = 60; // Fixed height for initial walls
    
    // Select wall style and color
    const wallStyle = selectFromProbabilities(config.walls.styleProbabilities);
    const wallColor = getRandomColorFromPalette(config.walls.colorPalette);
    
    // Map wall style to obstacle type
    let obstacleType: 'pipe' | 'spike' | 'moving' = 'pipe';
    if (wallStyle === 'spike') obstacleType = 'spike';
    else if (wallStyle === 'moving') obstacleType = 'moving';
    
    // Create top wall - spans full width, no gap initially
    const topWall: Obstacle = {
      position: { x: 0, y: 0 },
      width: this.canvas.width, // Full width
      height: wallHeight,
      gapY: 0,
      gapHeight: 0,
      orientation: 'horizontal',
      gapX: undefined, // No gap initially
      gapWidth: undefined,
      gapType: 'none', // No gap initially
      obstacleType: obstacleType,
      wallStyle: wallStyle,
      wallColor: wallColor,
      theme: this.currentTheme,
      passed: false,
      isLevelTransition: false
    };
    
    // Create bottom wall - spans full width, no gap initially
    const bottomWall: Obstacle = {
      position: { x: 0, y: this.canvas.height - wallHeight },
      width: this.canvas.width, // Full width
      height: wallHeight,
      gapY: 0,
      gapHeight: 0,
      orientation: 'horizontal',
      gapX: undefined, // No gap initially
      gapWidth: undefined,
      gapType: 'none', // No gap initially
      obstacleType: obstacleType,
      wallStyle: wallStyle,
      wallColor: wallColor,
      theme: this.currentTheme,
      passed: false,
      isLevelTransition: false
    };
    
    this.horizontalWalls = [topWall, bottomWall];
    this.lastHorizontalWallY = { top: 0, bottom: this.canvas.height - wallHeight };
    
    // Log horizontal walls initialization
    console.log('[GAME_DEBUG] ===== HORIZONTAL WALLS INITIALIZED =====');
    console.log('[GAME_DEBUG] Top wall:', { y: topWall.position.y, height: topWall.height, width: topWall.width });
    console.log('[GAME_DEBUG] Bottom wall:', { y: bottomWall.position.y, height: bottomWall.height, width: bottomWall.width });
    console.log('[GAME_DEBUG] Canvas height:', this.canvas.height);
    console.log('[GAME_DEBUG] Expected top wall y: 0');
    console.log('[GAME_DEBUG] Expected bottom wall y:', this.canvas.height - wallHeight);
    console.log('[GAME_DEBUG] =========================================');
  }
  
  

  // Generate horizontal walls (top and bottom) - adds gaps to existing walls
  private generateHorizontalWalls(): void {
    // If walls don't exist, initialize with empty array
    // This matches the behavior in constructor and start methods
    if (this.horizontalWalls.length === 0) {
      this.horizontalWalls = [];
      if (this.DEBUG_MODE) {
        console.log('[Game] Initialized horizontal walls as empty array in generateHorizontalWalls');
      }
      return;
    }

    const config = getConfigForDifficulty(this.difficulty);

    // Find top and bottom walls
    const topWall = this.horizontalWalls.find(w => w.position.y < this.canvas.height / 2);
    const bottomWall = this.horizontalWalls.find(w => w.position.y >= this.canvas.height / 2);

    if (!topWall || !bottomWall) {
      // Reinitialize with empty array if walls are missing
      // This matches the behavior in constructor and start methods
      this.horizontalWalls = [];
      if (this.DEBUG_MODE) {
        console.log('[Game] Reinitialized horizontal walls as empty array in generateHorizontalWalls');
      }
      return;
    }

    // DEBUG: Log wall coverage status
    if (this.DEBUG_MODE) {
      console.log(`[DEBUG] Horizontal walls: top=${topWall ? topWall.position.y.toFixed(1) : 'null'}, bottom=${bottomWall ? bottomWall.position.y.toFixed(1) : 'null'}`);
      console.log(`[DEBUG] Camera offset: ${this.cameraOffsetY.toFixed(1)}, ball Y: ${this.ball.position.y.toFixed(1)}`);
    }

    // Generate new gaps ahead of the ball
    // Gaps should appear ahead of the ball's current position
    const minDistanceAhead = this.canvas.width;
    const spacing = config.walls.spacing * 0.8;

    // Check if we need to add gaps
    // If wall has no gap, or gap has scrolled off-screen, or gap is behind the ball, add a new one
    const ballX = this.ball.position.x;
    const topNeedsGap = !topWall.gapX || topWall.gapX < ballX - this.canvas.width || 
                       (topWall.gapX && topWall.gapX < ballX - 50); // Gap is too far behind ball
    const bottomNeedsGap = !bottomWall.gapX || bottomWall.gapX < ballX - this.canvas.width ||
                           (bottomWall.gapX && bottomWall.gapX < ballX - 50); // Gap is too far behind ball

    if (this.DEBUG_MODE && (topNeedsGap || bottomNeedsGap)) {
      console.log(`[DEBUG] Adding gaps: top=${topNeedsGap}, bottom=${bottomNeedsGap}, ballX=${this.ball.position.x.toFixed(1)}`);
    }

    if (topNeedsGap) {
      // Generate gap position ahead of ball
      const gapX = this.ball.position.x + minDistanceAhead + Math.random() * spacing;
      this.addGapToWall(topWall, gapX, config);
    }

    if (bottomNeedsGap) {
      // Generate gap position ahead of ball (can be offset from top gap)
      const gapX = this.ball.position.x + minDistanceAhead + Math.random() * spacing;
      this.addGapToWall(bottomWall, gapX, config);
    }
  }
  
  // Add a gap to a horizontal wall at the specified X position
  private addGapToWall(wall: Obstacle, gapX: number, config: GameConfig): void {
    // Determine gap type based on game state and probabilities
    // Gaps should only appear for distinct reasons:
    // 1. Power-up gap: Contains a power-up (advantage: get power-up, disadvantage: smaller gap)
    // 2. Shortcut gap: Faster path (advantage: skip ahead, disadvantage: narrower gap, harder to hit)
    // 3. Level transition gap: Changes level/theme (advantage: visual change, disadvantage: larger but rarer)
    // 4. None: No gap (normal gameplay)
    
    const gapTypeRoll = Math.random();
    let gapType: GapType = 'none';
    let finalGapWidth: number;
    const minGapWidth = 120;
    
    if (gapTypeRoll < 0.3) {
      // 30% chance: Power-up gap (smaller, contains power-up)
      gapType = 'powerup';
      const normalizedGapWidth = randomInRange(config.walls.gapHeightMin * 0.7, config.walls.gapHeightMax * 0.7);
      let gapWidth = normalizedGapWidth * this.canvas.width;
      gapWidth = Math.max(gapWidth, minGapWidth * 0.8);
      const level = this.getLevelNumber();
      const gapMultiplier = this.getGapSizeMultiplier(level);
      finalGapWidth = gapWidth * gapMultiplier;
      finalGapWidth = Math.max(finalGapWidth, minGapWidth * 0.8);
      
      // Add power-up in the gap
      if (Math.random() < config.powerUps.spawnChance * 1.5) { // Higher chance in power-up gaps
        const powerUpY = wall.position.y + wall.height / 2;
        wall.powerUp = this.generatePowerUp(gapX, powerUpY, config);
      }
    } else if (gapTypeRoll < 0.5) {
      // 20% chance: Shortcut gap (narrower, but allows skipping ahead)
      gapType = 'shortcut';
      const normalizedGapWidth = randomInRange(config.walls.gapHeightMin * 0.6, config.walls.gapHeightMax * 0.6);
      let gapWidth = normalizedGapWidth * this.canvas.width;
      gapWidth = Math.max(gapWidth, minGapWidth * 0.7);
      const level = this.getLevelNumber();
      const gapMultiplier = this.getGapSizeMultiplier(level);
      finalGapWidth = gapWidth * gapMultiplier;
      finalGapWidth = Math.max(finalGapWidth, minGapWidth * 0.7);
    } else if (gapTypeRoll < 0.55) {
      // 5% chance: Level transition gap (larger, special effect)
      gapType = 'level-transition';
      const normalizedGapWidth = randomInRange(config.walls.gapHeightMin, config.walls.gapHeightMax);
      let gapWidth = normalizedGapWidth * this.canvas.width;
      gapWidth = Math.max(gapWidth, minGapWidth);
      const level = this.getLevelNumber();
      const gapMultiplier = this.getGapSizeMultiplier(level);
      finalGapWidth = gapWidth * gapMultiplier * 1.5; // Larger for level transitions
      finalGapWidth = Math.max(finalGapWidth, minGapWidth * 1.5);
      wall.isLevelTransition = true;
    } else {
      // 45% chance: No gap (normal wall)
      gapType = 'none';
      finalGapWidth = 0;
    }
    
    // Only set gap properties if there's actually a gap
    if (gapType !== 'none') {
      wall.gapX = gapX;
      wall.gapWidth = finalGapWidth;
      wall.gapType = gapType;
    } else {
      wall.gapX = undefined;
      wall.gapWidth = undefined;
      wall.gapType = 'none';
    }
  }
  
  private checkThemeChange(): void {
    // Change theme every 500 points
    if (this.score >= this.lastThemeChangeScore + 500) {
      this.currentTheme = getRandomThemeKey();
      this.renderer.setTheme(this.currentTheme);
      this.lastThemeChangeScore = this.score;
      
      // Play theme change sound
      this.soundManager.playPop();
      
      // Add particle explosion when theme changes
      this.particleSystem.addExplosion(
        this.canvas.width / 2, 
        this.canvas.height / 2, 
        getTheme(this.currentTheme).ballColor, 
        20
      );
    }
  }
  
  // Update camera to follow ball when traversing through gaps
  private updateCameraForGapTraversal(deltaTime: number): void {
    // Always calculate target camera offset based on ball's vertical position
    // This ensures the camera follows the ball continuously, not just when in gaps
    const centerY = this.canvas.height / 2;
    const ballOffsetFromCenter = this.ball.position.y - centerY;

    // Calculate target camera offset to keep ball visible
    // Negative offset when ball is above center (camera moves up)
    // Positive offset when ball is below center (camera moves down)
    this.targetCameraOffsetY = -ballOffsetFromCenter;

    // Smoothly interpolate camera offset to follow the ball
    this.cameraOffsetY += (this.targetCameraOffsetY - this.cameraOffsetY) * this.CAMERA_FOLLOW_SPEED * deltaTime;

    // Clamp camera offset to reasonable bounds (don't go too far off screen)
    const maxOffset = this.canvas.height * 0.3;
    this.cameraOffsetY = Math.max(-maxOffset, Math.min(maxOffset, this.cameraOffsetY));

    // DEBUG: Log camera movement for artifacting analysis (throttled - only when offset changes significantly)
    // Only log when camera offset changes by more than 5px to reduce spam
    if (this.DEBUG_MODE && Math.abs(this.cameraOffsetY) > 10) {
      const cameraChange = Math.abs(this.cameraOffsetY - (this.lastCameraLogOffset || 0));
      if (cameraChange > 5) {
        console.log(`[DEBUG] Camera: ballY=${this.ball.position.y.toFixed(1)}, centerY=${centerY.toFixed(1)}, offset=${this.cameraOffsetY.toFixed(1)}, target=${this.targetCameraOffsetY.toFixed(1)}`);
        this.lastCameraLogOffset = this.cameraOffsetY;
      }
    }
  }
  
  // Handle level transition when ball passes through level transition gap
  private handleLevelTransition(): void {
    // Play special sound for level transition
    this.soundManager.playBeep(880, 0.3);
    
    // Add particle effect
    this.particleSystem.addExplosion(
      this.ball.position.x,
      this.ball.position.y,
      '#8b5cf6', // purple for level transition
      25
    );
    
    // Optional: Increase difficulty or change theme
    // For now, just add visual feedback
    this.triggerShake(3, 5);
  }
  
  private gameLoop(timestamp: number): void {
    try {
      // Validate timestamp to prevent invalid delta calculations
      if (!timestamp || timestamp < 0) {
        console.error('[Game] Invalid timestamp in gameLoop:', timestamp);
        timestamp = performance.now();
      }
      
      // Frame time budgeting - ensure we don't block the main thread
      const frameStartTime = performance.now();
      const MAX_FRAME_TIME_MS = 8; // Target 60fps = ~16ms per frame, but allow some overhead
      
      const deltaMs = timestamp - this.lastTime;
      const deltaTime = deltaMs / 16; // Normalize to 60fps
      this.lastTime = timestamp;
      
      // Clamp deltaTime to prevent huge jumps that could break physics
      const clampedDeltaTime = Math.min(Math.max(deltaTime, 0), 5); // Max 5x normal speed
      
      // Performance monitoring (reduced frequency for better performance)
      this.frameCount++;
      const timeSinceLastLog = timestamp - this.lastPerformanceLog;
      // Only log performance every 10 seconds instead of 5 to reduce overhead
      if (timeSinceLastLog >= this.PERFORMANCE_LOG_INTERVAL_MS * 2 && this.DEBUG_MODE) {
        const fps = Math.round((this.frameCount * 1000) / timeSinceLastLog);
        console.log(`[Game] Performance: ${fps} FPS, obstacles: ${this.obstacles.length}, walls: ${this.horizontalWalls.length}, status: ${this.status}`);
        this.frameCount = 0;
        this.lastPerformanceLog = timestamp;
        
        // Warn if FPS is too low
        if (fps < 30) {
          console.warn(`[Game] Low FPS detected: ${fps} FPS. This may indicate performance issues.`);
        }
      }
      
      // Initialize performance log on first frame
      if (this.lastPerformanceLog === 0) {
        this.lastPerformanceLog = timestamp;
      }
      
      if (this.status === 'starting') {
        // Countdown before walls spawn and gameplay begins
        this.startDelayRemainingMs -= deltaMs;
        if (this.startDelayRemainingMs <= 0) {
          this.startDelayRemainingMs = 0;
          // Generate initial obstacles once, then start playing
          if (this.needsObstacleGeneration) {
            // Reset lastObstacleX to start obstacles closer to the screen
            // This ensures walls appear immediately after countdown
            this.lastObstacleX = this.canvas.width;
            try {
              this.generateObstaclesFromChunks();
            } catch {
              console.error('[Game] Error generating initial obstacles');
              // Continue anyway - procedural generation will handle it
            }
          }
          // No need to create gaps in horizontal walls at start
          // Ball starts in middle, walls are at top/bottom - no collision possible initially
          // Gaps will be created dynamically when ball approaches walls
          const previousStatus = this.status;
          this.status = 'playing';
          this.gameStartTime = performance.now(); // Record when gameplay actually starts
          this.lastSurvivalScoreTime = 0; // Reset survival scoring timer
          if (this.DEBUG_MODE) {
            console.log('[GAME_DEBUG] ===== STATE TRANSITION =====');
            console.log('[GAME_DEBUG] Previous status:', previousStatus);
            console.log('[GAME_DEBUG] New status: playing');
            console.log('[GAME_DEBUG] Game start time:', this.gameStartTime);
            console.log('[GAME_DEBUG] Ball position:', { x: this.ball.position.x, y: this.ball.position.y });
            console.log('[GAME_DEBUG] Horizontal walls:', this.horizontalWalls.map(w => ({ y: w.position.y, height: w.height, gapType: w.gapType })));
            console.log('[GAME_DEBUG] ============================');
          }
        }
      }
      
      // Only update physics/obstacles when playing - skip when gameOver to save performance
      if (this.status === 'playing') {
        try {
          this.update(clampedDeltaTime);
        } catch (error) {
          console.error('[Game] Error in update loop:', error);
          console.error('[Game] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
          // Try to recover by pausing the game
          this.status = 'paused';
          if (this.DEBUG_MODE) {
            console.log('[Game] Game paused due to update error');
          }
        }
      }
      // Skip update() when gameOver - only render the frozen state
      
      try {
        this.render();
      } catch (error) {
        console.error('[Game] Error in render loop:', error);
        console.error('[Game] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
        // Continue loop even if render fails
      }
      
      // Keep rendering loop running for all active states, including gameOver
      // This ensures the frozen gameOver state stays visible until player chooses to continue/restart
      if (this.status === 'playing' || this.status === 'idle' || this.status === 'paused' || this.status === 'starting' || this.status === 'gameOver') {
        // Check frame time and warn if frame took too long
        const frameTime = performance.now() - frameStartTime;
        if (frameTime > MAX_FRAME_TIME_MS && this.DEBUG_MODE) {
          console.warn(`[Game] Frame took ${frameTime.toFixed(2)}ms (target: ${MAX_FRAME_TIME_MS}ms)`);
        }
        
        this.isLoopRunning = true;
        this.animationFrameId = requestAnimationFrame(this.gameLoop.bind(this));
      } else {
        // Unexpected state - stop the loop
        const unexpectedStatus = this.status;
        this.isLoopRunning = false;
        if (this.animationFrameId !== null) {
          cancelAnimationFrame(this.animationFrameId);
          this.animationFrameId = null;
        }
        if (this.DEBUG_MODE) {
          console.warn('[Game] Game loop stopped due to unexpected state:', unexpectedStatus);
          console.warn('[Game] Expected states: playing, idle, paused, starting, gameOver');
        }
      }
    } catch (error) {
      console.error('[Game] Critical error in gameLoop:', error);
      console.error('[Game] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      console.error('[Game] Game state at error:', {
        status: this.status,
        score: this.score,
        ballPosition: this.ball?.position,
        obstaclesCount: this.obstacles?.length
      });
      
      // Try to recover by continuing the loop if we're in a valid state
      if (this.status === 'playing' || this.status === 'idle' || this.status === 'paused' || this.status === 'starting' || this.status === 'gameOver') {
        // Wait a bit before continuing to prevent infinite error loops
        // Use a delay to prevent rapid error loops
        const errorRecoveryDelay = 100;
        // Clear any existing error recovery timeout
        if (this.errorRecoveryTimeoutId !== null) {
          clearTimeout(this.errorRecoveryTimeoutId);
        }
        this.errorRecoveryTimeoutId = setTimeout(() => {
          this.errorRecoveryTimeoutId = null;
          // Double-check status is still valid before resuming
          if (this.status === 'playing' || this.status === 'idle' || this.status === 'paused' || this.status === 'starting' || this.status === 'gameOver') {
            // Ensure we're not already running
            if (!this.isLoopRunning && this.animationFrameId === null) {
              this.isLoopRunning = true;
              this.animationFrameId = requestAnimationFrame(this.gameLoop.bind(this));
              if (this.DEBUG_MODE) {
                console.log('[Game] Game loop recovered from error');
              }
            }
          } else {
            // Invalid state - stop the loop
            this.isLoopRunning = false;
            this.animationFrameId = null;
          }
        }, errorRecoveryDelay);
      } else {
        this.isLoopRunning = false;
        this.animationFrameId = null;
        if (this.DEBUG_MODE) {
          console.warn('[Game] Stopping loop due to invalid state after error:', this.status);
        }
      }
    }
  }
  
  private update(deltaTime: number): void {
    // Get current time once for use throughout the update method
    const currentTime = performance.now();
    
    // Get scroll speed at the beginning of the method to ensure it's available throughout
    const scrollSpeed = this.getAdjustedScrollSpeed();
    
    try {
      // Save checkpoint periodically (every 2.5 seconds) - use requestIdleCallback to avoid blocking
      if (currentTime - this.lastCheckpointSave >= this.CHECKPOINT_INTERVAL_MS) {
        this.lastCheckpointSave = currentTime;
        
        // Cancel any pending checkpoint save to prevent accumulation
        if (this.pendingCheckpointIdleCallback !== null && typeof window !== 'undefined' && 'cancelIdleCallback' in window) {
          window.cancelIdleCallback(this.pendingCheckpointIdleCallback);
          this.pendingCheckpointIdleCallback = null;
        }
        if (this.pendingCheckpointTimeout !== null) {
          clearTimeout(this.pendingCheckpointTimeout);
          this.pendingCheckpointTimeout = null;
        }
        
        // Save checkpoint in idle time to avoid blocking the main thread
        // The saveCheckpoint method already calls onCheckpointSave callback
        if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
          this.pendingCheckpointIdleCallback = window.requestIdleCallback(() => {
            this.pendingCheckpointIdleCallback = null;
            try {
              this.saveCheckpoint();
            } catch (error) {
              console.error('[Game] Error saving checkpoint:', error);
              // Continue - checkpoint saving is non-critical
            }
          }, { timeout: 1000 });
        } else {
          // Fallback for browsers without requestIdleCallback
          this.pendingCheckpointTimeout = setTimeout(() => {
            this.pendingCheckpointTimeout = null;
            try {
              this.saveCheckpoint();
            } catch (error) {
              console.error('[Game] Error saving checkpoint:', error);
            }
          }, 0);
        }
      }
      
      // Survival time scoring - award 1 point per second while playing
      if (this.status === 'playing' && this.gameStartTime > 0) {
        if (this.lastSurvivalScoreTime === 0) {
          // Initialize survival timer when game starts
          this.lastSurvivalScoreTime = currentTime;
        } else if (currentTime - this.lastSurvivalScoreTime >= this.SURVIVAL_SCORE_INTERVAL_MS) {
          // Award survival points with style multiplier
          const styleMultiplier = this.styleMeter.getMultiplier();
          const comboMultiplier = this.comboTracker.getTotalMultiplier();
          const finalMultiplier = styleMultiplier * comboMultiplier;
          this.score += Math.floor(1 * finalMultiplier);
          this.lastSurvivalScoreTime = currentTime;
          if (this.onScoreUpdate) {
            this.onScoreUpdate(this.score);
          }
          
          // Check for perfect run bonus (10 obstacles without collision)
          if (this.perfectRunObstacleCount >= 10) {
            const bonusScore = Math.floor(this.score * 0.1); // 10% bonus
            this.score += bonusScore;
            if (this.onScoreUpdate) this.onScoreUpdate(this.score);
            this.addStyleNotification('PERFECT RUN!', '#10b981');
            this.particleSystem.addBurst(
              this.ball.position.x,
              this.ball.position.y,
              '#10b981', // green
              40
            );
            this.perfectRunObstacleCount = 0; // Reset counter
          }
          
          // Add score milestone celebration particles
          if (this.score % 50 === 0) {
            this.particleSystem.addBurst(
              this.ball.position.x,
              this.ball.position.y,
              '#fbbf24', // amber
              30
            );
          }
        }
      }
      
      // Save previous ball position before updating (for gap passing detection)
      this.previousBallPosition = { x: this.ball.position.x, y: this.ball.position.y };
      
      // Update ball physics
      try {
        updateBallPosition(this.ball, deltaTime);
      } catch {
        console.error('[Game] Error updating ball position');
        // Try to reset ball to safe position
        if (this.ball && this.ball.position) {
          this.ball.position.y = Math.max(20, Math.min(this.canvas.height - 20, this.ball.position.y));
        }
      }
      
      // Add trail particle for ball movement (after position update)
      if (this.status === 'playing') {
        const ballColor = getTheme(this.currentTheme).ballColor;
        // Update trail particles with new ball position
        const trailParticles = (this.particleSystem as unknown as { particles: Particle[] }).particles.filter((p: Particle) => p.type === 'trail');
        if (trailParticles.length > 0) {
          const lastTrail = trailParticles[trailParticles.length - 1];
          (this.particleSystem as unknown as { updateTrail: (particle: Particle, x: number, y: number) => void }).updateTrail(lastTrail, this.ball.position.x, this.ball.position.y);
        } else {
          // Add new trail particle if none exists
          this.particleSystem.addTrail(this.ball.position.x, this.ball.position.y, ballColor);
        }
      }
      
      // Check if ball is traversing through a gap and update camera accordingly
      // Only update camera when game is actually playing (not during continue setup)
      try {
        if (this.status === 'playing') {
          this.updateCameraForGapTraversal(deltaTime);
        }
      } catch {
        console.error('[Game] Error updating camera');
        // Reset camera to safe state
        this.cameraOffsetY = 0;
        this.targetCameraOffsetY = 0;
      }
      
      // Update style system
      try {
        const currentTime = performance.now();
        this.styleMeter.update(deltaTime, currentTime);
        this.comboTracker.update(currentTime);
        
        // Update style notifications
        for (let i = this.styleNotifications.length - 1; i >= 0; i--) {
          const notification = this.styleNotifications[i];
          notification.life -= deltaTime;
          if (notification.life <= 0) {
            this.styleNotifications.splice(i, 1);
          } else {
            // Animate notification
            notification.scale = 1.0 + (1.0 - notification.life / notification.maxLife) * 0.3;
            notification.y -= deltaTime * 0.1; // Float upward
          }
        }
        
        // Check for style level up
        if (this.styleMeter.didLevelUp()) {
          this.addStyleNotification('STYLE UP!', this.styleMeter.getColor());
          this.soundManager.playBeep(800, 0.2);
          this.particleSystem.addBurst(
            this.ball.position.x,
            this.ball.position.y,
            this.styleMeter.getColor(),
            30
          );
        }
        
        // Check for combo milestones
        const activeCombo = this.comboTracker.getActiveCombo();
        if (activeCombo && activeCombo.isActive) {
          if (activeCombo.count === 10 || activeCombo.count === 25 || activeCombo.count === 50) {
            this.addStyleNotification(`COMBO x${activeCombo.count}!`, '#fbbf24');
            this.soundManager.playBeep(600, 0.3);
            this.particleSystem.addBurst(
              this.ball.position.x,
              this.ball.position.y,
              '#fbbf24',
              25
            );
          }
        }
      } catch {
        console.error('[Game] Error updating style system');
      }
      
      // Update particle system
      try {
        this.particleSystem.update(deltaTime);
      } catch {
        console.error('[Game] Error updating particles');
        // Clear particles if update fails
        this.particleSystem.clear();
      }
      
      // Update background parallax scrolling
      try {
        this.renderer.updateBackground(scrollSpeed, deltaTime);
      } catch {
        console.error('[Game] Error updating background');
        // Continue - background update is non-critical
      }
    } catch (error) {
      console.error('[Game] Critical error in update() start:', error);
      throw error; // Re-throw to be caught by gameLoop
    }
    
    // Update screen shake
    if (this.shakeDuration > 0) {
      this.shakeDuration -= deltaTime;
      if (this.shakeDuration <= 0) {
        this.shakeX = 0;
        this.shakeY = 0;
      } else {
        // Apply shake effect
        this.shakeX = (Math.random() - 0.5) * this.shakeIntensity;
        this.shakeY = (Math.random() - 0.5) * this.shakeIntensity;
      }
    }
    
    // Decrease extra time
    if (this.extraTime > 0) {
      this.extraTime -= deltaTime / 60; // Decrease by 1 second per 60 frames
      if (this.extraTime < 0) this.extraTime = 0;
    }
    
    // Update slow motion - validate and disable if expired or invalid
    if (this.slowMotionActive) {
      // Disable if end time is in the past or invalid
      if (this.slowMotionEndTime <= 0 || currentTime >= this.slowMotionEndTime) {
        this.slowMotionActive = false;
        this.slowMotionEndTime = 0;
        if (this.DEBUG_MODE) {
          console.log('[Game] Slow motion disabled - expired or invalid');
        }
      }
    }
    
    // Update speed boost
    if (this.speedBoostActive) {
      if (this.speedBoostEndTime <= 0 || currentTime >= this.speedBoostEndTime) {
        this.speedBoostActive = false;
        this.speedBoostEndTime = 0;
      }
    }
    
    // Update magnet
    if (this.magnetActive) {
      if (this.magnetEndTime <= 0 || currentTime >= this.magnetEndTime) {
        this.magnetActive = false;
        this.magnetEndTime = 0;
      }
    }
    
    // Update score multiplier
    if (this.scoreMultiplier > 1) {
      if (this.scoreMultiplierEndTime <= 0 || currentTime >= this.scoreMultiplierEndTime) {
        this.scoreMultiplier = 1;
        this.scoreMultiplierEndTime = 0;
      }
    }
    
    // Update gravity flip
    if (this.gravityFlipActive) {
      if (this.gravityFlipEndTime <= 0 || currentTime >= this.gravityFlipEndTime) {
        this.gravityFlipActive = false;
        this.gravityFlipEndTime = 0;
        this.ball.gravityScale = this.originalGravityScale;
      }
    }
    
    // Update random events
    this.updateRandomEvents(currentTime);
    
    // Update power-ups (rotation and pulse animation)
    for (const powerUp of this.powerUps) {
      if (!powerUp.collected) {
        // Magnet attraction - move power-ups toward ball if magnet is active
        if (this.magnetActive) {
          const dx = this.ball.position.x - powerUp.position.x;
          const dy = this.ball.position.y - powerUp.position.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          if (distance <= this.MAGNET_RADIUS && distance > 0) {
            // Attract power-up toward ball
            const attractionSpeed = 5 * deltaTime; // Speed of attraction
            const normalizedDx = dx / distance;
            const normalizedDy = dy / distance;
            powerUp.position.x += normalizedDx * attractionSpeed;
            powerUp.position.y += normalizedDy * attractionSpeed;
          }
        } else {
          // Normal scrolling
          powerUp.position.x -= scrollSpeed * deltaTime;
        }
        
        powerUp.rotation += 3 * deltaTime; // Rotate 3 degrees per frame
        powerUp.pulseScale = 1.0 + Math.sin(performance.now() * 0.005) * 0.2; // Pulse animation
        
        // Check collision with ball
        if (this.checkPowerUpCollision(this.ball, powerUp)) {
          this.collectPowerUp(powerUp);
        }
        
        // Remove off-screen power-ups
        if (powerUp.position.x + powerUp.size < -50) {
          powerUp.collected = true;
        }
      }
    }
    
    // Remove collected power-ups using single-pass iteration (optimization)
    let writeIndex = 0;
    for (let i = 0; i < this.powerUps.length; i++) {
      if (!this.powerUps[i].collected) {
        if (writeIndex !== i) {
          this.powerUps[writeIndex] = this.powerUps[i];
        }
        writeIndex++;
      }
    }
    this.powerUps.length = writeIndex;
    
    // Check power-ups attached to obstacles
    for (const obstacle of this.obstacles) {
      if (obstacle.powerUp && !obstacle.powerUp.collected) {
        // Magnet attraction - move power-ups toward ball if magnet is active
        if (this.magnetActive) {
          const dx = this.ball.position.x - obstacle.powerUp.position.x;
          const dy = this.ball.position.y - obstacle.powerUp.position.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          if (distance <= this.MAGNET_RADIUS && distance > 0) {
            // Attract power-up toward ball
            const attractionSpeed = 5 * deltaTime; // Speed of attraction
            const normalizedDx = dx / distance;
            const normalizedDy = dy / distance;
            obstacle.powerUp.position.x += normalizedDx * attractionSpeed;
            obstacle.powerUp.position.y += normalizedDy * attractionSpeed;
          }
        } else {
          // Normal scrolling
          obstacle.powerUp.position.x -= scrollSpeed * deltaTime;
        }
        
        obstacle.powerUp.rotation += 3 * deltaTime;
        obstacle.powerUp.pulseScale = 1.0 + Math.sin(performance.now() * 0.005) * 0.2;
        
        // Check collision with ball
        if (this.checkPowerUpCollision(this.ball, obstacle.powerUp)) {
          this.collectPowerUp(obstacle.powerUp);
        }
        
        // Remove off-screen power-ups
        if (obstacle.powerUp.position.x + obstacle.powerUp.size < -50) {
          obstacle.powerUp.collected = true;
        }
      }
    }
    
    // Increase difficulty
    this.increaseDifficulty();
    
    // Check for level change and update background
    this.checkLevelChange();
    
    // Check for theme change
    this.checkThemeChange();
    
    // Check for collisions with boundaries (only extreme cases)
    // In Flappy Bird style, boundaries don't cause instant death
    // Since camera follows the ball, only trigger game over if ball is way off-screen despite camera following
    // Skip boundary check during grace period - ball needs time to navigate
    const timeSinceGameStart = this.gameStartTime > 0 ? currentTime - this.gameStartTime : Infinity;
    const GRACE_PERIOD_MS = 5000; // Extended grace period for boundary checks
    const isInGracePeriod = this.status === 'starting' || (this.status === 'playing' && timeSinceGameStart < GRACE_PERIOD_MS);
    
    if (!isInGracePeriod) {
      const boundaryCollision = checkBoundaryCollision(this.ball, this.canvas.height, this.cameraOffsetY);
      if (boundaryCollision) {
        const ballScreenY = this.ball.position.y - this.cameraOffsetY;
        const ballTop = ballScreenY - this.ball.radius;
        const ballBottom = ballScreenY + this.ball.radius;
        console.log('[GAME_DEBUG] ===== BOUNDARY COLLISION DETECTED =====');
        console.log('[GAME_DEBUG] Ball screen Y:', ballScreenY.toFixed(2));
        console.log('[GAME_DEBUG] Ball top (screen):', ballTop.toFixed(2));
        console.log('[GAME_DEBUG] Ball bottom (screen):', ballBottom.toFixed(2));
        console.log('[GAME_DEBUG] Canvas height:', this.canvas.height);
        console.log('[GAME_DEBUG] Camera offset Y:', this.cameraOffsetY.toFixed(2));
        console.log('[GAME_DEBUG] ========================================');
        
        // Only game over if ball is way off screen (safety check)
        if (this.extraTime > 0) {
          // Use extra time instead of game over
          this.extraTime = 0;
          // Play a sound effect
          this.soundManager.playBeep(880, 0.2);
          // Add visual feedback
          this.particleSystem.addExplosion(
            this.ball.position.x,
            this.ball.position.y,
            '#10b981', // green-500
            20
          );
          return; // Exit early - don't trigger game over
        } else if (this.shieldCount > 0) {
          // Use shield instead of game over
          this.shieldCount--;
          this.soundManager.playBeep(880, 0.2);
          // Add visual feedback for shield use
          this.particleSystem.addExplosion(
            this.ball.position.x,
            this.ball.position.y,
            '#3b82f6', // blue-500
            20
          );
          return; // Exit early - don't trigger game over
        } else {
          this.gameOver();
          return;
        }
      }
    }
    
    // Update obstacles and check for collisions
    // Use two-phase approach: first update and check collisions, then remove off-screen obstacles
    const obstaclesToRemove: number[] = [];
    
    // Reduced frequency: Only log update info occasionally in debug mode (every 60 frames ~1 second at 60fps)
    if (this.DEBUG_MODE && this.frameCount % 60 === 0) {
      console.log(`[DEBUG] Update: ${this.obstacles.length} obstacles, ball at (${this.ball.position.x.toFixed(1)}, ${this.ball.position.y.toFixed(1)})`);
    }
    
    for (let i = 0; i < this.obstacles.length; i++) {
      const obstacle = this.obstacles[i];
      
      // Skip if obstacle is null or undefined (safety check)
      if (!obstacle) {
        if (this.DEBUG_MODE) {
          console.warn(`[DEBUG] Found null/undefined obstacle at index ${i}`);
        }
        obstaclesToRemove.push(i);
        continue;
      }
      
      // Early exit: Skip obstacles that are far off-screen to the left (optimization)
      // Only update position if obstacle might be visible or recently passed
      const oldX = obstacle.position.x;
      const isFarOffScreen = obstacle.position.x + obstacle.width < -100; // 100px buffer
      
      if (!isFarOffScreen) {
        // Update obstacle position only if it might be visible
        obstacle.position.x -= scrollSpeed * deltaTime;
      } else {
        // Skip position update for far off-screen obstacles
        obstacle.position.x -= scrollSpeed * deltaTime;
      }
      
      // Check if obstacle is on-screen before collision detection
      const isOnScreen = obstacle.position.x + obstacle.width >= 0 && obstacle.position.x <= this.canvas.width;
      
      if (this.DEBUG_MODE && !isOnScreen && oldX >= 0) {
        console.log(`[DEBUG] Obstacle ${i} went off-screen at x=${obstacle.position.x.toFixed(1)}`);
      }
      
      // Only check collision if obstacle is on-screen (early exit optimization)
      if (isOnScreen) {
        // Skip collision check during grace period after continue/start
        const timeSinceGameStart = this.gameStartTime > 0 ? currentTime - this.gameStartTime : Infinity;
        const GRACE_PERIOD_MS = 5000; // 5 seconds immunity after continue/start
        const isInGracePeriod = this.status === 'starting' || (this.status === 'playing' && timeSinceGameStart < GRACE_PERIOD_MS);
        
        // Additional safety: Only check collisions if ball has moved at least 100px horizontally
        const ballHorizontalMovement = Math.abs(this.ball.position.x - this.ballStartX);
        const hasMovedHorizontally = ballHorizontalMovement >= 100;
        
        // Skip collision if in grace period and ball hasn't moved enough
        if (!isInGracePeriod || hasMovedHorizontally) {
          // Check for collision
          if (checkCollision(this.ball, obstacle)) {
            console.log('[GAME_DEBUG] ===== VERTICAL OBSTACLE COLLISION DETECTED =====');
            console.log(`[GAME_DEBUG] Obstacle index: ${i}`);
            console.log(`[GAME_DEBUG] Obstacle position:`, { x: obstacle.position.x.toFixed(2), y: obstacle.position.y.toFixed(2) });
            console.log(`[GAME_DEBUG] Obstacle dimensions:`, { width: obstacle.width, height: obstacle.height });
            console.log(`[GAME_DEBUG] Gap Y:`, obstacle.gapY?.toFixed(2));
            console.log(`[GAME_DEBUG] Gap height:`, obstacle.gapHeight?.toFixed(2));
            console.log(`[GAME_DEBUG] Ball position (world):`, { x: this.ball.position.x.toFixed(2), y: this.ball.position.y.toFixed(2) });
            console.log(`[GAME_DEBUG] Ball radius:`, this.ball.radius);
            console.log(`[GAME_DEBUG] In grace period:`, isInGracePeriod);
            console.log(`[GAME_DEBUG] Time since game start:`, timeSinceGameStart > 0 ? `${timeSinceGameStart.toFixed(2)}ms` : 'N/A');
            console.log(`[GAME_DEBUG] ===================================================`);
            
            // Add particle effect at collision point - use debris and spark particles
            const collisionX = Math.max(obstacle.position.x, Math.min(obstacle.position.x + obstacle.width, this.ball.position.x));
            const collisionY = this.ball.position.y;
            const obstacleColor = obstacle.wallColor || getTheme(this.currentTheme).obstacleColor;
            this.particleSystem.addExplosion(
              collisionX,
              collisionY,
              obstacleColor,
              12,
              'debris'
            );
            // Add spark particles for impact
            this.particleSystem.addExplosion(
              collisionX,
              collisionY,
              obstacleColor,
              8,
              'spark'
            );
            
            if (this.extraTime > 0) {
              // Use extra time instead of game over
              this.extraTime = 0;
              // Play a sound effect for collision (even with extra time)
              this.soundManager.playHit();
              // Add visual feedback for extra time use - use glow particles
              this.particleSystem.addBurst(
                collisionX,
                collisionY,
                '#10b981', // green-500
                15
              );
              return; // Exit early - don't trigger game over
            } else if (this.shieldCount > 0) {
              // Use shield instead of game over
              this.shieldCount--;
              this.soundManager.playHit();
              // Add visual feedback for shield use - use energy particles
              this.particleSystem.addExplosion(
                collisionX,
                collisionY,
                '#3b82f6', // blue-500
                15,
                'energy'
              );
              return; // Exit early - don't trigger game over
            } else {
              // Play hit sound before game over
              this.soundManager.playHit();
              this.gameOver();
              return;
            }
          }
        }
      }
      
      // Check if player passed the obstacle through the gap
      // Score when ball passes the obstacle AND verified it went through the gap
      if (obstacle.position.x + obstacle.width < this.ball.position.x - this.ball.radius && !obstacle['passed']) {
        // Verify ball passed through the gap (for vertical obstacles)
        let passedThroughGap = true;
        
        if (obstacle.orientation === 'vertical' || !obstacle.orientation) {
          // For vertical obstacles, check if ball's Y position was within the gap when passing
          // Use both current and previous positions to catch cases where ball passed through
          if (obstacle.gapY !== undefined && obstacle.gapHeight !== undefined) {
            const gapTop = obstacle.position.y + obstacle.gapY - obstacle.gapHeight / 2;
            const gapBottom = obstacle.position.y + obstacle.gapY + obstacle.gapHeight / 2;
            const ballY = this.ball.position.y;
            const previousBallY = this.previousBallPosition.y;
            const ballRadius = this.ball.radius;
            
            // Check if ball's Y position (with radius) overlaps with gap
            // Check both current and previous positions to ensure we catch the pass
            const ballTop = ballY - ballRadius;
            const ballBottom = ballY + ballRadius;
            const previousBallTop = previousBallY - ballRadius;
            const previousBallBottom = previousBallY + ballRadius;
            
            // Ball passed through gap if any part of it (current or previous) was in the gap
            const currentInGap = (ballBottom >= gapTop && ballTop <= gapBottom);
            const previousInGap = (previousBallBottom >= gapTop && previousBallTop <= gapBottom);
            
            // Also check if ball crossed through the gap (entered from one side, exited from other)
            const crossedGap = (previousBallTop < gapTop && ballBottom > gapTop) || 
                             (previousBallBottom > gapBottom && ballTop < gapBottom) ||
                             (previousBallTop > gapBottom && ballBottom < gapTop) ||
                             (previousBallBottom < gapTop && ballTop > gapBottom);
            
            passedThroughGap = currentInGap || previousInGap || crossedGap;
          }
        }
        
        // Only score if ball passed through the gap (or if gap check isn't applicable)
        if (passedThroughGap) {
          obstacle['passed'] = true;
          
          // Calculate style and combo bonuses
          const currentTime = performance.now();
          const comboMultiplier = this.comboTracker.getTotalMultiplier();
          
          // Check if perfect gap pass (ball center within 30% of gap center)
          const gapCenterY = obstacle.position.y + obstacle.gapY;
          const gapTop = gapCenterY - obstacle.gapHeight / 2;
          const gapBottom = gapCenterY + obstacle.gapHeight / 2;
          const ballCenterY = this.ball.position.y;
          const gapCenterDistance = Math.abs(ballCenterY - gapCenterY);
          const gapRange = obstacle.gapHeight / 2;
          const isPerfectGap = gapCenterDistance < gapRange * 0.3;
          
          // Check for close call (within 20px of obstacle edge)
          const distanceToTop = Math.abs(ballCenterY - gapTop);
          const distanceToBottom = Math.abs(ballCenterY - gapBottom);
          const isCloseCall = distanceToTop < 20 || distanceToBottom < 20;
          
          if (isPerfectGap) {
            const comboMult = this.comboTracker.addGapCombo(currentTime);
            this.styleMeter.addPerfectGap(comboMult);
            this.addStyleNotification('PERFECT!', '#eab308');
            this.perfectRunObstacleCount++;
          } else if (isCloseCall) {
            const comboMult = this.comboTracker.addCloseCallCombo(currentTime);
            this.styleMeter.addCloseCall(comboMult);
            this.addStyleNotification('CLOSE CALL!', '#ef4444');
            this.perfectRunObstacleCount++;
          } else {
            this.styleMeter.addNoHitStreak();
            this.perfectRunObstacleCount++;
          }
          
          // Apply style multiplier to score
          const styleMultiplier = this.styleMeter.getMultiplier();
          const finalScoreMultiplier = this.scoreMultiplier * styleMultiplier * comboMultiplier;
          
          this.score += Math.floor(2 * finalScoreMultiplier);
          if (this.onScoreUpdate) this.onScoreUpdate(this.score);
          
          // Play coin sound when passing through a gap
          this.soundManager.playCoin();
          
          // Add particle effect when passing through a gap (intensity based on style)
          const particleCount = 3 + Math.floor(styleMultiplier);
          this.particleSystem.addExplosion(
            this.ball.position.x, 
            this.ball.position.y, 
            obstacle.wallColor || getTheme(this.currentTheme).obstacleColor, 
            particleCount
          );
          
          if (this.DEBUG_MODE) {
            console.log('[GAME_DEBUG] ===== VERTICAL GAP SCORED =====');
            console.log(`[GAME_DEBUG] Obstacle index: ${i}`);
            console.log(`[GAME_DEBUG] Gap Y: top=${(obstacle.position.y + obstacle.gapY - obstacle.gapHeight / 2).toFixed(2)}, bottom=${(obstacle.position.y + obstacle.gapY + obstacle.gapHeight / 2).toFixed(2)}`);
            console.log(`[GAME_DEBUG] Ball Y: ${this.ball.position.y.toFixed(2)}, Previous: ${this.previousBallPosition.y.toFixed(2)}`);
            console.log(`[GAME_DEBUG] Score: ${this.score}`);
            console.log(`[GAME_DEBUG] ====================================`);
          }
        }
      }
      
      // Mark obstacles that are fully off-screen for removal (with buffer to prevent flickering)
      if (obstacle.position.x + obstacle.width < -50) {
        obstaclesToRemove.push(i);
      }
    }
    
    // Remove obstacles efficiently using reverse iteration (already optimized)
    if (obstaclesToRemove.length > 0) {
      if (this.DEBUG_MODE) {
        console.log(`[DEBUG] Removing ${obstaclesToRemove.length} obstacles: [${obstaclesToRemove.join(', ')}]`);
      }
      // Sort indices in descending order for safe batch removal
      obstaclesToRemove.sort((a, b) => b - a);
      for (const index of obstaclesToRemove) {
        this.obstacles.splice(index, 1);
      }
      if (this.DEBUG_MODE) {
        console.log(`[DEBUG] After removal: ${this.obstacles.length} obstacles remaining`);
      }
    }
    
    // Update procedural horizontal walls and check collisions
    // Horizontal walls scroll left with the game (X position decreases)
    const wallsToRemove: number[] = [];
    
    // Maximum visible walls limit - hard cap to prevent accumulation
    const MAX_VISIBLE_WALLS = 4;
    
    // Minimum wall count to maintain - don't remove if it would drop below this
    // Reduced from 3 to 1 to dramatically reduce density
    const MIN_WALL_COUNT = 1;
    const REMOVAL_BUFFER = 100; // Increased buffer before removal (was 50)
    
    // Count walls ahead of ball before removal using single-pass iteration (optimization)
    let wallsAheadOfBall = 0;
    let visibleWallCount = 0;
    for (const w of this.horizontalWalls) {
      if (!w || !w.position) continue;
      if (w.position.x > this.ball.position.x) {
        wallsAheadOfBall++;
      }
      const wallRight = w.position.x + w.width;
      if (wallRight >= -REMOVAL_BUFFER && w.position.x <= this.canvas.width + REMOVAL_BUFFER) {
        visibleWallCount++;
      }
    }
    
    if (this.DEBUG_MODE && this.horizontalWalls.length > 0 && visibleWallCount === 0) {
      console.warn(`[Game] No visible horizontal walls! Total: ${this.horizontalWalls.length}, Ahead: ${wallsAheadOfBall}, Ball X: ${this.ball.position.x.toFixed(1)}`);
      this.horizontalWalls.forEach((w, idx) => {
        if (w) {
          console.log(`  Wall ${idx}: X=${w.position.x.toFixed(1)}, width=${w.width}, right=${(w.position.x + w.width).toFixed(1)}`);
        }
      });
    }
    
    // Update wall positions and remove off-screen walls
    for (let i = 0; i < this.horizontalWalls.length; i++) {
      const wall = this.horizontalWalls[i];
      
      if (!wall) {
        wallsToRemove.push(i);
        continue;
      }
      
      // Update wall position (scroll left)
      wall.position.x -= scrollSpeed * deltaTime;
      
      // Update gap X position if it exists
      if (wall.gapX !== undefined) {
        wall.gapX -= scrollSpeed * deltaTime;
      }
      
      // Remove walls that are fully off-screen, but only if we have enough walls ahead
      // Check if wall is completely off-screen with buffer
      if (wall.position.x + wall.width < -REMOVAL_BUFFER) {
        // Remove walls immediately when off-screen, only defer if we have less than 1 wall ahead
        // This prevents accumulation while ensuring we always have at least 1 wall ahead
        if (wallsAheadOfBall >= MIN_WALL_COUNT) {
          wallsToRemove.push(i);
          if (this.DEBUG_MODE) {
            console.log(`[Game] Marking wall ${i} for removal: X=${wall.position.x.toFixed(1)}, wallsAhead=${wallsAheadOfBall}, total=${this.horizontalWalls.length}`);
          }
        } else {
          if (this.DEBUG_MODE) {
            console.log(`[Game] Deferring wall removal - low wall count. Ahead: ${wallsAheadOfBall}, Total: ${this.horizontalWalls.length}`);
          }
        }
      }
    }
    
    // Remove off-screen walls in reverse order
    // Enforce maximum visible walls limit - remove oldest walls if over limit
    if (this.horizontalWalls.length > MAX_VISIBLE_WALLS) {
      // Sort walls by X position (oldest/leftmost first)
      const sortedWalls = this.horizontalWalls
        .map((wall, index) => ({ wall, index, x: wall.position.x }))
        .sort((a, b) => a.x - b.x);
      
      // Remove oldest walls until under limit
      const excessCount = this.horizontalWalls.length - MAX_VISIBLE_WALLS;
      for (let i = 0; i < excessCount; i++) {
        const wallToRemove = sortedWalls[i];
        // Only remove if it's behind the ball or off-screen
        if (wallToRemove.x + wallToRemove.wall.width < this.ball.position.x || 
            wallToRemove.x + wallToRemove.wall.width < -REMOVAL_BUFFER) {
          if (!wallsToRemove.includes(wallToRemove.index)) {
            wallsToRemove.push(wallToRemove.index);
          }
        }
      }
      
      if (this.DEBUG_MODE && excessCount > 0) {
        console.warn(`[Game] Wall count exceeded MAX_VISIBLE_WALLS (${MAX_VISIBLE_WALLS}). Removing ${excessCount} excess walls. Total: ${this.horizontalWalls.length}`);
      }
    }
    
    const removedCount = wallsToRemove.length;
    // Sort removal indices in descending order to avoid index shifting issues
    wallsToRemove.sort((a, b) => b - a);
    for (let i = 0; i < wallsToRemove.length; i++) {
      this.horizontalWalls.splice(wallsToRemove[i], 1);
    }
    
    if (this.DEBUG_MODE && removedCount > 0) {
      // Count walls ahead for debug log using single-pass iteration (optimization)
      let debugWallsAhead = 0;
      for (const w of this.horizontalWalls) {
        if (w && w.position && w.position.x > this.ball.position.x) {
          debugWallsAhead++;
        }
      }
      console.log(`[Game] Removed ${removedCount} horizontal walls. Remaining: ${this.horizontalWalls.length}, Ahead of ball: ${debugWallsAhead}`);
    }
    
    // Debug logging for wall counts
    if (this.DEBUG_MODE && this.horizontalWalls.length > MAX_VISIBLE_WALLS) {
      console.warn(`[Game] WARNING: Wall count (${this.horizontalWalls.length}) still exceeds MAX_VISIBLE_WALLS (${MAX_VISIBLE_WALLS}) after removal`);
    }
    
    // Don't update lastHorizontalWallX here - it should only be updated when we generate new walls
    // Updating it based on scrolling walls causes generation to stop
    // lastHorizontalWallX represents where we last generated walls, not where walls currently are
    
    // Check collisions with procedural horizontal walls
    // Only check collisions with walls that are on-screen or near the screen
    for (let i = 0; i < this.horizontalWalls.length; i++) {
      const wall = this.horizontalWalls[i];
      
      if (!wall) continue;
      
      // Skip collision check if wall is completely off-screen (with buffer for safety)
      // Wall is off-screen if it's completely to the left of the visible area
      const WALL_BUFFER = 150; // Increased buffer to account for ball radius and edge cases
      const wallLeft = wall.position.x;
      const wallRight = wall.position.x + wall.width;
      const wallTop = wall.position.y;
      const wallBottom = wall.position.y + wall.height;
      
      // Check if wall is completely off-screen to the left
      if (wallRight < -WALL_BUFFER) {
        // Wall is completely off-screen to the left, skip collision check
        continue;
      }
      
      // Check if wall is completely to the right (hasn't appeared yet)
      if (wallLeft > this.canvas.width + WALL_BUFFER) {
        // Wall hasn't appeared yet, skip collision check
        continue;
      }
      
      // Check if wall is completely above or below the visible area (with camera offset)
      const screenWallTop = wallTop - this.cameraOffsetY;
      const screenWallBottom = wallBottom - this.cameraOffsetY;
      if (screenWallBottom < -WALL_BUFFER || screenWallTop > this.canvas.height + WALL_BUFFER) {
        // Wall is completely off-screen vertically, skip collision check
        continue;
      }
      
      // Only check collisions if wall is actually visible on screen
      // Wall is visible if any part of it overlaps with the screen bounds
      const isWallVisible = !(wallRight < 0 || wallLeft > this.canvas.width || 
                             screenWallBottom < 0 || screenWallTop > this.canvas.height);
      
      if (!isWallVisible) {
        // Wall is not visible, skip collision check
        continue;
      }
      
      // Check if ball is in a gap (if gap exists)
      // Account for ball radius when checking gap boundaries
      let isInGap = false;
      
      if (wall.gapX !== undefined && wall.gapWidth !== undefined && wall.gapWidth > 0) {
        const gapLeft = wall.gapX - wall.gapWidth / 2;
        const gapRight = wall.gapX + wall.gapWidth / 2;
        const ballRadius = this.ball.radius;
        const ballLeft = this.ball.position.x - ballRadius;
        const ballRight = this.ball.position.x + ballRadius;
        const ballTop = this.ball.position.y - ballRadius;
        const ballBottom = this.ball.position.y + ballRadius;
        
        // Improved gap detection: use ball center for more accurate detection
        const ballCenterX = this.ball.position.x;
        
        // Check if ball center is within gap horizontally (with padding for forgiveness)
        const GAP_HORIZONTAL_PADDING = 10; // Padding for more forgiving gap detection
        const isInGapX = ballCenterX >= (gapLeft - GAP_HORIZONTAL_PADDING) && 
                        ballCenterX <= (gapRight + GAP_HORIZONTAL_PADDING);
        
        // Check if ball overlaps with the wall's Y position (overlapping vertically)
        // Use more lenient check - ball is in gap if any part overlaps with wall vertically
        const GAP_VERTICAL_PADDING = 5; // Small padding for vertical tolerance
        const isInGapY = (ballBottom + GAP_VERTICAL_PADDING > wallTop) && 
                        (ballTop - GAP_VERTICAL_PADDING < wallBottom);
        
        // Also check if ball overlaps gap using edge-based detection (backup)
        const ballOverlapsGapX = !(ballRight < gapLeft || ballLeft > gapRight);
        const ballOverlapsGapY = ballBottom > wallTop && ballTop < wallBottom;
        
        // Ball is in gap if center-based OR edge-based detection says so
        isInGap = (isInGapX && isInGapY) || (ballOverlapsGapX && ballOverlapsGapY);
        
        // Check if ball has passed through the gap (for scoring)
        // Use previous position to detect when ball crosses the gap boundary
        const previousBallX = this.previousBallPosition.x;
        const currentBallX = this.ball.position.x;
        const previousBallY = this.previousBallPosition.y;
        const currentBallY = this.ball.position.y;
        
        // Ball has passed through gap if:
        // 1. Previous position was before/at gap right edge AND current position is past gap right edge
        // 2. Ball was in the wall's Y range when crossing (check both previous and current positions)
        const wasBeforeGap = previousBallX <= gapRight;
        const isPastGap = currentBallX > gapRight;
        const hasPassedGapX = wasBeforeGap && isPastGap;
        
        // Check if ball was in wall's Y range when crossing the gap
        // Use more lenient check - ball was in range if either previous or current position overlaps with wall
        const tolerance = ballRadius * 2; // More generous tolerance
        const previousWasInWallY = (previousBallY + ballRadius + tolerance >= wallTop) && 
                                   (previousBallY - ballRadius - tolerance <= wallBottom);
        const currentIsInWallY = (currentBallY + ballRadius + tolerance >= wallTop) && 
                                 (currentBallY - ballRadius - tolerance <= wallBottom);
        const ballWasInWallY = previousWasInWallY || currentIsInWallY;
        
        // Also check if ball passed through the gap (not just past it)
        // Ball passed through if it was between gapLeft and gapRight at some point
        const passedThroughGap = (previousBallX >= gapLeft && previousBallX <= gapRight) ||
                                 (currentBallX >= gapLeft && currentBallX <= gapRight) ||
                                 (previousBallX < gapLeft && currentBallX > gapRight);
        
        // Score if ball passed through the gap AND was in the wall's Y range
        if (hasPassedGapX && ballWasInWallY && passedThroughGap && !wall.passed) {
          wall.passed = true;
          
          // Calculate style and combo bonuses
          const currentTime = performance.now();
          const comboMultiplier = this.comboTracker.getTotalMultiplier();
          
          // Check if perfect gap pass (ball center within 30% of gap center)
          const gapCenterX = wall.gapX!;
          const gapLeft = gapCenterX - wall.gapWidth! / 2;
          const gapRight = gapCenterX + wall.gapWidth! / 2;
          const ballCenterX = this.ball.position.x;
          const gapCenterDistance = Math.abs(ballCenterX - gapCenterX);
          const gapRange = wall.gapWidth! / 2;
          const isPerfectGap = gapCenterDistance < gapRange * 0.3;
          
          // Check for close call
          const distanceToLeft = Math.abs(ballCenterX - gapLeft);
          const distanceToRight = Math.abs(ballCenterX - gapRight);
          const isCloseCall = distanceToLeft < 20 || distanceToRight < 20;
          
          if (isPerfectGap) {
            const comboMult = this.comboTracker.addGapCombo(currentTime);
            this.styleMeter.addPerfectGap(comboMult);
            this.addStyleNotification('PERFECT!', '#eab308');
            this.perfectRunObstacleCount++;
          } else if (isCloseCall) {
            const comboMult = this.comboTracker.addCloseCallCombo(currentTime);
            this.styleMeter.addCloseCall(comboMult);
            this.addStyleNotification('CLOSE CALL!', '#ef4444');
            this.perfectRunObstacleCount++;
          } else {
            this.styleMeter.addNoHitStreak();
            this.perfectRunObstacleCount++;
          }
          
          // Apply style multiplier to score
          const styleMultiplier = this.styleMeter.getMultiplier();
          const finalScoreMultiplier = this.scoreMultiplier * styleMultiplier * comboMultiplier;
          
          this.score += Math.floor(2 * finalScoreMultiplier);
          if (this.onScoreUpdate) this.onScoreUpdate(this.score);
          
          // Play coin sound when passing through gap
          this.soundManager.playCoin();
          
          // Add particle effect when passing through gap
          const particleCount = 3 + Math.floor(styleMultiplier);
          this.particleSystem.addExplosion(
            this.ball.position.x, 
            this.ball.position.y, 
            wall.wallColor || getTheme(this.currentTheme).obstacleColor, 
            particleCount
          );
          
          if (this.DEBUG_MODE) {
            console.log('[GAME_DEBUG] ===== HORIZONTAL GAP SCORED =====');
            console.log(`[GAME_DEBUG] Wall index: ${i}`);
            console.log(`[GAME_DEBUG] Gap: left=${gapLeft.toFixed(2)}, right=${gapRight.toFixed(2)}`);
            console.log(`[GAME_DEBUG] Previous ball X: ${previousBallX.toFixed(2)}, Current ball X: ${currentBallX.toFixed(2)}`);
            console.log(`[GAME_DEBUG] Previous ball Y: ${previousBallY.toFixed(2)}, Current ball Y: ${currentBallY.toFixed(2)}`);
            console.log(`[GAME_DEBUG] Wall Y: top=${wallTop.toFixed(2)}, bottom=${wallBottom.toFixed(2)}`);
            console.log(`[GAME_DEBUG] Has passed gap X: ${hasPassedGapX}, Was in wall Y: ${ballWasInWallY}, Passed through: ${passedThroughGap}`);
            console.log(`[GAME_DEBUG] Score: ${this.score}`);
            console.log(`[GAME_DEBUG] ====================================`);
          }
        }
        
        // Handle gap-specific effects (only if ball is currently in the gap)
        if (isInGap && wall.gapType) {
          // Handle level transition
          if (wall.gapType === 'level-transition' && !wall.passed) {
            wall.passed = true;
            this.handleLevelTransition();
          }
          
          // Handle shortcut gap (bonus score) - give bonus when entering shortcut gap
          if (wall.gapType === 'shortcut' && !wall.passed) {
            wall.passed = true;
            // Bonus score for taking shortcut (in addition to the normal score from passing)
            this.score += 2 * this.scoreMultiplier;
            if (this.onScoreUpdate) this.onScoreUpdate(this.score);
            this.soundManager.playCoin();
          }
        }
      } else {
        // Wall has no gap - this shouldn't normally happen, but handle it for safety
        // Score when passing the entire wall (fallback case)
        if (wallRight < this.ball.position.x - this.ball.radius && !wall.passed) {
          wall.passed = true;
          this.score++;
          if (this.onScoreUpdate) this.onScoreUpdate(this.score);
          this.soundManager.playCoin();
          this.particleSystem.addExplosion(
            this.ball.position.x, 
            this.ball.position.y, 
            wall.wallColor || getTheme(this.currentTheme).obstacleColor, 
            3
          );
        }
      }
      
      // Only check collision if ball is NOT in a gap
      // Game over should only happen from actual wall collisions
      // Skip collision check if we're in the starting phase or just started (grace period after continue)
      const timeSinceGameStart = this.gameStartTime > 0 ? currentTime - this.gameStartTime : Infinity;
      const GRACE_PERIOD_MS = 5000; // 5 seconds immunity after continue/start
      const isInStartGracePeriod = this.status === 'starting' || (this.status === 'playing' && timeSinceGameStart < GRACE_PERIOD_MS);
      
      // Additional safety: Only check collisions if ball has moved at least 100px horizontally
      const ballHorizontalMovement = Math.abs(this.ball.position.x - this.ballStartX);
      const hasMovedHorizontally = ballHorizontalMovement >= 100;
      
      // Additional safety: Skip collision if ball is in safe middle zone (30% to 70% of canvas height) during grace period
      const safeZoneTop = this.canvas.height * 0.3;
      const safeZoneBottom = this.canvas.height * 0.7;
      const isInSafeMiddleZone = this.ball.position.y >= safeZoneTop && this.ball.position.y <= safeZoneBottom;
      const isInSafeZoneDuringGrace = isInStartGracePeriod && isInSafeMiddleZone;
      
      // Skip collision check if:
      // 1. Ball is in a gap (most important - if in gap, no collision), OR
      // 2. Still in grace period AND ball hasn't moved enough OR is in safe zone, OR
      // 3. Ball hasn't moved horizontally enough (but only skip if also in grace period)
      // Note: We should ALWAYS check collision if ball is NOT in gap and grace period is over
      const shouldSkipCollision = isInGap || 
                                  (isInStartGracePeriod && (!hasMovedHorizontally || isInSafeZoneDuringGrace));
      
      // Check collision with all horizontal walls (not just edge walls - walls can be at any Y position)
      // Only skip if ball is definitely in gap or in grace period with safety conditions
      if (!shouldSkipCollision) {
        const collisionDetected = checkCollision(this.ball, wall);
        if (collisionDetected) {
          console.log('[GAME_DEBUG] ===== HORIZONTAL WALL COLLISION DETECTED =====');
        console.log(`[GAME_DEBUG] Wall index: ${i}`);
        console.log(`[GAME_DEBUG] Wall position (world):`, { x: wall.position.x.toFixed(2), y: wall.position.y.toFixed(2) });
        console.log(`[GAME_DEBUG] Wall dimensions:`, { width: wall.width, height: wall.height });
        console.log(`[GAME_DEBUG] Wall gap type:`, wall.gapType);
        console.log(`[GAME_DEBUG] Wall gap X:`, wall.gapX?.toFixed(2));
        console.log(`[GAME_DEBUG] Wall gap width:`, wall.gapWidth?.toFixed(2));
        console.log(`[GAME_DEBUG] Ball in gap:`, isInGap);
        console.log(`[GAME_DEBUG] In grace period:`, isInStartGracePeriod);
        console.log(`[GAME_DEBUG] Time since game start:`, timeSinceGameStart > 0 ? `${timeSinceGameStart.toFixed(2)}ms` : 'N/A');
        console.log(`[GAME_DEBUG] Ball horizontal movement:`, ballHorizontalMovement.toFixed(2));
        console.log(`[GAME_DEBUG] Has moved horizontally:`, hasMovedHorizontally);
        console.log(`[GAME_DEBUG] Is in safe middle zone:`, isInSafeMiddleZone);
        console.log(`[GAME_DEBUG] Should skip collision:`, shouldSkipCollision);
        console.log(`[GAME_DEBUG] Ball position (world):`, { x: this.ball.position.x.toFixed(2), y: this.ball.position.y.toFixed(2) });
        console.log(`[GAME_DEBUG] Ball screen Y:`, (this.ball.position.y - this.cameraOffsetY).toFixed(2));
        console.log(`[GAME_DEBUG] Camera offset Y:`, this.cameraOffsetY.toFixed(2));
        console.log(`[GAME_DEBUG] ===============================================`);
        
        // Regular collision (not in gap) - this is a real wall hit
        const obstacleColor = wall.wallColor || getTheme(this.currentTheme).obstacleColor;
        this.particleSystem.addExplosion(
          this.ball.position.x,
          this.ball.position.y,
          obstacleColor,
          15
        );
        
        // Break combo and apply style penalty
        this.comboTracker.breakCombo();
        this.styleMeter.onCollision();
        this.perfectRunObstacleCount = 0;
        
        // Check for extra time or shield before game over
        if (this.extraTime > 0) {
          // Use extra time instead of game over
          this.extraTime = 0;
          // Play a sound effect for collision (even with extra time)
          this.soundManager.playHit();
          // Add visual feedback for extra time use
          this.particleSystem.addExplosion(
            this.ball.position.x,
            this.ball.position.y,
            '#10b981', // green-500
            20
          );
          return; // Exit early - don't trigger game over
        } else if (this.shieldCount > 0) {
          // Use shield instead of game over
          this.shieldCount--;
          this.soundManager.playHit();
          // Add visual feedback for shield use
          this.particleSystem.addExplosion(
            this.ball.position.x,
            this.ball.position.y,
            '#3b82f6', // blue-500
            20
          );
          return; // Exit early - don't trigger game over
        } else {
          // No extra time or shield - game over
          this.soundManager.playHit();
          this.gameOver();
          return;
        }
      }
      }
    }
    
    // Optimize obstacle generation - only generate when needed
    try {
      // Get spacing from config based on difficulty
      const config = getConfigForDifficulty(this.difficulty);
      this.obstacleSpacing = config.walls.spacing;
      
      // Only generate obstacles when needed (not every frame)
      const generationCheckTime = performance.now();
      // Increased from 50ms to 200ms to generate less frequently and prevent accumulation
      const shouldCheckGeneration = generationCheckTime - this.lastGenerationCheck > 200;
      
      // Minimum wall count threshold - ensure we always have walls ahead
      // Reduced from 3 to 1 to dramatically reduce density
      const MIN_WALL_COUNT = 1;
      const wallsAheadOfBall = this.horizontalWalls.filter(w => w && w.position.x > this.ball.position.x).length;
      const needsMoreWalls = this.horizontalWalls.length < MIN_WALL_COUNT || wallsAheadOfBall < MIN_WALL_COUNT;
      
      // Critical: Always generate if no walls exist (initial generation)
      const hasNoWalls = this.horizontalWalls.length === 0;
      
      // Check if chunks are exhausted - if so, ensure procedural generation happens
      const chunksExhausted = this.levelChunks.length === 0 || this.consumedChunkCount >= this.levelChunks.length;
      
      // Check if remaining chunks don't have horizontal walls data
      // If chunks exist but don't have horizontal walls, we need continuous procedural generation
      const hasChunksWithoutWalls = this.levelChunks.length > 0 && 
        this.consumedChunkCount < this.levelChunks.length &&
        this.levelChunks.slice(this.consumedChunkCount).some(chunk => 
          !chunk.horizontalWalls || chunk.horizontalWalls.length === 0
        );
      
      // Generate procedural horizontal walls as needed
      // Check more frequently if we're running low on walls or have no walls
      // Also check when chunks are exhausted OR when chunks don't have horizontal walls data
      // to ensure continuous wall generation
      if (hasNoWalls || shouldCheckGeneration || this.needsObstacleGeneration || needsMoreWalls || chunksExhausted || hasChunksWithoutWalls) {
        try {
          if (this.DEBUG_MODE) {
            if (hasNoWalls) {
              console.log(`[Game] No walls exist - forcing initial generation. ballX: ${this.ball.position.x.toFixed(1)}`);
            } else if (needsMoreWalls) {
              console.log(`[Game] Low wall count detected - forcing generation. Total: ${this.horizontalWalls.length}, Ahead: ${wallsAheadOfBall}`);
            } else if (chunksExhausted) {
              console.log(`[Game] Chunks exhausted (consumed: ${this.consumedChunkCount}/${this.levelChunks.length}) - ensuring procedural wall generation`);
            } else if (hasChunksWithoutWalls) {
              console.log(`[Game] Chunks without horizontal walls detected (consumed: ${this.consumedChunkCount}/${this.levelChunks.length}) - ensuring continuous procedural generation`);
            }
          }
          this.generateProceduralHorizontalWalls();
          
          // Validate that walls were generated
          if (hasNoWalls && this.horizontalWalls.length === 0 && this.DEBUG_MODE) {
            console.error('[Game] Failed to generate initial walls - this should not happen');
          }
        } catch (error) {
          console.error('[Game] Error generating procedural horizontal walls:', error);
          // Continue - walls will regenerate next frame
        }
      }
      
      if (shouldCheckGeneration || this.needsObstacleGeneration) {
        this.lastGenerationCheck = generationCheckTime;
        
        // Check if we need more obstacles
        const rightmostX = this.obstacles.length > 0 
          ? Math.max(...this.obstacles.map(o => o.position.x + o.width))
          : this.canvas.width;
        
        // Only generate if rightmost obstacle is less than 2x canvas width ahead
        // This prevents regeneration of obstacles that are already far enough ahead
        const minDistanceAhead = this.canvas.width * 2;
        const targetDistance = this.ball.position.x + minDistanceAhead;
        const targetObstacleCount = 8;
        
        // Generate only if:
        // 1. Obstacle count is below target AND rightmost is too close, OR
        // 2. Rightmost obstacle is less than 2x canvas width ahead
        // But NOT if obstacles are already far enough ahead
        if ((this.obstacles.length < targetObstacleCount && rightmostX < targetDistance) || 
            (rightmostX < targetDistance)) {
          if (this.DEBUG_MODE) {
            console.log(`[DEBUG] Generating obstacles: count=${this.obstacles.length}, rightmostX=${rightmostX.toFixed(1)}, ballX=${this.ball.position.x.toFixed(1)}, targetDistance=${targetDistance.toFixed(1)}`);
          }
          try {
            this.generateObstaclesFromChunks();
            this.needsObstacleGeneration = false;
            if (this.DEBUG_MODE) {
              console.log(`[DEBUG] After generation: ${this.obstacles.length} obstacles`);
            }
          } catch {
            console.error('[Game] Error generating obstacles from chunks');
            // Continue - obstacles will regenerate next frame
            this.needsObstacleGeneration = false; // Prevent infinite retry
          }
        }
      }
    } catch (error) {
      console.error('[Game] Critical error in obstacle generation section:', error);
      // Don't re-throw - let update() continue
    }
  }
  
  private render(): void {
    try {
      // Update renderer with camera offset for gap traversal
      try {
        this.renderer.setCameraOffsetY(this.cameraOffsetY);
      } catch {
        console.error('[Game] Error setting camera offset');
      }
      
      // Clear canvas BEFORE applying any transforms
      // This ensures clearRect operates in untransformed canvas space
      try {
        this.renderer.clear();
      } catch {
        console.error('[Game] Error clearing canvas');
        // Try to manually clear
        try {
          this.renderer.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        } catch {
          // Ignore if clearRect also fails
        }
      }
      
      // Save context state once at the beginning (after clearing)
      this.renderer.ctx.save();
      
      // Apply screen shake offset first (outermost transform)
      if (this.shakeDuration > 0) {
        try {
          this.renderer.ctx.translate(this.shakeX, this.shakeY);
        } catch {
          console.error('[Game] Error applying screen shake');
        }
      }
      
      // Apply camera offset for vertical following (inner transform)
      try {
        this.renderer.ctx.translate(0, this.cameraOffsetY);
      } catch {
        console.error('[Game] Error applying camera transform');
      }
      
      // Draw particles (with camera offset)
      try {
        this.particleSystem.render(this.renderer.ctx);
      } catch {
        console.error('[Game] Error rendering particles');
        // Continue - particles are non-critical
      }
      
      // Draw obstacles (vertical walls) - these move with camera
      // Add culling optimization: only render obstacles that are visible or near viewport
      try {
        const viewportBuffer = 200; // Buffer to render slightly off-screen obstacles
        const canvasRight = this.canvas.width + viewportBuffer;
        const canvasLeft = -viewportBuffer;
        
        // Single-pass iteration instead of filter() to avoid creating new array
        for (const obstacle of this.obstacles) {
          if (!obstacle) continue;
          // Check if obstacle is within viewport (accounting for camera offset)
          const obstacleRight = obstacle.position.x + obstacle.width;
          const obstacleLeft = obstacle.position.x;
          // Obstacles extend vertically, so only check X position
          if (obstacleRight < canvasLeft || obstacleLeft > canvasRight) continue;
          
          // Obstacle is visible - render it
          try {
            this.renderer.drawObstacle(obstacle);
            
            // Draw power-up attached to obstacle if exists
            if (obstacle.powerUp) {
              this.renderer.drawPowerUp(obstacle.powerUp);
            }
          } catch {
            console.error('[Game] Error rendering obstacle');
            // Continue with next obstacle
          }
        }
      } catch {
        console.error('[Game] Error rendering obstacles array');
      }
      
      // Draw horizontal walls - these move with camera offset (they're at various Y positions)
      // Walls scroll horizontally but follow camera vertically
      try {
        // Frustum culling for horizontal walls - only render visible walls
        const viewportBuffer = 200; // Buffer to render slightly off-screen walls
        const canvasRight = this.canvas.width + viewportBuffer;
        const canvasLeft = -viewportBuffer;
        
        // Debug: Log wall rendering status
        if (this.DEBUG_MODE && this.horizontalWalls.length > 0) {
          let visibleCount = 0;
          for (const w of this.horizontalWalls) {
            if (!w) continue;
            const wallRight = w.position.x + w.width;
            const wallLeft = w.position.x;
            if (wallRight >= canvasLeft && wallLeft <= canvasRight) {
              visibleCount++;
            }
          }
          if (visibleCount === 0 && this.horizontalWalls.length > 0) {
            console.warn(`[Game] No visible horizontal walls to render! Total walls: ${this.horizontalWalls.length}, Ball X: ${this.ball.position.x.toFixed(1)}`);
            this.horizontalWalls.forEach((w, idx) => {
              if (w) {
                console.log(`  Wall ${idx}: x=${w.position.x.toFixed(1)}, width=${w.width.toFixed(1)}, right=${(w.position.x + w.width).toFixed(1)}`);
              }
            });
          }
        }
        
        // Horizontal walls are drawn with camera offset applied (already in transform stack)
        // Frustum culling: only pass visible walls to renderer
        const visibleHorizontalWalls: Obstacle[] = [];
        for (const wall of this.horizontalWalls) {
          if (!wall) continue;
          const wallRight = wall.position.x + wall.width;
          const wallLeft = wall.position.x;
          // Check if wall is within viewport (with buffer for smooth scrolling)
          if (wallRight >= canvasLeft && wallLeft <= canvasRight) {
            visibleHorizontalWalls.push(wall);
          }
        }
        // Pass vertical obstacles so renderer can check if horizontal walls block vertical gaps
        const visibleVerticalObstacles = this.obstacles.filter(obs => {
          if (!obs) return false;
          const obsRight = obs.position.x + obs.width;
          const obsLeft = obs.position.x;
          return obsRight >= canvasLeft && obsLeft <= canvasRight;
        });
        this.renderer.drawHorizontalWalls(visibleHorizontalWalls, visibleVerticalObstacles);
        
        // Draw connections between horizontal walls and vertical obstacles (only for visible walls)
        for (const wall of visibleHorizontalWalls) {
          if (wall && wall.connectedObstacleId !== undefined) {
            const connectedObstacle = this.obstacles[wall.connectedObstacleId];
            if (connectedObstacle) {
              this.renderer.drawWallConnection(connectedObstacle, wall);
            }
          }
        }
      } catch (error) {
        console.error('[Game] Error rendering horizontal walls:', error);
        // Restore context if error occurred
        try {
          this.renderer.ctx.restore();
        } catch {
          // Ignore restore errors
        }
        // Continue - walls are critical but try to render individual walls
        try {
          this.renderer.ctx.save();
          this.renderer.ctx.translate(0, -this.cameraOffsetY);
          this.horizontalWalls.forEach(wall => {
            if (wall) {
              this.renderer.drawObstacle(wall);
            }
          });
          this.renderer.ctx.restore();
        } catch {
          // Ignore fallback errors
        }
      }
      
      // Draw wall interconnections (connect vertical and horizontal walls)
      try {
        this.obstacles.forEach(verticalObstacle => {
          if (!verticalObstacle) return;
          this.horizontalWalls.forEach(horizontalObstacle => {
            if (horizontalObstacle) {
              try {
                this.renderer.drawWallConnection(verticalObstacle, horizontalObstacle);
              } catch {
                // Ignore individual connection errors
              }
            }
          });
        });
      } catch {
        console.error('[Game] Error rendering wall connections');
        // Continue - connections are non-critical
      }
      
      // Draw standalone power-ups
      try {
        this.powerUps.forEach(powerUp => {
          if (!powerUp) return;
          try {
            this.renderer.drawPowerUp(powerUp);
          } catch {
            // Ignore individual power-up errors
          }
        });
      } catch {
        console.error('[Game] Error rendering power-ups');
      }
      
      // Draw ball
      try {
        if (this.ball && this.ball.position) {
          this.renderer.drawBall(this.ball);
        }
      } catch {
        console.error('[Game] Error rendering ball');
        // Critical error but continue
      }
      
      // Restore context state once at the end (restores both camera and shake transforms)
      try {
        this.renderer.ctx.restore();
      } catch {
        console.error('[Game] Error restoring context transform');
      }
    } catch {
      console.error('[Game] Critical error in render() start');
      // Try to restore context to valid state
      try {
        this.renderer.ctx.restore();
      } catch {
        // Ignore restore errors
      }
    }
    
    // Draw UI elements (score, level, status text) - outside of camera transform
    try {
      // Calculate progress to next level (level increases every 10 points)
      const level = this.getLevelNumber();
      const progressToNextLevel = (this.score % 10) / 10;
      
      // Draw score with progress bar
      try {
        this.renderer.drawScore(this.score, level, progressToNextLevel);
      } catch {
        console.error('[Game] Error drawing score');
      }
      
      // Draw style meter and combo counter
      try {
        const styleLevel = this.styleMeter.getLevel();
        const stylePoints = this.styleMeter.getPoints();
        const styleProgress = this.styleMeter.getProgress();
        const styleColor = this.styleMeter.getColor();
        const activeCombo = this.comboTracker.getActiveCombo();
        
        this.renderer.drawStyleMeter(styleLevel, stylePoints, styleProgress, styleColor);
        
        if (activeCombo && activeCombo.isActive) {
          this.renderer.drawComboCounter(activeCombo.count, activeCombo.multiplier);
        }
        
        // Draw style notifications
        for (const notification of this.styleNotifications) {
          this.renderer.drawStyleNotification(notification);
        }
      } catch {
        console.error('[Game] Error drawing style system UI');
      }
      
      // Draw difficulty level (bottom right for Level 1, top right for others)
      try {
        this.renderer.ctx.font = 'bold 16px Arial';
        this.renderer.ctx.fillStyle = this.currentLevel === 1 ? 'rgba(200, 200, 200, 0.6)' : '#8b5cf6'; // Faint grey for Level 1, purple for others
        this.renderer.ctx.textAlign = 'right';
        this.renderer.ctx.textBaseline = 'top';
        const levelY = this.currentLevel === 1 ? this.canvas.height - 20 : 25; // Bottom right for Level 1, top right with padding for others
        this.renderer.ctx.fillText(
          level === 1 ? 'Level 1' : `Level ${level}`,
          this.canvas.width - 20,
          levelY
        );
      } catch {
        console.error('[Game] Error drawing level');
      }
      
      // Draw extra time indicator if active
      if (this.extraTime > 0) {
        try {
          this.renderer.ctx.font = 'bold 16px Arial';
          this.renderer.ctx.fillStyle = '#10b981'; // green-500
          this.renderer.ctx.textAlign = 'right';
          this.renderer.ctx.fillText(
            `Extra Time: ${Math.ceil(this.extraTime)}s`, 
            this.canvas.width - 20, 
            40
          );
        } catch {
          console.error('[Game] Error drawing extra time');
        }
      }
      
      // Draw instructions / overlays
      try {
        if (this.status === 'idle') {
          this.renderer.ctx.font = '20px Arial';
          // Use bright blue for Level 1, theme color for others
          const textColor = this.currentLevel === 1 ? '#4a90e2' : getTheme(this.currentTheme).textColor;
          this.renderer.ctx.fillStyle = textColor;
          this.renderer.ctx.textAlign = 'center';
          this.renderer.ctx.fillText(
            'Click or tap to start',
            this.canvas.width / 2,
            this.canvas.height / 2
          );
        } else if (this.status === 'gameOver') {
          // Don't draw game over text here - the React dialog handles the game over UI
          // Just render the frozen game state
        } else if (this.status === 'starting') {
          this.renderer.ctx.font = '20px Arial';
          this.renderer.ctx.fillStyle = getTheme(this.currentTheme).textColor;
          this.renderer.ctx.textAlign = 'center';
          const seconds = Math.ceil(this.startDelayRemainingMs / 1000);
          this.renderer.ctx.fillText(
            `Get ready! Walls in ${seconds}...`,
            this.canvas.width / 2,
            this.canvas.height / 2
          );
        } else if (this.status === 'paused') {
          this.renderer.ctx.font = '20px Arial';
          this.renderer.ctx.fillStyle = getTheme(this.currentTheme).textColor;
          this.renderer.ctx.textAlign = 'center';
          this.renderer.ctx.fillText(
            'PAUSED - Click or tap to resume',
            this.canvas.width / 2,
            this.canvas.height / 2
          );
        }
      } catch {
        console.error('[Game] Error drawing status text');
      }
    } catch {
      console.error('[Game] Critical error rendering UI elements');
    }
  }
  
  // Update random events system
  private updateRandomEvents(currentTime: number): void {
    // Remove expired events
    this.activeEvents = this.activeEvents.filter(event => currentTime < event.endTime);
    
    // Check if we should spawn a new event
    const timeSinceLastCheck = currentTime - this.lastEventCheck;
    const scoreMilestone = Math.floor(this.score / this.EVENT_SCORE_MILESTONE);
    const lastScoreMilestone = Math.floor((this.score - 2) / this.EVENT_SCORE_MILESTONE);
    
    if (timeSinceLastCheck >= this.EVENT_CHECK_INTERVAL_MS || scoreMilestone > lastScoreMilestone) {
      this.lastEventCheck = currentTime;
      
      // 30% chance to spawn an event
      if (Math.random() < 0.3 && this.activeEvents.length < 2) {
        const eventTypes: RandomEventType[] = ['colorShift', 'bonusZone', 'speedZone', 'slowZone', 'rainbowMode'];
        const randomType = eventTypes[Math.floor(Math.random() * eventTypes.length)];
        
        let duration = 5000; // Default 5 seconds
        if (randomType === 'bonusZone') duration = 10000; // Bonus zone lasts 10 seconds
        
        const event: RandomEvent = {
          type: randomType,
          startTime: currentTime,
          endTime: currentTime + duration,
          intensity: 1.0
        };
        
        this.activeEvents.push(event);
        
        // Apply event effects immediately
        this.applyRandomEvent(event);
      }
    }
    
    // Update active events
    for (const event of this.activeEvents) {
      this.updateRandomEvent(event, currentTime);
    }
  }
  
  // Apply a random event effect
  private applyRandomEvent(event: RandomEvent): void {
    switch (event.type) {
      case 'colorShift':
        // Color shift is handled in renderer
        this.soundManager.playBeep(700, 0.2);
        break;
      case 'bonusZone':
        // Bonus zone doubles score multiplier
        if (this.scoreMultiplier === 1) {
          this.scoreMultiplier = 2;
          this.scoreMultiplierEndTime = event.endTime;
        }
        this.soundManager.playBeep(900, 0.3);
        break;
      case 'speedZone':
        // Speed zone increases scroll speed
        // This is handled in the update loop by checking active events
        this.soundManager.playBeep(600, 0.2);
        break;
      case 'slowZone':
        // Slow zone decreases scroll speed
        // This is handled in the update loop by checking active events
        this.soundManager.playBeep(500, 0.2);
        break;
      case 'rainbowMode':
        // Rainbow mode is handled in renderer
        this.soundManager.playBeep(800, 0.3);
        break;
    }
  }
  
  // Update an active random event
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private updateRandomEvent(_event: RandomEvent, _currentTime: number): void {
    // Events are mostly visual/mechanical, handled in update loop
    // This method can be extended for per-frame updates if needed
  }
  
  // Add a style notification
  private addStyleNotification(text: string, color: string): void {
    this.styleNotifications.push({
      text,
      x: this.ball.position.x,
      y: this.ball.position.y,
      life: 2000, // 2 seconds
      maxLife: 2000,
      scale: 1.0,
      color,
    });
  }
  
  private gameOver(): void {
    // Prevent duplicate gameOver calls - if already in gameOver state, ignore
    if (this.status === 'gameOver') {
      if (this.DEBUG_MODE) {
        console.log('[GAME_DEBUG] gameOver() called but already in gameOver state, ignoring');
      }
      return;
    }
    
    // Detailed debug logging for game over investigation
    const timeSinceStart = this.gameStartTime > 0 ? performance.now() - this.gameStartTime : -1;
    const ballScreenY = this.ball.position.y - this.cameraOffsetY;
    
    console.log('[GAME_DEBUG] ===== GAME OVER TRIGGERED =====');
    console.log('[GAME_DEBUG] Previous status:', this.status);
    console.log('[GAME_DEBUG] Score:', this.score);
    console.log('[GAME_DEBUG] Time since game start:', timeSinceStart > 0 ? `${timeSinceStart.toFixed(2)}ms` : 'Game not started');
    console.log('[GAME_DEBUG] Ball position (world):', { x: this.ball.position.x.toFixed(2), y: this.ball.position.y.toFixed(2) });
    console.log('[GAME_DEBUG] Ball position (screen):', { x: this.ball.position.x.toFixed(2), y: ballScreenY.toFixed(2) });
    console.log('[GAME_DEBUG] Ball velocity:', { x: this.ball.velocity.x.toFixed(2), y: this.ball.velocity.y.toFixed(2) });
    console.log('[GAME_DEBUG] Camera offset Y:', this.cameraOffsetY.toFixed(2));
    console.log('[GAME_DEBUG] Canvas dimensions:', { width: this.canvas.width, height: this.canvas.height });
    console.log('[GAME_DEBUG] Horizontal walls count:', this.horizontalWalls.length);
    this.horizontalWalls.forEach((wall, idx) => {
      console.log(`[GAME_DEBUG]   Wall ${idx}:`, {
        y: wall.position.y.toFixed(2),
        height: wall.height,
        gapType: wall.gapType,
        gapX: wall.gapX?.toFixed(2),
        gapWidth: wall.gapWidth?.toFixed(2)
      });
    });
    console.log('[GAME_DEBUG] Vertical obstacles count:', this.obstacles.length);
    if (this.obstacles.length > 0) {
      this.obstacles.slice(0, 3).forEach((obs, idx) => {
        console.log(`[GAME_DEBUG]   Obstacle ${idx}:`, {
          x: obs.position.x.toFixed(2),
          y: obs.position.y.toFixed(2),
          gapY: obs.gapY?.toFixed(2),
          gapHeight: obs.gapHeight?.toFixed(2)
        });
      });
    }
    console.log('[GAME_DEBUG] =================================');
    
    // Save final checkpoint BEFORE changing status to gameOver
    // This ensures we capture the current game state (score, position, etc.)
    try {
      this.saveCheckpoint();
    } catch (error) {
      console.error('[GAME_DEBUG] Error saving checkpoint on game over:', error);
    }
    
    const previousStatus = this.status;
    this.status = 'gameOver';
    this.deathTimestamp = Date.now();
    
    if (this.DEBUG_MODE) {
      console.log('[GAME_DEBUG] Status changed:', previousStatus, '->', this.status);
    }
    
    // Play hit sound on game over
    this.soundManager.playHit();
    
    // Trigger screen shake on game over
    this.triggerShake(10, 20);
    
    // Add explosion effect on game over
    this.particleSystem.addExplosion(
      this.ball.position.x, 
      this.ball.position.y, 
      '#ef4444', // red for game over
      30
    );
    
    // Don't cancel animation frame - keep rendering the frozen game state
    // The loop will continue but won't update (only render) because status is 'gameOver'
    // This preserves the visual state until player chooses to continue or restart
    if (this.onGameOver) this.onGameOver(this.score);
  }
  
  getStatus(): GameStatus {
    return this.status;
  }
  
  getScore(): number {
    return this.score;
  }
  
  getCurrentTheme(): ThemeKey {
    return this.currentTheme;
  }
  
  // Enable or disable sound
  setSoundEnabled(enabled: boolean): void {
    this.soundManager.setAudioEnabled(enabled);
  }
  
  destroy(): void {
    // Cancel animation frames
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
      this.isLoopRunning = false;
      if (this.DEBUG_MODE) {
        console.log('[Game] Game loop destroyed');
      }
    }
    
    // Cancel pending resize operations
    if (this.resizeRafId !== null) {
      cancelAnimationFrame(this.resizeRafId);
      this.resizeRafId = null;
    }
    
    // Clear error recovery timeout
    if (this.errorRecoveryTimeoutId !== null) {
      clearTimeout(this.errorRecoveryTimeoutId);
      this.errorRecoveryTimeoutId = null;
    }
    
    // Cancel pending checkpoint saves
    if (this.pendingCheckpointIdleCallback !== null && typeof window !== 'undefined' && 'cancelIdleCallback' in window) {
      window.cancelIdleCallback(this.pendingCheckpointIdleCallback);
      this.pendingCheckpointIdleCallback = null;
    }
    if (this.pendingCheckpointTimeout !== null) {
      clearTimeout(this.pendingCheckpointTimeout);
      this.pendingCheckpointTimeout = null;
    }
    
    // Remove resize event listener
    if (this.resizeHandler) {
      window.removeEventListener('resize', this.resizeHandler);
    }
    
    // Clean up sound manager
    this.soundManager.destroy();
    
    this.inputHandler.destroy();
  }

  private ensureGridCoverage(): void {
    const h = this.canvas.height;
    const buffer = this.GRID_BUFFER_MULTIPLIER * h;
    const minNeededY = this.cameraOffsetY - buffer;
    const maxNeededY = this.cameraOffsetY + h + buffer;
    
    // Calculate which grid rows should exist
    const minRow = Math.floor(minNeededY / this.HORIZONTAL_GRID_SPACING);
    const maxRow = Math.ceil(maxNeededY / this.HORIZONTAL_GRID_SPACING);
    
    // Generate any missing rows
    for (let row = minRow; row <= maxRow; row++) {
      const rowY = row * this.HORIZONTAL_GRID_SPACING;
      // Check if this row already exists in horizontalWalls
      const rowExists = this.horizontalWalls.some(wall => 
        Math.abs(wall.position.y - rowY) < this.WALL_THICKNESS / 2
      );
      
      if (!rowExists) {
        this.generateHorizontalWallRow(rowY);
      }
    }
  }

  private generateHorizontalWallRow(worldY: number): void {
    const config = getConfigForDifficulty(this.difficulty);
    const wallHeight = this.WALL_THICKNESS;
    const wallStyle = selectFromProbabilities(config.walls.styleProbabilities);
    const wallColor = getRandomColorFromPalette(config.walls.colorPalette);
    const obstacleType: 'pipe' | 'spike' | 'moving' = (wallStyle === 'spike' ? 'spike' : (wallStyle === 'moving' ? 'moving' : 'pipe')) as 'pipe' | 'spike' | 'moving';
    
    const wall: Obstacle = {
      position: { x: 0, y: worldY },
      width: this.canvas.width,
      height: wallHeight,
      gapY: 0,
      gapHeight: 0,
      orientation: 'horizontal',
      gapX: undefined,
      gapWidth: undefined,
      gapType: 'none',
      obstacleType: obstacleType,
      wallStyle: wallStyle,
      wallColor: wallColor,
      theme: this.currentTheme,
      passed: false,
      isLevelTransition: false
    };
    
    this.horizontalWalls.push(wall);
  }

  private generateInitialGridRows(): void {
    const numInitialRows = 12; // +/- 6 rows around 0
    for (let i = -numInitialRows; i <= numInitialRows; i++) {
      const rowY = i * this.HORIZONTAL_GRID_SPACING;
      this.generateHorizontalWallRow(rowY);
    }
  }
}