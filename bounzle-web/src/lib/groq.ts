// Groq SDK wrapper for level generation
import Groq from 'groq'

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY || 'your-api-key-here',
})

export { groq }