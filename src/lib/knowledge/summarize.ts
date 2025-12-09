import OpenAI from 'openai';

// Types
export interface KnowledgeCardDraft {
  title: string;
  summary: string;
  mainAnswer: string;
  tags: string[];
}

// OpenAI client (reuse from parent, but keep self-contained for knowledge module)
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

// Model for summarization (can use cheaper model)
const SUMMARIZE_MODEL = 'gpt-4.1-mini';

// System prompt for knowledge extraction
const SYSTEM_PROMPT = `You are a Knowledge Compressor. Your task is to extract and structure knowledge from Q&A pairs into reusable knowledge cards.

Given a question and answer, create a knowledge card with:
1. **title**: A concise, searchable title (max 80 chars) that captures the main topic
2. **summary**: 2-4 sentences summarizing the key information
3. **mainAnswer**: A clean, standalone answer that can be understood without the original question
4. **tags**: 3-7 lowercase keyword tags for categorization (e.g., "process", "troubleshooting", "how-to", "ops", "policy")

Respond ONLY with valid JSON in this exact format:
{
  "title": "string",
  "summary": "string",
  "mainAnswer": "string",
  "tags": ["string", "string", ...]
}

Guidelines:
- Title should be clear and searchable
- Summary should be concise but complete
- MainAnswer should be self-contained and actionable
- Tags should be relevant keywords, lowercase, no special characters
- Preserve technical accuracy
- Keep the same language as the input`;

/**
 * Summarize a Q&A pair into a Knowledge Card draft
 */
export async function summarizeQA(
  question: string,
  answer: string
): Promise<KnowledgeCardDraft> {
  const client = getOpenAIClient();

  const userPrompt = `Question: ${question}

Answer: ${answer}`;

  try {
    const response = await client.chat.completions.create({
      model: SUMMARIZE_MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response content from summarization');
    }

    const parsed = JSON.parse(content) as KnowledgeCardDraft;

    // Validate required fields
    if (!parsed.title || !parsed.summary || !parsed.mainAnswer) {
      throw new Error('Invalid response structure from summarization');
    }

    // Ensure tags is an array
    if (!Array.isArray(parsed.tags)) {
      parsed.tags = [];
    }

    // Clean tags: lowercase, trim, filter empty
    parsed.tags = parsed.tags
      .map((tag: string) => tag.toLowerCase().trim())
      .filter((tag: string) => tag.length > 0)
      .slice(0, 7); // Max 7 tags

    // Truncate title if too long
    if (parsed.title.length > 80) {
      parsed.title = parsed.title.substring(0, 77) + '...';
    }

    return parsed;
  } catch (error) {
    // Log error but provide fallback
    console.error('Summarization error:', error instanceof Error ? error.message : 'Unknown');

    // Fallback: create basic card from raw content
    return createFallbackCard(question, answer);
  }
}

/**
 * Create a fallback knowledge card when summarization fails
 */
function createFallbackCard(question: string, answer: string): KnowledgeCardDraft {
  // Use first 80 chars of question as title
  const title = question.length > 80
    ? question.substring(0, 77) + '...'
    : question;

  // Use first 500 chars of answer as summary
  const summary = answer.length > 500
    ? answer.substring(0, 497) + '...'
    : answer;

  return {
    title,
    summary,
    mainAnswer: answer,
    tags: ['auto-generated'],
  };
}
