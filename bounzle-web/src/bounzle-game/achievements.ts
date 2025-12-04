// Achievement and Unlock System

import { Achievement, Unlock, StyleLevel } from './types';

export class AchievementManager {
  private achievements: Map<string, Achievement> = new Map();
  private unlocks: Map<string, Unlock> = new Map();
  
  constructor() {
    this.initializeAchievements();
    this.initializeUnlocks();
  }
  
  private initializeAchievements(): void {
    // Style Achievements
    this.achievements.set('style_s', {
      id: 'style_s',
      type: 'style',
      name: 'Stylish',
      description: 'Reach S rank',
      unlocked: false,
      progress: 0,
      target: 1,
    });
    
    this.achievements.set('style_ss', {
      id: 'style_ss',
      type: 'style',
      name: 'Super Stylish',
      description: 'Reach SS rank',
      unlocked: false,
      progress: 0,
      target: 1,
    });
    
    this.achievements.set('style_sss', {
      id: 'style_sss',
      type: 'style',
      name: 'Ultra Stylish',
      description: 'Reach SSS rank',
      unlocked: false,
      progress: 0,
      target: 1,
    });
    
    // Combo Achievements
    this.achievements.set('combo_10', {
      id: 'combo_10',
      type: 'combo',
      name: 'Combo Starter',
      description: 'Achieve a 10x combo',
      unlocked: false,
      progress: 0,
      target: 1,
    });
    
    this.achievements.set('combo_25', {
      id: 'combo_25',
      type: 'combo',
      name: 'Combo Master',
      description: 'Achieve a 25x combo',
      unlocked: false,
      progress: 0,
      target: 1,
    });
    
    this.achievements.set('combo_50', {
      id: 'combo_50',
      type: 'combo',
      name: 'Combo Legend',
      description: 'Achieve a 50x combo',
      unlocked: false,
      progress: 0,
      target: 1,
    });
    
    // Skill Achievements
    this.achievements.set('perfect_gaps_50', {
      id: 'perfect_gaps_50',
      type: 'skill',
      name: 'Precision Pilot',
      description: 'Perform 50 perfect gap passes',
      unlocked: false,
      progress: 0,
      target: 50,
    });
    
    this.achievements.set('close_calls_100', {
      id: 'close_calls_100',
      type: 'skill',
      name: 'Daredevil',
      description: 'Perform 100 close calls',
      unlocked: false,
      progress: 0,
      target: 100,
    });
    
    this.achievements.set('no_hit_10', {
      id: 'no_hit_10',
      type: 'skill',
      name: 'Perfect Run',
      description: 'Pass 10 obstacles without collision',
      unlocked: false,
      progress: 0,
      target: 1,
    });
  }
  
  private initializeUnlocks(): void {
    // Visual Themes
    this.unlocks.set('theme_neon', {
      id: 'theme_neon',
      type: 'theme',
      name: 'Neon Theme',
      description: 'Unlock neon visual theme',
      unlocked: false,
    });
    
    this.unlocks.set('theme_lava', {
      id: 'theme_lava',
      type: 'theme',
      name: 'Lava Theme',
      description: 'Unlock lava visual theme',
      unlocked: false,
    });
    
    this.unlocks.set('theme_ocean', {
      id: 'theme_ocean',
      type: 'theme',
      name: 'Ocean Theme',
      description: 'Unlock ocean visual theme',
      unlocked: false,
    });
    
    // Ball Trails
    this.unlocks.set('trail_fire', {
      id: 'trail_fire',
      type: 'trail',
      name: 'Fire Trail',
      description: 'Unlock fire trail effect',
      unlocked: false,
    });
    
    this.unlocks.set('trail_electric', {
      id: 'trail_electric',
      type: 'trail',
      name: 'Electric Trail',
      description: 'Unlock electric trail effect',
      unlocked: false,
    });
    
    this.unlocks.set('trail_rainbow', {
      id: 'trail_rainbow',
      type: 'trail',
      name: 'Rainbow Trail',
      description: 'Unlock rainbow trail effect',
      unlocked: false,
    });
  }
  
