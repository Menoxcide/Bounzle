// Canvas rendering
import { Theme, getTheme, generateColorVariation } from './themes';
import { Ball, Obstacle, BackgroundLayer, BackgroundElement, BackgroundElementType } from './types';

export class Renderer {
  private canvas: HTMLCanvasElement;
  public ctx: CanvasRenderingContext2D;
  private currentTheme: Theme;
  private backgroundLayers: BackgroundLayer[] = [];
  private scrollOffset: number = 0;
  
  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Could not get 2D context');
    }
    this.ctx = ctx;
    this.currentTheme = getTheme('normal');
    this.initializeBackgroundLayers();
  }
  
  setTheme(themeName: string): void {
    this.currentTheme = getTheme(themeName);
    this.initializeBackgroundLayers();
  }
  
  private initializeBackgroundLayers(): void {
    this.backgroundLayers = [];
    
    // Layer 1: Far background (slowest, 0.2x speed)
    this.backgroundLayers.push({
      elements: this.generateBackgroundElements(15, 0.2, ['cloud', 'gradient']),
      parallaxSpeed: 0.2,
      color: this.getThemeColorForLayer(0),
      opacity: 0.3
    });
    
    // Layer 2: Mid-far background (0.4x speed)
    this.backgroundLayers.push({
      elements: this.generateBackgroundElements(12, 0.4, ['cloud', 'circle']),
      parallaxSpeed: 0.4,
      color: this.getThemeColorForLayer(1),
      opacity: 0.5
    });
    
    // Layer 3: Mid background (0.6x speed)
    this.backgroundLayers.push({
      elements: this.generateBackgroundElements(10, 0.6, ['cloud', 'triangle', 'circle']),
      parallaxSpeed: 0.6,
      color: this.getThemeColorForLayer(2),
      opacity: 0.6
    });
    
    // Layer 4: Near background (1.0x speed, same as obstacles)
    this.backgroundLayers.push({
      elements: this.generateBackgroundElements(8, 1.0, ['circle', 'triangle', 'star']),
      parallaxSpeed: 1.0,
      color: this.getThemeColorForLayer(3),
      opacity: 0.4
    });
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
  
  private generateBackgroundElements(
    count: number, 
    parallaxSpeed: number, 
    allowedTypes: BackgroundElementType[]
  ): BackgroundElement[] {
    const elements: BackgroundElement[] = [];
    
    for (let i = 0; i < count; i++) {
      const type = allowedTypes[Math.floor(Math.random() * allowedTypes.length)];
      const x = Math.random() * this.canvas.width * 2; // Spread across wider area
      const y = Math.random() * this.canvas.height;
      const size = 20 + Math.random() * 80;
      const opacity = 0.2 + Math.random() * 0.4;
      
      elements.push({
        type,
        x,
        y,
        size,
        opacity,
        parallaxSpeed,
        color: undefined // Will use layer color
      });
    }
    
    return elements;
  }
  
  updateBackground(scrollSpeed: number, deltaTime: number): void {
    this.scrollOffset += scrollSpeed * deltaTime;
    
    // Update and regenerate elements as they scroll off-screen
    for (const layer of this.backgroundLayers) {
      for (const element of layer.elements) {
        // Move element based on parallax speed
        element.x -= scrollSpeed * deltaTime * element.parallaxSpeed;
        
        // If element is off-screen, regenerate it on the right side
        if (element.x + element.size < 0) {
          element.x = this.canvas.width + Math.random() * this.canvas.width;
          element.y = Math.random() * this.canvas.height;
          // Occasionally change size and opacity for variety
          if (Math.random() < 0.3) {
            element.size = 20 + Math.random() * 80;
            element.opacity = 0.2 + Math.random() * 0.4;
          }
        }
      }
    }
  }
  
  private drawBackgroundElement(element: BackgroundElement, layer: BackgroundLayer): void {
    this.ctx.save();
    this.ctx.globalAlpha = element.opacity * layer.opacity;
    const color = element.color || layer.color;
    
    switch (element.type) {
      case 'cloud':
        this.drawCloud(element.x, element.y, element.size, color);
        break;
      case 'circle':
        this.drawCircle(element.x, element.y, element.size, color);
        break;
      case 'triangle':
        this.drawTriangle(element.x, element.y, element.size, color);
        break;
      case 'star':
        this.drawStar(element.x, element.y, element.size, color);
        break;
      case 'gradient':
        this.drawGradientCircle(element.x, element.y, element.size, color);
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
  
  clear(): void {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Draw base background gradient
    if (this.currentTheme.name === 'normal') {
      const gradient = this.ctx.createLinearGradient(0, 0, 0, this.canvas.height);
      gradient.addColorStop(0, '#dbeafe');
      gradient.addColorStop(1, '#bfdbfe');
      this.ctx.fillStyle = gradient;
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    } else {
      this.ctx.fillStyle = this.currentTheme.backgroundColor;
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }
    
    // Draw background layers (farthest to nearest)
    for (const layer of this.backgroundLayers) {
      for (const element of layer.elements) {
        this.drawBackgroundElement(element, layer);
      }
    }
  }
  
  drawBall(ball: Ball): void {
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
    const gapTop = obstacle.position.y + obstacle.gapY - obstacle.gapHeight / 2;
    const gapBottom = obstacle.position.y + obstacle.gapY + obstacle.gapHeight / 2;
    
    // Get base theme colors
    const baseObstacleColor = obstacle.theme === 'neon' ? '#00ff00' : 
                        obstacle.theme === 'lava' ? '#ef4444' : 
                        this.currentTheme.obstacleColor;
    const baseObstacleHighlight = obstacle.theme === 'neon' ? '#00cc00' : 
                           obstacle.theme === 'lava' ? '#dc2626' : 
                           this.currentTheme.obstacleHighlightColor;
    
    // Generate color variations using obstacle position as seed for consistency
    const seed = Math.floor(obstacle.position.x * 1000 + obstacle.position.y);
    const obstacleColor = generateColorVariation(baseObstacleColor, seed);
    const obstacleHighlight = generateColorVariation(baseObstacleHighlight, seed);
    
    // Draw shadow for top obstacle
    this.ctx.save();
    this.ctx.shadowBlur = 8;
    this.ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
    this.ctx.shadowOffsetX = 3;
    this.ctx.shadowOffsetY = 3;
    
    const topHeight = gapTop - obstacle.position.y;
    
    // Draw top obstacle with gradient
    const topGradient = this.ctx.createLinearGradient(
      obstacle.position.x, obstacle.position.y,
      obstacle.position.x + obstacle.width, obstacle.position.y
    );
    topGradient.addColorStop(0, obstacleColor);
    topGradient.addColorStop(0.5, obstacleHighlight);
    topGradient.addColorStop(1, obstacleColor);
    
    this.ctx.fillStyle = topGradient;
    this.ctx.fillRect(
      obstacle.position.x,
      obstacle.position.y,
      obstacle.width,
      topHeight
    );
    
    // Add highlight edge to top obstacle
    const topHighlightGradient = this.ctx.createLinearGradient(
      obstacle.position.x, obstacle.position.y,
      obstacle.position.x, obstacle.position.y + 15
    );
    topHighlightGradient.addColorStop(0, 'rgba(255, 255, 255, 0.3)');
    topHighlightGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    this.ctx.fillStyle = topHighlightGradient;
    this.ctx.fillRect(
      obstacle.position.x,
      obstacle.position.y,
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
    
    const bottomHeight = obstacle.position.y + obstacle.height - gapBottom;
    
    // Draw bottom obstacle with gradient
    const bottomGradient = this.ctx.createLinearGradient(
      obstacle.position.x, gapBottom,
      obstacle.position.x + obstacle.width, gapBottom
    );
    bottomGradient.addColorStop(0, obstacleColor);
    bottomGradient.addColorStop(0.5, obstacleHighlight);
    bottomGradient.addColorStop(1, obstacleColor);
    
    this.ctx.fillStyle = bottomGradient;
    this.ctx.fillRect(
      obstacle.position.x,
      gapBottom,
      obstacle.width,
      bottomHeight
    );
    
    // Add highlight edge to bottom obstacle
    const bottomHighlightGradient = this.ctx.createLinearGradient(
      obstacle.position.x, gapBottom,
      obstacle.position.x, gapBottom + 15
    );
    bottomHighlightGradient.addColorStop(0, 'rgba(255, 255, 255, 0.3)');
    bottomHighlightGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    this.ctx.fillStyle = bottomHighlightGradient;
    this.ctx.fillRect(
      obstacle.position.x,
      gapBottom,
      obstacle.width,
      Math.min(15, bottomHeight)
    );
    
    this.ctx.restore();
    
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
  
  resize(width: number, height: number): void {
    this.canvas.width = width;
    this.canvas.height = height;
    // Regenerate background layers with new canvas dimensions
    this.initializeBackgroundLayers();
  }
}