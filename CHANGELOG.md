# CHANGELOG - Team AI Proxy

## STEP 1 - Database Schema (001_init.sql)

### Tables Created

| Table | Purpose |
|-------|---------|
| `users` | Internal team members with role-based access |
| `conversations` | Chat sessions grouped by user |
| `messages` | All chat messages (user/assistant/system) |
| `knowledge_cards` | Summarized knowledge units with tags |
| `embeddings` | Vector embeddings for semantic search |

### Indexes

- **users**: `idx_users_email` (btree)
- **conversations**: `idx_conversations_user_id` (btree)
- **messages**: `idx_messages_conversation_id`, `idx_messages_user_id`, `idx_messages_conversation_created` (btree)
- **knowledge_cards**: `idx_knowledge_cards_user_id`, `idx_knowledge_cards_source_message`, `idx_knowledge_cards_tags` (GIN), `idx_knowledge_cards_visibility` (btree)
- **embeddings**: `idx_embeddings_reference` (btree), `idx_embeddings_vector` (IVFFlat for cosine similarity)

### RLS Policies

- **users**: Select/update own profile only
- **conversations**: Full CRUD on own conversations only
- **messages**: Select/insert on messages in own conversations
- **knowledge_cards**: Team visibility readable by all, private by owner only; insert/update/delete by owner
- **embeddings**: Open for authenticated users (Phase 1)

### Helper Functions

- `update_updated_at_column()`: Auto-update `updated_at` on row changes
- `search_similar_embeddings()`: Semantic search with configurable threshold

### Extensions Required

- `uuid-ossp`: UUID generation
- `pgvector`: Vector storage and similarity search

### How to Run Migration

```bash
# Option 1: Supabase CLI
supabase db push

# Option 2: Direct psql
psql -h <host> -U <user> -d <database> -f supabase/migrations/001_init.sql

# Option 3: Supabase Dashboard
# Copy SQL content and run in SQL Editor
```

### Vector Dimension

- Using 1536 dimensions (OpenAI `text-embedding-3-small`)

---

## STEP 2 - API Proxy `/api/chat`

### Files Created

| File | Purpose |
|------|---------|
| `src/app/api/chat/route.ts` | Main API endpoint for chat proxy |
| `src/lib/db.ts` | Database helper (Supabase connection & operations) |
| `src/lib/openai.ts` | OpenAI API helper with error handling |
| `.env.example` | Environment variables template |

### API Endpoint

**POST** `/api/chat`

#### Request Headers
```
x-user-id: <uuid>  # User ID for authentication (placeholder)
```

#### Request Body
```json
{
  "conversationId": "uuid | null",
  "message": "string (required)",
  "model": "string | null",
  "metadata": {
    "client": "web | cli | other",
    "tags": ["optional", "strings"]
  }
}
```

#### Response (Success - 200)
```json
{
  "conversationId": "uuid",
  "assistantMessageId": "uuid",
  "userMessageId": "uuid",
  "content": "AI response content",
  "model": "gpt-4.1-mini",
  "createdAt": "ISO timestamp",
  "usage": {
    "promptTokens": number,
    "completionTokens": number,
    "totalTokens": number
  }
}
```

#### Response (Error)
```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message",
    "details": "optional"
  }
}
```

### Error Codes Handled

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `UNAUTHORIZED` | 401 | Missing user authentication |
| `INVALID_USER_ID` | 401 | Invalid UUID format |
| `USER_NOT_FOUND` | 401 | User doesn't exist in DB |
| `INVALID_JSON` | 400 | Malformed request body |
| `MISSING_MESSAGE` | 400 | Message field missing |
| `EMPTY_MESSAGE` | 400 | Empty message string |
| `INVALID_CONVERSATION_ID` | 400 | Invalid UUID format |
| `CONVERSATION_NOT_FOUND` | 403 | Conversation doesn't exist or access denied |
| `INVALID_API_KEY` | 500 | OpenAI key invalid |
| `RATE_LIMIT` | 429 | OpenAI rate limit |
| `TIMEOUT` | 504 | OpenAI request timeout |
| `AI_SERVICE_ERROR` | 502 | OpenAI unavailable |
| `INTERNAL_ERROR` | 500 | Unexpected server error |

### Database Operations

- `createConversation()` - Create new chat session
- `getConversation()` - Get conversation with ownership check
- `touchConversation()` - Update `updated_at` timestamp
- `insertUserMessage()` - Log user message
- `insertAssistantMessage()` - Log AI response
- `getUserById()` - Verify user exists

