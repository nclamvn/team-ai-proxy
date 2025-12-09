/**
 * Application configuration
 * Centralized config for demo mode and app branding
 */

// Demo Mode - when true, uses demo user ID without real auth
export const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

// Demo user ID for development/demo purposes
export const DEMO_USER_ID = '00000000-0000-0000-0000-000000000001';

// App branding
export const APP_CONFIG = {
  name: 'TeamMemory AI',
  tagline: 'Trí nhớ tập thể cho team của bạn',
  description: 'AI Assistant thông minh với Knowledge Base được chia sẻ. Hỏi đáp, tìm kiếm, và xây dựng kiến thức chung cho cả team.',

  // Features highlight for landing page
  features: [
    {
      title: 'AI Chat Thông Minh',
      description: 'Proxy tới OpenAI với context của team',
      icon: 'chat',
    },
    {
      title: 'Knowledge Base Tự Động',
      description: 'Mỗi câu hỏi trở thành kiến thức chung',
      icon: 'database',
    },
    {
      title: 'Tìm Kiếm Ngữ Nghĩa',
      description: 'Tìm câu trả lời tương tự đã có sẵn',
      icon: 'search',
    },
  ],

  // Sample questions for demo
  sampleQuestions: [
    'Làm thế nào để deploy Next.js lên Vercel?',
    'Giải thích React Server Components',
    'Best practices cho TypeScript trong dự án lớn',
    'Cách setup CI/CD với GitHub Actions',
    'Tối ưu performance cho PostgreSQL queries',
  ],
};

// Get user ID - in demo mode, always returns demo user
export function getUserId(requestUserId?: string): string {
  if (DEMO_MODE) {
    return DEMO_USER_ID;
  }
  return requestUserId || DEMO_USER_ID;
}
