// Central game configuration for walls, gaps, power-ups, and difficulty scaling

export type WallStyle = 'pipe' | 'spike' | 'moving' | 'procedural';
export type PowerUpType = 'score' | 'life' | 'slowmo' | 'speedboost' | 'shield' | 'magnet' | 'doublescore' | 'gravityflip';

export interface WallConfig {
  spacing: number; // Distance between walls
  widthMin: number;
  widthMax: number;
  gapHeightMin: number; // Normalized (0-1)
  gapHeightMax: number; // Normalized (0-1)
  colorPalette: string[]; // Array of hex colors
  styleProbabilities: Record<WallStyle, number>; // Probabilities for each style (should sum to ~1.0)
}

export interface PowerUpConfig {
  spawnChance: number; // 0.0 to 1.0
  size: number;
  typeProbabilities: Record<PowerUpType, number>; // Probabilities for each type
  offsetRange: number; // How much to offset from gap center (normalized, 0-1)
}

export interface GameConfig {
  walls: WallConfig;
  powerUps: PowerUpConfig;
}

// Configuration breakpoints for different difficulty levels
const CONFIG_BREAKPOINTS: Record<number, GameConfig> = {
  1.0: {
    walls: {
      spacing: 3200, // More generous spacing so walls feel further apart
      widthMin: 40,
      widthMax: 150,
      gapHeightMin: 0.15, // 15% of screen height
      gapHeightMax: 0.25, // 25% of screen height
      colorPalette: [
        '#6b7280', // gray-500
        '#9ca3af', // gray-400
        '#78716c', // stone-500
        '#a8a29e', // stone-400
        '#64748b', // slate-500
        '#94a3b8', // slate-400
        '#4b5563', // gray-600
        '#d1d5db', // gray-300
        '#57534e', // stone-600
        '#cbd5e1', // slate-200
        '#475569', // slate-600
        '#06b6d4', // cyan-500
        '#10b981', // emerald-500
        '#f59e0b', // amber-500
        '#8b5cf6', // purple-500
        '#ec4899', // pink-500
      ],
      styleProbabilities: {
        pipe: 0.5,
        spike: 0.2,
        moving: 0.2,
        procedural: 0.1,
      },
    },
    powerUps: {
      spawnChance: 0.3, // 30% chance to spawn a power-up
      size: 20,
      typeProbabilities: {
        score: 0.25,
        life: 0.15,
        slowmo: 0.15,
        speedboost: 0.15,
        shield: 0.15,
        magnet: 0.10,
        doublescore: 0.03,
        gravityflip: 0.02,
      },
      offsetRange: 0.1, // 10% offset from center for challenge
    },
  },
  2.0: {
    walls: {
      spacing: 2600,
      widthMin: 50,
      widthMax: 160,
      gapHeightMin: 0.12,
      gapHeightMax: 0.20,
      colorPalette: [
        '#6b7280', // gray-500
        '#9ca3af', // gray-400
        '#78716c', // stone-500
        '#ef4444', // red-500
        '#f59e0b', // amber-500
        '#64748b', // slate-500
        '#dc2626', // red-600
        '#d97706', // amber-600
        '#7c3aed', // violet-600
        '#059669', // emerald-600
        '#0891b2', // cyan-600
        '#06b6d4', // cyan-500
        '#10b981', // emerald-500
        '#8b5cf6', // purple-500
        '#ec4899', // pink-500
        '#f97316', // orange-500
        '#84cc16', // lime-500
        '#eab308', // yellow-500
      ],
      styleProbabilities: {
        pipe: 0.4,
        spike: 0.3,
        moving: 0.25,
        procedural: 0.05,
      },
    },
    powerUps: {
      spawnChance: 0.35,
      size: 18,
      typeProbabilities: {
        score: 0.20,
        life: 0.15,
        slowmo: 0.15,
        speedboost: 0.15,
        shield: 0.15,
        magnet: 0.12,
        doublescore: 0.05,
        gravityflip: 0.03,
      },
      offsetRange: 0.15,
    },
  },
  3.0: {
    walls: {
      spacing: 2200,
      widthMin: 60,
      widthMax: 180,
      gapHeightMin: 0.10,
      gapHeightMax: 0.18,
      colorPalette: [
        '#6b7280', // gray-500
        '#ef4444', // red-500
        '#f59e0b', // amber-500
        '#8b5cf6', // purple-500
        '#ec4899', // pink-500
        '#64748b', // slate-500
        '#b91c1c', // red-700
        '#a855f7', // purple-500
        '#db2777', // pink-600
        '#06b6d4', // cyan-500
        '#10b981', // emerald-500
        '#f97316', // orange-500
        '#84cc16', // lime-500
        '#eab308', // yellow-500
        '#14b8a6', // teal-500
        '#a855f7', // violet-500
        '#f43f5e', // rose-500
        '#0ea5e9', // sky-500
      ],
      styleProbabilities: {
        pipe: 0.3,
        spike: 0.35,
        moving: 0.3,
        procedural: 0.05,
      },
    },
    powerUps: {
      spawnChance: 0.4,
      size: 16,
      typeProbabilities: {
        score: 0.15,
        life: 0.20,
        slowmo: 0.15,
        speedboost: 0.15,
        shield: 0.15,
        magnet: 0.12,
        doublescore: 0.05,
        gravityflip: 0.03,
      },
      offsetRange: 0.2,
    },
  },
  5.0: {
    walls: {
      spacing: 1800,
      widthMin: 70,
      widthMax: 200,
      gapHeightMin: 0.08,
      gapHeightMax: 0.15,
      colorPalette: [
        '#ef4444', // red-500
        '#f59e0b', // amber-500
        '#8b5cf6', // purple-500
        '#ec4899', // pink-500
        '#06b6d4', // cyan-500
        '#10b981', // emerald-500
        '#991b1b', // red-800
        '#92400e', // amber-800
        '#6b21a8', // purple-700
        '#be185d', // pink-700
        '#155e75', // cyan-700
        '#047857', // emerald-700
        '#ea580c', // orange-600
        '#0d9488', // teal-600
        '#84cc16', // lime-500
        '#eab308', // yellow-500
        '#f43f5e', // rose-500
        '#0ea5e9', // sky-500
        '#a855f7', // violet-500
        '#14b8a6', // teal-500
        '#fbbf24', // amber-400
        '#34d399', // emerald-400
      ],
      styleProbabilities: {
        pipe: 0.2,
        spike: 0.4,
        moving: 0.35,
        procedural: 0.05,
      },
    },
    powerUps: {
      spawnChance: 0.45,
      size: 14,
      typeProbabilities: {
        score: 0.12,
        life: 0.20,
        slowmo: 0.15,
        speedboost: 0.15,
        shield: 0.18,
        magnet: 0.12,
        doublescore: 0.05,
        gravityflip: 0.03,
      },
      offsetRange: 0.25,
    },
  },
};