### How to Test

```bash
# 1. Setup environment
cp .env.example .env.local
# Edit .env.local with your keys

# 2. Start dev server
npm run dev

# 3. Create a test user in Supabase first, then:

# 4. Test new conversation
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -H "x-user-id: YOUR_USER_UUID" \
  -d '{"message": "What is Team AI Proxy?"}'

# 5. Test existing conversation
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -H "x-user-id: YOUR_USER_UUID" \
  -d '{"conversationId": "CONVERSATION_UUID", "message": "Tell me more"}'
```

### Dependencies Added

- `@supabase/supabase-js` - Supabase client
- `openai` - OpenAI SDK

### Configuration

Default model: `gpt-4.1-mini`
Request timeout: 30 seconds

---

## STEP 3 - Knowledge Pipeline

### Files Created

| File | Purpose |
|------|---------|
| `src/lib/knowledge/pipeline.ts` | Orchestrator - runs full knowledge extraction pipeline |
| `src/lib/knowledge/summarize.ts` | Summarizes Q&A pairs into knowledge cards using GPT |
| `src/lib/knowledge/embed.ts` | Creates 1536-dim embeddings using text-embedding-3-small |

### Files Updated

| File | Changes |
|------|---------|
| `src/lib/db.ts` | Added `KnowledgeCard`, `Embedding` types + insert functions |
| `src/app/api/chat/route.ts` | Integrated knowledge pipeline (fire-and-forget) |

### Pipeline Flow

```
/api/chat POST
    │
    ├── Insert user message
    ├── Call OpenAI Chat
    ├── Insert assistant message
    │
    └── runKnowledgePipelineAsync() ─── (non-blocking)
            │
            ├── Get assistant message from DB
            ├── Get preceding user message
            ├── summarizeQA() ──► GPT extracts:
            │                     • title (max 80 chars)
            │                     • summary (2-4 sentences)
            │                     • mainAnswer (standalone)
            │                     • tags (3-7 keywords)
            │
            ├── Insert knowledge_card
            │
            ├── createEmbedding() ──► text-embedding-3-small
            │
            └── Insert embedding (reference_type: knowledge_card)
```

### Knowledge Card Structure

```json
{
  "id": "uuid",
  "source_message_id": "uuid (assistant message)",
  "user_id": "uuid",
  "title": "Concise searchable title",
  "summary": "2-4 sentence summary",
  "main_answer": "Standalone answer text",
  "tags": ["ops", "process", "how-to"],
  "visibility": "team",
  "importance_score": 0
}
```

### Summarization Prompt

- Model: `gpt-4.1-mini`
- Temperature: 0.3 (stable output)
- Output format: JSON with structured fields
- Fallback: Creates basic card from raw content if GPT fails

### Embedding Configuration

- Model: `text-embedding-3-small`
- Dimension: 1536
- Input: `title + summary + mainAnswer` combined
- Stored in `embeddings` table with `reference_type = 'knowledge_card'`

### Error Handling

