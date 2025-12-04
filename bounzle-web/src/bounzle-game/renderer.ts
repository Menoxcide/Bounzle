// Canvas rendering
import { Theme, getTheme, generateColorVariation } from './themes';
import { Ball, Obstacle, BackgroundLayer, BackgroundElement, BackgroundElementType, PowerUp } from './types';
import { getBackgroundThemeForLevel, getBackgroundThemeConfig, BackgroundTheme, BackgroundThemeConfig } from './backgroundThemes';

// LRU Cache implementation for performance optimization
class LRUCache<K, V> {
  private cache: Map<K, V>;
  private maxSize: number;
  
  constructor(maxSize: number = 50) {
    this.maxSize = maxSize;
    this.cache = new Map();
  }
  
  get(key: K): V | undefined {
    if (!this.cache.has(key)) {
      return undefined;
    }
    // Move to end (most recently used)
    const value = this.cache.get(key)!;
    this.cache.delete(key);
    this.cache.set(key, value);
    return value;
  }
  
  set(key: K, value: V): void {
    if (this.cache.has(key)) {
      // Update existing - move to end
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      // Remove least recently used (first item)
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }
    this.cache.set(key, value);
  }
  
  has(key: K): boolean {
    return this.cache.has(key);
  }
  
  clear(): void {
    this.cache.clear();
  }
  
  get size(): number {
    return this.cache.size;
  }
}

export class Renderer {
  private canvas: HTMLCanvasElement;
  public ctx: CanvasRenderingContext2D;
  private currentTheme: Theme;
  private backgroundLayers: BackgroundLayer[] = [];
  private scrollOffset: number = 0;
  private currentLevel: number = 1;
  private currentBackgroundTheme: BackgroundTheme = 'space';
  private seededRandom: (() => number) | null = null;
  
  // Visual effects configuration
  private enableAdvancedEffects: boolean = true;
  private effectIntensity: 'low' | 'medium' | 'high' = 'medium';
  
  // Performance optimization caches with LRU eviction
  private gradientCache: LRUCache<string, CanvasGradient> = new LRUCache(50);
  private patternCache: LRUCache<string, CanvasPattern | null> = new LRUCache(50);
  
  // LOD (Level of Detail) thresholds
  private readonly LOD_DISTANCE_THRESHOLD = 500; // Distance beyond which LOD kicks in
  private readonly LOD_SIZE_MULTIPLIER = 0.5; // Size reduction for LOD elements
  
  // Camera offset for following ball through gaps
  private cameraOffsetY: number = 0;
  
  // World bounds - fixed world space dimensions
  private WORLD_HEIGHT: number = 0; // Will be initialized in constructor
  private WORLD_WIDTH: number = 0; // Will be initialized in constructor
  
