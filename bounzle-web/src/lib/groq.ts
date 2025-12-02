// LLM provider abstraction for level generation
// Supports Groq API, LM Studio, NVIDIA NIM, and Ollama
import Groq from 'groq-sdk'

type LLMProvider = 'groq' | 'lmstudio' | 'nvidia-nim' | 'ollama'

interface ChatCompletionRequest {
  model: string
  messages: Array<{ role: string; content: string }>
  temperature?: number
  max_tokens?: number
}

interface ChatCompletionResponse {
  choices: Array<{
    message: {
      content: string
    }
  }>
}

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

// Get the LLM provider to use (local in dev if configured, otherwise Groq)
function getLLMProvider(): LLMProvider {
  const useLocal = process.env.USE_LOCAL_LLM === 'true' || process.env.USE_LOCAL_LLM === '1'
  const localLLMProvider = (process.env.LOCAL_LLM_PROVIDER || 'lmstudio').toLowerCase()
  const localLLMUrl = process.env.LOCAL_LLM_URL
  
  if (useLocal && localLLMUrl) {
    // Support: lmstudio, nvidia-nim, ollama
    if (localLLMProvider === 'lmstudio' || localLLMProvider === 'lm-studio') {
      return 'lmstudio'
    } else if (localLLMProvider === 'nvidia-nim' || localLLMProvider === 'nim') {
      return 'nvidia-nim'
    } else if (localLLMProvider === 'ollama') {
      return 'ollama'
    }
    // Default to LM Studio if provider is not recognized
    return 'lmstudio'
  }
  return 'groq'
}

// Call local LLM via OpenAI-compatible API (LM Studio, NVIDIA NIM)
async function callOpenAICompatibleLLM(
  request: ChatCompletionRequest,
  baseUrl: string,
  apiKey?: string
): Promise<ChatCompletionResponse> {
  // OpenAI-compatible API format (used by LM Studio and NVIDIA NIM)
  const openAIRequest = {
    model: request.model,
    messages: request.messages,
    temperature: request.temperature || 0.9,
    max_tokens: request.max_tokens || 800,
  }
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  
  // Add API key if provided (NVIDIA NIM typically requires this)
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`
  }
  
  // Determine endpoint based on provider
  const endpoint = baseUrl.endsWith('/v1') 
    ? `${baseUrl}/chat/completions`
    : `${baseUrl}/v1/chat/completions`
  
  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(openAIRequest),
  })
  
  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Local LLM request failed: ${response.status} ${errorText}`)
  }
  
  const data = await response.json()
  
  // OpenAI-compatible response format matches Groq format
  return {
    choices: data.choices || [{
      message: {
        content: data.message?.content || data.content || ''
      }
    }]
  }
}

// Call local LLM via Ollama API
async function callOllamaLLM(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
  const localLLMUrl = process.env.LOCAL_LLM_URL || 'http://localhost:11434'
  const model = process.env.LOCAL_LLM_MODEL || 'llama3.3:70b'
  
  // Ollama API format
  const ollamaRequest = {
    model: model,
    messages: request.messages,
    options: {
      temperature: request.temperature || 0.9,
      num_predict: request.max_tokens || 800,
    }
  }
  
  const response = await fetch(`${localLLMUrl}/api/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(ollamaRequest),
  })
  
  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Ollama request failed: ${response.status} ${errorText}`)
  }
  
  const data = await response.json()
  
  // Convert Ollama response format to Groq-compatible format
  return {
    choices: [{
      message: {
        content: data.message?.content || ''
      }
    }]
  }
}

// Call local LLM based on provider type
async function callLocalLLM(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
  const provider = getLLMProvider()
  const localLLMUrl = process.env.LOCAL_LLM_URL || 'http://localhost:1234'
  const localLLMApiKey = process.env.LOCAL_LLM_API_KEY
  
  if (provider === 'ollama') {
    return callOllamaLLM(request)
  } else {
    // LM Studio and NVIDIA NIM both use OpenAI-compatible API
    return callOpenAICompatibleLLM(request, localLLMUrl, localLLMApiKey)
  }
}

// Unified chat completions interface that matches Groq SDK structure
export const groq = {
  get chat() {
    const provider = getLLMProvider()
    
    if (provider !== 'groq') {
      // Return a local LLM client interface matching Groq SDK structure
      return {
        completions: {
          create: async (request: ChatCompletionRequest): Promise<ChatCompletionResponse> => {
            return callLocalLLM(request)
          }
        }
      }
    }
    
    // Return Groq client (which already has chat.completions.create)
    return getGroqClient().chat;
  }
};