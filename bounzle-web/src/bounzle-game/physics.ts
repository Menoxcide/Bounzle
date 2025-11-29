// Physics calculations
import { Ball } from './types';

export const GRAVITY = 0.5;
export const JUMP_FORCE = -12;
export const SCROLL_SPEED = 3;

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
  // Simple rectangle collision detection
  const ballLeft = ball.position.x - ball.radius;
  const ballRight = ball.position.x + ball.radius;
  const ballTop = ball.position.y - ball.radius;
  const ballBottom = ball.position.y + ball.radius;
  
  const obstacleLeft = obstacle.position.x;
  const obstacleRight = obstacle.position.x + obstacle.width;
  const gapTop = obstacle.position.y + obstacle.gapY - obstacle.gapHeight / 2;
  const gapBottom = obstacle.position.y + obstacle.gapY + obstacle.gapHeight / 2;
  
  // Check if ball is within obstacle's horizontal bounds
  if (ballRight > obstacleLeft && ballLeft < obstacleRight) {
    // Check if ball is NOT within the gap
    if (ballBottom < gapTop || ballTop > gapBottom) {
      return true;
    }
  }
  
  return false;
}

export function checkBoundaryCollision(ball: Ball, canvasHeight: number): boolean {
  // In Flappy Bird style games, boundaries shouldn't cause instant death
  // Only check for extreme cases where ball is way off screen (safety check)
  const ballTop = ball.position.y - ball.radius;
  const ballBottom = ball.position.y + ball.radius;
  
  // Only trigger if ball is significantly off screen (more than 100px)
  return ballBottom < -100 || ballTop > canvasHeight + 100;
}