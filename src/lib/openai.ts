import OpenAI from 'openai';

// Types
export interface ChatCompletionResult {
  content: string;
  model: string;
  usage: {
    promptTokens: number | null;
    completionTokens: number | null;
    totalTokens: number | null;
  };
  requestId: string | null;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

// OpenAI client singleton
let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (openaiClient) return openaiClient;

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error('Missing OPENAI_API_KEY environment variable');
  }

  openaiClient = new OpenAI({
    apiKey,
    baseURL: process.env.OPENAI_BASE_URL || undefined,
    timeout: 30000, // 30 seconds timeout
  });

  return openaiClient;
}

// Default model
const DEFAULT_MODEL = 'gpt-4.1-mini';

/**
 * Send a chat completion request to OpenAI
 */
export async function chatCompletion(
  messages: ChatMessage[],
  model?: string
): Promise<ChatCompletionResult> {
  const client = getOpenAIClient();
  const selectedModel = model || DEFAULT_MODEL;

  try {
    const response = await client.chat.completions.create({
      model: selectedModel,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    });

    const choice = response.choices[0];
    if (!choice || !choice.message.content) {
      throw new Error('No response content from OpenAI');
    }

    return {
      content: choice.message.content,
      model: response.model,
      usage: {
        promptTokens: response.usage?.prompt_tokens ?? null,
        completionTokens: response.usage?.completion_tokens ?? null,
        totalTokens: response.usage?.total_tokens ?? null,
      },
      requestId: response.id || null,
    };
  } catch (error) {
    // Handle specific OpenAI errors
    if (error instanceof OpenAI.APIError) {
      const status = error.status;

      if (status === 401 || status === 403) {
        throw new OpenAIError(
          'INVALID_API_KEY',
          'Invalid OpenAI API key. Please check your configuration.',
          status
        );
      }

      if (status === 429) {
        throw new OpenAIError(
          'RATE_LIMIT',
          'OpenAI rate limit exceeded. Please try again later.',
          status
        );
      }

      if (status && status >= 500) {
        throw new OpenAIError(
          'SERVER_ERROR',
          'OpenAI service is temporarily unavailable. Please try again.',
          status
        );
      }

      throw new OpenAIError(
        'API_ERROR',
        error.message || 'Unknown OpenAI API error',
        status || 500
      );
    }

    // Network/timeout errors
    if (error instanceof Error) {
      if (error.message.includes('timeout') || error.message.includes('ETIMEDOUT')) {
        throw new OpenAIError(
          'TIMEOUT',
          'Request to OpenAI timed out. Please try again.',
          504
        );
      }

      if (error.message.includes('ECONNREFUSED') || error.message.includes('network')) {
        throw new OpenAIError(
          'NETWORK_ERROR',
          'Unable to connect to OpenAI. Please check your network.',
          503
        );
      }
    }

    // Re-throw unknown errors
    throw error;
  }
}

/**
 * Custom error class for OpenAI-related errors
 */
export class OpenAIError extends Error {
  code: string;
  statusCode: number;

  constructor(code: string, message: string, statusCode: number) {
    super(message);
    this.name = 'OpenAIError';
    this.code = code;
    this.statusCode = statusCode;
  }
}
