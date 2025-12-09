-- Demo Seed Data for TeamMemory AI
-- This script creates sample data for demo/sales presentations
-- Run after 001_init.sql migration

-- Demo User (matches DEMO_USER_ID in config)
INSERT INTO users (id, email, name, role, created_at)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'demo@teammemory.ai',
  'Demo User',
  'admin',
  NOW()
) ON CONFLICT (id) DO NOTHING;

-- Demo Conversations
INSERT INTO conversations (id, user_id, title, created_at, updated_at) VALUES
('11111111-1111-1111-1111-111111111101', '00000000-0000-0000-0000-000000000001', 'Hỏi về Next.js Deployment', NOW() - INTERVAL '7 days', NOW() - INTERVAL '7 days'),
('11111111-1111-1111-1111-111111111102', '00000000-0000-0000-0000-000000000001', 'React Server Components', NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days'),
('11111111-1111-1111-1111-111111111103', '00000000-0000-0000-0000-000000000001', 'TypeScript Best Practices', NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days'),
('11111111-1111-1111-1111-111111111104', '00000000-0000-0000-0000-000000000001', 'CI/CD với GitHub Actions', NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days'),
('11111111-1111-1111-1111-111111111105', '00000000-0000-0000-0000-000000000001', 'PostgreSQL Query Optimization', NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day')
ON CONFLICT (id) DO NOTHING;

-- Demo Messages
INSERT INTO messages (id, conversation_id, role, content, created_at) VALUES
-- Conversation 1: Next.js Deployment
('22222222-2222-2222-2222-222222222201', '11111111-1111-1111-1111-111111111101', 'user', 'Làm thế nào để deploy Next.js lên Vercel?', NOW() - INTERVAL '7 days'),
('22222222-2222-2222-2222-222222222202', '11111111-1111-1111-1111-111111111101', 'assistant', 'Để deploy Next.js lên Vercel, bạn có thể làm theo các bước sau:

1. **Kết nối repository**:
   - Truy cập vercel.com và đăng nhập
   - Click "New Project" và import repo từ GitHub/GitLab/Bitbucket

2. **Cấu hình project**:
   - Vercel tự động detect Next.js và cấu hình build settings
   - Kiểm tra environment variables nếu cần

3. **Deploy**:
   - Click Deploy và chờ build hoàn tất
   - Vercel tự động tạo preview URL cho mỗi branch

4. **Auto-deploy**:
   - Mỗi push lên main branch sẽ trigger production deploy
   - PR tạo preview deployment riêng

**Tips**:
- Sử dụng `vercel.json` để custom cấu hình
- Dùng Edge Functions cho better performance
- Enable ISR (Incremental Static Regeneration) cho content updates', NOW() - INTERVAL '7 days'),

-- Conversation 2: React Server Components
('22222222-2222-2222-2222-222222222203', '11111111-1111-1111-1111-111111111102', 'user', 'Giải thích React Server Components và khi nào nên dùng?', NOW() - INTERVAL '5 days'),
('22222222-2222-2222-2222-222222222204', '11111111-1111-1111-1111-111111111102', 'assistant', 'React Server Components (RSC) là tính năng mới cho phép render components trên server.

**Lợi ích chính:**
1. **Zero bundle size**: Server components không gửi JS xuống client
2. **Direct database access**: Query trực tiếp từ component
3. **Better security**: API keys và secrets an toàn trên server
4. **Improved performance**: Streaming HTML và selective hydration

**Khi nào dùng Server Components:**
- Fetch data từ database/API
- Components chỉ hiển thị, không có interactivity
- Nội dung tĩnh hoặc ít thay đổi
- Components cần access backend resources

**Khi nào dùng Client Components ("use client"):**
- Cần useState, useEffect
- Event handlers (onClick, onChange)
- Browser APIs (localStorage, geolocation)
- Custom hooks với client-side logic

**Pattern phổ biến:**
```tsx
// Server Component (default)
async function ProductList() {
  const products = await db.products.findMany();
  return <ProductGrid products={products} />;
}

// Client Component
"use client"
function AddToCartButton({ productId }) {
  const [loading, setLoading] = useState(false);
  return <button onClick={...}>Add to Cart</button>;
}
```', NOW() - INTERVAL '5 days'),

-- Conversation 3: TypeScript
('22222222-2222-2222-2222-222222222205', '11111111-1111-1111-1111-111111111103', 'user', 'Best practices cho TypeScript trong dự án lớn?', NOW() - INTERVAL '3 days'),
('22222222-2222-2222-2222-222222222206', '11111111-1111-1111-1111-111111111103', 'assistant', 'Dưới đây là các best practices quan trọng cho TypeScript trong dự án lớn:

**1. Strict Mode**
```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true
  }
}
```

**2. Tổ chức Types**
- Tạo folder `types/` hoặc `@types/` riêng
- Dùng `*.d.ts` cho type declarations
- Export từ `index.ts` để import gọn

**3. Prefer interfaces over types**
- Interface cho object shapes
- Type cho unions, intersections, utility types

**4. Utility Types**
```typescript
// Dùng built-in utility types
type Props = Readonly<{ name: string }>;
type Optional = Partial<User>;
type Required = Required<Config>;
type Picked = Pick<User, ''id'' | ''name''>;
```

**5. Discriminated Unions**
```typescript
type Result<T> =
  | { success: true; data: T }
  | { success: false; error: Error };
```

**6. Generic Constraints**
```typescript
function getProperty<T, K extends keyof T>(obj: T, key: K) {
  return obj[key];
}
```

**7. Avoid any**
- Dùng `unknown` thay vì `any`
- Type guards cho narrowing
- `as const` cho literal types', NOW() - INTERVAL '3 days'),

-- Conversation 4: CI/CD
('22222222-2222-2222-2222-222222222207', '11111111-1111-1111-1111-111111111104', 'user', 'Cách setup CI/CD với GitHub Actions cho Next.js?', NOW() - INTERVAL '2 days'),
('22222222-2222-2222-2222-222222222208', '11111111-1111-1111-1111-111111111104', 'assistant', 'Đây là workflow CI/CD hoàn chỉnh cho Next.js với GitHub Actions:

**1. File `.github/workflows/ci.yml`:**
```yaml
name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ''20''
          cache: ''npm''

      - name: Install dependencies
        run: npm ci

      - name: Type check
        run: npm run type-check

      - name: Lint
        run: npm run lint

      - name: Run tests
        run: npm run test

      - name: Build
        run: npm run build
```

**2. Thêm scripts vào package.json:**
```json
{
  "scripts": {
    "type-check": "tsc --noEmit",
    "lint": "eslint . --ext .ts,.tsx",
    "test": "jest",
    "build": "next build"
  }
}
```

**3. Deploy tự động với Vercel:**
- Connect repo với Vercel
- Push lên main = auto production deploy
- PR = preview deployment

**4. Environment Secrets:**
- Settings → Secrets → Actions
- Thêm `VERCEL_TOKEN`, `DATABASE_URL`, etc.', NOW() - INTERVAL '2 days'),

-- Conversation 5: PostgreSQL
('22222222-2222-2222-2222-222222222209', '11111111-1111-1111-1111-111111111105', 'user', 'Làm sao tối ưu performance cho PostgreSQL queries?', NOW() - INTERVAL '1 day'),
('22222222-2222-2222-2222-222222222210', '11111111-1111-1111-1111-111111111105', 'assistant', 'Dưới đây là các kỹ thuật tối ưu PostgreSQL queries:

**1. Indexing Strategy**
```sql
-- B-tree index cho equality và range queries
CREATE INDEX idx_users_email ON users(email);

-- Partial index cho filtered queries
CREATE INDEX idx_active_users ON users(email)
WHERE status = ''active'';

-- Composite index cho multi-column
CREATE INDEX idx_orders_user_date ON orders(user_id, created_at DESC);
```

**2. Query Analysis**
```sql
EXPLAIN ANALYZE SELECT * FROM users WHERE email = ''test@example.com'';
-- Xem execution plan và actual time
```

**3. Avoid N+1 Queries**
```sql
-- Bad: Multiple queries
SELECT * FROM posts WHERE user_id = 1;
SELECT * FROM posts WHERE user_id = 2;

-- Good: Single query with JOIN
SELECT p.*, u.name
FROM posts p
JOIN users u ON p.user_id = u.id;
```

**4. Connection Pooling**
- Sử dụng PgBouncer hoặc Supabase pooler
- Limit max connections

**5. Pagination với Cursor**
```sql
-- Thay vì OFFSET (slow với large data)
SELECT * FROM posts WHERE id > $cursor ORDER BY id LIMIT 20;
```

**6. Vacuum và Analyze**
```sql
VACUUM ANALYZE table_name;
-- Hoặc enable autovacuum
```

**7. pg_stat_statements**
```sql
SELECT query, calls, mean_time
FROM pg_stat_statements
ORDER BY mean_time DESC LIMIT 10;
```', NOW() - INTERVAL '1 day')
ON CONFLICT (id) DO NOTHING;

-- Demo Knowledge Cards
INSERT INTO knowledge_cards (id, source_conversation_id, source_message_id, title, summary, main_answer, tags, quality_score, status, created_at) VALUES
('33333333-3333-3333-3333-333333333301', '11111111-1111-1111-1111-111111111101', '22222222-2222-2222-2222-222222222202',
 'Deploy Next.js lên Vercel',
 'Hướng dẫn chi tiết cách deploy ứng dụng Next.js lên Vercel, bao gồm kết nối repository, cấu hình project, và tự động deploy.',
 'Để deploy Next.js lên Vercel: 1) Kết nối repo từ GitHub/GitLab, 2) Vercel tự động detect cấu hình Next.js, 3) Click Deploy, 4) Mỗi push lên main sẽ auto-deploy. Tips: dùng vercel.json để custom config, enable Edge Functions và ISR.',
 ARRAY['nextjs', 'vercel', 'deployment', 'devops', 'hosting'],
 0.92, 'approved', NOW() - INTERVAL '7 days'),

('33333333-3333-3333-3333-333333333302', '11111111-1111-1111-1111-111111111102', '22222222-2222-2222-2222-222222222204',
 'React Server Components Explained',
 'Giải thích React Server Components (RSC), lợi ích và khi nào nên sử dụng so với Client Components.',
 'RSC render trên server với lợi ích: zero bundle size, direct DB access, better security. Dùng Server Components khi fetch data, hiển thị tĩnh. Dùng Client Components ("use client") khi cần useState, event handlers, browser APIs.',
 ARRAY['react', 'server-components', 'nextjs', 'performance', 'architecture'],
 0.95, 'approved', NOW() - INTERVAL '5 days'),

('33333333-3333-3333-3333-333333333303', '11111111-1111-1111-1111-111111111103', '22222222-2222-2222-2222-222222222206',
 'TypeScript Best Practices cho Dự Án Lớn',
 'Tổng hợp best practices khi sử dụng TypeScript trong dự án enterprise, bao gồm strict mode, tổ chức types, utility types.',
 'Best practices: 1) Enable strict mode, 2) Tổ chức types trong folder riêng, 3) Prefer interfaces cho objects, 4) Dùng utility types (Partial, Pick, Readonly), 5) Discriminated unions, 6) Generic constraints, 7) Avoid any, dùng unknown.',
 ARRAY['typescript', 'best-practices', 'architecture', 'enterprise', 'coding-standards'],
 0.91, 'approved', NOW() - INTERVAL '3 days'),

('33333333-3333-3333-3333-333333333304', '11111111-1111-1111-1111-111111111104', '22222222-2222-2222-2222-222222222208',
 'CI/CD với GitHub Actions cho Next.js',
 'Hướng dẫn setup pipeline CI/CD hoàn chỉnh với GitHub Actions cho dự án Next.js, bao gồm test, lint, build và deploy.',
 'Setup CI/CD: 1) Tạo .github/workflows/ci.yml với jobs test/lint/build, 2) Thêm scripts type-check, lint, test vào package.json, 3) Connect Vercel cho auto-deploy, 4) Thêm secrets cho environment variables.',
 ARRAY['cicd', 'github-actions', 'nextjs', 'devops', 'automation'],
 0.89, 'approved', NOW() - INTERVAL '2 days'),

('33333333-3333-3333-3333-333333333305', '11111111-1111-1111-1111-111111111105', '22222222-2222-2222-2222-222222222210',
 'Tối Ưu PostgreSQL Query Performance',
 'Các kỹ thuật tối ưu hiệu năng queries PostgreSQL: indexing, query analysis, avoid N+1, connection pooling, cursor pagination.',
 'Tối ưu PG: 1) B-tree/partial/composite indexes, 2) EXPLAIN ANALYZE để phân tích, 3) JOIN thay vì N+1, 4) Connection pooling với PgBouncer, 5) Cursor pagination thay OFFSET, 6) VACUUM ANALYZE định kỳ, 7) pg_stat_statements để monitor.',
 ARRAY['postgresql', 'database', 'performance', 'optimization', 'sql'],
 0.94, 'approved', NOW() - INTERVAL '1 day')
ON CONFLICT (id) DO NOTHING;

-- Note: Embeddings would be generated by the application
-- This is a placeholder showing the structure
-- In production, run the knowledge pipeline to generate embeddings

-- Verify data was inserted
SELECT
  'Users' as table_name, COUNT(*) as count FROM users
UNION ALL
SELECT 'Conversations', COUNT(*) FROM conversations
UNION ALL
SELECT 'Messages', COUNT(*) FROM messages
UNION ALL
SELECT 'Knowledge Cards', COUNT(*) FROM knowledge_cards;
