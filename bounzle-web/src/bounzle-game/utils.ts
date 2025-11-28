// Utility functions

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function randomRange(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

export function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.sqrt(Math.pow(b.x - a.x, 2) + Math.pow(b.y - a.y, 2));
}

export function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * t;
}

export function degToRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}

export function radToDeg(radians: number): number {
  return radians * (180 / Math.PI);
}