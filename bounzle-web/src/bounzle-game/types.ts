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