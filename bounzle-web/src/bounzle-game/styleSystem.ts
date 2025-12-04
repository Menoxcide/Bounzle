// Style & Combo System for skill-based gameplay

import { StyleLevel, ComboType, StyleData, ComboData } from './types';

export class StyleMeter {
  private styleData: StyleData;
  private readonly DECAY_RATE = 2; // Points per second
  private readonly COLLISION_PENALTY = 10; // Points lost on collision
  private readonly IDLE_THRESHOLD_MS = 3000; // 3 seconds without action
  
  // Style level thresholds
  private readonly STYLE_THRESHOLDS: Record<StyleLevel, number> = {
    'D': 0,
    'C': 100,
    'B': 250,
    'A': 500,
    'S': 1000,
    'SS': 2000,
    'SSS': 4000,
  };
  
  // Style multipliers for score
  private readonly STYLE_MULTIPLIERS: Record<StyleLevel, number> = {
    'D': 1.0,
    'C': 1.0,
    'B': 1.2,
    'A': 1.5,
    'S': 2.0,
    'SS': 3.0,
    'SSS': 5.0,
  };
  
  // Style level colors
  private readonly STYLE_COLORS: Record<StyleLevel, string> = {
    'D': '#6b7280', // gray
    'C': '#3b82f6', // blue
    'B': '#10b981', // green
    'A': '#eab308', // yellow
    'S': '#f59e0b', // orange
    'SS': '#ef4444', // red
    'SSS': '#a855f7', // purple (rainbow effect handled in renderer)
  };
  
  constructor() {
    this.styleData = {
      points: 0,
      level: 'D',
      previousLevel: 'D',
      noHitStreak: 0,
      lastActionTime: 0,
    };
  }
  
  reset(): void {
    this.styleData = {
      points: 0,
      level: 'D',
      previousLevel: 'D',
      noHitStreak: 0,
      lastActionTime: 0,
    };
  }
  
  update(deltaTime: number, currentTime: number): void {
    // Apply decay if idle
    if (currentTime - this.styleData.lastActionTime > this.IDLE_THRESHOLD_MS) {
      const decayAmount = (this.DECAY_RATE * deltaTime) / 1000;
      this.styleData.points = Math.max(0, this.styleData.points - decayAmount);
      this.updateLevel();
    }
  }
  
  addPerfectGap(comboMultiplier: number = 1.0): number {
    const basePoints = 50;
    const points = Math.floor(basePoints * comboMultiplier);
    this.styleData.points += points;
    this.styleData.lastActionTime = performance.now();
    this.styleData.noHitStreak++;
    this.updateLevel();
    return points;
  }
  
  addCloseCall(comboMultiplier: number = 1.0): number {
    const basePoints = 75;
    const points = Math.floor(basePoints * comboMultiplier);
    this.styleData.points += points;
    this.styleData.lastActionTime = performance.now();
    this.styleData.noHitStreak++;
    this.updateLevel();
    return points;
  }
  
  addPowerUpCollection(comboMultiplier: number = 1.0): number {
    const basePoints = 25;
    const points = Math.floor(basePoints * comboMultiplier);
    this.styleData.points += points;
    this.styleData.lastActionTime = performance.now();
    this.updateLevel();
    return points;
  }
  
  addNoHitStreak(): void {
    const points = 10;
    this.styleData.points += points;
    this.styleData.noHitStreak++;
    this.styleData.lastActionTime = performance.now();
    this.updateLevel();
  }
  
  onCollision(): void {
    this.styleData.points = Math.max(0, this.styleData.points - this.COLLISION_PENALTY);
    this.styleData.noHitStreak = 0;
    this.updateLevel();
  }
  
  private updateLevel(): void {
    const previousLevel = this.styleData.level;
    let newLevel: StyleLevel = 'D';
    
    // Find current level based on points
    const levels: StyleLevel[] = ['D', 'C', 'B', 'A', 'S', 'SS', 'SSS'];
    for (let i = levels.length - 1; i >= 0; i--) {
      if (this.styleData.points >= this.STYLE_THRESHOLDS[levels[i]]) {
        newLevel = levels[i];
        break;
      }
    }
    
    this.styleData.previousLevel = previousLevel;
    this.styleData.level = newLevel;
  }
  
  getLevel(): StyleLevel {
    return this.styleData.level;
  }
  
  getPreviousLevel(): StyleLevel {
    return this.styleData.previousLevel;
  }
  
  getPoints(): number {
    return Math.floor(this.styleData.points);
  }
  
  getMultiplier(): number {
    return this.STYLE_MULTIPLIERS[this.styleData.level];
  }
  
  getColor(): string {
    return this.STYLE_COLORS[this.styleData.level];
  }
  
  getNoHitStreak(): number {
    return this.styleData.noHitStreak;
  }
  
  getProgress(): number {
    // Progress within current level (0-1)
    const currentThreshold = this.STYLE_THRESHOLDS[this.styleData.level];
    const nextLevel = this.getNextLevel();
    const nextThreshold = nextLevel ? this.STYLE_THRESHOLDS[nextLevel] : currentThreshold + 1000;
    const range = nextThreshold - currentThreshold;
    const progress = (this.styleData.points - currentThreshold) / range;
    return Math.max(0, Math.min(1, progress));
  }
  