  checkStyleAchievement(level: StyleLevel): void {
    if (level === 'S' && !this.achievements.get('style_s')?.unlocked) {
      this.unlockAchievement('style_s');
    }
    if (level === 'SS' && !this.achievements.get('style_ss')?.unlocked) {
      this.unlockAchievement('style_ss');
    }
    if (level === 'SSS' && !this.achievements.get('style_sss')?.unlocked) {
      this.unlockAchievement('style_sss');
    }
  }
  
  checkComboAchievement(comboCount: number): void {
    if (comboCount >= 10 && !this.achievements.get('combo_10')?.unlocked) {
      this.unlockAchievement('combo_10');
    }
    if (comboCount >= 25 && !this.achievements.get('combo_25')?.unlocked) {
      this.unlockAchievement('combo_25');
    }
    if (comboCount >= 50 && !this.achievements.get('combo_50')?.unlocked) {
      this.unlockAchievement('combo_50');
    }
  }
  
  updateSkillProgress(achievementId: string, progress: number): void {
    const achievement = this.achievements.get(achievementId);
    if (achievement && !achievement.unlocked) {
      achievement.progress = Math.min(achievement.progress + progress, achievement.target);
      if (achievement.progress >= achievement.target) {
        this.unlockAchievement(achievementId);
      }
    }
  }
  
  private unlockAchievement(achievementId: string): void {
    const achievement = this.achievements.get(achievementId);
    if (achievement && !achievement.unlocked) {
      achievement.unlocked = true;
      achievement.unlockedAt = Date.now();
      
      // Grant unlock rewards based on achievement
      this.grantUnlockReward(achievementId);
    }
  }
  
  private grantUnlockReward(achievementId: string): void {
    // Map achievements to unlocks
    const rewardMap: Record<string, string[]> = {
      'style_s': ['theme_neon'],
      'style_ss': ['trail_fire'],
      'style_sss': ['trail_rainbow'],
      'combo_25': ['trail_electric'],
      'combo_50': ['theme_lava'],
      'perfect_gaps_50': ['theme_ocean'],
    };
    
    const rewards = rewardMap[achievementId];
    if (rewards) {
      rewards.forEach(unlockId => {
        const unlock = this.unlocks.get(unlockId);
        if (unlock && !unlock.unlocked) {
          unlock.unlocked = true;
          unlock.unlockedAt = Date.now();
        }
      });
    }
  }
  
  getAchievements(): Achievement[] {
    return Array.from(this.achievements.values());
  }
  
  getUnlocks(): Unlock[] {
    return Array.from(this.unlocks.values());
  }
  
  getAchievement(id: string): Achievement | undefined {
    return this.achievements.get(id);
  }
  
  getUnlock(id: string): Unlock | undefined {
    return this.unlocks.get(id);
  }
  
  // Load achievements and unlocks from saved data
  loadData(achievementsData: Achievement[], unlocksData: Unlock[]): void {
    achievementsData.forEach(achievement => {
      const existing = this.achievements.get(achievement.id);
      if (existing) {
        existing.unlocked = achievement.unlocked;
        existing.unlockedAt = achievement.unlockedAt;
        existing.progress = achievement.progress;
      }
    });
    
    unlocksData.forEach(unlock => {
      const existing = this.unlocks.get(unlock.id);
      if (existing) {
        existing.unlocked = unlock.unlocked;
        existing.unlockedAt = unlock.unlockedAt;
      }
    });
  }
  
  // Get data for saving
  getSaveData(): { achievements: Achievement[]; unlocks: Unlock[] } {
    return {
      achievements: Array.from(this.achievements.values()),
      unlocks: Array.from(this.unlocks.values()),
    };
  }
}

