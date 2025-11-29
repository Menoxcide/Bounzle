// Theme management for the game

import type { ThemeKey } from './types';

export interface Theme {
  name: string;
  backgroundColor: string;
  ballColor: string;
  ballHighlightColor: string;
  obstacleColor: string;
  obstacleHighlightColor: string;
  textColor: string;
  uiBackgroundColor: string;
}

export const THEMES: Record<string, Theme> = {
  normal: {
    name: 'Normal',
    backgroundColor: '#dbeafe', // blue-100 to blue-200 gradient
    ballColor: '#3b82f6', // blue-500
    ballHighlightColor: '#1d4ed8', // blue-700
    obstacleColor: '#6b7280', // gray-500
    obstacleHighlightColor: '#9ca3af', // gray-400
    textColor: '#1e40af', // blue-800
    uiBackgroundColor: 'rgba(255, 255, 255, 0.8)'
  },
  neon: {
    name: 'Neon',
    backgroundColor: '#000000', // black
    ballColor: '#00ff00', // bright green
    ballHighlightColor: '#00cc00', // darker green
    obstacleColor: '#00ff00', // bright green
    obstacleHighlightColor: '#00cc00', // darker green
    textColor: '#00ff00', // bright green
    uiBackgroundColor: 'rgba(0, 255, 0, 0.2)'
  },
  lava: {
    name: 'Lava',
    backgroundColor: '#7f1d1d', // red-900
    ballColor: '#f87171', // red-400
    ballHighlightColor: '#dc2626', // red-600
    obstacleColor: '#ef4444', // red-500
    obstacleHighlightColor: '#dc2626', // red-600
    textColor: '#fecaca', // red-200
    uiBackgroundColor: 'rgba(255, 0, 0, 0.2)'
  },
  ocean: {
    name: 'Ocean',
    backgroundColor: '#0c4a6e', // blue-900
    ballColor: '#0ea5e9', // sky-500
    ballHighlightColor: '#0284c7', // sky-600
    obstacleColor: '#38bdf8', // sky-400
    obstacleHighlightColor: '#0284c7', // sky-600
    textColor: '#bae6fd', // sky-200
    uiBackgroundColor: 'rgba(0, 191, 255, 0.2)'
  }
};

export function getTheme(themeName: string): Theme {
  return THEMES[themeName] || THEMES.normal;
}

export function getRandomTheme(): Theme {
  const themeKeys = Object.keys(THEMES);
  const randomKey = themeKeys[Math.floor(Math.random() * themeKeys.length)];
  return THEMES[randomKey];
}

export function getRandomThemeKey(): ThemeKey {
  const themeKeys = Object.keys(THEMES) as ThemeKey[];
  return themeKeys[Math.floor(Math.random() * themeKeys.length)];
}