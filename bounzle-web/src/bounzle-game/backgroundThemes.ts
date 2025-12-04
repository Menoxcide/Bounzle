// Background theme system for level-based backgrounds

export type BackgroundTheme = 
  | 'space' 
  | 'underwater' 
  | 'cityscape' 
  | 'forest' 
  | 'abstract' 
  | 'geometric' 
  | 'gradient' 
  | 'isometric'
  | 'desert'
  | 'arctic'
  | 'volcanic'
  | 'cyberpunk'
  | 'candyland'
  | 'underwatercave'
  | 'crystalcavern'
  | 'mushroomforest'
  | 'cloudkingdom'
  | 'neoncity'
  | 'jungle'
  | 'graveyard'
  | 'oceandepths'
  | 'sunsetbeach'
  | 'magicalforest'
  | 'industrial'
  | 'retroarcade';

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
  },
  desert: {
    name: 'desert',
    backgroundColor: '#d4a574',
    backgroundColorSecondary: '#f4c2a1',
    elementTypes: ['sanddune', 'cactus', 'mirage', 'sunray'],
    colorPalette: ['#f4c2a1', '#d4a574', '#c19a6b', '#e6c79a', '#f5deb3', '#daa520', '#cd853f', '#deb887'],
    parallaxSpeeds: [0.1, 0.3, 0.6, 0.9],
    elementCounts: [20, 12, 8, 4]
  },
  arctic: {
    name: 'arctic',
    backgroundColor: '#e0f2fe',
    backgroundColorSecondary: '#bae6fd',
    elementTypes: ['icecrystal', 'aurora', 'snowflake', 'glacier'],
    colorPalette: ['#e0f2fe', '#bae6fd', '#7dd3fc', '#38bdf8', '#0ea5e9', '#0284c7', '#06b6d4', '#22d3ee'],
    parallaxSpeeds: [0.1, 0.3, 0.6, 0.9],
    elementCounts: [25, 3, 30, 6]
  },
  volcanic: {
    name: 'volcanic',
    backgroundColor: '#1c1917',
    backgroundColorSecondary: '#292524',
    elementTypes: ['lavaflow', 'ember', 'smoke', 'magmabubble'],
    colorPalette: ['#dc2626', '#ef4444', '#f97316', '#f59e0b', '#eab308', '#991b1b', '#7f1d1d', '#450a0a'],
    parallaxSpeeds: [0.15, 0.35, 0.65, 0.95],
    elementCounts: [8, 20, 15, 12]
  },
  cyberpunk: {
    name: 'cyberpunk',
    backgroundColor: '#0a0a0f',
    backgroundColorSecondary: '#1a1a2e',
    elementTypes: ['neonsign', 'hologram', 'digitalrain', 'gridline'],
    colorPalette: ['#00ff00', '#00ffff', '#ff00ff', '#ffff00', '#ff0080', '#00ff80', '#8000ff', '#ff8000'],
    parallaxSpeeds: [0.2, 0.4, 0.7, 1.0],
    elementCounts: [15, 8, 25, 20]
  },
  candyland: {
    name: 'candyland',
    backgroundColor: '#fef3c7',
    backgroundColorSecondary: '#fde68a',
    elementTypes: ['gumdrop', 'lollipop', 'candycane', 'sprinkle'],
    colorPalette: ['#fef3c7', '#fde68a', '#fbbf24', '#f59e0b', '#ec4899', '#f472b6', '#a855f7', '#8b5cf6'],
    parallaxSpeeds: [0.15, 0.35, 0.65, 0.95],
    elementCounts: [18, 12, 10, 30]
  },
  underwatercave: {
    name: 'underwatercave',
    backgroundColor: '#0c1220',
    backgroundColorSecondary: '#1a2332',
    elementTypes: ['bioluminescence', 'stalactite', 'bubble', 'crystal'],
    colorPalette: ['#00ffff', '#00d4ff', '#0080ff', '#4a00ff', '#8000ff', '#00ff80', '#00ff40', '#80ff00'],
    parallaxSpeeds: [0.1, 0.3, 0.6, 0.9],
    elementCounts: [20, 10, 15, 8]
  },
  crystalcavern: {
    name: 'crystalcavern',
    backgroundColor: '#1e1b2e',
    backgroundColorSecondary: '#2d2542',
    elementTypes: ['gemstone', 'lightrefraction', 'crystalformation', 'sparkle'],
    colorPalette: ['#ff00ff', '#00ffff', '#ffff00', '#ff0080', '#8000ff', '#00ff80', '#ff8000', '#80ff00'],
    parallaxSpeeds: [0.15, 0.35, 0.65, 0.95],
    elementCounts: [12, 8, 10, 25]
  },
  mushroomforest: {
    name: 'mushroomforest',
    backgroundColor: '#1a1a2e',
    backgroundColorSecondary: '#2d2d4e',
    elementTypes: ['mushroom', 'spore', 'glowingcap', 'mycelium'],
    colorPalette: ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#ffeaa7', '#dda15e', '#ffd93d', '#6c5ce7'],
    parallaxSpeeds: [0.1, 0.3, 0.6, 0.9],
    elementCounts: [15, 20, 12, 10]
  },
  cloudkingdom: {
    name: 'cloudkingdom',
    backgroundColor: '#87ceeb',
    backgroundColorSecondary: '#b0e0e6',
    elementTypes: ['cloud', 'rainbow', 'lightning', 'skypalace'],
    colorPalette: ['#ffffff', '#e0f2fe', '#bae6fd', '#ff6b6b', '#4ecdc4', '#ffeaa7', '#a29bfe', '#fd79a8'],
    parallaxSpeeds: [0.1, 0.3, 0.6, 0.9],
    elementCounts: [20, 3, 5, 8]
  },
  neoncity: {
    name: 'neoncity',
    backgroundColor: '#0a0a0f',
    backgroundColorSecondary: '#1a1a2e',
    elementTypes: ['skyscraper', 'neonsign', 'trafficlight', 'billboard'],
    colorPalette: ['#00ff00', '#00ffff', '#ff00ff', '#ffff00', '#ff0080', '#00ff80', '#8000ff', '#ff8000'],
    parallaxSpeeds: [0.15, 0.35, 0.65, 0.95],
    elementCounts: [12, 15, 10, 8]
  },
  jungle: {
    name: 'jungle',
    backgroundColor: '#1a4d2e',
    backgroundColorSecondary: '#2d5a3d',
    elementTypes: ['vine', 'tropicalflower', 'waterfall', 'exoticbird'],
    colorPalette: ['#90ee90', '#228b22', '#32cd32', '#ff6b6b', '#ffd700', '#ff6347', '#00ced1', '#ff1493'],
    parallaxSpeeds: [0.1, 0.3, 0.6, 0.9],
    elementCounts: [18, 15, 5, 8]
  },
  graveyard: {
    name: 'graveyard',
    backgroundColor: '#1a1a2e',
    backgroundColorSecondary: '#2d2d4e',
    elementTypes: ['tombstone', 'mist', 'ghost', 'moonlight'],
    colorPalette: ['#708090', '#778899', '#b0c4de', '#d3d3d3', '#ffffff', '#e0e0e0', '#c0c0c0', '#a0a0a0'],
    parallaxSpeeds: [0.1, 0.3, 0.6, 0.9],
    elementCounts: [12, 15, 8, 1]
  },
  oceandepths: {
    name: 'oceandepths',
    backgroundColor: '#000033',
    backgroundColorSecondary: '#000066',
    elementTypes: ['deepseacreature', 'kelpforest', 'bioluminescentfish', 'coral'],
    colorPalette: ['#0000ff', '#0080ff', '#00ffff', '#008080', '#004080', '#0066cc', '#0099ff', '#00ccff'],
    parallaxSpeeds: [0.1, 0.3, 0.6, 0.9],
    elementCounts: [8, 12, 15, 10]
  },
  sunsetbeach: {
    name: 'sunsetbeach',
    backgroundColor: '#ff6b6b',
    backgroundColorSecondary: '#ffa07a',
    elementTypes: ['palmtree', 'wave', 'seagull', 'sunsetgradient'],
    colorPalette: ['#ff6b6b', '#ffa07a', '#ffd700', '#ff8c00', '#ff6347', '#ff1493', '#ff69b4', '#ffb6c1'],
    parallaxSpeeds: [0.1, 0.3, 0.6, 0.9],
    elementCounts: [10, 15, 8, 1]
  },
  magicalforest: {
    name: 'magicalforest',
    backgroundColor: '#1a1a2e',
    backgroundColorSecondary: '#2d2d4e',
    elementTypes: ['fairylight', 'enchantedtree', 'firefly', 'magicorb'],
    colorPalette: ['#ffd700', '#ff69b4', '#9370db', '#00ffff', '#ff00ff', '#ffff00', '#00ff00', '#ff8000'],
    parallaxSpeeds: [0.1, 0.3, 0.6, 0.9],
    elementCounts: [20, 12, 25, 10]
  },
  industrial: {
    name: 'industrial',
    backgroundColor: '#2c2c2c',
    backgroundColorSecondary: '#3c3c3c',
    elementTypes: ['pipe', 'gear', 'steam', 'factory'],
    colorPalette: ['#708090', '#778899', '#b0c4de', '#d3d3d3', '#a0a0a0', '#808080', '#696969', '#555555'],
    parallaxSpeeds: [0.15, 0.35, 0.65, 0.95],
    elementCounts: [15, 12, 20, 8]
  },
  retroarcade: {
    name: 'retroarcade',
    backgroundColor: '#000000',
    backgroundColorSecondary: '#1a1a2e',
    elementTypes: ['pixelart', 'eightbitpattern', 'arcade', 'pixelstar'],
    colorPalette: ['#00ff00', '#ff00ff', '#ffff00', '#00ffff', '#ff0000', '#0000ff', '#ff8000', '#8000ff'],
    parallaxSpeeds: [0.2, 0.4, 0.7, 1.0],
    elementCounts: [18, 20, 10, 15]
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
    'isometric',
    'desert',
    'arctic',
    'volcanic',
    'cyberpunk',
    'candyland',
    'underwatercave',
    'crystalcavern',
    'mushroomforest',
    'cloudkingdom',
    'neoncity',
    'jungle',
    'graveyard',
    'oceandepths',
    'sunsetbeach',
    'magicalforest',
    'industrial',
    'retroarcade'
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

