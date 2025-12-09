# Team AI Proxy (TeamMemory AI)

> Trí nhớ tập thể cho team của bạn - Biến các cuộc chat với AI thành kho tri thức chung

---

## 1. Team AI Proxy là gì?

Team AI Proxy là một lớp trung gian giữa **team nội bộ** và **OpenAI**:

* Mọi người **chat với AI qua webapp chung** (không chat rời rạc từng tài khoản).
* Mỗi câu hỏi – câu trả lời sẽ được:
  * Lưu vào **database**,
  * Tóm tắt thành **Knowledge Card**,
  * Tạo **Embedding** để **search ngữ nghĩa**,
  * Dùng cho **duplicate detection** → gợi ý "câu hỏi tương tự đã có trong kho tri thức".

**Kết quả:** Trí nhớ cá nhân (mỗi người 1 cửa sổ ChatGPT) được gom lại thành **trí nhớ chung của team**.

---

## 2. Cách setup & chạy demo

### 2.1. Yêu cầu

* Node.js >= 18
* Supabase project (URL + SERVICE_ROLE_KEY)
* OpenAI API key

### 2.2. Thiết lập environment

```bash
cd team-ai-proxy
cp .env.example .env.local
```

Điền các biến sau trong `.env.local`:

```env
OPENAI_API_KEY=sk-...
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_DEMO_MODE=true  # Bật chế độ demo
```

### 2.3. Chạy migrations & tạo user demo

**Chạy schema:**

```bash
# Option 1: Supabase CLI
supabase db push

# Option 2: Direct psql
psql -h <host> -U <user> -d <database> -f supabase/migrations/001_init.sql
```

**Tạo user demo:**

```sql
INSERT INTO users (id, email, name)
VALUES ('00000000-0000-0000-0000-000000000001', 'demo@teammemory.ai', 'Demo User');
```

**Load demo data (optional):**

```bash
psql -f supabase/seed/demo_seed.sql
```

### 2.4. Chạy server

```bash
npm install
npm run dev -- -p 3001
```

* Homepage: http://localhost:3001
* Chat: http://localhost:3001/chat
* Search: http://localhost:3001/search

---

## 3. Cách demo cho khách

### 3.1. Mở homepage (`/`)

Giải thích 10–20s:

* "Đây là bản demo **Team AI Proxy** – nó biến các cuộc chat với AI của team thành một **kho tri thức chung**."
* Chỉ vào 3 phần:
  * Vấn đề: mỗi người một tài khoản ChatGPT, hỏi trùng nhau.
  * Giải pháp: proxy + knowledge base.
  * Cách hoạt động: Chat → Lưu → Tìm lại.

**CTA:** Bấm "Bắt Đầu Chat" → `/chat`.

### 3.2. Trang Chat (`/chat`)

Flow demo:

1. Gõ một câu kiểu "Hãy viết quy trình xử lý khi đơn hàng bị giao chậm cho khách trong team vận hành."
2. Bấm gửi:
   * Thấy message user xuất hiện,
   * AI trả lời,
   * Bên phải / panel gợi ý (similarResults) có thể hiện lên với các câu hỏi tương tự.
3. Giải thích:
   * "Mỗi lần anh em chat như vậy, hệ thống sẽ:
     * Lưu toàn bộ hội thoại,
     * Tự tóm tắt thành 1 knowledge card,
     * Đưa vào kho tri thức team,
     * Và lần sau có ai hỏi gần giống, panel 'Câu Trả Lời Tương Tự' sẽ gợi ý."

### 3.3. Trang Search (`/search`)

Flow:

1. Gõ từ khóa liên quan đến những gì vừa hỏi (hoặc data demo đã seed).
2. Chọn mode:
   * `Ngữ nghĩa` để nhấn mạnh search ngữ nghĩa.
3. Cho khách xem:
   * Kết quả trả về: title, summary, tags.
   * Giải thích: "Đây là những **mẩu tri thức đã được rút gọn** từ các cuộc chat thật trong team."

**Kết luận:**

> "Team không mất công hỏi lại AI, người mới vào chỉ cần xem kho tri thức là hiểu những câu team đã giải."

---

## 4. Hướng dẫn sử dụng nội bộ

### 4.1. Cài xong → dùng như thế nào?

* Trong giai đoạn nội bộ:
  * Mỗi thành viên được gán 1 `user.id`.
  * Tất cả login (hoặc gắn header) để chat qua `/chat`.
  * Toàn bộ Q&A sẽ nằm trong `messages`, `knowledge_cards`, `embeddings`.

### 4.2. Quy ước dùng

* **Hỏi những thứ có tính "lặp lại"**:
  * Quy trình, template, guideline.
* Ít dùng cho câu "một lần cho vui", vì không đáng lưu vào base.
* Sau này có thể thêm tính năng:
  * Đánh dấu "Pin" / "Quan trọng".

---

## 5. Roadmap phát triển tiếp theo

### PHASE 2 – Product hóa cho nhiều team (Multi-tenant + BYOK)

