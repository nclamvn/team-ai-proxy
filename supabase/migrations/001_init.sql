-- ============================================
-- TEAM AI PROXY - Database Schema
-- Migration: 001_init.sql
-- Description: Initial schema setup for Team AI Proxy
-- ============================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgvector";

-- ============================================
-- TABLE: users
-- Purpose: Store internal team members
-- ============================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    display_name TEXT,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'admin')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for email lookups
CREATE INDEX idx_users_email ON users(email);

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- TABLE: conversations
-- Purpose: Group messages into chat sessions
-- ============================================
CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for user's conversations
CREATE INDEX idx_conversations_user_id ON conversations(user_id);

CREATE TRIGGER trigger_conversations_updated_at
    BEFORE UPDATE ON conversations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- TABLE: messages
-- Purpose: Store all chat messages (user & assistant)
-- ============================================
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    model TEXT,
    token_count INTEGER,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for message queries
CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_messages_user_id ON messages(user_id);
CREATE INDEX idx_messages_conversation_created ON messages(conversation_id, created_at);

-- ============================================
-- TABLE: knowledge_cards
-- Purpose: Store summarized knowledge from conversations
-- ============================================
CREATE TABLE knowledge_cards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_message_id UUID UNIQUE REFERENCES messages(id) ON DELETE SET NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    summary TEXT NOT NULL,
    main_answer TEXT,
    tags TEXT[] DEFAULT '{}',
    visibility TEXT NOT NULL DEFAULT 'team' CHECK (visibility IN ('team', 'private')),
    importance_score NUMERIC(5,2) DEFAULT 0 CHECK (importance_score >= 0 AND importance_score <= 100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for knowledge_cards
CREATE INDEX idx_knowledge_cards_user_id ON knowledge_cards(user_id);
CREATE INDEX idx_knowledge_cards_source_message ON knowledge_cards(source_message_id);
CREATE INDEX idx_knowledge_cards_tags ON knowledge_cards USING GIN(tags);
CREATE INDEX idx_knowledge_cards_visibility ON knowledge_cards(visibility);

CREATE TRIGGER trigger_knowledge_cards_updated_at
    BEFORE UPDATE ON knowledge_cards
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- TABLE: embeddings
-- Purpose: Store vector embeddings for semantic search
-- Note: OpenAI text-embedding-3-small produces 1536-dimensional vectors
-- ============================================
CREATE TABLE embeddings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reference_type TEXT NOT NULL CHECK (reference_type IN ('message', 'knowledge_card')),
    reference_id UUID NOT NULL,
    embedding vector(1536) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for reference lookups
CREATE INDEX idx_embeddings_reference ON embeddings(reference_type, reference_id);

-- Vector index for similarity search (IVFFlat)
-- Note: Run this after inserting some data for better index quality
-- For small datasets, you can create it immediately
CREATE INDEX idx_embeddings_vector ON embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE embeddings ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS POLICIES: users
-- Users can read their own profile, admins can read all
-- ============================================
CREATE POLICY users_select_own ON users
    FOR SELECT
    USING (id = auth.uid() OR EXISTS (
        SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
    ));

CREATE POLICY users_update_own ON users
    FOR UPDATE
    USING (id = auth.uid());

-- ============================================
-- RLS POLICIES: conversations
-- Users can only access their own conversations
-- ============================================
CREATE POLICY conversations_select_own ON conversations
    FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY conversations_insert_own ON conversations
    FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY conversations_update_own ON conversations
    FOR UPDATE
    USING (user_id = auth.uid());

CREATE POLICY conversations_delete_own ON conversations
    FOR DELETE
    USING (user_id = auth.uid());

-- ============================================
-- RLS POLICIES: messages
-- Users can only access messages in their own conversations
-- ============================================
CREATE POLICY messages_select_own ON messages
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM conversations
            WHERE conversations.id = messages.conversation_id
            AND conversations.user_id = auth.uid()
        )
    );

CREATE POLICY messages_insert_own ON messages
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM conversations
            WHERE conversations.id = messages.conversation_id
            AND conversations.user_id = auth.uid()
        )
    );

-- ============================================
-- RLS POLICIES: knowledge_cards
-- Team visibility: all authenticated users can read
-- Private: only owner can read
-- Only owner can insert/update
-- ============================================
CREATE POLICY knowledge_cards_select_team ON knowledge_cards
    FOR SELECT
    USING (
        visibility = 'team' OR user_id = auth.uid()
    );

CREATE POLICY knowledge_cards_insert_own ON knowledge_cards
    FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY knowledge_cards_update_own ON knowledge_cards
    FOR UPDATE
    USING (user_id = auth.uid());

CREATE POLICY knowledge_cards_delete_own ON knowledge_cards
    FOR DELETE
    USING (user_id = auth.uid());

-- ============================================
-- RLS POLICIES: embeddings
-- Phase 1: Open for authenticated users (relies on backend logic)
-- ============================================
CREATE POLICY embeddings_select_all ON embeddings
    FOR SELECT
    USING (true);

CREATE POLICY embeddings_insert_all ON embeddings
    FOR INSERT
    WITH CHECK (true);

-- ============================================
-- HELPER FUNCTION: Similarity search
-- ============================================
CREATE OR REPLACE FUNCTION search_similar_embeddings(
    query_embedding vector(1536),
    match_threshold FLOAT DEFAULT 0.85,
    match_count INT DEFAULT 5,
    ref_type TEXT DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    reference_type TEXT,
    reference_id UUID,
    similarity FLOAT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        e.id,
        e.reference_type,
        e.reference_id,
        1 - (e.embedding <=> query_embedding) AS similarity
    FROM embeddings e
    WHERE (ref_type IS NULL OR e.reference_type = ref_type)
    AND 1 - (e.embedding <=> query_embedding) > match_threshold
    ORDER BY e.embedding <=> query_embedding
    LIMIT match_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- End of migration 001_init.sql
-- ============================================
