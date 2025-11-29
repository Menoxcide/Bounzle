// Groq SDK wrapper for level generation
import Groq from 'groq'

// Type assertion for Groq constructor - package may have incomplete types
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const GroqConstructor = Groq as any as new (config: { apiKey: string }) => {
  chat: {
    completions: {
      create: (params: {
        model: string;
        messages: Array<{ role: string; content: string }>;
        temperature: number;
        max_tokens: number;
      }) => Promise<{
        choices: Array<{
          message?: {
            content?: string;
          };
        }>;
      }>;
    };
  };
}

// Lazy initialization - only create client when needed
let groqInstance: InstanceType<typeof GroqConstructor> | null = null;

function getGroqClient(): InstanceType<typeof GroqConstructor> {
  if (!groqInstance) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      throw new Error('GROQ_API_KEY environment variable is not set');
    }
    groqInstance = new GroqConstructor({
      apiKey: apiKey,
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