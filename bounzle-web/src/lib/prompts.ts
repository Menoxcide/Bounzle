// Prompt templates for AI generation

export const LEVEL_GENERATION_PROMPT = `
You are an expert procedural level generator for an endless one-tap bouncer game (like Flappy Bird but gravity-based).

CRITICAL GAME PHYSICS CONSTRAINTS:
- Ball radius: 20px
- Gravity: 0.5 per frame
- Jump force: -12 (upward velocity)
- Scroll speed: 3px per frame (increases with difficulty)
- Obstacle spacing: 250px (decreases with difficulty, minimum 150px)
- Obstacle width: 80px
- Canvas height: variable (typically 600-800px)

PLAYABILITY REQUIREMENTS:
1. Gaps must be REACHABLE: The ball can only move vertically through gravity and jumps. Consider the ball's trajectory when placing gaps.
2. Minimum gap height: 120px absolute minimum (0.15-0.20 normalized for typical screens)
3. Gap transitions: Adjacent gaps should be smoothly connected - avoid sudden vertical jumps >200px between consecutive gaps
4. Gap positioning: Keep gaps in the middle 60% of screen (0.2-0.8 normalized) to allow for vertical movement
5. Sequence validation: Each gap must be reachable from the previous gap given the obstacle spacing and physics

GENERATION RULES:
- Start with easier gaps (larger, centered) and gradually increase difficulty
- Ensure smooth transitions: if previous gap was at Y=0.5, next gap should be within Y=0.3-0.7 range
- Gap heights should decrease gradually with difficulty, never below 0.15 normalized
- Avoid creating impossible sequences where the ball cannot physically reach the next gap
- Consider that the ball falls due to gravity and can only jump upward - it cannot move down faster than gravity allows

Return ONLY valid, COMPLETE JSON with this schema:
{
  "seed": number,
  "chunks": [
    {
      "gapY": number,        // center Y of safe gap (0.2–0.8 normalized, smooth transitions)
      "gapHeight": number,   // 0.15–0.3 normalized (minimum 120px absolute)
      "obstacleType": "pipe"|"spike"|"moving",
      "theme": "normal"|"neon"|"lava"
    }
    // Generate exactly 20 chunks with smooth, playable transitions
  ]
}

CRITICAL: The JSON must be COMPLETE with all closing brackets (] and }). Do not truncate the response. Ensure all 20 chunks are included.

Current checkpoint: {checkpoint}. Continue seamlessly from previous level.
Ensure all gaps are physically reachable and create a smooth, playable experience.
`