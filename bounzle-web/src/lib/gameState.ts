// Game state serialization utilities

import { GameStateSnapshot } from '@/bounzle-game/types';

/**
 * Serialize game state snapshot to JSON string
 */
export function serializeGameState(snapshot: GameStateSnapshot): string {
  try {
    return JSON.stringify(snapshot);
  } catch (error) {
    console.error('Failed to serialize game state:', error);
    throw new Error('Failed to serialize game state');
  }
}

/**
 * Deserialize game state snapshot from JSON string
 */
export function deserializeGameState(data: string): GameStateSnapshot {
  try {
    const parsed = JSON.parse(data) as GameStateSnapshot;
    
    // Validate required fields
    if (!parsed.ball || !parsed.obstacles || typeof parsed.score !== 'number') {
      throw new Error('Invalid game state data');
    }
    
    // Ensure arrays are properly initialized
    if (!Array.isArray(parsed.obstacles)) {
      parsed.obstacles = [];
    }
    if (!Array.isArray(parsed.levelChunks)) {
      parsed.levelChunks = [];
    }
    
    return parsed;
  } catch (error) {
    console.error('Failed to deserialize game state:', error);
    throw new Error('Failed to deserialize game state');
  }
}

/**
 * Validate game state snapshot
 */
export function validateGameState(snapshot: GameStateSnapshot): boolean {
  try {
    // Check required fields
    if (!snapshot.ball || !snapshot.ball.position || !snapshot.ball.velocity) {
      return false;
    }
    
    if (typeof snapshot.score !== 'number' || snapshot.score < 0) {
      return false;
    }
    
    if (typeof snapshot.difficulty !== 'number' || snapshot.difficulty < 1) {
      return false;
    }
    
    if (!Array.isArray(snapshot.obstacles)) {
      return false;
    }
    
    if (!Array.isArray(snapshot.levelChunks)) {
      return false;
    }
    
    if (typeof snapshot.timestamp !== 'number' || snapshot.timestamp <= 0) {
      return false;
    }
    
    return true;
  } catch {
    return false;
  }
}

