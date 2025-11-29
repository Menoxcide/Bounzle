// Level validation system to ensure playability
import { LevelData, LevelChunk } from '@/bounzle-game/types';

// Game physics constants (must match physics.ts)
const GRAVITY = 0.5;
const JUMP_FORCE = -12;
const SCROLL_SPEED = 3;
const BALL_RADIUS = 20;
const OBSTACLE_WIDTH = 80;
const OBSTACLE_SPACING = 250; // Base spacing
const MIN_GAP_HEIGHT = 120; // Absolute minimum in pixels

interface BallState {
  x: number;
  y: number;
  velocityY: number;
}

/**
 * Simulates ball trajectory to check if a gap is reachable
 */
function canReachGap(
  startY: number,
  targetGapY: number,
  targetGapHeight: number,
  distance: number,
  canvasHeight: number
): boolean {
  // Convert normalized values to pixels
  const gapTop = targetGapY * canvasHeight - (targetGapHeight * canvasHeight) / 2;
  const gapBottom = targetGapY * canvasHeight + (targetGapHeight * canvasHeight) / 2;
  
  // Ball must fit within gap with some margin
  const requiredTop = gapTop + BALL_RADIUS + 10; // 10px safety margin
  const requiredBottom = gapBottom - BALL_RADIUS - 10;
  
  if (requiredBottom <= requiredTop) {
    // Gap is too small
    return false;
  }
  
  // Simulate ball trajectory
  let ballY = startY * canvasHeight;
  let velocityY = 0;
  const framesToTravel = Math.ceil(distance / SCROLL_SPEED);
  
  // Try different jump strategies (jump immediately, jump later, multiple jumps)
  const jumpStrategies = [
    [0], // Jump immediately
    [Math.floor(framesToTravel * 0.3)], // Jump at 30%
    [Math.floor(framesToTravel * 0.5)], // Jump at 50%
    [Math.floor(framesToTravel * 0.7)], // Jump at 70%
    [0, Math.floor(framesToTravel * 0.5)], // Jump twice
  ];
  
  for (const jumps of jumpStrategies) {
    let testY = ballY;
    let testVelocityY = 0;
    let jumpIndex = 0;
    
    for (let frame = 0; frame < framesToTravel; frame++) {
      // Apply jump if scheduled
      if (jumps[jumpIndex] === frame) {
        testVelocityY = JUMP_FORCE;
        jumpIndex++;
      }
      
      // Apply gravity
      testVelocityY += GRAVITY;
      
      // Update position
      testY += testVelocityY;
      
      // Check if we're still on screen (basic check)
      if (testY < -100 || testY > canvasHeight + 100) {
        break; // Ball went off screen, try next strategy
      }
    }
    
    // Check if final position is within gap
    const finalTop = testY - BALL_RADIUS;
    const finalBottom = testY + BALL_RADIUS;
    
    if (finalTop >= requiredTop && finalBottom <= requiredBottom) {
      return true; // This strategy works!
    }
  }
  
  return false; // No strategy found
}

/**
 * Validates that a sequence of level chunks is playable
 */
