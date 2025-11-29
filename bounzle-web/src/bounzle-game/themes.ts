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

// Color variation utilities
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(x => {
    const hex = Math.round(Math.max(0, Math.min(255, x))).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return { h: h * 360, s, l };
}

function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  h /= 360;
  let r: number, g: number, b: number;

  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255),
  };
}

/**
 * Generate a color variation within ±15% of the base color
 * @param baseColor Hex color string (e.g., '#3b82f6')
 * @param seed Optional seed for consistent variations (use obstacle position or index)
 * @returns A new hex color string with variation
 */
export function generateColorVariation(baseColor: string, seed?: number): string {
  const rgb = hexToRgb(baseColor);
  if (!rgb) return baseColor;

  // Use seed for consistent variation, or random if not provided
  const random = seed !== undefined 
    ? (() => {
        // Simple seeded random function
        let value = seed;
        return () => {
          value = (value * 9301 + 49297) % 233280;
          return value / 233280;
        };
      })()
    : Math.random;

  // Convert to HSL for easier manipulation
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);

  // Apply ±15% variation to hue, saturation, and lightness
  const hueVariation = (random() - 0.5) * 0.15 * 360; // ±15% of 360 degrees
  const satVariation = (random() - 0.5) * 0.15; // ±15%
  const lightVariation = (random() - 0.5) * 0.15; // ±15%

  const newH = (hsl.h + hueVariation) % 360;
  const newS = Math.max(0, Math.min(1, hsl.s + satVariation));
  const newL = Math.max(0, Math.min(1, hsl.l + lightVariation));

  const newRgb = hslToRgb(newH, newS, newL);
  return rgbToHex(newRgb.r, newRgb.g, newRgb.b);
}