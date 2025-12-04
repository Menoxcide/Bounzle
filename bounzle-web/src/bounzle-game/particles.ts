// Enhanced particle system for visual effects with multiple particle types

export type ParticleType = 'spark' | 'trail' | 'smoke' | 'star' | 'glow' | 'debris' | 'energy' | 'bubble';

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
  type: ParticleType;
  rotation?: number;
  rotationSpeed?: number;
  gravity?: number;
  wind?: number;
  turbulence?: number;
  pulsePhase?: number;
  trail?: Array<{ x: number; y: number }>;
  maxTrailLength?: number;
}

// Object pool for particles to improve performance
class ParticlePool {
  private pool: Particle[] = [];
  private maxSize: number;
  
  constructor(maxSize: number = 200) {
    this.maxSize = maxSize;
  }
  
  acquire(): Particle | null {
    if (this.pool.length > 0) {
      return this.pool.pop()!;
    }
    return null;
  }
  
  release(particle: Particle): void {
    if (this.pool.length < this.maxSize) {
      // Reset particle and clean up trail to prevent memory leaks
      particle.trail = undefined;
      particle.x = 0;
      particle.y = 0;
      particle.vx = 0;
      particle.vy = 0;
      particle.life = 0;
      particle.maxLife = 0;
      this.pool.push(particle);
    }
  }
  
  clear(): void {
    this.pool.length = 0;
  }
}

export class ParticleSystem {
  private particles: Particle[] = [];
  private pool: ParticlePool;
  private maxParticles: number = 200;
  
  constructor(maxParticles: number = 200) {
    this.maxParticles = maxParticles;
    this.pool = new ParticlePool(maxParticles);
  }
  
  private createParticle(
    x: number,
    y: number,
    type: ParticleType,
    color: string = '#ffffff',
    options: Partial<Particle> = {}
  ): Particle | null {
    // Use pool if available, otherwise create new
    let particle = this.pool.acquire();
    
    if (!particle) {
      particle = {
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        life: 1.0,
        maxLife: 1.0,
        color: '#ffffff',
        size: 1,
        type: 'spark'
      };
    }
    
    // Initialize particle based on type
    particle.x = x;
    particle.y = y;
    particle.type = type;
    particle.color = color;
    particle.life = 1.0;
    particle.maxLife = 1.0;
    
    // Type-specific initialization
    switch (type) {
      case 'spark':
        particle.vx = (Math.random() - 0.5) * 8;
        particle.vy = (Math.random() - 0.5) * 8;
        particle.size = Math.random() * 3 + 1;
        particle.maxLife = 0.5;
        particle.life = particle.maxLife;
        particle.gravity = 0.2;
        particle.rotationSpeed = (Math.random() - 0.5) * 10;
        break;
        
      case 'trail':
        particle.vx = 0;
        particle.vy = 0;
        particle.size = Math.random() * 2 + 1;
        particle.maxLife = 1.0;
        particle.life = particle.maxLife;
        particle.trail = [{ x, y }];
        particle.maxTrailLength = 10;
        break;
        
      case 'smoke':
        particle.vx = (Math.random() - 0.5) * 2;
        particle.vy = -Math.random() * 3 - 1;
        particle.size = Math.random() * 8 + 4;
        particle.maxLife = 2.0;
        particle.life = particle.maxLife;
        particle.gravity = -0.05; // Rises
        particle.wind = (Math.random() - 0.5) * 0.5;
        particle.turbulence = Math.random() * 0.3;
        break;
        
      case 'star':
        particle.vx = (Math.random() - 0.5) * 2;
        particle.vy = (Math.random() - 0.5) * 2;
        particle.size = Math.random() * 4 + 2;
        particle.maxLife = 3.0;
        particle.life = particle.maxLife;
        particle.rotationSpeed = (Math.random() - 0.5) * 5;
        particle.pulsePhase = Math.random() * Math.PI * 2;
        break;
        
      case 'glow':
        particle.vx = (Math.random() - 0.5) * 1;
        particle.vy = (Math.random() - 0.5) * 1;
        particle.size = Math.random() * 6 + 4;
        particle.maxLife = 4.0;
        particle.life = particle.maxLife;
        particle.pulsePhase = Math.random() * Math.PI * 2;
        break;
        
      case 'debris':
        particle.vx = (Math.random() - 0.5) * 6;
        particle.vy = (Math.random() - 0.5) * 6;
        particle.size = Math.random() * 5 + 3;
        particle.maxLife = 1.5;
        particle.life = particle.maxLife;
        particle.gravity = 0.3;
        particle.rotationSpeed = (Math.random() - 0.5) * 8;
        break;
        
      case 'energy':
        particle.vx = (Math.random() - 0.5) * 10;
        particle.vy = (Math.random() - 0.5) * 10;
        particle.size = Math.random() * 3 + 2;
        particle.maxLife = 0.8;
        particle.life = particle.maxLife;
        particle.rotationSpeed = (Math.random() - 0.5) * 15;
        break;
        
      case 'bubble':
        particle.vx = (Math.random() - 0.5) * 1;
        particle.vy = -Math.random() * 2 - 0.5;
        particle.size = Math.random() * 6 + 3;
        particle.maxLife = 3.0;
        particle.life = particle.maxLife;
        particle.gravity = -0.08; // Rises slowly
        particle.wind = (Math.random() - 0.5) * 0.3;
        break;
    }
    
    // Apply custom options
    Object.assign(particle, options);
    
    return particle;
  }
  
