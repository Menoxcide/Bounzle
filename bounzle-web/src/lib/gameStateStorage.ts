// Hybrid storage layer for game checkpoints (localStorage + Supabase)

import { GameStateSnapshot } from '@/bounzle-game/types';
import { validateGameState } from './gameState';
import { supabase } from './supabase/client';

const STORAGE_KEY_PREFIX = 'bounzle_checkpoint_';
const MAX_LOCAL_CHECKPOINTS = 10; // Keep last 10 checkpoints in localStorage
const CHECKPOINT_EXPIRY_MS = 30 * 1000; // 30 seconds max age

/**
 * Generate a unique checkpoint ID
 */
function generateCheckpointId(): string {
  return `checkpoint_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Get localStorage key for checkpoints
 */
function getLocalStorageKey(userId: string | null, sessionId: string): string {
  const userPrefix = userId || 'guest';
  return `${STORAGE_KEY_PREFIX}${userPrefix}_${sessionId}`;
}

/**
 * Save checkpoint to localStorage
 */
function saveToLocalStorage(
  userId: string | null,
  sessionId: string,
  snapshot: GameStateSnapshot
): void {
  try {
    const key = getLocalStorageKey(userId, sessionId);
    const existing = localStorage.getItem(key);
    let checkpoints: GameStateSnapshot[] = [];
    
    if (existing) {
      try {
        checkpoints = JSON.parse(existing);
        if (!Array.isArray(checkpoints)) {
          checkpoints = [];
        }
      } catch {
        checkpoints = [];
      }
    }
    
    // Add new checkpoint
    checkpoints.push(snapshot);
    
    // Keep only the most recent checkpoints
    if (checkpoints.length > MAX_LOCAL_CHECKPOINTS) {
      checkpoints = checkpoints.slice(-MAX_LOCAL_CHECKPOINTS);
    }
    
    // Remove expired checkpoints
    const now = Date.now();
    checkpoints = checkpoints.filter(
      cp => (now - cp.timestamp) < CHECKPOINT_EXPIRY_MS
    );
    
    localStorage.setItem(key, JSON.stringify(checkpoints));
  } catch (error) {
    console.error('Failed to save checkpoint to localStorage:', error);
    // Don't throw - localStorage might be unavailable
  }
}

/**
 * Load checkpoints from localStorage
 */
function loadFromLocalStorage(
  userId: string | null,
  sessionId: string
): GameStateSnapshot[] {
  try {
    const key = getLocalStorageKey(userId, sessionId);
    const data = localStorage.getItem(key);
    
    if (!data) {
      return [];
    }
    
    const checkpoints = JSON.parse(data);
    if (!Array.isArray(checkpoints)) {
      return [];
    }
    
    // Filter out expired checkpoints and sort by timestamp (newest last for consistency)
    const now = Date.now();
    const validCheckpoints = checkpoints.filter(
      cp => validateGameState(cp) && (now - cp.timestamp) < CHECKPOINT_EXPIRY_MS
    );
    
    // Sort by timestamp ascending (oldest first, newest last)
    return validCheckpoints.sort((a, b) => a.timestamp - b.timestamp);
  } catch (error) {
    console.error('Failed to load checkpoints from localStorage:', error);
    return [];
  }
}

/**
 * Save checkpoint to Supabase
 */
async function saveToSupabase(
  userId: string | null,
  sessionId: string,
  snapshot: GameStateSnapshot
): Promise<void> {
  if (!userId) {
    // Skip Supabase for guest users
    return;
  }
  
  try {
    // Supabase expects JSON object directly, not string
    // Include ALL fields from GameStateSnapshot to ensure complete restoration
    const checkpointData = {
      ball: snapshot.ball,
      obstacles: snapshot.obstacles,
      powerUps: snapshot.powerUps || [], // Include standalone power-ups
      score: snapshot.score,
      difficulty: snapshot.difficulty,
      currentTheme: snapshot.currentTheme,
      levelChunks: snapshot.levelChunks,
      currentChunkIndex: snapshot.currentChunkIndex,
      consumedChunkCount: snapshot.consumedChunkCount,
      lastObstacleX: snapshot.lastObstacleX,
      lastGapY: snapshot.lastGapY,
      timestamp: snapshot.timestamp,
      checkpointId: snapshot.checkpointId,
      slowMotionActive: snapshot.slowMotionActive || false,
      slowMotionEndTime: snapshot.slowMotionEndTime || 0
    };
    
    const { error } = await supabase
      .from('game_checkpoints')
      .insert({
        user_id: userId,
        session_id: sessionId,
        checkpoint_data: checkpointData,
        timestamp: new Date(snapshot.timestamp).toISOString(),
      });
    
    if (error) {
      console.error('Failed to save checkpoint to Supabase:', error);
      // Don't throw - fallback to localStorage only
    }
  } catch (error) {
    console.error('Error saving checkpoint to Supabase:', error);
    // Don't throw - fallback to localStorage only
  }
}

/**
 * Load checkpoints from Supabase
 */
async function loadFromSupabase(
  userId: string | null,
  sessionId: string
): Promise<GameStateSnapshot[]> {
  if (!userId) {
    // Skip Supabase for guest users
    return [];
  }
  
  try {
    const { data, error } = await supabase
      .from('game_checkpoints')
      .select('checkpoint_data, timestamp')
      .eq('user_id', userId)
      .eq('session_id', sessionId)
      .order('timestamp', { ascending: false })
      .limit(MAX_LOCAL_CHECKPOINTS);
    
    if (error) {
      console.error('Failed to load checkpoints from Supabase:', error);
      return [];
    }
    
    if (!data) {
      return [];
    }
    
    // Convert Supabase data to GameStateSnapshot
    const checkpoints: GameStateSnapshot[] = [];
    const now = Date.now();
    
    for (const row of data) {
      try {
        const snapshot = row.checkpoint_data as GameStateSnapshot;
        snapshot.timestamp = new Date(row.timestamp).getTime();
        
        // Validate and filter expired
        if (validateGameState(snapshot) && (now - snapshot.timestamp) < CHECKPOINT_EXPIRY_MS) {
          checkpoints.push(snapshot);
        }
      } catch (error) {
        console.error('Failed to parse checkpoint from Supabase:', error);
      }
    }
    
    return checkpoints;
  } catch (error) {
    console.error('Error loading checkpoints from Supabase:', error);
    return [];
  }
}

/**
 * Save checkpoint (hybrid: localStorage + Supabase)
 */
export async function saveCheckpoint(
  userId: string | null,
  sessionId: string,
  snapshot: GameStateSnapshot
): Promise<void> {
  // Add checkpoint ID if not present
  if (!snapshot.checkpointId) {
    snapshot.checkpointId = generateCheckpointId();
  }
  
  // Ensure timestamp is set
  if (!snapshot.timestamp) {
    snapshot.timestamp = Date.now();
  }
  
  // Validate before saving
  if (!validateGameState(snapshot)) {
    throw new Error('Invalid game state snapshot');
  }
  
  // Save to localStorage (immediate, always)
  saveToLocalStorage(userId, sessionId, snapshot);
  
  // Save to Supabase (async, for logged-in users)
  await saveToSupabase(userId, sessionId, snapshot);
}

/**
 * Load latest checkpoints (hybrid: try Supabase first, fallback to localStorage)
 */
export async function loadCheckpoints(
  userId: string | null,
  sessionId: string
): Promise<GameStateSnapshot[]> {
  // Try Supabase first (for logged-in users)
  let checkpoints = await loadFromSupabase(userId, sessionId);
  
  // If no Supabase checkpoints or guest user, try localStorage
  if (checkpoints.length === 0) {
    checkpoints = loadFromLocalStorage(userId, sessionId);
  } else {
    // Merge with localStorage (in case Supabase is missing some)
    const localCheckpoints = loadFromLocalStorage(userId, sessionId);
    const merged = [...checkpoints, ...localCheckpoints];
    
    // Sort by timestamp and remove duplicates
    const unique = new Map<string, GameStateSnapshot>();
    merged.forEach(cp => {
      if (!unique.has(cp.checkpointId) || unique.get(cp.checkpointId)!.timestamp < cp.timestamp) {
        unique.set(cp.checkpointId, cp);
      }
    });
    
    checkpoints = Array.from(unique.values())
      .sort((a, b) => a.timestamp - b.timestamp);
  }
  
  return checkpoints;
}

/**
 * Find checkpoint from approximately N seconds before a given timestamp
 */
export function findCheckpointBefore(
  checkpoints: GameStateSnapshot[],
  targetTimestamp: number,
  secondsBefore: number = 2
): GameStateSnapshot | null {
  const targetTime = targetTimestamp - (secondsBefore * 1000);
  
  // Find the checkpoint closest to (but before) the target time
  let bestCheckpoint: GameStateSnapshot | null = null;
  let bestDiff = Infinity;
  
  for (const checkpoint of checkpoints) {
    if (checkpoint.timestamp <= targetTime) {
      const diff = targetTime - checkpoint.timestamp;
      if (diff < bestDiff) {
        bestDiff = diff;
        bestCheckpoint = checkpoint;
      }
    }
  }
  
  // If no checkpoint before target time, use the oldest available
  if (!bestCheckpoint && checkpoints.length > 0) {
    bestCheckpoint = checkpoints[0];
  }
  
  return bestCheckpoint;
}

/**
 * Clear all checkpoints for a session
 */
export async function clearCheckpoints(
  userId: string | null,
  sessionId: string
): Promise<void> {
  // Clear localStorage
  try {
    const key = getLocalStorageKey(userId, sessionId);
    localStorage.removeItem(key);
  } catch (error) {
    console.error('Failed to clear localStorage checkpoints:', error);
  }
  
  // Clear Supabase (for logged-in users)
  if (userId) {
    try {
      const { error } = await supabase
        .from('game_checkpoints')
        .delete()
        .eq('user_id', userId)
        .eq('session_id', sessionId);
      
      if (error) {
        console.error('Failed to clear Supabase checkpoints:', error);
      }
    } catch (error) {
      console.error('Error clearing Supabase checkpoints:', error);
    }
  }
}

