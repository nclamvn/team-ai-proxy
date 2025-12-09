import {
  getMessageById,
  getPrecedingUserMessage,
  insertKnowledgeCard,
  insertEmbedding,
  KnowledgeCard,
} from '@/lib/db';
import { summarizeQA } from './summarize';
import { createEmbedding, prepareTextForEmbedding } from './embed';

// Types
export interface PipelineResult {
  success: boolean;
  knowledgeCardId?: string;
  embeddingId?: string;
  error?: string;
}

/**
 * Run the knowledge pipeline for an assistant message
 * Creates a knowledge card and embedding from the Q&A pair
 *
 * @param assistantMessageId - UUID of the assistant message
 * @param userId - UUID of the user who owns the conversation
 * @returns PipelineResult with success status and created IDs
 */
export async function runKnowledgePipeline(
  assistantMessageId: string,
  userId: string
): Promise<PipelineResult> {
  try {
    // 1. Get the assistant message
    const assistantMessage = await getMessageById(assistantMessageId);
    if (!assistantMessage) {
      return {
        success: false,
        error: `Assistant message not found: ${assistantMessageId}`,
      };
    }

    if (assistantMessage.role !== 'assistant') {
      return {
        success: false,
        error: `Message is not an assistant message: ${assistantMessageId}`,
      };
    }

    // 2. Get the preceding user message
    const userMessage = await getPrecedingUserMessage(
      assistantMessage.conversation_id,
      assistantMessage.created_at
    );

    if (!userMessage) {
      console.warn(`No preceding user message found for assistant message: ${assistantMessageId}`);
      return {
        success: false,
        error: 'No preceding user message found',
      };
    }

    // 3. Summarize the Q&A into a knowledge card draft
    const cardDraft = await summarizeQA(userMessage.content, assistantMessage.content);

    // 4. Insert the knowledge card
    let knowledgeCard: KnowledgeCard;
    try {
      knowledgeCard = await insertKnowledgeCard(
        assistantMessageId,
        userId,
        cardDraft.title,
        cardDraft.summary,
        cardDraft.mainAnswer,
        cardDraft.tags,
        'team', // Default visibility
        0 // Default importance score
      );
    } catch (error) {
      console.error('Failed to insert knowledge card:', error);
      return {
        success: false,
        error: `Failed to insert knowledge card: ${error instanceof Error ? error.message : 'Unknown'}`,
      };
    }

    // 5. Create embedding for the knowledge card
    let embeddingId: string | undefined;
    try {
      const textForEmbedding = prepareTextForEmbedding(
        cardDraft.title,
        cardDraft.summary,
        cardDraft.mainAnswer
      );

      const embeddingVector = await createEmbedding(textForEmbedding);

      const embeddingRecord = await insertEmbedding(
        'knowledge_card',
        knowledgeCard.id,
        embeddingVector
      );

      embeddingId = embeddingRecord.id;
    } catch (error) {
      // Log but don't fail - knowledge card is still valid without embedding
      console.error('Failed to create embedding:', error);
      // Continue - knowledge card exists, just missing embedding
    }

    // 6. Log success
    console.log(`Knowledge pipeline completed: card=${knowledgeCard.id}, embedding=${embeddingId || 'failed'}`);

    return {
      success: true,
      knowledgeCardId: knowledgeCard.id,
      embeddingId,
    };
  } catch (error) {
    console.error('Knowledge pipeline error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown pipeline error',
    };
  }
}

/**
 * Run the knowledge pipeline in fire-and-forget mode
 * Does not block the caller, logs errors internally
 *
 * @param assistantMessageId - UUID of the assistant message
 * @param userId - UUID of the user
 */
export function runKnowledgePipelineAsync(
  assistantMessageId: string,
  userId: string
): void {
  // Fire and forget - don't await
  runKnowledgePipeline(assistantMessageId, userId)
    .then((result) => {
      if (!result.success) {
        console.warn(`Knowledge pipeline failed for message ${assistantMessageId}:`, result.error);
      }
    })
    .catch((error) => {
      console.error(`Knowledge pipeline threw for message ${assistantMessageId}:`, error);
    });
}