- Pipeline runs in fire-and-forget mode (doesn't block API response)
- Summarization failure: Falls back to basic card from raw Q&A
- Embedding failure: Knowledge card still saved, embedding skipped
- All errors logged internally, never exposed to user

### New Database Functions

- `getMessageById()` - Fetch single message
- `getPrecedingUserMessage()` - Get user message before assistant response
- `insertKnowledgeCard()` - Create new knowledge card
- `insertEmbedding()` - Store vector embedding

### How to Verify

```bash
# 1. Send a chat request
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -H "x-user-id: YOUR_USER_UUID" \
  -d '{"message": "What is the deployment process?"}'

# 2. Check knowledge_cards table in Supabase
# Should see new record with title, summary, tags

# 3. Check embeddings table
# Should see record with reference_type = 'knowledge_card'
# and embedding vector (1536 dimensions)
```

### Console Logs

```
Knowledge pipeline completed: card=<uuid>, embedding=<uuid>
# or if embedding fails:
Knowledge pipeline completed: card=<uuid>, embedding=failed
```

---

## STEP 4 - Search & Duplicate Detection

### Files Created

| File | Purpose |
|------|---------|
| `src/lib/knowledge/search.ts` | Search logic: keyword, semantic, hybrid, duplicate detection |
| `src/app/api/search/route.ts` | Search API endpoint |

### Files Updated

| File | Changes |
|------|---------|
| `src/lib/db.ts` | Added `searchKnowledgeCardsByKeyword()`, `searchKnowledgeCardsBySemantic()` |
| `src/app/api/chat/route.ts` | Added duplicate detection, returns `similarResults` |

### Search API `/api/search`

**POST** `/api/search`

#### Request
```json
{
  "query": "how to deploy the application",
  "mode": "hybrid | semantic | keyword",
  "filters": {
    "tag": "optional tag filter",
    "userId": "optional user uuid",
    "visibility": "team | private | all",
    "limit": 10
  }
}
```

#### Response
```json
{
  "results": [
    {
      "knowledgeCardId": "uuid",
      "title": "Application Deployment Process",
      "summary": "Step-by-step guide...",
      "mainAnswer": "Full answer text...",
      "tags": ["deployment", "ops"],
      "score": 0.92,
      "createdAt": "2024-01-15T10:30:00Z"
    }
  ]
}
```

### Search Modes

| Mode | Description | Use Case |
|------|-------------|----------|
| `semantic` | Uses embeddings + cosine similarity | Find conceptually similar content |
| `keyword` | ILIKE on title/summary | Exact phrase matching |
| `hybrid` | Combines both (0.7 semantic + 0.3 keyword) | Best general-purpose search |

### Duplicate Detection

Integrated into `/api/chat`:

1. After user message is inserted
2. Before OpenAI is called
3. Creates embedding for the question
4. Searches for similar knowledge cards (threshold: 0.80)
5. Returns matches in `similarResults` field

#### Updated Chat Response
```json
{
  "conversationId": "uuid",
  "assistantMessageId": "uuid",
  "userMessageId": "uuid",
  "content": "AI response...",
  "model": "gpt-4.1-mini",
  "createdAt": "...",
  "usage": { ... },
  "similarResults": [
    {
      "knowledgeCardId": "uuid",
      "title": "Similar question from last week",
      "summary": "Brief summary...",
      "score": 0.89
    }
  ]
}
```

### Configuration

| Setting | Value | Location |
|---------|-------|----------|
| Duplicate threshold | 0.80 | `search.ts` |
| Duplicate limit | 5 | `search.ts` |
| Search default limit | 10 | `search.ts` |
| Semantic threshold (search) | 0.50 | `search.ts` |

### Database Functions Used

- `search_similar_embeddings()` - Postgres function for vector search
- Returns: `{ id, reference_type, reference_id, similarity }`

### Error Handling

- Search errors: Return empty results, don't fail request
- Duplicate detection errors: Log and continue with empty `similarResults`
- Invalid filters: Return 400 with specific error message

### How to Test

#### Test Search API
```bash
# Semantic search
curl -X POST http://localhost:3000/api/search \
  -H "Content-Type: application/json" \
  -H "x-user-id: YOUR_USER_UUID" \
  -d '{"query": "deployment process", "mode": "semantic"}'

# Keyword search
curl -X POST http://localhost:3000/api/search \
  -H "Content-Type: application/json" \
  -H "x-user-id: YOUR_USER_UUID" \
  -d '{"query": "deploy", "mode": "keyword"}'

# Hybrid with filters
curl -X POST http://localhost:3000/api/search \
  -H "Content-Type: application/json" \
  -H "x-user-id: YOUR_USER_UUID" \
  -d '{"query": "error handling", "mode": "hybrid", "filters": {"limit": 5}}'
```

#### Test Duplicate Detection
```bash
# 1. First, ask a question to create knowledge
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -H "x-user-id: YOUR_USER_UUID" \
  -d '{"message": "What is the deployment process?"}'

# 2. Ask a similar question
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -H "x-user-id: YOUR_USER_UUID" \
  -d '{"message": "How do I deploy the app?"}'

# Check response for similarResults with score > 0.80
```

### New Database Queries

- `searchKnowledgeCardsByKeyword()` - ILIKE search with filters
- `searchKnowledgeCardsBySemantic()` - Vector similarity via RPC

---

## STEP 5 - Team Chat UI & Search UI

### Files Created

#### Layout Components
| File | Purpose |
|------|---------|
| `src/components/layout/AppShell.tsx` | Main app wrapper with sidebar |
| `src/components/layout/Sidebar.tsx` | Navigation sidebar |
| `src/components/layout/Topbar.tsx` | Page header with title |

#### Chat Components
| File | Purpose |
|------|---------|
| `src/components/chat/MessageList.tsx` | Display chat messages with empty state |
| `src/components/chat/MessageInput.tsx` | Text input with send button |
| `src/components/chat/SimilarResultsPanel.tsx` | Show duplicate detection results |

#### Search Components
| File | Purpose |
|------|---------|
| `src/components/search/SearchBar.tsx` | Search input field |
| `src/components/search/SearchFilters.tsx` | Mode and limit filters |
| `src/components/search/SearchResultCard.tsx` | Knowledge card result display |

#### Pages
| File | Purpose |
|------|---------|
| `src/app/page.tsx` | Homepage with navigation to chat/search |
| `src/app/chat/page.tsx` | Team chat interface |
| `src/app/search/page.tsx` | Knowledge search interface |
| `src/app/layout.tsx` | Updated with AppShell wrapper |

### Design System

**Colors (Corporate)**
- Primary: `#2563EB` (blue-600)
- Background: `#F8FAFC` (slate-50)
- Text: `#0F172A` (slate-900)
- Border: `#E2E8F0` (slate-200)

**Typography**
- Font: Inter (Google Fonts)
- Weights: 400 (regular), 500 (medium), 600 (semibold)

**Layout**
- Sidebar width: 240px (fixed)
- Content: flexible
- Similar panel: 320px (desktop only)

### Chat Page Features

1. **Message Display**
   - User messages: blue bubble, right-aligned
   - Assistant messages: white card, left-aligned
   - Loading indicator: bouncing dots

2. **Input Area**
   - Auto-resize textarea
   - Enter to send, Shift+Enter for newline
   - Disabled state during loading

3. **Similar Results Panel**
   - Shows duplicate detection results
   - Score badges (green >90%, blue >80%)
   - Click to view details

4. **Conversation Management**
   - Auto-create on first message
   - New conversation button
   - Conversation ID in header

### Search Page Features

1. **Search Bar**
   - Full-width input
   - Enter or button to search

2. **Filters**
   - Mode: Hybrid / Semantic / Keyword
   - Limit: 5 / 10 / 20 / 50 results

3. **Result Cards**
   - Title with score badge
   - Summary (3 lines truncated)
   - Tags (max 4 shown)
   - Created date

4. **States**
   - Empty: prompt to search
   - Loading: skeleton cards
   - No results: friendly message
   - Results: scrollable list

### Development Notes

**Temporary Auth**
```typescript
const DEV_USER_ID = '00000000-0000-0000-0000-000000000001';
```
Replace with Supabase Auth in production.

### How to Test

```bash
# 1. Start development server
npm run dev

# 2. Create test user in Supabase (if not exists)
# INSERT INTO users (id, email) VALUES ('00000000-0000-0000-0000-000000000001', 'test@example.com');

# 3. Open browser
# Homepage: http://localhost:3000
# Chat: http://localhost:3000/chat
# Search: http://localhost:3000/search

# 4. Test chat flow
# - Type a message and send
# - Verify AI response appears
# - Check Similar Results panel for duplicates

# 5. Test search flow
# - Enter a query
# - Try different modes
# - Click on results to view details
```

### Responsive Behavior

| Breakpoint | Layout |
|------------|--------|
| Desktop (lg+) | Sidebar + Content + Similar Panel |
| Tablet/Mobile | Sidebar + Content (Similar hidden) |

### Component Props

**MessageList**
- `messages: Message[]` - Array of chat messages

**MessageInput**
- `onSend: (message: string) => void`
- `disabled?: boolean`

**SimilarResultsPanel**
- `results: SimilarResult[]`
- `onResultClick?: (result) => void`

**SearchBar**
- `onSearch: (query: string) => void`
- `disabled?: boolean`

**SearchFilters**
- `mode: SearchMode`
- `onModeChange: (mode) => void`
- `limit: number`
- `onLimitChange: (limit) => void`

**SearchResultCard**
- `result: SearchResult`
- `onClick?: (result) => void`

---

## STEP 6 - UI Polish & Sales Demo Mode

### Files Created

| File | Purpose |
|------|---------|
| `src/lib/config.ts` | Centralized app configuration and DEMO_MODE flag |
| `supabase/seed/demo_seed.sql` | Sample demo data for presentations |

### Files Updated

| File | Changes |
|------|---------|
| `.env.example` | Added `NEXT_PUBLIC_DEMO_MODE` variable |
| `src/components/layout/Sidebar.tsx` | New branding, app name, demo badge |
| `src/components/layout/Topbar.tsx` | Demo mode badge, Vietnamese UI |
| `src/app/page.tsx` | Mini landing page with value proposition |
| `src/app/chat/page.tsx` | Vietnamese UI, sample questions integration |
| `src/app/search/page.tsx` | Vietnamese UI, improved empty states |
| `src/components/chat/MessageList.tsx` | Sample questions buttons, Vietnamese microcopy |
| `src/components/chat/MessageInput.tsx` | Initial message prop, Vietnamese placeholder |
| `src/components/chat/SimilarResultsPanel.tsx` | Vietnamese UI, improved empty state |
| `src/components/search/SearchBar.tsx` | Vietnamese UI |
| `src/components/search/SearchFilters.tsx` | Vietnamese labels |
| `src/components/search/SearchResultCard.tsx` | Vietnamese labels, locale formatting |

### Configuration (`src/lib/config.ts`)

```typescript
export const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';
export const DEMO_USER_ID = '00000000-0000-0000-0000-000000000001';

export const APP_CONFIG = {
  name: 'TeamMemory AI',
  tagline: 'Trí nhớ tập thể cho team của bạn',
  description: 'AI Assistant thông minh với Knowledge Base được chia sẻ...',
  features: [
    { title: 'AI Chat Thông Minh', description: '...', icon: 'chat' },
    { title: 'Knowledge Base Tự Động', description: '...', icon: 'database' },
    { title: 'Tìm Kiếm Ngữ Nghĩa', description: '...', icon: 'search' },
  ],
  sampleQuestions: [
    'Làm thế nào để deploy Next.js lên Vercel?',
    'Giải thích React Server Components',
    // ...
  ],
};
```

### Demo Mode Features

1. **Demo Badge**
   - Orange badge in Sidebar and Topbar when `DEMO_MODE=true`
   - Visual indicator for sales presentations

2. **No Auth Required**
   - Uses fixed `DEMO_USER_ID` when demo mode enabled
   - `getUserId()` helper function handles auth logic

3. **Vietnamese UI**
   - All user-facing text translated to Vietnamese
   - Date formatting with `vi-VN` locale

### Branding Update

- App Name: **TeamMemory AI**
- Tagline: "Trí nhớ tập thể cho team của bạn"
- Icon: Lightning bolt in blue-600 rounded box
- Footer: "v1.0 • Powered by OpenAI"

### Landing Page Features

1. **Hero Section**
   - App logo and name
   - Description with value proposition
   - CTA buttons: "Bắt Đầu Chat" / "Tìm Kiếm Kiến Thức"

2. **Features Grid**
   - AI Chat Thông Minh
   - Knowledge Base Tự Động
   - Tìm Kiếm Ngữ Nghĩa

3. **Value Proposition**
   - Tiết kiệm thời gian
   - Xây dựng kiến thức
   - Tìm kiếm thông minh

### Chat UI Improvements

1. **Empty State**
   - Welcome message in Vietnamese
   - Sample questions as clickable buttons
   - Value props: Tự động lưu, Tìm kiếm được, Chia sẻ với team

2. **Sample Questions**
   - Click to fill input field
   - 4 questions displayed from config
   - Styled as bordered cards

### Search UI Improvements

1. **Filters**
   - Mode labels: Kết hợp / Ngữ nghĩa / Từ khóa
   - Show labels: "X kết quả"

2. **Empty State**
   - Vietnamese instructions
   - Feature badges: Semantic Search, Tìm kiếm nhanh

3. **Results**
   - Score labels: Rất phù hợp / Phù hợp / Tương đối / Ít phù hợp

### Demo Seed Data

```sql
-- 1 demo user
-- 5 conversations with real Q&A about:
--   - Next.js deployment to Vercel
--   - React Server Components
--   - TypeScript best practices
--   - CI/CD with GitHub Actions
--   - PostgreSQL query optimization

-- 5 knowledge cards with proper tags
-- (Embeddings should be generated via application)
```

### Environment Variables

```bash
# .env.example
NEXT_PUBLIC_DEMO_MODE=true  # Enable demo mode
```

### How to Setup Demo

```bash
# 1. Enable demo mode
echo "NEXT_PUBLIC_DEMO_MODE=true" >> .env.local

# 2. Run migrations
psql -f supabase/migrations/001_init.sql

# 3. Load demo data
psql -f supabase/seed/demo_seed.sql

# 4. Start server
npm run dev

# 5. Generate embeddings for knowledge cards
# (Call /api/chat with demo questions or implement seed script)
```

### Demo Presentation Tips

1. **Start on Landing Page** - Show value proposition
2. **Demo Chat** - Use sample questions for consistent demo
3. **Show Similar Results** - Demonstrate duplicate detection
4. **Search Knowledge** - Show semantic search in action
5. **Point out Demo Badge** - Explain this is demo mode
