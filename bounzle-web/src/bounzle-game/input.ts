// Input handling

export class InputHandler {
  private canvas: HTMLCanvasElement;
  private onTapCallback: () => void;
  
  constructor(canvas: HTMLCanvasElement, onTap: () => void) {
    this.canvas = canvas;
    this.onTapCallback = onTap;
    this.init();
  }
  
  private init(): void {
    this.canvas.addEventListener('click', this.handleTap.bind(this));
    this.canvas.addEventListener('touchstart', this.handleTap.bind(this));
    
    // Also listen for spacebar and enter keys
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        this.onTapCallback();
      }
    });
  }
  
  private handleTap(e: Event): void {
    e.preventDefault();
    this.onTapCallback();
  }
  
  destroy(): void {
    this.canvas.removeEventListener('click', this.handleTap.bind(this));
    this.canvas.removeEventListener('touchstart', this.handleTap.bind(this));
  }
}