// Hybrid storage layer for game checkpoints (localStorage + Supabase)

import { GameStateSnapshot } from '@/bounzle-game/types';
import { validateGameState } from './gameState';
import { supabase } from './supabase/client';

const STORAGE_KEY_PREFIX = 'bounzle_checkpoint_';
const MAX_LOCAL_CHECKPOINTS = 10;
const CHECKPOINT_EXPIRY_MS = 30 * 1000;

function generateCheckpointId(): string {
  return `checkpoint_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function getLocalStorageKey(userId: string | null, sessionId: string): string {
  const userPrefix = userId || 'guest';
  return `${STORAGE_KEY_PREFIX}${userPrefix}_${sessionId}`;
}

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
    
    checkpoints.push(snapshot);
    
    if (checkpoints.length > MAX_LOCAL_CHECKPOINTS) {
      checkpoints = checkpoints.slice(-MAX_LOCAL_CHECKPOINTS);
    }
    
    const now = Date.now();
    checkpoints = checkpoints.filter(
      cp => (now - cp.timestamp) < CHECKPOINT_EXPIRY_MS
    );
    
    localStorage.setItem(key, JSON.stringify(checkpoints));
  } catch (error) {
    console.error('Failed to save checkpoint to localStorage:', error);
  }
}

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
    
    const now = Date.now();
    const validCheckpoints = checkpoints.filter(
      cp => validateGameState(cp) && (now - cp.timestamp) < CHECKPOINT_EXPIRY_MS
    );
    
    return validCheckpoints.sort((a, b) => a.timestamp - b.timestamp);
  } catch (error) {
    console.error('Failed to load checkpoints from localStorage:', error);
    return [];
  }
}

async function saveToSupabase(
  userId: string | null,
  sessionId: string,
  snapshot: GameStateSnapshot
): Promise<void> {
  if (!userId) {
    return;
  }
  
  try {
    const checkpointData = {
      ball: snapshot.ball,
      obstacles: snapshot.obstacles,
      powerUps: snapshot.powerUps || [],
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
    }
  } catch (error) {
    console.error('Error saving checkpoint to Supabase:', error);
  }
}

async function loadFromSupabase(
  userId: string | null,
  sessionId: string
): Promise<GameStateSnapshot[]> {
  if (!userId) {
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
    
    const checkpoints: GameStateSnapshot[] = [];
    const now = Date.now();
    
    for (const row of data) {
      const snapshot = row.checkpoint_data as GameStateSnapshot;
      snapshot.timestamp = new Date(row.timestamp).getTime();
      
      if (validateGameState(snapshot) && (now - snapshot.timestamp) < CHECKPOINT_EXPIRY_MS) {
        checkpoints.push(snapshot);
      }
    }
    
    return checkpoints;
  } catch (error) {
    console.error('Error loading checkpoints from Supabase:', error);
    return [];
  }
}

export async function saveCheckpoint(
  userId: string | null,
  sessionId: string,
  snapshot: GameStateSnapshot
): Promise<void> {
  if (!snapshot.checkpointId) {
    snapshot.checkpointId = generateCheckpointId();
  }
  
  if (!snapshot.timestamp) {
    snapshot.timestamp = Date.now();
  }
  
  if (!validateGameState(snapshot)) {
    throw new Error('Invalid game state snapshot');
  }
  
  saveToLocalStorage(userId, sessionId, snapshot);
  await saveToSupabase(userId, sessionId, snapshot);
}

export async function loadCheckpoints(
  userId: string | null,
  sessionId: string
): Promise<GameStateSnapshot[]> {
  let checkpoints = await loadFromSupabase(userId, sessionId);
  
  if (checkpoints.length === 0) {
    checkpoints = loadFromLocalStorage(userId, sessionId);
  } else {
    const localCheckpoints = loadFromLocalStorage(userId, sessionId);
    const merged = [...checkpoints, ...localCheckpoints];
    
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

export function findCheckpointBefore(
  checkpoints: GameStateSnapshot[],
  targetTimestamp: number,
  secondsBefore: number = 2
): GameStateSnapshot | null {
  const targetTime = targetTimestamp - (secondsBefore * 1000);
  
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
  
  if (!bestCheckpoint && checkpoints.length > 0) {
    bestCheckpoint = checkpoints[0];
  }
  
  return bestCheckpoint;
}

export async function clearCheckpoints(
  userId: string | null,
  sessionId: string
): Promise<void> {
  try {
    const key = getLocalStorageKey(userId, sessionId);
    localStorage.removeItem(key);
  } catch (error) {
    console.error('Failed to clear localStorage checkpoints:', error);
  }
  
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

