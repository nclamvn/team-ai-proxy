import { createEmbedding } from './embed';
import {
  searchKnowledgeCardsByKeyword,
  searchKnowledgeCardsBySemantic,
  KnowledgeCard,
} from '@/lib/db';

// Types
export interface SearchFilters {
  tag?: string;
  userId?: string;
  visibility?: 'team' | 'private' | 'all';
  limit?: number;
}

export interface SearchResult {
  knowledgeCardId: string;
  title: string;
  summary: string;
  mainAnswer: string | null;
  tags: string[];
  score: number;
  createdAt: string;
}

export interface DuplicateSuggestion {
  knowledgeCardId: string;
  title: string;
  summary: string;
  score: number;
}

// Default values
const DEFAULT_LIMIT = 10;
const DUPLICATE_THRESHOLD = 0.80;
const DUPLICATE_LIMIT = 5;

/**
 * Search knowledge cards by keyword (ILIKE on title and summary)
 */
export async function searchByKeyword(
  query: string,
  filters: SearchFilters = {}
): Promise<SearchResult[]> {
  const limit = filters.limit || DEFAULT_LIMIT;

  try {
    const cards = await searchKnowledgeCardsByKeyword(query, {
      tag: filters.tag,
      userId: filters.userId,
      visibility: filters.visibility,
      limit,
    });

    return cards.map((card) => ({
      knowledgeCardId: card.id,
      title: card.title,
      summary: card.summary,
      mainAnswer: card.main_answer,
      tags: card.tags,
      score: 1.0, // Keyword match = full score
      createdAt: card.created_at,
    }));
  } catch (error) {
    console.error('Keyword search error:', error);
    return [];
  }
}

/**
 * Search knowledge cards by semantic similarity using embeddings
 */
export async function searchBySemantic(
  query: string,
  filters: SearchFilters = {}
): Promise<SearchResult[]> {
  const limit = filters.limit || DEFAULT_LIMIT;

  try {
    // 1. Create embedding for the query
    const queryEmbedding = await createEmbedding(query);

    // 2. Search using the embedding
    const results = await searchKnowledgeCardsBySemantic(queryEmbedding, {
      tag: filters.tag,
      userId: filters.userId,
      visibility: filters.visibility,
      limit,
      threshold: 0.5, // Lower threshold for search, let UI filter
    });

    return results.map((result) => ({
      knowledgeCardId: result.card.id,
      title: result.card.title,
      summary: result.card.summary,
      mainAnswer: result.card.main_answer,
      tags: result.card.tags,
      score: result.similarity,
      createdAt: result.card.created_at,
    }));
  } catch (error) {
    console.error('Semantic search error:', error);
    return [];
  }
}

/**
 * Hybrid search combining semantic and keyword results
 */
export async function searchHybrid(
  query: string,
  filters: SearchFilters = {}
): Promise<SearchResult[]> {
  const limit = filters.limit || DEFAULT_LIMIT;

  try {
    // Run both searches in parallel
    const [semanticResults, keywordResults] = await Promise.all([
      searchBySemantic(query, { ...filters, limit: limit * 2 }),
      searchByKeyword(query, { ...filters, limit: limit * 2 }),
    ]);

    // Merge results with boosted scores for duplicates
    const resultMap = new Map<string, SearchResult>();

    // Add semantic results first (weighted 0.7)
    for (const result of semanticResults) {
      resultMap.set(result.knowledgeCardId, {
        ...result,
        score: result.score * 0.7,
      });
    }

    // Add/boost keyword results (weighted 0.3)
    for (const result of keywordResults) {
      const existing = resultMap.get(result.knowledgeCardId);
      if (existing) {
        // Boost score for items found in both
        existing.score = Math.min(1.0, existing.score + 0.3);
      } else {
        resultMap.set(result.knowledgeCardId, {
          ...result,
          score: result.score * 0.3,
        });
      }
    }

    // Sort by score descending and limit
    const merged = Array.from(resultMap.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return merged;
  } catch (error) {
    console.error('Hybrid search error:', error);
    return [];
  }
}

/**
 * Find similar knowledge cards for duplicate detection
 * Used before calling OpenAI to suggest existing answers
 */
export async function findSimilarForDuplicate(
  questionText: string,
  userId: string
): Promise<DuplicateSuggestion[]> {
  try {
    // 1. Create embedding for the question
    const queryEmbedding = await createEmbedding(questionText);

    // 2. Search with high threshold for duplicates
    const results = await searchKnowledgeCardsBySemantic(queryEmbedding, {
      visibility: 'team', // Only search team-visible cards
      limit: DUPLICATE_LIMIT,
      threshold: DUPLICATE_THRESHOLD,
    });

    // 3. Map to suggestion format
    return results.map((result) => ({
      knowledgeCardId: result.card.id,
      title: result.card.title,
      summary: result.card.summary,
      score: result.similarity,
    }));
  } catch (error) {
    // Log but don't fail - duplicate detection is optional
    console.error('Duplicate detection error:', error);
    return [];
  }
}

/**
 * Main search function that routes to appropriate method based on mode
 */
export async function search(
  query: string,
  mode: 'hybrid' | 'semantic' | 'keyword' = 'hybrid',
  filters: SearchFilters = {}
): Promise<SearchResult[]> {
  switch (mode) {
    case 'semantic':
      return searchBySemantic(query, filters);
    case 'keyword':
      return searchByKeyword(query, filters);
    case 'hybrid':
    default:
      return searchHybrid(query, filters);
  }
}
