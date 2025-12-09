import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Types
export interface User {
  id: string;
  email: string;
  display_name: string | null;
  role: 'member' | 'admin';
  created_at: string;
  updated_at: string;
}

export interface Conversation {
  id: string;
  user_id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  user_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  model: string | null;
  token_count: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface KnowledgeCard {
  id: string;
  source_message_id: string | null;
  user_id: string;
  title: string;
  summary: string;
  main_answer: string | null;
  tags: string[];
  visibility: 'team' | 'private';
  importance_score: number;
  created_at: string;
  updated_at: string;
}

export interface Embedding {
  id: string;
  reference_type: 'message' | 'knowledge_card';
  reference_id: string;
  embedding: number[];
  created_at: string;
}

// Supabase client singleton
let supabase: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient {
  if (supabase) return supabase;

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
  }

  supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return supabase;
}

// Database operations

/**
 * Create a new conversation for a user
 */
export async function createConversation(
  userId: string,
  title?: string
): Promise<Conversation> {
  const client = getSupabaseClient();

  const { data, error } = await client
    .from('conversations')
    .insert({
      user_id: userId,
      title: title || null,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create conversation: ${error.message}`);
  }

  return data as Conversation;
}

/**
 * Get a conversation by ID (with ownership check)
 */
export async function getConversation(
  conversationId: string,
  userId: string
): Promise<Conversation | null> {
  const client = getSupabaseClient();

  const { data, error } = await client
    .from('conversations')
    .select()
    .eq('id', conversationId)
    .eq('user_id', userId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null; // Not found
    }
    throw new Error(`Failed to get conversation: ${error.message}`);
  }

  return data as Conversation;
}

/**
 * Update conversation's updated_at timestamp
 */
export async function touchConversation(conversationId: string): Promise<void> {
  const client = getSupabaseClient();

  const { error } = await client
    .from('conversations')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', conversationId);

  if (error) {
    throw new Error(`Failed to update conversation: ${error.message}`);
  }
}

/**
 * Insert a user message
 */
export async function insertUserMessage(
  conversationId: string,
  userId: string,
  content: string,
  metadata?: Record<string, unknown>
): Promise<Message> {
  const client = getSupabaseClient();

  const { data, error } = await client
    .from('messages')
    .insert({
      conversation_id: conversationId,
      user_id: userId,
      role: 'user',
      content,
      metadata: metadata || { source: 'proxy' },
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to insert user message: ${error.message}`);
  }

  return data as Message;
}

/**
 * Insert an assistant message
 */
export async function insertAssistantMessage(
  conversationId: string,
  userId: string,
  content: string,
  model: string,
  tokenCount?: number,
  metadata?: Record<string, unknown>
): Promise<Message> {
  const client = getSupabaseClient();

  const { data, error } = await client
    .from('messages')
    .insert({
      conversation_id: conversationId,
      user_id: userId,
      role: 'assistant',
      content,
      model,
      token_count: tokenCount || null,
      metadata: metadata || {},
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to insert assistant message: ${error.message}`);
  }

  return data as Message;
}

/**
 * Get user by ID (for auth verification)
 */
export async function getUserById(userId: string): Promise<User | null> {
  const client = getSupabaseClient();

  const { data, error } = await client
    .from('users')
    .select()
    .eq('id', userId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    throw new Error(`Failed to get user: ${error.message}`);
  }

  return data as User;
}

/**
 * Create a test user (for development only)
 */
export async function createTestUser(email: string, displayName?: string): Promise<User> {
  const client = getSupabaseClient();

  const { data, error } = await client
    .from('users')
    .insert({
      email,
      display_name: displayName || null,
      role: 'member',
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create test user: ${error.message}`);
  }

  return data as User;
}

// ============================================
// Knowledge Pipeline Operations
// ============================================

/**
 * Get a message by ID
 */
export async function getMessageById(messageId: string): Promise<Message | null> {
  const client = getSupabaseClient();

  const { data, error } = await client
    .from('messages')
    .select()
    .eq('id', messageId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    throw new Error(`Failed to get message: ${error.message}`);
  }

  return data as Message;
}

/**
 * Get the user message that precedes an assistant message in a conversation
 */
export async function getPrecedingUserMessage(
  conversationId: string,
  assistantCreatedAt: string
): Promise<Message | null> {
  const client = getSupabaseClient();

  const { data, error } = await client
    .from('messages')
    .select()
    .eq('conversation_id', conversationId)
    .eq('role', 'user')
    .lt('created_at', assistantCreatedAt)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    throw new Error(`Failed to get preceding user message: ${error.message}`);
  }

  return data as Message;
}

/**
 * Insert a knowledge card
 */
