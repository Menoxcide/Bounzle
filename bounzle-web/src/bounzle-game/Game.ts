// Main game class

import { Renderer } from './renderer';
import { InputHandler } from './input';
import { updateBallPosition, applyJumpForce, checkCollision, checkBoundaryCollision, SCROLL_SPEED } from './physics';
import { Ball, Obstacle, GameStatus, LevelChunk, LevelData } from './types';
import { getTheme, getRandomTheme } from './themes';
import { ParticleSystem } from './particles';
import { SoundManager } from './sound';

export default class Game {
  private canvas: HTMLCanvasElement;
  private renderer: Renderer;
  private inputHandler: InputHandler;
  private animationFrameId: number | null = null;
  private particleSystem: ParticleSystem;
  private soundManager: SoundManager;
  
  // Game state
  private ball: Ball;
  private obstacles: Obstacle[] = [];
  private score: number = 0;
  private status: GameStatus = 'idle';
  private lastTime: number = 0;
  private currentTheme: string = 'normal';
  private lastThemeChangeScore: number = 0;
  
  // Difficulty scaling
  private difficulty: number = 1;
  private lastDifficultyIncreaseScore: number = 0;
  
  // Screen shake
  private shakeIntensity: number = 0;
  private shakeDuration: number = 0;
  private shakeX: number = 0;
  private shakeY: number = 0;
  
  // Extra time from rewarded ads
  private extraTime: number = 0;
  
  // Level generation
  private levelChunks: LevelChunk[] = [];
  private currentChunkIndex: number = 0;
  private checkpoint: number = 0;
  private lastObstacleX: number = 0;
  private obstacleSpacing: number = 250; // Distance between obstacles
  
  // Callbacks
  private onGameOver?: (score: number) => void;
  private onScoreUpdate?: (score: number) => void;
  
  constructor(canvas: HTMLCanvasElement, callbacks?: { onGameOver?: (score: number) => void, onScoreUpdate?: (score: number) => void }) {
    this.canvas = canvas;
    this.renderer = new Renderer(canvas);
    this.particleSystem = new ParticleSystem();
    this.soundManager = new SoundManager();
    this.inputHandler = new InputHandler(canvas, this.handleTap.bind(this));
    
    // Set callbacks
    if (callbacks) {
      this.onGameOver = callbacks.onGameOver;
      this.onScoreUpdate = callbacks.onScoreUpdate;
    }
    
    // Initialize ball
    this.ball = {
      position: { x: 100, y: this.canvas.height / 2 },
      velocity: { x: 0, y: 0 },
      radius: 20,
      gravityScale: 1
    };
    
    this.resize();
    window.addEventListener('resize', this.resize.bind(this));
  }
  
  private resize(): void {
    const rect = this.canvas.parentElement?.getBoundingClientRect();
    if (rect) {
      this.renderer.resize(rect.width, rect.height);
      
      // Reset ball position on resize
      this.ball.position = { x: 100, y: this.canvas.height / 2 };
    }
  }
  
  private handleTap(): void {
    if (this.status === 'playing') {
      applyJumpForce(this.ball);
      
      // Play sound effect
      this.soundManager.playBeep(440, 0.1);
      
      // Add particle effect when tapping
      this.particleSystem.addExplosion(
        this.ball.position.x, 
        this.ball.position.y, 
        getTheme(this.currentTheme).ballColor, 
        5
      );
    } else if (this.status === 'idle' || this.status === 'gameOver') {
      this.start();
    } else if (this.status === 'paused') {
      this.resume();
    }
  }
  
  start(): void {
    if (this.status === 'playing') return;
    
    this.status = 'playing';
    this.score = 0;
    this.difficulty = 1;
    this.lastDifficultyIncreaseScore = 0;
    this.extraTime = 0;
    this.lastThemeChangeScore = 0;
    this.currentTheme = 'normal';
    this.renderer.setTheme(this.currentTheme);
    this.particleSystem.clear();
    this.shakeIntensity = 0;
    this.shakeDuration = 0;
    this.shakeX = 0;
    this.shakeY = 0;
    
    if (this.onScoreUpdate) this.onScoreUpdate(this.score);
    this.obstacles = [];
    this.levelChunks = [];
    this.currentChunkIndex = 0;
    this.checkpoint = 0;
    this.lastObstacleX = this.canvas.width;
    this.ball.position = { x: 100, y: this.canvas.height / 2 };
    this.ball.velocity = { x: 0, y: 0 };
    
    // Generate initial obstacles immediately
    this.generateObstaclesFromChunks();
    
    // Play start sound
    this.soundManager.playPop();
    
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    
    this.lastTime = performance.now();
    this.gameLoop(this.lastTime);
  }
  