**Mục tiêu:** từ bản demo nội bộ → thành sản phẩm cho nhiều khách khác nhau.

1. **Multi-team / Multi-tenant**
   * Thêm bảng `organizations` / `teams`.
   * Bảng `users` gắn `org_id`.
   * Tất cả queries filter theo `org_id`.
   * RLS: tách rõ dữ liệu giữa các tổ chức.

2. **Bring Your Own Key (BYOK)**
   * Thêm bảng `org_settings`:
     * `openai_api_key` (mã hóa).
   * API `/api/chat` đọc key theo `org_id`.
   * Lợi ích:
     * Mỗi khách **tự dùng key** → không ôm chi phí token.
     * Về pháp lý & privacy: *data & key thuộc về khách*.

3. **Basic Admin UI**
   * Trang `/admin`:
     * Tạo organization.
     * Thêm user vào org.
     * Cấu hình API key (chỉ admin).

### PHASE 3 – Trải nghiệm & giá trị sâu hơn

1. **Conversation History đầy đủ**
   * Trang `/chat` hiển thị list conversation bên sidebar.
   * Click vào một conversation để xem lại toàn bộ history.

2. **Knowledge Card Detail**
   * Click vào SearchResultCard để:
     * Mở modal "chi tiết tri thức":
       * Title, Summary, Main answer, Tags
       * Link tới conversation gốc.

3. **Tagging & Bookmark**
   * Cho phép: Sửa tags, Đánh dấu "Important".
   * Filter search theo tag "Important".

4. **Audit / Usage Overview**
   * Số câu hỏi đã được hỏi.
   * Số knowledge cards đã tạo.
   * Tỷ lệ "gặp lại" (similarResults match).

### PHASE 4 – Deploy & Go-to-market

1. **Deploy**
   * Frontend: Vercel (Next.js)
   * Database: Supabase
   * Domain: `team-memory.ai`

2. **Demo tuyến tính cho khách**
   * Script demo 10–15 phút.
   * Video màn hình: Homepage → Chat → Search.

3. **Pricing / Offer ban đầu**
   * Gói team nhỏ (5–10 người): 1–3 triệu / tháng / team.
   * Điều kiện: BYOK (họ dùng key OpenAI của họ).

---

## 6. Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 14+ (App Router), React, TailwindCSS |
| Backend | Next.js API Routes |
| Database | Supabase (PostgreSQL + pgvector) |
| AI | OpenAI GPT-4.1-mini, text-embedding-3-small |
| Auth | Supabase Auth (planned) |

---

## 7. Project Structure

```
team-ai-proxy/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── chat/route.ts      # Chat proxy API
│   │   │   └── search/route.ts    # Search API
│   │   ├── chat/page.tsx          # Chat UI
│   │   ├── search/page.tsx        # Search UI
│   │   ├── page.tsx               # Landing page
│   │   └── layout.tsx             # Root layout
│   ├── components/
│   │   ├── chat/                  # Chat components
│   │   ├── search/                # Search components
│   │   └── layout/                # Layout components
│   └── lib/
│       ├── config.ts              # App configuration
│       ├── db.ts                  # Database helpers
│       ├── openai.ts              # OpenAI helpers
│       └── knowledge/             # Knowledge pipeline
│           ├── pipeline.ts
│           ├── summarize.ts
│           ├── embed.ts
│           └── search.ts
├── supabase/
│   ├── migrations/
│   │   └── 001_init.sql           # Database schema
│   └── seed/
│       └── demo_seed.sql          # Demo data
├── .env.example
├── CHANGELOG.md                    # Detailed changelog
└── README.md                       # This file
```

---

## 8. API Reference

### POST `/api/chat`

Chat với AI và lưu vào knowledge base.

**Headers:**
```
x-user-id: <uuid>
```

**Request:**
```json
{
  "conversationId": "uuid | null",
  "message": "string"
}
```

**Response:**
```json
{
  "conversationId": "uuid",
  "assistantMessageId": "uuid",
  "userMessageId": "uuid",
  "content": "AI response",
  "model": "gpt-4.1-mini",
  "createdAt": "ISO timestamp",
  "usage": { ... },
  "similarResults": [
    {
      "knowledgeCardId": "uuid",
      "title": "string",
      "summary": "string",
      "score": 0.89
    }
  ]
}
```

### POST `/api/search`

Tìm kiếm trong knowledge base.

**Request:**
```json
{
  "query": "string",
  "mode": "hybrid | semantic | keyword",
  "filters": {
    "limit": 10
  }
}
```

**Response:**
```json
{
  "results": [
    {
      "knowledgeCardId": "uuid",
      "title": "string",
      "summary": "string",
      "mainAnswer": "string",
      "tags": ["tag1", "tag2"],
      "score": 0.92,
      "createdAt": "ISO timestamp"
    }
  ]
}
```

---

## 9. License

Private - All rights reserved.

---

## 10. Contact

For questions or support, contact the development team.
