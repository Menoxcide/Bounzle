<!-- 1762ba81-b941-43f8-9546-a628a179aa40 3c01e5ca-76c9-47a3-809f-a7bd6e33578f -->
# Enhance Power Ups and Add Random Events

## Overview

Make the game more fun by adding new power-ups, random events, expanded colors, and increasing extra time from 3 to 10 seconds.

## Changes

### 1. Update Extra Time Power-Up Duration

**File**: `bounzle-web/src/bounzle-game/Game.ts`

- Change `life` power-up extra time from 3 seconds to 10 seconds (line ~880)
- Update constant or make it configurable if needed

**Location**: `collectPowerUp()` method, `case 'life':` block

### 2. Add New Power-Up Types

**Files**:

- `bounzle-web/src/bounzle-game/types.ts`
- `bounzle-web/src/bounzle-game/config.ts`
- `bounzle-web/src/bounzle-game/Game.ts`
- `bounzle-web/src/bounzle-game/renderer.ts`

**New Power-Up Types**:

- `speedboost` - Temporarily increases ball speed (2x for 5 seconds)
- `shield` - Grants one collision immunity (visual shield effect)
- `magnet` - Attracts nearby power-ups (10 second duration, 100px radius)
- `doublescore` - Doubles score gain for 10 seconds
- `gravityflip` - Reverses gravity temporarily (5 seconds)

**Implementation Steps**:

1. Update `PowerUpType` in `types.ts` to include new types
2. Add probabilities for new types in `config.ts` power-up configs
3. Implement collection logic in `Game.ts` `collectPowerUp()` method
4. Add rendering logic in `renderer.ts` `drawPowerUp()` method
5. Add state tracking for active effects (shield count, magnet active, etc.)
6. Update `GameStateSnapshot` to include new power-up states

### 3. Expand Color Palettes

**File**: `bounzle-web/src/bounzle-game/config.ts`

- Add more vibrant colors to each difficulty level's `colorPalette` arrays
- Include neon colors, gradients, and more variety
- Add colors like: cyan, magenta, lime, gold, electric blue, hot pink, etc.

**Location**: `CONFIG_BREAKPOINTS` object, each level's `walls.colorPalette` array

### 4. Implement Random Events System

**Files**:

- `bounzle-web/src/bounzle-game/types.ts`
- `bounzle-web/src/bounzle-game/Game.ts`
- `bounzle-web/src/bounzle-game/renderer.ts`

**Random Event Types**:

- `colorShift` - Temporary color palette change (5 seconds)
- `bonusZone` - Area with 2x score multiplier (visual indicator)
- `speedZone` - Temporary speed increase (3 seconds)
- `slowZone` - Temporary speed decrease (3 seconds)
- `rainbowMode` - Colorful effects and particles (5 seconds)

**Implementation Steps**:

1. Create `RandomEvent` type in `types.ts` with event type and duration
2. Add `activeEvents: RandomEvent[]` to game state
3. Implement event spawning logic (triggered by score milestones or time intervals)
4. Add event effects to game update loop
5. Add visual indicators in renderer (screen effects, UI overlays)
6. Update `GameStateSnapshot` to include active events

### 5. Power-Up Visual Enhancements

**File**: `bounzle-web/src/bounzle-game/renderer.ts`

- Add unique visual shapes/icons for each new power-up type
- Enhance particle effects for each power-up collection
- Add visual feedback for active power-up effects (shield bubble, magnet field, etc.)

**Location**: `drawPowerUp()` method and power-up collection effects

## Files to Modify

1. `bounzle-web/src/bounzle-game/types.ts` - Add new power-up types and random event types
2. `bounzle-web/src/bounzle-game/config.ts` - Update extra time duration, add new power-up probabilities, expand color palettes
3. `bounzle-web/src/bounzle-game/Game.ts` - Implement new power-up effects, random event system, state tracking
4. `bounzle-web/src/bounzle-game/renderer.ts` - Add rendering for new power-ups and visual effects for events

## Implementation Details

### Power-Up Effects Implementation

- **Speed Boost**: Multiply `ball.velocity` by 2.0, track duration, reset on expiry
- **Shield**: Add `shieldCount: number` property, decrement on collision instead of game over
- **Magnet**: Check distance to all power-ups, move them toward ball if within radius
- **Double Score**: Add `scoreMultiplier: number` property, multiply score gains by 2
- **Gravity Flip**: Negate `gravityScale` temporarily, restore on expiry

### Random Events Implementation

- Trigger events based on score milestones (every 50 points) or time intervals (every 30 seconds)
- Events have duration and visual effects
- Multiple events can be active simultaneously
- Events affect gameplay mechanics (speed, scoring, visuals)

### Color Palette Expansion

- Add 5-10 new colors per difficulty level
- Include vibrant, neon, and gradient-friendly colors
- Ensure good contrast for visibility

## Testing Considerations

- Verify all new power-ups spawn and collect correctly
- Test power-up effects don't conflict with each other
- Ensure random events trigger appropriately
- Verify color palettes render correctly
- Test that extra time power-up gives 10 seconds
- Ensure game state saves/restores with new power-up states

### To-dos

- [ ] Add score increment when traversing through horizontal gaps
- [ ] Add score increment when traversing through vertical gaps
- [ ] Ensure seamless horizontal/vertical wall intersections
- [ ] Add more variety in wall widths and colors