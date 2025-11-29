// Game types and interfaces

export type ThemeKey = 'normal' | 'neon' | 'lava' | 'ocean';

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

export interface Obstacle {
  position: Vector2D;
  width: number;
  height: number;
  gapY: number;
  gapHeight: number;
  obstacleType?: 'pipe' | 'spike' | 'moving';
  theme?: ThemeKey;
  passed?: boolean;
}

export interface GameState {
  ball: Ball;
  obstacles: Obstacle[];
  score: number;
  isPlaying: boolean;
  isGameOver: boolean;
}

export type GameStatus = 'idle' | 'playing' | 'paused' | 'gameOver';

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
export type BackgroundElementType = 'cloud' | 'circle' | 'triangle' | 'star' | 'gradient';

export interface BackgroundElement {
  type: BackgroundElementType;
  x: number;
  y: number;
  size: number;
  opacity: number;
  color?: string;
  parallaxSpeed: number; // 0.0 to 1.0, where 1.0 is full scroll speed
}

export interface BackgroundLayer {
  elements: BackgroundElement[];
  parallaxSpeed: number; // Base speed multiplier for this layer (0.2, 0.4, 0.6, 1.0)
  color: string; // Base color for elements in this layer
  opacity: number; // Overall opacity of the layer
}