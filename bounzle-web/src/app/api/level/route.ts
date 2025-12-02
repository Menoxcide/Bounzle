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

// Strip markdown code blocks from AI response
function stripMarkdownCodeBlocks(content: string): string {
  // Remove markdown code block markers (```json, ```, etc.)
  let cleaned = content.trim()
  
  // Remove opening code block (```json or ```)
  cleaned = cleaned.replace(/^```(?:json|javascript|js)?\s*\n?/i, '')
  
  // Remove closing code block (```)
  cleaned = cleaned.replace(/\n?```\s*$/i, '')
  
  // Handle case where content might be wrapped in multiple code blocks
  // Remove any remaining code block markers
  cleaned = cleaned.replace(/```.*?\n/g, '').replace(/\n```/g, '')
  
  return cleaned.trim()
}

// Clean and fix common JSON issues
function cleanJSON(jsonString: string): string {
  let cleaned = jsonString.trim()
  
  // Remove single-line comments (// ...)
  cleaned = cleaned.replace(/\/\/.*$/gm, '')
  
  // Remove multi-line comments (/* ... */)
  cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, '')
  
  // Remove trailing commas before } or ]
  cleaned = cleaned.replace(/,(\s*[}\]])/g, '$1')
  
  // Fix common typos like "stacleType" -> "obstacleType"
  cleaned = cleaned.replace(/"stacleType"/g, '"obstacleType"')
  
  // Fix missing commas between array elements
  // This pattern looks for }{ (missing comma) and replaces with },{
  cleaned = cleaned.replace(/}(\s*)\{/g, '},$1{')
  
  // Fix missing commas between object properties
  // This pattern looks for "property": value "property": value (missing comma)
  cleaned = cleaned.replace(/"(\w+)"\s*:\s*("[^"]*"|\d+\.?\d*|\w+)(\s*)"(\w+)"/g, '"$1": $2,$3"$4"')
  
  // Try to extract JSON object if it's embedded in text
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
  if (jsonMatch) {
    cleaned = jsonMatch[0]
  }
  
  return cleaned.trim()
}

// Try to extract valid chunks from incomplete/truncated JSON
function extractChunksFromIncompleteJSON(jsonString: string): LevelChunk[] | null {
  try {
    // Look for the chunks array pattern - find "chunks": followed by [
    const chunksMatch = jsonString.match(/"chunks"\s*:\s*\[([\s\S]*)/)
    if (!chunksMatch) {
      return null
    }
    
    const chunksContent = chunksMatch[1]
    const chunks: LevelChunk[] = []
    
    // Improved regex to match complete and partial chunk objects
    // Match: { "gapY": number, "gapHeight": number, "obstacleType": "string", "theme": "string" }
    // Handles incomplete objects (missing closing brace) and missing commas
    const chunkPattern = /\{\s*"gapY"\s*:\s*([0-9.]+)\s*(?:,\s*"gapHeight"\s*:\s*([0-9.]+))?\s*(?:,\s*"obstacleType"\s*:\s*"([^"]*)")?\s*(?:,\s*"theme"\s*:\s*"([^"]*)")?\s*\}?/g
    
    let match
    while ((match = chunkPattern.exec(chunksContent)) !== null) {
      const gapY = parseFloat(match[1])
      const gapHeight = match[2] ? parseFloat(match[2]) : 0.2
      const obstacleType = (match[3] || 'pipe').trim()
      const theme = (match[4] || 'normal').trim()
      
      // Validate and fix values
      if (!isNaN(gapY) && gapY >= 0 && gapY <= 1) {
        // Fix gapHeight if invalid
        let fixedGapHeight = gapHeight
        if (isNaN(fixedGapHeight) || fixedGapHeight <= 0 || fixedGapHeight > 1) {
          fixedGapHeight = 0.2
        }
        
        // Fix obstacleType if invalid or truncated
        let fixedObstacleType: 'pipe' | 'spike' | 'moving' = 'pipe'
        if (obstacleType) {
          // Handle truncated values (e.g., "p" instead of "pipe", "mov" instead of "moving")
          if (obstacleType.startsWith('pipe') || obstacleType === 'p') {
            fixedObstacleType = 'pipe'
          } else if (obstacleType.startsWith('spike') || obstacleType === 's' || obstacleType.startsWith('sp')) {
            fixedObstacleType = 'spike'
          } else if (obstacleType.startsWith('moving') || obstacleType === 'm' || obstacleType.startsWith('mov')) {
            fixedObstacleType = 'moving'
          } else if (['pipe', 'spike', 'moving'].includes(obstacleType)) {
            fixedObstacleType = obstacleType as 'pipe' | 'spike' | 'moving'
          }
        }
        
        // Fix theme if invalid or truncated
        let fixedTheme: 'normal' | 'neon' | 'lava' = 'normal'
        if (theme) {
          if (theme.startsWith('normal') || theme === 'n' || theme.startsWith('nor')) {
            fixedTheme = 'normal'
          } else if (theme.startsWith('neon') || theme === 'ne') {
            fixedTheme = 'neon'
          } else if (theme.startsWith('lava') || theme === 'l' || theme.startsWith('lav')) {
            fixedTheme = 'lava'
          } else if (['normal', 'neon', 'lava'].includes(theme)) {
            fixedTheme = theme as 'normal' | 'neon' | 'lava'
          }
        }
        
        chunks.push({
          gapY,
          gapHeight: fixedGapHeight,
          obstacleType: fixedObstacleType,
          theme: fixedTheme
        })
      }
    }
    
    return chunks.length > 0 ? chunks : null
  } catch (error) {
    console.error('Error extracting chunks from incomplete JSON:', error)
    return null
  }
}

// Generate a safe, playable level chunk
function generateSafeChunk(previousGapY: number): LevelChunk {
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

    // Initialize with safe fallback (will be overwritten if generation succeeds)
    let levelData: LevelData = {
      seed: seed,
      chunks: []
    }
    
    // Generate safe chunks as initial fallback
    let currentGapY = startGapY
    for (let i = 0; i < 20; i++) {
      const chunk = generateSafeChunk(currentGapY)
      levelData.chunks.push(chunk)
      currentGapY = chunk.gapY
    }
    
    let validationAttempts = 0
    const maxAttempts = 3

    // Try to generate a valid level (with retries)
    while (validationAttempts < maxAttempts) {
      try {
        let res;
        try {
          // Use local model name if using local LLM, otherwise use Groq model name
          const useLocal = process.env.USE_LOCAL_LLM === 'true' || process.env.USE_LOCAL_LLM === '1'
          const localProvider = (process.env.LOCAL_LLM_PROVIDER || 'lmstudio').toLowerCase()
          
          // Determine model name based on provider
          let modelName = "llama-3.3-70b-versatile" // Groq default
          if (useLocal) {
            if (localProvider === 'ollama') {
              modelName = process.env.LOCAL_LLM_MODEL || 'llama3.3:70b'
            } else {
              // LM Studio and NVIDIA NIM use model names like "llama-3.3-70b-versatile" or custom names
              modelName = process.env.LOCAL_LLM_MODEL || 'llama-3.3-70b-versatile'
            }
          }
          
          res = await groq.chat.completions.create({
            // Llama 3.1 70B was deprecated; use the recommended replacement.
            // See: https://console.groq.com/docs/deprecations#january-24-2025-llama-31-70b-and-llama-31-70b-speculative-decoding
            model: modelName,
            messages: [{ 
              role: "user", 
              content: prompt + ` Seed: ${seed + validationAttempts}\n\nIMPORTANT: Return COMPLETE, valid JSON. Ensure the response includes all closing brackets (] and }). Do not truncate the response.` 
            }],
            temperature: 0.9,
            max_tokens: 2000, // Increased to prevent truncation of 20 chunks
          })
        } catch (groqError: unknown) {
          // If Groq initialization fails (e.g., missing/invalid API key, slice error), use fallback
          const errorMessage = (groqError instanceof Error ? groqError.message : String(groqError))
          if (errorMessage.includes('GROQ_API_KEY') || 
              errorMessage.includes('slice') || 
              errorMessage.includes('is not a function')) {
            console.error('Groq client initialization error:', errorMessage)
            throw new Error('Groq API configuration error - using safe fallback level')
          }
          throw groqError // Re-throw other errors
        }

        // Parse the response
        const content = res.choices[0]?.message?.content
        if (!content) {
          throw new Error('No content in response')
        }

        // Clean the content (remove markdown code blocks if present)
        let cleanedContent = stripMarkdownCodeBlocks(content)
        
        // Further clean and fix JSON issues
        cleanedContent = cleanJSON(cleanedContent)

        // Try to parse as JSON
        try {
          levelData = JSON.parse(cleanedContent)
        } catch (parseError) {
          // If parsing fails, try to extract chunks from incomplete JSON
          const error = parseError instanceof Error ? parseError : new Error(String(parseError))
          console.warn('Failed to parse AI response, attempting to extract chunks:', error.message)
          
          // Log a snippet of the problematic content (first 1000 chars)
          const contentSnippet = cleanedContent.substring(0, 1000)
          console.warn('Problematic content snippet:', contentSnippet)
          
          // If the error mentions a specific position, try to show context
          if (error.message.includes('position')) {
            const positionMatch = error.message.match(/position (\d+)/)
            if (positionMatch) {
              const position = parseInt(positionMatch[1], 10)
              const start = Math.max(0, position - 100)
              const end = Math.min(cleanedContent.length, position + 100)
              console.warn('Context around error position:', cleanedContent.substring(start, end))
            }
          }
          
          // Try to extract valid chunks from incomplete JSON
          const extractedChunks = extractChunksFromIncompleteJSON(cleanedContent)
          
          if (extractedChunks && extractedChunks.length > 0) {
            console.log(`Extracted ${extractedChunks.length} valid chunks from incomplete JSON`)
            levelData = {
              seed: seed,
              chunks: extractedChunks
            }
            
            // Fill remaining chunks with safe generation if needed
            if (levelData.chunks.length < 20) {
              let currentGapY = levelData.chunks.length > 0
                ? levelData.chunks[levelData.chunks.length - 1].gapY
                : startGapY
              
              while (levelData.chunks.length < 20) {
                const chunk = generateSafeChunk(currentGapY)
                levelData.chunks.push(chunk)
                currentGapY = chunk.gapY
              }
            }
          } else {
            // Could not extract chunks, generate safe fallback
            console.warn('Could not extract chunks from incomplete JSON, generating safe fallback')
            console.warn('Full problematic content:', cleanedContent)
            levelData = {
              seed: seed,
              chunks: []
            }
            
            // Generate safe chunks
            let currentGapY = startGapY
            for (let i = 0; i < 20; i++) {
              const chunk = generateSafeChunk(currentGapY)
              levelData.chunks.push(chunk)
              currentGapY = chunk.gapY
            }
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
              const chunk = generateSafeChunk(currentGapY)
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
            const chunk = generateSafeChunk(currentGapY)
            levelData.chunks.push(chunk)
            currentGapY = chunk.gapY
          }
        }
      }
    }

    // Final validation: ensure the response is valid JSON
    try {
      const jsonResponse = JSON.stringify(levelData)
      // Try to parse it back to ensure it's valid
      JSON.parse(jsonResponse)
      return NextResponse.json(levelData)
    } catch (jsonError) {
      console.error('Final JSON validation failed:', jsonError)
      // Generate completely safe fallback if final validation fails
      const safeData: LevelData = {
        seed: seed,
        chunks: []
      }
      
      let currentGapY = startGapY
      for (let i = 0; i < 20; i++) {
        const chunk = generateSafeChunk(currentGapY)
        safeData.chunks.push(chunk)
        currentGapY = chunk.gapY
      }
      
      return NextResponse.json(safeData)
    }
  } catch (error) {
    console.error('Level generation error:', error)
    
    // Return safe fallback data
    // Try to get request body if available, otherwise use defaults
    let previousGapY = 0.5
    
    try {
      const body = await request.json()
      previousGapY = body.previousGapY ?? 0.5
    } catch {
      // Request body already consumed or invalid, use defaults
    }
    
    const startGapY = previousGapY
    
    const safeData: LevelData = {
      seed: Math.floor(Math.random() * 10000),
      chunks: []
    }
    
    let currentGapY = startGapY
    for (let i = 0; i < 20; i++) {
      const chunk = generateSafeChunk(currentGapY)
      safeData.chunks.push(chunk)
      currentGapY = chunk.gapY
    }
    
    return NextResponse.json(safeData)
  }
}

// Debug logging for webpack chunk issue
console.log('Level API route loaded');