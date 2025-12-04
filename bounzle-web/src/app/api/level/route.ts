// API route for AI level generation
import { groq } from '@/lib/groq'
import { LEVEL_GENERATION_PROMPT } from '@/lib/prompts'
import { validateLevelData, validateAndFixChunk } from '@/lib/levelValidator'
import { NextResponse } from 'next/server'
import { LevelData, LevelChunk } from '@/bounzle-game/types'

const rateLimitStore = new Map<string, { count: number; resetTime: number }>()

function checkRateLimit(ip: string): { allowed: boolean; resetTime?: number } {
  const now = Date.now()
  const windowMs = 60 * 1000
  const maxRequests = 5

  const record = rateLimitStore.get(ip)

  if (!record || record.resetTime < now) {
    rateLimitStore.set(ip, { count: 1, resetTime: now + windowMs })
    return { allowed: true }
  }

  if (record.count < maxRequests) {
    rateLimitStore.set(ip, { count: record.count + 1, resetTime: record.resetTime })
    return { allowed: true }
  }

  return { allowed: false, resetTime: record.resetTime }
}

function stripMarkdownCodeBlocks(content: string): string {
  let cleaned = content.trim()
  
  cleaned = cleaned.replace(/^```(?:json|javascript|js)?\s*\n?/i, '')
  cleaned = cleaned.replace(/\n?```\s*$/i, '')
  cleaned = cleaned.replace(/```.*?\n/g, '').replace(/\n```/g, '')
  
  return cleaned.trim()
}

function cleanJSON(jsonString: string): string {
  let cleaned = jsonString.trim()
  
  cleaned = cleaned.replace(/\/\/.*$/gm, '')
  cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, '')
  cleaned = cleaned.replace(/,(\s*[}\]])/g, '$1')
  cleaned = cleaned.replace(/"stacleType"/g, '"obstacleType"')
  cleaned = cleaned.replace(/}(\s*)\{/g, '},$1{')
  cleaned = cleaned.replace(/"(\w+)"\s*:\s*("[^"]*"|\d+\.?\d*|\w+)(\s*)"(\w+)"/g, '"$1": $2,$3"$4"')
  
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
  if (jsonMatch) {
    cleaned = jsonMatch[0]
  }
  
  return cleaned.trim()
}

