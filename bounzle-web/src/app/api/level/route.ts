// API route for AI level generation
import { groq } from '@/lib/groq'
import { LEVEL_GENERATION_PROMPT } from '@/lib/prompts'
import { NextResponse } from 'next/server'

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

    const { seed, checkpoint } = await request.json()

    // Validate input
    if (typeof seed !== 'number' || typeof checkpoint !== 'number') {
      return NextResponse.json(
        { error: 'Invalid input. Seed and checkpoint must be numbers.' },
        { status: 400 }
      )
    }

    // Format the prompt with checkpoint
    const prompt = LEVEL_GENERATION_PROMPT.replace('{checkpoint}', checkpoint.toString())

    const res = await groq.chat.completions.create({
      model: "llama-3.1-70b-versatile",
      messages: [{ role: "user", content: prompt + ` Seed: ${seed}` }],
      temperature: 0.9,
      max_tokens: 800,
    })

    // Parse the response
    const content = res.choices[0]?.message?.content
    if (!content) {
      throw new Error('No content in response')
    }

    // Try to parse as JSON
    let levelData
    try {
      levelData = JSON.parse(content)
    } catch (parseError) {
      // If parsing fails, return a mock response
      console.error('Failed to parse AI response, returning mock data:', parseError)
      levelData = {
        seed: seed,
        chunks: Array.from({ length: 20 }, () => ({
          gapY: Math.random() * 0.6 + 0.2, // 0.2 to 0.8
          gapHeight: Math.random() * 0.2 + 0.1, // 0.1 to 0.3
          obstacleType: ['pipe', 'spike', 'moving'][Math.floor(Math.random() * 3)] as 'pipe' | 'spike' | 'moving',
          theme: ['normal', 'neon', 'lava'][Math.floor(Math.random() * 3)] as 'normal' | 'neon' | 'lava'
        }))
      }
    }

    return NextResponse.json(levelData)
  } catch (error) {
    console.error('Level generation error:', error)
    
    // Return mock data in case of error
    const mockData = {
      seed: Math.floor(Math.random() * 10000),
      chunks: Array.from({ length: 20 }, () => ({
        gapY: Math.random() * 0.6 + 0.2,
        gapHeight: Math.random() * 0.2 + 0.1,
        obstacleType: 'pipe',
        theme: 'normal'
      }))
    }
    
    return NextResponse.json(mockData)
  }
}