  pause(): void {
    if (this.status === 'playing') {
      this.status = 'paused';
      if (this.animationFrameId) {
        cancelAnimationFrame(this.animationFrameId);
        this.animationFrameId = null;
      }
    }
  }
  
  resume(): void {
    if (this.status === 'paused') {
      this.status = 'playing';
      this.lastTime = performance.now();
      this.gameLoop(this.lastTime);
    }
  }
  
  // Add extra time from rewarded ad
  addExtraTime(seconds: number): void {
    this.extraTime += seconds;
    // Play a sound effect for the reward
    this.soundManager.playCoin();
  }
  
  // Trigger screen shake
  private triggerShake(intensity: number = 5, duration: number = 10): void {
    this.shakeIntensity = intensity;
    this.shakeDuration = duration;
  }
  
  // Increase difficulty based on score
  private increaseDifficulty(): void {
    // Increase difficulty every 100 points
    if (this.score >= this.lastDifficultyIncreaseScore + 100) {
      this.difficulty += 0.1;
      this.lastDifficultyIncreaseScore = this.score;
      
      // Play a sound effect for difficulty increase
      this.soundManager.playBeep(880, 0.1);
    }
  }
  
  // Get adjusted scroll speed based on difficulty
  private getAdjustedScrollSpeed(): number {
    return SCROLL_SPEED * this.difficulty;
  }
  
  // Get adjusted gap height based on difficulty
  private getAdjustedGapHeight(baseGapHeight: number): number {
    // Make gaps smaller as difficulty increases
    // At difficulty 1, gap is 100% of base. At difficulty 2, gap is 80%, etc.
    const gapMultiplier = Math.max(1.0 - (this.difficulty - 1) * 0.15, 0.3);
    return baseGapHeight * gapMultiplier;
  }
  
  // Generate a procedural obstacle (fallback when chunks aren't available)
  private generateProceduralObstacle(): Obstacle {
    // Generate random gap position (keep it in the middle 60% of screen)
    const gapY = (Math.random() * 0.6 + 0.2) * this.canvas.height;
    
    // Base gap height decreases with difficulty
    const baseGapHeight = Math.max(0.15 - (this.difficulty - 1) * 0.02, 0.08);
    const adjustedGapHeight = this.getAdjustedGapHeight(baseGapHeight) * this.canvas.height;
    
    // Ensure minimum gap height for playability
    const minGapHeight = 120; // Minimum 120px gap
    const finalGapHeight = Math.max(adjustedGapHeight, minGapHeight);
    
    return {
      position: { x: this.lastObstacleX, y: 0 },
      width: 80,
      height: this.canvas.height,
      gapY: gapY,
      gapHeight: finalGapHeight,
      obstacleType: 'pipe',
      theme: this.currentTheme,
      passed: false
    };
  }
  
  // Load level data from AI generation
  loadLevelData(levelData: LevelData): void {
    // Append new chunks to existing ones (don't clear)
    this.levelChunks = [...this.levelChunks, ...levelData.chunks];
    
    // Don't clear existing obstacles - just add more from new chunks
    // This ensures continuous gameplay without gaps
    this.generateObstaclesFromChunks();
  }
  
