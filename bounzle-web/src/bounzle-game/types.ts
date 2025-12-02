// Game types and interfaces

export type ThemeKey = 'normal' | 'neon' | 'lava' | 'ocean';
export type WallStyle = 'pipe' | 'spike' | 'moving' | 'procedural';
export type PowerUpType = 'score' | 'life' | 'slowmo' | 'speedboost' | 'shield' | 'magnet' | 'doublescore' | 'gravityflip';

export interface Vector2D {
  x: number;
  y: number;
}

export interface Ball {
  position: Vector2D;
  velocity: Vector2D;
  radius: number;
  gravityScale: number;
}

export interface PowerUp {
  position: Vector2D;
  type: PowerUpType;
  size: number;
  collected: boolean;
  rotation: number; // For animation
  pulseScale: number; // For pulsing animation
}

export type GapType = 'powerup' | 'shortcut' | 'level-transition' | 'none';

export interface Obstacle {
  position: Vector2D;
  width: number;
  height: number;
  gapY: number;
  gapHeight: number;
  orientation?: 'vertical' | 'horizontal'; // Wall orientation (default: 'vertical')
  gapX?: number; // For horizontal walls: center X of safe gap
  gapWidth?: number; // For horizontal walls: width of safe gap
  gapType?: GapType; // Type of gap (for horizontal walls): powerup, shortcut, level-transition, or none
  obstacleType?: 'pipe' | 'spike' | 'moving';
  wallStyle?: WallStyle; // Explicit wall style
  wallColor?: string; // Wall color (separate from theme)
  theme?: ThemeKey;
  passed?: boolean;
  powerUp?: PowerUp; // Power-up placed in this obstacle's gap
  isLevelTransition?: boolean; // True if this gap is a level transition (deprecated, use gapType)
  connectedObstacleId?: number; // Index of vertical obstacle this horizontal wall is connected to
  connectionType?: 'seamless' | 'bridge'; // Type of connection for rendering
}

export interface GameState {
  ball: Ball;
  obstacles: Obstacle[];
  score: number;
  isPlaying: boolean;
  isGameOver: boolean;
}

export type GameStatus = 'idle' | 'starting' | 'playing' | 'paused' | 'gameOver';

// Level generation types
export interface LevelChunk {
  gapY: number;        // center Y of safe gap (0–1 normalized)
  gapHeight: number;   // 0.1–0.3
  obstacleType: 'pipe' | 'spike' | 'moving';
  theme: ThemeKey;
}

export interface LevelData {
  seed: number;
  chunks: LevelChunk[];
}

// Background system types
export type BackgroundElementType = 
  | 'cloud' 
  | 'circle' 
  | 'triangle' 
  | 'star' 
  | 'gradient'
  | 'planet'
  | 'nebula'
  | 'asteroid'
  | 'bubble'
  | 'coral'
  | 'seaweed'
  | 'fish'
  | 'building'
  | 'window'
  | 'light'
  | 'tree'
  | 'leaf'
  | 'branch'
  | 'mountain'
  | 'grid'
  | 'pattern'
  | 'isometric'
  | 'cube'
  | 'pyramid';

export interface BackgroundElement {
  type: BackgroundElementType;
  x: number;
  y: number;
  size: number;
  opacity: number;
  color?: string;
  parallaxSpeed: number; // 0.0 to 1.0, where 1.0 is full scroll speed
  rotation?: number; // Optional rotation for animated elements
  variant?: number; // Optional variant index for element variations
}

export interface BackgroundLayer {
  elements: BackgroundElement[];
  parallaxSpeed: number; // Base speed multiplier for this layer (0.2, 0.4, 0.6, 1.0)
  color: string; // Base color for elements in this layer
  opacity: number; // Overall opacity of the layer
}

// Game state snapshot for checkpoint system
export interface GameStateSnapshot {
  ball: Ball;
  obstacles: Obstacle[];
  horizontalWalls: Obstacle[]; // Horizontal walls (top and bottom)
  powerUps: PowerUp[]; // Standalone power-ups (not attached to obstacles)
  score: number;
  difficulty: number;
  currentTheme: ThemeKey;
  levelChunks: LevelChunk[];
  currentChunkIndex: number;
  consumedChunkCount: number; // Track how many chunks have been converted to obstacles
  lastObstacleX: number;
  lastGapY: number;
  lastHorizontalWallX?: number; // Track last horizontal wall X position for generation
  lastHorizontalWallY?: { top: number; bottom: number }; // Track last horizontal wall positions
  cameraOffsetY?: number; // Camera vertical offset for gap traversal
  timestamp: number;
  checkpointId: string;
  slowMotionActive?: boolean; // Track slow motion power-up state
  slowMotionEndTime?: number; // When slow motion ends
  speedBoostActive?: boolean; // Track speed boost power-up state
  speedBoostEndTime?: number; // When speed boost ends
  shieldCount?: number; // Number of shield power-ups collected
  magnetActive?: boolean; // Track magnet power-up state
  magnetEndTime?: number; // When magnet ends
  scoreMultiplier?: number; // Score multiplier from double score power-up
  scoreMultiplierEndTime?: number; // When score multiplier ends
  gravityFlipActive?: boolean; // Track gravity flip power-up state
  gravityFlipEndTime?: number; // When gravity flip ends
  activeEvents?: RandomEvent[]; // Active random events
}

// Random event types for gameplay variety
export type RandomEventType = 'colorShift' | 'bonusZone' | 'speedZone' | 'slowZone' | 'rainbowMode';

export interface RandomEvent {
  type: RandomEventType;
  startTime: number;
  endTime: number;
  intensity?: number; // Optional intensity modifier
}