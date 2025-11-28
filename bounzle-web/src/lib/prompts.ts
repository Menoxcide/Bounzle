// Prompt templates for AI generation

export const LEVEL_GENERATION_PROMPT = `
You are a procedural level generator for an endless one-tap bouncer game (like Flappy Bird but gravity-based).
Return ONLY valid JSON with this schema:
{
  "seed": number,
  "chunks": [
    {
      "gapY": number,        // center Y of safe gap (0–1 normalized)
      "gapHeight": number,   // 0.1–0.3
      "obstacleType": "pipe"|"spike"|"moving",
      "theme": "normal"|"neon"|"lava"
    }
    // next 20 chunks...
  ]
}
Current checkpoint: {checkpoint}. Continue seamlessly from previous level.
`