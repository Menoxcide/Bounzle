// API route for AI level generation
import { groq } from '@/lib/groq'
import { LEVEL_GENERATION_PROMPT } from '@/lib/prompts'
import { validateLevelData, validateAndFixChunk } from '@/lib/levelValidator'
import { NextResponse } from 'next/server'
import { LevelData, LevelChunk } from '@/bounzle-game/types'

// Rate limiting store (in production, use Redis or database)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>()

// Check rate limit for an IP
function checkRateLimit(ip: string): { allowed: boolean; resetTime?: number } {
  const now = Date.now()
  const windowMs = 60 * 1000 // 1 minute
  const maxRequests = 5

  const record = rateLimitStore.get(ip)

  // If no record or record expired, reset
  if (!record || record.resetTime < now) {
    rateLimitStore.set(ip, { count: 1, resetTime: now + windowMs })
    return { allowed: true }
  }

  // If under limit, increment
  if (record.count < maxRequests) {
    rateLimitStore.set(ip, { count: record.count + 1, resetTime: record.resetTime })
    return { allowed: true }
  }

  // Rate limited
  return { allowed: false, resetTime: record.resetTime }
}

// Generate a safe, playable level chunk
function generateSafeChunk(previousGapY: number, canvasHeight: number = 600): LevelChunk {
  // Start from previous gap position
  let gapY = previousGapY
  
  // Add small random variation (max 20% change)
  const variation = (Math.random() - 0.5) * 0.2
  gapY = Math.max(0.2, Math.min(0.8, gapY + variation))
  
  // Ensure smooth transition
  const maxChange = 0.25
  if (gapY > previousGapY + maxChange) {
    gapY = previousGapY + maxChange
  } else if (gapY < previousGapY - maxChange) {
    gapY = previousGapY - maxChange
  }
  
  // Generate safe gap height (0.15-0.25 normalized)
  const gapHeight = Math.random() * 0.1 + 0.15
  
  return {
    gapY,
    gapHeight,
    obstacleType: ['pipe', 'spike', 'moving'][Math.floor(Math.random() * 3)] as 'pipe' | 'spike' | 'moving',
    theme: ['normal', 'neon', 'lava'][Math.floor(Math.random() * 3)] as 'normal' | 'neon' | 'lava'
  }
}

export async function POST(request: Request) {
  try {
    // Get client IP (simplified for development)
    const ip = request.headers.get('x-forwarded-for') || '127.0.0.1'
    
    // Check rate limit
    const rateLimit = checkRateLimit(ip)
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Try again later.' },
        { status: 429 }
      )
    }

    const body = await request.json()
    const { seed, checkpoint, previousGapY, canvasHeight } = body

    // Validate input
    if (typeof seed !== 'number' || typeof checkpoint !== 'number') {
      return NextResponse.json(
        { error: 'Invalid input. Seed and checkpoint must be numbers.' },
        { status: 400 }
      )
    }

    const safeCanvasHeight = canvasHeight || 600
    const startGapY = previousGapY ?? 0.5

    // Format the prompt with checkpoint and previous gap info
    let prompt = LEVEL_GENERATION_PROMPT.replace('{checkpoint}', checkpoint.toString())
    if (previousGapY !== undefined) {
      prompt += `\n\nPrevious gap center Y position: ${previousGapY.toFixed(2)} (normalized 0-1). Ensure smooth transition from this position.`
    }

    let levelData: LevelData
    let validationAttempts = 0
    const maxAttempts = 3

    // Try to generate a valid level (with retries)
    while (validationAttempts < maxAttempts) {
      try {
        const res = await groq.chat.completions.create({
          model: "llama-3.1-70b-versatile",
          messages: [{ role: "user", content: prompt + ` Seed: ${seed + validationAttempts}` }],
          temperature: 0.9,
          max_tokens: 800,
        })

        // Parse the response
        const content = res.choices[0]?.message?.content
        if (!content) {
          throw new Error('No content in response')
        }

        // Try to parse as JSON
        try {
          levelData = JSON.parse(content)
        } catch (parseError) {
          // If parsing fails, generate safe fallback
          console.warn('Failed to parse AI response, generating safe fallback:', parseError)
          levelData = {
            seed: seed,
            chunks: []
          }
          
          // Generate safe chunks
          let currentGapY = startGapY
          for (let i = 0; i < 20; i++) {
            const chunk = generateSafeChunk(currentGapY, safeCanvasHeight)
            levelData.chunks.push(chunk)
            currentGapY = chunk.gapY
          }
        }

        // Validate the level data
        const validation = validateLevelData(levelData, safeCanvasHeight, startGapY)
        
        if (validation.valid || validation.fixedChunks) {
          // Use fixed chunks if available, otherwise use original
          if (validation.fixedChunks) {
            levelData.chunks = validation.fixedChunks
            console.log(`Level validated and fixed: ${validation.issues.length} issues resolved`)
          }
          
          // Final validation: ensure all chunks are individually valid
          let currentGapY = startGapY
          const finalChunks: LevelChunk[] = []
          
          for (const chunk of levelData.chunks) {
            const fixed = validateAndFixChunk(chunk, currentGapY, safeCanvasHeight)
            finalChunks.push(fixed)
            currentGapY = fixed.gapY
          }
          
          levelData.chunks = finalChunks
          break // Success!
        } else {
          // Validation failed, try again
          validationAttempts++
          console.warn(`Level validation failed (attempt ${validationAttempts}/${maxAttempts}):`, validation.issues)
          
          if (validationAttempts >= maxAttempts) {
            // Generate completely safe fallback
            console.warn('Max validation attempts reached, generating safe fallback')
            levelData = {
              seed: seed,
              chunks: []
            }
            
            let currentGapY = startGapY
            for (let i = 0; i < 20; i++) {
              const chunk = generateSafeChunk(currentGapY, safeCanvasHeight)
              levelData.chunks.push(chunk)
              currentGapY = chunk.gapY
            }
          }
        }
      } catch (error) {
        validationAttempts++
        console.error(`Level generation error (attempt ${validationAttempts}):`, error)
        
        if (validationAttempts >= maxAttempts) {
          // Generate safe fallback
          levelData = {
            seed: seed,
            chunks: []
          }
          
          let currentGapY = startGapY
          for (let i = 0; i < 20; i++) {
            const chunk = generateSafeChunk(currentGapY, safeCanvasHeight)
            levelData.chunks.push(chunk)
            currentGapY = chunk.gapY
          }
        }
      }
    }

    return NextResponse.json(levelData)
  } catch (error) {
    console.error('Level generation error:', error)
    
    // Return safe fallback data
    // Try to get request body if available, otherwise use defaults
    let previousGapY = 0.5
    let canvasHeight = 600
    
    try {
      const body = await request.json()
      previousGapY = body.previousGapY ?? 0.5
      canvasHeight = body.canvasHeight ?? 600
    } catch {
      // Request body already consumed or invalid, use defaults
    }
    
    const safeCanvasHeight = canvasHeight
    const startGapY = previousGapY
    
    const safeData: LevelData = {
      seed: Math.floor(Math.random() * 10000),
      chunks: []
    }
    
    let currentGapY = startGapY
    for (let i = 0; i < 20; i++) {
      const chunk = generateSafeChunk(currentGapY, safeCanvasHeight)
      safeData.chunks.push(chunk)
      currentGapY = chunk.gapY
    }
    
    return NextResponse.json(safeData)
  }
}