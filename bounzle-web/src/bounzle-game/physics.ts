// Physics calculations

export const GRAVITY = 0.5;
export const JUMP_FORCE = -12;
export const SCROLL_SPEED = 3;

export function updateBallPosition(ball: any, deltaTime: number): void {
  // Apply gravity
  ball.velocity.y += GRAVITY * ball.gravityScale;
  
  // Update position based on velocity
  ball.position.x += ball.velocity.x * deltaTime;
  ball.position.y += ball.velocity.y * deltaTime;
}

export function applyJumpForce(ball: any): void {
  ball.velocity.y = JUMP_FORCE;
}

export function checkCollision(ball: any, obstacle: any): boolean {
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

export function checkBoundaryCollision(ball: any, canvasHeight: number): boolean {
  const ballTop = ball.position.y - ball.radius;
  const ballBottom = ball.position.y + ball.radius;
  
  return ballTop < 0 || ballBottom > canvasHeight;
}