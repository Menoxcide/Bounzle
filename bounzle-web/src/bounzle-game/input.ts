// Input handling

export class InputHandler {
  private canvas: HTMLCanvasElement;
  private onTapCallback: () => void;
  private boundHandleClick: (e: MouseEvent) => void;
  private boundHandleTouchStart: (e: TouchEvent) => void;
  private boundHandleTouchEnd: (e: TouchEvent) => void;
  private keydownHandler: (e: KeyboardEvent) => void;
  private lastTouchTime: number = 0;
  private touchHandled: boolean = false;
  
  constructor(canvas: HTMLCanvasElement, onTap: () => void) {
    this.canvas = canvas;
    this.onTapCallback = onTap;
    this.boundHandleClick = this.handleClick.bind(this);
    this.boundHandleTouchStart = this.handleTouchStart.bind(this);
    this.boundHandleTouchEnd = this.handleTouchEnd.bind(this);
    this.keydownHandler = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        this.onTapCallback();
      }
    };
    this.init();
  }
  
  private init(): void {
    // Listen for mouse clicks (desktop)
    this.canvas.addEventListener('click', this.boundHandleClick);
    
    // Listen for touch events (mobile)
    // Use touchstart and touchend to handle taps properly
    this.canvas.addEventListener('touchstart', this.boundHandleTouchStart, { passive: false });
    this.canvas.addEventListener('touchend', this.boundHandleTouchEnd, { passive: false });
    
    // Also listen for spacebar and enter keys
    window.addEventListener('keydown', this.keydownHandler);
  }
  
  private handleClick(e: MouseEvent): void {
    // Prevent click event from firing after touch events on mobile
    // If a touch event happened recently (within 300ms), ignore the click
    const timeSinceTouch = Date.now() - this.lastTouchTime;
    if (timeSinceTouch < 300) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    
    e.preventDefault();
    this.onTapCallback();
  }
  
  private handleTouchStart(e: TouchEvent): void {
    // Prevent default to avoid scrolling and other browser behaviors
    e.preventDefault();
    this.touchHandled = false;
  }
  
  private handleTouchEnd(e: TouchEvent): void {
    // Prevent default to avoid click event from firing
    e.preventDefault();
    
    // Only trigger tap if touchstart was on the canvas and we haven't handled it yet
    if (!this.touchHandled && e.changedTouches.length > 0) {
      this.lastTouchTime = Date.now();
      this.touchHandled = true;
      this.onTapCallback();
    }
  }
  
  destroy(): void {
    this.canvas.removeEventListener('click', this.boundHandleClick);
    this.canvas.removeEventListener('touchstart', this.boundHandleTouchStart);
    this.canvas.removeEventListener('touchend', this.boundHandleTouchEnd);
    window.removeEventListener('keydown', this.keydownHandler);
  }
}