// Helper function to interpolate between config breakpoints
function interpolateConfig(lower: GameConfig, upper: GameConfig, factor: number): GameConfig {
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  
  // Interpolate wall spacing
  const spacing = lerp(lower.walls.spacing, upper.walls.spacing, factor);
  const widthMin = lerp(lower.walls.widthMin, upper.walls.widthMin, factor);
  const widthMax = lerp(lower.walls.widthMax, upper.walls.widthMax, factor);
  const gapHeightMin = lerp(lower.walls.gapHeightMin, upper.walls.gapHeightMin, factor);
  const gapHeightMax = lerp(lower.walls.gapHeightMax, upper.walls.gapHeightMax, factor);
  
  // Interpolate power-up config
  const powerUpSize = lerp(lower.powerUps.size, upper.powerUps.size, factor);
  const powerUpSpawnChance = lerp(lower.powerUps.spawnChance, upper.powerUps.spawnChance, factor);
  const powerUpOffsetRange = lerp(lower.powerUps.offsetRange, upper.powerUps.offsetRange, factor);
  
  // For arrays and objects, use lower config until factor > 0.5, then upper
  const useUpper = factor > 0.5;
  
  return {
    walls: {
      spacing: Math.round(spacing),
      widthMin: Math.round(widthMin),
      widthMax: Math.round(widthMax),
      gapHeightMin,
      gapHeightMax,
      colorPalette: useUpper ? upper.walls.colorPalette : lower.walls.colorPalette,
      styleProbabilities: useUpper ? upper.walls.styleProbabilities : lower.walls.styleProbabilities,
    },
    powerUps: {
      spawnChance: powerUpSpawnChance,
      size: Math.round(powerUpSize),
      typeProbabilities: useUpper ? upper.powerUps.typeProbabilities : lower.powerUps.typeProbabilities,
      offsetRange: powerUpOffsetRange,
    },
  };
}

// Get configuration for a specific difficulty level
export function getConfigForDifficulty(difficulty: number): GameConfig {
  const breakpoints = Object.keys(CONFIG_BREAKPOINTS)
    .map(Number)
    .sort((a, b) => a - b);
  
  // Clamp difficulty to valid range
  if (difficulty <= breakpoints[0]) {
    return CONFIG_BREAKPOINTS[breakpoints[0]];
  }
  
  if (difficulty >= breakpoints[breakpoints.length - 1]) {
    return CONFIG_BREAKPOINTS[breakpoints[breakpoints.length - 1]];
  }
  
  // Find the two breakpoints to interpolate between
  let lowerKey = breakpoints[0];
  let upperKey = breakpoints[breakpoints.length - 1];
  
  for (let i = 0; i < breakpoints.length - 1; i++) {
    if (difficulty >= breakpoints[i] && difficulty <= breakpoints[i + 1]) {
      lowerKey = breakpoints[i];
      upperKey = breakpoints[i + 1];
      break;
    }
  }
  
  const lower = CONFIG_BREAKPOINTS[lowerKey];
  const upper = CONFIG_BREAKPOINTS[upperKey];
  
  // Calculate interpolation factor
  const factor = (difficulty - lowerKey) / (upperKey - lowerKey);
  
  return interpolateConfig(lower, upper, factor);
}

// Helper function to select a random item from weighted probabilities
export function selectFromProbabilities<T extends string>(
  probabilities: Record<T, number>
): T {
  const items = Object.keys(probabilities) as T[];
  const weights = items.map(item => probabilities[item]);
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  
  let random = Math.random() * totalWeight;
  
  for (let i = 0; i < items.length; i++) {
    random -= weights[i];
    if (random <= 0) {
      return items[i];
    }
  }
  
  // Fallback (shouldn't happen)
  return items[0];
}

// Helper function to get random value from range
export function randomInRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

// Helper function to get random color from palette
export function getRandomColorFromPalette(palette: string[]): string {
  return palette[Math.floor(Math.random() * palette.length)];
}

