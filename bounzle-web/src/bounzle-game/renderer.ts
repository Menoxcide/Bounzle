// Canvas rendering
import { Theme, getTheme } from './themes';

export class Renderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private currentTheme: Theme;
  
  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Could not get 2D context');
    }
    this.ctx = ctx;
    this.currentTheme = getTheme('normal');
  }
  
  setTheme(themeName: string): void {
    this.currentTheme = getTheme(themeName);
  }
  
  clear(): void {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Draw background based on theme
    if (this.currentTheme.name === 'normal') {
      // Gradient background for normal theme
      const gradient = this.ctx.createLinearGradient(0, 0, 0, this.canvas.height);
      gradient.addColorStop(0, '#dbeafe'); // blue-100
      gradient.addColorStop(1, '#bfdbfe'); // blue-200
      this.ctx.fillStyle = gradient;
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    } else {
      // Solid color background for other themes
      this.ctx.fillStyle = this.currentTheme.backgroundColor;
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }
  
  drawBall(ball: any): void {
    this.ctx.beginPath();
    this.ctx.arc(ball.position.x, ball.position.y, ball.radius, 0, Math.PI * 2);
    
    // Ball with gradient based on theme
    const gradient = this.ctx.createRadialGradient(
      ball.position.x - ball.radius/3, 
      ball.position.y - ball.radius/3, 
      1,
      ball.position.x, 
      ball.position.y, 
      ball.radius
    );
    gradient.addColorStop(0, this.currentTheme.ballColor);
    gradient.addColorStop(1, this.currentTheme.ballHighlightColor);
    
    this.ctx.fillStyle = gradient;
    this.ctx.fill();
    this.ctx.closePath();
    
    // Ball highlight
    this.ctx.beginPath();
    this.ctx.arc(
      ball.position.x - ball.radius/3, 
      ball.position.y - ball.radius/3, 
      ball.radius/3, 
      0, 
      Math.PI * 2
    );
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    this.ctx.fill();
    this.ctx.closePath();
  }
  
  drawObstacle(obstacle: any): void {
    const gapTop = obstacle.position.y + obstacle.gapY - obstacle.gapHeight / 2;
    const gapBottom = obstacle.position.y + obstacle.gapY + obstacle.gapHeight / 2;
    
    // Use theme colors or obstacle-specific colors
    let obstacleColor = obstacle.obstacleType === 'neon' ? '#00ff00' : 
                        obstacle.obstacleType === 'lava' ? '#ef4444' : 
                        this.currentTheme.obstacleColor;
    let obstacleHighlight = obstacle.obstacleType === 'neon' ? '#00cc00' : 
                           obstacle.obstacleType === 'lava' ? '#dc2626' : 
                           this.currentTheme.obstacleHighlightColor;
    
    // Draw top obstacle
    this.ctx.fillStyle = obstacleColor;
    this.ctx.fillRect(
      obstacle.position.x,
      obstacle.position.y,
      obstacle.width,
      gapTop - obstacle.position.y
    );
    
    // Add highlight to top obstacle
    this.ctx.fillStyle = obstacleHighlight;
    this.ctx.fillRect(
      obstacle.position.x,
      obstacle.position.y,
      obstacle.width,
      10
    );
    
    // Draw bottom obstacle
    this.ctx.fillStyle = obstacleColor;
    this.ctx.fillRect(
      obstacle.position.x,
      gapBottom,
      obstacle.width,
      obstacle.position.y + obstacle.height - gapBottom
    );
    
    // Add highlight to bottom obstacle
    this.ctx.fillStyle = obstacleHighlight;
    this.ctx.fillRect(
      obstacle.position.x,
      gapBottom,
      obstacle.width,
      10
    );
    
    // Draw special effects based on obstacle type
    if (obstacle.obstacleType === 'spike') {
      // Draw spikes on the edges of the gap
      this.ctx.fillStyle = obstacleColor;
      for (let i = 0; i < 5; i++) {
        const spikeX = obstacle.position.x + obstacle.width/2 + (i - 2) * 10;
        this.drawSpike(spikeX, gapTop, 8, 10, true); // Top spikes
        this.drawSpike(spikeX, gapBottom, 8, 10, false); // Bottom spikes
      }
    } else if (obstacle.obstacleType === 'moving') {
      // Add a visual indicator for moving obstacles
      this.ctx.fillStyle = '#fbbf24'; // amber-400
      this.ctx.beginPath();
      this.ctx.arc(
        obstacle.position.x + obstacle.width/2, 
        obstacle.position.y + obstacle.height/2, 
        5, 
        0, 
        Math.PI * 2
      );
      this.ctx.fill();
    }
  }
  
  private drawSpike(x: number, y: number, width: number, height: number, pointingUp: boolean): void {
    this.ctx.beginPath();
    if (pointingUp) {
      this.ctx.moveTo(x - width/2, y);
      this.ctx.lineTo(x + width/2, y);
      this.ctx.lineTo(x, y - height);
    } else {
      this.ctx.moveTo(x - width/2, y);
      this.ctx.lineTo(x + width/2, y);
      this.ctx.lineTo(x, y + height);
    }
    this.ctx.closePath();
    this.ctx.fill();
  }
  
  drawScore(score: number): void {
    this.ctx.font = 'bold 24px Arial';
    this.ctx.fillStyle = this.currentTheme.textColor;
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'top';
    this.ctx.fillText(`Score: ${score}`, this.canvas.width / 2, 10);
    
    // Add a background to the score
    const textMetrics = this.ctx.measureText(`Score: ${score}`);
    this.ctx.fillStyle = this.currentTheme.uiBackgroundColor;
    this.ctx.fillRect(
      this.canvas.width / 2 - textMetrics.width / 2 - 10,
      5,
      textMetrics.width + 20,
      30
    );
    
    // Redraw the text
    this.ctx.fillStyle = this.currentTheme.textColor;
    this.ctx.fillText(`Score: ${score}`, this.canvas.width / 2, 10);
  }
  
  resize(width: number, height: number): void {
    this.canvas.width = width;
    this.canvas.height = height;
  }
}