export async function insertKnowledgeCard(
  sourceMessageId: string,
  userId: string,
  title: string,
  summary: string,
  mainAnswer: string,
  tags: string[],
  visibility: 'team' | 'private' = 'team',
  importanceScore: number = 0
): Promise<KnowledgeCard> {
  const client = getSupabaseClient();

  const { data, error } = await client
    .from('knowledge_cards')
    .insert({
      source_message_id: sourceMessageId,
      user_id: userId,
      title,
      summary,
      main_answer: mainAnswer,
      tags,
      visibility,
      importance_score: importanceScore,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to insert knowledge card: ${error.message}`);
  }

  return data as KnowledgeCard;
}

/**
 * Insert an embedding
 */
export async function insertEmbedding(
  referenceType: 'message' | 'knowledge_card',
  referenceId: string,
  embedding: number[]
): Promise<Embedding> {
  const client = getSupabaseClient();

  // Convert array to pgvector format string
  const vectorString = `[${embedding.join(',')}]`;

  const { data, error } = await client
    .from('embeddings')
    .insert({
      reference_type: referenceType,
      reference_id: referenceId,
      embedding: vectorString,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to insert embedding: ${error.message}`);
  }

  return data as Embedding;
}

// ============================================
// Search Operations
// ============================================

export interface SearchFiltersDB {
  tag?: string;
  userId?: string;
  visibility?: 'team' | 'private' | 'all';
  limit?: number;
  threshold?: number;
}

export interface SemanticSearchResult {
  card: KnowledgeCard;
  similarity: number;
}

/**
 * Search knowledge cards by keyword (ILIKE on title and summary)
 */
export async function searchKnowledgeCardsByKeyword(
  query: string,
  filters: SearchFiltersDB = {}
): Promise<KnowledgeCard[]> {
  const client = getSupabaseClient();
  const limit = filters.limit || 10;

  let queryBuilder = client
    .from('knowledge_cards')
    .select()
    .or(`title.ilike.%${query}%,summary.ilike.%${query}%`);

  // Apply filters
  if (filters.visibility && filters.visibility !== 'all') {
    queryBuilder = queryBuilder.eq('visibility', filters.visibility);
  }

  if (filters.userId) {
    queryBuilder = queryBuilder.eq('user_id', filters.userId);
  }

  if (filters.tag) {
    queryBuilder = queryBuilder.contains('tags', [filters.tag]);
  }

  queryBuilder = queryBuilder
    .order('importance_score', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit);

  const { data, error } = await queryBuilder;

  if (error) {
    throw new Error(`Failed to search knowledge cards: ${error.message}`);
  }

  return (data || []) as KnowledgeCard[];
}

/**
 * Search knowledge cards by semantic similarity using embeddings
 * Uses the search_similar_embeddings() Postgres function
 */
export async function searchKnowledgeCardsBySemantic(
  queryEmbedding: number[],
  filters: SearchFiltersDB = {}
): Promise<SemanticSearchResult[]> {
  const client = getSupabaseClient();
  const limit = filters.limit || 10;
  const threshold = filters.threshold || 0.8;

  // Convert embedding to pgvector format
  const vectorString = `[${queryEmbedding.join(',')}]`;

  // Call the search_similar_embeddings function
  const { data: embeddingResults, error: embeddingError } = await client.rpc(
    'search_similar_embeddings',
    {
      query_embedding: vectorString,
      match_threshold: threshold,
      match_count: limit,
      ref_type: 'knowledge_card',
    }
  );

  if (embeddingError) {
    throw new Error(`Failed to search embeddings: ${embeddingError.message}`);
  }

  if (!embeddingResults || embeddingResults.length === 0) {
    return [];
  }

  // Get the knowledge card IDs
  const cardIds = embeddingResults.map(
    (r: { reference_id: string }) => r.reference_id
  );

  // Fetch the knowledge cards
  let cardsQuery = client
    .from('knowledge_cards')
    .select()
    .in('id', cardIds);

  // Apply visibility filter
  if (filters.visibility && filters.visibility !== 'all') {
    cardsQuery = cardsQuery.eq('visibility', filters.visibility);
  }

  if (filters.userId) {
    cardsQuery = cardsQuery.eq('user_id', filters.userId);
  }

  if (filters.tag) {
    cardsQuery = cardsQuery.contains('tags', [filters.tag]);
  }

  const { data: cards, error: cardsError } = await cardsQuery;

  if (cardsError) {
    throw new Error(`Failed to fetch knowledge cards: ${cardsError.message}`);
  }

  // Create a map for quick lookup
  const cardMap = new Map<string, KnowledgeCard>();
  for (const card of cards || []) {
    cardMap.set(card.id, card as KnowledgeCard);
  }

  // Combine results with similarity scores, preserving order
  const results: SemanticSearchResult[] = [];
  for (const embResult of embeddingResults) {
    const card = cardMap.get(embResult.reference_id);
    if (card) {
      results.push({
        card,
        similarity: embResult.similarity,
      });
    }
  }

  return results;
}