  addParticle(x: number, y: number, color: string = '#ffffff', type: ParticleType = 'spark'): void {
    if (this.particles.length >= this.maxParticles) {
      return; // Don't add if at max
    }
    
    // Limit particles per type to prevent accumulation
    let typeCount = 0;
    for (const p of this.particles) {
      if (p.type === type) typeCount++;
    }
    const maxForType = type === 'trail' ? 5 : Math.floor(this.maxParticles * 0.3);
    if (typeCount >= maxForType) {
      return; // Don't add if type limit reached
    }
    
    const particle = this.createParticle(x, y, type, color);
    if (particle) {
      this.particles.push(particle);
    }
  }
  
  addExplosion(x: number, y: number, color: string = '#ffffff', count: number = 15, type: ParticleType = 'spark'): void {
    for (let i = 0; i < count && this.particles.length < this.maxParticles; i++) {
      const angle = (i / count) * Math.PI * 2;
      const speed = 3 + Math.random() * 5;
      const particle = this.createParticle(x, y, type, color, {
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed
      });
      if (particle) {
        this.particles.push(particle);
      }
    }
  }
  
  addBurst(x: number, y: number, color: string = '#ffffff', count: number = 20): void {
    // Mix of spark and energy particles
    for (let i = 0; i < count && this.particles.length < this.maxParticles; i++) {
      const type = i % 3 === 0 ? 'energy' : 'spark';
      this.addParticle(x, y, color, type);
    }
  }
  
  addEnergyBurst(x: number, y: number, color: string = '#8b5cf6', count: number = 30): void {
    // Create electric energy burst with crackling effect
    for (let i = 0; i < count && this.particles.length < this.maxParticles; i++) {
      const angle = (i / count) * Math.PI * 2;
      const speed = 3 + Math.random() * 5;
      const particle = this.createParticle(x, y, 'energy', color, {
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 2 + Math.random() * 3,
        maxLife: 0.8 + Math.random() * 0.4
      });
      if (particle) {
        this.particles.push(particle);
      }
    }
  }
  
  addStarBurst(x: number, y: number, color: string = '#fbbf24', count: number = 20): void {
    // Create star burst with rotating stars
    for (let i = 0; i < count && this.particles.length < this.maxParticles; i++) {
      const angle = (i / count) * Math.PI * 2;
      const speed = 2 + Math.random() * 4;
      const particle = this.createParticle(x, y, 'star', color, {
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 3 + Math.random() * 4,
        rotationSpeed: (Math.random() - 0.5) * 5,
        maxLife: 1.0 + Math.random() * 0.5
      });
      if (particle) {
        this.particles.push(particle);
      }
    }
  }
  
  addBubbleBurst(x: number, y: number, color: string = '#06b6d4', count: number = 15): void {
    // Create bubble burst with floating bubbles
    for (let i = 0; i < count && this.particles.length < this.maxParticles; i++) {
      const angle = (i / count) * Math.PI * 2;
      const speed = 1 + Math.random() * 2;
      const particle = this.createParticle(x, y, 'bubble', color, {
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2, // Float upward
        size: 4 + Math.random() * 6,
        gravity: -0.1, // Negative gravity for floating
        maxLife: 1.5 + Math.random() * 0.5
      });
      if (particle) {
        this.particles.push(particle);
      }
    }
  }
  
  addStream(x: number, y: number, color: string = '#ffffff', count: number = 5, direction: { x: number; y: number } = { x: 0, y: -1 }): void {
    // Create stream of particles (e.g., smoke, bubbles)
    for (let i = 0; i < count && this.particles.length < this.maxParticles; i++) {
      const offsetX = (Math.random() - 0.5) * 10;
      const offsetY = (Math.random() - 0.5) * 10;
      const particle = this.createParticle(x + offsetX, y + offsetY, 'smoke', color, {
        vx: direction.x * (2 + Math.random() * 2),
        vy: direction.y * (2 + Math.random() * 2)
      });
      if (particle) {
        this.particles.push(particle);
      }
    }
  }
  
