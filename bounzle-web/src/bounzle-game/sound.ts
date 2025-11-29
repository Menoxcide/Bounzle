// Sound effects manager

export class SoundManager {
  private audioContext: AudioContext | null = null;
  private sounds: Map<string, AudioBuffer> = new Map();
  private isAudioEnabled: boolean = true;
  
  constructor() {
    // Try to create audio context
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      this.audioContext = new AudioContextClass();
    } catch {
      console.warn('Web Audio API is not supported in this browser');
    }
  }
  
  // Enable or disable audio
  setAudioEnabled(enabled: boolean): void {
    this.isAudioEnabled = enabled;
  }
  
  // Play a beep sound
  playBeep(frequency: number = 440, duration: number = 0.1): void {
    if (!this.isAudioEnabled || !this.audioContext) return;
    
    try {
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);
      
      oscillator.type = 'square';
      oscillator.frequency.value = frequency;
      
      gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);
      
      oscillator.start(this.audioContext.currentTime);
      oscillator.stop(this.audioContext.currentTime + duration);
    } catch (e) {
      console.warn('Failed to play beep sound:', e);
    }
  }
  
  // Play a pop sound
  playPop(): void {
    if (!this.isAudioEnabled || !this.audioContext) return;
    
    try {
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);
      
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(220, this.audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(880, this.audioContext.currentTime + 0.2);
      
      gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.2);
      
      oscillator.start(this.audioContext.currentTime);
      oscillator.stop(this.audioContext.currentTime + 0.2);
    } catch (e) {
      console.warn('Failed to play pop sound:', e);
    }
  }
  
  // Play a hit sound
  playHit(): void {
    if (!this.isAudioEnabled || !this.audioContext) return;
    
    try {
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);
      
      oscillator.type = 'sawtooth';
      oscillator.frequency.setValueAtTime(110, this.audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(55, this.audioContext.currentTime + 0.3);
      
      gainNode.gain.setValueAtTime(0.5, this.audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.3);
      
      oscillator.start(this.audioContext.currentTime);
      oscillator.stop(this.audioContext.currentTime + 0.3);
    } catch (e) {
      console.warn('Failed to play hit sound:', e);
    }
  }
  
  // Play a coin/point sound
  playCoin(): void {
    if (!this.isAudioEnabled || !this.audioContext) return;
    
    try {
      // Play multiple tones for a coin effect
      for (let i = 0; i < 3; i++) {
        setTimeout(() => {
          const oscillator = this.audioContext!.createOscillator();
          const gainNode = this.audioContext!.createGain();
          
          oscillator.connect(gainNode);
          gainNode.connect(this.audioContext!.destination);
          
          oscillator.type = 'triangle';
          oscillator.frequency.value = 440 + i * 220;
          
          gainNode.gain.setValueAtTime(0.2, this.audioContext!.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext!.currentTime + 0.1);
          
          oscillator.start(this.audioContext!.currentTime);
          oscillator.stop(this.audioContext!.currentTime + 0.1);
        }, i * 50);
      }
    } catch (e) {
      console.warn('Failed to play coin sound:', e);
    }
  }
}