  private getNextLevel(): StyleLevel | null {
    const levels: StyleLevel[] = ['D', 'C', 'B', 'A', 'S', 'SS', 'SSS'];
    const currentIndex = levels.indexOf(this.styleData.level);
    return currentIndex < levels.length - 1 ? levels[currentIndex + 1] : null;
  }
  
  didLevelUp(): boolean {
    return this.styleData.level !== this.styleData.previousLevel && 
           this.STYLE_THRESHOLDS[this.styleData.level] > this.STYLE_THRESHOLDS[this.styleData.previousLevel];
  }
  
  getData(): StyleData {
    return { ...this.styleData };
  }
}

export class ComboTracker {
  private combos: Map<ComboType, ComboData>;
  private readonly COMBO_TIMEOUT_MS = 3000; // 3 seconds without action breaks combo
  private readonly MAX_COMBO_MULTIPLIERS: Record<ComboType, number> = {
    'gap': 5.0,
    'closeCall': 6.0,
    'powerUp': 4.0,
    'mixed': 3.0,
  };
  
  private readonly COMBO_MULTIPLIER_RATES: Record<ComboType, number> = {
    'gap': 1.2,
    'closeCall': 1.5,
    'powerUp': 1.3,
    'mixed': 1.1,
  };
  
  constructor() {
    this.combos = new Map();
    this.initializeCombo('gap');
    this.initializeCombo('closeCall');
    this.initializeCombo('powerUp');
    this.initializeCombo('mixed');
  }
  
  private initializeCombo(type: ComboType): void {
    this.combos.set(type, {
      type,
      count: 0,
      multiplier: 1.0,
      lastActionTime: 0,
      isActive: false,
    });
  }
  
  reset(): void {
    this.combos.forEach(combo => {
      combo.count = 0;
      combo.multiplier = 1.0;
      combo.lastActionTime = 0;
      combo.isActive = false;
    });
  }
  
  update(currentTime: number): void {
    // Check for combo timeouts
    this.combos.forEach(combo => {
      if (combo.isActive && currentTime - combo.lastActionTime > this.COMBO_TIMEOUT_MS) {
        combo.isActive = false;
        combo.count = 0;
        combo.multiplier = 1.0;
      }
    });
  }
  
  addGapCombo(currentTime: number): number {
    const combo = this.combos.get('gap')!;
    combo.count++;
    combo.lastActionTime = currentTime;
    combo.isActive = true;
    
    // Calculate multiplier (capped at max)
    combo.multiplier = Math.min(
      this.MAX_COMBO_MULTIPLIERS.gap,
      1.0 + (combo.count - 1) * (this.COMBO_MULTIPLIER_RATES.gap - 1.0)
    );
    
    return combo.multiplier;
  }
  
  addCloseCallCombo(currentTime: number): number {
    const combo = this.combos.get('closeCall')!;
    combo.count++;
    combo.lastActionTime = currentTime;
    combo.isActive = true;
    
    combo.multiplier = Math.min(
      this.MAX_COMBO_MULTIPLIERS.closeCall,
      1.0 + (combo.count - 1) * (this.COMBO_MULTIPLIER_RATES.closeCall - 1.0)
    );
    
    return combo.multiplier;
  }
  
  addPowerUpCombo(currentTime: number): number {
    const combo = this.combos.get('powerUp')!;
    combo.count++;
    combo.lastActionTime = currentTime;
    combo.isActive = true;
    
    combo.multiplier = Math.min(
      this.MAX_COMBO_MULTIPLIERS.powerUp,
      1.0 + (combo.count - 1) * (this.COMBO_MULTIPLIER_RATES.powerUp - 1.0)
    );
    
    return combo.multiplier;
  }
  
  addMixedCombo(currentTime: number): number {
    const combo = this.combos.get('mixed')!;
    combo.count++;
    combo.lastActionTime = currentTime;
    combo.isActive = true;
    
    // Mixed combo gets bonus multiplier
    combo.multiplier = Math.min(
      this.MAX_COMBO_MULTIPLIERS.mixed,
      1.0 + (combo.count - 1) * (this.COMBO_MULTIPLIER_RATES.mixed - 1.0) + 0.5
    );
    
    return combo.multiplier;
  }
  
  getActiveCombo(): ComboData | null {
    let bestCombo: ComboData | null = null;
    let bestMultiplier = 1.0;
    
    this.combos.forEach(combo => {
      if (combo.isActive && combo.multiplier > bestMultiplier) {
        bestCombo = combo;
        bestMultiplier = combo.multiplier;
      }
    });
    
    return bestCombo;
  }
  
  getTotalMultiplier(): number {
    // Return the highest active combo multiplier
    let maxMultiplier = 1.0;
    this.combos.forEach(combo => {
      if (combo.isActive && combo.multiplier > maxMultiplier) {
        maxMultiplier = combo.multiplier;
      }
    });
    return maxMultiplier;
  }
  
  breakCombo(): void {
    this.combos.forEach(combo => {
      combo.isActive = false;
      combo.count = 0;
      combo.multiplier = 1.0;
    });
  }
  
  getAllCombos(): Map<ComboType, ComboData> {
    return new Map(this.combos);
  }
}