export function validateLevelData(
  levelData: LevelData,
  canvasHeight: number = 600,
  previousGapY?: number
): { valid: boolean; issues: string[]; fixedChunks?: LevelChunk[] } {
  const issues: string[] = [];
  const chunks = levelData.chunks;
  const fixedChunks: LevelChunk[] = [];
  
  if (chunks.length === 0) {
    return { valid: false, issues: ['No chunks provided'] };
  }
  
  // Start from previous gap or center of screen
  let currentGapY = previousGapY ?? 0.5;
  
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const gapY = chunk.gapY;
    const gapHeight = chunk.gapHeight;
    
    // Check 1: Gap Y is in valid range (0.2-0.8)
    if (gapY < 0.2 || gapY > 0.8) {
      issues.push(`Chunk ${i}: gapY ${gapY} is outside safe range (0.2-0.8)`);
      // Fix: clamp to safe range
      chunk.gapY = Math.max(0.2, Math.min(0.8, gapY));
    }
    
    // Check 2: Gap height is sufficient
    const absoluteGapHeight = gapHeight * canvasHeight;
    if (absoluteGapHeight < MIN_GAP_HEIGHT) {
      issues.push(`Chunk ${i}: gapHeight ${absoluteGapHeight}px is below minimum ${MIN_GAP_HEIGHT}px`);
      // Fix: increase to minimum
      chunk.gapHeight = MIN_GAP_HEIGHT / canvasHeight;
    }
    
    // Check 3: Gap height is reasonable (not too large)
    if (gapHeight > 0.4) {
      issues.push(`Chunk ${i}: gapHeight ${gapHeight} is too large (max 0.4)`);
      chunk.gapHeight = Math.min(0.4, gapHeight);
    }
    
    // Check 4: Smooth transition from previous gap
    if (i > 0 || previousGapY !== undefined) {
      const gapDifference = Math.abs(gapY - currentGapY);
      if (gapDifference > 0.3) {
        issues.push(`Chunk ${i}: gap transition too abrupt (${gapDifference.toFixed(2)} > 0.3)`);
        // Fix: smooth the transition
        const maxChange = 0.25; // Max 25% change per obstacle
        if (gapY > currentGapY) {
          chunk.gapY = Math.min(currentGapY + maxChange, gapY);
        } else {
          chunk.gapY = Math.max(currentGapY - maxChange, gapY);
        }
      }
    }
    
    // Check 5: Gap is reachable from previous position
    if (i > 0 || previousGapY !== undefined) {
      const isReachable = canReachGap(
        currentGapY,
        chunk.gapY,
        chunk.gapHeight,
        OBSTACLE_SPACING + OBSTACLE_WIDTH,
        canvasHeight
      );
      
      if (!isReachable) {
        issues.push(`Chunk ${i}: gap is not reachable from previous position`);
        // Fix: adjust gap position to be reachable
        // Move gap closer to previous position
        const direction = chunk.gapY > currentGapY ? 1 : -1;
        const maxReachableDistance = 0.2; // Conservative estimate
        chunk.gapY = currentGapY + direction * Math.min(
          Math.abs(chunk.gapY - currentGapY),
          maxReachableDistance
        );
        // Ensure it's still in valid range
        chunk.gapY = Math.max(0.2, Math.min(0.8, chunk.gapY));
      }
    }
    
    fixedChunks.push({ ...chunk });
    currentGapY = chunk.gapY;
  }
  
  // If we fixed issues, return fixed chunks
  if (issues.length > 0 && fixedChunks.length > 0) {
    return {
      valid: true, // Valid after fixes
      issues,
      fixedChunks
    };
  }
  
  return {
    valid: issues.length === 0,
    issues
  };
}

/**
 * Validates and fixes a single chunk
 */
export function validateAndFixChunk(
  chunk: LevelChunk,
  previousGapY: number,
  canvasHeight: number = 600
): LevelChunk {
  const fixed: LevelChunk = { ...chunk };
  
  // Ensure gapY is in valid range
  fixed.gapY = Math.max(0.2, Math.min(0.8, fixed.gapY));
  
  // Ensure gapHeight is sufficient
  const absoluteGapHeight = fixed.gapHeight * canvasHeight;
  if (absoluteGapHeight < MIN_GAP_HEIGHT) {
    fixed.gapHeight = MIN_GAP_HEIGHT / canvasHeight;
  }
  
  // Smooth transition from previous gap
  const gapDifference = Math.abs(fixed.gapY - previousGapY);
  if (gapDifference > 0.25) {
    const maxChange = 0.25;
    if (fixed.gapY > previousGapY) {
      fixed.gapY = Math.min(previousGapY + maxChange, fixed.gapY);
    } else {
      fixed.gapY = Math.max(previousGapY - maxChange, fixed.gapY);
    }
  }
  
  // Ensure gap is reachable
  const isReachable = canReachGap(
    previousGapY,
    fixed.gapY,
    fixed.gapHeight,
    OBSTACLE_SPACING + OBSTACLE_WIDTH,
    canvasHeight
  );
  
  if (!isReachable) {
    // Move gap to be reachable (closer to previous)
    const direction = fixed.gapY > previousGapY ? 1 : -1;
    const maxReachableDistance = 0.2;
    fixed.gapY = previousGapY + direction * Math.min(
      Math.abs(fixed.gapY - previousGapY),
      maxReachableDistance
    );
    fixed.gapY = Math.max(0.2, Math.min(0.8, fixed.gapY));
  }
  
  return fixed;
}