function extractChunksFromIncompleteJSON(jsonString: string): LevelChunk[] | null {
  try {
    const chunksMatch = jsonString.match(/"chunks"\s*:\s*\[([\s\S]*)/)
    if (!chunksMatch) {
      return null
    }
    
    const chunksContent = chunksMatch[1]
    const chunks: LevelChunk[] = []
    
    const chunkPattern = /\{\s*"gapY"\s*:\s*([0-9.]+)\s*(?:,\s*"gapHeight"\s*:\s*([0-9.]+))?\s*(?:,\s*"obstacleType"\s*:\s*"([^"]*)")?\s*(?:,\s*"theme"\s*:\s*"([^"]*)")?\s*\}?/g
    
    let match
    while ((match = chunkPattern.exec(chunksContent)) !== null) {
      const gapY = parseFloat(match[1])
      const gapHeight = match[2] ? parseFloat(match[2]) : 0.2
      const obstacleType = (match[3] || 'pipe').trim()
      const theme = (match[4] || 'normal').trim()
      
      if (!isNaN(gapY) && gapY >= 0 && gapY <= 1) {
        let fixedGapHeight = gapHeight
        if (isNaN(fixedGapHeight) || fixedGapHeight <= 0 || fixedGapHeight > 1) {
          fixedGapHeight = 0.2
        }
        
        let fixedObstacleType: 'pipe' | 'spike' | 'moving' = 'pipe'
        if (obstacleType) {
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

function generateSafeChunk(previousGapY: number): LevelChunk {
  let gapY = previousGapY
  
  const variation = (Math.random() - 0.5) * 0.2
  gapY = Math.max(0.2, Math.min(0.8, gapY + variation))
  
  const maxChange = 0.25
  if (gapY > previousGapY + maxChange) {
    gapY = previousGapY + maxChange
  } else if (gapY < previousGapY - maxChange) {
    gapY = previousGapY - maxChange
  }
  
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
    const ip = request.headers.get('x-forwarded-for') || '127.0.0.1'
    
    const rateLimit = checkRateLimit(ip)
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Try again later.' },
        { status: 429 }
      )
    }

    const body = await request.json()
    const { seed, checkpoint, previousGapY, canvasHeight } = body

    if (typeof seed !== 'number' || typeof checkpoint !== 'number') {
      return NextResponse.json(
        { error: 'Invalid input. Seed and checkpoint must be numbers.' },
        { status: 400 }
      )
    }

    const safeCanvasHeight = canvasHeight || 600
    const startGapY = previousGapY ?? 0.5

    let prompt = LEVEL_GENERATION_PROMPT.replace('{checkpoint}', checkpoint.toString())
    if (previousGapY !== undefined) {
      prompt += `\n\nPrevious gap center Y position: ${previousGapY.toFixed(2)} (normalized 0-1). Ensure smooth transition from this position.`
    }

    let levelData: LevelData = {
      seed: seed,
      chunks: []
    }
    
    let currentGapY = startGapY
    for (let i = 0; i < 20; i++) {
      const chunk = generateSafeChunk(currentGapY)
      levelData.chunks.push(chunk)
      currentGapY = chunk.gapY
    }
    
    let validationAttempts = 0
    const maxAttempts = 3

    while (validationAttempts < maxAttempts) {
      try {
        let res;
        try {
          const useLocal = process.env.USE_LOCAL_LLM === 'true' || process.env.USE_LOCAL_LLM === '1'
          const localProvider = (process.env.LOCAL_LLM_PROVIDER || 'lmstudio').toLowerCase()
          
          let modelName = "llama-3.3-70b-versatile"
          if (useLocal) {
            if (localProvider === 'ollama') {
              modelName = process.env.LOCAL_LLM_MODEL || 'llama3.3:70b'
            } else {
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
            max_tokens: 2000,
          })
        } catch (groqError: unknown) {
          const errorMessage = (groqError instanceof Error ? groqError.message : String(groqError))
          if (errorMessage.includes('GROQ_API_KEY') || 
              errorMessage.includes('slice') || 
              errorMessage.includes('is not a function')) {
            console.error('Groq client initialization error:', errorMessage)
            throw new Error('Groq API configuration error - using safe fallback level')
          }
          throw groqError
        }

        const content = res.choices[0]?.message?.content
        if (!content) {
          throw new Error('No content in response')
        }

        let cleanedContent = stripMarkdownCodeBlocks(content)
        cleanedContent = cleanJSON(cleanedContent)

        try {
          levelData = JSON.parse(cleanedContent)
        } catch (parseError) {
          const error = parseError instanceof Error ? parseError : new Error(String(parseError))
          console.warn('Failed to parse AI response, attempting to extract chunks:', error.message)
          
          const contentSnippet = cleanedContent.substring(0, 1000)
          console.warn('Problematic content snippet:', contentSnippet)
          
          if (error.message.includes('position')) {
            const positionMatch = error.message.match(/position (\d+)/)
            if (positionMatch) {
              const position = parseInt(positionMatch[1], 10)
              const start = Math.max(0, position - 100)
              const end = Math.min(cleanedContent.length, position + 100)
              console.warn('Context around error position:', cleanedContent.substring(start, end))
            }
          }
          
          const extractedChunks = extractChunksFromIncompleteJSON(cleanedContent)
          
          if (extractedChunks && extractedChunks.length > 0) {
            console.log(`Extracted ${extractedChunks.length} valid chunks from incomplete JSON`)
            levelData = {
              seed: seed,
              chunks: extractedChunks
            }
            
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
            console.warn('Could not extract chunks from incomplete JSON, generating safe fallback')
            console.warn('Full problematic content:', cleanedContent)
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

        const validation = validateLevelData(levelData, safeCanvasHeight, startGapY)
        
        if (validation.valid || validation.fixedChunks) {
          if (validation.fixedChunks) {
            levelData.chunks = validation.fixedChunks
            console.log(`Level validated and fixed: ${validation.issues.length} issues resolved`)
          }
          
          let currentGapY = startGapY
          const finalChunks: LevelChunk[] = []
          
          for (const chunk of levelData.chunks) {
            const fixed = validateAndFixChunk(chunk, currentGapY, safeCanvasHeight)
            finalChunks.push(fixed)
            currentGapY = fixed.gapY
          }
          
          levelData.chunks = finalChunks
          break
        } else {
          validationAttempts++
          console.warn(`Level validation failed (attempt ${validationAttempts}/${maxAttempts}):`, validation.issues)
          
          if (validationAttempts >= maxAttempts) {
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

    try {
      const jsonResponse = JSON.stringify(levelData)
      JSON.parse(jsonResponse)
      return NextResponse.json(levelData)
    } catch (jsonError) {
      console.error('Final JSON validation failed:', jsonError)
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
    
    let previousGapY = 0.5
    
    try {
      const body = await request.json()
      previousGapY = body.previousGapY ?? 0.5
    } catch {
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

console.log('Level API route loaded');