// Physics calculations
import { Ball } from './types';

export const GRAVITY = 0.5;
export const JUMP_FORCE = -12;
export const SCROLL_SPEED = 3;

// Collision tuning constants
// Slightly shrink the effective collision radius so near-misses feel fair
const COLLISION_RADIUS_FACTOR = 0.9;
// Expand the vertical safe gap by this many pixels on top and bottom
const GAP_VERTICAL_PADDING = 10;

// Debug flag for collision detection logging
const COLLISION_DEBUG = true;

export function updateBallPosition(ball: Ball, deltaTime: number): void {
  // Apply gravity
  ball.velocity.y += GRAVITY * ball.gravityScale;
  
  // Update position based on velocity
  ball.position.x += ball.velocity.x * deltaTime;
  ball.position.y += ball.velocity.y * deltaTime;
}

export function applyJumpForce(ball: Ball): void {
  ball.velocity.y = JUMP_FORCE;
}

export function checkCollision(ball: Ball, obstacle: import('./types').Obstacle): boolean {
  // Validate obstacle exists and has required properties
  if (!obstacle || !obstacle.position) {
    return false;
  }
  
  const orientation = obstacle.orientation || 'vertical';
  
  // Handle horizontal walls differently
  if (orientation === 'horizontal') {
    // For horizontal walls, check vertical collision (ball hits top or bottom of wall)
    // NOTE: Both ball.position and obstacle.position are in WORLD coordinates
    // Walls are at fixed world positions: top wall at y=0, bottom wall at y=canvas.height-height
    // Camera offset affects rendering only, not world positions
    const effectiveRadius = ball.radius * COLLISION_RADIUS_FACTOR;
    const ballTop = ball.position.y - effectiveRadius;
    const ballBottom = ball.position.y + effectiveRadius;
    
    const obstacleTop = obstacle.position.y; // World Y coordinate
    const obstacleBottom = obstacle.position.y + obstacle.height; // World Y coordinate
    
    // For horizontal walls, we need to check if the ball is actually overlapping with the wall
    // The ball must be intersecting the wall's vertical extent
    // Use strict overlap check: ball must actually be touching/inside the wall
    const hasActualOverlap = ballBottom > obstacleTop && ballTop < obstacleBottom;
    
    if (COLLISION_DEBUG && (hasActualOverlap || Math.abs(ball.position.y - (obstacleTop + obstacle.height/2)) < 100)) {
      console.log('[COLLISION_DEBUG] Horizontal wall collision check:');
      console.log(`  Ball: pos=(${ball.position.x.toFixed(2)}, ${ball.position.y.toFixed(2)}), top=${ballTop.toFixed(2)}, bottom=${ballBottom.toFixed(2)}, radius=${ball.radius}`);
      console.log(`  Wall: top=${obstacleTop.toFixed(2)}, bottom=${obstacleBottom.toFixed(2)}, height=${obstacle.height}`);
      console.log(`  Has actual overlap: ${hasActualOverlap}`);
      console.log(`  Gap: type=${obstacle.gapType}, gapX=${obstacle.gapX?.toFixed(2) ?? 'undefined'}, gapWidth=${obstacle.gapWidth?.toFixed(2) ?? 'undefined'}`);
    }
    
    if (hasActualOverlap) {
      // Also check if ball is within the wall's horizontal bounds
      const obstacleLeft = obstacle.position.x;
      const obstacleRight = obstacle.position.x + obstacle.width;
      const ballLeft = ball.position.x - ball.radius;
      const ballRight = ball.position.x + ball.radius;
      
      // Check if ball overlaps with wall horizontally
      const hasHorizontalOverlap = !(ballRight < obstacleLeft || ballLeft > obstacleRight);
      
      if (!hasHorizontalOverlap) {
        // Ball is not within wall's horizontal bounds - no collision
        if (COLLISION_DEBUG) {
          console.log('  RESULT: No collision - ball outside wall horizontal bounds');
        }
        return false;
      }
      
      // Ball overlaps both vertically and horizontally - check if it's in the gap
      // Check for any gap (not just special types) - all walls should have gaps
      if (obstacle.gapX !== undefined && obstacle.gapWidth !== undefined && obstacle.gapWidth > 0) {
        // Wall has a gap - check if ball is in the gap
        const gapLeft = obstacle.gapX - obstacle.gapWidth / 2;
        const gapRight = obstacle.gapX + obstacle.gapWidth / 2;
        // Reduced padding for tighter collision - only small margin for edge cases
        const GAP_HORIZONTAL_PADDING = 5; // Reduced from 30 to 5 for tighter collision
        const adjustedGapLeft = gapLeft - GAP_HORIZONTAL_PADDING;
        const adjustedGapRight = gapRight + GAP_HORIZONTAL_PADDING;
        
        // Stricter gap check: ball must be CLEARLY in the gap
        // The ball center must be within the gap (with small padding) AND
        // the ball must not be overlapping the wall outside the gap
        const ballCenterX = ball.position.x;
        const ballCenterInGap = ballCenterX >= adjustedGapLeft && ballCenterX <= adjustedGapRight;
        
        // Check if ball overlaps the gap area (for edge cases)
        const ballOverlapsGap = !(ballRight < adjustedGapLeft || ballLeft > adjustedGapRight);
        
        // Stricter check: ball can only pass if:
        // 1. Ball center is clearly in the gap, AND
        // 2. Ball is not overlapping wall segments outside the gap
        // This prevents partial overlaps from allowing passage through solid wall parts
        let canPassThrough = false;
        
        if (ballCenterInGap) {
          // Ball center is in gap - check if ball extends beyond gap boundaries
          // If ball extends significantly beyond gap, it's hitting the wall
          const ballExtendsLeft = ballLeft < adjustedGapLeft;
          const ballExtendsRight = ballRight > adjustedGapRight;
          
          // Allow passage only if ball doesn't extend too far beyond gap
          // Use a small tolerance (half ball radius) for edge cases
          const tolerance = ball.radius * 0.3;
          canPassThrough = !ballExtendsLeft && !ballExtendsRight;
          
          // If ball slightly extends, still allow if extension is minimal
          if (!canPassThrough) {
            const leftExtension = ballExtendsLeft ? adjustedGapLeft - ballLeft : 0;
            const rightExtension = ballExtendsRight ? ballRight - adjustedGapRight : 0;
            canPassThrough = leftExtension <= tolerance && rightExtension <= tolerance;
          }
        } else if (ballOverlapsGap) {
          // Ball overlaps gap but center is outside - only allow if most of ball is in gap
          // Calculate how much of the ball is in the gap
          const ballInGapLeft = Math.max(ballLeft, adjustedGapLeft);
          const ballInGapRight = Math.min(ballRight, adjustedGapRight);
          const ballInGapWidth = Math.max(0, ballInGapRight - ballInGapLeft);
          const ballTotalWidth = ballRight - ballLeft;
          const ballInGapRatio = ballTotalWidth > 0 ? ballInGapWidth / ballTotalWidth : 0;
          
          // Only allow passage if more than 60% of ball is in gap
          canPassThrough = ballInGapRatio > 0.6;
        }
        
        if (COLLISION_DEBUG) {
          console.log(`  Wall bounds: left=${obstacleLeft.toFixed(2)}, right=${obstacleRight.toFixed(2)}`);
          console.log(`  Ball X bounds: left=${ballLeft.toFixed(2)}, right=${ballRight.toFixed(2)}, center=${ballCenterX.toFixed(2)}`);
          console.log(`  Gap check: gapLeft=${gapLeft.toFixed(2)}, gapRight=${gapRight.toFixed(2)}`);
          console.log(`  Adjusted gap: left=${adjustedGapLeft.toFixed(2)}, right=${adjustedGapRight.toFixed(2)}`);
          console.log(`  Ball center in gap: ${ballCenterInGap}, Ball overlaps gap: ${ballOverlapsGap}, Can pass: ${canPassThrough}`);
        }
        
        // If ball is in gap, no collision (allow traversal)
        if (canPassThrough) {
          if (COLLISION_DEBUG) {
            console.log('  RESULT: No collision - ball is in gap');
          }
          return false;
        }
      } else {
        // No gap exists - check if this is intentional (wall should have gaps for gameplay)
        // If wall has no gap, it's a solid wall and collision should occur
        if (COLLISION_DEBUG) {
          console.log('  No gap in wall - solid wall collision');
        }
      }
      
      // Ball is in wall bounds (both horizontally and vertically) but not in gap (or no gap exists) - collision!
      if (COLLISION_DEBUG) {
        console.log('  RESULT: COLLISION DETECTED - ball in wall bounds and not in gap');
      }
      return true;
    }
    
    if (COLLISION_DEBUG && (Math.abs(ballBottom - obstacleTop) < 50 || Math.abs(ballTop - obstacleBottom) < 50)) {
      console.log('[COLLISION_DEBUG] Ball near horizontal wall but not colliding:');
      console.log(`  Ball: pos=(${ball.position.x.toFixed(2)}, ${ball.position.y.toFixed(2)}), top=${ballTop.toFixed(2)}, bottom=${ballBottom.toFixed(2)}`);
      console.log(`  Wall: top=${obstacleTop.toFixed(2)}, bottom=${obstacleBottom.toFixed(2)}`);
      console.log(`  Distance to wall top: ${(ballBottom - obstacleTop).toFixed(2)}`);
      console.log(`  Distance to wall bottom: ${(ballTop - obstacleBottom).toFixed(2)}`);
      console.log(`  Has actual overlap: ${hasActualOverlap}`);
    }
    
    return false;
  }
  
  // Original vertical wall collision detection
  if (typeof obstacle.gapY !== 'number' || typeof obstacle.gapHeight !== 'number') {
    return false;
  }
  
  // Simple rectangle collision detection
  // Use full radius for horizontal checks so side hits still feel strict,
  // but use a slightly smaller radius for vertical checks to reduce false positives.
  const ballLeft = ball.position.x - ball.radius;
  const ballRight = ball.position.x + ball.radius;

  const effectiveRadius = ball.radius * COLLISION_RADIUS_FACTOR;
  const ballTop = ball.position.y - effectiveRadius;
  const ballBottom = ball.position.y + effectiveRadius;
  
  const obstacleLeft = obstacle.position.x;
  const obstacleRight = obstacle.position.x + obstacle.width;
  
  // Gap calculation must match renderer.ts line 319-320
  // In renderer: gapTop = obstacle.position.y + obstacle.gapY - obstacle.gapHeight / 2
  // obstacle.position.y should be 0 for obstacles (they start at top of canvas)
  let gapTop = obstacle.position.y + obstacle.gapY - obstacle.gapHeight / 2;
  let gapBottom = obstacle.position.y + obstacle.gapY + obstacle.gapHeight / 2;

  // Make the safe region slightly larger vertically so grazing the edges
  // of the gap is less likely to register as a hit.
  gapTop -= GAP_VERTICAL_PADDING;
  gapBottom += GAP_VERTICAL_PADDING;
  
  // Check if ball is within obstacle's horizontal bounds
  if (ballRight > obstacleLeft && ballLeft < obstacleRight) {
    // Check if ball is NOT within the gap
    // Ball must be completely outside the gap to collide
    if (ballBottom < gapTop || ballTop > gapBottom) {
      return true;
    }
  }
  
  return false;
}

export function checkBoundaryCollision(ball: Ball, canvasHeight: number, cameraOffsetY: number = 0): boolean {
  // In Flappy Bird style games, boundaries shouldn't cause instant death
  // The camera should follow the ball, so this is only a safety check for extreme edge cases
  // Convert ball world position to screen space by accounting for camera offset
  const ballTop = ball.position.y - ball.radius - cameraOffsetY;
  const ballBottom = ball.position.y + ball.radius - cameraOffsetY;
  
  // Only trigger if ball is WAY off screen in screen space (more than 1000px buffer)
  // This accounts for the camera following the ball - if there's a valid gap/path,
  // the camera will follow and the ball should stay visible
  // This check is only for safety when physics glitches or ball gets stuck
  // Increased buffer significantly to prevent false positives with procedural walls
  // The ball can fall quite far before hitting a wall, so we need a large buffer
  return ballBottom < -1000 || ballTop > canvasHeight + 1000;
}