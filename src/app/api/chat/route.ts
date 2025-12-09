import { NextRequest, NextResponse } from 'next/server';
import {
  createConversation,
  getConversation,
  touchConversation,
  insertUserMessage,
  insertAssistantMessage,
  getUserById,
} from '@/lib/db';
import { chatCompletion, OpenAIError } from '@/lib/openai';
import { runKnowledgePipelineAsync } from '@/lib/knowledge/pipeline';
import { findSimilarForDuplicate, DuplicateSuggestion } from '@/lib/knowledge/search';

// Types
interface ChatRequest {
  conversationId?: string | null;
  message: string;
  model?: string | null;
  metadata?: {
    client?: string;
    tags?: string[];
  };
}

interface ChatResponse {
  conversationId: string;
  assistantMessageId: string;
  userMessageId: string;
  content: string;
  model: string;
  createdAt: string;
  usage: {
    promptTokens: number | null;
    completionTokens: number | null;
    totalTokens: number | null;
  };
  similarResults: DuplicateSuggestion[];
}

interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: string;
  };
}

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUUID(str: string): boolean {
  return UUID_REGEX.test(str);
}

function errorResponse(
  code: string,
  message: string,
  status: number,
  details?: string
): NextResponse<ErrorResponse> {
  return NextResponse.json(
    {
      error: {
        code,
        message,
        details,
      },
    },
    { status }
  );
}

export async function POST(
  request: NextRequest
): Promise<NextResponse<ChatResponse | ErrorResponse>> {
  try {
    // 1. Get user ID from auth header (placeholder for Supabase Auth integration)
    // In production, this would come from Supabase Auth session
    const userId = request.headers.get('x-user-id');

    if (!userId) {
      return errorResponse(
        'UNAUTHORIZED',
        'Authentication required. Please provide user credentials.',
        401
      );
    }

    if (!isValidUUID(userId)) {
      return errorResponse(
        'INVALID_USER_ID',
        'Invalid user ID format.',
        401
      );
    }

    // Verify user exists
    const user = await getUserById(userId);
    if (!user) {
      return errorResponse(
        'USER_NOT_FOUND',
        'User not found. Please check your credentials.',
        401
      );
    }

    // 2. Parse and validate request body
    let body: ChatRequest;
    try {
      body = await request.json();
    } catch {
      return errorResponse(
        'INVALID_JSON',
        'Request body must be valid JSON.',
        400
      );
    }

    // Validate message
    if (!body.message || typeof body.message !== 'string') {
      return errorResponse(
        'MISSING_MESSAGE',
        'Message is required and must be a string.',
        400
      );
    }

    const trimmedMessage = body.message.trim();
    if (trimmedMessage.length === 0) {
      return errorResponse(
        'EMPTY_MESSAGE',
        'Message cannot be empty.',
        400
      );
    }

    // Validate conversationId if provided
    if (body.conversationId && !isValidUUID(body.conversationId)) {
      return errorResponse(
        'INVALID_CONVERSATION_ID',
        'Conversation ID must be a valid UUID.',
        400
      );
    }

    // 3. Create or get conversation
    let conversationId: string;

    if (body.conversationId) {
      // Verify conversation belongs to user
      const conversation = await getConversation(body.conversationId, userId);
      if (!conversation) {
        return errorResponse(
          'CONVERSATION_NOT_FOUND',
          'Conversation not found or access denied.',
          403
        );
      }
      conversationId = conversation.id;

      // Update conversation timestamp
      await touchConversation(conversationId);
    } else {
      // Create new conversation
      const title = trimmedMessage.substring(0, 50);
      const conversation = await createConversation(userId, title);
      conversationId = conversation.id;
    }

    // 4. Insert user message
    const userMessage = await insertUserMessage(
      conversationId,
      userId,
      trimmedMessage,
      {
        source: 'proxy',
        client: body.metadata?.client || 'web',
        tags: body.metadata?.tags || [],
      }
    );

    // 5. Find similar existing answers (duplicate detection)
    // This runs in parallel conceptually but we need the result before response
    let similarResults: DuplicateSuggestion[] = [];
    try {
      similarResults = await findSimilarForDuplicate(trimmedMessage, userId);
    } catch (error) {
      // Don't fail the request if duplicate detection fails
      console.error('Duplicate detection error:', error instanceof Error ? error.message : 'Unknown');
    }

    // 6. Call OpenAI API
    let aiResponse;
    try {
      aiResponse = await chatCompletion(
        [{ role: 'user', content: trimmedMessage }],
        body.model || undefined
      );
    } catch (error) {
      if (error instanceof OpenAIError) {
        // Map OpenAI errors to appropriate HTTP status
        const status =
          error.code === 'RATE_LIMIT'
            ? 429
            : error.code === 'TIMEOUT'
            ? 504
            : error.statusCode >= 500
            ? 502
            : 500;

        return errorResponse(error.code, error.message, status);
      }

      // Unknown error
      console.error('OpenAI error:', error);
      return errorResponse(
        'AI_SERVICE_ERROR',
        'AI service unavailable. Please try again later.',
        502
      );
    }

    // 7. Insert assistant message
    const assistantMessage = await insertAssistantMessage(
      conversationId,
      userId,
      aiResponse.content,
      aiResponse.model,
      aiResponse.usage.totalTokens || undefined,
      {
        requestId: aiResponse.requestId,
        usage: aiResponse.usage,
      }
    );

    // 8. Trigger Knowledge Pipeline (fire-and-forget, non-blocking)
    // Creates knowledge card + embedding from the Q&A pair
    runKnowledgePipelineAsync(assistantMessage.id, userId);

    // 9. Return response with similar results
    const response: ChatResponse = {
      conversationId,
      assistantMessageId: assistantMessage.id,
      userMessageId: userMessage.id,
      content: aiResponse.content,
      model: aiResponse.model,
      createdAt: assistantMessage.created_at,
      usage: aiResponse.usage,
      similarResults,
    };

    return NextResponse.json(response);
  } catch (error) {
    // Log internal errors (without sensitive data)
    console.error('Chat API error:', error instanceof Error ? error.message : 'Unknown error');

    return errorResponse(
      'INTERNAL_ERROR',
      'An unexpected error occurred. Please try again.',
      500
    );
  }
}