  private generateObstaclesFromChunks(): void {
    // Find the rightmost obstacle position
    let rightmostX = this.canvas.width;
    if (this.obstacles.length > 0) {
      rightmostX = Math.max(...this.obstacles.map(o => o.position.x + o.width));
    } else {
      rightmostX = this.canvas.width;
      this.lastObstacleX = rightmostX;
    }
    
    // Generate obstacles until we have enough ahead of the ball
    const targetObstacleCount = 8;
    const minDistanceAhead = this.canvas.width * 0.5; // Keep obstacles at least 50% of screen width ahead
    
    while (this.obstacles.length < targetObstacleCount || rightmostX < this.ball.position.x + minDistanceAhead) {
      let obstacle: Obstacle;
      
      // Use chunks if available, otherwise generate procedurally
      if (this.currentChunkIndex < this.levelChunks.length) {
        const chunk = this.levelChunks[this.currentChunkIndex];
        
        // Convert normalized values to pixel values
        const gapY = chunk.gapY * this.canvas.height;
        const baseGapHeight = chunk.gapHeight;
        const adjustedGapHeight = this.getAdjustedGapHeight(baseGapHeight) * this.canvas.height;
        
        // Ensure minimum gap height
        const minGapHeight = 120;
        const finalGapHeight = Math.max(adjustedGapHeight, minGapHeight);
        
        obstacle = {
          position: { x: rightmostX + this.obstacleSpacing, y: 0 },
          width: 80,
          height: this.canvas.height,
          gapY: gapY,
          gapHeight: finalGapHeight,
          obstacleType: chunk.obstacleType,
          theme: chunk.theme,
          passed: false
        };
        
        this.currentChunkIndex++;
      } else {
        // Generate procedurally when chunks run out
        obstacle = this.generateProceduralObstacle();
        obstacle.position.x = rightmostX + this.obstacleSpacing;
      }
      
      this.obstacles.push(obstacle);
      rightmostX = obstacle.position.x + obstacle.width;
      this.lastObstacleX = rightmostX;
    }
  }
  
  private checkThemeChange(): void {
    // Change theme every 500 points
    if (this.score >= this.lastThemeChangeScore + 500) {
      this.currentTheme = getRandomTheme().name;
      this.renderer.setTheme(this.currentTheme);
      this.lastThemeChangeScore = this.score;
      
      // Play theme change sound
      this.soundManager.playPop();
      
      // Add particle explosion when theme changes
      this.particleSystem.addExplosion(
        this.canvas.width / 2, 
        this.canvas.height / 2, 
        getTheme(this.currentTheme).ballColor, 
        20
      );
    }
  }
  
  private gameLoop(timestamp: number): void {
    const deltaTime = (timestamp - this.lastTime) / 16; // Normalize to 60fps
    this.lastTime = timestamp;
    
    if (this.status === 'playing') {
      this.update(deltaTime);
    }
    
    this.render();
    
    if (this.status === 'playing' || this.status === 'idle' || this.status === 'paused') {
      this.animationFrameId = requestAnimationFrame(this.gameLoop.bind(this));
    }
  }
  
  private update(deltaTime: number): void {
    // Update ball physics
    updateBallPosition(this.ball, deltaTime);
    
    // Update particle system
    this.particleSystem.update(deltaTime);
    
    // Update screen shake
    if (this.shakeDuration > 0) {
      this.shakeDuration -= deltaTime;
      if (this.shakeDuration <= 0) {
        this.shakeX = 0;
        this.shakeY = 0;
      } else {
        // Apply shake effect
        this.shakeX = (Math.random() - 0.5) * this.shakeIntensity;
        this.shakeY = (Math.random() - 0.5) * this.shakeIntensity;
      }
    }
    
    // Decrease extra time
    if (this.extraTime > 0) {
      this.extraTime -= deltaTime / 60; // Decrease by 1 second per 60 frames
      if (this.extraTime < 0) this.extraTime = 0;
    }
    
    // Increase difficulty
    this.increaseDifficulty();
    
    // Check for theme change
    this.checkThemeChange();
    
    // Check for collisions with boundaries (only extreme cases)
    // In Flappy Bird style, boundaries don't cause instant death
    if (checkBoundaryCollision(this.ball, this.canvas.height)) {
      // Only game over if ball is way off screen (safety check)
      if (this.extraTime > 0) {
        // Use extra time instead of game over
        this.extraTime = 0;
        // Play a sound effect
        this.soundManager.playBeep(880, 0.2);
      } else {
        this.gameOver();
        return;
      }
    }
    
    // Update obstacles and check for collisions
    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const obstacle = this.obstacles[i];
      obstacle.position.x -= this.getAdjustedScrollSpeed() * deltaTime;
      
      // Remove obstacles that are off-screen
      if (obstacle.position.x + obstacle.width < 0) {
        this.obstacles.splice(i, 1);
        continue;
      }
      
      // Check for collision
      if (checkCollision(this.ball, obstacle)) {
        if (this.extraTime > 0) {
          // Use extra time instead of game over
          this.extraTime = 0;
          // Play a sound effect
          this.soundManager.playBeep(880, 0.2);
        } else {
          this.gameOver();
          return;
        }
      }
      
      // Check if player passed the obstacle
      if (obstacle.position.x + obstacle.width < this.ball.position.x - this.ball.radius && !obstacle['passed']) {
        obstacle['passed'] = true;
        this.score++;
        if (this.onScoreUpdate) this.onScoreUpdate(this.score);
        
        // Play coin sound when passing an obstacle
        this.soundManager.playCoin();
        
        // Add particle effect when passing an obstacle
        this.particleSystem.addExplosion(
          this.ball.position.x, 
          this.ball.position.y, 
          getTheme(this.currentTheme).obstacleColor, 
          3
        );
      }
    }
    
