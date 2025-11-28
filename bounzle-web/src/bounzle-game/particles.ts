// Particle system for visual effects

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

export class ParticleSystem {
  private particles: Particle[] = [];
  
  addParticle(x: number, y: number, color: string = '#ffffff'): void {
    const particle: Particle = {
      x,
      y,
      vx: (Math.random() - 0.5) * 4,
      vy: (Math.random() - 0.5) * 4,
      life: 1.0,
      maxLife: 1.0,
      color,
      size: Math.random() * 3 + 1
    };
    this.particles.push(particle);
  }
  
  addExplosion(x: number, y: number, color: string = '#ffffff', count: number = 10): void {
    for (let i = 0; i < count; i++) {
      this.addParticle(x, y, color);
    }
  }
  
  update(deltaTime: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      
      // Update position
      p.x += p.vx * deltaTime;
      p.y += p.vy * deltaTime;
      
      // Apply gravity
      p.vy += 0.1 * deltaTime;
      
      // Reduce life
      p.life -= 0.01 * deltaTime;
      
      // Remove dead particles
      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }
  
  render(ctx: CanvasRenderingContext2D): void {
    for (const p of this.particles) {
      ctx.save();
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
  
  getParticleCount(): number {
    return this.particles.length;
  }
  
  clear(): void {
    this.particles = [];
  }
}