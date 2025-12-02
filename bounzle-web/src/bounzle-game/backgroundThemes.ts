// Background theme system for level-based backgrounds

export type BackgroundTheme = 
  | 'space' 
  | 'underwater' 
  | 'cityscape' 
  | 'forest' 
  | 'abstract' 
  | 'geometric' 
  | 'gradient' 
  | 'isometric';

export interface BackgroundThemeConfig {
  name: BackgroundTheme;
  backgroundColor: string;
  backgroundColorSecondary?: string; // For gradients
  elementTypes: string[];
  colorPalette: string[];
  parallaxSpeeds: number[]; // Speeds for different layers
  elementCounts: number[]; // Counts for each layer
}

// Theme configurations
export const BACKGROUND_THEMES: Record<BackgroundTheme, BackgroundThemeConfig> = {
  space: {
    name: 'space',
    backgroundColor: '#000000',
    backgroundColorSecondary: '#0a0a2e',
    elementTypes: ['star', 'planet', 'nebula', 'asteroid'],
    colorPalette: ['#ffffff', '#4a90e2', '#9b59b6', '#e74c3c', '#f39c12', '#1abc9c'],
    parallaxSpeeds: [0.1, 0.3, 0.6, 0.9],
    elementCounts: [30, 8, 3, 5]
  },
  underwater: {
    name: 'underwater',
    backgroundColor: '#0a4d68',
    backgroundColorSecondary: '#0881a3',
    elementTypes: ['bubble', 'coral', 'seaweed', 'fish'],
    colorPalette: ['#00d4ff', '#00a8cc', '#7dd3fc', '#38bdf8', '#0ea5e9', '#0284c7'],
    parallaxSpeeds: [0.2, 0.4, 0.7, 1.0],
    elementCounts: [25, 12, 8, 6]
  },
  cityscape: {
    name: 'cityscape',
    backgroundColor: '#1a1a2e',
    backgroundColorSecondary: '#16213e',
    elementTypes: ['building', 'window', 'light', 'cloud'],
    colorPalette: ['#ffd700', '#ff6b6b', '#4ecdc4', '#95e1d3', '#f38181', '#aa96da'],
    parallaxSpeeds: [0.15, 0.35, 0.65, 0.95],
    elementCounts: [15, 20, 10, 8]
  },
  forest: {
    name: 'forest',
    backgroundColor: '#1a4d2e',
    backgroundColorSecondary: '#2d5a3d',
    elementTypes: ['tree', 'leaf', 'branch', 'mountain'],
    colorPalette: ['#90ee90', '#228b22', '#32cd32', '#7cfc00', '#98fb98', '#adff2f'],
    parallaxSpeeds: [0.1, 0.3, 0.6, 0.9],
    elementCounts: [12, 20, 10, 5]
  },
  abstract: {
    name: 'abstract',
    backgroundColor: '#1a1a2e',
    backgroundColorSecondary: '#16213e',
    elementTypes: ['gradient', 'circle', 'triangle', 'pattern'],
    colorPalette: ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#ffeaa7', '#dda15e'],
    parallaxSpeeds: [0.2, 0.4, 0.7, 1.0],
    elementCounts: [15, 18, 12, 8]
  },
  geometric: {
    name: 'geometric',
    backgroundColor: '#0f0f23',
    backgroundColorSecondary: '#1a1a2e',
    elementTypes: ['grid', 'pattern', 'triangle', 'circle'],
    colorPalette: ['#ffd700', '#ff6b6b', '#4ecdc4', '#95e1d3', '#f38181', '#aa96da'],
    parallaxSpeeds: [0.15, 0.35, 0.65, 0.95],
    elementCounts: [20, 15, 10, 12]
  },
  gradient: {
    name: 'gradient',
    backgroundColor: '#1a1a2e',
    backgroundColorSecondary: '#16213e',
    elementTypes: ['gradient', 'circle', 'star', 'cloud'],
    colorPalette: ['#667eea', '#764ba2', '#f093fb', '#4facfe', '#00f2fe', '#43e97b'],
    parallaxSpeeds: [0.1, 0.3, 0.6, 0.9],
    elementCounts: [18, 15, 12, 10]
  },
  isometric: {
    name: 'isometric',
    backgroundColor: '#2c3e50',
    backgroundColorSecondary: '#34495e',
    elementTypes: ['isometric', 'cube', 'pyramid', 'pattern'],
    colorPalette: ['#3498db', '#9b59b6', '#e74c3c', '#f39c12', '#1abc9c', '#ecf0f1'],
    parallaxSpeeds: [0.2, 0.4, 0.7, 1.0],
    elementCounts: [12, 15, 10, 8]
  }
};

// Get background theme for a specific level
// Uses deterministic mapping so same level always gets same theme
export function getBackgroundThemeForLevel(level: number): BackgroundTheme {
  const themes: BackgroundTheme[] = [
    'space',
    'underwater',
    'cityscape',
    'forest',
    'abstract',
    'geometric',
    'gradient',
    'isometric'
  ];
  
  // Use level number to deterministically select theme
  // Cycles through themes, but also adds some variation based on level
  const themeIndex = (level - 1) % themes.length;
  return themes[themeIndex];
}

// Get theme configuration
export function getBackgroundThemeConfig(theme: BackgroundTheme): BackgroundThemeConfig {
  return BACKGROUND_THEMES[theme];
}