    // Continuously generate new obstacles as game progresses
    // Adjust spacing based on difficulty (closer obstacles = harder)
    this.obstacleSpacing = Math.max(250 - (this.difficulty - 1) * 20, 150);
    this.generateObstaclesFromChunks();
  }
  
  private render(): void {
    // Apply screen shake offset
    if (this.shakeDuration > 0) {
      this.renderer.ctx.save();
      this.renderer.ctx.translate(this.shakeX, this.shakeY);
    }
    
    this.renderer.clear();
    
    // Draw particles
    this.particleSystem.render(this.renderer.ctx);
    
    // Draw obstacles
    this.obstacles.forEach(obstacle => {
      this.renderer.drawObstacle(obstacle);
    });
    
    // Draw ball
    this.renderer.drawBall(this.ball);
    
    // Draw score
    this.renderer.drawScore(this.score);
    
    // Draw difficulty level
    this.renderer.ctx.font = 'bold 16px Arial';
    this.renderer.ctx.fillStyle = '#8b5cf6'; // purple-500
    this.renderer.ctx.textAlign = 'right';
    this.renderer.ctx.fillText(
      `Level: ${this.difficulty.toFixed(1)}`, 
      this.canvas.width - 20, 
      60
    );
    
    // Draw extra time indicator if active
    if (this.extraTime > 0) {
      this.renderer.ctx.font = 'bold 16px Arial';
      this.renderer.ctx.fillStyle = '#10b981'; // green-500
      this.renderer.ctx.textAlign = 'right';
      this.renderer.ctx.fillText(
        `Extra Time: ${Math.ceil(this.extraTime)}s`, 
        this.canvas.width - 20, 
        40
      );
    }
    
    // Draw instructions if idle
    if (this.status === 'idle' || this.status === 'gameOver') {
      this.renderer.ctx.font = '20px Arial';
      this.renderer.ctx.fillStyle = getTheme(this.currentTheme).textColor;
      this.renderer.ctx.textAlign = 'center';
      this.renderer.ctx.fillText(
        this.status === 'idle' ? 'Click or tap to start' : `Game Over! Score: ${this.score}. Click to restart`,
        this.canvas.width / 2,
        this.canvas.height / 2
      );
    } else if (this.status === 'paused') {
      this.renderer.ctx.font = '20px Arial';
      this.renderer.ctx.fillStyle = getTheme(this.currentTheme).textColor;
      this.renderer.ctx.textAlign = 'center';
      this.renderer.ctx.fillText(
        'PAUSED - Click or tap to resume',
        this.canvas.width / 2,
        this.canvas.height / 2
      );
    }
    
    // Restore context if shake was applied
    if (this.shakeDuration > 0) {
      this.renderer.ctx.restore();
    }
  }
  
  private gameOver(): void {
    this.status = 'gameOver';
    
    // Play hit sound on game over
    this.soundManager.playHit();
    
    // Trigger screen shake on game over
    this.triggerShake(10, 20);
    
    // Add explosion effect on game over
    this.particleSystem.addExplosion(
      this.ball.position.x, 
      this.ball.position.y, 
      '#ef4444', // red for game over
      30
    );
    
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    if (this.onGameOver) this.onGameOver(this.score);
  }
  
  getStatus(): GameStatus {
    return this.status;
  }
  
  getScore(): number {
    return this.score;
  }
  
  getCurrentTheme(): string {
    return this.currentTheme;
  }
  
  // Enable or disable sound
  setSoundEnabled(enabled: boolean): void {
    this.soundManager.setAudioEnabled(enabled);
  }
  
  destroy(): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    this.inputHandler.destroy();
  }
}