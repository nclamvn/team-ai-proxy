import OpenAI from 'openai';

// Embedding model and dimension
const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMENSION = 1536;

// OpenAI client
function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('Missing OPENAI_API_KEY environment variable');
  }
  return new OpenAI({
    apiKey,
    timeout: 30000,
  });
}

/**
 * Create an embedding vector for the given text
 * @param text - Text to embed (will be truncated if too long)
 * @returns Array of numbers representing the embedding vector
 */
export async function createEmbedding(text: string): Promise<number[]> {
  const client = getOpenAIClient();

  // Truncate text if too long (model has token limits)
  // Approximate: 1 token ~= 4 chars for English
  const maxChars = 8000 * 4; // ~8000 tokens safe limit
  const truncatedText = text.length > maxChars
    ? text.substring(0, maxChars)
    : text;

  try {
    const response = await client.embeddings.create({
      model: EMBEDDING_MODEL,
      input: truncatedText,
      dimensions: EMBEDDING_DIMENSION,
    });

    const embedding = response.data[0]?.embedding;
    if (!embedding) {
      throw new Error('No embedding returned from API');
    }

    // Validate dimension
    if (embedding.length !== EMBEDDING_DIMENSION) {
      throw new Error(`Unexpected embedding dimension: ${embedding.length}, expected ${EMBEDDING_DIMENSION}`);
    }

    return embedding;
  } catch (error) {
    console.error('Embedding error:', error instanceof Error ? error.message : 'Unknown');
    throw error;
  }
}

/**
 * Prepare text for embedding from knowledge card content
 * Combines title, summary, and main answer for better semantic matching
 */
export function prepareTextForEmbedding(
  title: string,
  summary: string,
  mainAnswer?: string
): string {
  const parts = [title, summary];
  if (mainAnswer) {
    parts.push(mainAnswer);
  }
  return parts.join('\n\n');
}

/**
 * Export constants for use in other modules
 */
export { EMBEDDING_MODEL, EMBEDDING_DIMENSION };