  // Level 1 static background elements (stars, circles, polygons)
  private level1StaticElements: Array<{
    type: 'star' | 'circle' | 'polygon';
    x: number;
    y: number;
    size: number;
    color: string;
    opacity: number;
  }> = [];
  
  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Could not get 2D context');
    }
    this.ctx = ctx;
    this.currentTheme = getTheme('normal');
    // Initialize world bounds (10x canvas height for vertical space)
    this.WORLD_HEIGHT = canvas.height * 10;
    this.WORLD_WIDTH = canvas.width * 100; // Large width for horizontal scrolling
    this.initializeBackgroundLayers();
  }
  
  setTheme(themeName: string): void {
    this.currentTheme = getTheme(themeName);
    // Don't regenerate backgrounds here - they're level-based now
  }

  setLevel(level: number): void {
    if (this.currentLevel !== level) {
      const previousTheme = this.currentBackgroundTheme;
      this.currentLevel = level;
      this.currentBackgroundTheme = getBackgroundThemeForLevel(level);
      
      // Add transition effect if theme changed
      if (previousTheme !== this.currentBackgroundTheme && this.enableAdvancedEffects) {
        // Transition particles will be handled in Game.ts
        this.initializeBackgroundLayers();
      } else {
        this.initializeBackgroundLayers();
      }
    }
  }
  
  // Apply color grading based on current biome theme
  applyColorGrading(): void {
    if (!this.enableAdvancedEffects || this.currentLevel === 1) return;
    
    const themeConfig = getBackgroundThemeConfig(this.currentBackgroundTheme);
    const rgb = this.hexToRgb(themeConfig.backgroundColor);
    if (!rgb) return;
    
    // Apply subtle color overlay based on biome
    this.ctx.save();
    this.ctx.globalCompositeOperation = 'overlay';
    this.ctx.globalAlpha = 0.08; // Very subtle
    
    // Create gradient overlay based on biome colors
    const overlayGradient = this.ctx.createLinearGradient(0, 0, 0, this.canvas.height);
    overlayGradient.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.05)`);
    overlayGradient.addColorStop(1, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.12)`);
    
    this.ctx.fillStyle = overlayGradient;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.restore();
  }
  
  setCameraOffsetY(offsetY: number): void {
    this.cameraOffsetY = offsetY;
  }
  
  private initializeBackgroundLayers(): void {
    this.backgroundLayers = [];
    
    // Special handling for Level 1 - create static space-themed background
    if (this.currentLevel === 1) {
      this.generateLevel1StaticBackground();
      return; // Don't create parallax layers for Level 1
    }
    
    // Initialize seeded random for consistent generation per level
    this.initSeededRandom(this.currentLevel);
    
    // Get theme configuration
    const themeConfig = getBackgroundThemeConfig(this.currentBackgroundTheme);
    
    // Generate layers based on theme configuration
    const layerCount = themeConfig.parallaxSpeeds.length;
    for (let i = 0; i < layerCount; i++) {
      const parallaxSpeed = themeConfig.parallaxSpeeds[i];
      // Reduce element counts for performance - use 60% of configured count
      const baseElementCount = themeConfig.elementCounts[i] || 10;
      const elementCount = Math.floor(baseElementCount * 0.6);
      const opacity = 0.3 + (i * 0.1); // Increase opacity for closer layers
      
      // Get element types for this layer based on theme
      const elementTypes = this.getElementTypesForLayer(themeConfig, i);
      
      this.backgroundLayers.push({
        elements: this.generateThemeBackgroundElements(
          elementCount,
          parallaxSpeed,
          elementTypes,
          themeConfig,
          i
        ),
        parallaxSpeed: parallaxSpeed,
        color: themeConfig.colorPalette[i % themeConfig.colorPalette.length],
        opacity: Math.min(1.0, opacity)
      });
    }
  }
  
  // Generate static background elements for Level 1
  private generateLevel1StaticBackground(): void {
    this.level1StaticElements = [];
    this.initSeededRandom(1); // Use seed 1 for Level 1
    
    // Color palette matching the image: red, yellow, purple, teal
    const colors = {
      red: '#e74c3c',
      yellow: '#f39c12',
      purple: '#9b59b6',
      teal: '#1abc9c',
      purpleMuted: '#8b5cf6'
    };
    
    // Generate stars (5-pointed) in yellow, red, purple - reduced count for performance
    const starColors = [colors.yellow, colors.red, colors.purple];
    for (let i = 0; i < 10; i++) { // Reduced from 15 to 10
      const x = this.random() * this.WORLD_WIDTH;
      const y = this.random() * this.WORLD_HEIGHT;
      const size = 15 + this.random() * 25; // 15-40px
      const color = starColors[Math.floor(this.random() * starColors.length)];
      const opacity = 0.4 + this.random() * 0.4; // 0.4-0.8
      
      this.level1StaticElements.push({
        type: 'star',
        x,
        y,
        size,
        color,
        opacity
      });
    }
    
    // Generate circles in purple - reduced count for performance
    for (let i = 0; i < 5; i++) { // Reduced from 8 to 5
      const x = this.random() * this.WORLD_WIDTH;
      const y = this.random() * this.WORLD_HEIGHT;
      const size = 20 + this.random() * 30; // 20-50px
      const opacity = 0.3 + this.random() * 0.3; // 0.3-0.6
      
      this.level1StaticElements.push({
        type: 'circle',
        x,
        y,
        size,
        color: colors.purple,
        opacity
      });
    }
    
    // Generate polygons (irregular shapes) in teal and muted purple - reduced count for performance
    const polygonColors = [colors.teal, colors.purpleMuted];
    for (let i = 0; i < 4; i++) { // Reduced from 6 to 4
      const x = this.random() * this.WORLD_WIDTH;
      const y = this.random() * this.WORLD_HEIGHT;
      const size = 25 + this.random() * 35; // 25-60px
      const color = polygonColors[Math.floor(this.random() * polygonColors.length)];
      const opacity = 0.35 + this.random() * 0.35; // 0.35-0.7
      
      this.level1StaticElements.push({
        type: 'polygon',
        x,
        y,
        size,
        color,
        opacity
      });
    }
  }

  // Initialize seeded random generator for consistent backgrounds
  private initSeededRandom(seed: number): void {
    let value = seed * 9301 + 49297;
    this.seededRandom = () => {
      value = (value * 9301 + 49297) % 233280;
      return value / 233280;
    };
  }

  // Get seeded random value (or regular random if not initialized)
  private random(): number {
    return this.seededRandom ? this.seededRandom() : Math.random();
  }

  // Get element types for a specific layer based on theme
  private getElementTypesForLayer(themeConfig: BackgroundThemeConfig, layerIndex: number): BackgroundElementType[] {
    const allTypes = themeConfig.elementTypes as BackgroundElementType[];
    const layerCount = themeConfig.parallaxSpeeds.length;
    
    // Distribute element types across layers
    // Far layers get more atmospheric elements, near layers get more detailed elements
    if (layerIndex === 0) {
      // Far layer - atmospheric elements
      return allTypes.filter(t => ['star', 'nebula', 'cloud', 'gradient', 'mountain'].includes(t));
    } else if (layerIndex === layerCount - 1) {
      // Near layer - detailed elements
      return allTypes.filter(t => ['bubble', 'leaf', 'window', 'light', 'coral', 'fish'].includes(t));
    } else {
      // Mid layers - mix of both
      return allTypes;
    }
  }
  
  private getThemeColorForLayer(layerIndex: number): string {
    // Generate theme-appropriate colors for each layer
    const baseColor = this.currentTheme.backgroundColor;
    const rgb = this.hexToRgb(baseColor);
    if (!rgb) return baseColor;
    
    // Darken or lighten based on layer (farther = darker/lighter depending on theme)
    const factor = layerIndex * 0.1;
    const r = Math.max(0, Math.min(255, rgb.r + (this.currentTheme.name === 'normal' ? factor * 20 : -factor * 20)));
    const g = Math.max(0, Math.min(255, rgb.g + (this.currentTheme.name === 'normal' ? factor * 20 : -factor * 20)));
    const b = Math.max(0, Math.min(255, rgb.b + (this.currentTheme.name === 'normal' ? factor * 20 : -factor * 20)));
    
    return this.rgbToHex(r, g, b);
  }
  
  private hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16),
        }
      : null;
  }
  
  private rgbToHex(r: number, g: number, b: number): string {
    return '#' + [r, g, b].map(x => {
      const hex = Math.round(Math.max(0, Math.min(255, x))).toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    }).join('');
  }
  
  // Visual effects helper methods
  private drawGlowAura(x: number, y: number, size: number, color: string, intensity: 'soft' | 'intense' | 'pulsing' = 'soft', pulsePhase: number = 0): void {
    if (!this.enableAdvancedEffects) return;
    
    // Validate size to prevent errors
    if (!size || size <= 0) return;
    
    const rgb = this.hexToRgb(color);
    if (!rgb) return;
    
    // Adjust intensity based on configuration
    let baseIntensity = 1.0;
    if (this.effectIntensity === 'low') baseIntensity = 0.5;
    else if (this.effectIntensity === 'high') baseIntensity = 1.5;
    
    // Pulse effect
    let pulseMultiplier = 1.0;
    if (intensity === 'pulsing') {
      pulseMultiplier = 0.7 + 0.3 * Math.sin(pulsePhase);
    }
    
    const glowSize = size * (intensity === 'intense' ? 2.5 : 1.8) * baseIntensity * pulseMultiplier;
    
    // Ensure glowSize is positive
    if (glowSize <= 0) return;
    
    const layers = intensity === 'intense' ? 5 : 3;
    
    this.ctx.save();
    for (let i = layers; i > 0; i--) {
      const layerSize = glowSize * (i / layers);
      
      // Ensure layerSize is positive before creating gradient
      if (layerSize <= 0) continue;
      
      const layerOpacity = (0.3 / layers) * baseIntensity * pulseMultiplier * (1 - (i - 1) / layers);
      
      const gradient = this.ctx.createRadialGradient(x, y, 0, x, y, layerSize);
      gradient.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${layerOpacity})`);
      gradient.addColorStop(0.5, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${layerOpacity * 0.5})`);
      gradient.addColorStop(1, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0)`);
      
      this.ctx.fillStyle = gradient;
      this.ctx.beginPath();
      this.ctx.arc(x, y, layerSize, 0, Math.PI * 2);
      this.ctx.fill();
    }
    this.ctx.restore();
  }
  
  private drawGlassmorphism(x: number, y: number, width: number, height: number, baseColor: string, intensity: number = 0.3): void {
    if (!this.enableAdvancedEffects) return;
    
    const rgb = this.hexToRgb(baseColor);
    if (!rgb) return;
    
    this.ctx.save();
    
    // Glass overlay - semi-transparent white/light
    const glassOpacity = intensity * (this.effectIntensity === 'low' ? 0.15 : this.effectIntensity === 'high' ? 0.4 : 0.25);
    this.ctx.fillStyle = `rgba(255, 255, 255, ${glassOpacity})`;
    this.ctx.fillRect(x, y, width, height);
    
    // Top and left edge highlights
    const highlightWidth = Math.min(3, width * 0.05);
    const highlightHeight = Math.min(3, height * 0.05);
    
    const topGradient = this.ctx.createLinearGradient(x, y, x, y + highlightHeight);
    topGradient.addColorStop(0, 'rgba(255, 255, 255, 0.6)');
    topGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    this.ctx.fillStyle = topGradient;
    this.ctx.fillRect(x, y, width, highlightHeight);
    
    const leftGradient = this.ctx.createLinearGradient(x, y, x + highlightWidth, y);
    leftGradient.addColorStop(0, 'rgba(255, 255, 255, 0.6)');
    leftGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    this.ctx.fillStyle = leftGradient;
    this.ctx.fillRect(x, y, highlightWidth, height);
    
    // Subtle inner shadow for depth
    const shadowGradient = this.ctx.createLinearGradient(x, y, x, y + height);
    shadowGradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
    shadowGradient.addColorStop(1, `rgba(${Math.max(0, rgb.r - 40)}, ${Math.max(0, rgb.g - 40)}, ${Math.max(0, rgb.b - 40)}, 0.2)`);
    this.ctx.fillStyle = shadowGradient;
    this.ctx.fillRect(x, y, width, height);
    
    this.ctx.restore();
  }
  
  private drawTrail(positions: Array<{ x: number; y: number }>, color: string, maxLength: number = 10): void {
    if (!this.enableAdvancedEffects || positions.length < 2) return;
    
    const rgb = this.hexToRgb(color);
    if (!rgb) return;
    
    const trailLength = Math.min(positions.length, maxLength);
    const startIndex = Math.max(0, positions.length - trailLength);
    
    this.ctx.save();
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    
    for (let i = startIndex; i < positions.length - 1; i++) {
      const progress = (i - startIndex) / trailLength;
      const opacity = progress * 0.6; // Fade from current to past
      const lineWidth = 3 * (1 - progress * 0.7); // Thinner as it fades
      
      this.ctx.strokeStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity})`;
      this.ctx.lineWidth = lineWidth;
      
      this.ctx.beginPath();
      this.ctx.moveTo(positions[i].x, positions[i].y);
      this.ctx.lineTo(positions[i + 1].x, positions[i + 1].y);
      this.ctx.stroke();
    }
    
    this.ctx.restore();
  }
  
  private drawSparkles(x: number, y: number, count: number, color: string): void {
    if (!this.enableAdvancedEffects || this.effectIntensity === 'low') return;
    
    const rgb = this.hexToRgb(color);
    if (!rgb) return;
    
    this.ctx.save();
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const distance = 5 + Math.random() * 10;
      const sparkleX = x + Math.cos(angle) * distance;
      const sparkleY = y + Math.sin(angle) * distance;
      const size = 1 + Math.random() * 2;
      
      this.ctx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${0.6 + Math.random() * 0.4})`;
      this.ctx.beginPath();
      this.ctx.arc(sparkleX, sparkleY, size, 0, Math.PI * 2);
      this.ctx.fill();
    }
    this.ctx.restore();
  }
  
  private drawLightRays(x: number, y: number, size: number, color: string, count: number = 4): void {
    if (!this.enableAdvancedEffects || this.effectIntensity === 'low') return;
    
    const rgb = this.hexToRgb(color);
    if (!rgb) return;
    
    this.ctx.save();
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const rayLength = size * 1.5;
      const rayWidth = size * 0.1;
      
      const gradient = this.ctx.createLinearGradient(
        x, y,
        x + Math.cos(angle) * rayLength,
        y + Math.sin(angle) * rayLength
      );
      gradient.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.4)`);
      gradient.addColorStop(0.5, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.2)`);
      gradient.addColorStop(1, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0)`);
      
      this.ctx.strokeStyle = gradient;
      this.ctx.lineWidth = rayWidth;
      this.ctx.beginPath();
      this.ctx.moveTo(x, y);
      this.ctx.lineTo(x + Math.cos(angle) * rayLength, y + Math.sin(angle) * rayLength);
      this.ctx.stroke();
    }
    this.ctx.restore();
  }
  
  private drawColorBleed(x: number, y: number, width: number, height: number, color: string, intensity: number = 0.15): void {
    if (!this.enableAdvancedEffects || this.effectIntensity === 'low') return;
    
    const rgb = this.hexToRgb(color);
    if (!rgb) return;
    
    const bleedSize = 8 * (this.effectIntensity === 'high' ? 1.5 : 1.0);
    
    this.ctx.save();
    
    // Top edge bleed
    const topGradient = this.ctx.createLinearGradient(x, y - bleedSize, x, y);
    topGradient.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0)`);
    topGradient.addColorStop(1, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${intensity})`);
    this.ctx.fillStyle = topGradient;
    this.ctx.fillRect(x, y - bleedSize, width, bleedSize);
    
    // Bottom edge bleed
    const bottomGradient = this.ctx.createLinearGradient(x, y + height, x, y + height + bleedSize);
    bottomGradient.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${intensity})`);
    bottomGradient.addColorStop(1, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0)`);
    this.ctx.fillStyle = bottomGradient;
    this.ctx.fillRect(x, y + height, width, bleedSize);
    
    // Left edge bleed
    const leftGradient = this.ctx.createLinearGradient(x - bleedSize, y, x, y);
    leftGradient.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0)`);
    leftGradient.addColorStop(1, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${intensity})`);
    this.ctx.fillStyle = leftGradient;
    this.ctx.fillRect(x - bleedSize, y, bleedSize, height);
    
    // Right edge bleed
    const rightGradient = this.ctx.createLinearGradient(x + width, y, x + width + bleedSize, y);
    rightGradient.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${intensity})`);
    rightGradient.addColorStop(1, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0)`);
    this.ctx.fillStyle = rightGradient;
    this.ctx.fillRect(x + width, y, bleedSize, height);
    
    this.ctx.restore();
  }
  
  private generateThemeBackgroundElements(
    count: number,
    parallaxSpeed: number,
    allowedTypes: BackgroundElementType[],
    themeConfig: BackgroundThemeConfig,
    layerIndex: number
  ): BackgroundElement[] {
    const elements: BackgroundElement[] = [];
    
    // Filter allowed types to only include types that exist in theme
    const validTypes = allowedTypes.filter(t => themeConfig.elementTypes.includes(t));
    if (validTypes.length === 0) {
      // Fallback to basic types if no valid types
      validTypes.push('circle', 'star', 'gradient');
    }
    
    for (let i = 0; i < count; i++) {
      const typeIndex = Math.floor(this.random() * validTypes.length);
      const type = validTypes[typeIndex];
      // Use world space coordinates - spread across world width and height
      const x = this.random() * this.WORLD_WIDTH;
      const y = this.random() * this.WORLD_HEIGHT;
      
      // Size varies by element type and layer
      let size = 20 + this.random() * 80;
      if (layerIndex === 0) {
        size *= 1.5; // Far elements are larger
      } else if (layerIndex === themeConfig.parallaxSpeeds.length - 1) {
        size *= 0.7; // Near elements are smaller
      }
      
      const opacity = 0.2 + this.random() * 0.4;
      const colorIndex = Math.floor(this.random() * themeConfig.colorPalette.length);
      const color = themeConfig.colorPalette[colorIndex];
      
      elements.push({
        type,
        x,
        y,
        size,
        opacity,
        parallaxSpeed,
        color: color,
        rotation: this.random() * 360,
        variant: Math.floor(this.random() * 3) // 0-2 variants
      });
    }
    
    return elements;
  }

  // Legacy method for backward compatibility
  private generateBackgroundElements(
    count: number, 
    parallaxSpeed: number, 
    allowedTypes: BackgroundElementType[]
  ): BackgroundElement[] {
    const elements: BackgroundElement[] = [];
    
    for (let i = 0; i < count; i++) {
      const type = allowedTypes[Math.floor(this.random() * allowedTypes.length)];
      const x = this.random() * this.canvas.width * 2;
      const y = this.random() * this.canvas.height;
      const size = 20 + this.random() * 80;
      const opacity = 0.2 + this.random() * 0.4;
      
      elements.push({
        type,
        x,
        y,
        size,
        opacity,
        parallaxSpeed,
        color: undefined
      });
    }
    
    return elements;
  }
  
  updateBackground(scrollSpeed: number, deltaTime: number): void {
    // Background elements are now in world space - they don't scroll horizontally
    // The camera/viewport moves through the world space instead
    // For hybrid approach: far parallax layers (parallaxSpeed < 0.3) can scroll for depth effect
    
    // Update Level 1 static elements - keep in world space, no scrolling
    // Elements stay at their world positions, camera moves through them
    if (this.currentLevel === 1 && this.level1StaticElements.length > 0) {
      // Level 1 elements are static in world space - no updates needed
      // They will be rendered based on camera position
    }
    
    // Update background layers - hybrid approach:
    // - Far layers (parallaxSpeed < 0.3): can scroll for depth parallax effect
    // - Near layers (parallaxSpeed >= 0.3): static in world space
    for (const layer of this.backgroundLayers) {
      for (const element of layer.elements) {
        // Only scroll far parallax layers for depth effect
        if (element.parallaxSpeed < 0.3) {
          // Far layers scroll slowly for parallax depth
          element.x -= scrollSpeed * deltaTime * element.parallaxSpeed;
          
          // If element scrolls off-screen to the left, regenerate it on the right
          if (element.x + element.size < 0) {
            element.x = this.WORLD_WIDTH + this.random() * this.canvas.width;
            element.y = this.random() * this.WORLD_HEIGHT;
            // Occasionally change size and opacity for variety
            if (this.random() < 0.3) {
              element.size = 20 + this.random() * 80;
              element.opacity = 0.2 + this.random() * 0.4;
            }
          }
        }
        // Near layers (parallaxSpeed >= 0.3) stay static in world space
        // Camera moves through them, they don't scroll
      }
    }
  }
  
  private drawBackgroundElement(element: BackgroundElement, layer: BackgroundLayer): void {
    // Validate element size to prevent rendering errors
    if (!element.size || element.size <= 0) {
      return;
    }
    
    // Check if element is visible in viewport (accounting for camera offset)
    // Element positions are in world space, camera offset is applied in Game.ts render()
    // So we check if element would be visible after camera transform
    const elementScreenX = element.x; // X is in world space, camera doesn't affect X
    const elementScreenY = element.y - this.cameraOffsetY; // Y is affected by camera offset
    
    // Calculate distance from viewport center for LOD
    const viewportCenterX = this.canvas.width / 2;
    const viewportCenterY = this.canvas.height / 2;
    const distanceFromCenter = Math.sqrt(
      Math.pow(elementScreenX - viewportCenterX, 2) + 
      Math.pow(elementScreenY - viewportCenterY, 2)
    );
    
    // Apply LOD - reduce size and effects for distant elements
    let effectiveSize = element.size;
    let useLOD = false;
    if (distanceFromCenter > this.LOD_DISTANCE_THRESHOLD) {
      effectiveSize = element.size * this.LOD_SIZE_MULTIPLIER;
      useLOD = true;
    }
    
    // Only draw if element is within viewport bounds (with buffer for off-screen elements)
    const buffer = effectiveSize * 2; // Buffer to draw slightly off-screen elements
    if (elementScreenX + effectiveSize + buffer < 0 || 
        elementScreenX - buffer > this.canvas.width ||
        elementScreenY + effectiveSize + buffer < 0 || 
        elementScreenY - buffer > this.canvas.height) {
      return; // Element is outside viewport
    }
    
    // Skip advanced effects for LOD elements
    if (useLOD && this.effectIntensity === 'low') {
      // Skip rendering entirely for very distant low-intensity elements
      if (distanceFromCenter > this.LOD_DISTANCE_THRESHOLD * 1.5) {
        return;
      }
    }
    
    this.ctx.save();
    
    // Reduce opacity for LOD elements
    const lodOpacityMultiplier = useLOD ? 0.6 : 1.0;
    this.ctx.globalAlpha = element.opacity * layer.opacity * lodOpacityMultiplier;
    const color = element.color || layer.color;
    
    // Convert world coordinates to screen coordinates (account for camera offset)
    // Background is drawn before camera transform, so we apply offset manually
    const screenX = elementScreenX;
    const screenY = elementScreenY;
    
    // Apply rotation if element has it (use screen coordinates)
    if (element.rotation !== undefined && !useLOD) {
      this.ctx.translate(screenX, screenY);
      this.ctx.rotate(element.rotation * Math.PI / 180);
      this.ctx.translate(-screenX, -screenY);
    }
    
    // Add glow effects before drawing elements (skip for LOD)
    const time = Date.now() / 1000; // For pulsing effects
    const pulsePhase = time * 2 + element.x * 0.01; // Unique phase per element
    
    // Use effective size for rendering
    // Use effective size for rendering (don't modify element)
    const renderSize = effectiveSize;
    
    switch (element.type) {
      case 'cloud':
        this.drawCloud(screenX, screenY, renderSize, color);
        break;
      case 'circle':
        this.drawCircle(screenX, screenY, renderSize, color);
        // Add subtle glow to circles (skip for LOD)
        if (!useLOD) {
          this.drawGlowAura(screenX, screenY, renderSize, color, 'soft');
        }
        break;
      case 'triangle':
        this.drawTriangle(screenX, screenY, renderSize, color);
        break;
      case 'star':
        // Draw glow first, then star (skip glow for LOD)
        if (!useLOD) {
          this.drawGlowAura(screenX, screenY, renderSize, color, 'intense');
        }
        this.drawStar(screenX, screenY, renderSize, color);
        // Add sparkles around bright stars (skip for LOD)
        if (!useLOD && this.effectIntensity !== 'low') {
          this.drawSparkles(screenX, screenY, 4, color);
        }
        break;
      case 'gradient':
        this.drawGradientCircle(screenX, screenY, renderSize, color);
        // Add outer glow (skip for LOD)
        if (!useLOD) {
          this.drawGlowAura(screenX, screenY, renderSize, color, 'soft');
        }
        break;
      case 'planet':
        // Draw outer glow aura first (skip for LOD)
        if (!useLOD) {
          this.drawGlowAura(screenX, screenY, renderSize, color, 'soft');
        }
        this.drawPlanet(screenX, screenY, renderSize, color, element.variant || 0);
        break;
      case 'nebula':
        // Draw soft outer glow that extends beyond nebula (skip for LOD)
        if (!useLOD) {
          this.drawGlowAura(screenX, screenY, renderSize * 1.5, color, 'soft');
        }
        this.drawNebula(screenX, screenY, renderSize, color);
        break;
      case 'asteroid':
        this.drawAsteroid(screenX, screenY, renderSize, color);
        break;
      case 'bubble':
        // Draw inner and outer glow for depth (skip for LOD)
        if (!useLOD) {
          this.drawGlowAura(screenX, screenY, renderSize, color, 'soft');
        }
        this.drawBubble(screenX, screenY, renderSize, color);
        break;
      case 'coral':
        this.drawCoral(screenX, screenY, renderSize, color, element.variant || 0);
        break;
      case 'seaweed':
        this.drawSeaweed(screenX, screenY, renderSize, color);
        break;
      case 'fish':
        this.drawFish(screenX, screenY, renderSize, color);
        break;
      case 'building':
        this.drawBuilding(screenX, screenY, renderSize, color, element.variant || 0);
        break;
      case 'window':
        // Draw warm glow from lit windows (skip for LOD)
        if (!useLOD) {
          this.drawGlowAura(screenX, screenY, renderSize, '#ffd700', 'soft');
        }
        this.drawWindow(screenX, screenY, renderSize, color);
        break;
      case 'light':
        // Enhanced glow with pulsing effect (skip for LOD)
        if (!useLOD) {
          this.drawGlowAura(screenX, screenY, renderSize, color, 'pulsing', pulsePhase);
          // Add light rays
          this.drawLightRays(screenX, screenY, renderSize, color, 6);
        }
        this.drawLight(screenX, screenY, renderSize, color);
        break;
      case 'tree':
        this.drawTree(screenX, screenY, renderSize, color);
        break;
      case 'leaf':
        this.drawLeaf(screenX, screenY, renderSize, color);
        break;
      case 'branch':
        this.drawBranch(screenX, screenY, renderSize, color);
        break;
      case 'mountain':
        this.drawMountain(screenX, screenY, renderSize, color);
        break;
      case 'grid':
        this.drawGrid(screenX, screenY, renderSize, color);
        break;
      case 'pattern':
        this.drawPattern(screenX, screenY, renderSize, color, element.variant || 0);
        break;
      case 'isometric':
      case 'cube':
        this.drawIsometricCube(screenX, screenY, renderSize, color);
        break;
      case 'pyramid':
        this.drawIsometricPyramid(screenX, screenY, renderSize, color);
        break;
      // Desert biome elements
      case 'sanddune':
        this.drawSandDune(screenX, screenY, renderSize, color);
        break;
      case 'cactus':
        this.drawCactus(screenX, screenY, renderSize, color, element.variant || 0);
        break;
      case 'mirage':
        this.drawMirage(screenX, screenY, renderSize, color);
        break;
      case 'sunray':
        if (!useLOD) {
          this.drawSunRay(screenX, screenY, renderSize, color);
        }
        break;
      // Arctic biome elements
      case 'icecrystal':
        this.drawIceCrystal(screenX, screenY, renderSize, color);
        break;
      case 'aurora':
        if (!useLOD) {
          this.drawAurora(screenX, screenY, renderSize, color);
        }
        break;
      case 'snowflake':
        this.drawSnowflake(screenX, screenY, renderSize, color);
        break;
      case 'glacier':
        this.drawGlacier(screenX, screenY, renderSize, color);
        break;
      // Volcanic biome elements
      case 'lavaflow':
        this.drawLavaFlow(screenX, screenY, renderSize, color);
        break;
      case 'ember':
        if (!useLOD) {
          this.drawGlowAura(screenX, screenY, renderSize, color, 'pulsing', pulsePhase);
        }
        this.drawEmber(screenX, screenY, renderSize, color);
        break;
      case 'smoke':
        this.drawSmoke(screenX, screenY, renderSize, color);
        break;
      case 'magmabubble':
        this.drawMagmaBubble(screenX, screenY, renderSize, color);
        break;
      // Cyberpunk biome elements
      case 'neonsign':
        if (!useLOD) {
          this.drawGlowAura(screenX, screenY, renderSize, color, 'intense');
        }
        this.drawNeonSign(screenX, screenY, renderSize, color);
        break;
      case 'hologram':
        this.drawHologram(screenX, screenY, renderSize, color);
        break;
      case 'digitalrain':
        this.drawDigitalRain(screenX, screenY, renderSize, color);
        break;
      case 'gridline':
        this.drawGridLine(screenX, screenY, renderSize, color);
        break;
      // Candy Land biome elements
      case 'gumdrop':
        this.drawGumdrop(screenX, screenY, renderSize, color);
        break;
      case 'lollipop':
        this.drawLollipop(screenX, screenY, renderSize, color);
        break;
      case 'candycane':
        this.drawCandyCane(screenX, screenY, renderSize, color);
        break;
      case 'sprinkle':
        this.drawSprinkle(screenX, screenY, renderSize, color);
        break;
      // Underwater Cave biome elements
      case 'bioluminescence':
        if (!useLOD) {
          this.drawGlowAura(screenX, screenY, renderSize, color, 'pulsing', pulsePhase);
        }
        this.drawBioluminescence(screenX, screenY, renderSize, color);
        break;
      case 'stalactite':
        this.drawStalactite(screenX, screenY, renderSize, color);
        break;
      // Crystal Cavern biome elements
      case 'gemstone':
        if (!useLOD) {
          this.drawGlowAura(screenX, screenY, renderSize, color, 'intense');
        }
        this.drawGemstone(screenX, screenY, renderSize, color);
        break;
      case 'lightrefraction':
        if (!useLOD) {
          this.drawLightRefraction(screenX, screenY, renderSize, color);
        }
        break;
      case 'crystalformation':
        this.drawCrystalFormation(screenX, screenY, renderSize, color, element.variant || 0);
        break;
      case 'sparkle':
        if (!useLOD) {
          this.drawSparkles(screenX, screenY, 3, color);
        }
        break;
      // Mushroom Forest biome elements
      case 'mushroom':
        this.drawMushroom(screenX, screenY, renderSize, color, element.variant || 0);
        break;
      case 'spore':
        this.drawSpore(screenX, screenY, renderSize, color);
        break;
      case 'glowingcap':
        if (!useLOD) {
          this.drawGlowAura(screenX, screenY, renderSize, color, 'pulsing', pulsePhase);
        }
        this.drawGlowingCap(screenX, screenY, renderSize, color);
        break;
      case 'mycelium':
        this.drawMycelium(screenX, screenY, renderSize, color);
        break;
      // Cloud Kingdom biome elements
      case 'rainbow':
        if (!useLOD) {
          this.drawRainbow(screenX, screenY, renderSize);
        }
        break;
      case 'lightning':
        if (!useLOD) {
          this.drawLightning(screenX, screenY, renderSize, color);
        }
        break;
      case 'skypalace':
        this.drawSkyPalace(screenX, screenY, renderSize, color);
        break;
      // Neon City biome elements
      case 'skyscraper':
        this.drawSkyscraper(screenX, screenY, renderSize, color, element.variant || 0);
        break;
      case 'trafficlight':
        this.drawTrafficLight(screenX, screenY, renderSize, color);
        break;
      case 'billboard':
        this.drawBillboard(screenX, screenY, renderSize, color);
        break;
      // Jungle biome elements
      case 'vine':
        this.drawVine(screenX, screenY, renderSize, color);
        break;
      case 'tropicalflower':
        this.drawTropicalFlower(screenX, screenY, renderSize, color);
        break;
      case 'waterfall':
        this.drawWaterfall(screenX, screenY, renderSize, color);
        break;
      case 'exoticbird':
        this.drawExoticBird(screenX, screenY, renderSize, color);
        break;
      // Graveyard biome elements
      case 'tombstone':
        this.drawTombstone(screenX, screenY, renderSize, color);
        break;
      case 'mist':
        this.drawMist(screenX, screenY, renderSize, color);
        break;
      case 'ghost':
        if (!useLOD) {
          this.drawGlowAura(screenX, screenY, renderSize, '#ffffff', 'soft');
        }
        this.drawGhost(screenX, screenY, renderSize, color);
        break;
      case 'moonlight':
        if (!useLOD) {
          this.drawMoonlight(screenX, screenY, renderSize, color);
        }
        break;
      // Ocean Depths biome elements
      case 'deepseacreature':
        this.drawDeepSeaCreature(screenX, screenY, renderSize, color);
        break;
      case 'kelpforest':
        this.drawKelpForest(screenX, screenY, renderSize, color);
        break;
      case 'bioluminescentfish':
        if (!useLOD) {
          this.drawGlowAura(screenX, screenY, renderSize, color, 'pulsing', pulsePhase);
        }
        this.drawBioluminescentFish(screenX, screenY, renderSize, color);
        break;
      // Sunset Beach biome elements
      case 'palmtree':
        this.drawPalmTree(screenX, screenY, renderSize, color);
        break;
      case 'wave':
        this.drawWave(screenX, screenY, renderSize, color);
        break;
      case 'seagull':
        this.drawSeagull(screenX, screenY, renderSize, color);
        break;
      case 'sunsetgradient':
        if (!useLOD) {
          this.drawSunsetGradient(screenX, screenY, renderSize);
        }
        break;
      // Magical Forest biome elements
      case 'fairylight':
        if (!useLOD) {
          this.drawGlowAura(screenX, screenY, renderSize, color, 'pulsing', pulsePhase);
        }
        this.drawFairyLight(screenX, screenY, renderSize, color);
        break;
      case 'enchantedtree':
        this.drawEnchantedTree(screenX, screenY, renderSize, color);
        break;
      case 'firefly':
        if (!useLOD) {
          this.drawGlowAura(screenX, screenY, renderSize, color, 'pulsing', pulsePhase);
        }
        this.drawFirefly(screenX, screenY, renderSize, color);
        break;
      case 'magicorb':
        if (!useLOD) {
          this.drawGlowAura(screenX, screenY, renderSize, color, 'intense');
        }
        this.drawMagicOrb(screenX, screenY, renderSize, color);
        break;
      // Industrial biome elements
      case 'gear':
        this.drawGear(screenX, screenY, renderSize, color);
        break;
      case 'steam':
        this.drawSteam(screenX, screenY, renderSize, color);
        break;
      case 'factory':
        this.drawFactory(screenX, screenY, renderSize, color);
        break;
      // Retro Arcade biome elements
      case 'pixelart':
        this.drawPixelArt(screenX, screenY, renderSize, color);
        break;
      case 'eightbitpattern':
        this.drawEightBitPattern(screenX, screenY, renderSize, color);
        break;
      case 'arcade':
        this.drawArcade(screenX, screenY, renderSize, color);
        break;
      case 'pixelstar':
        this.drawPixelStar(screenX, screenY, renderSize, color);
        break;
    }
    
    this.ctx.restore();
  }
  
  private drawCloud(x: number, y: number, size: number, color: string): void {
    this.ctx.fillStyle = color;
    const cloudSize = size * 0.3;
    
    // Draw multiple overlapping circles to create cloud shape
    for (let i = 0; i < 5; i++) {
      const offsetX = (i - 2) * cloudSize * 0.6;
      const offsetY = (i % 2 === 0 ? -cloudSize * 0.2 : cloudSize * 0.2);
      this.ctx.beginPath();
      this.ctx.arc(x + offsetX, y + offsetY, cloudSize, 0, Math.PI * 2);
      this.ctx.fill();
    }
  }
  
  private drawCircle(x: number, y: number, size: number, color: string): void {
    this.ctx.fillStyle = color;
    this.ctx.beginPath();
    this.ctx.arc(x, y, size / 2, 0, Math.PI * 2);
    this.ctx.fill();
  }
  
  private drawTriangle(x: number, y: number, size: number, color: string): void {
    this.ctx.fillStyle = color;
    this.ctx.beginPath();
    this.ctx.moveTo(x, y - size / 2);
    this.ctx.lineTo(x - size / 2, y + size / 2);
    this.ctx.lineTo(x + size / 2, y + size / 2);
    this.ctx.closePath();
    this.ctx.fill();
  }
  
  private drawStar(x: number, y: number, size: number, color: string): void {
    this.ctx.fillStyle = color;
    this.ctx.beginPath();
    const spikes = 5;
    const outerRadius = size / 2;
    const innerRadius = outerRadius * 0.4;
    
    for (let i = 0; i < spikes * 2; i++) {
      const radius = i % 2 === 0 ? outerRadius : innerRadius;
      const angle = (i * Math.PI) / spikes;
      const px = x + Math.cos(angle) * radius;
      const py = y + Math.sin(angle) * radius;
      
      if (i === 0) {
        this.ctx.moveTo(px, py);
      } else {
        this.ctx.lineTo(px, py);
      }
    }
    this.ctx.closePath();
    this.ctx.fill();
  }
  
  private drawGradientCircle(x: number, y: number, size: number, color: string): void {
    const gradient = this.ctx.createRadialGradient(x, y, 0, x, y, size / 2);
    const rgb = this.hexToRgb(color);
    if (rgb) {
      gradient.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.8)`);
      gradient.addColorStop(1, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0)`);
    }
    this.ctx.fillStyle = gradient;
    this.ctx.beginPath();
    this.ctx.arc(x, y, size / 2, 0, Math.PI * 2);
    this.ctx.fill();
  }

  // Space theme elements
  private drawPlanet(x: number, y: number, size: number, color: string, variant: number): void {
    const radius = size / 2;
    const rgb = this.hexToRgb(color);
    if (!rgb) return;
    
    // Draw planet with gradient
    const gradient = this.ctx.createRadialGradient(
      x - radius * 0.3, y - radius * 0.3, 0,
      x, y, radius
    );
    gradient.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 1)`);
    gradient.addColorStop(0.7, `rgba(${Math.max(0, rgb.r - 30)}, ${Math.max(0, rgb.g - 30)}, ${Math.max(0, rgb.b - 30)}, 1)`);
    gradient.addColorStop(1, `rgba(${Math.max(0, rgb.r - 60)}, ${Math.max(0, rgb.g - 60)}, ${Math.max(0, rgb.b - 60)}, 1)`);
    
    this.ctx.fillStyle = gradient;
    this.ctx.beginPath();
    this.ctx.arc(x, y, radius, 0, Math.PI * 2);
    this.ctx.fill();
    
    // Add rings for some variants
    if (variant === 1) {
      this.ctx.strokeStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.5)`;
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.ellipse(x, y, radius * 1.5, radius * 0.3, 0, 0, Math.PI * 2);
      this.ctx.stroke();
    }
  }

  private drawNebula(x: number, y: number, size: number, color: string): void {
    const rgb = this.hexToRgb(color);
    if (!rgb) return;
    
    // Validate size to prevent errors
    if (!size || size <= 0) return;
    
    // Use position as seed for deterministic randomness
    let seed = Math.floor(x * 1000 + y);
    
    // Draw multiple overlapping circles for nebula effect
    for (let i = 0; i < 5; i++) {
      seed = (seed * 9301 + 49297) % 233280;
      const r1 = seed / 233280;
      seed = (seed * 9301 + 49297) % 233280;
      const r2 = seed / 233280;
      seed = (seed * 9301 + 49297) % 233280;
      const r3 = seed / 233280;
      
      const offsetX = (r1 - 0.5) * size * 0.6;
      const offsetY = (r2 - 0.5) * size * 0.6;
      const nebulaSize = size * (0.3 + r3 * 0.4);
      
      // Ensure nebulaSize is positive and has a minimum value
      const radius = Math.max(nebulaSize / 2, 1);
      
      // Validate that radius is valid for createRadialGradient
      if (radius <= 0) continue;
      
      const gradient = this.ctx.createRadialGradient(
        x + offsetX, y + offsetY, 0,
        x + offsetX, y + offsetY, radius
      );
      gradient.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.6)`);
      gradient.addColorStop(1, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0)`);
      
      this.ctx.fillStyle = gradient;
      this.ctx.beginPath();
      this.ctx.arc(x + offsetX, y + offsetY, radius, 0, Math.PI * 2);
      this.ctx.fill();
    }
  }

  private drawAsteroid(x: number, y: number, size: number, color: string): void {
    const radius = size / 2;
    const rgb = this.hexToRgb(color);
    if (!rgb) return;
    
    // Use position as seed for deterministic randomness
    let seed = Math.floor(x * 1000 + y);
    
    // Draw irregular asteroid shape
    this.ctx.fillStyle = color;
    this.ctx.beginPath();
    const points = 8;
    for (let i = 0; i < points; i++) {
      seed = (seed * 9301 + 49297) % 233280;
      const r = radius * (0.7 + (seed / 233280) * 0.3);
      const angle = (i / points) * Math.PI * 2;
      const px = x + Math.cos(angle) * r;
      const py = y + Math.sin(angle) * r;
      if (i === 0) {
        this.ctx.moveTo(px, py);
      } else {
        this.ctx.lineTo(px, py);
      }
    }
    this.ctx.closePath();
    this.ctx.fill();
  }

  // Underwater theme elements
  private drawBubble(x: number, y: number, size: number, color: string): void {
    const radius = size / 2;
    const rgb = this.hexToRgb(color);
    if (!rgb) return;
    
    // Draw bubble with highlight
    const gradient = this.ctx.createRadialGradient(
      x - radius * 0.3, y - radius * 0.3, 0,
      x, y, radius
    );
    gradient.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.3)`);
    gradient.addColorStop(0.7, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.1)`);
    gradient.addColorStop(1, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0)`);
    
    this.ctx.fillStyle = gradient;
    this.ctx.beginPath();
    this.ctx.arc(x, y, radius, 0, Math.PI * 2);
    this.ctx.fill();
    
    // Add highlight
    this.ctx.fillStyle = `rgba(255, 255, 255, 0.4)`;
    this.ctx.beginPath();
    this.ctx.arc(x - radius * 0.3, y - radius * 0.3, radius * 0.2, 0, Math.PI * 2);
    this.ctx.fill();
    
    // Add outline
    this.ctx.strokeStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.5)`;
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    this.ctx.arc(x, y, radius, 0, Math.PI * 2);
    this.ctx.stroke();
  }

  private drawCoral(x: number, y: number, size: number, color: string, variant: number): void {
    const rgb = this.hexToRgb(color);
    if (!rgb) return;
    
    this.ctx.fillStyle = color;
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = 2;
    
    // Use position as seed for deterministic randomness
    let seed = Math.floor(x * 1000 + y);
    
    // Draw coral branches
    const branchCount = 3 + variant;
    for (let i = 0; i < branchCount; i++) {
      seed = (seed * 9301 + 49297) % 233280;
      const angle = (i / branchCount) * Math.PI * 2;
      const branchLength = size * (0.4 + (seed / 233280) * 0.3);
      const endX = x + Math.cos(angle) * branchLength;
      const endY = y + Math.sin(angle) * branchLength;
      
      this.ctx.beginPath();
      this.ctx.moveTo(x, y);
      this.ctx.lineTo(endX, endY);
      this.ctx.stroke();
      
      // Add small circles at branch ends
      this.ctx.beginPath();
      this.ctx.arc(endX, endY, size * 0.1, 0, Math.PI * 2);
      this.ctx.fill();
    }
  }

  private drawSeaweed(x: number, y: number, size: number, color: string): void {
    const rgb = this.hexToRgb(color);
    if (!rgb) return;
    
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = 3;
    
    // Draw wavy seaweed
    this.ctx.beginPath();
    this.ctx.moveTo(x, y + size);
    for (let i = 0; i < 5; i++) {
      const waveX = x + Math.sin(i * 0.5) * size * 0.2;
      const waveY = y + size - (i * size / 5);
      this.ctx.lineTo(waveX, waveY);
    }
    this.ctx.stroke();
  }

  private drawFish(x: number, y: number, size: number, color: string): void {
    const rgb = this.hexToRgb(color);
    if (!rgb) return;
    
    this.ctx.fillStyle = color;
    
    // Draw simple fish silhouette
    this.ctx.beginPath();
    this.ctx.ellipse(x, y, size * 0.4, size * 0.2, 0, 0, Math.PI * 2);
    this.ctx.fill();
    
    // Add tail
    this.ctx.beginPath();
    this.ctx.moveTo(x - size * 0.4, y);
    this.ctx.lineTo(x - size * 0.6, y - size * 0.15);
    this.ctx.lineTo(x - size * 0.6, y + size * 0.15);
    this.ctx.closePath();
    this.ctx.fill();
  }

  // Cityscape theme elements
  private drawBuilding(x: number, y: number, size: number, color: string, variant: number): void {
    const rgb = this.hexToRgb(color);
    if (!rgb) return;
    
    const width = size * 0.6;
    const height = size * (0.8 + variant * 0.2);
    const baseY = y + size / 2;
    
    // Draw building
    this.ctx.fillStyle = color;
    this.ctx.fillRect(x - width / 2, baseY - height, width, height);
    
    // Add windows
    const windowRows = 3 + variant;
    const windowCols = 2;
    const windowSize = width / (windowCols * 3);
    const windowSpacing = width / windowCols;
    
    this.ctx.fillStyle = this.random() < 0.7 ? '#ffd700' : '#1a1a2e'; // Some windows lit
    for (let row = 0; row < windowRows; row++) {
      for (let col = 0; col < windowCols; col++) {
        const windowX = x - width / 2 + (col + 0.5) * windowSpacing;
        const windowY = baseY - height + (row + 0.5) * (height / windowRows);
        this.ctx.fillRect(windowX - windowSize / 2, windowY - windowSize / 2, windowSize, windowSize);
      }
    }
  }

  private drawWindow(x: number, y: number, size: number, color: string): void {
    const rgb = this.hexToRgb(color);
    if (!rgb) return;
    
    // Use position as seed for deterministic randomness
    const seed = Math.floor(x * 1000 + y);
    const isLit = ((seed * 9301 + 49297) % 233280) / 233280 < 0.6;
    
    // Draw window frame
    this.ctx.fillStyle = color;
    this.ctx.fillRect(x - size / 2, y - size / 2, size, size);
    
    // Draw lit window
    this.ctx.fillStyle = isLit ? '#ffd700' : '#1a1a2e';
    this.ctx.fillRect(x - size / 2 + 2, y - size / 2 + 2, size - 4, size - 4);
  }

  private drawLight(x: number, y: number, size: number, color: string): void {
    const rgb = this.hexToRgb(color);
    if (!rgb) return;
    
    // Draw glowing light
    const gradient = this.ctx.createRadialGradient(x, y, 0, x, y, size / 2);
    gradient.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 1)`);
    gradient.addColorStop(0.5, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.5)`);
    gradient.addColorStop(1, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0)`);
    
    this.ctx.fillStyle = gradient;
    this.ctx.beginPath();
    this.ctx.arc(x, y, size / 2, 0, Math.PI * 2);
    this.ctx.fill();
  }

  // Forest theme elements
  private drawTree(x: number, y: number, size: number, color: string): void {
    const rgb = this.hexToRgb(color);
    if (!rgb) return;
    
    const baseY = y + size / 2;
    
    // Use position as seed for deterministic randomness
    let seed = Math.floor(x * 1000 + y);
    
    // Draw trunk
    this.ctx.fillStyle = `rgba(${Math.max(0, rgb.r - 40)}, ${Math.max(0, rgb.g - 40)}, ${Math.max(0, rgb.b - 40)}, 1)`;
    this.ctx.fillRect(x - size * 0.1, baseY - size * 0.3, size * 0.2, size * 0.3);
    
    // Draw foliage (multiple circles)
    this.ctx.fillStyle = color;
    for (let i = 0; i < 3; i++) {
      seed = (seed * 9301 + 49297) % 233280;
      const r1 = seed / 233280;
      seed = (seed * 9301 + 49297) % 233280;
      const r2 = seed / 233280;
      seed = (seed * 9301 + 49297) % 233280;
      const r3 = seed / 233280;
      
      const offsetX = (r1 - 0.5) * size * 0.3;
      const offsetY = baseY - size * 0.5 + (r2 - 0.5) * size * 0.2;
      const foliageSize = size * (0.3 + r3 * 0.2);
      this.ctx.beginPath();
      this.ctx.arc(x + offsetX, offsetY, foliageSize / 2, 0, Math.PI * 2);
      this.ctx.fill();
    }
  }

  private drawLeaf(x: number, y: number, size: number, color: string): void {
    const rgb = this.hexToRgb(color);
    if (!rgb) return;
    
    this.ctx.fillStyle = color;
    this.ctx.beginPath();
    // Draw simple leaf shape (oval with point)
    this.ctx.ellipse(x, y, size * 0.3, size * 0.15, 0, 0, Math.PI * 2);
    this.ctx.fill();
  }

  private drawBranch(x: number, y: number, size: number, color: string): void {
    const rgb = this.hexToRgb(color);
    if (!rgb) return;
    
    this.ctx.strokeStyle = `rgba(${Math.max(0, rgb.r - 40)}, ${Math.max(0, rgb.g - 40)}, ${Math.max(0, rgb.b - 40)}, 1)`;
    this.ctx.lineWidth = size * 0.1;
    this.ctx.lineCap = 'round';
    
    // Draw branch
    this.ctx.beginPath();
    this.ctx.moveTo(x - size / 2, y);
    this.ctx.lineTo(x + size / 2, y + size * 0.2);
    this.ctx.stroke();
  }

  private drawMountain(x: number, y: number, size: number, color: string): void {
    const rgb = this.hexToRgb(color);
    if (!rgb) return;
    
    const baseY = y + size / 2;
    
    // Draw mountain silhouette
    this.ctx.fillStyle = color;
    this.ctx.beginPath();
    this.ctx.moveTo(x - size / 2, baseY);
    this.ctx.lineTo(x, baseY - size * 0.6);
    this.ctx.lineTo(x + size / 2, baseY);
    this.ctx.closePath();
    this.ctx.fill();
  }

  // Abstract/Geometric theme elements
  private drawGrid(x: number, y: number, size: number, color: string): void {
    const rgb = this.hexToRgb(color);
    if (!rgb) return;
    
    this.ctx.strokeStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.3)`;
    this.ctx.lineWidth = 1;
    
    const gridSize = size / 4;
    for (let i = -2; i <= 2; i++) {
      // Vertical lines
      this.ctx.beginPath();
      this.ctx.moveTo(x + i * gridSize, y - size / 2);
      this.ctx.lineTo(x + i * gridSize, y + size / 2);
      this.ctx.stroke();
      
      // Horizontal lines
      this.ctx.beginPath();
      this.ctx.moveTo(x - size / 2, y + i * gridSize);
      this.ctx.lineTo(x + size / 2, y + i * gridSize);
      this.ctx.stroke();
    }
  }
  
  // Draw grid pattern overlay for Level 1
  private drawGridPattern(): void {
    // Use scroll offset to make grid scroll, creating flying-through-space effect
    const cellSize = Math.min(this.canvas.width, this.canvas.height) / 12; // ~12 cells across
    const gridOffsetX = this.scrollOffset % cellSize; // Offset based on cell size for seamless scrolling
    
    this.ctx.save();
    this.ctx.strokeStyle = 'rgba(200, 200, 200, 0.15)'; // Light grey, subtle
    this.ctx.lineWidth = 1;
    
    // Draw vertical lines with scroll offset
    for (let x = -gridOffsetX; x <= this.canvas.width + cellSize; x += cellSize) {
      this.ctx.beginPath();
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, this.canvas.height);
      this.ctx.stroke();
    }
    
    // Draw horizontal lines (can also scroll vertically if desired, but horizontal scrolling is primary)
    for (let y = 0; y <= this.canvas.height; y += cellSize) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(this.canvas.width, y);
      this.ctx.stroke();
    }
    
    this.ctx.restore();
  }
  
  // Draw irregular polygon for Level 1 background
  private drawIrregularPolygon(x: number, y: number, size: number, color: string): void {
    const rgb = this.hexToRgb(color);
    if (!rgb) return;
    
    // Use position as seed for deterministic randomness
    let seed = Math.floor(x * 1000 + y);
    
    // Generate 5-7 sided irregular polygon
    const sides = 5 + Math.floor((seed % 3)); // 5-7 sides
    seed = (seed * 9301 + 49297) % 233280;
    
    this.ctx.fillStyle = color;
    this.ctx.beginPath();
    
    for (let i = 0; i < sides; i++) {
      seed = (seed * 9301 + 49297) % 233280;
      const r = (size / 2) * (0.6 + (seed / 233280) * 0.4); // Vary radius for irregularity
      const angle = (i / sides) * Math.PI * 2;
      const px = x + Math.cos(angle) * r;
      const py = y + Math.sin(angle) * r;
      
      if (i === 0) {
        this.ctx.moveTo(px, py);
      } else {
        this.ctx.lineTo(px, py);
      }
    }
    
    this.ctx.closePath();
    this.ctx.fill();
  }

  private drawPattern(x: number, y: number, size: number, color: string, variant: number): void {
    const rgb = this.hexToRgb(color);
    if (!rgb) return;
    
    this.ctx.fillStyle = color;
    
    if (variant === 0) {
      // Hexagon pattern
      this.ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2;
        const px = x + Math.cos(angle) * size / 2;
        const py = y + Math.sin(angle) * size / 2;
        if (i === 0) {
          this.ctx.moveTo(px, py);
        } else {
          this.ctx.lineTo(px, py);
        }
      }
      this.ctx.closePath();
      this.ctx.fill();
    } else if (variant === 1) {
      // Diamond pattern
      this.ctx.beginPath();
      this.ctx.moveTo(x, y - size / 2);
      this.ctx.lineTo(x + size / 2, y);
      this.ctx.lineTo(x, y + size / 2);
      this.ctx.lineTo(x - size / 2, y);
      this.ctx.closePath();
      this.ctx.fill();
    } else {
      // Spiral pattern
      this.ctx.strokeStyle = color;
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      for (let i = 0; i < 20; i++) {
        const angle = i * 0.3;
        const radius = (size / 2) * (i / 20);
        const px = x + Math.cos(angle) * radius;
        const py = y + Math.sin(angle) * radius;
        if (i === 0) {
          this.ctx.moveTo(px, py);
        } else {
          this.ctx.lineTo(px, py);
        }
      }
      this.ctx.stroke();
    }
  }

  // Isometric theme elements
  private drawIsometricCube(x: number, y: number, size: number, color: string): void {
    const rgb = this.hexToRgb(color);
    if (!rgb) return;
    
    const s = size / 2;
    const isoOffset = s * 0.5; // Isometric offset
    
    // Draw top face
    this.ctx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.8)`;
    this.ctx.beginPath();
    this.ctx.moveTo(x, y - s);
    this.ctx.lineTo(x + isoOffset, y - s + isoOffset);
    this.ctx.lineTo(x, y);
    this.ctx.lineTo(x - isoOffset, y - isoOffset);
    this.ctx.closePath();
    this.ctx.fill();
    
    // Draw right face
    this.ctx.fillStyle = `rgba(${Math.max(0, rgb.r - 30)}, ${Math.max(0, rgb.g - 30)}, ${Math.max(0, rgb.b - 30)}, 0.8)`;
    this.ctx.beginPath();
    this.ctx.moveTo(x, y);
    this.ctx.lineTo(x + isoOffset, y - s + isoOffset);
    this.ctx.lineTo(x + isoOffset, y + s + isoOffset);
    this.ctx.lineTo(x, y + s);
    this.ctx.closePath();
    this.ctx.fill();
    
    // Draw left face
    this.ctx.fillStyle = `rgba(${Math.max(0, rgb.r - 50)}, ${Math.max(0, rgb.g - 50)}, ${Math.max(0, rgb.b - 50)}, 0.8)`;
    this.ctx.beginPath();
    this.ctx.moveTo(x, y);
    this.ctx.lineTo(x - isoOffset, y - isoOffset);
    this.ctx.lineTo(x - isoOffset, y + s - isoOffset);
    this.ctx.lineTo(x, y + s);
    this.ctx.closePath();
    this.ctx.fill();
  }

  private drawIsometricPyramid(x: number, y: number, size: number, color: string): void {
    const rgb = this.hexToRgb(color);
    if (!rgb) return;
    
    const s = size / 2;
    const isoOffset = s * 0.5;
    
    // Draw pyramid faces
    // Front face
    this.ctx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.8)`;
    this.ctx.beginPath();
    this.ctx.moveTo(x, y - s);
    this.ctx.lineTo(x - isoOffset, y + isoOffset);
    this.ctx.lineTo(x + isoOffset, y + isoOffset);
    this.ctx.closePath();
    this.ctx.fill();
    
    // Right face
    this.ctx.fillStyle = `rgba(${Math.max(0, rgb.r - 30)}, ${Math.max(0, rgb.g - 30)}, ${Math.max(0, rgb.b - 30)}, 0.8)`;
    this.ctx.beginPath();
    this.ctx.moveTo(x, y - s);
    this.ctx.lineTo(x + isoOffset, y + isoOffset);
    this.ctx.lineTo(x, y + s);
    this.ctx.closePath();
    this.ctx.fill();
    
    // Left face
    this.ctx.fillStyle = `rgba(${Math.max(0, rgb.r - 50)}, ${Math.max(0, rgb.g - 50)}, ${Math.max(0, rgb.b - 50)}, 0.8)`;
    this.ctx.beginPath();
    this.ctx.moveTo(x, y - s);
    this.ctx.lineTo(x - isoOffset, y + isoOffset);
    this.ctx.lineTo(x, y + s);
    this.ctx.closePath();
    this.ctx.fill();
  }
  
  // Desert biome drawing functions
  private drawSandDune(x: number, y: number, size: number, color: string): void {
    const rgb = this.hexToRgb(color);
    if (!rgb) return;
    
    const gradient = this.ctx.createLinearGradient(x - size/2, y, x + size/2, y);
    gradient.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.6)`);
    gradient.addColorStop(0.5, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.8)`);
    gradient.addColorStop(1, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.6)`);
    
    this.ctx.fillStyle = gradient;
    this.ctx.beginPath();
    this.ctx.moveTo(x - size/2, y);
    this.ctx.quadraticCurveTo(x, y - size/3, x + size/2, y);
    this.ctx.closePath();
    this.ctx.fill();
  }
  
  private drawCactus(x: number, y: number, size: number, color: string, variant: number): void {
    const rgb = this.hexToRgb(color);
    if (!rgb) return;
    
    const baseY = y + size/2;
    const trunkWidth = size * 0.15;
    const trunkHeight = size * 0.6;
    
    // Draw main trunk
    this.ctx.fillStyle = color;
    this.ctx.fillRect(x - trunkWidth/2, baseY - trunkHeight, trunkWidth, trunkHeight);
    
    // Draw arms/branches
    if (variant > 0) {
      const armWidth = trunkWidth * 0.8;
      const armHeight = size * 0.3;
      // Left arm
      this.ctx.fillRect(x - trunkWidth/2 - armWidth, baseY - trunkHeight * 0.7, armWidth, armHeight);
      // Right arm
      this.ctx.fillRect(x + trunkWidth/2, baseY - trunkHeight * 0.5, armWidth, armHeight);
    }
  }
  
  private drawMirage(x: number, y: number, size: number, color: string): void {
    const rgb = this.hexToRgb(color);
    if (!rgb) return;
    
    // Draw wavy mirage effect
    this.ctx.strokeStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.3)`;
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const waveX = x - size/2 + (i / 4) * size;
      const waveY = y + Math.sin(i * 0.5) * size * 0.1;
      if (i === 0) this.ctx.moveTo(waveX, waveY);
      else this.ctx.lineTo(waveX, waveY);
    }
    this.ctx.stroke();
  }
  
  private drawSunRay(x: number, y: number, size: number, color: string): void {
    const rgb = this.hexToRgb(color);
    if (!rgb) return;
    
    // Draw sun rays
    this.drawLightRays(x, y, size, color, 8);
    
    // Draw sun center
    const gradient = this.ctx.createRadialGradient(x, y, 0, x, y, size/2);
    gradient.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 1)`);
    gradient.addColorStop(1, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0)`);
    this.ctx.fillStyle = gradient;
    this.ctx.beginPath();
    this.ctx.arc(x, y, size/2, 0, Math.PI * 2);
    this.ctx.fill();
  }
  
  // Arctic biome drawing functions
  private drawIceCrystal(x: number, y: number, size: number, color: string): void {
    const rgb = this.hexToRgb(color);
    if (!rgb) return;
    
    // Draw hexagonal ice crystal
    this.ctx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.7)`;
    this.ctx.strokeStyle = `rgba(255, 255, 255, 0.8)`;
    this.ctx.lineWidth = 2;
    
    this.ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const px = x + Math.cos(angle) * size/2;
      const py = y + Math.sin(angle) * size/2;
      if (i === 0) this.ctx.moveTo(px, py);
      else this.ctx.lineTo(px, py);
    }
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.stroke();
  }
  
  private drawAurora(x: number, y: number, size: number, color: string): void {
    const rgb = this.hexToRgb(color);
    if (!rgb) return;
    
    // Draw flowing aurora bands
    this.ctx.save();
    for (let i = 0; i < 3; i++) {
      const gradient = this.ctx.createLinearGradient(x - size/2, y + i * size/4, x + size/2, y + i * size/4);
      gradient.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0)`);
      gradient.addColorStop(0.5, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.6)`);
      gradient.addColorStop(1, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0)`);
      
      this.ctx.fillStyle = gradient;
      this.ctx.beginPath();
      this.ctx.moveTo(x - size/2, y + i * size/4);
      this.ctx.quadraticCurveTo(x, y + i * size/4 + size/8, x + size/2, y + i * size/4);
      this.ctx.lineTo(x + size/2, y + i * size/4 + size/6);
      this.ctx.quadraticCurveTo(x, y + i * size/4 + size/8 + size/6, x - size/2, y + i * size/4 + size/6);
      this.ctx.closePath();
      this.ctx.fill();
    }
    this.ctx.restore();
  }
  
  private drawSnowflake(x: number, y: number, size: number, color: string): void {
    const rgb = this.hexToRgb(color);
    if (!rgb) return;
    
    this.ctx.strokeStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.8)`;
    this.ctx.lineWidth = 2;
    
    // Draw 6-armed snowflake
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      this.ctx.beginPath();
      this.ctx.moveTo(x, y);
      this.ctx.lineTo(x + Math.cos(angle) * size/2, y + Math.sin(angle) * size/2);
      this.ctx.stroke();
      
      // Add side branches
      const branchAngle1 = angle + Math.PI / 6;
      const branchAngle2 = angle - Math.PI / 6;
      this.ctx.beginPath();
      this.ctx.moveTo(x + Math.cos(angle) * size/3, y + Math.sin(angle) * size/3);
      this.ctx.lineTo(x + Math.cos(branchAngle1) * size/2, y + Math.sin(branchAngle1) * size/2);
      this.ctx.stroke();
      this.ctx.beginPath();
      this.ctx.moveTo(x + Math.cos(angle) * size/3, y + Math.sin(angle) * size/3);
      this.ctx.lineTo(x + Math.cos(branchAngle2) * size/2, y + Math.sin(branchAngle2) * size/2);
      this.ctx.stroke();
    }
  }
  
  private drawGlacier(x: number, y: number, size: number, color: string): void {
    const rgb = this.hexToRgb(color);
    if (!rgb) return;
    
    const gradient = this.ctx.createLinearGradient(x, y - size/2, x, y + size/2);
    gradient.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.9)`);
    gradient.addColorStop(1, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.5)`);
    
    this.ctx.fillStyle = gradient;
    this.ctx.beginPath();
    this.ctx.moveTo(x - size/2, y + size/2);
    this.ctx.lineTo(x, y - size/2);
    this.ctx.lineTo(x + size/2, y + size/2);
    this.ctx.closePath();
    this.ctx.fill();
  }
  
  // Volcanic biome drawing functions
  private drawLavaFlow(x: number, y: number, size: number, color: string): void {
    const rgb = this.hexToRgb(color);
    if (!rgb) return;
    
    // Draw flowing lava
    const gradient = this.ctx.createLinearGradient(x, y - size/2, x, y + size/2);
    gradient.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.8)`);
    gradient.addColorStop(0.5, `rgba(${rgb.r + 30}, ${rgb.g}, ${rgb.b - 30}, 1)`);
    gradient.addColorStop(1, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.6)`);
    
    this.ctx.fillStyle = gradient;
    this.ctx.beginPath();
    this.ctx.moveTo(x - size/2, y + size/2);
    this.ctx.quadraticCurveTo(x, y, x + size/2, y + size/2);
    this.ctx.lineTo(x + size/2, y);
    this.ctx.quadraticCurveTo(x, y - size/2, x - size/2, y);
    this.ctx.closePath();
    this.ctx.fill();
  }
  
  private drawEmber(x: number, y: number, size: number, color: string): void {
    const rgb = this.hexToRgb(color);
    if (!rgb) return;
    
    const gradient = this.ctx.createRadialGradient(x, y, 0, x, y, size/2);
    gradient.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 1)`);
    gradient.addColorStop(0.5, `rgba(${rgb.r + 50}, ${rgb.g + 20}, 0, 0.8)`);
    gradient.addColorStop(1, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0)`);
    
    this.ctx.fillStyle = gradient;
    this.ctx.beginPath();
    this.ctx.arc(x, y, size/2, 0, Math.PI * 2);
    this.ctx.fill();
  }
  
  private drawSmoke(x: number, y: number, size: number, color: string): void {
    const rgb = this.hexToRgb(color);
    if (!rgb) return;
    
    // Draw wispy smoke clouds
    for (let i = 0; i < 3; i++) {
      const offsetX = (i - 1) * size/3;
      const offsetY = -i * size/4;
      const cloudSize = size * (0.4 + i * 0.2);
      
      const gradient = this.ctx.createRadialGradient(x + offsetX, y + offsetY, 0, x + offsetX, y + offsetY, cloudSize/2);
      gradient.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.4)`);
      gradient.addColorStop(1, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0)`);
      
      this.ctx.fillStyle = gradient;
      this.ctx.beginPath();
      this.ctx.arc(x + offsetX, y + offsetY, cloudSize/2, 0, Math.PI * 2);
      this.ctx.fill();
    }
  }
  
  private drawMagmaBubble(x: number, y: number, size: number, color: string): void {
    const rgb = this.hexToRgb(color);
    if (!rgb) return;
    
    // Draw glowing magma bubble
    const gradient = this.ctx.createRadialGradient(x - size/4, y - size/4, 0, x, y, size/2);
    gradient.addColorStop(0, `rgba(${rgb.r + 50}, ${rgb.g + 20}, 0, 1)`);
    gradient.addColorStop(0.7, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.8)`);
    gradient.addColorStop(1, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0)`);
    
    this.ctx.fillStyle = gradient;
    this.ctx.beginPath();
    this.ctx.arc(x, y, size/2, 0, Math.PI * 2);
    this.ctx.fill();
    
    // Add highlight
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    this.ctx.beginPath();
    this.ctx.arc(x - size/4, y - size/4, size/6, 0, Math.PI * 2);
    this.ctx.fill();
  }
  
  // Cyberpunk biome drawing functions
  private drawNeonSign(x: number, y: number, size: number, color: string): void {
    const rgb = this.hexToRgb(color);
    if (!rgb) return;
    
    // Draw neon sign outline
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = 3;
    this.ctx.shadowBlur = 10;
    this.ctx.shadowColor = color;
    
    this.ctx.beginPath();
    this.ctx.rect(x - size/2, y - size/4, size, size/2);
    this.ctx.stroke();
    
    this.ctx.shadowBlur = 0;
  }
  
  private drawHologram(x: number, y: number, size: number, color: string): void {
    const rgb = this.hexToRgb(color);
    if (!rgb) return;
    
    // Draw holographic grid pattern
    this.ctx.strokeStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.5)`;
    this.ctx.lineWidth = 1;
    
    const gridSize = size / 4;
    for (let i = -2; i <= 2; i++) {
      this.ctx.beginPath();
      this.ctx.moveTo(x + i * gridSize, y - size/2);
      this.ctx.lineTo(x + i * gridSize, y + size/2);
      this.ctx.stroke();
      
      this.ctx.beginPath();
      this.ctx.moveTo(x - size/2, y + i * gridSize);
      this.ctx.lineTo(x + size/2, y + i * gridSize);
      this.ctx.stroke();
    }
  }
  
  private drawDigitalRain(x: number, y: number, size: number, color: string): void {
    const rgb = this.hexToRgb(color);
    if (!rgb) return;
    
    // Draw falling digital characters
    this.ctx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.6)`;
    this.ctx.font = `${size/3}px monospace`;
    const chars = ['0', '1', 'A', 'B', 'C'];
    const char = chars[Math.floor((x + y) % chars.length)];
    this.ctx.fillText(char, x - size/4, y);
  }
  
  private drawGridLine(x: number, y: number, size: number, color: string): void {
    const rgb = this.hexToRgb(color);
    if (!rgb) return;
    
    this.ctx.strokeStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.3)`;
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    this.ctx.moveTo(x - size/2, y);
    this.ctx.lineTo(x + size/2, y);
    this.ctx.stroke();
  }
  
  // Candy Land biome drawing functions
  private drawGumdrop(x: number, y: number, size: number, color: string): void {
    const rgb = this.hexToRgb(color);
    if (!rgb) return;
    
    const gradient = this.ctx.createRadialGradient(x - size/4, y - size/4, 0, x, y, size/2);
    gradient.addColorStop(0, `rgba(${rgb.r + 30}, ${rgb.g + 30}, ${rgb.b + 30}, 1)`);
    gradient.addColorStop(1, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.8)`);
    
    this.ctx.fillStyle = gradient;
    this.ctx.beginPath();
    this.ctx.arc(x, y, size/2, 0, Math.PI * 2);
    this.ctx.fill();
    
    // Add highlight
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    this.ctx.beginPath();
    this.ctx.arc(x - size/4, y - size/4, size/4, 0, Math.PI * 2);
    this.ctx.fill();
  }
  
  private drawLollipop(x: number, y: number, size: number, color: string): void {
    const rgb = this.hexToRgb(color);
    if (!rgb) return;
    
    const stickLength = size * 0.3;
    
    // Draw stick
    this.ctx.strokeStyle = `rgba(${Math.max(0, rgb.r - 50)}, ${Math.max(0, rgb.g - 50)}, ${Math.max(0, rgb.b - 50)}, 1)`;
    this.ctx.lineWidth = size * 0.1;
    this.ctx.beginPath();
    this.ctx.moveTo(x, y + size/2);
    this.ctx.lineTo(x, y + size/2 + stickLength);
    this.ctx.stroke();
    
    // Draw candy
    const gradient = this.ctx.createRadialGradient(x - size/4, y - size/4, 0, x, y, size/2);
    gradient.addColorStop(0, `rgba(${rgb.r + 30}, ${rgb.g + 30}, ${rgb.b + 30}, 1)`);
    gradient.addColorStop(1, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.8)`);
    
    this.ctx.fillStyle = gradient;
    this.ctx.beginPath();
    this.ctx.arc(x, y, size/2, 0, Math.PI * 2);
    this.ctx.fill();
    
    // Add spiral pattern
    this.ctx.strokeStyle = `rgba(${rgb.r - 30}, ${rgb.g - 30}, ${rgb.b - 30}, 0.8)`;
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    for (let i = 0; i < 20; i++) {
      const angle = i * 0.3;
      const radius = (size/2) * (i / 20);
      const px = x + Math.cos(angle) * radius;
      const py = y + Math.sin(angle) * radius;
      if (i === 0) this.ctx.moveTo(px, py);
      else this.ctx.lineTo(px, py);
    }
    this.ctx.stroke();
  }
  
  private drawCandyCane(x: number, y: number, size: number, color: string): void {
    const rgb = this.hexToRgb(color);
    if (!rgb) return;
    
    // Draw striped candy cane
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = size * 0.15;
    this.ctx.lineCap = 'round';
    
    const stripeCount = 4;
    for (let i = 0; i < stripeCount; i++) {
      const offset = (i % 2 === 0) ? 0 : size * 0.1;
      this.ctx.strokeStyle = (i % 2 === 0) ? color : '#ffffff';
      this.ctx.beginPath();
      this.ctx.moveTo(x - size/2 + offset, y - size/2 + i * size/stripeCount);
      this.ctx.lineTo(x + size/2 - offset, y - size/2 + (i + 1) * size/stripeCount);
      this.ctx.stroke();
    }
  }
  
  private drawSprinkle(x: number, y: number, size: number, color: string): void {
    const rgb = this.hexToRgb(color);
    if (!rgb) return;
    
    this.ctx.fillStyle = color;
    this.ctx.fillRect(x - size/4, y - size/2, size/2, size);
  }
  
  // Underwater Cave / Crystal Cavern biome drawing functions
  private drawBioluminescence(x: number, y: number, size: number, color: string): void {
    const rgb = this.hexToRgb(color);
    if (!rgb) return;
    
    const gradient = this.ctx.createRadialGradient(x, y, 0, x, y, size/2);
    gradient.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 1)`);
    gradient.addColorStop(0.5, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.6)`);
    gradient.addColorStop(1, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0)`);
    
    this.ctx.fillStyle = gradient;
    this.ctx.beginPath();
    this.ctx.arc(x, y, size/2, 0, Math.PI * 2);
    this.ctx.fill();
  }
  
  private drawStalactite(x: number, y: number, size: number, color: string): void {
    const rgb = this.hexToRgb(color);
    if (!rgb) return;
    
    this.ctx.fillStyle = color;
    this.ctx.beginPath();
    this.ctx.moveTo(x - size/2, y - size/2);
    this.ctx.lineTo(x, y + size/2);
    this.ctx.lineTo(x + size/2, y - size/2);
    this.ctx.closePath();
    this.ctx.fill();
  }
  
  private drawGemstone(x: number, y: number, size: number, color: string): void {
    const rgb = this.hexToRgb(color);
    if (!rgb) return;
    
    // Draw faceted gem
    const gradient = this.ctx.createLinearGradient(x - size/2, y - size/2, x + size/2, y + size/2);
    gradient.addColorStop(0, `rgba(${rgb.r + 50}, ${rgb.g + 50}, ${rgb.b + 50}, 1)`);
    gradient.addColorStop(0.5, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.8)`);
    gradient.addColorStop(1, `rgba(${Math.max(0, rgb.r - 30)}, ${Math.max(0, rgb.g - 30)}, ${Math.max(0, rgb.b - 30)}, 1)`);
    
    this.ctx.fillStyle = gradient;
    this.ctx.beginPath();
    // Draw diamond shape
    this.ctx.moveTo(x, y - size/2);
    this.ctx.lineTo(x + size/2, y);
    this.ctx.lineTo(x, y + size/2);
    this.ctx.lineTo(x - size/2, y);
    this.ctx.closePath();
    this.ctx.fill();
    
    // Add highlight
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    this.ctx.beginPath();
    this.ctx.moveTo(x, y - size/2);
    this.ctx.lineTo(x + size/4, y - size/4);
    this.ctx.lineTo(x, y);
    this.ctx.closePath();
    this.ctx.fill();
  }
  
  private drawLightRefraction(x: number, y: number, size: number, color: string): void {
    const rgb = this.hexToRgb(color);
    if (!rgb) return;
    
    // Draw light rays
    this.drawLightRays(x, y, size, color, 6);
  }
  
  private drawCrystalFormation(x: number, y: number, size: number, color: string, variant: number): void {
    const rgb = this.hexToRgb(color);
    if (!rgb) return;
    
    // Draw cluster of crystals
    const crystalCount = 3 + variant;
    for (let i = 0; i < crystalCount; i++) {
      const angle = (i / crystalCount) * Math.PI * 2;
      const offsetX = Math.cos(angle) * size/3;
      const offsetY = Math.sin(angle) * size/3;
      const crystalSize = size * (0.3 + (i % 2) * 0.2);
      
      this.ctx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.7)`;
      this.ctx.beginPath();
      this.ctx.moveTo(x + offsetX, y + offsetY - crystalSize/2);
      this.ctx.lineTo(x + offsetX + crystalSize/3, y + offsetY + crystalSize/2);
      this.ctx.lineTo(x + offsetX - crystalSize/3, y + offsetY + crystalSize/2);
      this.ctx.closePath();
      this.ctx.fill();
    }
  }
  
  // Mushroom Forest biome drawing functions
  private drawMushroom(x: number, y: number, size: number, color: string, variant: number): void {
    const rgb = this.hexToRgb(color);
    if (!rgb) return;
    
    const baseY = y + size/2;
    const capSize = size * 0.7;
    const stemHeight = size * 0.4;
    const stemWidth = size * 0.15;
    
    // Draw stem
    this.ctx.fillStyle = `rgba(${Math.max(0, rgb.r - 40)}, ${Math.max(0, rgb.g - 40)}, ${Math.max(0, rgb.b - 40)}, 1)`;
    this.ctx.fillRect(x - stemWidth/2, baseY - stemHeight, stemWidth, stemHeight);
    
    // Draw cap
    const capGradient = this.ctx.createRadialGradient(x, baseY - stemHeight, 0, x, baseY - stemHeight, capSize/2);
    capGradient.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 1)`);
    capGradient.addColorStop(1, `rgba(${Math.max(0, rgb.r - 30)}, ${Math.max(0, rgb.g - 30)}, ${Math.max(0, rgb.b - 30)}, 1)`);
    
    this.ctx.fillStyle = capGradient;
    this.ctx.beginPath();
    this.ctx.arc(x, baseY - stemHeight, capSize/2, 0, Math.PI * 2);
    this.ctx.fill();
    
    // Add spots if variant > 0
    if (variant > 0) {
      this.ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      this.ctx.beginPath();
      this.ctx.arc(x - capSize/4, baseY - stemHeight - capSize/4, capSize/8, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.beginPath();
      this.ctx.arc(x + capSize/4, baseY - stemHeight - capSize/6, capSize/10, 0, Math.PI * 2);
      this.ctx.fill();
    }
  }
  
  private drawSpore(x: number, y: number, size: number, color: string): void {
    const rgb = this.hexToRgb(color);
    if (!rgb) return;
    
    const gradient = this.ctx.createRadialGradient(x, y, 0, x, y, size/2);
    gradient.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.6)`);
    gradient.addColorStop(1, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0)`);
    
    this.ctx.fillStyle = gradient;
    this.ctx.beginPath();
    this.ctx.arc(x, y, size/2, 0, Math.PI * 2);
    this.ctx.fill();
  }
  
  private drawGlowingCap(x: number, y: number, size: number, color: string): void {
    const rgb = this.hexToRgb(color);
    if (!rgb) return;
    
    const gradient = this.ctx.createRadialGradient(x, y, 0, x, y, size/2);
    gradient.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 1)`);
    gradient.addColorStop(0.5, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.8)`);
    gradient.addColorStop(1, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0)`);
    
    this.ctx.fillStyle = gradient;
    this.ctx.beginPath();
    this.ctx.arc(x, y, size/2, 0, Math.PI * 2);
    this.ctx.fill();
  }
  
  private drawMycelium(x: number, y: number, size: number, color: string): void {
    const rgb = this.hexToRgb(color);
    if (!rgb) return;
    
    this.ctx.strokeStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.6)`;
    this.ctx.lineWidth = 2;
    
    // Draw branching network
    for (let i = 0; i < 3; i++) {
      const angle = (i / 3) * Math.PI * 2;
      this.ctx.beginPath();
      this.ctx.moveTo(x, y);
      this.ctx.lineTo(x + Math.cos(angle) * size/2, y + Math.sin(angle) * size/2);
      this.ctx.stroke();
    }
  }
  
  // Cloud Kingdom biome drawing functions
  private drawRainbow(x: number, y: number, size: number): void {
    const colors = ['#ff0000', '#ff7f00', '#ffff00', '#00ff00', '#0000ff', '#4b0082', '#9400d3'];
    const arcWidth = size * 0.1;
    
    for (let i = 0; i < colors.length; i++) {
      this.ctx.strokeStyle = colors[i];
      this.ctx.lineWidth = arcWidth;
      this.ctx.beginPath();
      this.ctx.arc(x, y, size/2 - i * arcWidth, 0, Math.PI);
      this.ctx.stroke();
    }
  }
  
  private drawLightning(x: number, y: number, size: number, color: string): void {
    const rgb = this.hexToRgb(color);
    if (!rgb) return;
    
    this.ctx.strokeStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 1)`;
    this.ctx.lineWidth = 3;
    this.ctx.shadowBlur = 10;
    this.ctx.shadowColor = color;
    
    // Draw zigzag lightning
    this.ctx.beginPath();
    this.ctx.moveTo(x, y - size/2);
    this.ctx.lineTo(x + size/4, y - size/4);
    this.ctx.lineTo(x - size/4, y);
    this.ctx.lineTo(x + size/4, y + size/4);
    this.ctx.lineTo(x, y + size/2);
    this.ctx.stroke();
    
    this.ctx.shadowBlur = 0;
  }
  
  private drawSkyPalace(x: number, y: number, size: number, color: string): void {
    const rgb = this.hexToRgb(color);
    if (!rgb) return;
    
    // Draw floating palace structure
    const width = size * 0.6;
    const height = size * 0.8;
    const baseY = y + size/2;
    
    // Draw base
    this.ctx.fillStyle = color;
    this.ctx.fillRect(x - width/2, baseY - height, width, height);
    
    // Draw towers
    const towerWidth = width/4;
    this.ctx.fillRect(x - width/2, baseY - height * 1.2, towerWidth, height * 0.4);
    this.ctx.fillRect(x + width/2 - towerWidth, baseY - height * 1.2, towerWidth, height * 0.4);
  }
  
  // Neon City biome drawing functions
  private drawSkyscraper(x: number, y: number, size: number, color: string, variant: number): void {
    const rgb = this.hexToRgb(color);
    if (!rgb) return;
    
    const width = size * 0.4;
    const height = size * (0.8 + variant * 0.2);
    const baseY = y + size/2;
    
    // Draw building
    this.ctx.fillStyle = color;
    this.ctx.fillRect(x - width/2, baseY - height, width, height);
    
    // Add neon windows
    this.ctx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.8)`;
    const windowRows = 5 + variant;
    const windowCols = 2;
    const windowSize = width / (windowCols * 3);
    const windowSpacing = width / windowCols;
    
    for (let row = 0; row < windowRows; row++) {
      for (let col = 0; col < windowCols; col++) {
        const windowX = x - width/2 + (col + 0.5) * windowSpacing;
        const windowY = baseY - height + (row + 0.5) * (height / windowRows);
        this.ctx.fillRect(windowX - windowSize/2, windowY - windowSize/2, windowSize, windowSize);
      }
    }
  }
  
  private drawTrafficLight(x: number, y: number, size: number, color: string): void {
    const rgb = this.hexToRgb(color);
    if (!rgb) return;
    
    // Draw traffic light pole
    this.ctx.fillStyle = `rgba(${Math.max(0, rgb.r - 50)}, ${Math.max(0, rgb.g - 50)}, ${Math.max(0, rgb.b - 50)}, 1)`;
    this.ctx.fillRect(x - size/8, y + size/4, size/4, size/2);
    
    // Draw lights
    const lightSize = size/3;
    const colors = ['#ff0000', '#ffff00', '#00ff00'];
    for (let i = 0; i < 3; i++) {
      this.ctx.fillStyle = colors[i];
      this.ctx.beginPath();
      this.ctx.arc(x, y - size/4 + i * lightSize, lightSize/2, 0, Math.PI * 2);
      this.ctx.fill();
    }
  }
  
  private drawBillboard(x: number, y: number, size: number, color: string): void {
    const rgb = this.hexToRgb(color);
    if (!rgb) return;
    
    const width = size * 0.8;
    const height = size * 0.4;
    
    // Draw billboard
    this.ctx.fillStyle = color;
    this.ctx.fillRect(x - width/2, y - height/2, width, height);
    
    // Add text-like pattern
    this.ctx.fillStyle = `rgba(${rgb.r + 50}, ${rgb.g + 50}, ${rgb.b + 50}, 1)`;
    this.ctx.font = `${size/4}px sans-serif`;
    this.ctx.fillText('★', x - width/4, y);
  }
  
  // Jungle biome drawing functions
  private drawVine(x: number, y: number, size: number, color: string): void {
    const rgb = this.hexToRgb(color);
    if (!rgb) return;
    
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = size * 0.1;
    this.ctx.lineCap = 'round';
    
    // Draw curving vine
    this.ctx.beginPath();
    this.ctx.moveTo(x, y - size/2);
    for (let i = 0; i < 5; i++) {
      const waveX = x + Math.sin(i * 0.5) * size/4;
      const waveY = y - size/2 + (i / 4) * size;
      this.ctx.lineTo(waveX, waveY);
    }
    this.ctx.stroke();
  }
  
  private drawTropicalFlower(x: number, y: number, size: number, color: string): void {
    const rgb = this.hexToRgb(color);
    if (!rgb) return;
    
    // Draw flower petals
    const petalCount = 5;
    for (let i = 0; i < petalCount; i++) {
      const angle = (i / petalCount) * Math.PI * 2;
      const petalX = x + Math.cos(angle) * size/3;
      const petalY = y + Math.sin(angle) * size/3;
      
      const gradient = this.ctx.createRadialGradient(petalX, petalY, 0, petalX, petalY, size/4);
      gradient.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 1)`);
      gradient.addColorStop(1, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0)`);
      
      this.ctx.fillStyle = gradient;
      this.ctx.beginPath();
      this.ctx.arc(petalX, petalY, size/4, 0, Math.PI * 2);
      this.ctx.fill();
    }
    
    // Draw center
    this.ctx.fillStyle = `rgba(${rgb.r + 50}, ${rgb.g + 50}, 0, 1)`;
    this.ctx.beginPath();
    this.ctx.arc(x, y, size/6, 0, Math.PI * 2);
    this.ctx.fill();
  }
  
  private drawWaterfall(x: number, y: number, size: number, color: string): void {
    const rgb = this.hexToRgb(color);
    if (!rgb) return;
    
    // Draw flowing water
    const gradient = this.ctx.createLinearGradient(x, y - size/2, x, y + size/2);
    gradient.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.8)`);
    gradient.addColorStop(1, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.4)`);
    
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(x - size/4, y - size/2, size/2, size);
    
    // Add white foam
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    for (let i = 0; i < 3; i++) {
      const foamY = y - size/2 + (i / 2) * size;
      this.ctx.beginPath();
      this.ctx.arc(x, foamY, size/8, 0, Math.PI * 2);
      this.ctx.fill();
    }
  }
  
  private drawExoticBird(x: number, y: number, size: number, color: string): void {
    const rgb = this.hexToRgb(color);
    if (!rgb) return;
    
    // Draw bird body
    this.ctx.fillStyle = color;
    this.ctx.beginPath();
    this.ctx.ellipse(x, y, size * 0.3, size * 0.2, 0, 0, Math.PI * 2);
    this.ctx.fill();
    
    // Draw tail feathers
    this.ctx.beginPath();
    this.ctx.moveTo(x - size * 0.3, y);
    this.ctx.lineTo(x - size * 0.5, y - size * 0.2);
    this.ctx.lineTo(x - size * 0.5, y + size * 0.2);
    this.ctx.closePath();
    this.ctx.fill();
  }
  
  // Graveyard biome drawing functions
  private drawTombstone(x: number, y: number, size: number, color: string): void {
    const rgb = this.hexToRgb(color);
    if (!rgb) return;
    
    const baseY = y + size/2;
    const width = size * 0.4;
    const height = size * 0.6;
    
    // Draw tombstone
    this.ctx.fillStyle = color;
    this.ctx.fillRect(x - width/2, baseY - height, width, height);
    
    // Draw top arch
    this.ctx.beginPath();
    this.ctx.arc(x, baseY - height, width/2, Math.PI, 0, false);
    this.ctx.fill();
    
    // Add cross or R.I.P. pattern
    this.ctx.strokeStyle = `rgba(${Math.max(0, rgb.r - 30)}, ${Math.max(0, rgb.g - 30)}, ${Math.max(0, rgb.b - 30)}, 1)`;
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.moveTo(x, baseY - height * 0.7);
    this.ctx.lineTo(x, baseY - height * 0.3);
    this.ctx.stroke();
    this.ctx.beginPath();
    this.ctx.moveTo(x - width/4, baseY - height * 0.5);
    this.ctx.lineTo(x + width/4, baseY - height * 0.5);
    this.ctx.stroke();
  }
  
  private drawMist(x: number, y: number, size: number, color: string): void {
    const rgb = this.hexToRgb(color);
    if (!rgb) return;
    
    // Draw wispy mist
    for (let i = 0; i < 4; i++) {
      const offsetX = (i - 1.5) * size/4;
      const cloudSize = size * (0.3 + i * 0.1);
      
      const gradient = this.ctx.createRadialGradient(x + offsetX, y, 0, x + offsetX, y, cloudSize/2);
      gradient.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.4)`);
      gradient.addColorStop(1, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0)`);
      
      this.ctx.fillStyle = gradient;
      this.ctx.beginPath();
      this.ctx.arc(x + offsetX, y, cloudSize/2, 0, Math.PI * 2);
      this.ctx.fill();
    }
  }
  
  private drawGhost(x: number, y: number, size: number, color: string): void {
    const rgb = this.hexToRgb(color);
    if (!rgb) return;
    
    // Draw ghost shape
    this.ctx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.7)`;
    this.ctx.beginPath();
    this.ctx.arc(x, y - size/3, size/3, Math.PI, 0, false);
    this.ctx.lineTo(x + size/3, y + size/2);
    this.ctx.lineTo(x + size/6, y + size/3);
    this.ctx.lineTo(x, y + size/2);
    this.ctx.lineTo(x - size/6, y + size/3);
    this.ctx.lineTo(x - size/3, y + size/2);
    this.ctx.closePath();
    this.ctx.fill();
    
    // Add eyes
    this.ctx.fillStyle = '#000000';
    this.ctx.beginPath();
    this.ctx.arc(x - size/6, y - size/4, size/12, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.beginPath();
    this.ctx.arc(x + size/6, y - size/4, size/12, 0, Math.PI * 2);
    this.ctx.fill();
  }
  
  private drawMoonlight(x: number, y: number, size: number, color: string): void {
    const rgb = this.hexToRgb(color);
    if (!rgb) return;
    
    // Draw moon
    const gradient = this.ctx.createRadialGradient(x, y, 0, x, y, size/2);
    gradient.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 1)`);
    gradient.addColorStop(1, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0)`);
    
    this.ctx.fillStyle = gradient;
    this.ctx.beginPath();
    this.ctx.arc(x, y, size/2, 0, Math.PI * 2);
    this.ctx.fill();
    
    // Add light rays
    this.drawLightRays(x, y, size, color, 12);
  }
  
  // Ocean Depths biome drawing functions
  private drawDeepSeaCreature(x: number, y: number, size: number, color: string): void {
    const rgb = this.hexToRgb(color);
    if (!rgb) return;
    
    // Draw jellyfish-like creature
    const gradient = this.ctx.createRadialGradient(x, y - size/3, 0, x, y - size/3, size/2);
    gradient.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.8)`);
    gradient.addColorStop(1, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0)`);
    
    this.ctx.fillStyle = gradient;
    this.ctx.beginPath();
    this.ctx.arc(x, y - size/3, size/2, 0, Math.PI * 2);
    this.ctx.fill();
    
    // Draw tentacles
    this.ctx.strokeStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.6)`;
    this.ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2;
      this.ctx.beginPath();
      this.ctx.moveTo(x + Math.cos(angle) * size/3, y);
      this.ctx.quadraticCurveTo(
        x + Math.cos(angle) * size/2, y + size/2,
        x + Math.cos(angle) * size/2, y + size
      );
      this.ctx.stroke();
    }
  }
  
  private drawKelpForest(x: number, y: number, size: number, color: string): void {
    const rgb = this.hexToRgb(color);
    if (!rgb) return;
    
    // Draw kelp strands
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = size * 0.1;
    this.ctx.lineCap = 'round';
    
    for (let i = 0; i < 3; i++) {
      const offsetX = (i - 1) * size/4;
      this.ctx.beginPath();
      this.ctx.moveTo(x + offsetX, y + size/2);
      for (let j = 0; j < 5; j++) {
        const waveX = x + offsetX + Math.sin(j * 0.3) * size/6;
        const waveY = y + size/2 - (j / 4) * size;
        this.ctx.lineTo(waveX, waveY);
      }
      this.ctx.stroke();
    }
  }
  
  private drawBioluminescentFish(x: number, y: number, size: number, color: string): void {
    const rgb = this.hexToRgb(color);
    if (!rgb) return;
    
    // Draw glowing fish
    this.ctx.fillStyle = color;
    this.ctx.beginPath();
    this.ctx.ellipse(x, y, size * 0.4, size * 0.2, 0, 0, Math.PI * 2);
    this.ctx.fill();
    
    // Add glowing spots
    this.ctx.fillStyle = `rgba(${rgb.r + 50}, ${rgb.g + 50}, ${rgb.b + 50}, 1)`;
    this.ctx.beginPath();
    this.ctx.arc(x, y, size/8, 0, Math.PI * 2);
    this.ctx.fill();
  }
  
  // Sunset Beach biome drawing functions
  private drawPalmTree(x: number, y: number, size: number, color: string): void {
    const rgb = this.hexToRgb(color);
    if (!rgb) return;
    
    const baseY = y + size/2;
    
    // Draw trunk
    this.ctx.fillStyle = `rgba(${Math.max(0, rgb.r - 40)}, ${Math.max(0, rgb.g - 40)}, ${Math.max(0, rgb.b - 40)}, 1)`;
    this.ctx.fillRect(x - size * 0.05, baseY - size * 0.5, size * 0.1, size * 0.5);
    
    // Draw fronds
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = size * 0.05;
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      this.ctx.beginPath();
      this.ctx.moveTo(x, baseY - size * 0.5);
      this.ctx.lineTo(x + Math.cos(angle) * size/2, baseY - size * 0.5 + Math.sin(angle) * size/2);
      this.ctx.stroke();
    }
  }
  
  private drawWave(x: number, y: number, size: number, color: string): void {
    const rgb = this.hexToRgb(color);
    if (!rgb) return;
    
    // Draw wave
    const gradient = this.ctx.createLinearGradient(x - size/2, y, x + size/2, y);
    gradient.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.6)`);
    gradient.addColorStop(0.5, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.8)`);
    gradient.addColorStop(1, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.6)`);
    
    this.ctx.fillStyle = gradient;
    this.ctx.beginPath();
    this.ctx.moveTo(x - size/2, y);
    this.ctx.quadraticCurveTo(x, y - size/3, x + size/2, y);
    this.ctx.lineTo(x + size/2, y + size/4);
    this.ctx.quadraticCurveTo(x, y + size/4 - size/6, x - size/2, y + size/4);
    this.ctx.closePath();
    this.ctx.fill();
  }
  
  private drawSeagull(x: number, y: number, size: number, color: string): void {
    const rgb = this.hexToRgb(color);
    if (!rgb) return;
    
    // Draw seagull silhouette
    this.ctx.fillStyle = color;
    this.ctx.beginPath();
    // Body
    this.ctx.ellipse(x, y, size * 0.3, size * 0.15, 0, 0, Math.PI * 2);
    // Wings
    this.ctx.moveTo(x - size * 0.2, y);
    this.ctx.lineTo(x - size * 0.4, y - size * 0.2);
    this.ctx.lineTo(x - size * 0.3, y);
    this.ctx.moveTo(x + size * 0.2, y);
    this.ctx.lineTo(x + size * 0.4, y - size * 0.2);
    this.ctx.lineTo(x + size * 0.3, y);
    this.ctx.fill();
  }
  
  private drawSunsetGradient(x: number, y: number, size: number): void {
    // Draw sunset gradient band
    const colors = ['#ff6b6b', '#ffa07a', '#ffd700', '#ff8c00', '#ff6347'];
    const bandHeight = size / colors.length;
    
    for (let i = 0; i < colors.length; i++) {
      const gradient = this.ctx.createLinearGradient(x - size/2, y - size/2 + i * bandHeight, x + size/2, y - size/2 + i * bandHeight);
      gradient.addColorStop(0, colors[i]);
      gradient.addColorStop(1, colors[i]);
      
      this.ctx.fillStyle = gradient;
      this.ctx.fillRect(x - size/2, y - size/2 + i * bandHeight, size, bandHeight);
    }
  }
  
  // Magical Forest biome drawing functions
  private drawFairyLight(x: number, y: number, size: number, color: string): void {
    const rgb = this.hexToRgb(color);
    if (!rgb) return;
    
    const gradient = this.ctx.createRadialGradient(x, y, 0, x, y, size/2);
    gradient.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 1)`);
    gradient.addColorStop(0.5, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.6)`);
    gradient.addColorStop(1, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0)`);
    
    this.ctx.fillStyle = gradient;
    this.ctx.beginPath();
    this.ctx.arc(x, y, size/2, 0, Math.PI * 2);
    this.ctx.fill();
    
    // Add sparkles
    this.drawSparkles(x, y, 4, color);
  }
  
  private drawEnchantedTree(x: number, y: number, size: number, color: string): void {
    const rgb = this.hexToRgb(color);
    if (!rgb) return;
    
    const baseY = y + size/2;
    
    // Draw trunk with glow
    this.ctx.fillStyle = `rgba(${Math.max(0, rgb.r - 40)}, ${Math.max(0, rgb.g - 40)}, ${Math.max(0, rgb.b - 40)}, 1)`;
    this.ctx.fillRect(x - size * 0.1, baseY - size * 0.3, size * 0.2, size * 0.3);
    
    // Draw magical foliage with sparkles
    this.ctx.fillStyle = color;
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2;
      const offsetX = Math.cos(angle) * size/3;
      const offsetY = baseY - size * 0.5 + Math.sin(angle) * size/4;
      
      this.ctx.beginPath();
      this.ctx.arc(x + offsetX, offsetY, size/4, 0, Math.PI * 2);
      this.ctx.fill();
      
      // Add sparkles
      this.drawSparkles(x + offsetX, offsetY, 2, color);
    }
  }
  
  private drawFirefly(x: number, y: number, size: number, color: string): void {
    const rgb = this.hexToRgb(color);
    if (!rgb) return;
    
    const gradient = this.ctx.createRadialGradient(x, y, 0, x, y, size/2);
    gradient.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 1)`);
    gradient.addColorStop(1, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0)`);
    
    this.ctx.fillStyle = gradient;
    this.ctx.beginPath();
    this.ctx.arc(x, y, size/2, 0, Math.PI * 2);
    this.ctx.fill();
  }
  
  private drawMagicOrb(x: number, y: number, size: number, color: string): void {
    const rgb = this.hexToRgb(color);
    if (!rgb) return;
    
    // Draw magical orb with inner glow
    const gradient = this.ctx.createRadialGradient(x, y, 0, x, y, size/2);
    gradient.addColorStop(0, `rgba(${rgb.r + 50}, ${rgb.g + 50}, ${rgb.b + 50}, 1)`);
    gradient.addColorStop(0.5, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.8)`);
    gradient.addColorStop(1, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0)`);
    
    this.ctx.fillStyle = gradient;
    this.ctx.beginPath();
    this.ctx.arc(x, y, size/2, 0, Math.PI * 2);
    this.ctx.fill();
    
    // Add sparkles
    this.drawSparkles(x, y, 6, color);
  }
  
  // Industrial biome drawing functions
  private drawGear(x: number, y: number, size: number, color: string): void {
    const rgb = this.hexToRgb(color);
    if (!rgb) return;
    
    // Draw gear teeth
    this.ctx.fillStyle = color;
    const teeth = 8;
    const outerRadius = size/2;
    const innerRadius = size/3;
    
    this.ctx.beginPath();
    for (let i = 0; i < teeth * 2; i++) {
      const radius = i % 2 === 0 ? outerRadius : innerRadius;
      const angle = (i / (teeth * 2)) * Math.PI * 2;
      const px = x + Math.cos(angle) * radius;
      const py = y + Math.sin(angle) * radius;
      if (i === 0) this.ctx.moveTo(px, py);
      else this.ctx.lineTo(px, py);
    }
    this.ctx.closePath();
    this.ctx.fill();
    
    // Draw center hole
    this.ctx.fillStyle = `rgba(${Math.max(0, rgb.r - 50)}, ${Math.max(0, rgb.g - 50)}, ${Math.max(0, rgb.b - 50)}, 1)`;
    this.ctx.beginPath();
    this.ctx.arc(x, y, size/4, 0, Math.PI * 2);
    this.ctx.fill();
  }
  
  private drawSteam(x: number, y: number, size: number, color: string): void {
    const rgb = this.hexToRgb(color);
    if (!rgb) return;
    
    // Draw rising steam
    for (let i = 0; i < 3; i++) {
      const offsetX = (i - 1) * size/4;
      const cloudSize = size * (0.3 + i * 0.1);
      
      const gradient = this.ctx.createRadialGradient(x + offsetX, y - i * size/3, 0, x + offsetX, y - i * size/3, cloudSize/2);
      gradient.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.5)`);
      gradient.addColorStop(1, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0)`);
      
      this.ctx.fillStyle = gradient;
      this.ctx.beginPath();
      this.ctx.arc(x + offsetX, y - i * size/3, cloudSize/2, 0, Math.PI * 2);
      this.ctx.fill();
    }
  }
  
  private drawFactory(x: number, y: number, size: number, color: string): void {
    const rgb = this.hexToRgb(color);
    if (!rgb) return;
    
    const width = size * 0.6;
    const height = size * 0.7;
    const baseY = y + size/2;
    
    // Draw factory building
    this.ctx.fillStyle = color;
    this.ctx.fillRect(x - width/2, baseY - height, width, height);
    
    // Draw smokestacks
    const stackWidth = width/6;
    this.ctx.fillRect(x - width/2, baseY - height * 1.1, stackWidth, height * 0.2);
    this.ctx.fillRect(x + width/2 - stackWidth, baseY - height * 1.1, stackWidth, height * 0.2);
  }
  
  // Retro Arcade biome drawing functions
  private drawPixelArt(x: number, y: number, size: number, color: string): void {
    const rgb = this.hexToRgb(color);
    if (!rgb) return;
    
    // Draw pixelated shape
    const pixelSize = size / 4;
    this.ctx.fillStyle = color;
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        if ((i + j) % 2 === 0) {
          this.ctx.fillRect(x - size/2 + i * pixelSize, y - size/2 + j * pixelSize, pixelSize, pixelSize);
        }
      }
    }
  }
  
  private drawEightBitPattern(x: number, y: number, size: number, color: string): void {
    const rgb = this.hexToRgb(color);
    if (!rgb) return;
    
    // Draw 8-bit checkerboard pattern
    const tileSize = size / 4;
    this.ctx.fillStyle = color;
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        if ((i + j) % 2 === 0) {
          this.ctx.fillRect(x - size/2 + i * tileSize, y - size/2 + j * tileSize, tileSize, tileSize);
        }
      }
    }
  }
  
  private drawArcade(x: number, y: number, size: number, color: string): void {
    const rgb = this.hexToRgb(color);
    if (!rgb) return;
    
    // Draw arcade cabinet shape
    const width = size * 0.5;
    const height = size * 0.7;
    const baseY = y + size/2;
    
    this.ctx.fillStyle = color;
    this.ctx.fillRect(x - width/2, baseY - height, width, height);
    
    // Draw screen
    this.ctx.fillStyle = `rgba(${rgb.r + 50}, ${rgb.g + 50}, ${rgb.b + 50}, 1)`;
    this.ctx.fillRect(x - width/3, baseY - height * 0.7, width * 2/3, height * 0.4);
  }
  
  private drawPixelStar(x: number, y: number, size: number, color: string): void {
    const rgb = this.hexToRgb(color);
    if (!rgb) return;
    
    // Draw pixelated star
    const pixelSize = size / 6;
    this.ctx.fillStyle = color;
    
    // Center pixel
    this.ctx.fillRect(x - pixelSize/2, y - pixelSize/2, pixelSize, pixelSize);
    
    // Arms
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2;
      const px = x + Math.cos(angle) * size/3;
      const py = y + Math.sin(angle) * size/3;
      this.ctx.fillRect(px - pixelSize/2, py - pixelSize/2, pixelSize, pixelSize);
    }
  }
  
  // Enhanced wall rendering helpers
  private drawWallTexture(x: number, y: number, width: number, height: number, color: string, textureType: 'brick' | 'stone' | 'metal' | 'noise' = 'noise'): void {
    const rgb = this.hexToRgb(color);
    if (!rgb) return;
    
    this.ctx.save();
    
    switch (textureType) {
      case 'brick':
        // Draw brick pattern
        const brickWidth = width / 8;
        const brickHeight = height / 4;
        for (let row = 0; row < 4; row++) {
          const offset = (row % 2 === 0) ? 0 : brickWidth / 2;
          for (let col = 0; col < 8; col++) {
            const brickX = x + offset + col * brickWidth;
            const brickY = y + row * brickHeight;
            
            // Draw brick with slight variation
            const variation = ((row * 8 + col) % 3) * 5;
            this.ctx.fillStyle = `rgba(${Math.max(0, rgb.r - variation)}, ${Math.max(0, rgb.g - variation)}, ${Math.max(0, rgb.b - variation)}, 0.3)`;
            this.ctx.fillRect(brickX, brickY, brickWidth - 1, brickHeight - 1);
          }
        }
        break;
        
      case 'stone':
        // Draw stone pattern with irregular shapes
        const stoneSize = Math.min(width, height) / 6;
        for (let i = 0; i < 12; i++) {
          const stoneX = x + (i % 4) * stoneSize + (i % 2) * stoneSize / 2;
          const stoneY = y + Math.floor(i / 4) * stoneSize;
          const variation = (i % 5) * 8;
          
          this.ctx.fillStyle = `rgba(${Math.max(0, rgb.r - variation)}, ${Math.max(0, rgb.g - variation)}, ${Math.max(0, rgb.b - variation)}, 0.25)`;
          this.ctx.beginPath();
          this.ctx.arc(stoneX + stoneSize/2, stoneY + stoneSize/2, stoneSize/2, 0, Math.PI * 2);
          this.ctx.fill();
        }
        break;
        
      case 'metal':
        // Draw metallic rivets and lines
        this.ctx.strokeStyle = `rgba(${Math.min(255, rgb.r + 30)}, ${Math.min(255, rgb.g + 30)}, ${Math.min(255, rgb.b + 30)}, 0.4)`;
        this.ctx.lineWidth = 1;
        
        // Horizontal lines
        for (let i = 1; i < 4; i++) {
          this.ctx.beginPath();
          this.ctx.moveTo(x, y + (height / 4) * i);
          this.ctx.lineTo(x + width, y + (height / 4) * i);
          this.ctx.stroke();
        }
        
        // Rivets
        this.ctx.fillStyle = `rgba(${Math.min(255, rgb.r + 40)}, ${Math.min(255, rgb.g + 40)}, ${Math.min(255, rgb.b + 40)}, 0.6)`;
        for (let i = 0; i < 3; i++) {
          for (let j = 0; j < 2; j++) {
            const rivetX = x + (width / 3) * (i + 0.5);
            const rivetY = y + (height / 3) * (j + 0.5);
            this.ctx.beginPath();
            this.ctx.arc(rivetX, rivetY, 3, 0, Math.PI * 2);
            this.ctx.fill();
          }
        }
        break;
        
      case 'noise':
      default:
        // Draw noise pattern
        const noiseDensity = (width * height) / 100;
        for (let i = 0; i < noiseDensity; i++) {
          const noiseX = x + Math.random() * width;
          const noiseY = y + Math.random() * height;
          const variation = Math.random() * 20;
          
          this.ctx.fillStyle = `rgba(${Math.max(0, rgb.r - variation)}, ${Math.max(0, rgb.g - variation)}, ${Math.max(0, rgb.b - variation)}, 0.2)`;
          this.ctx.fillRect(noiseX, noiseY, 2, 2);
        }
        break;
    }
    
    this.ctx.restore();
  }
  
  private drawBeveledEdge(x: number, y: number, width: number, height: number, color: string, bevelSize: number = 5): void {
    const rgb = this.hexToRgb(color);
    if (!rgb) return;
    
    // Top bevel (lighter)
    const topGradient = this.ctx.createLinearGradient(x, y, x, y + bevelSize);
    topGradient.addColorStop(0, `rgba(${Math.min(255, rgb.r + 40)}, ${Math.min(255, rgb.g + 40)}, ${Math.min(255, rgb.b + 40)}, 0.8)`);
    topGradient.addColorStop(1, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0)`);
    this.ctx.fillStyle = topGradient;
    this.ctx.fillRect(x, y, width, bevelSize);
    
    // Left bevel (lighter)
    const leftGradient = this.ctx.createLinearGradient(x, y, x + bevelSize, y);
    leftGradient.addColorStop(0, `rgba(${Math.min(255, rgb.r + 40)}, ${Math.min(255, rgb.g + 40)}, ${Math.min(255, rgb.b + 40)}, 0.8)`);
    leftGradient.addColorStop(1, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0)`);
    this.ctx.fillStyle = leftGradient;
    this.ctx.fillRect(x, y, bevelSize, height);
    
    // Bottom bevel (darker)
    const bottomGradient = this.ctx.createLinearGradient(x, y + height - bevelSize, x, y + height);
    bottomGradient.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0)`);
    bottomGradient.addColorStop(1, `rgba(${Math.max(0, rgb.r - 40)}, ${Math.max(0, rgb.g - 40)}, ${Math.max(0, rgb.b - 40)}, 0.8)`);
    this.ctx.fillStyle = bottomGradient;
    this.ctx.fillRect(x, y + height - bevelSize, width, bevelSize);
    
    // Right bevel (darker)
    const rightGradient = this.ctx.createLinearGradient(x + width - bevelSize, y, x + width, y);
    rightGradient.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0)`);
    rightGradient.addColorStop(1, `rgba(${Math.max(0, rgb.r - 40)}, ${Math.max(0, rgb.g - 40)}, ${Math.max(0, rgb.b - 40)}, 0.8)`);
    this.ctx.fillStyle = rightGradient;
    this.ctx.fillRect(x + width - bevelSize, y, bevelSize, height);
  }
  
  private drawAnimatedPattern(x: number, y: number, width: number, height: number, color: string, time: number, patternType: 'scrolling' | 'pulsing' | 'rotating' = 'scrolling'): void {
    const rgb = this.hexToRgb(color);
    if (!rgb) return;
    
    this.ctx.save();
    
    switch (patternType) {
      case 'scrolling':
        // Scrolling diagonal lines
        this.ctx.strokeStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.3)`;
        this.ctx.lineWidth = 2;
        const scrollOffset = (time * 50) % 40;
        for (let i = -2; i < Math.ceil(width / 40) + 2; i++) {
          const lineX = x + i * 40 - scrollOffset;
          this.ctx.beginPath();
          this.ctx.moveTo(lineX, y);
          this.ctx.lineTo(lineX + 20, y + height);
          this.ctx.stroke();
        }
        break;
        
      case 'pulsing':
        // Pulsing glow
        const pulse = 0.5 + 0.5 * Math.sin(time * 3);
        const pulseGradient = this.ctx.createRadialGradient(x + width/2, y + height/2, 0, x + width/2, y + height/2, Math.max(width, height) * pulse);
        pulseGradient.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${0.3 * pulse})`);
        pulseGradient.addColorStop(1, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0)`);
        this.ctx.fillStyle = pulseGradient;
        this.ctx.fillRect(x, y, width, height);
        break;
        
      case 'rotating':
        // Rotating pattern
        this.ctx.translate(x + width/2, y + height/2);
        this.ctx.rotate(time * 0.5);
        this.ctx.strokeStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.4)`;
        this.ctx.lineWidth = 2;
        for (let i = 0; i < 4; i++) {
          const angle = (i / 4) * Math.PI * 2;
          this.ctx.beginPath();
          this.ctx.moveTo(0, 0);
          this.ctx.lineTo(Math.cos(angle) * Math.max(width, height)/2, Math.sin(angle) * Math.max(width, height)/2);
          this.ctx.stroke();
        }
        break;
    }
    
    this.ctx.restore();
  }
  
  clear(): void {
    // Note: Camera offset is applied in Game.render(), so we don't apply it here
    // Just clear and draw background normally
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Reset canvas state to prevent smearing from previous frames
    // (transforms are applied after clear, so we don't reset those here)
    this.ctx.globalAlpha = 1.0;
    this.ctx.shadowBlur = 0;
    this.ctx.shadowColor = 'transparent';
    
    // Special rendering for Level 1
    if (this.currentLevel === 1) {
      // Draw dark blue-black gradient background
      const gradient = this.ctx.createLinearGradient(0, 0, 0, this.canvas.height);
      gradient.addColorStop(0, '#000000'); // Black
      gradient.addColorStop(1, '#0a0a2e'); // Dark blue
      this.ctx.fillStyle = gradient;
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      
      // Draw static glowing shapes (in world space, account for camera offset)
      for (const element of this.level1StaticElements) {
        // Check if element is visible in viewport (accounting for camera offset)
        const elementScreenX = element.x; // X is in world space
        const elementScreenY = element.y - this.cameraOffsetY; // Y is affected by camera offset
        
        // Only draw if element is within viewport bounds (with buffer)
        const buffer = element.size * 2;
        if (elementScreenX + element.size + buffer < 0 || 
            elementScreenX - buffer > this.canvas.width ||
            elementScreenY + element.size + buffer < 0 || 
            elementScreenY - buffer > this.canvas.height) {
          continue; // Element is outside viewport
        }
        
        this.ctx.save();
        this.ctx.globalAlpha = element.opacity;
        
        // Apply camera offset manually since background is drawn before camera transform
        // Draw elements at their screen positions (world position - camera offset)
        const screenX = element.x;
        const screenY = element.y - this.cameraOffsetY;
        
        // Add glow effect
        this.drawGlowAura(screenX, screenY, element.size, element.color, 'soft');
        
        // Draw the shape
        switch (element.type) {
          case 'star':
            this.drawStar(screenX, screenY, element.size, element.color);
            break;
          case 'circle':
            this.drawCircle(screenX, screenY, element.size, element.color);
            break;
          case 'polygon':
            this.drawIrregularPolygon(screenX, screenY, element.size, element.color);
            break;
        }
        
        this.ctx.restore();
      }
      
      return; // Don't draw parallax layers for Level 1
    }
    
    // Draw base background using background theme (for other levels)
    const themeConfig = getBackgroundThemeConfig(this.currentBackgroundTheme);
    if (themeConfig.backgroundColorSecondary) {
      // Draw gradient background
      const gradient = this.ctx.createLinearGradient(0, 0, 0, this.canvas.height);
      gradient.addColorStop(0, themeConfig.backgroundColor);
      gradient.addColorStop(1, themeConfig.backgroundColorSecondary);
      this.ctx.fillStyle = gradient;
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    } else {
      // Draw solid background
      this.ctx.fillStyle = themeConfig.backgroundColor;
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }
    
    // Draw background layers (farthest to nearest)
    for (const layer of this.backgroundLayers) {
      for (const element of layer.elements) {
        this.drawBackgroundElement(element, layer);
      }
    }
    
    // Apply color grading overlay for biome atmosphere
    if (this.currentLevel !== 1) {
      this.applyColorGrading();
    }
  }
  
  drawBall(ball: Ball): void {
    // Enhanced rendering for Level 1 - bright blue glowing orb
    if (this.currentLevel === 1) {
      this.ctx.save();
      
      // Stronger glow effect for Level 1
      const ballColor = '#4a90e2'; // Bright blue
      this.drawGlowAura(ball.position.x, ball.position.y, ball.radius * 2, ballColor, 'intense');
      
      // Draw main ball with bright blue gradient
      const gradient = this.ctx.createRadialGradient(
        ball.position.x - ball.radius/3, 
        ball.position.y - ball.radius/3, 
        ball.radius * 0.2,
        ball.position.x, 
        ball.position.y, 
        ball.radius
      );
      gradient.addColorStop(0, '#6bb6ff'); // Light blue center
      gradient.addColorStop(0.5, ballColor); // Bright blue
      gradient.addColorStop(1, '#2e5c8a'); // Darker blue edge
      
      this.ctx.fillStyle = gradient;
      this.ctx.beginPath();
      this.ctx.arc(ball.position.x, ball.position.y, ball.radius, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.closePath();
      
      // Enhanced highlight for Level 1
      this.ctx.beginPath();
      this.ctx.arc(
        ball.position.x - ball.radius/3, 
        ball.position.y - ball.radius/3, 
        ball.radius/3, 
        0, 
        Math.PI * 2
      );
      const highlightGradient = this.ctx.createRadialGradient(
        ball.position.x - ball.radius/3,
        ball.position.y - ball.radius/3,
        0,
        ball.position.x - ball.radius/3,
        ball.position.y - ball.radius/3,
        ball.radius/3
      );
      highlightGradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
      highlightGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
      this.ctx.fillStyle = highlightGradient;
      this.ctx.fill();
      this.ctx.closePath();
      
      this.ctx.restore();
      return;
    }
    
    // Standard ball rendering for other levels
    // Draw glow effect (shadow)
    this.ctx.save();
    this.ctx.shadowBlur = 15;
    this.ctx.shadowColor = this.currentTheme.ballColor;
    this.ctx.shadowOffsetX = 0;
    this.ctx.shadowOffsetY = 0;
    
    this.ctx.beginPath();
    this.ctx.arc(ball.position.x, ball.position.y, ball.radius, 0, Math.PI * 2);
    
    // Ball with enhanced gradient based on theme
    const gradient = this.ctx.createRadialGradient(
      ball.position.x - ball.radius/3, 
      ball.position.y - ball.radius/3, 
      ball.radius * 0.2,
      ball.position.x, 
      ball.position.y, 
      ball.radius
    );
    gradient.addColorStop(0, this.currentTheme.ballColor);
    gradient.addColorStop(0.5, this.currentTheme.ballColor);
    gradient.addColorStop(1, this.currentTheme.ballHighlightColor);
    
    this.ctx.fillStyle = gradient;
    this.ctx.fill();
    this.ctx.closePath();
    
    // Enhanced ball highlight
    this.ctx.beginPath();
    this.ctx.arc(
      ball.position.x - ball.radius/3, 
      ball.position.y - ball.radius/3, 
      ball.radius/3, 
      0, 
      Math.PI * 2
    );
    const highlightGradient = this.ctx.createRadialGradient(
      ball.position.x - ball.radius/3,
      ball.position.y - ball.radius/3,
      0,
      ball.position.x - ball.radius/3,
      ball.position.y - ball.radius/3,
      ball.radius/3
    );
    highlightGradient.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
    highlightGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    this.ctx.fillStyle = highlightGradient;
    this.ctx.fill();
    this.ctx.closePath();
    
    this.ctx.restore();
  }
  
  drawObstacle(obstacle: Obstacle): void {
    const orientation = obstacle.orientation || 'vertical';
    
    // Use wallColor from config if available, otherwise fall back to theme colors
    let obstacleColor: string;
    let obstacleHighlight: string;
    
    if (obstacle.wallColor) {
      // Use config color
      obstacleColor = obstacle.wallColor;
      // Generate a slightly lighter/darker version for highlight
      const seed = Math.floor(obstacle.position.x * 1000 + obstacle.position.y);
      obstacleHighlight = generateColorVariation(obstacleColor, seed);
    } else {
      // Fall back to theme colors
      const baseObstacleColor = obstacle.theme === 'neon' ? '#00ff00' : 
                          obstacle.theme === 'lava' ? '#ef4444' : 
                          this.currentTheme.obstacleColor;
      const baseObstacleHighlight = obstacle.theme === 'neon' ? '#00cc00' : 
                             obstacle.theme === 'lava' ? '#dc2626' : 
                             this.currentTheme.obstacleHighlightColor;
      
      // Generate color variations using obstacle position as seed for consistency
      const seed = Math.floor(obstacle.position.x * 1000 + obstacle.position.y);
      obstacleColor = generateColorVariation(baseObstacleColor, seed);
      obstacleHighlight = generateColorVariation(baseObstacleHighlight, seed);
    }
    
    if (orientation === 'vertical') {
      // Vertical wall drawing
      // Vertical walls extend from top of world (0) to bottom of world (WORLD_HEIGHT)
      const gapTop = obstacle.position.y + obstacle.gapY - obstacle.gapHeight / 2;
      const gapBottom = obstacle.position.y + obstacle.gapY + obstacle.gapHeight / 2;
      
      // Top segment extends from world top (0) to gap top
      // Account for camera offset: when camera scrolls down (positive offset), 
      // the visible top of canvas is at world y = -cameraOffsetY
      // We need to ensure the wall extends to at least the visible top
      const visibleTopY = -this.cameraOffsetY;
      const topStartY = Math.min(0, visibleTopY);
      const topHeight = gapTop - topStartY;
      
      // Bottom segment extends from gap bottom to world bottom (WORLD_HEIGHT)
      // Account for camera offset: when camera scrolls up (negative offset),
      // the visible bottom of canvas is at world y = canvas.height - cameraOffsetY
      // We need to ensure the wall extends to at least the visible bottom
      const visibleBottomY = this.canvas.height - this.cameraOffsetY;
      const bottomStartY = gapBottom;
      const bottomEndY = Math.max(this.WORLD_HEIGHT, visibleBottomY);
      const bottomHeight = bottomEndY - bottomStartY;
      
      // Determine glow intensity based on wall style
      const style = obstacle.wallStyle || obstacle.obstacleType;
      const glowIntensity = style === 'spike' ? 'intense' : style === 'procedural' ? 'soft' : 'soft';
      
      // Draw outer glow aura around walls
      if (this.enableAdvancedEffects) {
        // Only draw glow if heights are valid
        if (topHeight > 0) {
          // Glow for top wall - draw at edges
          const topCenterY = topStartY + topHeight / 2;
          const topGlowSize = Math.min(obstacle.width, topHeight);
          if (topGlowSize > 0) {
            this.drawGlowAura(obstacle.position.x, topCenterY, topGlowSize, obstacleColor, glowIntensity);
            this.drawGlowAura(obstacle.position.x + obstacle.width, topCenterY, topGlowSize, obstacleColor, glowIntensity);
          }
        }
        
        if (bottomHeight > 0) {
          // Glow for bottom wall - draw at edges
          const bottomCenterY = bottomStartY + bottomHeight / 2;
          const bottomGlowSize = Math.min(obstacle.width, bottomHeight);
          if (bottomGlowSize > 0) {
            this.drawGlowAura(obstacle.position.x, bottomCenterY, bottomGlowSize, obstacleColor, glowIntensity);
            this.drawGlowAura(obstacle.position.x + obstacle.width, bottomCenterY, bottomGlowSize, obstacleColor, glowIntensity);
          }
        }
      }
      
      // Draw shadow for top obstacle
      this.ctx.save();
      this.ctx.shadowBlur = 8;
      this.ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
      this.ctx.shadowOffsetX = 3;
      this.ctx.shadowOffsetY = 3;
      
      // Draw top obstacle with gradient
      const topGradient = this.ctx.createLinearGradient(
        obstacle.position.x, topStartY,
        obstacle.position.x + obstacle.width, topStartY
      );
      topGradient.addColorStop(0, obstacleColor);
      topGradient.addColorStop(0.5, obstacleHighlight);
      topGradient.addColorStop(1, obstacleColor);
      
      this.ctx.fillStyle = topGradient;
      this.ctx.fillRect(
        obstacle.position.x,
        topStartY,
        obstacle.width,
        topHeight
      );
      
      // Add texture based on wall style
      if (this.enableAdvancedEffects) {
        const textureType = style === 'pipe' ? 'metal' : style === 'procedural' ? 'stone' : 'noise';
        this.drawWallTexture(obstacle.position.x, topStartY, obstacle.width, topHeight, obstacleColor, textureType);
      }
      
      // Apply glassmorphism effect
      this.drawGlassmorphism(
        obstacle.position.x,
        topStartY,
        obstacle.width,
        topHeight,
        obstacleColor,
        0.25
      );
      
      // Add beveled edges for 3D effect
      if (this.enableAdvancedEffects) {
        this.drawBeveledEdge(obstacle.position.x, topStartY, obstacle.width, topHeight, obstacleColor, 5);
      }
      
      // Add color bleed effect
      this.drawColorBleed(
        obstacle.position.x,
        topStartY,
        obstacle.width,
        topHeight,
        obstacleColor,
        0.12
      );
      
      // Add animated pattern for moving walls
      if (style === 'moving' && this.enableAdvancedEffects) {
        const time = Date.now() / 1000;
        this.drawAnimatedPattern(obstacle.position.x, topStartY, obstacle.width, topHeight, obstacleColor, time, 'scrolling');
      }
      
      // Add highlight edge to top obstacle
      const topHighlightGradient = this.ctx.createLinearGradient(
        obstacle.position.x, topStartY,
        obstacle.position.x, topStartY + 15
      );
      topHighlightGradient.addColorStop(0, 'rgba(255, 255, 255, 0.3)');
      topHighlightGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
      this.ctx.fillStyle = topHighlightGradient;
      this.ctx.fillRect(
        obstacle.position.x,
        topStartY,
        obstacle.width,
        Math.min(15, topHeight)
      );
      
      this.ctx.restore();
      
      // Draw shadow for bottom obstacle
      this.ctx.save();
      this.ctx.shadowBlur = 8;
      this.ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
      this.ctx.shadowOffsetX = 3;
      this.ctx.shadowOffsetY = 3;
      
      // Draw bottom obstacle with gradient
      const bottomGradient = this.ctx.createLinearGradient(
        obstacle.position.x, bottomStartY,
        obstacle.position.x + obstacle.width, bottomStartY
      );
      bottomGradient.addColorStop(0, obstacleColor);
      bottomGradient.addColorStop(0.5, obstacleHighlight);
      bottomGradient.addColorStop(1, obstacleColor);
      
      this.ctx.fillStyle = bottomGradient;
      this.ctx.fillRect(
        obstacle.position.x,
        bottomStartY,
        obstacle.width,
        bottomHeight
      );
      
      // Add texture based on wall style
      if (this.enableAdvancedEffects) {
        const textureType = style === 'pipe' ? 'metal' : style === 'procedural' ? 'stone' : 'noise';
        this.drawWallTexture(obstacle.position.x, bottomStartY, obstacle.width, bottomHeight, obstacleColor, textureType);
      }
      
      // Apply glassmorphism effect
      this.drawGlassmorphism(
        obstacle.position.x,
        bottomStartY,
        obstacle.width,
        bottomHeight,
        obstacleColor,
        0.25
      );
      
      // Add beveled edges for 3D effect
      if (this.enableAdvancedEffects) {
        this.drawBeveledEdge(obstacle.position.x, bottomStartY, obstacle.width, bottomHeight, obstacleColor, 5);
      }
      
      // Add color bleed effect
      this.drawColorBleed(
        obstacle.position.x,
        bottomStartY,
        obstacle.width,
        bottomHeight,
        obstacleColor,
        0.12
      );
      
      // Add animated pattern for moving walls
      if (style === 'moving' && this.enableAdvancedEffects) {
        const time = Date.now() / 1000;
        this.drawAnimatedPattern(obstacle.position.x, bottomStartY, obstacle.width, bottomHeight, obstacleColor, time, 'scrolling');
      }
      
      // Add highlight edge to bottom obstacle
      const bottomHighlightGradient = this.ctx.createLinearGradient(
        obstacle.position.x, bottomStartY,
        obstacle.position.x, bottomStartY + 15
      );
      bottomHighlightGradient.addColorStop(0, 'rgba(255, 255, 255, 0.3)');
      bottomHighlightGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
      this.ctx.fillStyle = bottomHighlightGradient;
      this.ctx.fillRect(
        obstacle.position.x,
        bottomStartY,
        obstacle.width,
        Math.min(15, bottomHeight)
      );
      
      this.ctx.restore();
      
      // Draw special effects based on obstacle type and style
      // (style already declared above)
      
      // Spikes removed from gaps as per user request
      // if (style === 'spike' || obstacle.obstacleType === 'spike') {
      //   // Draw spikes on the edges of the gap with enhanced glow
      //   const spikeCount = Math.floor(obstacle.width / 15); // More spikes for wider walls
      //   for (let i = 0; i < spikeCount; i++) {
      //     // Distribute spikes evenly along the wall width, centered in each segment
      //     const spikeX = obstacle.position.x + ((i + 0.5) / spikeCount) * obstacle.width;
      //     
      //     // Add glow to spike tips
      //     if (this.enableAdvancedEffects) {
      //       this.drawGlowAura(spikeX, gapTop, 12, obstacleColor, 'intense');
      //       this.drawGlowAura(spikeX, gapBottom, 12, obstacleColor, 'intense');
      //     }
      //     
      //     this.ctx.fillStyle = obstacleColor;
      //     this.drawSpike(spikeX, gapTop, 8, 12, 'up'); // Top spikes
      //     this.drawSpike(spikeX, gapBottom, 8, 12, 'down'); // Bottom spikes
      //   }
      // } else 
      if (style === 'moving' || obstacle.obstacleType === 'moving') {
        // Add a visual indicator for moving obstacles (animated arrow pattern)
        this.ctx.fillStyle = '#fbbf24'; // amber-400
        const arrowCount = Math.floor(obstacle.width / 20);
        for (let i = 0; i < arrowCount; i++) {
          const arrowX = obstacle.position.x + (i / arrowCount) * obstacle.width;
          this.drawArrow(arrowX, gapTop - 10, 6, 'up'); // Top arrows
          this.drawArrow(arrowX, gapBottom + 10, 6, 'down'); // Bottom arrows
        }
      } else if (style === 'procedural') {
        // Draw procedural pattern (random dots/texture)
        this.ctx.fillStyle = obstacleHighlight;
        const patternDensity = Math.floor((obstacle.width * topHeight) / 400);
        const seed = Math.floor(obstacle.position.x * 1000);
        for (let i = 0; i < patternDensity; i++) {
          // Seeded random for consistency
          const random = ((seed + i * 9301) % 233280) / 233280;
          const dotX = obstacle.position.x + (random * obstacle.width);
          const dotY = topStartY + (random * topHeight);
          this.ctx.beginPath();
          this.ctx.arc(dotX, dotY, 2, 0, Math.PI * 2);
          this.ctx.fill();
        }
        
        // Also draw on bottom part
        const bottomPatternDensity = Math.floor((obstacle.width * bottomHeight) / 400);
        for (let i = 0; i < bottomPatternDensity; i++) {
          const random = ((seed + (i + patternDensity) * 9301) % 233280) / 233280;
          const dotX = obstacle.position.x + (random * obstacle.width);
          const dotY = bottomStartY + (random * bottomHeight);
          this.ctx.beginPath();
          this.ctx.arc(dotX, dotY, 2, 0, Math.PI * 2);
          this.ctx.fill();
        }
      }
    } else {
      // Horizontal wall drawing - same logic as vertical but rotated
      // Horizontal walls span the entire canvas width (0 to canvas.width)
      const canvasLeft = 0;
      const canvasRight = this.canvas.width;
      
      // Handle walls without gaps (solid walls) - render as full wall
      if (!obstacle.gapX || !obstacle.gapWidth || obstacle.gapWidth <= 0) {
        // Render solid wall (no gap) - use the same color logic as walls with gaps
        const solidGradient = this.ctx.createLinearGradient(
          canvasLeft, obstacle.position.y,
          canvasRight, obstacle.position.y
        );
        solidGradient.addColorStop(0, obstacleColor);
        solidGradient.addColorStop(0.5, obstacleHighlight);
        solidGradient.addColorStop(1, obstacleColor);
        
        this.ctx.save();
        this.ctx.shadowBlur = 8;
        this.ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
        this.ctx.shadowOffsetX = 3;
        this.ctx.shadowOffsetY = 3;
        this.ctx.fillStyle = solidGradient;
        this.ctx.fillRect(
          canvasLeft,
          obstacle.position.y,
          canvasRight - canvasLeft,
          obstacle.height
        );
        this.ctx.restore();
        return;
      }
      
      const gapLeft = obstacle.gapX - obstacle.gapWidth / 2;
      const gapRight = obstacle.gapX + obstacle.gapWidth / 2;
      
      // Determine glow intensity based on wall style
      const style = obstacle.wallStyle || obstacle.obstacleType;
      const glowIntensity = style === 'spike' ? 'intense' : style === 'procedural' ? 'soft' : 'soft';
      
      // Draw outer glow aura around walls
      if (this.enableAdvancedEffects) {
        const leftWidth = gapLeft - canvasLeft;
        const rightWidth = canvasRight - gapRight;
        
        // Glow for left wall - draw at edges
        if (leftWidth > 0 && obstacle.height > 0) {
          const leftCenterX = canvasLeft + leftWidth / 2;
          const leftGlowSize = Math.min(leftWidth, obstacle.height);
          if (leftGlowSize > 0) {
            this.drawGlowAura(leftCenterX, obstacle.position.y, leftGlowSize, obstacleColor, glowIntensity);
            this.drawGlowAura(leftCenterX, obstacle.position.y + obstacle.height, leftGlowSize, obstacleColor, glowIntensity);
          }
        }
        
        // Glow for right wall - draw at edges
        if (rightWidth > 0 && obstacle.height > 0) {
          const rightCenterX = gapRight + rightWidth / 2;
          const rightGlowSize = Math.min(rightWidth, obstacle.height);
          if (rightGlowSize > 0) {
            this.drawGlowAura(rightCenterX, obstacle.position.y, rightGlowSize, obstacleColor, glowIntensity);
            this.drawGlowAura(rightCenterX, obstacle.position.y + obstacle.height, rightGlowSize, obstacleColor, glowIntensity);
          }
        }
      }
      
      // Special glow effect for level transition gaps
      if (obstacle.isLevelTransition) {
        this.ctx.save();
        this.ctx.shadowBlur = 20;
        this.ctx.shadowColor = '#8b5cf6'; // purple glow
        this.ctx.shadowOffsetX = 0;
        this.ctx.shadowOffsetY = 0;
      }
      
      // Draw shadow for left obstacle
      this.ctx.save();
      this.ctx.shadowBlur = 8;
      this.ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
      this.ctx.shadowOffsetX = 3;
      this.ctx.shadowOffsetY = 3;
      
      const leftWidth = gapLeft - canvasLeft;
      if (leftWidth > 0) {
        // Draw left obstacle with gradient
        const leftGradient = this.ctx.createLinearGradient(
          canvasLeft, obstacle.position.y,
          gapLeft, obstacle.position.y
        );
        leftGradient.addColorStop(0, obstacleColor);
        leftGradient.addColorStop(0.5, obstacleHighlight);
        leftGradient.addColorStop(1, obstacleColor);
        
        this.ctx.fillStyle = leftGradient;
        this.ctx.fillRect(
          canvasLeft,
          obstacle.position.y,
          leftWidth,
          obstacle.height
        );
        
        // Apply glassmorphism effect
        this.drawGlassmorphism(
          canvasLeft,
          obstacle.position.y,
          leftWidth,
          obstacle.height,
          obstacleColor,
          0.25
        );
        
        // Add color bleed effect
        this.drawColorBleed(
          canvasLeft,
          obstacle.position.y,
          leftWidth,
          obstacle.height,
          obstacleColor,
          0.12
        );
        
        // Add highlight edge on the left side
        const leftHighlightGradient = this.ctx.createLinearGradient(
          canvasLeft, obstacle.position.y,
          canvasLeft + 15, obstacle.position.y
        );
        leftHighlightGradient.addColorStop(0, 'rgba(255, 255, 255, 0.3)');
        leftHighlightGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        this.ctx.fillStyle = leftHighlightGradient;
        this.ctx.fillRect(
          canvasLeft,
          obstacle.position.y,
          Math.min(15, leftWidth),
          obstacle.height
        );
      }
      
      this.ctx.restore();
      
      // Draw shadow for right obstacle
      this.ctx.save();
      this.ctx.shadowBlur = 8;
      this.ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
      this.ctx.shadowOffsetX = 3;
      this.ctx.shadowOffsetY = 3;
      
      const rightStart = gapRight;
      const rightWidth = canvasRight - gapRight;
      if (rightWidth > 0) {
        // Draw right obstacle with gradient
        const rightGradient = this.ctx.createLinearGradient(
          gapRight, obstacle.position.y,
          canvasRight, obstacle.position.y
        );
        rightGradient.addColorStop(0, obstacleColor);
        rightGradient.addColorStop(0.5, obstacleHighlight);
        rightGradient.addColorStop(1, obstacleColor);
        
        this.ctx.fillStyle = rightGradient;
        this.ctx.fillRect(
          rightStart,
          obstacle.position.y,
          rightWidth,
          obstacle.height
        );
        
        // Apply glassmorphism effect
        this.drawGlassmorphism(
          rightStart,
          obstacle.position.y,
          rightWidth,
          obstacle.height,
          obstacleColor,
          0.25
        );
        
        // Add color bleed effect
        this.drawColorBleed(
          rightStart,
          obstacle.position.y,
          rightWidth,
          obstacle.height,
          obstacleColor,
          0.12
        );
        
        // Add highlight edge on the right side
        const rightHighlightGradient = this.ctx.createLinearGradient(
          canvasRight - 15, obstacle.position.y,
          canvasRight, obstacle.position.y
        );
        rightHighlightGradient.addColorStop(0, 'rgba(255, 255, 255, 0)');
        rightHighlightGradient.addColorStop(1, 'rgba(255, 255, 255, 0.3)');
        this.ctx.fillStyle = rightHighlightGradient;
        this.ctx.fillRect(
          canvasRight - Math.min(15, rightWidth),
          obstacle.position.y,
          Math.min(15, rightWidth),
          obstacle.height
        );
      }
      
      this.ctx.restore();
      
      // Draw special effects based on obstacle type and style
      
      if (style === 'spike' || obstacle.obstacleType === 'spike') {
        // Draw spikes on the edges of the gap
        this.ctx.fillStyle = obstacleColor;
        const spikeCount = Math.floor(obstacle.height / 15);
        for (let i = 0; i < spikeCount; i++) {
          // Distribute spikes evenly along the wall height, centered in each segment
          const spikeY = obstacle.position.y + ((i + 0.5) / spikeCount) * obstacle.height;
          this.drawSpike(gapLeft, spikeY, 8, 12, 'right'); // Left spikes (pointing right)
          this.drawSpike(gapRight, spikeY, 8, 12, 'left'); // Right spikes (pointing left)
        }
      } else if (style === 'moving' || obstacle.obstacleType === 'moving') {
        // Add visual indicator for moving obstacles
        this.ctx.fillStyle = '#fbbf24'; // amber-400
        const arrowCount = Math.floor(obstacle.height / 20);
        for (let i = 0; i < arrowCount; i++) {
          const arrowY = obstacle.position.y + (i / arrowCount) * obstacle.height;
          this.drawArrow(gapLeft - 10, arrowY, 6, 'left'); // Left arrows
          this.drawArrow(gapRight + 10, arrowY, 6, 'right'); // Right arrows
        }
      } else if (style === 'procedural') {
        // Draw procedural pattern (random dots/texture)
        this.ctx.fillStyle = obstacleHighlight;
        const patternDensity = Math.floor((leftWidth * obstacle.height) / 400);
        const seed = Math.floor(obstacle.position.y * 1000);
        for (let i = 0; i < patternDensity; i++) {
          // Seeded random for consistency
          const random = ((seed + i * 9301) % 233280) / 233280;
          const dotX = canvasLeft + (random * leftWidth);
          const dotY = obstacle.position.y + (random * obstacle.height);
          this.ctx.beginPath();
          this.ctx.arc(dotX, dotY, 2, 0, Math.PI * 2);
          this.ctx.fill();
        }
        
        // Also draw on right part
        const rightPatternDensity = Math.floor((rightWidth * obstacle.height) / 400);
        for (let i = 0; i < rightPatternDensity; i++) {
          const random = ((seed + (i + patternDensity) * 9301) % 233280) / 233280;
          const dotX = gapRight + (random * rightWidth);
          const dotY = obstacle.position.y + (random * obstacle.height);
          this.ctx.beginPath();
          this.ctx.arc(dotX, dotY, 2, 0, Math.PI * 2);
          this.ctx.fill();
        }
      }
      
      if (obstacle.isLevelTransition) {
        this.ctx.restore();
      }
    }
  }
  
  private drawSpike(x: number, y: number, width: number, height: number, direction: 'up' | 'down' | 'left' | 'right'): void {
    this.ctx.beginPath();
    if (direction === 'up') {
      // Base at y, point extends upward
      this.ctx.moveTo(x - width/2, y);
      this.ctx.lineTo(x + width/2, y);
      this.ctx.lineTo(x, y - height);
    } else if (direction === 'down') {
      // Base at y, point extends downward
      this.ctx.moveTo(x - width/2, y);
      this.ctx.lineTo(x + width/2, y);
      this.ctx.lineTo(x, y + height);
    } else if (direction === 'left') {
      // Base ends at x (wall edge), point extends left
      this.ctx.moveTo(x, y - width/2);
      this.ctx.lineTo(x, y + width/2);
      this.ctx.lineTo(x - height, y);
    } else { // right
      // Base starts at x (wall edge), point extends right
      this.ctx.moveTo(x, y - width/2);
      this.ctx.lineTo(x, y + width/2);
      this.ctx.lineTo(x + height, y);
    }
    this.ctx.closePath();
    this.ctx.fill();
  }
  
  private drawArrow(x: number, y: number, size: number, direction: 'up' | 'down' | 'left' | 'right'): void {
    this.ctx.beginPath();
    if (direction === 'up') {
      this.ctx.moveTo(x, y - size);
      this.ctx.lineTo(x - size/2, y);
      this.ctx.lineTo(x + size/2, y);
    } else if (direction === 'down') {
      this.ctx.moveTo(x, y + size);
      this.ctx.lineTo(x - size/2, y);
      this.ctx.lineTo(x + size/2, y);
    } else if (direction === 'left') {
      this.ctx.moveTo(x - size, y);
      this.ctx.lineTo(x, y - size/2);
      this.ctx.lineTo(x, y + size/2);
    } else { // right
      this.ctx.moveTo(x + size, y);
      this.ctx.lineTo(x, y - size/2);
      this.ctx.lineTo(x, y + size/2);
    }
    this.ctx.closePath();
    this.ctx.fill();
  }
  
  // Draw a horizontal wall (can be at any Y position)
  private drawHorizontalWall(obstacle: Obstacle): void {
    // Horizontal walls can be at any X position (they scroll)
    // Calculate visible portion of wall on screen
    // Use visibility buffer like vertical walls (matching Game.ts viewportBuffer of 200px)
    const VISIBILITY_BUFFER = 200;
    const wallLeft = obstacle.position.x;
    const wallRight = obstacle.position.x + obstacle.width;
    const canvasLeft = 0;
    const canvasRight = this.canvas.width;
    
    // Only draw if wall is visible on screen (with buffer for partially visible walls)
    if (wallRight < canvasLeft - VISIBILITY_BUFFER || wallLeft > canvasRight + VISIBILITY_BUFFER) {
      return; // Wall is completely off-screen
    }
    
    // Calculate visible portion
    const visibleLeft = Math.max(wallLeft, canvasLeft);
    const visibleRight = Math.min(wallRight, canvasRight);
    
    // Use wallColor from config if available, otherwise fall back to theme colors
    let obstacleColor: string;
    let obstacleHighlight: string;
    
    if (obstacle.wallColor) {
      obstacleColor = obstacle.wallColor;
      const seed = Math.floor(obstacle.position.x * 1000 + obstacle.position.y);
      obstacleHighlight = generateColorVariation(obstacleColor, seed);
    } else {
      const baseObstacleColor = obstacle.theme === 'neon' ? '#00ff00' : 
                          obstacle.theme === 'lava' ? '#ef4444' : 
                          this.currentTheme.obstacleColor;
      const baseObstacleHighlight = obstacle.theme === 'neon' ? '#00cc00' : 
                             obstacle.theme === 'lava' ? '#dc2626' : 
                             this.currentTheme.obstacleHighlightColor;
      
      const seed = Math.floor(obstacle.position.x * 1000 + obstacle.position.y);
      obstacleColor = generateColorVariation(baseObstacleColor, seed);
      obstacleHighlight = generateColorVariation(baseObstacleHighlight, seed);
    }
    
    // Determine glow intensity based on wall style
    const style = obstacle.wallStyle || obstacle.obstacleType;
    const glowIntensity = style === 'spike' ? 'intense' : style === 'procedural' ? 'soft' : 'soft';
    
    // Handle walls without gaps (solid walls) - render as full wall
    // Only render as solid if gapWidth is 0 or gap doesn't exist
    if (!obstacle.gapX || !obstacle.gapWidth || obstacle.gapWidth <= 0) {
      // Render solid wall (no gap)
      const solidGradient = this.ctx.createLinearGradient(
        visibleLeft, obstacle.position.y,
        visibleRight, obstacle.position.y
      );
      solidGradient.addColorStop(0, obstacleColor);
      solidGradient.addColorStop(0.5, obstacleHighlight);
      solidGradient.addColorStop(1, obstacleColor);
      
      // Draw outer glow aura around wall
      if (this.enableAdvancedEffects) {
        const wallCenterX = visibleLeft + (visibleRight - visibleLeft) / 2;
        const glowSize = Math.min(visibleRight - visibleLeft, obstacle.height);
        if (glowSize > 0) {
          this.drawGlowAura(wallCenterX, obstacle.position.y, glowSize, obstacleColor, glowIntensity);
          this.drawGlowAura(wallCenterX, obstacle.position.y + obstacle.height, glowSize, obstacleColor, glowIntensity);
        }
      }
      
      // Special glow effect for level transition gaps
      if (obstacle.isLevelTransition) {
        this.ctx.save();
        this.ctx.shadowBlur = 20;
        this.ctx.shadowColor = '#8b5cf6'; // purple glow
        this.ctx.shadowOffsetX = 0;
        this.ctx.shadowOffsetY = 0;
      }
      
      this.ctx.save();
      this.ctx.shadowBlur = 8;
      this.ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
      this.ctx.shadowOffsetX = 3;
      this.ctx.shadowOffsetY = 3;
      this.ctx.fillStyle = solidGradient;
      this.ctx.fillRect(
        visibleLeft,
        obstacle.position.y,
        visibleRight - visibleLeft,
        obstacle.height
      );
      
      // Add texture based on wall style
      if (this.enableAdvancedEffects) {
        const textureType = style === 'pipe' ? 'metal' : style === 'procedural' ? 'stone' : 'noise';
        this.drawWallTexture(visibleLeft, obstacle.position.y, visibleRight - visibleLeft, obstacle.height, obstacleColor, textureType);
      }
      
      // Apply glassmorphism effect
      this.drawGlassmorphism(
        visibleLeft,
        obstacle.position.y,
        visibleRight - visibleLeft,
        obstacle.height,
        obstacleColor,
        0.25
      );
      
      // Add beveled edges for 3D effect
      if (this.enableAdvancedEffects) {
        this.drawBeveledEdge(visibleLeft, obstacle.position.y, visibleRight - visibleLeft, obstacle.height, obstacleColor, 5);
      }
      
      // Add color bleed effect
      this.drawColorBleed(
        visibleLeft,
        obstacle.position.y,
        visibleRight - visibleLeft,
        obstacle.height,
        obstacleColor,
        0.12
      );
      
      // Add animated pattern for moving walls
      if (style === 'moving' && this.enableAdvancedEffects) {
        const time = Date.now() / 1000;
        this.drawAnimatedPattern(visibleLeft, obstacle.position.y, visibleRight - visibleLeft, obstacle.height, obstacleColor, time, 'scrolling');
      }
      
      this.ctx.restore();
      
      if (obstacle.isLevelTransition) {
        this.ctx.restore();
      }
      return;
    }
    
    // Wall has a gap - render with gap
    const gapLeft = obstacle.gapX - obstacle.gapWidth / 2;
    const gapRight = obstacle.gapX + obstacle.gapWidth / 2;
    
    // Draw outer glow aura around walls
    if (this.enableAdvancedEffects) {
      const leftWidth = Math.max(0, Math.min(gapLeft, visibleRight) - visibleLeft);
      const rightWidth = Math.max(0, visibleRight - Math.max(gapRight, visibleLeft));
      
      // Glow for left wall - draw at edges
      if (leftWidth > 0 && obstacle.height > 0) {
        const leftCenterX = visibleLeft + leftWidth / 2;
        const leftGlowSize = Math.min(leftWidth, obstacle.height);
        if (leftGlowSize > 0) {
          this.drawGlowAura(leftCenterX, obstacle.position.y, leftGlowSize, obstacleColor, glowIntensity);
          this.drawGlowAura(leftCenterX, obstacle.position.y + obstacle.height, leftGlowSize, obstacleColor, glowIntensity);
        }
      }
      
      // Glow for right wall - draw at edges
      if (rightWidth > 0 && obstacle.height > 0) {
        const rightCenterX = Math.max(gapRight, visibleLeft) + rightWidth / 2;
        const rightGlowSize = Math.min(rightWidth, obstacle.height);
        if (rightGlowSize > 0) {
          this.drawGlowAura(rightCenterX, obstacle.position.y, rightGlowSize, obstacleColor, glowIntensity);
          this.drawGlowAura(rightCenterX, obstacle.position.y + obstacle.height, rightGlowSize, obstacleColor, glowIntensity);
        }
      }
    }
    
    // Special glow effect for level transition gaps
    if (obstacle.isLevelTransition) {
      this.ctx.save();
      this.ctx.shadowBlur = 20;
      this.ctx.shadowColor = '#8b5cf6'; // purple glow
      this.ctx.shadowOffsetX = 0;
      this.ctx.shadowOffsetY = 0;
    }
    
    // Draw shadow for left obstacle
    this.ctx.save();
    this.ctx.shadowBlur = 8;
    this.ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
    this.ctx.shadowOffsetX = 3;
    this.ctx.shadowOffsetY = 3;
    
    // Draw left wall segment (from visible left edge to gap, or to visible right if gap is off-screen)
    // Handle case where gap might be partially or fully off-screen
    const leftSegmentStart = visibleLeft;
    const leftSegmentEnd = Math.min(Math.max(gapLeft, visibleLeft), visibleRight);
    const leftSegmentWidth = leftSegmentEnd - leftSegmentStart;
    
    if (leftSegmentWidth > 0 && gapLeft > visibleLeft) {
      const leftGradient = this.ctx.createLinearGradient(
        leftSegmentStart, obstacle.position.y,
        leftSegmentEnd, obstacle.position.y
      );
      leftGradient.addColorStop(0, obstacleColor);
      leftGradient.addColorStop(0.5, obstacleHighlight);
      leftGradient.addColorStop(1, obstacleColor);
      
      this.ctx.fillStyle = leftGradient;
      this.ctx.fillRect(
        leftSegmentStart,
        obstacle.position.y,
        leftSegmentWidth,
        obstacle.height
      );
      
      // Add texture based on wall style
      if (this.enableAdvancedEffects) {
        const textureType = style === 'pipe' ? 'metal' : style === 'procedural' ? 'stone' : 'noise';
        this.drawWallTexture(leftSegmentStart, obstacle.position.y, leftSegmentWidth, obstacle.height, obstacleColor, textureType);
      }
      
      // Apply glassmorphism effect
      this.drawGlassmorphism(
        leftSegmentStart,
        obstacle.position.y,
        leftSegmentWidth,
        obstacle.height,
        obstacleColor,
        0.25
      );
      
      // Add beveled edges for 3D effect
      if (this.enableAdvancedEffects) {
        this.drawBeveledEdge(leftSegmentStart, obstacle.position.y, leftSegmentWidth, obstacle.height, obstacleColor, 5);
      }
      
      // Add color bleed effect
      this.drawColorBleed(
        leftSegmentStart,
        obstacle.position.y,
        leftSegmentWidth,
        obstacle.height,
        obstacleColor,
        0.12
      );
      
      // Add animated pattern for moving walls
      if (style === 'moving' && this.enableAdvancedEffects) {
        const time = Date.now() / 1000;
        this.drawAnimatedPattern(leftSegmentStart, obstacle.position.y, leftSegmentWidth, obstacle.height, obstacleColor, time, 'scrolling');
      }
      
      // Add highlight edge on the left side (only if at wall's actual left edge)
      if (leftSegmentStart <= wallLeft + 5) {
        const highlightWidth = Math.min(15, leftSegmentWidth);
        if (highlightWidth > 0) {
          const leftHighlightGradient = this.ctx.createLinearGradient(
            leftSegmentStart, obstacle.position.y,
            leftSegmentStart + highlightWidth, obstacle.position.y
          );
          leftHighlightGradient.addColorStop(0, 'rgba(255, 255, 255, 0.3)');
          leftHighlightGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
          this.ctx.fillStyle = leftHighlightGradient;
          this.ctx.fillRect(
            leftSegmentStart,
            obstacle.position.y,
            highlightWidth,
            obstacle.height
          );
        }
      }
    }
    
    this.ctx.restore();
    
    // Draw shadow for right obstacle
    this.ctx.save();
    this.ctx.shadowBlur = 8;
    this.ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
    this.ctx.shadowOffsetX = 3;
    this.ctx.shadowOffsetY = 3;
    
    // Draw right wall segment (from gap to visible right edge)
    // Handle case where gap might be partially or fully off-screen
    const rightSegmentStart = Math.max(Math.min(gapRight, visibleRight), visibleLeft);
    const rightSegmentEnd = visibleRight;
    const rightSegmentWidth = rightSegmentEnd - rightSegmentStart;
    
    if (rightSegmentWidth > 0 && gapRight < visibleRight) {
      const rightGradient = this.ctx.createLinearGradient(
        rightSegmentStart, obstacle.position.y,
        rightSegmentEnd, obstacle.position.y
      );
      rightGradient.addColorStop(0, obstacleColor);
      rightGradient.addColorStop(0.5, obstacleHighlight);
      rightGradient.addColorStop(1, obstacleColor);
      
      this.ctx.fillStyle = rightGradient;
      this.ctx.fillRect(
        rightSegmentStart,
        obstacle.position.y,
        rightSegmentWidth,
        obstacle.height
      );
      
      // Add texture based on wall style
      if (this.enableAdvancedEffects) {
        const textureType = style === 'pipe' ? 'metal' : style === 'procedural' ? 'stone' : 'noise';
        this.drawWallTexture(rightSegmentStart, obstacle.position.y, rightSegmentWidth, obstacle.height, obstacleColor, textureType);
      }
      
      // Apply glassmorphism effect
      this.drawGlassmorphism(
        rightSegmentStart,
        obstacle.position.y,
        rightSegmentWidth,
        obstacle.height,
        obstacleColor,
        0.25
      );
      
      // Add beveled edges for 3D effect
      if (this.enableAdvancedEffects) {
        this.drawBeveledEdge(rightSegmentStart, obstacle.position.y, rightSegmentWidth, obstacle.height, obstacleColor, 5);
      }
      
      // Add color bleed effect
      this.drawColorBleed(
        rightSegmentStart,
        obstacle.position.y,
        rightSegmentWidth,
        obstacle.height,
        obstacleColor,
        0.12
      );
      
      // Add animated pattern for moving walls
      if (style === 'moving' && this.enableAdvancedEffects) {
        const time = Date.now() / 1000;
        this.drawAnimatedPattern(rightSegmentStart, obstacle.position.y, rightSegmentWidth, obstacle.height, obstacleColor, time, 'scrolling');
      }
      
      // Add highlight edge on the right side (only if at wall's actual right edge)
      if (rightSegmentEnd >= wallRight - 5) {
        const highlightWidth = Math.min(15, rightSegmentWidth);
        if (highlightWidth > 0) {
          const rightHighlightGradient = this.ctx.createLinearGradient(
            rightSegmentEnd - highlightWidth, obstacle.position.y,
            rightSegmentEnd, obstacle.position.y
          );
          rightHighlightGradient.addColorStop(0, 'rgba(255, 255, 255, 0)');
          rightHighlightGradient.addColorStop(1, 'rgba(255, 255, 255, 0.3)');
          this.ctx.fillStyle = rightHighlightGradient;
          this.ctx.fillRect(
            rightSegmentEnd - highlightWidth,
            obstacle.position.y,
            highlightWidth,
            obstacle.height
          );
        }
      }
    }
    
    this.ctx.restore();
    
    // Draw special effects based on obstacle type and style
    // Only draw gap decorations if gap is visible on screen
    if (gapRight >= visibleLeft && gapLeft <= visibleRight) {
      // Spikes removed from gaps as per user request
      // if (style === 'spike' || obstacle.obstacleType === 'spike') {
      //   // Draw spikes on the edges of the gap (only if visible)
      //   // For horizontal walls, spikes should be along the gap width (horizontal)
      //   // Top wall: spikes on bottom edge pointing down
      //   // Bottom wall: spikes on top edge pointing up
      //   this.ctx.fillStyle = obstacleColor;
      //   const gapTop = obstacle.position.y;
      //   const gapBottom = obstacle.position.y + obstacle.height;
      //   
      //   // Determine if this is a top wall (near y=0) or bottom wall (near bottom of canvas)
      //   const isTopWall = obstacle.position.y < this.canvas.height / 2;
      //   
      //   // Calculate visible gap bounds
      //   const visibleGapLeft = Math.max(gapLeft, visibleLeft);
      //   const visibleGapRight = Math.min(gapRight, visibleRight);
      //   const visibleGapWidth = visibleGapRight - visibleGapLeft;
      //   
      //   // Distribute spikes evenly along the gap width (horizontal direction)
      //   const spikeCount = Math.floor(visibleGapWidth / 15);
      //   for (let i = 0; i < spikeCount; i++) {
      //     // Distribute spikes evenly along the visible gap width, centered in each segment
      //     const spikeX = visibleGapLeft + ((i + 0.5) / spikeCount) * visibleGapWidth;
      //     
      //     // Add glow to spike tips
      //     if (this.enableAdvancedEffects) {
      //       if (isTopWall) {
      //         this.drawGlowAura(spikeX, gapBottom, 12, obstacleColor, 'intense');
      //       } else {
      //         this.drawGlowAura(spikeX, gapTop, 12, obstacleColor, 'intense');
      //       }
      //     }
      //     
      //     // Top wall: spikes on bottom edge pointing down
      //     // Bottom wall: spikes on top edge pointing up
      //     if (isTopWall) {
      //       // Top wall - spikes on bottom edge pointing down into gap
      //       this.drawSpike(spikeX, gapBottom, 8, 12, 'down');
      //     } else {
      //       // Bottom wall - spikes on top edge pointing up into gap
      //       this.drawSpike(spikeX, gapTop, 8, 12, 'up');
      //     }
      //   }
      // } else 
      if (style === 'moving' || obstacle.obstacleType === 'moving') {
        // Add visual indicator for moving obstacles
        // For horizontal walls, arrows should be along the gap width (horizontal)
        this.ctx.fillStyle = '#fbbf24'; // amber-400
        const gapTop = obstacle.position.y;
        const gapBottom = obstacle.position.y + obstacle.height;
        
        // Determine if this is a top wall or bottom wall
        const isTopWall = obstacle.position.y < this.canvas.height / 2;
        
        // Calculate visible gap bounds
        const visibleGapLeft = Math.max(gapLeft, visibleLeft);
        const visibleGapRight = Math.min(gapRight, visibleRight);
        const visibleGapWidth = visibleGapRight - visibleGapLeft;
        
        // Distribute arrows evenly along the gap width (horizontal direction)
        const arrowCount = Math.floor(visibleGapWidth / 20);
        for (let i = 0; i < arrowCount; i++) {
          const arrowX = visibleGapLeft + (i / arrowCount) * visibleGapWidth;
          
          // Top wall: arrows on bottom edge pointing down
          // Bottom wall: arrows on top edge pointing up
          if (isTopWall) {
            this.drawArrow(arrowX, gapBottom + 10, 6, 'down'); // Bottom arrows pointing down
          } else {
            this.drawArrow(arrowX, gapTop - 10, 6, 'up'); // Top arrows pointing up
          }
        }
      } else if (style === 'procedural') {
        // Draw procedural pattern (random dots/texture)
        this.ctx.fillStyle = obstacleHighlight;
        const leftSegmentWidth = Math.max(0, Math.min(gapLeft, visibleRight) - visibleLeft);
        const rightSegmentWidth = Math.max(0, visibleRight - Math.max(gapRight, visibleLeft));
        
        // Draw on left segment
        if (leftSegmentWidth > 0) {
          const patternDensity = Math.floor((leftSegmentWidth * obstacle.height) / 400);
          const seed = Math.floor(obstacle.position.x * 1000 + obstacle.position.y);
          for (let i = 0; i < patternDensity; i++) {
            // Seeded random for consistency
            const random = ((seed + i * 9301) % 233280) / 233280;
            const dotX = leftSegmentStart + (random * leftSegmentWidth);
            const dotY = obstacle.position.y + (random * obstacle.height);
            this.ctx.beginPath();
            this.ctx.arc(dotX, dotY, 2, 0, Math.PI * 2);
            this.ctx.fill();
          }
        }
        
        // Draw on right segment
        if (rightSegmentWidth > 0) {
          const rightPatternDensity = Math.floor((rightSegmentWidth * obstacle.height) / 400);
          const seed = Math.floor(obstacle.position.x * 1000 + obstacle.position.y);
          for (let i = 0; i < rightPatternDensity; i++) {
            const random = ((seed + (i + rightPatternDensity) * 9301) % 233280) / 233280;
            const dotX = rightSegmentStart + (random * rightSegmentWidth);
            const dotY = obstacle.position.y + (random * obstacle.height);
            this.ctx.beginPath();
            this.ctx.arc(dotX, dotY, 2, 0, Math.PI * 2);
            this.ctx.fill();
          }
        }
      }
    }
    
    if (obstacle.isLevelTransition) {
      this.ctx.restore();
    }
  }
  
  // Draw visual connection between vertical and horizontal walls
  drawWallConnection(verticalObstacle: Obstacle, horizontalObstacle: Obstacle): void {
    if (!verticalObstacle || !horizontalObstacle) return;
    if (verticalObstacle.orientation === 'horizontal' || horizontalObstacle.orientation !== 'horizontal') return;
    
    // Find intersection point
    const verticalX = verticalObstacle.position.x;
    const verticalWidth = verticalObstacle.width;
    const verticalCenterX = verticalX + verticalWidth / 2;
    
    // Horizontal walls can be at any X position (they scroll)
    const wallLeft = horizontalObstacle.position.x;
    const wallRight = horizontalObstacle.position.x + horizontalObstacle.width;
    const canvasLeft = 0;
    const canvasRight = this.canvas.width;
    
    // Check if vertical wall intersects with horizontal wall's X range
    const verticalLeft = verticalX;
    const verticalRight = verticalX + verticalWidth;
    const intersects = !(verticalRight < wallLeft || verticalLeft > wallRight);
    
    if (intersects && verticalCenterX >= canvasLeft && verticalCenterX <= canvasRight) {
      // Check if we're in the gap (if gap exists)
      if (horizontalObstacle.gapX && horizontalObstacle.gapWidth) {
        const gapLeft = horizontalObstacle.gapX - horizontalObstacle.gapWidth / 2;
        const gapRight = horizontalObstacle.gapX + horizontalObstacle.gapWidth / 2;
        
        // Only draw connection if vertical obstacle is NOT in the gap
        if (verticalCenterX >= gapLeft && verticalCenterX <= gapRight) {
          return; // Vertical obstacle is in gap, no connection needed
        }
      }
      
      // Get colors (use horizontal wall's color for consistency)
      let connectionColor: string;
      let connectionHighlight: string;
      if (horizontalObstacle.wallColor) {
        connectionColor = horizontalObstacle.wallColor;
        const seed = Math.floor(verticalX * 1000 + horizontalObstacle.position.y);
        connectionHighlight = generateColorVariation(connectionColor, seed);
      } else {
        connectionColor = horizontalObstacle.theme === 'neon' ? '#00ff00' : 
                         horizontalObstacle.theme === 'lava' ? '#ef4444' : 
                         this.currentTheme.obstacleColor;
        connectionHighlight = horizontalObstacle.theme === 'neon' ? '#00cc00' : 
                             horizontalObstacle.theme === 'lava' ? '#dc2626' : 
                             this.currentTheme.obstacleHighlightColor;
      }
      
      // Draw connection segment - create smooth bridge between walls
      this.ctx.save();
      
      // Draw shadow for connection
      this.ctx.shadowBlur = 6;
      this.ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
      this.ctx.shadowOffsetX = 2;
      this.ctx.shadowOffsetY = 2;
      
      // Always use seamless connections for better visual continuity
      // Extend the connection to match vertical obstacle width exactly
      const connectionHeight = horizontalObstacle.height;
      
      // Ensure connection aligns perfectly with vertical obstacle edges
      const verticalLeftEdge = verticalX;
      const verticalRightEdge = verticalX + verticalWidth;
      
      // Always extend connection to exact vertical obstacle edges for seamless look
      const finalConnectionX = verticalLeftEdge;
      const finalConnectionWidth = verticalWidth;
      
      // Create gradient for connection that matches horizontal wall style
      const connectionGradient = this.ctx.createLinearGradient(
        finalConnectionX, horizontalObstacle.position.y,
        finalConnectionX + finalConnectionWidth, horizontalObstacle.position.y
      );
      connectionGradient.addColorStop(0, connectionColor);
      connectionGradient.addColorStop(0.5, connectionHighlight);
      connectionGradient.addColorStop(1, connectionColor);
      
      this.ctx.fillStyle = connectionGradient;
      this.ctx.fillRect(
        finalConnectionX,
        horizontalObstacle.position.y,
        finalConnectionWidth,
        connectionHeight
      );
      
      // Add subtle highlight on top edge for depth
      const topHighlightGradient = this.ctx.createLinearGradient(
        finalConnectionX, horizontalObstacle.position.y,
        finalConnectionX, horizontalObstacle.position.y + 5
      );
      topHighlightGradient.addColorStop(0, 'rgba(255, 255, 255, 0.2)');
      topHighlightGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
      this.ctx.fillStyle = topHighlightGradient;
      this.ctx.fillRect(
        finalConnectionX,
        horizontalObstacle.position.y,
        finalConnectionWidth,
        Math.min(5, connectionHeight)
      );
      
      // Always extend horizontal wall segments to meet vertical obstacle for seamless appearance
      // This creates the appearance of one continuous structure
      if (horizontalObstacle.gapX && horizontalObstacle.gapWidth) {
        const gapLeft = horizontalObstacle.gapX - horizontalObstacle.gapWidth / 2;
        const gapRight = horizontalObstacle.gapX + horizontalObstacle.gapWidth / 2;
        
        // Draw extended left segment from wall start to vertical obstacle (if gap is to the right)
        if (gapLeft > verticalRightEdge) {
          const leftSegmentX = Math.max(horizontalObstacle.position.x, verticalRightEdge);
          const leftSegmentWidth = gapLeft - leftSegmentX;
          if (leftSegmentWidth > 0) {
            const leftGradient = this.ctx.createLinearGradient(
              leftSegmentX, horizontalObstacle.position.y,
              leftSegmentX + leftSegmentWidth, horizontalObstacle.position.y
            );
            leftGradient.addColorStop(0, connectionColor);
            leftGradient.addColorStop(0.5, connectionHighlight);
            leftGradient.addColorStop(1, connectionColor);
            this.ctx.fillStyle = leftGradient;
            this.ctx.fillRect(
              leftSegmentX,
              horizontalObstacle.position.y,
              leftSegmentWidth,
              connectionHeight
            );
          }
        }
        
        // Draw extended right segment from vertical obstacle to wall end (if gap is to the left)
        if (gapRight < verticalLeftEdge) {
          const rightSegmentX = gapRight;
          const rightSegmentWidth = Math.min(
            horizontalObstacle.position.x + horizontalObstacle.width,
            verticalLeftEdge
          ) - rightSegmentX;
          if (rightSegmentWidth > 0) {
            const rightGradient = this.ctx.createLinearGradient(
              rightSegmentX, horizontalObstacle.position.y,
              rightSegmentX + rightSegmentWidth, horizontalObstacle.position.y
            );
            rightGradient.addColorStop(0, connectionColor);
            rightGradient.addColorStop(0.5, connectionHighlight);
            rightGradient.addColorStop(1, connectionColor);
            this.ctx.fillStyle = rightGradient;
            this.ctx.fillRect(
              rightSegmentX,
              horizontalObstacle.position.y,
              rightSegmentWidth,
              connectionHeight
            );
          }
        }
      }
      
      this.ctx.restore();
    }
  }
  
  drawPowerUp(powerUp: PowerUp): void {
    if (powerUp.collected) return;
    
    this.ctx.save();
    
    // Apply rotation
    this.ctx.translate(powerUp.position.x, powerUp.position.y);
    this.ctx.rotate(powerUp.rotation * Math.PI / 180);
    
    // Apply pulse scale
    this.ctx.scale(powerUp.pulseScale, powerUp.pulseScale);
    
    // Get color based on type
    let color: string;
    let glowColor: string;
    
    switch (powerUp.type) {
      case 'score':
        color = '#fbbf24'; // amber-400
        glowColor = '#f59e0b'; // amber-500
        break;
      case 'life':
        color = '#10b981'; // green-500
        glowColor = '#059669'; // green-600
        break;
      case 'slowmo':
        color = '#8b5cf6'; // purple-500
        glowColor = '#7c3aed'; // purple-600
        break;
      case 'speedboost':
        color = '#f59e0b'; // amber-500
        glowColor = '#d97706'; // amber-600
        break;
      case 'shield':
        color = '#3b82f6'; // blue-500
        glowColor = '#2563eb'; // blue-600
        break;
      case 'magnet':
        color = '#06b6d4'; // cyan-500
        glowColor = '#0891b2'; // cyan-600
        break;
      case 'doublescore':
        color = '#fbbf24'; // amber-400
        glowColor = '#f59e0b'; // amber-500
        break;
      case 'gravityflip':
        color = '#ec4899'; // pink-500
        glowColor = '#db2777'; // pink-600
        break;
      default:
        color = '#6b7280'; // gray-500
        glowColor = '#4b5563'; // gray-600
    }
    
    // Draw glow effect
    this.ctx.shadowBlur = 15;
    this.ctx.shadowColor = glowColor;
    this.ctx.shadowOffsetX = 0;
    this.ctx.shadowOffsetY = 0;
    
    // Draw power-up based on type
    switch (powerUp.type) {
      case 'score':
        // Draw star shape
        this.drawStarShape(0, 0, powerUp.size / 2, color);
        break;
      case 'life':
        // Draw heart/plus shape
        this.drawHeartShape(0, 0, powerUp.size / 2, color);
        break;
      case 'slowmo':
        // Draw clock/hourglass shape
        this.drawClockShape(0, 0, powerUp.size / 2, color);
        break;
      case 'speedboost':
        // Draw lightning bolt shape
        this.drawLightningShape(0, 0, powerUp.size / 2, color);
        break;
      case 'shield':
        // Draw shield shape
        this.drawShieldShape(0, 0, powerUp.size / 2, color);
        break;
      case 'magnet':
        // Draw magnet shape
        this.drawMagnetShape(0, 0, powerUp.size / 2, color);
        break;
      case 'doublescore':
        // Draw double star shape
        this.drawDoubleStarShape(0, 0, powerUp.size / 2, color);
        break;
      case 'gravityflip':
        // Draw arrow up/down shape
        this.drawArrowShape(0, 0, powerUp.size / 2, color);
        break;
    }
    
    this.ctx.restore();
  }
  
  private drawStarShape(x: number, y: number, radius: number, color: string): void {
    this.ctx.fillStyle = color;
    this.ctx.beginPath();
    const spikes = 5;
    const outerRadius = radius;
    const innerRadius = radius * 0.4;
    
    for (let i = 0; i < spikes * 2; i++) {
      const r = i % 2 === 0 ? outerRadius : innerRadius;
      const angle = (i * Math.PI) / spikes - Math.PI / 2;
      const px = x + Math.cos(angle) * r;
      const py = y + Math.sin(angle) * r;
      
      if (i === 0) {
        this.ctx.moveTo(px, py);
      } else {
        this.ctx.lineTo(px, py);
      }
    }
    this.ctx.closePath();
    this.ctx.fill();
  }
  
  private drawHeartShape(x: number, y: number, size: number, color: string): void {
    this.ctx.fillStyle = color;
    this.ctx.beginPath();
    // Draw a simple plus/cross shape (easier than heart)
    const width = size * 0.3;
    const length = size;
    
    // Horizontal bar
    this.ctx.fillRect(x - length / 2, y - width / 2, length, width);
    // Vertical bar
    this.ctx.fillRect(x - width / 2, y - length / 2, width, length);
    
    // Add a circle in the center for better visibility
    this.ctx.beginPath();
    this.ctx.arc(x, y, size * 0.2, 0, Math.PI * 2);
    this.ctx.fill();
  }
  
  private drawClockShape(x: number, y: number, radius: number, color: string): void {
    // Draw a simple circle with hands
    this.ctx.strokeStyle = color;
    this.ctx.fillStyle = color;
    this.ctx.lineWidth = 2;
    
    // Outer circle
    this.ctx.beginPath();
    this.ctx.arc(x, y, radius, 0, Math.PI * 2);
    this.ctx.stroke();
    
    // Clock hands (simple lines)
    this.ctx.beginPath();
    // Hour hand (shorter)
    this.ctx.moveTo(x, y);
    this.ctx.lineTo(x, y - radius * 0.4);
    // Minute hand (longer)
    this.ctx.moveTo(x, y);
    this.ctx.lineTo(x + radius * 0.5, y);
    this.ctx.stroke();
    
    // Center dot
    this.ctx.beginPath();
    this.ctx.arc(x, y, radius * 0.15, 0, Math.PI * 2);
    this.ctx.fill();
  }
  
  private drawLightningShape(x: number, y: number, size: number, color: string): void {
    this.ctx.fillStyle = color;
    this.ctx.beginPath();
    // Draw a lightning bolt shape
    this.ctx.moveTo(x, y - size);
    this.ctx.lineTo(x + size * 0.3, y - size * 0.2);
    this.ctx.lineTo(x - size * 0.2, y);
    this.ctx.lineTo(x + size * 0.2, y);
    this.ctx.lineTo(x - size * 0.3, y + size * 0.2);
    this.ctx.lineTo(x, y + size);
    this.ctx.lineTo(x - size * 0.2, y + size * 0.3);
    this.ctx.lineTo(x + size * 0.3, y - size * 0.1);
    this.ctx.closePath();
    this.ctx.fill();
  }
  
  private drawShieldShape(x: number, y: number, radius: number, color: string): void {
    this.ctx.fillStyle = color;
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    // Draw a shield shape (rounded top, pointed bottom)
    this.ctx.moveTo(x, y - radius);
    this.ctx.quadraticCurveTo(x - radius * 0.8, y - radius * 0.5, x - radius * 0.6, y);
    this.ctx.lineTo(x, y + radius);
    this.ctx.lineTo(x + radius * 0.6, y);
    this.ctx.quadraticCurveTo(x + radius * 0.8, y - radius * 0.5, x, y - radius);
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.stroke();
  }
  
  private drawMagnetShape(x: number, y: number, size: number, color: string): void {
    this.ctx.fillStyle = color;
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = 2;
    // Draw a U-shaped magnet
    const width = size * 0.6;
    const height = size * 0.8;
    // Left vertical bar
    this.ctx.fillRect(x - size * 0.5, y - height / 2, width * 0.3, height);
    // Right vertical bar
    this.ctx.fillRect(x + size * 0.2, y - height / 2, width * 0.3, height);
    // Horizontal connector
    this.ctx.fillRect(x - size * 0.5, y - height / 2, size, width * 0.3);
  }
  
  private drawDoubleStarShape(x: number, y: number, radius: number, color: string): void {
    // Draw two overlapping stars
    this.drawStarShape(x - radius * 0.3, y, radius * 0.6, color);
    this.drawStarShape(x + radius * 0.3, y, radius * 0.6, color);
  }
  
  private drawArrowShape(x: number, y: number, size: number, color: string): void {
    this.ctx.fillStyle = color;
    this.ctx.beginPath();
    // Draw up and down arrows
    // Up arrow
    this.ctx.moveTo(x, y - size);
    this.ctx.lineTo(x - size * 0.3, y - size * 0.3);
    this.ctx.lineTo(x + size * 0.3, y - size * 0.3);
    this.ctx.closePath();
    this.ctx.fill();
    // Down arrow
    this.ctx.beginPath();
    this.ctx.moveTo(x, y + size);
    this.ctx.lineTo(x - size * 0.3, y + size * 0.3);
    this.ctx.lineTo(x + size * 0.3, y + size * 0.3);
    this.ctx.closePath();
    this.ctx.fill();
  }

  drawScore(score: number, level: number, progressToNextLevel: number): void {
    const text = `Score: ${score}`;
    const textMetrics = this.ctx.measureText(text);
    
    // Draw background with rounded corners effect
    const padding = 10;
    const bgX = this.canvas.width / 2 - textMetrics.width / 2 - padding;
    const bgY = 5;
    const bgWidth = textMetrics.width + padding * 2;
    const bgHeight = 30;
    
    // Draw shadow for background
    this.ctx.save();
    this.ctx.shadowBlur = 5;
    this.ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
    this.ctx.shadowOffsetX = 2;
    this.ctx.shadowOffsetY = 2;
    
    // Draw rounded rectangle background
    this.ctx.fillStyle = this.currentTheme.uiBackgroundColor;
    this.ctx.beginPath();
    const radius = 8;
    this.ctx.moveTo(bgX + radius, bgY);
    this.ctx.lineTo(bgX + bgWidth - radius, bgY);
    this.ctx.quadraticCurveTo(bgX + bgWidth, bgY, bgX + bgWidth, bgY + radius);
    this.ctx.lineTo(bgX + bgWidth, bgY + bgHeight - radius);
    this.ctx.quadraticCurveTo(bgX + bgWidth, bgY + bgHeight, bgX + bgWidth - radius, bgY + bgHeight);
    this.ctx.lineTo(bgX + radius, bgY + bgHeight);
    this.ctx.quadraticCurveTo(bgX, bgY + bgHeight, bgX, bgY + bgHeight - radius);
    this.ctx.lineTo(bgX, bgY + radius);
    this.ctx.quadraticCurveTo(bgX, bgY, bgX + radius, bgY);
    this.ctx.closePath();
    this.ctx.fill();
    
    this.ctx.restore();
    
    // Draw green progress bar overlay (on top of background, below text)
    if (progressToNextLevel > 0) {
      this.ctx.save();
      const progressWidth = bgWidth * progressToNextLevel;
      
      // Draw green progress bar with rounded corners
      this.ctx.fillStyle = '#10b981'; // green-500
      this.ctx.beginPath();
      
      if (progressWidth >= bgWidth) {
        // Progress bar fills entire width - use full rounded rectangle
        this.ctx.moveTo(bgX + radius, bgY);
        this.ctx.lineTo(bgX + bgWidth - radius, bgY);
        this.ctx.quadraticCurveTo(bgX + bgWidth, bgY, bgX + bgWidth, bgY + radius);
        this.ctx.lineTo(bgX + bgWidth, bgY + bgHeight - radius);
        this.ctx.quadraticCurveTo(bgX + bgWidth, bgY + bgHeight, bgX + bgWidth - radius, bgY + bgHeight);
        this.ctx.lineTo(bgX + radius, bgY + bgHeight);
        this.ctx.quadraticCurveTo(bgX, bgY + bgHeight, bgX, bgY + bgHeight - radius);
        this.ctx.lineTo(bgX, bgY + radius);
        this.ctx.quadraticCurveTo(bgX, bgY, bgX + radius, bgY);
      } else if (progressWidth > radius) {
        // Progress bar partially fills - rounded left, square right
        this.ctx.moveTo(bgX + radius, bgY);
        this.ctx.lineTo(bgX + progressWidth, bgY);
        this.ctx.lineTo(bgX + progressWidth, bgY + bgHeight);
        this.ctx.lineTo(bgX + radius, bgY + bgHeight);
        this.ctx.quadraticCurveTo(bgX, bgY + bgHeight, bgX, bgY + bgHeight - radius);
        this.ctx.lineTo(bgX, bgY + radius);
        this.ctx.quadraticCurveTo(bgX, bgY, bgX + radius, bgY);
      } else {
        // Progress bar is very small - use simple rounded rectangle
        this.ctx.arc(bgX + progressWidth / 2, bgY + bgHeight / 2, progressWidth / 2, 0, Math.PI * 2);
      }
      
      this.ctx.closePath();
      this.ctx.fill();
      
      this.ctx.restore();
    }
    
    // Draw text with shadow for better contrast
    this.ctx.save();
    this.ctx.shadowBlur = 2;
    this.ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    this.ctx.shadowOffsetX = 1;
    this.ctx.shadowOffsetY = 1;
    
    this.ctx.font = 'bold 24px Arial';
    this.ctx.fillStyle = this.currentTheme.textColor;
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'top';
    this.ctx.fillText(text, this.canvas.width / 2, 10);
    
    this.ctx.restore();
  }
  
  drawStyleMeter(level: string, points: number, progress: number, color: string): void {
    const meterX = this.canvas.width - 120;
    const meterY = 50;
    const meterWidth = 100;
    const meterHeight = 20;
    const radius = 10;
    
    // Draw background
    this.ctx.save();
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    this.ctx.beginPath();
    this.ctx.moveTo(meterX + radius, meterY);
    this.ctx.lineTo(meterX + meterWidth - radius, meterY);
    this.ctx.quadraticCurveTo(meterX + meterWidth, meterY, meterX + meterWidth, meterY + radius);
    this.ctx.lineTo(meterX + meterWidth, meterY + meterHeight - radius);
    this.ctx.quadraticCurveTo(meterX + meterWidth, meterY + meterHeight, meterX + meterWidth - radius, meterY + meterHeight);
    this.ctx.lineTo(meterX + radius, meterY + meterHeight);
    this.ctx.quadraticCurveTo(meterX, meterY + meterHeight, meterX, meterY + meterHeight - radius);
    this.ctx.lineTo(meterX, meterY + radius);
    this.ctx.quadraticCurveTo(meterX, meterY, meterX + radius, meterY);
    this.ctx.closePath();
    this.ctx.fill();
    
    // Draw progress bar
    if (progress > 0) {
      const progressWidth = meterWidth * progress;
      this.ctx.fillStyle = color;
      this.ctx.beginPath();
      if (progressWidth >= meterWidth) {
        this.ctx.moveTo(meterX + radius, meterY);
        this.ctx.lineTo(meterX + meterWidth - radius, meterY);
        this.ctx.quadraticCurveTo(meterX + meterWidth, meterY, meterX + meterWidth, meterY + radius);
        this.ctx.lineTo(meterX + meterWidth, meterY + meterHeight - radius);
        this.ctx.quadraticCurveTo(meterX + meterWidth, meterY + meterHeight, meterX + meterWidth - radius, meterY + meterHeight);
        this.ctx.lineTo(meterX + radius, meterY + meterHeight);
        this.ctx.quadraticCurveTo(meterX, meterY + meterHeight, meterX, meterY + meterHeight - radius);
        this.ctx.lineTo(meterX, meterY + radius);
        this.ctx.quadraticCurveTo(meterX, meterY, meterX + radius, meterY);
      } else if (progressWidth > radius) {
        this.ctx.moveTo(meterX + radius, meterY);
        this.ctx.lineTo(meterX + progressWidth, meterY);
        this.ctx.lineTo(meterX + progressWidth, meterY + meterHeight);
        this.ctx.lineTo(meterX + radius, meterY + meterHeight);
        this.ctx.quadraticCurveTo(meterX, meterY + meterHeight, meterX, meterY + meterHeight - radius);
        this.ctx.lineTo(meterX, meterY + radius);
        this.ctx.quadraticCurveTo(meterX, meterY, meterX + radius, meterY);
      } else {
        this.ctx.arc(meterX + progressWidth / 2, meterY + meterHeight / 2, progressWidth / 2, 0, Math.PI * 2);
      }
      this.ctx.closePath();
      this.ctx.fill();
    }
    
    // Draw level text
    this.ctx.font = 'bold 16px Arial';
    this.ctx.fillStyle = color;
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(level, meterX + meterWidth / 2, meterY + meterHeight / 2);
    
    this.ctx.restore();
  }
  
  drawComboCounter(count: number, multiplier: number): void {
    const comboX = this.canvas.width / 2;
    const comboY = 100;
    
    // Draw combo text with pulsing animation
    const pulseScale = 1.0 + Math.sin(performance.now() * 0.01) * 0.1;
    
    this.ctx.save();
    this.ctx.translate(comboX, comboY);
    this.ctx.scale(pulseScale, pulseScale);
    
    // Draw background
    const text = `COMBO x${count}`;
    this.ctx.font = 'bold 32px Arial';
    const metrics = this.ctx.measureText(text);
    const padding = 15;
    const bgWidth = metrics.width + padding * 2;
    const bgHeight = 50;
    
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    this.ctx.beginPath();
    const radius = 10;
    this.ctx.moveTo(-bgWidth / 2 + radius, -bgHeight / 2);
    this.ctx.lineTo(bgWidth / 2 - radius, -bgHeight / 2);
    this.ctx.quadraticCurveTo(bgWidth / 2, -bgHeight / 2, bgWidth / 2, -bgHeight / 2 + radius);
    this.ctx.lineTo(bgWidth / 2, bgHeight / 2 - radius);
    this.ctx.quadraticCurveTo(bgWidth / 2, bgHeight / 2, bgWidth / 2 - radius, bgHeight / 2);
    this.ctx.lineTo(-bgWidth / 2 + radius, bgHeight / 2);
    this.ctx.quadraticCurveTo(-bgWidth / 2, bgHeight / 2, -bgWidth / 2, bgHeight / 2 - radius);
    this.ctx.lineTo(-bgWidth / 2, -bgHeight / 2 + radius);
    this.ctx.quadraticCurveTo(-bgWidth / 2, -bgHeight / 2, -bgWidth / 2 + radius, -bgHeight / 2);
    this.ctx.closePath();
    this.ctx.fill();
    
    // Draw text
    this.ctx.fillStyle = '#fbbf24'; // amber
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(text, 0, 0);
    
    // Draw multiplier text below
    const multText = `${multiplier.toFixed(1)}x`;
    this.ctx.font = 'bold 20px Arial';
    this.ctx.fillStyle = '#10b981'; // green
    this.ctx.fillText(multText, 0, 30);
    
    this.ctx.restore();
  }
  
  drawStyleNotification(notification: { text: string; x: number; y: number; life: number; maxLife: number; scale: number; color: string }): void {
    const alpha = notification.life / notification.maxLife;
    
    this.ctx.save();
    
    // Set composite operation to prevent smearing
    this.ctx.globalCompositeOperation = 'source-over';
    
    // Set alpha and transform
    this.ctx.globalAlpha = alpha;
    this.ctx.translate(notification.x, notification.y);
    this.ctx.scale(notification.scale, notification.scale);
    
    // Set text properties
    this.ctx.font = 'bold 24px Arial';
    this.ctx.fillStyle = notification.color;
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    
    // Begin path to ensure clean rendering
    this.ctx.beginPath();
    
    // Draw glow effect
    this.ctx.shadowBlur = 10;
    this.ctx.shadowColor = notification.color;
    this.ctx.shadowOffsetX = 0;
    this.ctx.shadowOffsetY = 0;
    
    // Draw the text
    this.ctx.fillText(notification.text, 0, 0);
    
    // Immediately reset shadow properties to prevent smearing
    this.ctx.shadowBlur = 0;
    this.ctx.shadowColor = 'transparent';
    this.ctx.shadowOffsetX = 0;
    this.ctx.shadowOffsetY = 0;
    this.ctx.globalAlpha = 1.0;
    this.ctx.globalCompositeOperation = 'source-over';
    
    this.ctx.restore();
  }
  
  // Draw smooth horizontal walls by merging all walls at the same Y position
  drawHorizontalWalls(walls: Obstacle[]): void {
      if (walls.length === 0) return;

      // Draw all horizontal walls (they can be at any Y position now)
      // Walls are drawn with camera offset applied in Game.ts render method
      let renderedCount = 0;
      for (const wall of walls) {
        if (!wall) continue;
        
        // Only draw walls that are visible on screen (or partially visible)
        // Use a small buffer to ensure walls at the edge are still rendered
        const VISIBILITY_BUFFER = 10; // Small buffer for edge cases
        const wallLeft = wall.position.x;
        const wallRight = wall.position.x + wall.width;
        
        // Wall is visible if any part of it is on screen (with buffer)
        if (wallRight < -VISIBILITY_BUFFER || wallLeft > this.canvas.width + VISIBILITY_BUFFER) {
          continue; // Wall is completely off-screen
        }
        
        // Wall is visible - render it
        this.drawHorizontalWall(wall);
        renderedCount++;
        
        // Draw power-up if attached to wall
        if (wall.powerUp && !wall.powerUp.collected) {
          this.drawPowerUp(wall.powerUp);
        }
      }
      
      // Debug: Log if we have walls but none are rendering (only in development/debug mode)
      // Check for debug mode via environment or disable in production
      const isDebugMode = typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production';
      if (isDebugMode && walls.length > 0 && renderedCount === 0) {
        console.warn(`[Renderer] No horizontal walls rendered! Total: ${walls.length}`);
        walls.forEach((w, idx) => {
          if (w) {
            const wLeft = w.position.x;
            const wRight = w.position.x + w.width;
            console.log(`  Wall ${idx}: x=${wLeft.toFixed(1)}, width=${w.width.toFixed(1)}, right=${wRight.toFixed(1)}, canvasWidth=${this.canvas.width}`);
          }
        });
      }
    }
  
  // Draw a single smooth horizontal wall with all gaps merged
  private drawSmoothHorizontalWall(representativeWall: Obstacle, walls: Obstacle[]): void {
      const canvasLeft = 0;
      const canvasRight = this.canvas.width;
      const wallHeight = representativeWall.height;
      
      // Check if this is a top or bottom edge wall
      // Edge walls should stay fixed at screen edges, not move with camera
      // When this function is called, the camera transform should already be reset
      // We check the original world position to identify edge walls, but always render at screen coordinates
      const EDGE_TOLERANCE = 5; // Tolerance for identifying edge walls
      const isTopEdgeWall = Math.abs(representativeWall.position.y) < EDGE_TOLERANCE; // Top edge at world y=0
      const expectedBottomWorldY = this.canvas.height - wallHeight;
      const isBottomEdgeWall = Math.abs(representativeWall.position.y - expectedBottomWorldY) < EDGE_TOLERANCE; // Bottom edge at world y=canvas.height-wallHeight
      
      let wallY: number;
      if (isTopEdgeWall) {
        // Top edge wall: ALWAYS render at screen y=0 (fixed screen position, ignores world position)
        wallY = 0;
      } else if (isBottomEdgeWall) {
        // Bottom edge wall: ALWAYS render at screen y=canvas.height-wallHeight (fixed screen position)
        wallY = this.canvas.height - wallHeight;
      } else {
        // Other walls (non-edge): use world position (shouldn't happen for edge walls)
        // This is a fallback for any non-edge horizontal walls
        wallY = representativeWall.position.y;
      }
    
    // Get colors from representative wall
    let obstacleColor: string;
    let obstacleHighlight: string;
    
    if (representativeWall.wallColor) {
      obstacleColor = representativeWall.wallColor;
      const seed = Math.floor(representativeWall.position.x * 1000 + representativeWall.position.y);
      obstacleHighlight = generateColorVariation(obstacleColor, seed);
    } else {
      const baseObstacleColor = representativeWall.theme === 'neon' ? '#00ff00' : 
                          representativeWall.theme === 'lava' ? '#ef4444' : 
                          this.currentTheme.obstacleColor;
      const baseObstacleHighlight = representativeWall.theme === 'neon' ? '#00cc00' : 
                             representativeWall.theme === 'lava' ? '#dc2626' : 
                             this.currentTheme.obstacleHighlightColor;
      
      const seed = Math.floor(representativeWall.position.x * 1000 + representativeWall.position.y);
      obstacleColor = generateColorVariation(baseObstacleColor, seed);
      obstacleHighlight = generateColorVariation(baseObstacleHighlight, seed);
    }
    
    // Collect all gaps from all walls that are visible on screen
        // Gaps are horizontal (X coordinates) so they're not affected by vertical camera movement
        const gaps: Array<{ left: number; right: number }> = [];
        for (const wall of walls) {
          if (wall.gapX && wall.gapWidth) {
            const gapLeft = wall.gapX - wall.gapWidth / 2;
            const gapRight = wall.gapX + wall.gapWidth / 2;
            
            // Only include gaps that are at least partially visible on screen
            // Gaps are horizontal positions, so check against canvas width
            if (gapRight >= canvasLeft && gapLeft <= canvasRight) {
              // Clamp gap to canvas bounds to ensure continuity
              const clampedLeft = Math.max(canvasLeft, gapLeft);
              const clampedRight = Math.min(canvasRight, gapRight);
              
              // Only add gap if it's actually visible (not completely off-screen)
              if (clampedRight > clampedLeft) {
                gaps.push({
                  left: clampedLeft,
                  right: clampedRight
                });
              }
            }
          }
        }
    
    // Sort gaps by left position and merge overlapping gaps
    gaps.sort((a, b) => a.left - b.left);
    
    // Merge overlapping or adjacent gaps
    const mergedGaps: Array<{ left: number; right: number }> = [];
    for (const gap of gaps) {
      if (mergedGaps.length === 0) {
        mergedGaps.push(gap);
      } else {
        const lastGap = mergedGaps[mergedGaps.length - 1];
        // If this gap overlaps or is adjacent to the last gap, merge them
        if (gap.left <= lastGap.right) {
          lastGap.right = Math.max(lastGap.right, gap.right);
        } else {
          mergedGaps.push(gap);
        }
      }
    }
    
    // Use merged gaps
    const finalGaps = mergedGaps;
    
    // Determine glow intensity based on wall style
    const style = representativeWall.wallStyle || representativeWall.obstacleType;
    const glowIntensity = style === 'spike' ? 'intense' : style === 'procedural' ? 'soft' : 'soft';
    
    // Draw outer glow aura around walls
    if (this.enableAdvancedEffects && wallHeight > 0) {
      const wallCenterY = wallY + wallHeight / 2;
      // Draw glows at edges of wall segments
      let currentX = canvasLeft;
      if (finalGaps.length === 0) {
        // Full wall - glow at edges
        const fullWallGlowSize = Math.min(canvasRight - canvasLeft, wallHeight);
        if (fullWallGlowSize > 0) {
          this.drawGlowAura(canvasLeft, wallCenterY, fullWallGlowSize, obstacleColor, glowIntensity);
          this.drawGlowAura(canvasRight, wallCenterY, fullWallGlowSize, obstacleColor, glowIntensity);
        }
      } else {
        for (const gap of finalGaps) {
          if (gap.left > currentX) {
            const segmentCenterX = currentX + (gap.left - currentX) / 2;
            const segmentGlowSize = Math.min(gap.left - currentX, wallHeight);
            if (segmentGlowSize > 0) {
              this.drawGlowAura(segmentCenterX, wallCenterY, segmentGlowSize, obstacleColor, glowIntensity);
            }
          }
          currentX = Math.max(currentX, gap.right);
        }
        if (currentX < canvasRight) {
          const segmentCenterX = currentX + (canvasRight - currentX) / 2;
          const finalSegmentGlowSize = Math.min(canvasRight - currentX, wallHeight);
          if (finalSegmentGlowSize > 0) {
            this.drawGlowAura(segmentCenterX, wallCenterY, finalSegmentGlowSize, obstacleColor, glowIntensity);
          }
        }
      }
    }
    
    // Draw shadow
    this.ctx.save();
    this.ctx.shadowBlur = 8;
    this.ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
    this.ctx.shadowOffsetX = 3;
    this.ctx.shadowOffsetY = 3;
    
    // Draw wall segments between gaps
    let currentX = canvasLeft;
    
    // If no gaps, draw full wall
    if (finalGaps.length === 0) {
      const gradient = this.ctx.createLinearGradient(
        canvasLeft, wallY,
        canvasRight, wallY
      );
      gradient.addColorStop(0, obstacleColor);
      gradient.addColorStop(0.5, obstacleHighlight);
      gradient.addColorStop(1, obstacleColor);
      
      this.ctx.fillStyle = gradient;
      this.ctx.fillRect(canvasLeft, wallY, canvasRight - canvasLeft, wallHeight);
      
      // Apply glassmorphism effect
      this.drawGlassmorphism(
        canvasLeft,
        wallY,
        canvasRight - canvasLeft,
        wallHeight,
        obstacleColor,
        0.25
      );
      
      // Add color bleed effect
      this.drawColorBleed(
        canvasLeft,
        wallY,
        canvasRight - canvasLeft,
        wallHeight,
        obstacleColor,
        0.12
      );
    } else {
      // Draw wall segments between gaps - ensure continuous coverage from 0 to canvas.width
      for (const gap of finalGaps) {
        // Draw wall segment before this gap (from currentX to gap.left)
        if (gap.left > currentX) {
          const segmentWidth = gap.left - currentX;
          
          // Draw main wall segment
          const gradient = this.ctx.createLinearGradient(
            currentX, wallY,
            gap.left, wallY
          );
          gradient.addColorStop(0, obstacleColor);
          gradient.addColorStop(0.5, obstacleHighlight);
          gradient.addColorStop(1, obstacleColor);
          
          this.ctx.fillStyle = gradient;
          this.ctx.fillRect(currentX, wallY, segmentWidth, wallHeight);
          
          // Apply glassmorphism effect
          this.drawGlassmorphism(
            currentX,
            wallY,
            segmentWidth,
            wallHeight,
            obstacleColor,
            0.25
          );
          
          // Add color bleed effect
          this.drawColorBleed(
            currentX,
            wallY,
            segmentWidth,
            wallHeight,
            obstacleColor,
            0.12
          );
        }
        
        // Move past this gap
        currentX = Math.max(currentX, gap.right);
      }
      
      // Draw final wall segment after last gap (from currentX to canvasRight)
      // This ensures the wall is continuous all the way to the right edge
      if (currentX < canvasRight) {
        const segmentWidth = canvasRight - currentX;
        
        const gradient = this.ctx.createLinearGradient(
          currentX, wallY,
          canvasRight, wallY
        );
        gradient.addColorStop(0, obstacleColor);
        gradient.addColorStop(0.5, obstacleHighlight);
        gradient.addColorStop(1, obstacleColor);
        
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(currentX, wallY, segmentWidth, wallHeight);
        
        // Apply glassmorphism effect
        this.drawGlassmorphism(
          currentX,
          wallY,
          segmentWidth,
          wallHeight,
          obstacleColor,
          0.25
        );
        
        // Add color bleed effect
        this.drawColorBleed(
          currentX,
          wallY,
          segmentWidth,
          wallHeight,
          obstacleColor,
          0.12
        );
      }
    }
    
    // Add highlight edges - always draw left edge if there's a wall segment there
    if (finalGaps.length === 0 || finalGaps[0].left > canvasLeft) {
      const leftHighlightGradient = this.ctx.createLinearGradient(
        canvasLeft, wallY,
        canvasLeft + 15, wallY
      );
      leftHighlightGradient.addColorStop(0, 'rgba(255, 255, 255, 0.3)');
      leftHighlightGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
      this.ctx.fillStyle = leftHighlightGradient;
      const leftEdgeWidth = finalGaps.length > 0 ? Math.min(15, finalGaps[0].left - canvasLeft) : 15;
      if (leftEdgeWidth > 0) {
        this.ctx.fillRect(canvasLeft, wallY, leftEdgeWidth, wallHeight);
      }
    }
    
    // Always draw right edge if there's a wall segment there
    if (finalGaps.length === 0 || finalGaps[finalGaps.length - 1].right < canvasRight) {
      const rightHighlightGradient = this.ctx.createLinearGradient(
        canvasRight - 15, wallY,
        canvasRight, wallY
      );
      rightHighlightGradient.addColorStop(0, 'rgba(255, 255, 255, 0)');
      rightHighlightGradient.addColorStop(1, 'rgba(255, 255, 255, 0.3)');
      this.ctx.fillStyle = rightHighlightGradient;
      const rightEdgeWidth = finalGaps.length > 0 
        ? Math.min(15, canvasRight - finalGaps[finalGaps.length - 1].right) 
        : 15;
      if (rightEdgeWidth > 0) {
        this.ctx.fillRect(canvasRight - rightEdgeWidth, wallY, rightEdgeWidth, wallHeight);
      }
    }
    
    this.ctx.restore();
  }
  
  // Draw the tube grid system - creates continuous tunnel effect with visible areas above/below
  // This is called with camera transform already reset (walls are in screen space)
  // Only draw what's visible on screen to prevent smearing
  private drawTubeGrid(walls: Obstacle[]): void {
    if (walls.length === 0) return;
    
    const wallHeight = 60; // WALL_THICKNESS
    const topWallScreenY = 0; // Top wall is at screen y=0
    const bottomWallScreenY = this.canvas.height - wallHeight; // Bottom wall is at screen y=canvas.height-wallHeight
    const playAreaTop = topWallScreenY + wallHeight;
    const playAreaBottom = bottomWallScreenY;
    
    // Get wall colors for tube rendering
    let tubeColor: string;
    
    const topWall = walls.find(w => Math.abs(w.position.y - 0) < 5);
    
    if (topWall?.wallColor) {
      tubeColor = topWall.wallColor;
    } else {
      tubeColor = this.currentTheme.obstacleColor;
    }
    
    // Calculate RGB values for transparency
    const rgb = this.hexToRgb(tubeColor);
    if (!rgb) return;
    
    // Only draw within visible screen bounds to prevent smearing
    const visibleTop = Math.max(0, playAreaTop);
    const visibleBottom = Math.min(this.canvas.height, playAreaBottom);
    const visibleHeight = visibleBottom - visibleTop;
    
    if (visibleHeight <= 0) return; // Nothing to draw
    
    const tubeWallThickness = 40; // Side wall thickness
    
    // Draw left side wall of tube (only visible portion)
    const leftWallGradient = this.ctx.createLinearGradient(
      0, visibleTop,
      0, visibleBottom
    );
    leftWallGradient.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.5)`);
    leftWallGradient.addColorStop(0.5, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.7)`);
    leftWallGradient.addColorStop(1, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.5)`);
    
    this.ctx.fillStyle = leftWallGradient;
    this.ctx.fillRect(0, visibleTop, tubeWallThickness, visibleHeight);
    
    // Draw right side wall of tube (only visible portion)
    const rightWallGradient = this.ctx.createLinearGradient(
      0, visibleTop,
      0, visibleBottom
    );
    rightWallGradient.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.5)`);
    rightWallGradient.addColorStop(0.5, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.7)`);
    rightWallGradient.addColorStop(1, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.5)`);
    
    this.ctx.fillStyle = rightWallGradient;
    this.ctx.fillRect(this.canvas.width - tubeWallThickness, visibleTop, tubeWallThickness, visibleHeight);
    
    // Draw subtle tube section dividers (horizontal grid lines) - only in visible area
    const tubeSectionHeight = 380; // HORIZONTAL_GRID_SPACING
    this.ctx.strokeStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.15)`; // Very low opacity
    this.ctx.lineWidth = 1;
    this.ctx.setLineDash([20, 20]);
    
    // Only draw grid lines that are actually visible on screen
    const startSection = Math.floor((visibleTop - playAreaTop) / tubeSectionHeight);
    const endSection = Math.ceil((visibleBottom - playAreaTop) / tubeSectionHeight);
    
    for (let i = startSection; i <= endSection; i++) {
      const gridY = playAreaTop + (i * tubeSectionHeight);
      if (gridY >= visibleTop && gridY <= visibleBottom) {
        this.ctx.beginPath();
        this.ctx.moveTo(tubeWallThickness, gridY);
        this.ctx.lineTo(this.canvas.width - tubeWallThickness, gridY);
        this.ctx.stroke();
      }
    }
    
    this.ctx.setLineDash([]); // Reset line dash
    
    // Draw subtle vertical dividers - only in visible area
    const verticalSegmentWidth = 500;
    this.ctx.strokeStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.08)`;
    this.ctx.lineWidth = 1;
    
    for (let x = verticalSegmentWidth; x < this.canvas.width - tubeWallThickness; x += verticalSegmentWidth) {
      this.ctx.beginPath();
      this.ctx.moveTo(x, visibleTop);
      this.ctx.lineTo(x, visibleBottom);
      this.ctx.stroke();
    }
    
    // Draw tube interior depth effect (darker at edges, lighter in center) - only visible area
    const depthGradient = this.ctx.createLinearGradient(
      tubeWallThickness, 0,
      this.canvas.width - tubeWallThickness, 0
    );
    depthGradient.addColorStop(0, `rgba(0, 0, 0, 0.1)`);
    depthGradient.addColorStop(0.5, `rgba(0, 0, 0, 0)`);
    depthGradient.addColorStop(1, `rgba(0, 0, 0, 0.1)`);
    
    this.ctx.fillStyle = depthGradient;
    this.ctx.fillRect(tubeWallThickness, visibleTop, this.canvas.width - (tubeWallThickness * 2), visibleHeight);
  }
  
  resize(width: number, height: number): void {
    this.canvas.width = width;
    this.canvas.height = height;
    // Regenerate background layers with new canvas dimensions (maintains current level)
    this.initializeBackgroundLayers();
  }
}