  addTrail(x: number, y: number, color: string = '#ffffff'): void {
    // Add trail particle that follows movement
    if (this.particles.length >= this.maxParticles) return;
    
    const particle = this.createParticle(x, y, 'trail', color);
    if (particle) {
      this.particles.push(particle);
    }
  }
  
  updateTrail(particle: Particle, newX: number, newY: number): void {
    if (particle.type === 'trail' && particle.trail) {
      particle.trail.push({ x: newX, y: newY });
      if (particle.maxTrailLength && particle.trail.length > particle.maxTrailLength) {
        particle.trail.shift();
      }
      particle.x = newX;
      particle.y = newY;
    }
  }
  
  update(deltaTime: number): void {
    // Use reverse iteration for efficient removal
    let writeIndex = 0;
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      
      // Update position
      p.x += p.vx * deltaTime;
      p.y += p.vy * deltaTime;
      
      // Apply physics
      if (p.gravity !== undefined) {
        p.vy += p.gravity * deltaTime;
      }
      
      if (p.wind !== undefined) {
        p.vx += p.wind * deltaTime;
      }
      
      if (p.turbulence !== undefined) {
        p.vx += (Math.random() - 0.5) * p.turbulence * deltaTime;
        p.vy += (Math.random() - 0.5) * p.turbulence * deltaTime;
      }
      
      // Update rotation
      if (p.rotationSpeed !== undefined) {
        p.rotation = (p.rotation || 0) + p.rotationSpeed * deltaTime;
      }
      
      // Update pulse phase
      if (p.pulsePhase !== undefined) {
        p.pulsePhase += deltaTime * 2;
      }
      
      // Reduce life
      p.life -= (1 / p.maxLife) * deltaTime * 0.1;
      
      // Keep alive particles, remove dead ones
      if (p.life > 0) {
        // Clean up trail if it exceeds max length (prevent memory growth)
        if (p.type === 'trail' && p.trail && p.maxTrailLength) {
          if (p.trail.length > p.maxTrailLength) {
            p.trail = p.trail.slice(-p.maxTrailLength);
          }
        }
        // Move alive particle to write position
        if (writeIndex !== i) {
          this.particles[writeIndex] = p;
        }
        writeIndex++;
      } else {
        // Return dead particle to pool
        this.pool.release(p);
      }
    }
    // Trim array to remove dead particles
    this.particles.length = writeIndex;
  }
  
  render(ctx: CanvasRenderingContext2D): void {
    for (const p of this.particles) {
      ctx.save();
      
      const alpha = p.life / p.maxLife;
      ctx.globalAlpha = alpha;
      
      // Type-specific rendering
      switch (p.type) {
        case 'spark':
          this.renderSpark(ctx, p);
          break;
        case 'trail':
          this.renderTrail(ctx, p);
          break;
        case 'smoke':
          this.renderSmoke(ctx, p);
          break;
        case 'star':
          this.renderStar(ctx, p);
          break;
        case 'glow':
          this.renderGlow(ctx, p);
          break;
        case 'debris':
          this.renderDebris(ctx, p);
          break;
        case 'energy':
          this.renderEnergy(ctx, p);
          break;
        case 'bubble':
          this.renderBubble(ctx, p);
          break;
      }
      
      ctx.restore();
    }
  }
  
  private renderSpark(ctx: CanvasRenderingContext2D, p: Particle): void {
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
    
    // Add glow
    const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 2);
    const rgb = this.hexToRgb(p.color);
    if (rgb) {
      gradient.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.6)`);
      gradient.addColorStop(1, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0)`);
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  
  private renderTrail(ctx: CanvasRenderingContext2D, p: Particle): void {
    if (!p.trail || p.trail.length < 2) {
      // Fallback to single point
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    
    // Draw trail line
    ctx.strokeStyle = p.color;
    ctx.lineWidth = p.size;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    ctx.beginPath();
    ctx.moveTo(p.trail[0].x, p.trail[0].y);
    for (let i = 1; i < p.trail.length; i++) {
      const progress = i / p.trail.length;
      ctx.globalAlpha = (p.life / p.maxLife) * progress;
      ctx.lineTo(p.trail[i].x, p.trail[i].y);
    }
    ctx.stroke();
    
    // Draw current position
    ctx.globalAlpha = p.life / p.maxLife;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  
  private renderSmoke(ctx: CanvasRenderingContext2D, p: Particle): void {
    const rgb = this.hexToRgb(p.color);
    if (!rgb) return;
    
    // Draw expanding smoke cloud
    const size = p.size * (1 + (1 - p.life / p.maxLife));
    const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, size);
    gradient.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.4)`);
    gradient.addColorStop(0.5, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.2)`);
    gradient.addColorStop(1, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0)`);
    
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
    ctx.fill();
  }
  
  private renderStar(ctx: CanvasRenderingContext2D, p: Particle): void {
    const pulse = p.pulsePhase !== undefined ? 0.8 + 0.2 * Math.sin(p.pulsePhase) : 1.0;
    const size = p.size * pulse;
    
    ctx.fillStyle = p.color;
    ctx.save();
    ctx.translate(p.x, p.y);
    if (p.rotation !== undefined) {
      ctx.rotate(p.rotation);
    }
    
    // Draw 5-pointed star
    ctx.beginPath();
    const spikes = 5;
    const outerRadius = size;
    const innerRadius = size * 0.4;
    
    for (let i = 0; i < spikes * 2; i++) {
      const radius = i % 2 === 0 ? outerRadius : innerRadius;
      const angle = (i * Math.PI) / spikes;
      const px = Math.cos(angle) * radius;
      const py = Math.sin(angle) * radius;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  
  private renderGlow(ctx: CanvasRenderingContext2D, p: Particle): void {
    const pulse = p.pulsePhase !== undefined ? 0.7 + 0.3 * Math.sin(p.pulsePhase) : 1.0;
    const size = p.size * pulse;
    
    const rgb = this.hexToRgb(p.color);
    if (!rgb) return;
    
    const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, size);
    gradient.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.8)`);
    gradient.addColorStop(0.5, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.4)`);
    gradient.addColorStop(1, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0)`);
    
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
    ctx.fill();
  }
  
  private renderDebris(ctx: CanvasRenderingContext2D, p: Particle): void {
    ctx.fillStyle = p.color;
    ctx.save();
    ctx.translate(p.x, p.y);
    if (p.rotation !== undefined) {
      ctx.rotate(p.rotation);
    }
    
    // Draw irregular debris shape
    ctx.beginPath();
    ctx.moveTo(-p.size/2, -p.size/2);
    ctx.lineTo(p.size/2, -p.size/3);
    ctx.lineTo(p.size/3, p.size/2);
    ctx.lineTo(-p.size/3, p.size/3);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  
  private renderEnergy(ctx: CanvasRenderingContext2D, p: Particle): void {
    const rgb = this.hexToRgb(p.color);
    if (!rgb) return;
    
    // Draw crackling energy
    ctx.strokeStyle = p.color;
    ctx.lineWidth = 2;
    ctx.shadowBlur = 5;
    ctx.shadowColor = p.color;
    
    ctx.beginPath();
    ctx.moveTo(p.x - p.size, p.y);
    ctx.lineTo(p.x, p.y - p.size);
    ctx.lineTo(p.x + p.size, p.y);
    ctx.lineTo(p.x, p.y + p.size);
    ctx.closePath();
    ctx.stroke();
    
    ctx.shadowBlur = 0;
  }
  
  private renderBubble(ctx: CanvasRenderingContext2D, p: Particle): void {
    const rgb = this.hexToRgb(p.color);
    if (!rgb) return;
    
    // Draw bubble with highlight
    const gradient = ctx.createRadialGradient(
      p.x - p.size/4, p.y - p.size/4, 0,
      p.x, p.y, p.size
    );
    gradient.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.3)`);
    gradient.addColorStop(0.7, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.1)`);
    gradient.addColorStop(1, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0)`);
    
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
    
    // Add highlight
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.beginPath();
    ctx.arc(p.x - p.size/4, p.y - p.size/4, p.size/4, 0, Math.PI * 2);
    ctx.fill();
    
    // Add outline
    ctx.strokeStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.5)`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.stroke();
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
  
  getParticleCount(): number {
    return this.particles.length;
  }
  
  clear(): void {
    // Return all particles to pool
    for (const p of this.particles) {
      this.pool.release(p);
    }
    this.particles = [];
  }
  
  // Get particle count for debugging/monitoring
  getActiveParticleCount(): number {
    return this.particles.length;
  }
  
  // Limit particles per type to prevent accumulation
  private getMaxParticlesForType(type: ParticleType): number {
    // Trail particles should be limited more strictly
    if (type === 'trail') return 5;
    // Other types can have more
    return Math.floor(this.maxParticles * 0.3); // 30% of max per type
  }
}
