// Input handling

export class InputHandler {
  private canvas: HTMLCanvasElement;
  private onTapCallback: () => void;
  private boundHandleTap: (e: Event) => void;
  private keydownHandler: (e: KeyboardEvent) => void;
  
  constructor(canvas: HTMLCanvasElement, onTap: () => void) {
    this.canvas = canvas;
    this.onTapCallback = onTap;
    this.boundHandleTap = this.handleTap.bind(this);
    this.keydownHandler = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        this.onTapCallback();
      }
    };
    this.init();
  }
  
  private init(): void {
    this.canvas.addEventListener('click', this.boundHandleTap);
    this.canvas.addEventListener('touchstart', this.boundHandleTap);
    
    // Also listen for spacebar and enter keys
    window.addEventListener('keydown', this.keydownHandler);
  }
  
  private handleTap(e: Event): void {
    e.preventDefault();
    this.onTapCallback();
  }
  
  destroy(): void {
    this.canvas.removeEventListener('click', this.boundHandleTap);
    this.canvas.removeEventListener('touchstart', this.boundHandleTap);
    window.removeEventListener('keydown', this.keydownHandler);
  }
}