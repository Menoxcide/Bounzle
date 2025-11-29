// Groq SDK wrapper for level generation
import Groq from 'groq-sdk'

// Lazy initialization - only create client when needed
let groqInstance: Groq | null = null;

function getGroqClient(): Groq {
  if (!groqInstance) {
    const apiKey = process.env.GROQ_API_KEY;
    // Validate that apiKey is a non-empty string
    if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length === 0) {
      throw new Error('GROQ_API_KEY environment variable is not set or is invalid');
    }
    // Ensure we're passing a string (not undefined or other type)
    groqInstance = new Groq({
      apiKey: String(apiKey).trim(),
    });
  }
  return groqInstance;
}

// Export a function that returns the client (lazy initialization)
export const groq = {
  get chat() {
    return getGroqClient().chat;
  }
};